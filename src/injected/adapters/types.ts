import type { ComponentInfo, ComponentPreview, Rect } from '../../shared/messages';

/**
 * Pluggable inspector for one framework family (React, Vue, Plain DOM, …).
 *
 * Conventions
 * - All methods are *synchronous* and *side-effect-free* except subscribeRenders.
 * - Methods that can fail return null / empty array; they never throw.
 * - The adapter never touches `chrome.*` APIs; only the bridge orchestrator does.
 * - `recognizes(el)` must be cheap (single property access, ideally) — it is called on
 *   every hover request before dispatching.
 */
export interface FrameworkAdapter {
  /** Human-readable framework name. Never shown in the UI by default; for telemetry / debug. */
  readonly name: string;

  /** Cheap probe: does this adapter own this element? */
  recognizes(el: Element): boolean;

  /** Full inspection. Populates the rich panel. Return null if the element isn't recognised. */
  inspect(el: Element): ComponentInfo | null;

  /** Lightweight inspection for the live hover label / tooltip. Always returns a value. */
  preview(el: Element): ComponentPreview;

  /** Resolve a previously-registered component reference back to its host element.
   *  Used for navigation chips (parent / child / owner) and for the hover-preview overlay.
   *  Returns null if the component has been unmounted. */
  resolveById(id: string): Element | null;

  /** The bounding rect of the *component subtree* attached to this element. May span
   *  multiple host descendants. Used by "highlight all instances" and chip-hover. */
  componentRect(el: Element): Rect;

  /** Locate every instance of the same component type on the page. Used by the
   *  "Highlight all instances" header button. */
  findInstancesOfSameType(el: Element): Rect[];

  /** Optional: subscribe to render events for the live re-render counter.
   *  Returns an unsubscribe callback. Adapters that can't observe renders simply
   *  return a no-op subscription (ticking 0). */
  subscribeRenders?(refId: string, onTick: (count: number, when: number) => void): () => void;

  /** Detected framework version, when available. Only used in audit / debug. */
  version(): string | null;

  /** Called once at adapter load time. May install global hooks (e.g. React DevTools stub). */
  init?(): void;
}

/**
 * Adapters declare themselves in priority order. The orchestrator tries `recognizes`
 * on each in turn and uses the first match. The Plain DOM adapter MUST be the last
 * entry so that any element is at least covered by the universal fallback.
 */
export type AdapterChain = readonly FrameworkAdapter[];
