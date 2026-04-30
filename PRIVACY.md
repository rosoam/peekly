# Privacy Policy

**Last updated: 2026-04-30**

Peekly is a developer tool. It is designed to help you inspect React components and DOM elements on web pages you are already visiting.

## Data we collect

**None.**

Peekly does not collect, transmit, or store any of your personal data, browsing history, page content, or any other information on any remote server.

## Data stored locally

Peekly stores a small set of user preferences in your browser's local extension storage (`chrome.storage.local`):

- Whether the picker is globally active (`enabled` — boolean)
- Whether the picker auto-activates on `localhost` (`autoOnLocalhost` — boolean)
- The selected editor for the "Open in" button (`editor` — one of `vscode | cursor | webstorm | sublime | none`)

This data never leaves your device. Uninstalling Peekly removes it.

## Permissions explained

Peekly requests the following permissions in its manifest:

| Permission | Why |
|---|---|
| `<all_urls>` (host_permissions) | Required to inject the inspector on any site you choose to use it on. The picker is **off by default** on every site except `localhost`; you must explicitly enable it via the popup for any other site. |
| `storage` | To remember the three settings listed above between sessions. |
| `activeTab` | To activate the picker on the tab you have focused. |

## What Peekly reads from a page

When you hold `Option` / `Alt` and click an element, Peekly:

1. Reads the React fiber attached to that DOM node (in-memory data structure provided by React itself).
2. Extracts component name, props, source file location, and parent / children component references.
3. Reads CSS computed styles and class names of the element.
4. Sends the result to a small floating panel rendered as a Shadow DOM overlay on the same page.

**All of this happens locally in your browser. Nothing is sent over the network.**

## Network requests

Peekly never makes network requests of its own. The only network-like action it can take is opening an editor URL (`vscode://...`, `cursor://...`, etc.) when you click "Open in editor". This is handled by the OS protocol handler on your machine, not by Peekly itself.

## Third-party services

None.

## Children's privacy

Peekly is a developer tool not directed at children under 13.

## Contact

If you have any questions about this policy, please open an issue at <https://github.com/rosoam/peekly/issues>.

## Changes

Any changes to this policy will be posted in this file with an updated "Last updated" date.
