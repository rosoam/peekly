import type {
  ComponentInfo,
  ComponentKind,
  ComponentPreview,
  ComponentRef,
  OwnerInfo,
  Rect,
  SerializedValue,
} from '../../shared/messages';
import type { FrameworkAdapter } from './types';

/**
 * Lit and generic Web Components adapter.
 *
 * A web component is any element whose tag name contains a hyphen and is
 * registered in `customElements`. We treat the custom element itself as the
 * "component" (no virtual DOM tree, the element instance IS the component
 * runtime).
 *
 * Lit elements are a subclass — when the element has Lit-specific markers
 * (e.g. a `static properties` definition on the constructor) we surface the
 * declared reactive properties as a richer Props section.
 */

const LIT_PROPS_KEY = '_$litInstanceProperties$';

// ─── Detection ──────────────────────────────────────────────────────

function isCustomElement(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (!tag.includes('-')) return false;
  try {
    return typeof customElements.get(tag) === 'function';
  } catch {
    return false;
  }
}

function nearestCustomElement(el: Element): Element | null {
  let cur: Element | null = el;
  while (cur) {
    if (isCustomElement(cur)) return cur;
    cur = cur.parentElement;
  }
  return null;
}

function isLitElement(el: Element): boolean {
  // Direct marker on instance (Lit 2+).
  if (LIT_PROPS_KEY in el) return true;
  // Walk the prototype chain for a constructor named LitElement / ReactiveElement.
  let proto: object | null = Object.getPrototypeOf(el);
  let depth = 0;
  while (proto && depth < 8) {
    const ctorName = (proto.constructor as { name?: string } | undefined)?.name;
    if (ctorName === 'LitElement' || ctorName === 'ReactiveElement') return true;
    proto = Object.getPrototypeOf(proto);
    depth += 1;
  }
  return false;
}

function getKind(el: Element): ComponentKind {
  return isLitElement(el) ? 'lit' : 'web-component';
}

function getDisplayName(el: Element): string {
  const className = (el.constructor as { name?: string }).name;
  // Use class name if it's not the generic HTMLElement, otherwise tag name.
  if (className && className !== 'HTMLElement' && !className.startsWith('HTML')) {
    return className;
  }
  return el.tagName.toLowerCase();
}

// ─── Props ──────────────────────────────────────────────────────────

function previewObject(obj: object, maxKeys = 5): string {
  const keys = Object.keys(obj).slice(0, maxKeys);
  const more = Object.keys(obj).length > maxKeys ? `, +${Object.keys(obj).length - maxKeys}` : '';
  return `{ ${keys.join(', ')}${more} }`;
}

function isInlineFn(fn: unknown): boolean {
  if (typeof fn !== 'function') return false;
  const name = (fn as { name?: string }).name;
  return !name || name.length <= 2 || name.startsWith('bound ');
}

function serialize(value: unknown, depth = 0, seen = new WeakSet<object>()): SerializedValue {
  if (depth > 2 && value && typeof value === 'object') {
    return { type: 'object', keys: Object.keys(value).slice(0, 10), preview: previewObject(value) };
  }
  if (value === null) return { type: 'primitive', value: null };
  if (value === undefined) return { type: 'undefined' };
  const t = typeof value;
  if (t === 'string') {
    const s = value as string;
    return { type: 'primitive', value: s.length > 200 ? s.slice(0, 200) + '…' : s };
  }
  if (t === 'number' || t === 'boolean') return { type: 'primitive', value: value as number | boolean };
  if (t === 'bigint') return { type: 'primitive', value: (value as bigint).toString() + 'n' };
  if (t === 'symbol') return { type: 'symbol', description: (value as symbol).description ?? '' };
  if (t === 'function') {
    const fn = value as { name?: string };
    return { type: 'function', name: fn.name || 'anonymous', inline: isInlineFn(value) };
  }
  if (t === 'object') {
    const obj = value as object;
    if (seen.has(obj)) return { type: 'circular' };
    seen.add(obj);
    try {
      if (Array.isArray(obj)) return { type: 'array', length: obj.length, preview: `Array(${obj.length})` };
      const keys = Object.keys(obj);
      return { type: 'object', keys: keys.slice(0, 20), preview: previewObject(obj) };
    } catch (err) {
      return { type: 'error', message: (err as Error).message };
    }
  }
  return { type: 'error', message: `unsupported type ${t}` };
}

/** For Lit: read the declared reactive properties from `static properties`. */
function getLitDeclaredProps(el: Element): Record<string, SerializedValue> {
  const out: Record<string, SerializedValue> = {};
  const ctor = el.constructor as { properties?: Record<string, unknown> | Map<string, unknown> };
  const decl = ctor.properties;
  if (!decl) return out;
  const keys = decl instanceof Map ? Array.from(decl.keys()) : Object.keys(decl);
  for (const key of keys) {
    try {
      out[key] = serialize((el as unknown as Record<string, unknown>)[key]);
    } catch (err) {
      out[key] = { type: 'error', message: (err as Error).message };
    }
  }
  return out;
}

