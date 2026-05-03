# Peekly

> A near-invisible Chrome extension to peek at any React component, DOM element, or CSS — fast, seamless, on any site.

[![CI](https://github.com/rosoam/peekly/actions/workflows/ci.yml/badge.svg)](https://github.com/rosoam/peekly/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/manifest-v3-success.svg)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)

**Hold `x` to inspect any component. Press `y` for the Network Inspector.**

No need to open DevTools. No need to switch tabs. Peekly lives quietly in the background and only shows up when you ask for it.

---

## What it does

- **Hold `x`, hover any element** → an indigo border highlights the **React component** under the cursor; a floating contextual tooltip appears next to the cursor with tabs (`Comp` / `DOM` / `CSS` / `A11y`). The tooltip is **sticky**: releasing `x` leaves it on screen so you can interact with it. Click outside or press `Esc` to dismiss it. Re-pressing `x` resumes live cursor tracking for a fresh inspection.
- **`x` + click** → a floating panel opens with everything you need:
  - **Source file** with one-click open in **VS Code / Cursor / WebStorm / Sublime**
  - **Parent and children navigation** (chips you can click to re-inspect — no need to move the mouse)
  - **Live re-render counter** (powered by the React DevTools commit hook, installed automatically)
  - **Props** with smart serialization (objects, arrays, React elements, functions — inline arrows flagged)
  - **Computed styles** (display, position, z-index, background, font, size, padding, margin, border, radius)
  - **Class breakdown** (Tailwind / UnoCSS) — grouped by `base / sm: / md: / dark: / hover: / focus: / group-* / before: / …`
  - **Accessibility audit** — missing `alt`, `aria-label`, label associations, contrast ratio (WCAG)
  - **Hints** — inline functions in props, `dangerouslySetInnerHTML`, very long classNames
  - **Owner chain** — clickable links to every ancestor's source file
- **Highlight all instances** (icon in the panel header) → paint every render of the same component on the page
- **Drag the panel** by its header to reposition it
- **Press `y`** → toggle the **Network Inspector** panel: a floating draggable panel that captures every `fetch` and `XHR` request on the page in real time, with filtering, request detail tabs, TypeScript interface generation, GraphQL analysis, and performance overlays.

Plain letter keys (`x` / `y`) are intentional — they're easy to reach with one hand and don't collide with the OS / browser shortcuts that real modifiers (`Option`, `Shift`, `Ctrl`) tend to clash with. They're only active when you're not typing in a form field.

## Network Inspector

Press `y` on any page to open the Network Inspector — a floating draggable panel that captures every `fetch` and `XMLHttpRequest` call made by the page.

- **Request list** — method badge, path, smart human-readable label, status, duration. Slow requests are highlighted in orange.
- **Filter bar** — text search, method filter (GET / POST / PUT / DELETE / PATCH), status filter (2xx / 4xx / 5xx), slow-only toggle.
- **Request detail tabs**: Overview, Request (headers + body), Response (headers + body), TypeScript interface (generated from the JSON response body), GraphQL (operation type, name, variables, and errors — shown only when applicable).
- **Copy buttons** in every tab: Copy headers, Copy body, Copy all.
- **Call stack** — each request shows the JS call frames that triggered it (up to 12, filtered to user-land code). Visible in the Overview tab with per-frame copy buttons.
- **Footer badges**: error count, slow count, N+1 warning, drift indicator, anomaly indicator.
- **N+1 badge** → click for a detail overlay showing every repeated-call pattern with computed burst window, avg/total duration stats, first/last seen timestamps, severity tiers (moderate / high / critical), and a **Copy all** button that exports a full N+1 debug bundle.
- **Request chart overlay** — stats bar (total / avg / p95 / errors / slow) with Timeline (scatter plot with p95 + 500 ms reference lines) and Waterfall (rows with method badge, path, and duration bar) views.
- **Related requests** — when the component inspector is open, a "Related Requests" section shows network calls attributed to that component (via stack-trace analysis).

## Why not React DevTools?

React DevTools is great. Peekly is **complementary**, not a replacement:

| | React DevTools | Peekly |
|---|---|---|
| Panel location | DevTools sidebar | Floating, on-page, draggable |
| Element selection | Open DevTools → click "Select" → click | Hold `x`, click |
| Source jump | Right-click → "Show source" | One-click "Open in editor" button |
| Computed styles | Separate Elements panel | Inline in the same panel |
| Tailwind decode | None | Grouped by variant |
| A11y mini-audit | None | Inline warnings |
| Re-render counter | Profiler tab (recording session) | Live, always-on while inspected |

If you live in the editor and want to jump from "I see this on the page" to "open the file" in a single action, Peekly is for you.

## Installation

### From source

```bash
git clone https://github.com/rosoam/peekly.git
cd peekly
bun install
bun run gen:icons
bun run build
```

In Chrome:

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select the `dist/` folder

### From release zip

Download the latest `peekly.zip` from [Releases](https://github.com/rosoam/peekly/releases), unzip, then **Load unpacked** the folder.

### From Chrome Web Store

_Coming soon._

## Usage

1. Click the Peekly icon → the popup opens.
2. Toggles:
   - **Active** — pick on every site (off by default)
   - **Auto-on localhost** — automatically active on `localhost`, `127.0.0.1`, `*.localhost` (**on by default**)
   - **Editor** — VS Code / Cursor / WebStorm / Sublime / None (drives the "Open in" button)
3. On any supported page (React, Preact, Vue 3, Lit, Livewire, Alpine.js, Twig, or plain DOM):
   - Hold `x` and move the cursor → indigo highlight + contextual tooltip with component details
   - `x` + click → full inspector panel opens
   - Press `y` → toggle the Network Inspector panel
   - Click outside the tooltip / panel, or press `Esc`, to dismiss

## How it works

Two content scripts are injected on every page and iframe:

- An **isolated-world** script (`src/content/main.ts`) handles keyboard / mouse events, the highlight overlay, the component panel, the Network Inspector panel, drag, and storage.
- A **main-world** script (`src/injected/bridge.ts`) accesses the page's React internals. It walks the fiber tree to extract names, props, source locations, parent / children components, and bounding rectangles. It also calls `initNetworkCapture()` (from `src/net/capture.ts`) to patch `window.fetch` and `XMLHttpRequest` in the MAIN world, capturing every request as it is made.

The two scripts communicate via `window.postMessage` with a namespaced protocol. Network request entries travel the same channel from MAIN world to the isolated-world store before being displayed in the Network Inspector panel.

To enable the live re-render counter, the bridge installs a minimal `__REACT_DEVTOOLS_GLOBAL_HOOK__` stub at `document_start` if React DevTools isn't already present. Each `onCommitFiberRoot` increments the counters of subscribed fibers and pushes a tick to the panel.

A Shadow DOM (`closed` mode) is used for the overlay, component panel, and Network Inspector panel so Peekly never collides with the host site's CSS.

## Project structure

```
src/
  background/service-worker.ts   # init storage + open-editor handler
  content/
    main.ts                      # ISOLATED world: events, overlay, panel orchestration
    panel.ts                     # component panel rendering (sections, drag, sub-handlers)
    net-panel.ts                 # Network Inspector panel UI
    net-styles.ts                # Network Inspector CSS (Shadow DOM)
    styles.ts                    # Shadow DOM CSS (component overlay)
  injected/
    bridge.ts                    # MAIN world: fiber walk, registry, commit hook, network capture init
  net/
    capture.ts                   # patches fetch + XHR in MAIN world; emits RequestEntry messages
    store.ts                     # isolated-world store for captured requests
    types.ts                     # RequestEntry and related types
    analysis/
      smart-labels.ts            # humanizes request paths
      graphql.ts                 # GraphQL detection and parsing
      jwt.ts                     # JWT / cookie extraction from headers
      typescript-gen.ts          # TypeScript interface generator from JSON response
      drift.ts                   # schema drift detection across repeated calls
      anomaly.ts                 # statistical anomaly flagging for response times
  popup/
    popup.html / popup.ts        # extension popup (3 toggles)
  shared/
    messages.ts                  # cross-world type contracts
public/
  icon.svg                       # icon source (regenerate PNGs with `bun run gen:icons`)
  icons/                         # 16/32/48/128 PNGs
scripts/
  gen-icons.ts                   # SVG → PNG using @resvg/resvg-js
```

## Scripts

```bash
bun run dev         # Vite dev server with HMR (isolated-world content script)
bun run build       # Production build → dist/
bun run typecheck   # tsc --noEmit
bun run gen:icons   # Regenerate PNGs from public/icon.svg
bun run zip         # Build + zip dist/ for distribution
```

## Limitations

- **Production / minified builds** — component names may be obfuscated (e.g. `t`, `Hf`). Peekly reads `displayName`, then `function.name`. If neither is present, the component shows as "Anonymous".
- **Source location** — relies on `_debugSource`, only set by the JSX dev transform. Works out of the box on Vite / Next.js dev servers.
- **iframes** — each frame is self-contained (its own overlay and panel). Cross-frame coordination is on the roadmap.
- **Children list** — shows immediate component children only, not the full tree.

## Privacy

Peekly does **not** transmit any data anywhere. Everything runs locally in your browser. See [PRIVACY.md](PRIVACY.md) for details.

## Roadmap

- Pin / save panel position across sessions
- Inspect history (last 5 components, breadcrumb)
- DOM / CSS-only mode for non-React sites (better than the default Chrome inspector)
- Keyboard navigation inside the panel (`↑` for parent, `↓` for first child)
- Cross-frame panel forwarding to the top frame
- Vue / Solid / Preact support

## Documentation

| | |
|---|---|
| [README.md](README.md) | This file. Overview, install, usage. |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to set up, code, and submit PRs. |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Technical deep-dive: two-world content scripts, message protocol, fiber walking, DevTools hook, Shadow DOM, tooltip lifecycle. |
| [RELEASING.md](RELEASING.md) | Cutting a release with `bun run release:*`. |
| [docs/CHROME_WEB_STORE.md](docs/CHROME_WEB_STORE.md) | Step-by-step guide to publishing on the Chrome Web Store, including listing copy and permission justifications. |
| [SECURITY.md](SECURITY.md) | Security policy, threat model, audit history, vulnerability reporting. |
| [PRIVACY.md](PRIVACY.md) | Privacy policy. TL;DR: no data leaves your browser. |
| [CHANGELOG.md](CHANGELOG.md) | Per-version user-facing changes. |

## Security

If you find a security issue, please don't open a public issue — see [SECURITY.md](SECURITY.md) for the disclosure procedure.

## Contributing

PRs welcome! See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).
