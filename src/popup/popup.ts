import { DEFAULT_SETTINGS, SETTINGS_KEY } from '../shared/messages';
import type { Hotkeys, Settings } from '../shared/messages';

const toggle = document.getElementById('toggle')!;
const toggleState = document.getElementById('toggle-state')!;
const autoLocal = document.getElementById('auto-localhost')!;
const autoLocalState = document.getElementById('auto-localhost-state')!;
const inspectBtn = document.getElementById('hotkey-inspect') as HTMLButtonElement;
const networkBtn = document.getElementById('hotkey-network') as HTMLButtonElement;

function render(settings: Settings): void {
  toggleState.textContent = settings.enabled ? 'on' : 'off';
  toggleState.classList.toggle('on', settings.enabled);
  autoLocalState.textContent = settings.autoOnLocalhost ? 'on' : 'off';
  autoLocalState.classList.toggle('on', settings.autoOnLocalhost);
  inspectBtn.textContent = settings.hotkeys.inspect;
  networkBtn.textContent = settings.hotkeys.network;
}

async function load(): Promise<Settings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  const persisted = stored[SETTINGS_KEY] as Partial<Settings> | undefined;
  return {
    ...DEFAULT_SETTINGS,
    ...(persisted ?? {}),
    hotkeys: { ...DEFAULT_SETTINGS.hotkeys, ...(persisted?.hotkeys ?? {}) },
  };
}

async function save(next: Settings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  render(next);
}

function isValidHotkey(key: string): boolean {
  if (key.length !== 1) return false;
  const c = key.toLowerCase();
  return (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9');
}

let activeCapture: { btn: HTMLButtonElement; field: keyof Hotkeys } | null = null;

function startCapture(btn: HTMLButtonElement, field: keyof Hotkeys): void {
  if (activeCapture) cancelCapture();
  activeCapture = { btn, field };
  btn.classList.add('capturing');
  btn.textContent = '…';
}

function cancelCapture(): void {
  if (!activeCapture) return;
  activeCapture.btn.classList.remove('capturing');
  void load().then((s) => render(s));
  activeCapture = null;
}

async function commitCapture(key: string): Promise<void> {
  if (!activeCapture) return;
  const cur = await load();
  const lowered = key.toLowerCase();
  // Prevent duplicate hotkeys (would make one of them silently dead).
  const other = activeCapture.field === 'inspect' ? cur.hotkeys.network : cur.hotkeys.inspect;
  if (lowered === other.toLowerCase()) {
    activeCapture.btn.textContent = '⚠';
    setTimeout(() => cancelCapture(), 600);
    return;
  }
  const nextHotkeys: Hotkeys = { ...cur.hotkeys, [activeCapture.field]: lowered };
  activeCapture.btn.classList.remove('capturing');
  activeCapture = null;
  await save({ ...cur, hotkeys: nextHotkeys });
}

document.addEventListener('keydown', (ev) => {
  if (!activeCapture) return;
  ev.preventDefault();
  ev.stopPropagation();
  if (ev.key === 'Escape') {
    cancelCapture();
    return;
  }
  if (!isValidHotkey(ev.key)) return;
  void commitCapture(ev.key);
});

async function init(): Promise<void> {
  const settings = await load();
  render(settings);

  toggle.addEventListener('click', async () => {
    const cur = await load();
    await save({ ...cur, enabled: !cur.enabled });
  });
  toggle.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      toggle.click();
    }
  });

  autoLocal.addEventListener('click', async () => {
    const cur = await load();
    await save({ ...cur, autoOnLocalhost: !cur.autoOnLocalhost });
  });
  autoLocal.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      autoLocal.click();
    }
  });

  inspectBtn.addEventListener('click', () => startCapture(inspectBtn, 'inspect'));
  networkBtn.addEventListener('click', () => startCapture(networkBtn, 'network'));
}

void init();
