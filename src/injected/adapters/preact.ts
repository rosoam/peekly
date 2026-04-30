import type {
  ComponentInfo,
  ComponentKind,
  ComponentPreview,
  ComponentRef,
  OwnerInfo,
  Rect,
  SerializedValue,
  SourceLocation,
} from '../../shared/messages';
import type { FrameworkAdapter } from './types';

/**
 * Preact 10+ adapter (without `preact/compat` shim — apps using compat are
 * already detected by the React adapter via `__reactFiber$`).
 *
 * Detection: Preact attaches `__c` (alias `_component`) on a host element
 * that is the rendered DOM of a Preact Component. Function components
 * also have an internal Component instance, so the same probe works.
 *
 * What we surface:
 *   - name: vnode.type.displayName / vnode.type.name
 *   - kind: 'function' for functional components, 'class' otherwise
 *   - source: vnode.__source (set by @preact/preset-vite dev transform)
 *   - props: comp.props (already plain object)
 *   - parent: walk vnode._parent to find nearest component
 *   - children: walk vnode._children to find direct child components
 *   - ownerChain: same as parent walk (Preact has no owner concept)
 */

// ─── Preact internal types (subset) ─────────────────────────────────

type Component = {
  __v?: VNode;     // current VNode (preferred since Preact 10.x mangling)
  _vnode?: VNode;  // legacy alias
  props: Record<string, unknown>;
  state: Record<string, unknown> | null;
  constructor: { name?: string; displayName?: string };
};

type VNode = {
  type: unknown;
  props: Record<string, unknown>;
  __c?: Component;   // component instance backref
  _component?: Component;
  __k?: VNode[];     // children VNodes
  _children?: VNode[];
  __e?: Element;     // first DOM node
  _dom?: Element;
  __?: VNode;        // parent VNode
  _parent?: VNode;
  __source?: { fileName: string; lineNumber?: number; columnNumber?: number };
  _source?: { fileName: string; lineNumber?: number; columnNumber?: number };
};

declare global {
  interface Element {
    __c?: Component;
    _component?: Component;
  }
}

// ─── Detection / walking ────────────────────────────────────────────

function getComponentFromElement(el: Element): Component | null {
  return el.__c ?? el._component ?? null;
}

function vnodeOf(comp: Component): VNode | null {
  return comp.__v ?? comp._vnode ?? null;
}

function childrenOf(vnode: VNode): VNode[] {
  return (vnode.__k ?? vnode._children ?? []).filter(Boolean);
}

function parentOf(vnode: VNode): VNode | null {
  return vnode.__ ?? vnode._parent ?? null;
}

function domOf(vnode: VNode): Element | null {
  return (vnode.__e ?? vnode._dom) ?? null;
}

function sourceOf(vnode: VNode): SourceLocation | null {
  const src = vnode.__source ?? vnode._source;
  return src ? { fileName: src.fileName, lineNumber: src.lineNumber, columnNumber: src.columnNumber } : null;
}

function nearestPreactComponent(el: Element): { vnode: VNode; component: Component } | null {
  let cur: Element | null = el;
  while (cur) {
    const comp = getComponentFromElement(cur);
    if (comp) {
      const vnode = vnodeOf(comp);
      if (vnode) return { vnode, component: comp };
    }
    cur = cur.parentElement;
  }
  return null;
}

function getComponentName(type: unknown): string {
  if (type == null) return 'Unknown';
  if (typeof type === 'string') return type;
  if (typeof type === 'function') {
    const fn = type as { displayName?: string; name?: string };
    return fn.displayName || fn.name || 'Anonymous';
  }
  if (typeof type === 'object') {
    const obj = type as { displayName?: string; name?: string };
    return obj.displayName || obj.name || 'Anonymous';
  }
  return 'Unknown';
}

function getComponentKind(type: unknown): ComponentKind {
  if (typeof type === 'function') {
    // Heuristic: class components have a prototype with render method.
    const proto = (type as { prototype?: { render?: unknown } }).prototype;
    if (proto && typeof proto.render === 'function') return 'class';
    return 'function';
  }
  return 'unknown';
}

// ─── Serialization ──────────────────────────────────────────────────

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

function serializeProps(props: unknown): Record<string, SerializedValue> {
  if (props == null || typeof props !== 'object') return {};
  const out: Record<string, SerializedValue> = {};
  for (const [key, val] of Object.entries(props as Record<string, unknown>)) {
    if (key === 'children') {
      out[key] = { type: 'object', keys: [], preview: '<children>' };
      continue;
    }
    try {
      out[key] = serialize(val);
    } catch (err) {
      out[key] = { type: 'error', message: (err as Error).message };
    }
  }
  return out;
}

// ─── Walks ──────────────────────────────────────────────────────────

function findChildComponentVNodes(vnode: VNode, max = 50): VNode[] {
  const out: VNode[] = [];
  function visit(v: VNode | null): void {
    if (!v || out.length >= max) return;
    // A VNode is a "component" if its type is a function (component or class)
    if (typeof v.type === 'function' && (v.__c || v._component)) {
      out.push(v);
      return; // don't descend further — only direct children
    }
    for (const child of childrenOf(v)) visit(child);
  }
  for (const child of childrenOf(vnode)) visit(child);
  return out;
}

