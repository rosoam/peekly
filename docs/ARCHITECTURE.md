# Architecture

A technical deep-dive into how Peekly works under the hood.

This document is for contributors and curious readers. Users only need [README.md](../README.md).

## High-level diagram

```
                          ┌──────────────────────────────────────────┐
                          │           Browser Tab                    │
                          │                                          │
                          │  ┌──────────────────────────────────┐    │
                          │  │         MAIN world (page JS)     │    │
                          │  │                                  │    │
                          │  │   React app                      │    │
                          │  │   __REACT_DEVTOOLS_GLOBAL_HOOK__ │    │
   ┌──────────────────┐   │  │   ┌──────────────────────┐       │    │
   │ Service worker   │   │  │   │  bridge.ts           │       │    │
   │ service-worker.ts│◄──┼──┼───┤  • fiber walking     │       │    │
   │                  │   │  │   │  • commit hook       │       │    │
   │ • open-editor    │   │  │   │  • fiber registry    │       │    │
   │ • settings init  │   │  │   └──────────┬───────────┘       │    │
   └──────────────────┘   │  │              │ window.postMessage│    │
            ▲             │  │              ▼                   │    │
            │             │  │   ┌──────────────────────┐       │    │
            │ chrome.runtime  │  │  ISOLATED world      │       │    │
            │ .sendMessage    │  │                      │       │    │
            └─────────────────┼──┤  main.ts             │       │    │
                          │  │  │  • events / mouse    │       │    │
                          │  │  │  • Shadow DOM overlay│       │    │
                          │  │  │  • panel.ts          │       │    │
                          │  │  │  • tooltip.ts        │       │    │
                          │  │  └──────────┬───────────┘       │    │
                          │  │             │                   │    │
                          │  │             ▼                   │    │
                          │  │      [Shadow DOM]               │    │
                          │  │      • highlight overlay        │    │
                          │  │      • tooltip                  │    │
                          │  │      • full panel               │    │
                          │  └─────────────────────────────────┘    │
                          └──────────────────────────────────────────┘
```

## The two-world model

Chrome MV3 lets a content script run in one of two JavaScript worlds:

- **ISOLATED** (default): a sandboxed JS context that shares the DOM with the page but has its own `window` and JS heap. Content scripts here have access to the `chrome.*` extension APIs but can't read or call any of the page's JS objects.
- **MAIN**: the same JS context as the page itself. Has access to page globals (e.g. `window.__REACT_DEVTOOLS_GLOBAL_HOOK__`, the `__reactFiber$xxx` keys on DOM nodes that React adds) but **no `chrome.*` API access**.

Peekly needs both:

- The MAIN world to walk React's internal fiber tree, install the DevTools commit hook, and serialize props.
- The ISOLATED world to render UI (Shadow DOM overlay), call `chrome.storage.*`, and message the service worker.

These two scripts communicate via `window.postMessage`. They both validate every incoming message:

```ts
if (event.source !== window) return;        // must come from this window
const data = event.data;
if (!data || data.source !== 'react-picker') return;  // namespace gate
```

The page can technically forge messages with our namespace, but the worst it can do is receive duplicate inspect-responses (which it could already get from `__REACT_DEVTOOLS_GLOBAL_HOOK__` directly). No privileged action is gated by an unauthenticated postMessage.

## Message protocol

All messages live in `src/shared/messages.ts`. They are typed and namespaced. The protocol is request/response with a `requestId`:

