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
 * Universal fallback adapter. Always recognizes any Element. Surfaces:
 *
 *   - the DOM tag as "name"
 *   - HTML attributes serialized as "props" (so the panel's Props section
 *     shows them in a familiar key/value layout)
 *   - the ancestor chain as "ownerChain" (so the "Rendered by" section shows
 *     where this element lives in the DOM tree, even without a framework)
 *   - parent/children DOM elements for navigation chips
 *
 * Source location is always null (no compile-time info available for plain HTML).
 * Render counter is not supported (no observation hook for arbitrary DOM).
 */

// ─── Element registry ────────────────────────────────────────────────

const elementRegistry = new Map<string, WeakRef<Element>>();
let elementRegistryCounter = 0;

function registerElement(el: Element): string {
  for (const [id, ref] of elementRegistry) {
    if (ref.deref() === el) return id;
  }
  const id = `d${++elementRegistryCounter}`;
  elementRegistry.set(id, new WeakRef(el));
  if (elementRegistry.size > 200) {
    const firstKey = elementRegistry.keys().next().value;
    if (firstKey) elementRegistry.delete(firstKey);
  }
  return id;
}

function lookupElement(id: string): Element | null {
  const ref = elementRegistry.get(id);
  if (!ref) return null;
  const el = ref.deref();
  if (!el || !el.isConnected) {
    elementRegistry.delete(id);
    return null;
  }
  return el;
}

function elementToRef(el: Element): ComponentRef {
  return {
    fiberId: registerElement(el),
    name: selectorOf(el),
    kind: 'host',
    source: null,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────

function selectorOf(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const className = (el.getAttribute('class') ?? '').trim();
  let cls = '';
  if (className) {
    const parts = className.split(/\s+/).filter(Boolean);
    const joined = '.' + parts.slice(0, 3).join('.');
    if (parts.length > 3) cls = joined + '…';
    else cls = joined;
    if (cls.length > 28) cls = cls.slice(0, 27) + '…';
  }
  return `${tag}${id}${cls}`;
}

function rectFromElement(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, width: r.width, height: r.height };
}

function attributesAsProps(el: Element): Record<string, SerializedValue> {
  const out: Record<string, SerializedValue> = {};
  for (const attr of Array.from(el.attributes)) {
    const value = attr.value;
    out[attr.name] = {
      type: 'primitive',
      value: value.length > 200 ? value.slice(0, 200) + '…' : value,
    };
  }
  return out;
}

function ancestorChain(el: Element, max = 10): OwnerInfo[] {
  const chain: OwnerInfo[] = [];
  let cur: Element | null = el.parentElement;
  while (cur && chain.length < max && cur !== document.body && cur !== document.documentElement) {
    chain.push({
      name: selectorOf(cur),
      kind: 'host',
      source: null,
      fiberId: registerElement(cur),
    });
    cur = cur.parentElement;
  }
  return chain;
}

function immediateChildren(el: Element, max = 12): ComponentRef[] {
  const out: ComponentRef[] = [];
  for (const child of Array.from(el.children).slice(0, max)) {
    out.push(elementToRef(child));
  }
  return out;
}

// ─── The adapter ────────────────────────────────────────────────────

export const plainDomAdapter: FrameworkAdapter = {
  name: 'Plain DOM',

  recognizes(): boolean {
    // Universal fallback — always last in the chain.
    return true;
  },

  inspect(el: Element): ComponentInfo {
    const parent = el.parentElement;
    return {
      fiberId: registerElement(el),
      name: el.tagName.toLowerCase(),
      kind: 'host',
      source: null,
      props: attributesAsProps(el),
      ownerChain: ancestorChain(el),
      parent: parent && parent !== document.documentElement ? elementToRef(parent) : null,
      children: immediateChildren(el),
      domTag: el.tagName.toLowerCase(),
      rect: rectFromElement(el),
    };
  },

  preview(el: Element): ComponentPreview {
    const parent = el.parentElement;
    const childrenSel = Array.from(el.children).slice(0, 8).map((c) => selectorOf(c));
    const ownerSel = ancestorChain(el, 5).map((o) => o.name);
    const propNames = Array.from(el.attributes).map((a) => a.name);
    return {
      name: el.tagName.toLowerCase(),
      kind: 'host',
      rect: rectFromElement(el),
      domTag: el.tagName.toLowerCase(),
      source: null,
      propNames,
      parentName: parent ? selectorOf(parent) : null,
      childrenNames: childrenSel,
      ownerNames: ownerSel,
      elementId: el.id || '',
      className: el.getAttribute('class') ?? '',
    };
  },

  resolveById(id: string): Element | null {
    return lookupElement(id);
  },

  componentRect(el: Element): Rect {
    return rectFromElement(el);
  },

  findInstancesOfSameType(el: Element): Rect[] {
    // For plain DOM, "same type" = same tag name. Capped to first 200 to avoid
    // exhausting the page on something like <div>.
    const tag = el.tagName.toLowerCase();
    const all = document.getElementsByTagName(tag);
    const max = Math.min(all.length, 200);
    const rects: Rect[] = [];
    for (let i = 0; i < max; i += 1) {
      const r = all[i]!.getBoundingClientRect();
      if (r.width > 0 || r.height > 0) {
        rects.push({ x: r.left, y: r.top, width: r.width, height: r.height });
      }
    }
    return rects;
  },

  // No render observation possible for plain DOM (no framework hook to listen on).
  version(): string | null {
    return null;
  },
};
