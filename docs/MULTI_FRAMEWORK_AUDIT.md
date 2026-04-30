# Multi-Framework Support — Audit

**Status**: Planning. As of v0.2.0, Peekly inspects React only.
**Last updated**: 2026-04-30

This document audits the feasibility of extending Peekly beyond React, ranks targets by impact and effort, and proposes an adapter architecture.

---

## 1. Goals

Make Peekly useful on:

- **Any HTML page** (no framework). The DOM, CSS, A11y, and "Open in editor" features should work without requiring a framework runtime.
- **Other major frameworks** (Vue, Preact, Lit, Angular). The "Component" tab and the navigation chips should populate using each framework's runtime data.

Non-goals:

- Replacing framework-specific official DevTools. We complement them with a different UX (on-page floating panel, faster gesture, jump-to-source).
- Supporting esoteric or pre-1.0 frameworks. We pick adoption-weighted targets.

## 1.5. PHP and other server-rendered stacks — what's even possible?

A browser extension only sees what the browser receives: HTML, CSS, JS. **PHP itself runs on the server**, so there's no "PHP component" to inspect in the browser the way React fibers exist in memory. That said, several patterns in the PHP world emit browser-side hooks Peekly *can* use, plus Plain-DOM mode covers the rest.

### What Peekly can offer per PHP stack