| Direction | Kind | Purpose |
|---|---|---|
| isolated → main | `inspect-request` | Inspect element tagged with `data-rp-target="<id>"` |
| isolated → main | `inspect-by-id-request` | Inspect a fiber by its registered id (used by parent/child navigation) |
| main → isolated | `inspect-response` | Full `ComponentInfo` payload |
| isolated → main | `hover-request` | Lightweight preview for the tooltip / hover label |
| main → isolated | `hover-response` | `ComponentPreview` payload |
| isolated → main | `subscribe-renders` | Start counting commits for a fiber |
| isolated → main | `unsubscribe-renders` | Stop counting |
| main → isolated | `render-tick` | New commit count for a subscribed fiber |
| isolated → main | `find-instances-request` | Find every instance of a component type on the page |
| main → isolated | `find-instances-response` | Array of bounding rects |
| isolated → main | `find-fiber-rect-request` | Single fiber's rect, used by chip-hover preview |
| main → isolated | `find-fiber-rect-response` | One rect or null |
| main → isolated | `react-detected` | One-shot at script load + on a delayed retry |

Plus one `chrome.runtime.sendMessage` channel between the isolated world and the service worker:

| Kind | Purpose |
|---|---|
| `open-editor` | Open `vscode://file/...` (or other whitelisted protocol) URL |

## Fiber walking

React stores its fiber on every DOM node it controls under a key like `__reactFiber$xxx` (the suffix is randomized per React build). The bridge:

1. Reads `el.<key>` for any key matching `__reactFiber$` or the legacy `__reactInternalInstance$`.
2. Walks `fiber.return` upward until it hits a fiber whose `tag` indicates a component (FunctionComponent=0, ClassComponent=1, ForwardRef=11, Memo=14, SimpleMemo=15).
3. From there:
   - **Name** comes from `fiber.type.displayName`, then `fiber.type.name`, then a literal `'Anonymous'` for fully minified production builds.
   - **Source location** comes from `fiber._debugSource` — set by React's JSX dev transform. Absent in prod.
   - **Props** come from `fiber.memoizedProps`, run through `serialize()` which prevents circular refs, truncates long strings, and detects inline (anonymous-name) functions.
   - **Children components** are gathered by walking `fiber.child` / `fiber.sibling` until we hit each immediate component fiber (skipping intermediate host wrappers).
   - **Owner chain** uses `fiber._debugOwner` (preferred) or `fiber.return` as fallback.
   - **Bounding rect** is the `getBoundingClientRect()` of the element under the cursor (precise) — *not* the union of host descendants. The component identity is in the label; the rect mirrors what the user is pointing at.

### Why the rect comes from the DOM element, not the fiber

Earlier iterations used `fiberBoundingRect()` which unions every host descendant of the component. That made hovering a small text span inside a large `<HeaderSection>` highlight the entire header. Since v0.2.0 we use the DOM rect for the live hover highlight and reserve the union rect for the "highlight all instances" feature, where it's actually what you want.

## DevTools commit hook

To count re-renders live, we hook into `__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot`. React calls this function on every commit if the hook is present. Two cases:

1. **React DevTools is installed.** The hook already exists. We wrap it: save the original, replace with our function, call the original at the end. No conflict.
2. **React DevTools is *not* installed.** We install a minimal stub at `document_start` (before React loads), with no-op `onCommit*` functions and a working `inject(renderer)`. React then calls our stub on every commit, and we count.

Each commit, we walk the root fiber, count fibers whose `type === trackedType`, and emit a `render-tick` message if the count for that subscription changed. The panel updates the live counter.

## Shadow DOM isolation

The overlay (highlight, label, tooltip, panel) lives inside a `<div id="react-picker-host">` attached to `document.documentElement`, with a closed shadow root. This means:

- Site CSS cannot affect our UI (Shadow DOM is one of the few real CSS isolation primitives).
- Our CSS cannot affect the site.
- Site JS in the page (MAIN world) cannot read our shadow DOM contents because we use `mode: 'closed'` (it's also worth nothing that page JS doesn't see content-script DOM additions in their isolated tree).

The host element has `pointer-events: none` so mouse events fall through to the page. Inside, individual interactive surfaces (`.panel`, `.tooltip`) override with `pointer-events: auto`.

`elementFromPoint` is briefly forced to ignore the host (`host.style.pointerEvents = 'none'`) when we sample what's under the cursor, even though it's already none — this is a defensive double-check.

## Element targeting

