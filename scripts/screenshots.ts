#!/usr/bin/env bun
/**
 * Generate Chrome Web Store screenshots automatically.
 *
 * Pipeline (one command, no other terminals):
 *   1. Build Peekly                       (bun run build)
 *   2. Boot the demo Vite dev server      (cd demo && vite --port 5173)
 *   3. Wait for it to be reachable
 *   4. Launch Chrome with Peekly loaded   (Playwright persistent context)
 *   5. Drive Option / Option+Shift / Option+click gestures over chosen
 *      elements and capture 1280×800 PNGs to ./screenshots/
 *   6. Tear down the browser and the demo server
 *
 * Usage:
 *   bun run screenshots
 *
 * One-time setup (Playwright fetches its bundled Chromium):
 *   bunx playwright install chromium
 */

import { execSync, spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, type BrowserContext } from 'playwright';

const ROOT = resolve(import.meta.dir, '..');
const EXT_PATH = resolve(ROOT, 'dist');
const DEMO_DIR = resolve(ROOT, 'demo');
const OUT_DIR = resolve(ROOT, 'screenshots');
const PROFILE_DIR = resolve(ROOT, '.pw-profile');
const DEMO_URL = 'http://127.0.0.1:5173';

// Documented manifest of what each shot captures (referenced inline below).

const C = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
};

function step(msg: string): void {
  console.log(`${C.cyan}▸${C.reset} ${msg}`);
}

function info(msg: string): void {
  console.log(`  ${C.dim}${msg}${C.reset}`);
}

function fail(msg: string): never {
  console.error(`${C.red}✗ ${msg}${C.reset}`);
  process.exit(1);
}

// ─── Pre-flight ──────────────────────────────────────────────────────

if (!existsSync(EXT_PATH)) {
  fail(`Peekly is not built. Run \`bun run build\` first (or use the orchestrator below).`);
}

// Build Peekly fresh so screenshots match the current source.
step('Building Peekly');
execSync('bun run build', { cwd: ROOT, stdio: 'inherit' });

// Make sure demo deps are installed.
const demoNodeModules = resolve(DEMO_DIR, 'node_modules');
if (!existsSync(demoNodeModules)) {
  step('Installing demo dependencies');
  execSync('bun install', { cwd: DEMO_DIR, stdio: 'inherit' });
}

mkdirSync(OUT_DIR, { recursive: true });

// ─── Demo server ─────────────────────────────────────────────────────

step('Starting demo dev server');
const demo: ChildProcess = spawn('bun', ['run', 'dev'], {
  cwd: DEMO_DIR,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, FORCE_COLOR: '0' },
});

demo.stderr?.on('data', (chunk: Buffer) => {
  process.stderr.write(`${C.dim}[demo] ${chunk.toString()}${C.reset}`);
});

await waitForReady(20_000);
info(`demo running at ${DEMO_URL}`);

// ─── Browser ─────────────────────────────────────────────────────────

step('Launching Chrome with Peekly loaded');

// Playwright's bundled chromium-headless-shell does not support MV3 extensions.
// We need a full Chrome / Chromium binary. Try, in order:
//   1. CHROME_PATH env var
//   2. macOS Chrome.app
//   3. Linux google-chrome / chromium
//   4. Windows Chrome
function findChromeExecutable(): string | null {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

const chromePath = findChromeExecutable();
if (!chromePath) {
  fail(
    'Could not locate a Chrome/Chromium binary that supports extensions.\n' +
      'Set CHROME_PATH env var, or install Google Chrome.',
  );
}
info(`using ${chromePath}`);

// Playwright's launchPersistentContext silently strips/conflicts with the
// `--load-extension` flag on recent Chrome versions, even with
// ignoreDefaultArgs. Workaround: launch Chrome ourselves with the right
// flags + a remote-debugging port, then attach Playwright over CDP.
const CDP_PORT = 9222;
step('Starting Chrome (manual launch for extension support)');
const chromeProcess: ChildProcess = spawn(
  chromePath,
  [
    `--disable-extensions-except=${EXT_PATH}`,
    `--load-extension=${EXT_PATH}`,
    `--user-data-dir=${PROFILE_DIR}`,
    `--remote-debugging-port=${CDP_PORT}`,
    `--window-size=1280,800`,
    '--no-default-browser-check',
    '--no-first-run',
    '--disable-features=Translate',
    'about:blank',
  ],
  { stdio: ['ignore', 'pipe', 'pipe'] },
);
chromeProcess.stderr?.on('data', (chunk: Buffer) => {
  const t = chunk.toString();
  if (t.includes('listening on') || t.includes('DevTools')) info(t.trim().slice(0, 120));
});

// Wait for the CDP endpoint
await new Promise<void>((resolve, reject) => {
  const deadline = Date.now() + 15_000;
  const interval = setInterval(async () => {
    if (Date.now() > deadline) {
      clearInterval(interval);
      reject(new Error('Chrome CDP did not become ready in 15s'));
      return;
    }
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
      if (res.ok) {
        clearInterval(interval);
        resolve();
      }
    } catch {
      // not yet
    }
  }, 200);
});
info(`Chrome CDP ready on port ${CDP_PORT}`);

