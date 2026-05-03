# Project state — 2026-05-03 (updated)

A live snapshot of where Peekly is, what's saved, what's pending, and how to pick it back up. Read this first when resuming.

## Where the code lives

```
/Users/rso/Projects/peekly/
├── src/                      # The extension itself
│   ├── content/              # ISOLATED-world content script + UI
│   │   ├── main.ts           # keyboard handling (X = picker, Y = net panel, Esc)
│   │   ├── tooltip.ts        # contextual cursor tooltip (DOM tab, attributes table)
│   │   ├── styles.ts         # shared Shadow DOM CSS
│   │   ├── net-panel.ts      # Network Inspector panel UI
│   │   └── net-styles.ts     # Network Inspector CSS
│   ├── injected/
│   │   ├── bridge.ts         # MAIN-world orchestrator (calls initNetworkCapture)
│   │   └── adapters/         # 8 framework adapters
│   ├── net/                  # Network capture + analysis
│   │   ├── capture.ts        # fetch + XHR patching; getStackInfo() for call stack
│   │   ├── store.ts          # isolated-world request store + N+1/error/drift tracking
│   │   ├── types.ts          # RequestEntry, N1Hit, DriftEvent, AnomalyEvent, etc.
│   │   └── analysis/         # smart-labels, graphql, jwt, typescript-gen, drift, anomaly
│   ├── popup/                # extension popup
│   ├── background/           # MV3 service worker
│   └── shared/               # cross-world types (messages.ts)
├── demo/                     # standalone Vite+React dashboard for manual screenshots
├── scripts/
│   ├── gen-icons.ts          # SVG → PNG (production icons)
│   ├── release.ts            # bump + changelog + commit + tag
│   └── screenshots.ts        # WIP — see Known issues
├── docs/
│   ├── ARCHITECTURE.md
│   ├── MULTI_FRAMEWORK_AUDIT.md
│   ├── CHROME_WEB_STORE.md
│   └── PROJECT_STATE.md      # ← this file
└── README, CHANGELOG, LICENSE, SECURITY, PRIVACY, CONTRIBUTING, RELEASING
```

## Git state

```
HEAD (main, 4 commits ahead of origin/main)
  e2e9ef1  feat(n1-dialog): richer N+1 overlay with stats, severity, and Copy all
  7963591  feat: call stack in debug bundle + copy-all button; remove smart labels from Overview
  d87a044  feat: scroll isolation + call stack in network requests
  8c251be  feat(v0.4.0): Network Inspector + key binding refactor + tooltip improvements
  f233515  docs: align README and docs with v0.3.0 sticky-tooltip behavior   ← origin/main
```

Working tree is **clean**. All changes committed. Nothing unpushed except the 4 commits above.

## Key bindings (current)

| Key | Action |
|-----|--------|
| Hold `x`, hover | Component picker — indigo highlight + sticky contextual tooltip |
| `x` + click | Open full inspector panel (source, props, CSS, A11y, re-render counter) |
| `y` | Toggle Network Inspector panel |
| `Esc` | Close all overlays (tooltip, panel, network panel) |

Active only when not typing in a form field and no real modifier (Cmd/Ctrl/Alt) is held.

## What shipped since v0.3.0

### v0.4.0 (committed 2026-05-03)

- **Network Inspector** (`y` toggle) — floating draggable panel capturing every `fetch` and `XHR` call in real time. Request list, filter bar, detail tabs (Overview / Request / Response / TypeScript / GraphQL), copy buttons in every tab, footer badges (errors / slow / N+1 / drift / anomaly), request chart overlay (scatter plot + waterfall), Related Requests section.
- **Tooltip DOM tab improvements** — Copy HTML + Copy classes button group; attributes table with per-attribute copy.
- **Key binding simplification** — `x` alone does everything for the component picker; `y` is exclusively the Network Inspector toggle.

### Post-v0.4.0 (unreleased, committed)

