import { DEFAULT_SETTINGS, SETTINGS_KEY } from '../shared/messages';
import type { RuntimeMessage, Settings } from '../shared/messages';

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message?.kind === 'open-editor' && typeof message.url === 'string') {
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
