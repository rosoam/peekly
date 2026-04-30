import { DEFAULT_SETTINGS, SETTINGS_KEY } from '../shared/messages';
import type { EditorId, Settings } from '../shared/messages';

const toggle = document.getElementById('toggle')!;
const toggleState = document.getElementById('toggle-state')!;
const autoLocal = document.getElementById('auto-localhost')!;
const autoLocalState = document.getElementById('auto-localhost-state')!;
const editorSelect = document.getElementById('editor') as HTMLSelectElement;

function render(settings: Settings): void {
  toggleState.textContent = settings.enabled ? 'on' : 'off';
  toggleState.classList.toggle('on', settings.enabled);
  autoLocalState.textContent = settings.autoOnLocalhost ? 'on' : 'off';
  autoLocalState.classList.toggle('on', settings.autoOnLocalhost);
  editorSelect.value = settings.editor;
}

async function load(): Promise<Settings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  const persisted = stored[SETTINGS_KEY] as Partial<Settings> | undefined;
  return { ...DEFAULT_SETTINGS, ...(persisted ?? {}) };
}

async function save(next: Settings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  render(next);
}

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

  editorSelect.addEventListener('change', async () => {
    const cur = await load();
    await save({ ...cur, editor: editorSelect.value as EditorId });
  });
}

void init();
