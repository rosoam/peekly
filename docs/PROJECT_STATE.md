# Project state — 2026-05-06 (v0.4.0 released)

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
│   ├── SPRINT_LOG.md
│   └── PROJECT_STATE.md      # ← this file
└── README, CHANGELOG, LICENSE, SECURITY, PRIVACY, CONTRIBUTING, RELEASING
```

## Git state

```
HEAD (main = origin/main) — working tree clean
  4a10943  chore(release): v0.4.0          ← tag v0.4.0, origin/main
  a3f12bc  feat: Network Inspector v1, multi-framework improvements, box-model UX fixes
  ...
```

Working tree is **clean**. main and origin/main are in sync. Tag `v0.4.0` pushed.

## Release status

| Version | Date | GitHub Release | Chrome Web Store |
|---------|------|---------------|-----------------|
| v0.4.0 | 2026-05-06 | ✅ créé par CI | ⏳ en attente review CWS |
| v0.3.0 | 2026-05-01 | ✅ | ✅ publique |

**CWS auto-publish pipeline** : opérationnel depuis v0.4.0. Les 4 secrets sont configurés dans GitHub Actions (environment secrets → `CWS_EXTENSION_ID`). Le workflow `release.yml` déclenchera la publication automatique à chaque tag `v*`.

## Key bindings (current)

| Key | Action |
|-----|--------|
| Hold `x`, hover | Component picker — indigo highlight + sticky contextual tooltip |
| `x` + click | Open full inspector panel (source, props, CSS, A11y, re-render counter) |
| Right-click (hold `x`) | Toggle tooltip dismiss — cache le tooltip pour inspecter le box-model |
| `y` | Toggle Network Inspector panel |
| `Esc` | Close all overlays (tooltip, panel, network panel) |

Active only when not typing in a form field and no real modifier (Cmd/Ctrl/Alt) is held.

## What shipped in v0.4.0 (2026-05-06)

- **Network Inspector** (`y` toggle) — floating draggable panel capturing every `fetch` and `XHR` call in real time. Request list, filter bar, detail tabs (Overview / Request / Response / TypeScript / GraphQL), copy buttons in every tab, footer badges (errors / slow / N+1 / drift / anomaly), request chart overlay (scatter plot + waterfall), Related Requests section.
- **Tooltip DOM tab improvements** — Copy HTML + Copy classes button group; attributes table with per-attribute copy.
- **Key binding simplification** — `x` alone does everything for the component picker; `y` is exclusively the Network Inspector toggle.
- **Call stack capture** — up to 12 user-land frames per request (internals filtered). Displayed in Overview tab with per-frame + copy-all buttons.
- **N+1 dialog overhaul** — stats row per pattern (avg/total duration, first/last seen); computed burst window; severity tiers (moderate/high/critical); **Copy all** button.
- **Scroll isolation** — tooltip body and Network Inspector panel trap scroll.
- **Right-click dismiss** — right-click pendant hold-`x` toggle le tooltip off pour voir le box-model overlay sans obstruction. State persiste entre keyup/keydown.
- **Box-model overlay labels** — les labels px dans les zones padding/margin ont maintenant un badge fond sombre — lisibles sur toute couleur d'élément.
- **Removed smart labels** from Overview tab (still in request list column).

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

`scripts/screenshots.ts` est committé mais **non fonctionnel** end-to-end. Le demo app (`demo/`) est pleinement fonctionnel pour les screenshots manuels. Le blocker :

- Playwright's `launchPersistentContext` avec `--load-extension` ne charge pas les extensions MV3 (Chrome ignore silencieusement le flag).

**Manual screenshot workflow:**
```bash
bun run demo:dev    # serves http://localhost:5173
# In Chrome: chrome://extensions/ → Load unpacked → peekly/dist
# Navigate to localhost:5173
# Hold x to inspect, press y for Network Inspector, capture with Cmd+Shift+4
```

Cinq screenshots nécessaires (1280×800 PNG) — voir `docs/CHROME_WEB_STORE.md`.

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

## Release workflow

```bash
# 1. Committer tous les changements
git add -A && git commit -m "feat: ..."

# 2. Lancer le script (clean tree requis)
bun run release:patch   # x.y.Z
bun run release:minor   # x.Y.0
bun run release:major   # X.0.0

# 3. Pusher (manuellement — push-guard hook)
git push origin main
git push origin vX.Y.Z   # déclenche GitHub Actions → CWS auto-publish

# 4. Surveiller CI
gh run watch
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
| `docs/SPRINT_LOG.md` | Logs de tâches non analysées (via /log-peekly) |
| `SECURITY.md` | Threat model, audit history, vulnerability disclosure |
| `PRIVACY.md` | Privacy policy (no data leaves the browser) |
| `CONTRIBUTING.md` | Dev setup, coding standards, manual test plan |
| `RELEASING.md` | Cutting a release, CWS auto-publish setup |
