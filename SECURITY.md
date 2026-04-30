# Security Policy

## Reporting a Vulnerability

If you find a security issue in Peekly, **please don't open a public GitHub issue.** Email the maintainer directly:

📧 **romario.sobreira@hotmail.com**

Please include:

- A description of the issue
- Steps to reproduce (a minimal HTML page is ideal)
- The browser version and OS
- Optionally a proof-of-concept video or screenshot

You'll get an acknowledgement within **5 days**. Critical issues are patched within **14 days**, lower severity within **30 days**. Once a fix is shipped, a credit (or anonymous note, your choice) lands in [CHANGELOG.md](CHANGELOG.md) under `### Security`.

## Supported Versions

Only the **latest published version** on Chrome Web Store and GitHub Releases is supported. Older versions don't get backported fixes.

| Version | Supported |
|---------|-----------|
| 0.2.x   | ✅ |
| 0.1.x   | ❌ |

## Threat Model

### What Peekly defends against

- **Page-supplied data is treated as untrusted.** Every value read from React fiber trees (component names, props, source paths) or from DOM attributes is rendered via `textContent` — never `innerHTML`. There is no `eval`, no `new Function`, no dynamic `<script>` insertion, no inline event-handler attributes set from data.
- **Cross-world isolation is respected.** The two content scripts (ISOLATED + MAIN world) communicate only via `window.postMessage`, and both sides validate `event.source === window` and `data.source === 'react-picker'` (the internal namespace). No `chrome.runtime` channel is exposed to the page.
- **`open-editor` URLs are whitelisted.** The service worker only forwards URLs whose protocol is in a known editor list: `vscode:`, `vscode-insiders:`, `cursor:`, `webstorm:`, `idea:`, `pycharm:`, `subl:`. Any other URL is rejected before it reaches `chrome.tabs.create`. This means even if our isolated world were compromised, it could not pivot to opening arbitrary `http(s)` tabs (phishing, malware download).
- **No network egress.** Peekly never calls `fetch`, never opens `WebSocket`, never uses `XMLHttpRequest`, `navigator.sendBeacon`, or any other network API. All processing is local. This is enforceable: search the source tree for those identifiers and you'll find none in production code.
- **Minimal storage.** Three user preferences (`enabled`, `autoOnLocalhost`, `editor`) live in `chrome.storage.local`. No PII. No telemetry. No remote identifier. No analytics SDK.

### What Peekly explicitly does *not* defend against

- **A malicious extension already running in the same browser.** Other extensions can manipulate the same page; Peekly assumes user-installed extensions are trustworthy.
- **The user enabling Peekly on a phishing or hostile site.** Peekly is an inspector — it reads page state. The page is the threat surface, not Peekly. The same caveat applies to React DevTools.
- **Bugs in Chrome's own sandbox or the V8 engine.**
- **Supply-chain compromise of `@crxjs/vite-plugin`, `@resvg/resvg-js`, or any of our build-time dependencies.** We pin versions via `bun.lock` but cannot audit upstream code per release. Build reproducibility (below) is the recourse.

### Permissions

| Permission | Risk | Justification |
|---|---|---|
| `<all_urls>` (host_permissions) | High in principle | Required by the content-script architecture: the inspector must be able to attach on any site the user chooses. The picker is **off by default** on every site except `localhost` / `127.0.0.1` / `*.localhost`. Users opt in per-site via the popup toggle. Page content is read locally but never transmitted. |
| `storage` | None | Three booleans/enums. |
| `activeTab` | Low | Activate the inspector on the user's currently focused tab when triggered from the popup. |

Permissions Peekly **does not** ask for, on purpose: `tabs` (full tab access), `webRequest` (network sniffing), `cookies`, `clipboardRead`, `clipboardWrite` (clipboard is accessed via the standard `navigator.clipboard.writeText` API that requires a user gesture), `downloads`, `notifications`, `identity`.

## Build Reproducibility

Every release is built from the public `main` branch by GitHub Actions on a `vX.Y.Z` tag push. The build environment is:

- Ubuntu latest (GitHub-hosted runner)
- Bun latest
- Dependencies frozen via `bun.lock`

To reproduce a release locally and verify the artifact:

```bash
git fetch --tags
git checkout vX.Y.Z
bun install --frozen-lockfile
bun run gen:icons
bun run build
shasum -a 256 dist/assets/*.js
```

Compare the resulting `dist/` against the `peekly.zip` attached to the matching [GitHub Release](https://github.com/rosoam/peekly/releases). Any deviation should be reported per the procedure at the top of this document.

## Security Audit History

### v0.2.0 — 2026-04-30 (pre-release)

Two issues caught during a pre-release audit, fixed before tag:

- **XSS via crafted component names in the contextual tooltip.** The tooltip rendered owner-chain entries, current-element labels, and a11y warnings via `innerHTML` template literals containing values from React fibers. A page could rename its components via `displayName` to inject markup that would execute in our isolated content script. Fixed by replacing every dynamic `innerHTML` with `createElement` + `textContent`. Severity: medium (limited blast radius — isolated world only — no `chrome.*` API exposed to attacker code).
- **Open-redirect via the `open-editor` runtime message.** The service worker accepted any URL string and forwarded it to `chrome.tabs.create`. Combined with the XSS above, an attacker could open arbitrary tabs (phishing). Fixed by parsing the URL and rejecting any protocol not in the editor whitelist. Severity: low (depended on the XSS to be exploitable).

### v0.1.0 — 2026-04-30

Initial release. Manual review by author. No external audit.

## Reporting Hall of Fame

(empty — first finder, your name will go here)
