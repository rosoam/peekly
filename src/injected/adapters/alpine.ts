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
 * Alpine.js adapter (v2 + v3).
 *
 * Alpine binds reactive scopes to host elements via the `x-data` attribute.
 * At runtime each `x-data` element exposes:
 *
 *   v3:  el._x_dataStack      (array of merged scope objects)
 *        el._x_attributes     (parsed Alpine directives)
 *        el._x_marker         (Alpine 3 internal marker)
 *   v2:  el.__x.$data         (single scope object)
 *
 * We surface the merged data as "props", parse the `x-data` attribute to
 * derive a friendly scope name, and walk up to find nested x-data scopes for
 * the owner chain.
 */

declare global {
  interface Element {
    _x_dataStack?: unknown[];
    _x_attributes?: unknown;
    __x?: { $data?: Record<string, unknown> };
  }
  interface Window {
    Alpine?: { version?: string };
  }
}

// ─── Detection ──────────────────────────────────────────────────────

function isAlpineRoot(el: Element): boolean {
  if (el.hasAttribute('x-data')) return true;
  if (Array.isArray(el._x_dataStack) && el._x_dataStack.length > 0) return true;
  if (el.__x && typeof el.__x === 'object') return true;
  return false;
}

function nearestAlpineRoot(el: Element): Element | null {
  let cur: Element | null = el;
  while (cur) {
    if (isAlpineRoot(cur)) return cur;
    cur = cur.parentElement;
  }
  return null;
}

// ─── Data extraction ────────────────────────────────────────────────

function getAlpineData(el: Element): Record<string, unknown> {
  // Alpine 3+: merged data stack
  if (Array.isArray(el._x_dataStack) && el._x_dataStack.length > 0) {
    try {
      const merged: Record<string, unknown> = {};
      for (const scope of el._x_dataStack) {
        if (scope && typeof scope === 'object') {
          Object.assign(merged, scope as Record<string, unknown>);
        }
      }
      return merged;
    } catch {
      return {};
    }
  }
  // Alpine 2: single scope on __x.$data
  if (el.__x && typeof el.__x.$data === 'object' && el.__x.$data) {
    return el.__x.$data;
  }
  return {};
}

// ─── Naming ─────────────────────────────────────────────────────────

/**
 * Derive a friendly scope name from the `x-data` attribute. Examples:
 *   x-data="dropdown()"            → "dropdown"
 *   x-data="dropdown({ open: 1 })" → "dropdown"
 *   x-data="{ count: 0 }"          → "scope"
 *   x-data="myStore"               → "myStore"
 *   x-data=""                      → "scope"
 */
function deriveScopeName(el: Element): string {
  const xData = (el.getAttribute('x-data') ?? '').trim();
  if (!xData) return 'scope';
  // Function call: "foo()" or "foo(...)"
  const fnMatch = /^(\w+)\s*\(/.exec(xData);
  if (fnMatch) return fnMatch[1] ?? 'scope';
  // Bare identifier
  const idMatch = /^(\w+)$/.exec(xData);
  if (idMatch) return idMatch[1] ?? 'scope';
  // Inline object literal
  if (xData.startsWith('{')) return 'scope';
  return 'scope';
}

function alpineDirectives(el: Element): string[] {
  const out: string[] = [];
  for (const attr of Array.from(el.attributes)) {
    if (attr.name.startsWith('x-') || attr.name.startsWith('@') || attr.name.startsWith(':')) {
      out.push(attr.name);
    }
  }
  return out;
}

// ─── Serialization ──────────────────────────────────────────────────

function previewObject(obj: object, maxKeys = 5): string {
  const keys = Object.keys(obj).slice(0, maxKeys);
  const more = Object.keys(obj).length > maxKeys ? `, +${Object.keys(obj).length - maxKeys}` : '';
  return `{ ${keys.join(', ')}${more} }`;
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
  if (t === 'function') return { type: 'function', name: (value as { name?: string }).name || 'anonymous' };
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

function dataAsProps(el: Element): Record<string, SerializedValue> {
  const out: Record<string, SerializedValue> = {};
  const data = getAlpineData(el);
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith('_')) continue;       // skip internal/private
    if (key.startsWith('$')) continue;       // skip Alpine magics ($el, $root, etc.)
    try {
      out[key] = serialize(value);
    } catch (err) {
      out[key] = { type: 'error', message: (err as Error).message };
    }
  }
  // Surface declared directives as a synthetic key so the user sees what
  // Alpine bindings are attached.
  const directives = alpineDirectives(el);
  if (directives.length > 0) {
    out['$directives'] = {
      type: 'array',
      length: directives.length,
      preview: directives.join(' '),
    };
  }
  return out;
}

