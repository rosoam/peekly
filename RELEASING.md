# Releasing Peekly

The release flow is fully scripted. One command bumps the version everywhere, runs the quality gates, edits the changelog, commits, and tags. You then push, and CI publishes a GitHub Release with the built `peekly.zip` attached.

## TL;DR

```bash
# Pick the bump that matches the changes in CHANGELOG's [Unreleased] section.
bun run release:patch    # bug fixes only
bun run release:minor    # new features (backwards-compatible)
bun run release:major    # breaking changes

# Then publish
git push origin main
git push origin v$(jq -r .version package.json)
```

## What the script does

`scripts/release.ts` performs, in order:

1. **Pre-flight checks**
   - Branch must be `main`.
   - Working tree must be clean.
   - The new tag must not already exist locally.
2. **Quality gates** — fails fast if either is red:
   - `bun run typecheck`
   - `bun run build`
3. **Bump version** in three places:
   - `package.json` `version`
   - `vite.config.ts` `defineManifest({ version: '…' })`
   - `CHANGELOG.md` — the `## [Unreleased]` section becomes `## [X.Y.Z] - YYYY-MM-DD`, and a fresh empty `## [Unreleased]` is left at the top for the next round of changes. A link reference is appended.
4. **Commit** as `chore(release): vX.Y.Z`.
5. **Tag** `vX.Y.Z`.

The script never pushes. It prints the two commands to copy.

## What the CI does on tag push

`.github/workflows/release.yml` runs when a tag matching `v*` is pushed:

1. Checks out the tag's commit.
2. Installs deps with Bun.
3. Generates icons (`bun run gen:icons`).
4. Typechecks (`bun run typecheck`).
5. Builds and zips (`bun run zip`) → `peekly.zip`.
6. Creates a GitHub Release named after the tag, with `peekly.zip` attached and release notes auto-generated from commits since the previous tag.

You don't need to touch the GitHub UI. The release appears at <https://github.com/rosoam/peekly/releases>.

## When to bump what

- `patch` — bug fixes, polish, perf, docs, no behavior change for users.
- `minor` — a new feature, a new keyboard combo, a new section in the panel. Backwards-compatible.
- `major` — anything that changes a long-standing default or removes a feature. Rare.

## How to maintain CHANGELOG.md

Add entries under `## [Unreleased]` as you commit. Use the standard sub-headings: `Added`, `Changed`, `Fixed`, `Removed`, `Deprecated`, `Security`. Keep them user-facing — the changelog is read by people who install the extension, not by people reading the source.

When you cut a release, the script promotes `[Unreleased]` to `[X.Y.Z] - DATE`, leaves a fresh `[Unreleased]` at the top, and appends the GitHub Release link.

## Publishing to the Chrome Web Store (optional)

The Chrome Web Store distributes the extension to end users with auto-updates. It's not enabled by default in this repo because it requires a one-time $5 developer fee and OAuth setup.

### Prerequisites (one-time)

1. Pay the Chrome Web Store [developer fee](https://chrome.google.com/webstore/devconsole) ($5 USD, lifetime).
2. Submit `peekly.zip` manually the **first time** via the Developer Dashboard. Get back the **extension ID**.
3. Get OAuth credentials for the Chrome Web Store Publish API:
   - Create a project in [Google Cloud Console](https://console.cloud.google.com/).
   - Enable the **Chrome Web Store API**.
   - Create OAuth 2.0 credentials (Desktop app type).
   - Use [this guide](https://github.com/fregante/chrome-webstore-upload-keys) to obtain a refresh token.
4. Add four secrets to the GitHub repo (`Settings → Secrets and variables → Actions → New repository secret`):
   - `CWS_EXTENSION_ID`
   - `CWS_CLIENT_ID`
   - `CWS_CLIENT_SECRET`
   - `CWS_REFRESH_TOKEN`

### Enable the upload step

Uncomment the `Publish to Chrome Web Store` step at the bottom of `.github/workflows/release.yml`. From then on, every `vX.Y.Z` tag publishes to the store automatically (in addition to GitHub Releases).

## Hotfix flow

If you need to ship a fix on top of an already-released version:

```bash
# work on main (or a feature branch → PR → merge)
git checkout main
# … fix code, update CHANGELOG under [Unreleased]
bun run release:patch
git push origin main
git push origin v$(jq -r .version package.json)
```

## Yanking a bad release

```bash
# Remove the tag locally and remotely
git tag -d v0.2.1
git push origin :refs/tags/v0.2.1

# Delete the GitHub Release (or mark as pre-release)
gh release delete v0.2.1 --yes
```

If the release is already on the Chrome Web Store, you must roll back via the Developer Dashboard — there is no API for unpublishing a specific version.
