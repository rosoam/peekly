import { DEFAULT_SETTINGS, SETTINGS_KEY } from '../shared/messages';
import type { RuntimeMessage, Settings } from '../shared/messages';

// Only these protocols are allowed for the "Open in editor" feature.
// Restricting protocols prevents any internal XSS from turning into an
// arbitrary http(s) navigation (phishing / malware download).
const ALLOWED_EDITOR_PROTOCOLS = new Set([
  'vscode:',
  'vscode-insiders:',
  'cursor:',
  'webstorm:',
  'idea:',
  'pycharm:',
  'subl:',
]);

function isAllowedEditorUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  return ALLOWED_EDITOR_PROTOCOLS.has(parsed.protocol);
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message?.kind === 'open-editor' && typeof message.url === 'string') {
    if (!isAllowedEditorUrl(message.url)) {
      sendResponse({ ok: false, error: 'protocol not allowed' });
      return true;
    }
    chrome.tabs
      .create({ url: message.url, active: false })
      .then(
        (tab) => {
          // Auto-close the helper tab; the OS protocol handler has already taken over.
          if (tab.id != null) {
            setTimeout(() => {
              chrome.tabs.remove(tab.id!).catch(() => undefined);
            }, 800);
          }
          sendResponse({ ok: true });
        },
        (err: Error) => sendResponse({ ok: false, error: err.message }),
      );
    return true;
  }
  return false;
});

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  const existing = stored[SETTINGS_KEY] as Partial<Settings> | undefined;
  if (!existing) {
    await chrome.storage.local.set({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
  } else {
    // Backfill any new defaults onto existing settings.
    await chrome.storage.local.set({
      [SETTINGS_KEY]: { ...DEFAULT_SETTINGS, ...existing },
    });
  }
});