// Fetch the wsEndpoint explicitly — connectOverCDP's auto-discovery is flaky
// on some Chrome builds.
const versionInfo = (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json()) as {
  webSocketDebuggerUrl?: string;
};
const wsEndpoint = versionInfo.webSocketDebuggerUrl;
if (!wsEndpoint) fail('Chrome did not expose webSocketDebuggerUrl');
info(`CDP ws: ${wsEndpoint}`);

const browser = await chromium.connectOverCDP(wsEndpoint, { timeout: 60_000 });
const context: BrowserContext = browser.contexts()[0]!;

const page = context.pages()[0] ?? (await context.newPage());
await page.setViewportSize({ width: 1280, height: 800 });
await page.goto(DEMO_URL);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(800); // let the layout settle

// Diagnostic: verify the Peekly content script attached its host element
const diag = await page.evaluate(() => ({
  hasHost: !!document.getElementById('react-picker-host'),
  hasReactFiberKey: !!document.querySelector('article')
    ? Object.keys(document.querySelector('article')!).some(
        (k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'),
      )
    : false,
  hostname: window.location.hostname,
  ua: navigator.userAgent,
}));
info(`diagnostic: ${JSON.stringify(diag)}`);
if (!diag.hasHost) {
  // Sniff: is the extension registered at all?
  const extPage = await context.newPage();
  await extPage.goto('chrome://extensions/');
  await extPage.waitForTimeout(1000);
  const extDiag = await extPage.evaluate(() => {
    const items = document.querySelector('extensions-manager')?.shadowRoot
      ?.querySelector('extensions-item-list')?.shadowRoot
      ?.querySelectorAll('extensions-item');
    if (!items) return { count: 'unknown', html: document.body.innerText.slice(0, 200) };
    const names = Array.from(items).map((el) => {
      const root = (el as HTMLElement).shadowRoot;
      return root?.querySelector('#name')?.textContent ?? '?';
    });
    return { count: names.length, names };
  });
  info(`chrome://extensions/ → ${JSON.stringify(extDiag)}`);
  await extPage.close();
  fail('Peekly content script did not attach.');
}

// ─── Capture sequence ───────────────────────────────────────────────

const out = (id: string): string => resolve(OUT_DIR, `${id}.png`);

async function holdAndScreenshot(args: {
  pos: { x: number; y: number };
  modifiers: ('Alt' | 'Shift')[];
  preDelay?: number;
  outPath: string;
  click?: boolean;
}): Promise<void> {
  const { pos, modifiers, preDelay = 600, outPath, click = false } = args;
  // 1. Move cursor onto the target so highlight + tooltip activate
  for (const mod of modifiers) await page.keyboard.down(mod);
  await page.mouse.move(pos.x, pos.y, { steps: 10 });
  await page.waitForTimeout(preDelay);
  if (click) {
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: outPath, type: 'png', clip: { x: 0, y: 0, width: 1280, height: 800 } });
  for (const mod of [...modifiers].reverse()) await page.keyboard.up(mod);
  // Press Esc to clear any panel/tooltip before next shot
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
}

async function elementCenter(selector: string): Promise<{ x: number; y: number }> {
  const handle = await page.locator(selector).first().boundingBox();
  if (!handle) fail(`Could not find element: ${selector}`);
  return { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 };
}

step('Capturing screenshots');

