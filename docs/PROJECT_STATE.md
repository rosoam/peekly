# Project state — 2026-04-30

A live snapshot of where Peekly is, what's saved, what's pending, and how to pick it back up. Read this first when resuming.

## Where the code lives

```
/Users/rso/Projects/peekly/
├── src/                      # The extension itself
│   ├── content/              # ISOLATED-world content script + UI
│   ├── injected/
│   │   ├── bridge.ts         # MAIN-world orchestrator
│   │   └── adapters/         # 8 framework adapters
│   ├── popup/                # extension popup
│   ├── background/           # MV3 service worker
│   └── shared/               # cross-world types
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

## Git state (everything saved)

```
HEAD ──── feat: demo app + WIP screenshot automation
      ├── docs: consolidate v0.2.0 changelog
      ├── feat(adapters): Twig (Symfony) and Alpine.js              ← Phase 4
      ├── feat(adapters): Lit / Web Components and Laravel Livewire ← Phase 3
      ├── feat(adapters): Vue 3 and Preact                          ← Phase 2
      ├── feat: framework-agnostic adapter architecture             ← Phase 1
      ├── design: refined icon                       ← TAG v0.2.0 currently here
      ├── docs: SECURITY / ARCHITECTURE / CHROME_WEB_STORE
      ├── chore(release): v0.2.0
      ├── fix(security): tooltip XSS + URL whitelist
      ├── chore: add release automation
      ├── feat: panel UX
      ├── fix: tighter hover targeting
      ├── feat: contextual tooltip
      └── feat: initial Peekly release (v0.1.0)                     ← origin/main
```

**14 commits + 1 tag locally; nothing pushed yet.** The repo at `https://github.com/rosoam/peekly` is still at `dfb2104` (v0.1.0). Everything since lives only in the local main branch.

The `v0.2.0` tag has been moved twice through the session and is currently at the icon-design commit (`c1d8164`), one commit before Phase 1. The user's intent is for **v0.2.0 to include everything through Phase 4**. The tag still needs to be moved to HEAD before publishing.

## v0.2.0 — what shipped

Versioned in `package.json`, `vite.config.ts` manifest, and `CHANGELOG.md`. Once pushed, this becomes the publicly available release.

### New since v0.1.0

- **Contextual tooltip** (Option+Shift hover) with 4 tabs: Comp, DOM (rich HTML rendering with click-to-navigate children), CSS (computed + Tailwind variant breakdown), A11y (WCAG checks).
- **Hover-preview** on panel navigation chips — paints amber overlay around the target component before clicking.
- **Tighter targeting** — DOM rect for highlight (was full component bounds), shadow DOM piercing, label format `Component · <tag>`.
- **Selectable + scrollable values** everywhere in the panel (props / computed / Tailwind / source paths).
- **Multi-framework support** — 8 adapters with invisible detection:
  React → Preact → Vue 3 → Livewire → Lit → Alpine → Twig → Plain DOM.
  See `docs/MULTI_FRAMEWORK_AUDIT.md` for the framework analysis.
- **Refined icon** — partial arc + viewfinder, lime on dark, Raycast vibe.
- **Security hardening** — replaced `innerHTML` with `createElement+textContent` for any dynamic data; whitelisted editor URL protocols in the service worker.
- **Release automation** — `bun run release:patch | minor | major` script.
- **Documentation set** — SECURITY, PRIVACY, ARCHITECTURE, CHROME_WEB_STORE, CONTRIBUTING, RELEASING, MULTI_FRAMEWORK_AUDIT.

### Bundle sizes (current build)

| Asset | Size | gzip |
|---|---|---|
| `bridge.ts` (MAIN world) | 39.15 kB | 8.89 kB |
| `main.ts` (ISOLATED world) | 67.17 kB | 15.90 kB |
| `manifest.json` | 1.44 kB | 0.59 kB |
| `popup.html` | 3.95 kB | 1.27 kB |
| Icons (16/32/48/128 PNG) | ~13 kB total | – |
| **Total zipped extension** | ~115 kB | – |

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
7. **Outline mode reactivation** — was retired in v0.2.0 from `Option+Shift`, needs to reappear as a popup toggle.

## Known issues / blockers

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
#   3. Hold ⌥ Option (+ optionally Shift), interact, capture with
#      Cmd+Shift+4 selecting a 1280×800 region.
```

Five screenshots needed for the Chrome Web Store listing, all 1280×800 PNG (specifications + suggested subjects in `docs/CHROME_WEB_STORE.md`).

### Push to GitHub

`git push origin main && git push origin v0.2.0` is gated by a `push-guard` hook that requires manual user invocation. Nothing has been pushed since v0.1.0.

### v0.2.0 tag location

The tag is currently at `c1d8164` (icon refinement) but the intended `v0.2.0` content includes everything through Phase 4. **Before publishing**, run:

```bash
git tag -d v0.2.0
git tag v0.2.0      # at current HEAD
git push origin main
git push origin v0.2.0
```

## How to pick this up later

```bash
cd /Users/rso/Projects/peekly

# Sanity check — should print Phase 4 commit messages.
git log --oneline | head -6

# Build & run the demo.
bun install                  # in case of fresh clone
bun run gen:icons
bun run build
bun run demo:install
bun run demo:dev             # http://localhost:5173

# In Chrome:
#   chrome://extensions/ → Load unpacked → peekly/dist
#   Open localhost:5173
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