- **Call stack capture** — `getStackInfo()` in `capture.ts` attaches up to 12 user-land call frames to every request (webpack internals filtered). Displayed in Overview tab with per-frame + copy-all buttons. Included in the per-request debug bundle.
- **Selected row highlight** — focused request in the list has a stronger indigo left border + background.
- **Scroll isolation** — tooltip body and Network Inspector panel trap scroll (`overscroll-behavior: contain` + `wheel stopPropagation`).
- **N+1 dialog overhaul** — stats row per pattern (avg/total duration, first/last seen); computed burst window; severity tiers (moderate/high/critical) with colour coding and actionable hints; **Copy all** button exporting a full N+1 debug bundle.
- **Removed smart labels** from the Overview tab (still shown in request list column).

## Backlog (ordered)

1. **Stimulus adapter** (Hotwire / Rails / Symfony) — `data-controller` probe, surface controller name + actions + values. Estimated 2–4h.
2. **Vue 2 adapter** — `__vue__` on host elements, walk `$options` / parent. Lower priority (Vue 2 EOL). Estimated 4–6h.
3. **Network Inspector HAR export** — export captured requests as HAR 1.2.
4. **Persist Network Inspector entries** across navigation (in-memory only, cleared on page reload).
5. **Cross-frame panel forwarding** — when an iframe triggers the panel, forward to top frame.
6. **Pin / save panel position** across sessions.
7. **Inspect history breadcrumb** in the panel (last 5 inspections).
8. **Re-render counter for non-React adapters** (Vue reactivity, Preact hooks). Currently React-only.
9. **Outline mode reactivation** — retired in v0.2.0, needs to reappear as a popup toggle.

## Known issues / blockers

### Screenshot automation script

`scripts/screenshots.ts` is committed but **not working end-to-end**. The demo app (`demo/`) is fully functional for manual screenshots. The blocker:

- Playwright's `launchPersistentContext` with `--load-extension` does not load MV3 extensions when driving Chrome (Chrome silently ignores the flag).
- Workaround attempted: launch Chrome ourselves with the right flags, attach via `connectOverCDP` — stalls at 30s.

**Manual screenshot workflow:**
```bash
bun run demo:dev    # serves http://localhost:5173
# In Chrome: chrome://extensions/ → Load unpacked → peekly/dist
# Navigate to localhost:5173
# Hold x to inspect, press y for Network Inspector, capture with Cmd+Shift+4
```

Five screenshots needed (1280×800 PNG) — see `docs/CHROME_WEB_STORE.md` for subjects.

### Push to GitHub

4 commits ahead of `origin/main`. Push is gated by a `push-guard` hook requiring manual invocation.

## How to pick this up

```bash
cd /Users/rso/Projects/peekly

# Sanity check
git log --oneline | head -8
bun run typecheck

# Build and load
bun run build
# In Chrome: chrome://extensions/ → Load unpacked → peekly/dist

# Demo
bun run demo:dev    # http://localhost:5173
```

## Useful commands

```bash
bun run dev                  # Vite dev with HMR
bun run build                # production build → dist/
bun run typecheck            # tsc --noEmit
bun run gen:icons            # SVG → 4 PNGs
bun run zip                  # build + zip → peekly.zip
bun run release:patch|minor|major

bun run demo:install
bun run demo:dev
```

## Documentation map

| Doc | When to read |
|-----|--------------|
| `README.md` | Public-facing overview, install, usage |
| `CHANGELOG.md` | Per-version user-facing changes |
| `docs/ARCHITECTURE.md` | Two-world content script design, message protocol |
| `docs/MULTI_FRAMEWORK_AUDIT.md` | Framework support analysis, adapter design |
| `docs/CHROME_WEB_STORE.md` | Submission walkthrough with ready-to-paste copy |
| `docs/PROJECT_STATE.md` | This file — session-level snapshot |
| `SECURITY.md` | Threat model, audit history, vulnerability disclosure |
| `PRIVACY.md` | Privacy policy (no data leaves the browser) |
| `CONTRIBUTING.md` | Dev setup, coding standards, manual test plan |
| `RELEASING.md` | Cutting a release, optional CWS auto-publish setup |
