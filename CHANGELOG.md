# Changelog

All notable changes to Peekly will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-04-30

### Added

- **Multi-framework support** — Peekly is no longer React-only. Eight framework adapters dispatch invisibly:
  - **React** — fiber walking, props, source via `_debugSource`, live re-render counter
  - **Preact** (without `preact/compat`) — detection via `__c` / `_component` on host elements, vnode-based walking, source via `__source`
  - **Vue 3** — detection via `__vueParentComponent`; surfaces component name (`__name`/`name`), source file (`__file` from `@vitejs/plugin-vue` dev), props plus auto-unwrapped Composition API setup state and Options API data, parent chain, child components
  - **Lit / Web Components** — detects any custom element (`tagName.includes('-')` and `customElements.get(tag)`); enriches with Lit-declared `static properties` when the element extends `LitElement`. Walks both light DOM and shadow DOM children.
  - **Laravel Livewire** (v3 + v2) — detects `wire:id` wrappers, parses `wire:snapshot` JSON to surface the Livewire component class name, public properties (with v3's `[value, metadata]` tuples normalised), `$listeners`, and `$path`. Source path inferred from the PHP class name (`App\Livewire\UserProfile` → `app/Livewire/UserProfile.php`).
  - **Alpine.js** (v2 + v3) — detects `x-data` attribute or `_x_dataStack` / `__x` runtime refs. Surfaces a friendly scope name derived from the `x-data` expression (`x-data="dropdown()"` → `dropdown`), the merged reactive data scope as props, and the list of `x-*` / `:` / `@` directives.
  - **Twig** (Symfony with `twig.debug: true`) — parses `<!-- BEGIN templates/x.html.twig -->` debug comments to attribute server-rendered HTML to its source template. The "Open in editor" button jumps directly to the template file. Nested templates produce a meaningful "Rendered by" chain. No PHP-side cooperation required — just enable Twig debug.
  - **Plain DOM fallback** — works on *any* HTML page even without a framework. Surfaces tag name, HTML attributes as "props", ancestor chain, parent/children DOM elements. Designed so Peekly is useful on WordPress, vanilla PHP, plain HTML, anything else.

  Detection is **invisible**: the user never sees "framework: X". The panel and tooltip just show the right data for whatever they hover. The adapter chain tries each framework in priority order (React → Preact → Vue 3 → Livewire → Lit → Alpine → Twig → Plain DOM) and uses the first one that recognizes the element.

- **Contextual tooltip** — hold `Option + Shift` and hover any element to get a near-cursor floating tooltip with tabs:
  - **Comp** — component name, kind, source path (clickable to open in editor), parent name, children count, prop names
  - **DOM** — full rich HTML view: opening tag formatted line-by-line with selectable, horizontally scrollable attribute values; parent up-button; children list with click-to-navigate (drill into child elements without leaving the tooltip); amber preview overlay on hover; "Copy" button for `outerHTML`; text content preview for leaves
  - **CSS** — display, position, size, z-index, background (resolved hex), color, font, plus full Tailwind / UnoCSS class breakdown grouped by variant
  - **A11y** — quick warnings (missing alt, accessible name, label, contrast) with red badge

  The tooltip stays in place when the cursor moves into it (interactive). Releasing `Shift` while still holding `Option` pins the tooltip — click outside or `Esc` to dismiss. Smart positioning: it flips to the other side of the cursor near viewport edges.

- **Hover-preview on navigation chips.** Hovering a parent button or a child chip in the panel paints an amber dashed highlight around that component's actual position on the page — preview before navigating.

- **Quick analysis with `Option` only** is unchanged: still highlights the component with a label.

- New documentation:
  - [`docs/MULTI_FRAMEWORK_AUDIT.md`](docs/MULTI_FRAMEWORK_AUDIT.md) — feasibility analysis, framework prioritization (Vue 3 / Preact / Lit / Livewire / Stimulus / Vue 2 / Angular), adapter architecture proposal, dedicated PHP / Laravel / Symfony / Twig / Livewire section
  - [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — technical deep-dive
  - [`docs/CHROME_WEB_STORE.md`](docs/CHROME_WEB_STORE.md) — submission guide
  - [`SECURITY.md`](SECURITY.md) — disclosure policy + threat model + audit history
  - [`RELEASING.md`](RELEASING.md) — automated release flow

### Changed

- **Tighter hover targeting.** The highlight now follows the precise DOM element under the cursor instead of the component's full bounding box, which previously made small text spans inside large components feel imprecise. The component name still shows in the label as `Component · <tag>`.
- **Shadow DOM piercing.** `elementFromPoint` now drills into open shadow roots (web components) to target the actual element rather than the shadow host.
- **Selectable, scrollable values everywhere.** Removed the 2-line clamp / ellipsis on prop values. Long values stay on a single line with horizontal scroll (custom thin scrollbar) and `user-select: text` for precise text selection. Same treatment for computed styles, Tailwind class lists, and source paths.
- Custom thin scrollbars throughout the panel for a more native dev-tool feel.
- Navigation chip / parent row hover states use amber to visually link with the in-page preview overlay.
- The MAIN-world bridge (`src/injected/bridge.ts`) is now a thin orchestrator over pluggable `FrameworkAdapter` modules under `src/injected/adapters/`. Each adapter exports a single object implementing `recognizes` / `inspect` / `preview` / `resolveById` / `componentRect` / `findInstancesOfSameType` / `subscribeRenders` (optional).
- Refined icon — partial arc (300°) with rounded caps, inner viewfinder detail, subtle radial background gradient. Same lime + dark palette, more depth and identity.

### Removed

- The `Option + Shift` outline mode trigger has been retired in favor of the contextual tooltip. Outline mode will return as a popup toggle in a later release.

### Security

- **Hardened DOM rendering.** Replaced all `innerHTML` insertions of dynamic data (component names, DOM tags, accessibility warnings) in the contextual tooltip with `createElement` + `textContent`, so a malicious site cannot inject markup or scripts via crafted React `displayName` or DOM attributes.
- **Restricted "Open in editor" to known editor protocols.** The service worker now rejects any URL whose protocol is not in a small whitelist (`vscode:`, `vscode-insiders:`, `cursor:`, `webstorm:`, `idea:`, `pycharm:`, `subl:`). Defense-in-depth so that a crafted message can't be turned into an arbitrary tab navigation.

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
[0.2.0]: https://github.com/rosoam/peekly/releases/tag/v0.2.0