// 1. Hero — Tooltip Comp tab on the first stat card
{
  const pos = await elementCenter('article');
  await holdAndScreenshot({
    pos,
    modifiers: ['Alt', 'Shift'],
    outPath: out('01-hero'),
  });
  info('01-hero — Comp tab on stat card');
}

// 2. DOM tab — same hover, then send a synthetic click on the DOM tab.
//    Because the tooltip lives in a closed shadow DOM, we re-position the
//    cursor on the DOM tab via known coordinates after Shift release pins it.
{
  const pos = await elementCenter('article');
  await page.keyboard.down('Alt');
  await page.keyboard.down('Shift');
  await page.mouse.move(pos.x, pos.y, { steps: 10 });
  await page.waitForTimeout(500);
  // Release Shift to pin the tooltip in place
  await page.keyboard.up('Shift');
  await page.waitForTimeout(200);
  // The tooltip pops to the right of the cursor by default. The DOM tab is the
  // 2nd tab in the strip, ~52-92 px right of the tooltip's left edge, ~58 px
  // below the tooltip's top edge. The tooltip anchor is (pos.x + 16, pos.y + 12).
  const tooltipLeft = pos.x + 16;
  const tooltipTop = pos.y + 12;
  await page.mouse.click(tooltipLeft + 88, tooltipTop + 50, { delay: 50 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: out('02-dom-tab'), type: 'png', clip: { x: 0, y: 0, width: 1280, height: 800 } });
  info('02-dom-tab — DOM tab with HTML rendering');
  await page.keyboard.up('Alt');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
}

// 3. CSS tab — same trick, click the 3rd tab
{
  const pos = await elementCenter('article');
  await page.keyboard.down('Alt');
  await page.keyboard.down('Shift');
  await page.mouse.move(pos.x, pos.y, { steps: 10 });
  await page.waitForTimeout(500);
  await page.keyboard.up('Shift');
  await page.waitForTimeout(200);
  const tooltipLeft = pos.x + 16;
  const tooltipTop = pos.y + 12;
  await page.mouse.click(tooltipLeft + 138, tooltipTop + 50, { delay: 50 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: out('03-css-tab'), type: 'png', clip: { x: 0, y: 0, width: 1280, height: 800 } });
  info('03-css-tab — CSS tab + Tailwind variants');
  await page.keyboard.up('Alt');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
}

// 4. Full panel — Option + click on a stat card opens the rich panel
{
  const pos = await elementCenter('article');
  await holdAndScreenshot({
    pos,
    modifiers: ['Alt'],
    outPath: out('04-full-panel'),
    click: true,
    preDelay: 300,
  });
  info('04-full-panel — full inspector after Option+click');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
}

// 5. Plain DOM — hover a non-component element (the kbd in the sidebar tip)
{
  const kbd = page.locator('aside kbd').first();
  const box = await kbd.boundingBox();
  if (!box) fail('Could not find sidebar kbd element');
  const pos = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await holdAndScreenshot({
    pos,
    modifiers: ['Alt', 'Shift'],
    outPath: out('05-plain-html'),
  });
  info('05-plain-html — Plain DOM tooltip on a small element');
}

// ─── Tear down ──────────────────────────────────────────────────────

step('Closing browser');
await browser.close();
chromeProcess.kill('SIGTERM');
await new Promise<void>((r) => chromeProcess.on('exit', () => r()));

step('Stopping demo server');
demo.kill('SIGTERM');
await new Promise<void>((r) => demo.on('exit', () => r()));

console.log(`
${C.green}✓ Done.${C.reset} Screenshots in:
  ${C.cyan}${OUT_DIR}${C.reset}

Next:
  - Pick the best ones for the Chrome Web Store listing (1280×800).
  - Optionally crop / annotate in your tool of choice.
  - Drop them into the listing form in the dashboard.
`);

// ─── Helpers ────────────────────────────────────────────────────────

async function waitForReady(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  // Probe the server with HEAD requests — far more reliable than parsing stdout.
  while (Date.now() < deadline) {
    try {
      const res = await fetch(DEMO_URL, { method: 'HEAD' });
      if (res.ok || res.status === 200 || res.status === 304) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  demo.kill();
  fail(`demo server didn't become reachable within ${timeoutMs}ms`);
}