// ─── Walks ──────────────────────────────────────────────────────────

function findChildAlpineRoots(root: Element, max = 50): Element[] {
  const out: Element[] = [];
  function visit(node: Element): void {
    if (out.length >= max) return;
    for (const child of Array.from(node.children)) {
      if (isAlpineRoot(child)) {
        out.push(child);
        // Don't recurse into nested Alpine scopes (only direct children).
      } else {
        visit(child);
      }
    }
  }
  visit(root);
  return out;
}

function nearestParentAlpineRoot(root: Element): Element | null {
  let cur: Element | null = root.parentElement;
  while (cur) {
    if (isAlpineRoot(cur)) return cur;
    cur = cur.parentElement;
  }
  return null;
}

function ownerChain(root: Element, max = 10): OwnerInfo[] {
  const chain: OwnerInfo[] = [];
  let cur: Element | null = root.parentElement;
  while (cur && chain.length < max) {
    if (isAlpineRoot(cur)) {
      chain.push({ name: deriveScopeName(cur), kind: 'options', source: null });
    }
    cur = cur.parentElement;
  }
  return chain;
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
  const id = `a${++registryCounter}`;
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
    name: deriveScopeName(el),
    kind: 'options',
    source: null,
  };
}

// ─── Public adapter object ──────────────────────────────────────────

export const alpineAdapter: FrameworkAdapter = {
  name: 'Alpine.js',

  recognizes(el: Element): boolean {
    return nearestAlpineRoot(el) !== null;
  },

  inspect(el: Element): ComponentInfo | null {
    const root = nearestAlpineRoot(el);
    if (!root) return null;
    const parent = nearestParentAlpineRoot(root);
    const children = findChildAlpineRoots(root);
    return {
      fiberId: registerElement(root),
      name: deriveScopeName(root),
      kind: 'options',
      source: null,
      props: dataAsProps(root),
      ownerChain: ownerChain(root),
      parent: parent ? elementToRef(parent) : null,
      children: children.map(elementToRef),
      domTag: el.tagName.toLowerCase(),
      rect: rectFromElement(el),
    };
  },

  preview(el: Element): ComponentPreview {
    const root = nearestAlpineRoot(el);
    const elementId = el.id || '';
    const className = el.getAttribute('class') ?? '';

    if (!root) {
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

    const data = getAlpineData(root);
    const propNames = Object.keys(data).filter((k) => !k.startsWith('_') && !k.startsWith('$'));
    const owners = ownerChain(root, 5).map((o) => o.name);
    const children = findChildAlpineRoots(root, 8).map(deriveScopeName);
    const parent = nearestParentAlpineRoot(root);

    return {
      name: deriveScopeName(root),
      kind: 'options',
      rect: rectFromElement(el),
      domTag: el.tagName.toLowerCase(),
      source: null,
      propNames,
      parentName: parent ? deriveScopeName(parent) : null,
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
    const root = nearestAlpineRoot(el);
    if (!root) return rectFromElement(el);
    return rectFromElement(root);
  },

  findInstancesOfSameType(el: Element): Rect[] {
    const root = nearestAlpineRoot(el);
    if (!root) return [];
    const targetName = deriveScopeName(root);
    const all = document.querySelectorAll('[x-data]');
    const rects: Rect[] = [];
    for (let i = 0; i < all.length && rects.length < 200; i += 1) {
      const candidate = all[i]!;
      if (deriveScopeName(candidate) === targetName) {
        const r = candidate.getBoundingClientRect();
        if (r.width > 0 || r.height > 0) {
          rects.push({ x: r.left, y: r.top, width: r.width, height: r.height });
        }
      }
    }
    return rects;
  },

  version(): string | null {
    return window.Alpine?.version ?? null;
  },
};