| Stack | What lives in the browser | Inspectable by Peekly? | Effort |
|---|---|---|---|
| **WordPress** (classic theme) | Pure server-rendered HTML | Plain-DOM only (DOM, CSS, A11y, classes) | trivial — covered by Wave 1 |
| **Vanilla PHP / Slim / Lumen** | Pure server-rendered HTML | Plain-DOM only | trivial |
| **Symfony + Twig** | HTML; in dev with `framework.profiler` enabled, the response includes a debug toolbar; with `twig.debug` HTML comments mark template boundaries (`<!-- BEGIN templates/component.html.twig -->`) | Plain-DOM + parse Twig debug comments → "Open template" jump-to-source | low (~2-3h adapter) |
| **Laravel + Blade** | HTML; with packages like `laravel-debugbar` or `dedoc/scramble`, comments and data attributes mark Blade origins | Plain-DOM + parse Blade debug markers → jump-to-source | low (~2-3h adapter) |
| **Laravel Livewire** | Each Livewire component renders into a `<div wire:id="…">` wrapper with a `wire:snapshot="…"` JSON blob containing component name, properties, listeners. Real-time updates via WebSocket-ish polling | **Yes — full adapter possible** ✅ Show Livewire component name, props, listeners, jump to PHP source if `wire:source` (custom) is added or via class name → file mapping | medium (~6-8h adapter) |
| **Filament** (admin panels) | Built on Livewire + Alpine.js. Inherits both stacks' inspectability. | Yes — Livewire adapter + Alpine.js adapter cover it | covered by Livewire/Alpine waves |
| **Inertia.js** (Laravel ↔ Vue/React/Svelte) | The frontend is real Vue/React/Svelte (just SSR'd with Laravel-controlled props). All the JS framework adapters work directly. | Yes — covered by Vue/React adapters | already handled |
| **Hotwire / Turbo / Stimulus** (Rails or Symfony) | HTML with `data-controller`, `data-action`, `data-target` attributes. Stimulus controllers are JS classes registered globally. | Plain-DOM + Stimulus adapter that surfaces controller name and actions for any element with `data-controller` | low-medium (~3-4h adapter) |
| **HTMX** (often used with Laravel/Symfony) | HTML with `hx-*` attributes. No client-side component model. | Plain-DOM, but Peekly can highlight `hx-*` attributes as a "behavioral" tag in the DOM tab | trivial (cosmetic) |
| **AlpineJS** (very common in Laravel + Filament stacks) | Each `x-data` element has `__x` runtime ref with `$data`, `$el`, `$root` | Yes — `Alpine.js` row in main table covers this | low-medium |

### Server-side source jump (Blade / Twig templates)

The most useful PHP-specific win is **mapping rendered HTML back to the template file that produced it**. Two paths:

1. **Twig debug comments** — Symfony/Twig with `twig.debug: true` emits:
   ```html
   <!-- BEGIN templates/blocks/header.html.twig -->
   <header>...</header>
   <!-- END templates/blocks/header.html.twig -->
   ```
   Peekly can walk up from the hovered element to find the nearest BEGIN comment, surface the template path in the DOM tab, and "Open in editor" jumps directly to the file.

2. **Blade source attributes (custom)** — Laravel has no native equivalent, but a Blade directive can be added:
   ```php
   @inject_source
   <div>{{ $content }}</div>
   ```
   That emits `data-source="resources/views/x.blade.php:42"`. Peekly reads the attribute. Requires a small Composer package on the user's side, ~30 lines of PHP.

3. **Livewire** components naturally know their PHP class file, which can be derived from `wire:component-class` if exposed (or computed from class name conventions: `App\Livewire\UserProfile` → `app/Livewire/UserProfile.php`).

### Recommended PHP-side priorities

| Priority | Target | Why |
|---|---|---|
| **P1** (with Wave 1) | **Twig debug comment parser** | Cheapest 10x — Symfony/Twig users get jump-to-template instantly without changing their app. ~2h. |
| **P2** (with Wave 1) | **Highlight `wire:*`, `hx-*`, `x-*`, `data-controller`, `data-action` attributes specially** in the DOM tab so PHP devs see at a glance what behavioral framework is bound to which element | Cosmetic but high signal. ~1h. |
| **P3** (Wave 2 area) | **Livewire adapter** — surface component name, properties, listeners | Massive Laravel community, real differentiator. ~6-8h. |
| **P4** | **Stimulus adapter** | Useful for Symfony-Stimulus and Rails users. ~3-4h. |
| **P5** | **Blade debug attribute reader** (requires user-side Composer package) | Lower priority because it requires the user to install a Laravel package first. We can ship the JS side and document the PHP side. ~2h JS + ~1d PHP package + docs. |

### Summary for PHP

- **Anyone using PHP gets value day 1** from Plain-DOM mode (DOM, CSS, A11y, classes, "Copy outerHTML"). No PHP-specific work needed for that.
- **Inertia.js apps** are entirely handled by the Vue/React adapter — the PHP backend is invisible to the browser.
- **Livewire** is the most interesting target: real reactive component model, present in the browser via `wire:*` attributes, large Laravel community. A medium-effort adapter unlocks first-class support.
- **Twig/Blade jump-to-source** is achievable without PHP-side cooperation for Twig (debug comments) and with a small Composer package for Blade.

These PHP-specific items slot into the existing roadmap without changing the wave order: P1 and P2 land **with Wave 1** (Plain-DOM), P3 (Livewire) lands as part of **Wave 2 or 3**, and P4–P5 are opportunistic.

## 2. Framework analysis

| Framework | DOM-side reachability | Source maps in dev | Adoption | Effort | Verdict |
|---|---|---|---|---|---|
| **React** (current) | `__reactFiber$xxx` keys on host nodes; `__REACT_DEVTOOLS_GLOBAL_HOOK__` for commits | ✅ `_debugSource` from JSX dev transform | ⭐⭐⭐⭐⭐ | done | shipping |
| **Preact** | Same model as React (compat). `_component` ref on host node, fiber-shaped tree | ⚠️ `__source` only when dev-build with `@preact/preset-vite` | ⭐⭐⭐ | low | **next** |
| **Vue 3** | `__vueParentComponent` on host nodes; `__VUE_DEVTOOLS_GLOBAL_HOOK__` for events; component instance has `.type`, `.props`, `.setupState` | ✅ `__file` on component definition with `vue-loader` / `@vitejs/plugin-vue` dev | ⭐⭐⭐⭐⭐ | medium-high | **next** |
| **Vue 2** | `__vue__` on host nodes; component instance has `_vnode`, `$options`, `$props` | ✅ `__file` similar to Vue 3 | ⭐⭐⭐ (legacy) | medium | possible |
| **Solid** | `__solid_devtools__` hook (newer); fine-grained reactivity, no virtual DOM tree → component info is sparse | ⚠️ patchy | ⭐⭐ | medium | possible |
| **Svelte** | Compiled away. Runtime has no component tree by default. `__sveltekit_dev` symbols only in dev | ❌ very limited at runtime | ⭐⭐⭐⭐ | high | **defer** |
| **Angular** | `__ngContext__` on host nodes points to LView (after Ivy); `ng.getComponent(el)` works in dev | ⚠️ partial | ⭐⭐⭐⭐ (enterprise) | medium-high | possible later |
| **Lit / Web Components** | Native `customElements`; `el.constructor` is the component class; `el._$litInstanceProperties$` for Lit | ⚠️ no native source maps unless tooling adds them | ⭐⭐⭐ | low-medium | **next** |
| **Qwik** | `q:id` and similar `data-q-*` attrs on elements; runtime is server-resumable so component info is implicit | ⚠️ patchy | ⭐ | medium | defer |
| **Alpine.js** | `__x` on host elements with `x-data`; component data inside `__x.$data` | ❌ no source maps (it's HTML-attribute-based) | ⭐⭐ | low | possible |
| **HTMX** | Behavioral micro-framework, no component model. Just attributes (`hx-*`) | N/A | ⭐⭐⭐ | trivial (cosmetic attribute highlighting only) | covered by Plain DOM |
| **Stimulus** (Hotwire) | Each `data-controller="x"` element has a registered JS controller. `application.getControllerForElementAndIdentifier(el, name)` works in dev | ⚠️ no native source maps | ⭐⭐⭐ | low-medium | possible (Wave 3) |
| **Laravel Livewire** | `wire:id` on root element + `wire:snapshot` JSON contains component class + state. Browser-side hooks via `window.Livewire`. | ⚠️ component class → PHP file via convention | ⭐⭐⭐⭐ (Laravel) | medium | **Wave 2/3** |
| **Twig debug comments** | `<!-- BEGIN templates/x.html.twig -->` markers in HTML | ✅ direct file path in comment | ⭐⭐⭐ (Symfony) | trivial | **Wave 1 cosmetic** |
| **Plain DOM** (no framework) | Always reachable | N/A | ⭐⭐⭐⭐⭐ | trivial | **step 1** |

### Reading the table

- **Reachability**: how much component info we can pull from the DOM in our MAIN-world script.
- **Source maps in dev**: whether we can resolve `file:line:col` for "Open in editor".
- **Adoption**: rough community size and likelihood our target users will benefit.
- **Effort**: time to write a working adapter from scratch, assuming the existing bridge is already abstracted (otherwise add ~6h for the abstraction work).

## 3. Detection strategy

For each adapter, we need a fast probe that says "this page uses framework X". Run in order of likelihood; first match wins.

```ts
// Pseudocode, runs once per page on document_idle
function detectFramework(): FrameworkAdapter {
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.renderers?.size > 0) return reactAdapter;
  if (Object.keys(document.body).some(k => k.startsWith('__reactFiber$'))) return reactAdapter; // covers no-DevTools React
  if (document.body.__vue_app__ || window.__VUE_DEVTOOLS_GLOBAL_HOOK__) return vue3Adapter;
  if (document.body.__vue__) return vue2Adapter;
  if (document.body.__ngContext__ != null || window.ng) return angularAdapter;
  if (document.querySelector('[is]') || document.querySelector('script[type="module"][src*=lit]')) return litAdapter; // weak signal
  if (Object.keys(document.body).some(k => k === '__x')) return alpineAdapter;
  return plainDomAdapter;
}
```

The probes are cheap (single property access). No measurable cost on page load.

A page can have **multiple frameworks** (e.g. an Angular app embedding a React micro-frontend). The bridge can keep the list of detected adapters and probe per-element to pick the right one for whatever the user is hovering.

## 4. Adapter architecture

Refactor `src/injected/bridge.ts` from React-specific to a thin orchestrator over pluggable adapters.

```
src/injected/
  bridge.ts                 # message handling, registry, common utilities
  adapters/
    types.ts                # FrameworkAdapter interface
    react.ts                # current logic
    preact.ts
    vue3.ts
    vue2.ts
    angular.ts
    lit.ts
    alpine.ts
    plain-dom.ts            # fallback for any element
```

### `FrameworkAdapter` interface

```ts
export interface FrameworkAdapter {
  /** Probe an element. Returns true if this adapter recognizes it. */
  recognizes(el: Element): boolean;

  /** Pull a ComponentInfo from the element. */
  inspect(el: Element): ComponentInfo | null;

  /** Lightweight preview for hover/tooltip — same shape as ComponentInfo but cheaper. */
  preview(el: Element): ComponentPreview | null;

  /** Find the parent / children component nodes. */
  parent(el: Element): Element | null;
  children(el: Element): Element[];

  /** Optional: subscribe to render events for live counters. */
  subscribeRenders?(el: Element, onTick: (count: number) => void): () => void;

  /** Detect framework version, if available, for the popup status badge. */
  version(): string | null;

  /** Human-readable framework name for UI display. */
  name: string;
}
```

The bridge maintains an array of adapters, ordered by specificity. For each request:

1. If we already have a cached adapter for the target's root, use it.
2. Otherwise run `recognizes(el)` over the array; first hit wins.
3. Cache the choice for the session.

`plain-dom.ts` is always the last entry — it always recognizes any Element and returns a "framework-less" `ComponentInfo` (no name, no props, only DOM tag + classes + computed styles).

### Plain DOM as the safety net

Even when no framework is detected, Peekly still works:

- Highlight on hover (already does)
- DOM tag, attributes, computed styles in the panel/tooltip
- A11y audit (framework-agnostic)
- Tailwind / class-list breakdown (framework-agnostic)
- "Copy outerHTML" button
- DOM tree navigation (parent / children based on actual DOM, not framework tree)

This makes Peekly useful for designers reviewing static HTML, vanilla-JS apps, server-rendered pages without hydration, etc.

### React adapter migration

Existing logic in `bridge.ts` (fiber walking, registry, commit hook, source extraction) moves into `adapters/react.ts` largely unchanged. The bridge keeps:

- Message handling
- Fiber/element registry (now generic — keyed on adapter + element ref)
- `chrome.tabs.create` orchestration via the service worker
- Shadow DOM target tagging

## 5. Recommended order

| Wave | Targets | Rationale |
|---|---|---|
| **1** (next minor, v0.3.0) | **Plain DOM mode** + **Adapter refactor** | Unblocks every later wave. Already 70% there for the DOM/CSS/A11y tabs. Makes Peekly genuinely useful on any page. |
| **2** (v0.4.0) | **Vue 3** + **Preact** | Vue 3 has the largest non-React audience. Preact is essentially free after the React adapter exists (compat tree + same fiber-like keys). |
| **3** (v0.5.0) | **Lit / Web Components** + **Vue 2** | Lit gives broader ecosystem coverage; Vue 2 covers the long tail of legacy projects. Both moderate effort. |
| **4** (v0.6.0+) | **Angular** | Enterprise audience. Larger effort because Angular's introspection model is deeply tied to the framework's compiler. |
| **deferred** | Solid, Svelte, Qwik, Alpine | Smaller communities OR runtime introspection is fundamentally hostile (Svelte's compile-away model). Revisit when there's user demand. |

## 6. Risks and tradeoffs

### Bundle size

Each adapter adds 1-3 KB gzipped to the MAIN-world bundle. With six adapters, we'd be at ~20-30 KB gzipped — still reasonable for a content script. We can tree-shake by detecting the framework at the user's first hover and lazy-importing only the matching adapter, but that complicates testing. Keep it simple at first; measure before optimizing.

### Compatibility with framework DevTools

We share the page with React DevTools, Vue DevTools, etc. Our hook into `onCommitFiberRoot` (and equivalents) wraps any existing hook rather than replacing it. As long as we always call the original at the end, no conflict.

### Source maps & "Open in editor"

This is the feature where adapters differ most. Some frameworks expose source location reliably in dev (React, Vue), others not (Svelte, Lit). The panel's source card needs to gracefully say "No source location" for unsupported cases, which it already does in v0.2.

### Maintenance cost

Each adapter is a separate target for breakage when the underlying framework changes its internals. React's fiber API has been stable for years; Vue 3's introspection model has changed between minors. Expect periodic adapter maintenance.

## 7. Decision matrix

For each candidate framework, the **go/no-go** check before starting work:

1. **Adoption ≥ 100k weekly npm downloads.** Filters Solid/Qwik for now.
2. **Reachability score ≥ 3** (component info accessible from MAIN world).
3. **Source maps available in dev mode.** Without this, the "Open in editor" feature degrades — still useful but less of a 10x.
4. **Estimated adapter effort ≤ 12 hours** including tests. Above that, we ask: is there a smaller subset (e.g. just component name, no props) that we can ship first?

Frameworks that pass: React (done), Preact, Vue 3, Vue 2, Angular, Lit.

## 8. Implementation milestones

When we start (estimate ~2 days for v0.3.0):

1. Refactor `bridge.ts` to use the `FrameworkAdapter` interface (4-6h).
2. Move React logic into `adapters/react.ts` (2h).
3. Add `adapters/plain-dom.ts` (2h) — also feeds the improved DOM tab in the tooltip.
4. End-to-end test on real React app + plain HTML page.
5. Ship as **v0.3.0 — "Framework-agnostic foundation"**.

Then per framework adapter, ~1-2 days each.

---

## Appendix: per-framework runtime probes (cheat sheet)

Use these in your terminal browser console to verify a page is using a given framework before manually testing an adapter.

```js
// React
Object.keys(document.body).some(k => k.startsWith('__reactFiber$'))

// React DevTools hook
!!window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.renderers?.size

// Preact
Object.keys(document.body).some(k => k === '_component') ||
Object.keys(document.body).some(k => k.startsWith('__preactattr_'))

// Vue 3
!!document.body.__vue_app__ || !!window.__VUE_DEVTOOLS_GLOBAL_HOOK__
// On any element:
el.__vueParentComponent

// Vue 2
!!document.body.__vue__

// Angular (Ivy)
!!document.body.__ngContext__ || !!window.ng

// Lit / web components
!!customElements.get(el.tagName.toLowerCase())

// Alpine.js
Object.keys(el).some(k => k === '__x')

// Solid
!!window.__solid_devtools__

// Qwik
!!document.querySelector('[q\\:id]')
```
