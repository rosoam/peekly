# Contributing to Peekly

Thanks for considering a contribution! This document covers everything you need to know.

## Quick start

```bash
git clone https://github.com/rosoam/peekly.git
cd peekly
bun install
bun run gen:icons     # generate PNG icons from public/icon.svg
bun run dev           # Vite dev server with HMR
```

To load the extension in Chrome while developing:

1. `bun run build` (or use the `dev` server output)
2. `chrome://extensions/` → enable **Developer mode**
3. **Load unpacked** → select `dist/`
4. After making changes that the dev server can't hot-replace (e.g. the MAIN-world `bridge.ts`, the `manifest`), click the reload icon on Peekly's card in `chrome://extensions/` and refresh the page you're testing on.

## Project layout

See the `Project structure` section in [README.md](README.md).

## Tooling

- **TypeScript** strict mode (no `any`, `verbatimModuleSyntax`, `isolatedModules`)
- **Vite** + `@crxjs/vite-plugin` for the MV3 build
- **Bun** as the package manager and script runner
- **Manifest V3** — content scripts in ISOLATED + MAIN worlds, service worker for background

## Where things live

- `src/content/main.ts` — runs in the **isolated world**. Owns the keyboard / mouse listeners, the highlight overlay, and orchestrates the panel. Has access to `chrome.*` APIs but **not** to the page's JavaScript globals.
- `src/injected/bridge.ts` — runs in the **main world** (page context). Has access to the page's `window` and React's internal objects (`__reactFiber$*` keys on DOM nodes, `__REACT_DEVTOOLS_GLOBAL_HOOK__`). **Does not** have access to `chrome.*`.
- `src/content/panel.ts` — pure DOM rendering of the inspector panel; runs in the isolated world.
- `src/shared/messages.ts` — the message contract between the two worlds.

The two worlds talk via `window.postMessage` with a `source: 'react-picker'` namespace tag. (We kept the internal namespace short for legacy reasons; the user-facing brand is Peekly.)

## Coding standards

- **TypeScript strict, no `any`.** Use `unknown` and narrow.
- **No `console.log`** in committed code (the build will warn).
- **No mutation** of inputs; return new objects.
- **Small files.** Aim for < 400 lines per file.
- **Comments only when the why is non-obvious.** Names should carry the intent.
- Run `bun run typecheck` before pushing.

## Pull requests

1. Fork the repo and create a feature branch.
2. Keep PRs focused. One PR = one concern. Refactors and behavior changes go in separate PRs when possible.
3. Update [CHANGELOG.md](CHANGELOG.md) under the `[Unreleased]` section if you change observable behavior.
4. Add a clear description: what changed, why, and how to test it manually.
5. Make sure CI passes (`bun run typecheck` + `bun run build`).

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add Tailwind variant breakdown
fix: hover stops updating after Alt was released and re-pressed
refactor: extract panel section builders into separate functions
docs: clarify auto-on-localhost behavior
chore: bump @crxjs/vite-plugin to 2.4.1
```

## Manual test plan for any UI change

Before requesting review:

- [ ] `bun run typecheck` passes
- [ ] `bun run build` produces `dist/`
- [ ] On `localhost:*` (e.g. a Vite React app):
  - Hold `Option` → border appears on hovered React component
  - `Option + click` → panel opens with source, props, navigation
  - "Open in" button opens the file at the right line
  - Drag the panel header → it moves
  - Click the component name → text is selected
  - Copy icon next to name → name is in clipboard
  - "Copy all" → readable summary in clipboard
  - "Highlight all instances" icon → multiple dashed boxes appear
  - `Option + Shift` + move → outline mode
  - `Esc` → panel closes
- [ ] On a non-localhost site, with **Active** off → no highlight, no panel
- [ ] On a non-localhost site, with **Active** on → picker works

## Reporting bugs

Please use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.yml) and include:

- Browser version
- Site URL where the bug occurred (or "internal app, can't share")
- Whether the site is dev or production
- Steps to reproduce
- Screenshot of the panel if relevant

## Feature ideas

Open an issue using the [feature request template](.github/ISSUE_TEMPLATE/feature_request.yml). Discuss before sending a large PR — we may already have plans for that area.

## Code of conduct

Be kind. Disagree on substance, not on people. We follow the spirit of the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).

## License

By contributing, you agree that your contributions will be licensed under the MIT license, the same license as the project.
