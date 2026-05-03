# Project state — 2026-05-03

A live snapshot of where Peekly is, what's saved, what's pending, and how to pick it back up. Read this first when resuming.

## Where the code lives

```
/Users/rso/Projects/peekly/
├── src/                      # The extension itself
│   ├── content/              # ISOLATED-world content script + UI
│   │   ├── net-panel.ts      # Network Inspector panel UI (new)
│   │   └── net-styles.ts     # Network Inspector CSS (new)
│   ├── injected/
│   │   ├── bridge.ts         # MAIN-world orchestrator (calls initNetworkCapture)
│   │   └── adapters/         # 8 framework adapters
│   ├── net/                  # Network capture + analysis (new)
│   │   ├── capture.ts        # fetch + XHR patching in MAIN world
│   │   ├── store.ts          # isolated-world request store
│   │   ├── types.ts          # RequestEntry type
│   │   └── analysis/         # smart-labels, graphql, jwt, typescript-gen, drift, anomaly
│   ├── popup/                # extension popup
│   ├── background/           # MV3 service worker
│   └── shared/               # cross-world types (messages.ts updated for net-request)
├── demo/                     # standalone Vite+React dashboard
│                             # for manual or automated screenshots
├── scripts/
│   ├── gen-icons.ts          # SVG → PNG (production icons)
│   ├── release.ts            # bump + changelog + commit + tag
│   └── screenshots.ts        # WIP — see "Known issues"
├── docs/
│   ├── ARCHITECTURE.md
│   ├── MULTI_FRAMEWORK_AUDIT.md
│   ├── CHROME_WEB_STORE.md
│   └── PROJECT_STATE.md      # ← this file
├── public/                   # icon source + generated PNGs
├── .github/workflows/        # CI + release
└── README, CHANGELOG, LICENSE, SECURITY, PRIVACY, CONTRIBUTING, RELEASING
```

## Git state

```
HEAD ──── (uncommitted changes — v0.4.0 work in progress)
      ├── docs: align README and docs with v0.3.0 sticky-tooltip behavior
      ├── chore(release): v0.3.0
      ├── feat(tooltip): keep contextual menu visible after key release
      ├── docs: add PROJECT_STATE.md — session snapshot of progress
      ├── feat: demo app for screenshots + WIP Playwright automation
      ├── docs: consolidate v0.2.0 changelog (multi-framework included)
      ├── feat(adapters): Twig (Symfony) and Alpine.js
      ├── feat(adapters): Lit / Web Components and Laravel Livewire
      ├── feat(adapters): Vue 3 and Preact
      ├── feat: framework-agnostic adapter architecture
      └── ...
```

**Uncommitted changes (v0.4.0 work):**
```
 M src/content/main.ts        # Y toggle for net panel, X-only picker, Esc closes all
 M src/content/styles.ts      # shared Shadow DOM CSS updates
 M src/content/tooltip.ts     # DOM tab copy groups + attributes table
 M src/injected/bridge.ts     # calls initNetworkCapture()
 M src/shared/messages.ts     # net-request message type
?? src/content/net-panel.ts   # Network Inspector panel UI
?? src/content/net-styles.ts  # Network Inspector CSS
?? src/net/                   # capture.ts, store.ts, types.ts, analysis/
```

Nothing has been pushed to `https://github.com/rosoam/peekly` since before v0.2.0. All commits from v0.2.0 onward are local only.

## v0.4.0 — what shipped (uncommitted)

In progress. Changes are staged in the working tree (see Git state above). Not yet committed or pushed.

### New since v0.3.0

- **Network Inspector** (`y` toggle) — floating draggable panel capturing every `fetch` and `XHR` call. Full details in `CHANGELOG.md` and `docs/ARCHITECTURE.md`.
- **Tooltip DOM tab improvements** — Copy HTML + Copy classes button group; per-attribute table with individual copy buttons.
- **Key binding change** — `x` held = component picker + tooltip (replaces `y`/`y+x`); `y` = Network Inspector toggle; `Esc` closes all overlays.

