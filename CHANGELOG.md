# Changelog

All notable changes to Peekly will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-04-30

### Added

- Initial public release.
- Hold `Option` / `Alt` and hover to highlight the React component under the cursor (real bounding box, not just the DOM element).
- `Option` + click to open the inspector panel.
- Source card with **Open in VS Code / Cursor / WebStorm / Sublime** primary action and **Copy path** secondary action.
- Live re-render counter via an injected `__REACT_DEVTOOLS_GLOBAL_HOOK__` stub (works without React DevTools installed).
- Parent / children navigation (clickable chips re-inspect without moving the mouse).
- Props with smart serialization (objects, arrays, React elements, inline-function detection).
- Computed styles section (collapsible).
- Tailwind / UnoCSS class breakdown grouped by variant (collapsible).
- Accessibility mini-audit: missing `alt`, accessible name, label associations, WCAG contrast ratio.
- Generic anti-pattern hints: inline functions in props, `dangerouslySetInnerHTML`, very long classNames.
- Owner chain with clickable source links.
- **Highlight all instances** of the same component on the page (header icon).
- **Outline mode** (`Option + Shift + move`) — every component boundary on the page in a faint dashed overlay.
- Draggable panel by header.
- Auto-on `localhost` (toggleable in the popup).
- Top-level **Copy all** action that produces a paste-friendly text summary (name, kind, source, props with values, children, owner chain).
- Click on the component name in the panel header selects the full name; small copy icon next to it.
- Shadow DOM overlay so styles never collide with the host site.
- Two content scripts (ISOLATED world for UI, MAIN world for fiber access) with a namespaced `postMessage` protocol.
- `all_frames: true` for iframes (each frame self-contained for now).
- MIT license, MV3 manifest, English docs, CI on push and PR.

[0.1.0]: https://github.com/rosoam/peekly/releases/tag/v0.1.0