function nearestComponentParent(vnode: VNode, max = 10): VNode[] {
  const chain: VNode[] = [];
  let cur = parentOf(vnode);
  while (cur && chain.length < max) {
    if (typeof cur.type === 'function' && (cur.__c || cur._component)) {
      chain.push(cur);
    }
    cur = parentOf(cur);
  }
  return chain;
}

function rectFromElement(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, width: r.width, height: r.height };
}

function vnodeBoundingRect(vnode: VNode): Rect {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let found = false;

  function visit(v: VNode | null): void {
    if (!v) return;
    const dom = domOf(v);
    if (dom instanceof Element && typeof v.type === 'string') {
      const r = dom.getBoundingClientRect();
      if (r.width > 0 || r.height > 0) {
        minX = Math.min(minX, r.left);
        minY = Math.min(minY, r.top);
        maxX = Math.max(maxX, r.right);
        maxY = Math.max(maxY, r.bottom);
        found = true;
      }
      return;
    }
    for (const child of childrenOf(v)) visit(child);
  }
  visit(vnode);

  if (!found) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// ─── Registry ───────────────────────────────────────────────────────

const vnodeRegistry = new Map<string, WeakRef<VNode>>();
let registryCounter = 0;

function registerVNode(vnode: VNode): string {
  for (const [id, ref] of vnodeRegistry) {
    if (ref.deref() === vnode) return id;
  }
  const id = `p${++registryCounter}`;
  vnodeRegistry.set(id, new WeakRef(vnode));
  if (vnodeRegistry.size > 200) {
    const firstKey = vnodeRegistry.keys().next().value;
    if (firstKey) vnodeRegistry.delete(firstKey);
  }
  return id;
}

function lookupVNode(id: string): VNode | null {
  const ref = vnodeRegistry.get(id);
  if (!ref) return null;
  const vnode = ref.deref();
  if (!vnode) {
    vnodeRegistry.delete(id);
    return null;
  }
  return vnode;
}

function vnodeToRef(vnode: VNode): ComponentRef {
  return {
    fiberId: registerVNode(vnode),
    name: getComponentName(vnode.type),
    kind: getComponentKind(vnode.type),
    source: sourceOf(vnode),
  };
}

// ─── Public adapter object ──────────────────────────────────────────

export const preactAdapter: FrameworkAdapter = {
  name: 'Preact',

  recognizes(el: Element): boolean {
    return nearestPreactComponent(el) !== null;
  },

  inspect(el: Element): ComponentInfo | null {
    const found = nearestPreactComponent(el);
    if (!found) return null;
    const { vnode, component } = found;

    const childVNodes = findChildComponentVNodes(vnode);
    const parentChain = nearestComponentParent(vnode, 10);
    const parentVNode = parentChain[0] ?? null;

    return {
      fiberId: registerVNode(vnode),
      name: getComponentName(vnode.type),
      kind: getComponentKind(vnode.type),
      source: sourceOf(vnode),
      props: serializeProps(component.props),
      ownerChain: parentChain.map<OwnerInfo>((v) => ({
        name: getComponentName(v.type),
        kind: getComponentKind(v.type),
        source: sourceOf(v),
      })),
      parent: parentVNode ? vnodeToRef(parentVNode) : null,
      children: childVNodes.map(vnodeToRef),
      domTag: el.tagName.toLowerCase(),
      rect: rectFromElement(el),
    };
  },

  preview(el: Element): ComponentPreview {
    const found = nearestPreactComponent(el);
    const elementId = el.id || '';
    const className = el.getAttribute('class') ?? '';

    if (!found) {
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

    const { vnode, component } = found;
    const propNames = component.props ? Object.keys(component.props).filter((k) => k !== 'children') : [];
    const owners = nearestComponentParent(vnode, 5).map((v) => getComponentName(v.type));
    const children = findChildComponentVNodes(vnode, 8).map((v) => getComponentName(v.type));

    return {
      name: getComponentName(vnode.type),
      kind: getComponentKind(vnode.type),
      rect: rectFromElement(el),
      domTag: el.tagName.toLowerCase(),
      source: sourceOf(vnode),
      propNames,
      parentName: owners[0] ?? null,
      childrenNames: children,
      ownerNames: owners,
      elementId,
      className,
    };
  },

  resolveById(id: string): Element | null {
    const vnode = lookupVNode(id);
    if (!vnode) return null;
    const dom = domOf(vnode);
    if (dom) return dom;
    // Walk children to find first DOM
    for (const child of childrenOf(vnode)) {
      const cdom = domOf(child);
      if (cdom) return cdom;
    }
    return null;
  },

  componentRect(el: Element): Rect {
    const found = nearestPreactComponent(el);
    if (!found) return rectFromElement(el);
    const r = vnodeBoundingRect(found.vnode);
    return r.width > 0 ? r : rectFromElement(el);
  },

  findInstancesOfSameType(el: Element): Rect[] {
    const found = nearestPreactComponent(el);
    if (!found) return [];
    const targetType = found.vnode.type;
    const rects: Rect[] = [];
    const seen = new Set<VNode>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let node: Node | null = walker.currentNode;
    while (node) {
      if (node instanceof Element) {
        const comp = getComponentFromElement(node);
        const v = comp ? vnodeOf(comp) : null;
        if (v && !seen.has(v) && v.type === targetType) {
          seen.add(v);
          const r = vnodeBoundingRect(v);
          if (r.width > 0 || r.height > 0) rects.push(r);
        }
      }
      node = walker.nextNode();
    }
    return rects;
  },

  version(): string | null {
    return null;
  },
};
