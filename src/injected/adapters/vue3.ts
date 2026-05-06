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
 * Vue 3 adapter.
 *
 * Detection: a host element rendered by a Vue 3 component carries a
 * `__vueParentComponent` ref pointing at the ComponentInternalInstance.
 * (Vue 3 sets this on every DOM node it controls.)
 *
 * What we surface:
 *   - name: `type.__name` (SFC compiled by @vitejs/plugin-vue), `type.name`
 *           (manual), or function `name` for functional components
 *   - kind: 'composition' (setup() used) or 'options'
 *   - source: `type.__file` (absolute path; vue-loader / plugin-vue dev only)
 *   - props: instance.props (Vue's resolved/proxied props)
 *           PLUS instance.setupState (Composition API refs/computed,
 *           auto-unwrapped) — merged into one Props section so the panel
 *           UI doesn't need a Vue-specific code path.
 *           Plus instance.data (Options API data) when present.
 *   - parent: instance.parent
 *   - children: walk instance.subTree to find direct child components
 *   - ownerChain: parent chain (Vue has no _debugOwner equivalent)
 *
 * Render-counter hook is not implemented in Phase 2 (Vue's reactivity
 * is per-effect, no single commit hook). Could plug into the
 * `__VUE_DEVTOOLS_GLOBAL_HOOK__` events in a later wave.
 */

// ─── Vue 3 internal types (subset) ──────────────────────────────────

type VNode = {
  type: unknown;
  component: ComponentInternalInstance | null;
  children: VNode[] | string | null;
  el: Element | null;
};

type ComponentInternalInstance = {
  uid: number;
  type: ComponentDefinition;
  parent: ComponentInternalInstance | null;
  props: Record<string, unknown>;
  setupState: Record<string, unknown> | null;
  data: Record<string, unknown> | null;
  vnode: VNode;
  subTree: VNode | null;
  isMounted: boolean;
};

type ComponentDefinition = {
  __name?: string;       // set by @vitejs/plugin-vue compile
  __file?: string;       // absolute path, dev only
  name?: string;         // explicit name in defineComponent({ name })
  setup?: unknown;       // presence indicates Composition API
  data?: unknown;        // presence indicates Options API
  render?: unknown;
};

declare global {
  interface Element {
    __vueParentComponent?: ComponentInternalInstance;
    __vue_app__?: unknown;
  }
}

const VUE_REF_FLAG = '__v_isRef';

// ─── Detection / walking ────────────────────────────────────────────

function getInstance(el: Element): ComponentInternalInstance | null {
  return el.__vueParentComponent ?? null;
}

function nearestVueComponent(el: Element): ComponentInternalInstance | null {
  let cur: Element | null = el;
  while (cur) {
    const inst = getInstance(cur);
    if (inst) return inst;
    cur = cur.parentElement;
  }
  return null;
}

function getComponentName(def: ComponentDefinition | unknown): string {
  if (def == null) return 'Anonymous';
  if (typeof def === 'function') {
    const fn = def as { displayName?: string; name?: string };
    return fn.displayName || fn.name || 'Anonymous';
  }
  if (typeof def === 'object') {
    const obj = def as ComponentDefinition;
    return obj.__name || obj.name || 'Anonymous';
  }
  return 'Anonymous';
}

function getComponentKind(def: ComponentDefinition | unknown): ComponentKind {
  if (typeof def === 'function') return 'function';
  if (def && typeof def === 'object') {
    const obj = def as ComponentDefinition;
    if (obj.setup) return 'composition';
    if (obj.data || obj.render) return 'options';
  }
  return 'unknown';
}

function getComponentSource(def: ComponentDefinition | unknown): SourceLocation | null {
  if (def && typeof def === 'object') {
    const obj = def as ComponentDefinition;
    if (obj.__file) return { fileName: obj.__file };
  }
  return null;
}

// ─── Reactivity unwrap ──────────────────────────────────────────────

function isRef(value: unknown): value is { value: unknown; [VUE_REF_FLAG]: true } {
  return Boolean(value && typeof value === 'object' && (value as Record<string, unknown>)[VUE_REF_FLAG] === true);
}

function unwrap(value: unknown): unknown {
  if (isRef(value)) return value.value;
  return value;
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

function serialize(rawValue: unknown, depth = 0, seen = new WeakSet<object>()): SerializedValue {
  const value = unwrap(rawValue);
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

function serializeRecord(record: Record<string, unknown> | null | undefined): Record<string, SerializedValue> {
  const out: Record<string, SerializedValue> = {};
  if (!record) return out;
  let keys: string[];
  try {
    keys = Object.keys(record);
  } catch {
    return out;
  }
  for (const key of keys) {
    if (key.startsWith('__v_')) continue; // skip Vue internal flags
    if (key.startsWith('$')) continue;     // skip $-prefixed instance properties
    try {
      out[key] = serialize(record[key]);
    } catch (err) {
      out[key] = { type: 'error', message: (err as Error).message };
    }
  }
  return out;
}

function mergedProps(instance: ComponentInternalInstance): Record<string, SerializedValue> {
  // Vue 3 components expose props (declared), setupState (Composition API
  // refs/computed), and data (Options API). Merge into one Props section so
  // the panel UI is identical across frameworks. Internal flags filtered out.
  return {
    ...serializeRecord(instance.props),
    ...serializeRecord(instance.setupState),
    ...serializeRecord(instance.data),
  };
}

// ─── Walks ──────────────────────────────────────────────────────────

function walkChildComponents(vnode: VNode | null, out: ComponentInternalInstance[], max: number): void {
  if (!vnode || out.length >= max) return;
  if (vnode.component) {
    out.push(vnode.component);
    return; // Don't descend into a component's own subtree — only direct children.
  }
  if (Array.isArray(vnode.children)) {
    for (const child of vnode.children) {
      if (out.length >= max) return;
      walkChildComponents(child, out, max);
    }
  }
}

function findChildComponents(instance: ComponentInternalInstance, max = 50): ComponentInternalInstance[] {
  const out: ComponentInternalInstance[] = [];
  walkChildComponents(instance.subTree, out, max);
  return out;
}

function walkParentChain(instance: ComponentInternalInstance, max: number): OwnerInfo[] {
  const chain: OwnerInfo[] = [];
  let cur: ComponentInternalInstance | null = instance.parent;
  while (cur && chain.length < max) {
    chain.push({
      name: getComponentName(cur.type),
      kind: getComponentKind(cur.type),
      source: getComponentSource(cur.type),
      fiberId: registerInstance(cur),
    });
    cur = cur.parent;
  }
  return chain;
}

function firstHostElement(instance: ComponentInternalInstance): Element | null {
  if (instance.vnode.el) return instance.vnode.el;
  // Walk subTree to find first element
  function walk(vnode: VNode | null): Element | null {
    if (!vnode) return null;
    if (vnode.el) return vnode.el;
    if (Array.isArray(vnode.children)) {
      for (const child of vnode.children) {
        const found = walk(child);
        if (found) return found;
      }
    }
    return null;
  }
  return walk(instance.subTree);
}

function rectFromElement(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, width: r.width, height: r.height };
}

function instanceBoundingRect(instance: ComponentInternalInstance): Rect {
  // Vue exposes a single root `el` for the component (or fragment children).
  // We compute the union of all top-level host elements in the subTree.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let found = false;

  function visit(vnode: VNode | null): void {
    if (!vnode) return;
    if (vnode.el instanceof Element) {
      const r = vnode.el.getBoundingClientRect();
      if (r.width > 0 || r.height > 0) {
        minX = Math.min(minX, r.left);
        minY = Math.min(minY, r.top);
        maxX = Math.max(maxX, r.right);
        maxY = Math.max(maxY, r.bottom);
        found = true;
      }
      return;
    }
    if (Array.isArray(vnode.children)) {
      for (const child of vnode.children) visit(child);
    }
  }
  visit(instance.subTree);

  if (!found) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// ─── Registry ───────────────────────────────────────────────────────

const instanceRegistry = new Map<string, WeakRef<ComponentInternalInstance>>();
let registryCounter = 0;

function registerInstance(instance: ComponentInternalInstance): string {
  for (const [id, ref] of instanceRegistry) {
    if (ref.deref() === instance) return id;
  }
  const id = `v${++registryCounter}`;
  instanceRegistry.set(id, new WeakRef(instance));
  if (instanceRegistry.size > 200) {
    const firstKey = instanceRegistry.keys().next().value;
    if (firstKey) instanceRegistry.delete(firstKey);
  }
  return id;
}

function lookupInstance(id: string): ComponentInternalInstance | null {
  const ref = instanceRegistry.get(id);
  if (!ref) return null;
  const instance = ref.deref();
  if (!instance || !instance.isMounted) {
    instanceRegistry.delete(id);
    return null;
  }
  return instance;
}

function instanceToRef(instance: ComponentInternalInstance): ComponentRef {
  return {
    fiberId: registerInstance(instance),
    name: getComponentName(instance.type),
    kind: getComponentKind(instance.type),
    source: getComponentSource(instance.type),
  };
}

// ─── Public adapter object ──────────────────────────────────────────

export const vue3Adapter: FrameworkAdapter = {
  name: 'Vue 3',

  recognizes(el: Element): boolean {
    return nearestVueComponent(el) !== null;
  },

  inspect(el: Element): ComponentInfo | null {
    const instance = nearestVueComponent(el);
    if (!instance) return null;
    const children = findChildComponents(instance);
    return {
      fiberId: registerInstance(instance),
      name: getComponentName(instance.type),
      kind: getComponentKind(instance.type),
      source: getComponentSource(instance.type),
      props: mergedProps(instance),
      ownerChain: walkParentChain(instance, 10),
      parent: instance.parent ? instanceToRef(instance.parent) : null,
      children: children.map(instanceToRef),
      domTag: el.tagName.toLowerCase(),
      rect: rectFromElement(el),
    };
  },

  preview(el: Element): ComponentPreview {
    const instance = nearestVueComponent(el);
    const elementId = el.id || '';
    const className = el.getAttribute('class') ?? '';

    if (!instance) {
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

    const propNames = [
      ...Object.keys(instance.props ?? {}),
      ...Object.keys(instance.setupState ?? {}).filter((k) => !k.startsWith('__v_') && !k.startsWith('$')),
    ];
    const owners = walkParentChain(instance, 5).map((o) => o.name);
    const children = findChildComponents(instance, 8).map((c) => getComponentName(c.type));

    return {
      name: getComponentName(instance.type),
      kind: getComponentKind(instance.type),
      rect: rectFromElement(el),
      domTag: el.tagName.toLowerCase(),
      source: getComponentSource(instance.type),
      propNames,
      parentName: instance.parent ? getComponentName(instance.parent.type) : null,
      childrenNames: children,
      ownerNames: owners,
      elementId,
      className,
    };
  },

  resolveById(id: string): Element | null {
    const instance = lookupInstance(id);
    if (!instance) return null;
    return firstHostElement(instance);
  },

  componentRect(el: Element): Rect {
    const instance = nearestVueComponent(el);
    if (!instance) return rectFromElement(el);
    const r = instanceBoundingRect(instance);
    return r.width > 0 ? r : rectFromElement(el);
  },

  findInstancesOfSameType(el: Element): Rect[] {
    const target = nearestVueComponent(el);
    if (!target) return [];
    const targetType = target.type;
    const rects: Rect[] = [];
    const seen = new Set<ComponentInternalInstance>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let node: Node | null = walker.currentNode;
    while (node) {
      if (node instanceof Element) {
        const inst = getInstance(node);
        if (inst && !seen.has(inst) && inst.type === targetType) {
          seen.add(inst);
          const r = instanceBoundingRect(inst);
          if (r.width > 0 || r.height > 0) rects.push(r);
        }
      }
      node = walker.nextNode();
    }
    return rects;
  },

  version(): string | null {
    // Vue 3 doesn't expose a stable version property on a per-page basis;
    // the global hook can but is opt-in. Return null for now.
    return null;
  },
};