/** Fallback: HTML attributes serialized as props for any custom element. */
function getAttrsAsProps(el: Element): Record<string, SerializedValue> {
  const out: Record<string, SerializedValue> = {};
  for (const attr of Array.from(el.attributes)) {
    out[attr.name] = { type: 'primitive', value: attr.value.length > 200 ? attr.value.slice(0, 200) + '…' : attr.value };
  }
  return out;
}

function getProps(el: Element): Record<string, SerializedValue> {
  const litProps = isLitElement(el) ? getLitDeclaredProps(el) : {};
  const attrProps = getAttrsAsProps(el);
  // Lit declared props override same-named attributes (their JS value is richer).
  return { ...attrProps, ...litProps };
}

// ─── Walks ──────────────────────────────────────────────────────────

function findChildCustomElements(el: Element, max = 50): Element[] {
  const out: Element[] = [];
  function visit(node: Element): void {
    if (out.length >= max) return;
    for (const child of Array.from(node.children)) {
      if (isCustomElement(child)) {
        out.push(child);
        // Don't recurse into the child component (we only want direct CE children).
      } else {
        visit(child);
      }
    }
  }
  // Also walk the shadow root, where Lit puts most of its declarative children.
  if ((el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot) {
    const root = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
    if (root) {
      for (const child of Array.from(root.children)) {
        if (isCustomElement(child)) {
          if (out.length < max) out.push(child);
        } else {
          visit(child);
        }
      }
    }
  }
  visit(el);
  return out;
}

function ownerChain(el: Element, max = 10): OwnerInfo[] {
  const chain: OwnerInfo[] = [];
  let cur: Element | null = el.parentElement;
  while (cur && chain.length < max) {
    if (isCustomElement(cur)) {
      chain.push({
        name: getDisplayName(cur),
        kind: getKind(cur),
        source: null,
        fiberId: registerElement(cur),
      });
    }
    cur = cur.parentElement;
  }
  return chain;
}

function nearestParentCE(el: Element): Element | null {
  let cur: Element | null = el.parentElement;
  while (cur) {
    if (isCustomElement(cur)) return cur;
    cur = cur.parentElement;
  }
  return null;
}

function rectFromElement(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, width: r.width, height: r.height };
}

// ─── Registry ───────────────────────────────────────────────────────

const elementRegistry = new Map<string, WeakRef<Element>>();
let registryCounter = 0;

function registerElement(el: Element): string {
  for (const [id, ref] of elementRegistry) {
    if (ref.deref() === el) return id;
  }
  const id = `l${++registryCounter}`;
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
    name: getDisplayName(el),
    kind: getKind(el),
    source: null,
  };
}

// ─── Public adapter object ──────────────────────────────────────────

export const litAdapter: FrameworkAdapter = {
  name: 'Lit / Web Components',

  recognizes(el: Element): boolean {
    return nearestCustomElement(el) !== null;
  },

  inspect(el: Element): ComponentInfo | null {
    const ce = nearestCustomElement(el);
    if (!ce) return null;
    const parent = nearestParentCE(ce);
    const children = findChildCustomElements(ce);
    return {
      fiberId: registerElement(ce),
      name: getDisplayName(ce),
      kind: getKind(ce),
      source: null,
      props: getProps(ce),
      ownerChain: ownerChain(ce),
      parent: parent ? elementToRef(parent) : null,
      children: children.map(elementToRef),
      domTag: el.tagName.toLowerCase(),
      rect: rectFromElement(el),
    };
  },

  preview(el: Element): ComponentPreview {
    const ce = nearestCustomElement(el);
    const elementId = el.id || '';
    const className = el.getAttribute('class') ?? '';

    if (!ce) {
      return {
        name: el.tagName.toLowerCase(),
        kind: 'host',
        rect: rectFromElement(el),
        domTag: el.tagName.toLowerCase(),
        source: null,
        propNames: [],
        parentName: null,
        childrenNames: [],
        ownerNames: [],
        elementId,
        className,
      };
    }

    const propNames = isLitElement(ce)
      ? Object.keys(getLitDeclaredProps(ce))
      : Array.from(ce.attributes).map((a) => a.name);

    const owners = ownerChain(ce, 5).map((o) => o.name);
    const children = findChildCustomElements(ce, 8).map((c) => getDisplayName(c));
    const parent = nearestParentCE(ce);

    return {
      name: getDisplayName(ce),
      kind: getKind(ce),
      rect: rectFromElement(el),
      domTag: el.tagName.toLowerCase(),
      source: null,
      propNames,
      parentName: parent ? getDisplayName(parent) : null,
      childrenNames: children,
      ownerNames: owners,
      elementId,
      className,
    };
  },

  resolveById(id: string): Element | null {
    return lookupElement(id);
  },

  componentRect(el: Element): Rect {
    const ce = nearestCustomElement(el);
    if (!ce) return rectFromElement(el);
    return rectFromElement(ce);
  },

  findInstancesOfSameType(el: Element): Rect[] {
    const ce = nearestCustomElement(el);
    if (!ce) return [];
    const tag = ce.tagName.toLowerCase();
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

  version(): string | null {
    // Lit doesn't expose its version on a per-page basis. Skip.
    return null;
  },
};