### Bundle sizes (current build — v0.4.0 working tree)

| Asset | Size | gzip |
|---|---|---|
| `main.ts` (ISOLATED world, includes net-panel) | 134.90 kB | 33.11 kB |
| Other assets | unchanged from v0.3.0 | – |

The jump from ~67 kB to ~135 kB in `main.ts` reflects the net-panel, net-styles, and analysis modules now bundled into the isolated-world entry point.

## v0.3.0 — what shipped

- **Sticky tooltip after key release** — releasing `y` (now `x`) pins the tooltip; only click-outside or `Esc` dismisses it.
- **Key bindings swapped to letter keys** — `y` + `x` (then simplified to `x`-only in v0.4.0).

## v0.2.0 — what shipped

- **Contextual tooltip** with 4 tabs: Comp, DOM (rich HTML + click-to-navigate children), CSS (computed + Tailwind variant breakdown), A11y (WCAG checks).
- **Hover-preview** on panel navigation chips — amber overlay around the target component before clicking.
- **Tighter targeting** — DOM rect for highlight (was full component bounds), shadow DOM piercing.
- **Multi-framework support** — 8 adapters: React → Preact → Vue 3 → Livewire → Lit → Alpine → Twig → Plain DOM.
- **Refined icon**, **security hardening**, **release automation**, **documentation set**.

## Multi-framework — what each adapter surfaces

| Adapter | Detection | Source | Notes |
|---|---|---|---|
| React | `__reactFiber$xxx` keys | `_debugSource` (Vite/Next dev) | live re-render counter via `__REACT_DEVTOOLS_GLOBAL_HOOK__`. Auto-installs DevTools hook stub if not present. |
| Preact | `__c` / `_component` on host | `__source` (preact-preset-vite dev) | for pure Preact (no `preact/compat`); React adapter handles compat-mode apps. |
| Vue 3 | `__vueParentComponent` | `type.__file` (vite-plugin-vue dev) | merges `props` + auto-unwrapped `setupState` (Composition) + `data` (Options). |
| Livewire (v3 + v2) | `wire:id` attribute | inferred from PHP class name (`App\Livewire\X` → `app/Livewire/X.php`) | parses `wire:snapshot` JSON (Livewire 3 `[value, metadata]` tuples normalized). |
| Lit / Web Components | tagName has `-` and is in `customElements` | none | reads `static properties` for Lit; HTML attrs for any custom element. Walks light DOM + shadow DOM. |
| Alpine.js (v2 + v3) | `x-data` / `_x_dataStack` / `__x` | none | scope name derived from `x-data` expression; merged stack as props. |
| Twig (Symfony) | `<!-- BEGIN templates/x.html.twig -->` debug comments | direct from comment | walks DOM siblings backward to find enclosing template; jump-to-template via "Open in editor". |
| Plain DOM | always (fallback) | none | HTML attrs as props, ancestor chain as ownerChain. |

**Detection is invisible**: the user never sees "framework: X". The panel and tooltip just render the right data for whatever they hover.

## Backlog (ordered)

1. **Stimulus adapter** (Hotwire / Rails / Symfony) — `data-controller` probe, surface controller name + actions + values. Estimated 2-4h.
2. **Vue 2 adapter** — `__vue__` on host elements, walk `$options` / parent. Lower priority (Vue 2 EOL but still install base). Estimated 4-6h.
3. **Cross-frame panel forwarding** — when an iframe shows the panel, forward to top frame so the panel doesn't appear nested.
4. **Pin / save panel position** across sessions.
5. **Inspect history breadcrumb** in the panel (last 5 inspections).
6. **Re-render counter for non-React adapters** (Vue's reactivity, Preact's hooks). Currently React-only.
7. **Outline mode reactivation** — was retired in v0.2.0 from the previous `Option+Shift` combo, needs to reappear as a popup toggle.
8. **Network Inspector HAR export** — export captured requests as a HAR 1.2 file for sharing or offline analysis.
9. **Persist Network Inspector entries across navigation** — currently in-memory only; cleared on page reload.

