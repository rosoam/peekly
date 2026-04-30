#!/usr/bin/env bun
/**
 * Cut a release: bump version everywhere, update CHANGELOG, run quality
 * gates, commit, and tag.
 *
 *   bun run release patch    # 0.1.0 → 0.1.1
 *   bun run release minor    # 0.1.0 → 0.2.0
 *   bun run release major    # 0.1.0 → 1.0.0
 *
 * The script never pushes — it stops just after `git tag` and prints the
 * two commands to run. That keeps publishing to GitHub a deliberate step.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Bump = 'patch' | 'minor' | 'major';

const ROOT = resolve(import.meta.dir, '..');
const PKG_PATH = resolve(ROOT, 'package.json');
const VITE_PATH = resolve(ROOT, 'vite.config.ts');
const CHANGELOG_PATH = resolve(ROOT, 'CHANGELOG.md');

const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function fail(msg: string): never {
  console.error(`${C.red}✗ ${msg}${C.reset}`);
  process.exit(1);
}

function run(cmd: string, opts: { stdio?: 'inherit' | 'pipe' } = {}): string {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: opts.stdio ?? 'pipe' });
}

function step(label: string): void {
  console.log(`${C.cyan}▸${C.reset} ${label}`);
}

// ─── Parse args ───────────────────────────────────────────────────────

const arg = (process.argv[2] ?? '').toLowerCase();
if (arg !== 'patch' && arg !== 'minor' && arg !== 'major') {
  fail('Usage: bun run release patch | minor | major');
}
const bump = arg as Bump;

// ─── Pre-flight ───────────────────────────────────────────────────────

step('Pre-flight checks');

if (!existsSync(PKG_PATH)) fail('package.json not found');
if (!existsSync(VITE_PATH)) fail('vite.config.ts not found');
if (!existsSync(CHANGELOG_PATH)) fail('CHANGELOG.md not found');

const branch = run('git rev-parse --abbrev-ref HEAD').trim();
if (branch !== 'main') {
  fail(`Releases must be cut from main (currently on ${branch}).`);
}

const dirty = run('git status --porcelain').trim();
if (dirty) {
  fail(`Working tree not clean:\n${dirty}\nCommit or stash first.`);
}

// ─── Compute next version ─────────────────────────────────────────────

const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf8')) as { version: string };
const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(pkg.version);
if (!match) fail(`Cannot parse current version: ${pkg.version}`);
const [, majS, minS, patS] = match;
const cur = { major: Number(majS), minor: Number(minS), patch: Number(patS) };
const nxt = { ...cur };
if (bump === 'major') {
  nxt.major += 1;
  nxt.minor = 0;
  nxt.patch = 0;
} else if (bump === 'minor') {
  nxt.minor += 1;
  nxt.patch = 0;
} else {
  nxt.patch += 1;
}
const nextVersion = `${nxt.major}.${nxt.minor}.${nxt.patch}`;
const tag = `v${nextVersion}`;

console.log(`  ${C.dim}${pkg.version}${C.reset} → ${C.bold}${C.green}${nextVersion}${C.reset}`);

// Make sure the tag doesn't already exist locally or on origin.
try {
  run(`git rev-parse ${tag}`);
  fail(`Tag ${tag} already exists locally.`);
} catch {
  // expected: tag doesn't exist yet
}

// ─── Run quality gates ────────────────────────────────────────────────

step('Typecheck');
run('bun run typecheck', { stdio: 'inherit' });

step('Build');
run('bun run build', { stdio: 'inherit' });

// Verify the dist looks right
const distManifest = resolve(ROOT, 'dist', 'manifest.json');
if (!existsSync(distManifest)) fail('Build did not produce dist/manifest.json');

// ─── Bump version in package.json ─────────────────────────────────────

step(`Bump package.json → ${nextVersion}`);
pkg.version = nextVersion;
writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n');

// ─── Bump version in vite.config.ts (defineManifest) ─────────────────

step(`Bump vite.config.ts → ${nextVersion}`);
const vite = readFileSync(VITE_PATH, 'utf8');
const viteUpdated = vite.replace(
  /(\bdefineManifest\([\s\S]*?\bversion:\s*)'([^']+)'/,
  (_m, prefix) => `${prefix}'${nextVersion}'`,
);
if (viteUpdated === vite) {
  fail('Could not find `version: \'…\'` inside defineManifest() in vite.config.ts');
}
writeFileSync(VITE_PATH, viteUpdated);

// ─── Update CHANGELOG ─────────────────────────────────────────────────

step(`Update CHANGELOG.md`);
const changelog = readFileSync(CHANGELOG_PATH, 'utf8');
if (!changelog.includes('## [Unreleased]')) {
  fail('CHANGELOG.md must contain a "## [Unreleased]" section above the most recent release.');
}

const today = new Date().toISOString().slice(0, 10);
const replaced = changelog.replace(
  '## [Unreleased]',
  `## [Unreleased]\n\n## [${nextVersion}] - ${today}`,
);

// Append the link reference at end of file if not already there.
const linkRef = `[${nextVersion}]: https://github.com/rosoam/peekly/releases/tag/${tag}`;
let final = replaced;
if (!final.includes(linkRef)) {
  final = final.trimEnd() + `\n${linkRef}\n`;
}
writeFileSync(CHANGELOG_PATH, final);

// ─── Commit + tag ─────────────────────────────────────────────────────

step('Commit');
run('git add package.json vite.config.ts CHANGELOG.md');
run(`git commit -m "chore(release): ${tag}"`, { stdio: 'inherit' });

step(`Tag ${tag}`);
run(`git tag ${tag}`);

// ─── Done ─────────────────────────────────────────────────────────────

console.log(`
${C.green}${C.bold}✓ Local release ${tag} ready.${C.reset}

${C.bold}To publish:${C.reset}
  ${C.cyan}git push origin main${C.reset}
  ${C.cyan}git push origin ${tag}${C.reset}

The tag push triggers ${C.bold}.github/workflows/release.yml${C.reset} which will:
  • install deps + generate icons
  • typecheck + build
  • zip → ${C.bold}peekly.zip${C.reset}
  • create a GitHub Release with the zip attached
  • generate release notes from commit history

${C.dim}Tip:${C.reset} after pushing, watch CI:  ${C.cyan}gh run watch${C.reset}
`);