`document.elementFromPoint(x, y)` returns the topmost real element. To handle web components correctly, we drill through open shadow roots:

```ts
let el = document.elementFromPoint(x, y);
let depth = 0;
while (el && el.shadowRoot && depth < 16) {
  const inner = el.shadowRoot.elementFromPoint?.(x, y);
  if (!inner || inner === el) break;
  el = inner;
  depth += 1;
}
```

Closed shadow roots are not penetrable from outside — that's a fundamental browser invariant we honor.

## Tooltip lifecycle (Option + Shift)

The tooltip is a small floating debugger that appears next to the cursor. Its state machine:

```
              ┌──────────┐
              │  hidden  │
              └────┬─────┘
                   │ Alt + Shift + mousemove on page
                   ▼
              ┌──────────┐
              │ tracking │ ◄──┐
              └────┬─────┘    │ cursor leaves tooltip back into page
                   │           │
                   │ cursor enters tooltip       │
                   ▼           │
              ┌──────────┐ ────┘
              │frozen    │
              │(in-tooltip)│
              └────┬─────┘
                   │ Shift released (Alt still down)
                   ▼
              ┌──────────┐
              │  pinned  │ ◄── interactive, click to use tabs
              └────┬─────┘
                   │ click outside / Esc
                   ▼
              ┌──────────┐
              │  hidden  │
              └──────────┘
```

The tooltip never repositions while the cursor is inside it (the `mousemove` early-returns via `isInsideHost`). This makes the tabs clickable without the tooltip running away from the cursor.

Position is set via `transform: translate3d(...)` for hardware-accelerated movement, with a flip if near the right or bottom viewport edges.

## Full panel (Option + click)

The panel is more elaborate:

- **Drag**: `mousedown` on the header is a drag start; `mousemove` translates the panel via `left/top` (CSS); position is preserved across re-renders for the session.
- **Sections** are constructed once at render time. Live data (re-render counter) updates via the `PanelHandle` returned by `renderPanel`.
- **Chip hover** triggers a `find-fiber-rect-request` and paints an amber dashed overlay around the target component's actual location on the page (a different layer from the cursor highlight).
- **Source card**, **Props**, **Computed**, **Tailwind / classes**, **A11y**, **Hints**, **Owner chain** — each is a self-contained section. Sections that produce no content for the current target are omitted entirely.
- **`Copy all`** generates a paste-friendly text summary including prop values, children names, and owner chain with sources.

## Render counter — registry caveat

The bridge maintains a `Map<string, WeakRef<Fiber>>` for fibers exposed by id (parent / children navigation, render subscription, find-fiber-rect). The map is capped at 200 entries (FIFO eviction) to bound memory. Because we use `WeakRef`, fibers from unmounted components become unreachable naturally and `lookupFiber` returns null — at which point the panel surfaces "Component no longer exists".

## Settings persistence

`chrome.storage.local` under the key `rp-settings` (a single JSON object), versioned by shape:

```ts
{
  enabled: boolean;          // global active toggle
  autoOnLocalhost: boolean;  // auto-on for localhost / 127.0.0.1 / *.localhost
  editor: 'vscode' | 'cursor' | 'webstorm' | 'sublime' | 'none';
}
```

`onInstalled` backfills missing keys with `DEFAULT_SETTINGS` so adding new fields in future versions doesn't break existing installs. `onChanged` listeners in the content script and popup keep the two surfaces in sync.

## Build pipeline

- **Vite** + **`@crxjs/vite-plugin`** generates the MV3 manifest, hashes assets, wraps content scripts in loaders.
- **TypeScript strict** with `verbatimModuleSyntax` and `isolatedModules` (every file is a module; no implicit globals).
- **`@resvg/resvg-js`** renders `public/icon.svg` to the four required PNG sizes via `bun run gen:icons`.
- **GitHub Actions** runs typecheck + build on every push to main and PR (`ci.yml`); on `vX.Y.Z` tags it additionally zips the `dist/` and creates a GitHub Release (`release.yml`).