## Known issues / blockers

### v0.4.0 uncommitted

All Network Inspector work is in the working tree but not yet committed. Commit it before doing anything else.

### Screenshot automation script

`scripts/screenshots.ts` is committed but **not currently working end-to-end**. The demo app (`demo/`) is fully functional and ready for manual screenshotting. The blocker:

- Playwright's `launchPersistentContext` with `--load-extension` does not actually load MV3 extensions when driving Chrome (Chrome silently ignores the flag). Confirmed by:
  - `chrome://extensions/` reporting 0 extensions inside the Playwright context
  - Peekly's content-script host element never attaches
  - Confirmed even with `executablePath` pointing at system Google Chrome and after stripping default args via `ignoreDefaultArgs`
- Workaround attempted: launch Chrome ourselves with the right flags, attach Playwright via `connectOverCDP`. CDP `/json/version` resolves but `connectOverCDP` itself stalls (timed out at 30s).

**Manual screenshot workflow** while the automation isn't fixed:

```bash
# Terminal A
bun run demo:dev          # serves http://localhost:5173

# In Chrome, manually:
#   1. chrome://extensions/ → Load unpacked → select peekly/dist
#   2. Navigate to localhost:5173
#   3. Hold x (for component inspector), or press y (for Network Inspector),
#      interact, capture with Cmd+Shift+4 selecting a 1280×800 region.
```

Five screenshots needed for the Chrome Web Store listing, all 1280×800 PNG (specifications + suggested subjects in `docs/CHROME_WEB_STORE.md`).

### Push to GitHub

Nothing has been pushed to `https://github.com/rosoam/peekly` since before v0.2.0. Push is gated by a `push-guard` hook that requires manual invocation.

## How to pick this up later

```bash
cd /Users/rso/Projects/peekly

# 1. Commit the v0.4.0 working tree changes.
git add src/content/net-panel.ts src/content/net-styles.ts src/net/ \
        src/content/main.ts src/content/styles.ts src/content/tooltip.ts \
        src/injected/bridge.ts src/shared/messages.ts
git commit -m "feat(network-inspector): v0.4.0 — Network Inspector + X-only picker"

# 2. Sanity check.
git log --oneline | head -6

# 3. Build & run the demo.
bun install                  # in case of fresh clone
bun run gen:icons
bun run build
bun run demo:install
bun run demo:dev             # http://localhost:5173

# In Chrome:
#   chrome://extensions/ → Load unpacked → peekly/dist
#   Open localhost:5173
#   Hold x to inspect, press y for the Network Inspector.
```

## Useful commands

```bash
# Top-level peekly
bun run dev                  # Vite dev with HMR (isolated world)
bun run build                # production build → dist/
bun run typecheck            # tsc --noEmit
bun run gen:icons            # SVG → 4 PNGs
bun run zip                  # build + zip → peekly.zip
bun run release:patch|minor|major
bun run screenshots          # WIP, see Known issues

# Demo app
bun run demo:install
bun run demo:dev
bun run demo:build
```

## Documentation map (what to read for what)

| Doc | When to read |
|---|---|
| `README.md` | Public-facing overview, install, usage |
| `CHANGELOG.md` | Per-version user-facing changes |
| `docs/ARCHITECTURE.md` | How the two-world content scripts and message protocol work |
| `docs/MULTI_FRAMEWORK_AUDIT.md` | Framework support analysis, adapter design |
| `docs/CHROME_WEB_STORE.md` | Submission walkthrough with ready-to-paste copy |
| `docs/PROJECT_STATE.md` | This file — session-level snapshot of progress |
| `SECURITY.md` | Threat model, audit history, vulnerability disclosure |
| `PRIVACY.md` | Privacy policy (no data leaves the browser) |
| `CONTRIBUTING.md` | Dev setup, coding standards, manual test plan |
| `RELEASING.md` | Cutting a release, optional CWS auto-publish setup |
