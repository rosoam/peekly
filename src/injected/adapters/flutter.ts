import type {
  ComponentInfo,
  ComponentPreview,
  ComponentRef,
  OwnerInfo,
  Rect,
  SerializedValue,
} from '../../shared/messages';
import type { FrameworkAdapter } from './types';

/**
 * Flutter Web adapter.
 *
 * Flutter Web ships two renderers:
 *   - HTML renderer    → DOM populated with `flt-*` custom elements wrapped
 *                        inside `<flutter-view>` / `<flt-glass-pane>`.
 *   - CanvasKit / Skwasm → a single `<canvas>` (or `<flt-scene>`) inside the
 *                        same hosts; the widget tree is opaque to the page.
 *
 * The widget tree only exists inside the Flutter engine; the page side gets
 * coarse-grained DOM. We surface what we can: friendly PascalCase names from
 * `flt-*` tags, the Flutter host chain as ownerChain, and version pulled from
 * the `_flutter` global when present.
 */

declare global {
  interface Window {
    _flutter?: {
      buildConfig?: { engineRevision?: string };
      loader?: unknown;
    };
  }
}

const FLT_TAG_PREFIX = 'flt-';
const ID_PREFIX = 'fl';
const FLUTTER_HOST_SELECTOR = 'flutter-view, flt-glass-pane';

const registry = new Map<string, WeakRef<Element>>();
let counter = 0;

function register(el: Element): string {
  for (const [id, ref] of registry) {
    if (ref.deref() === el) return id;
  }
  const id = `${ID_PREFIX}${++counter}`;
  registry.set(id, new WeakRef(el));
  if (registry.size > 200) {
    const first = registry.keys().next().value;
    if (first) registry.delete(first);
  }
  return id;
}

function lookup(id: string): Element | null {
  if (!id.startsWith(ID_PREFIX)) return null;
  const ref = registry.get(id);
  if (!ref) return null;
  const el = ref.deref();
  if (!el || !el.isConnected) {
    registry.delete(id);
    return null;
  }
  return el;
}

function isFlutterTag(tag: string): boolean {
  return tag.startsWith(FLT_TAG_PREFIX) || tag === 'flutter-view';
}

function withinFlutter(el: Element): boolean {
  return !!el.closest(FLUTTER_HOST_SELECTOR);
}

function pascalize(tag: string): string {
  if (tag === 'flutter-view') return 'FlutterView';
  const stripped = tag.startsWith(FLT_TAG_PREFIX) ? tag.slice(FLT_TAG_PREFIX.length) : tag;
  return stripped
    .split('-')
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

function flutterName(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (tag === 'canvas' && withinFlutter(el)) return 'CanvasKitSurface';
  if (isFlutterTag(tag)) return pascalize(tag);
  return tag;
}

function rectFromElement(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, width: r.width, height: r.height };
}

function attributesAsProps(el: Element): Record<string, SerializedValue> {
  const out: Record<string, SerializedValue> = {};
  for (const a of Array.from(el.attributes)) {
    out[a.name] = {
      type: 'primitive',
      value: a.value.length > 200 ? a.value.slice(0, 200) + '…' : a.value,
    };
  }
  return out;
}

function elementToRef(el: Element): ComponentRef {
  return {
    fiberId: register(el),
    name: flutterName(el),
    kind: 'web-component',
    source: null,
  };
}

function ownerChain(el: Element, max = 10): OwnerInfo[] {
  const chain: OwnerInfo[] = [];
  let cur: Element | null = el.parentElement;
  while (cur && chain.length < max && cur !== document.body && cur !== document.documentElement) {
    chain.push({
      name: flutterName(cur),
      kind: 'web-component',
      source: null,
      fiberId: register(cur),
    });
    cur = cur.parentElement;
  }
  return chain;
}

function children(el: Element, max = 12): ComponentRef[] {
  return Array.from(el.children)
    .slice(0, max)
    .map((c) => elementToRef(c));
}

function flutterVersion(): string | null {
  const w = window as Window;
  if (w._flutter?.buildConfig?.engineRevision) {
    return w._flutter.buildConfig.engineRevision.slice(0, 7);
  }
  if (w._flutter) return 'flutter-web';
  if (document.querySelector('script[src*="flutter_bootstrap.js"]')) return 'flutter-web';
  return null;
}

export const flutterAdapter: FrameworkAdapter = {
  name: 'Flutter Web',

  recognizes(el: Element): boolean {
    const tag = el.tagName.toLowerCase();
    if (isFlutterTag(tag)) return true;
    if (tag === 'canvas' && withinFlutter(el)) return true;
    return withinFlutter(el);
  },

  inspect(el: Element): ComponentInfo {
    const parent = el.parentElement;
    return {
      fiberId: register(el),
      name: flutterName(el),
      kind: 'web-component',
      source: null,
      props: attributesAsProps(el),
      ownerChain: ownerChain(el),
      parent: parent && parent !== document.documentElement ? elementToRef(parent) : null,
      children: children(el),
      domTag: el.tagName.toLowerCase(),
      rect: rectFromElement(el),
    };
  },

  preview(el: Element): ComponentPreview {
    const parent = el.parentElement;
    return {
      name: flutterName(el),
      kind: 'web-component',
      rect: rectFromElement(el),
      domTag: el.tagName.toLowerCase(),
      source: null,
      propNames: Array.from(el.attributes).map((a) => a.name),
      parentName: parent ? flutterName(parent) : null,
      childrenNames: Array.from(el.children)
        .slice(0, 8)
        .map((c) => flutterName(c)),
      ownerNames: ownerChain(el, 5).map((o) => o.name),
      elementId: el.id || '',
      className: el.getAttribute('class') ?? '',
    };
  },

  resolveById(id: string): Element | null {
    return lookup(id);
  },

  componentRect(el: Element): Rect {
    return rectFromElement(el);
  },

  findInstancesOfSameType(el: Element): Rect[] {
    const tag = el.tagName.toLowerCase();
    const rects: Rect[] = [];
    const all = document.getElementsByTagName(tag);
    const max = Math.min(all.length, 200);
    for (let i = 0; i < max; i += 1) {
      const r = all[i]!.getBoundingClientRect();
      if (r.width > 0 || r.height > 0) {
        rects.push({ x: r.left, y: r.top, width: r.width, height: r.height });
      }
    }
    return rects;
  },

  version(): string | null {
    return flutterVersion();
  },
};
