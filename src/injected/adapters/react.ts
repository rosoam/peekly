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

// ─── React fiber types (subset) ─────────────────────────────────────

type Fiber = {
  type: unknown;
  tag: number;
  stateNode: unknown;
  memoizedProps: unknown;
  memoizedState: unknown;
  child: Fiber | null;
  sibling: Fiber | null;
  return: Fiber | null;
  alternate: Fiber | null;
  _debugSource?: { fileName: string; lineNumber?: number; columnNumber?: number };
  _debugOwner?: Fiber | null;
};

type DevtoolsHook = {
  supportsFiber?: boolean;
  renderers?: Map<number, { version?: string }>;
  inject?: (renderer: unknown) => number;
  onCommitFiberRoot?: (
    rendererID: number,
    root: { current: Fiber },
    priorityLevel?: unknown,
    didError?: boolean,
  ) => void;
  onCommitFiberUnmount?: (rendererID: number, fiber: Fiber) => void;
  onPostCommitFiberRoot?: (rendererID: number, root: { current: Fiber }) => void;
};

declare global {
  interface Window {
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: DevtoolsHook;
  }
}

const FIBER_KEY_PREFIX = '__reactFiber$';
const LEGACY_FIBER_KEY_PREFIX = '__reactInternalInstance$';

const FIBER_TAG = {
  FunctionComponent: 0,
  ClassComponent: 1,
  HostRoot: 3,
  HostComponent: 5,
  HostText: 6,
  Fragment: 7,
  ForwardRef: 11,
  Memo: 14,
  SimpleMemo: 15,
  Lazy: 16,
} as const;

// ─── Hook installation (runs at module load via init()) ──────────────

function installDevtoolsHook(): DevtoolsHook {
  const existing = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (existing) return existing;
  const hook: DevtoolsHook = {
    supportsFiber: true,
    renderers: new Map(),
    inject(renderer) {
      const id = (this.renderers!.size as number) + 1;
      this.renderers!.set(id, renderer as { version?: string });
      return id;
    },
    onCommitFiberRoot() {},
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
  };
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = hook;
  return hook;
}

// ─── Fiber utilities ─────────────────────────────────────────────────

function getFiberFromNode(node: Element): Fiber | null {
  for (const key of Object.keys(node)) {
    if (key.startsWith(FIBER_KEY_PREFIX) || key.startsWith(LEGACY_FIBER_KEY_PREFIX)) {
      return (node as unknown as Record<string, Fiber>)[key];
    }
  }
  return null;
}

function isComponentFiber(fiber: Fiber): boolean {
  return (
    fiber.tag === FIBER_TAG.FunctionComponent ||
    fiber.tag === FIBER_TAG.ClassComponent ||
    fiber.tag === FIBER_TAG.ForwardRef ||
    fiber.tag === FIBER_TAG.Memo ||
    fiber.tag === FIBER_TAG.SimpleMemo
  );
}

function nearestComponentFiber(fiber: Fiber | null): Fiber | null {
  let cur: Fiber | null = fiber;
  while (cur) {
    if (isComponentFiber(cur)) return cur;
    cur = cur.return;
  }
  return null;
}

function fiberKind(fiber: Fiber): ComponentKind {
  switch (fiber.tag) {
    case FIBER_TAG.FunctionComponent:
      return 'function';
    case FIBER_TAG.ClassComponent:
      return 'class';
    case FIBER_TAG.ForwardRef:
      return 'forwardRef';
    case FIBER_TAG.Memo:
    case FIBER_TAG.SimpleMemo:
      return 'memo';
    case FIBER_TAG.Lazy:
      return 'lazy';
    case FIBER_TAG.HostComponent:
      return 'host';
    default:
      return 'unknown';
  }
}

function getComponentName(type: unknown): string {
  if (type == null) return 'Unknown';
  if (typeof type === 'string') return type;
  if (typeof type === 'function') {
    const fn = type as { displayName?: string; name?: string };
    return fn.displayName || fn.name || 'Anonymous';
  }
  if (typeof type === 'object') {
    const obj = type as {
      displayName?: string;
      render?: { displayName?: string; name?: string };
      type?: unknown;
    };
    if (obj.displayName) return obj.displayName;
    if (obj.render) return obj.render.displayName || obj.render.name || 'ForwardRef';
    if (obj.type) return getComponentName(obj.type);
    return 'Anonymous';
  }
  return 'Unknown';
}

function extractSource(fiber: Fiber): SourceLocation | null {
  if (!fiber._debugSource) return null;
  return {
    fileName: fiber._debugSource.fileName,
    lineNumber: fiber._debugSource.lineNumber,
    columnNumber: fiber._debugSource.columnNumber,
  };
}

// ─── Serialization ────────────────────────────────────────────────────

const REACT_ELEMENT_TYPE = Symbol.for('react.element');
const TRANSITIONAL_ELEMENT_TYPE = Symbol.for('react.transitional.element');

function isReactElement(value: unknown): value is { type: unknown; $$typeof: symbol } {
  if (value == null || typeof value !== 'object') return false;
  const $$typeof = (value as { $$typeof?: symbol }).$$typeof;
  return $$typeof === REACT_ELEMENT_TYPE || $$typeof === TRANSITIONAL_ELEMENT_TYPE;
}

function previewObject(obj: object, maxKeys = 5): string {
  const keys = Object.keys(obj).slice(0, maxKeys);
  const more = Object.keys(obj).length > maxKeys ? `, +${Object.keys(obj).length - maxKeys}` : '';
  return `{ ${keys.join(', ')}${more} }`;
}

function isInlineFn(fn: unknown): boolean {
  if (typeof fn !== 'function') return false;
  const name = (fn as { name?: string }).name;
  if (!name) return true;
  if (name.length <= 2) return true;
  if (name.startsWith('bound ')) return true;
  return false;
}

function serialize(value: unknown, depth = 0, seen = new WeakSet<object>()): SerializedValue {
  if (depth > 2 && value && typeof value === 'object') {
    return {
      type: 'object',
      keys: Object.keys(value).slice(0, 10),
      preview: previewObject(value),
    };
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
      if (isReactElement(obj)) {
        return { type: 'react-element', name: getComponentName((obj as { type: unknown }).type) };
      }
      if (Array.isArray(obj)) {
        return { type: 'array', length: obj.length, preview: `Array(${obj.length})` };
      }
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
    try {
      out[key] = serialize(val);
    } catch (err) {
      out[key] = { type: 'error', message: (err as Error).message };
    }
  }
  return out;
}

function extractOwnerChain(fiber: Fiber, max = 10): OwnerInfo[] {
  const chain: OwnerInfo[] = [];
  let cur: Fiber | null = fiber._debugOwner ?? fiber.return ?? null;
  while (cur && chain.length < max) {
    if (isComponentFiber(cur)) {
      chain.push({
        name: getComponentName(cur.type),
        kind: fiberKind(cur),
        source: extractSource(cur),
        fiberId: registerFiber(cur),
      });
    }
    cur = cur._debugOwner ?? cur.return ?? null;
  }
  return chain;
}

function fiberBoundingRect(fiber: Fiber): Rect {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let found = false;
  function visit(f: Fiber | null): void {
    if (!f) return;
    if (f.tag === FIBER_TAG.HostComponent && f.stateNode instanceof Element) {
      const r = (f.stateNode as Element).getBoundingClientRect();
      if (r.width > 0 || r.height > 0) {
        minX = Math.min(minX, r.left);
        minY = Math.min(minY, r.top);
        maxX = Math.max(maxX, r.right);
        maxY = Math.max(maxY, r.bottom);
        found = true;
      }
      return;
    }
    visit(f.child);
    visit(f.sibling);
  }
  visit(fiber.child);
  if (!found) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function rectFromElement(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, width: r.width, height: r.height };
}

function findChildComponentFibers(fiber: Fiber, max = 50): Fiber[] {
  const out: Fiber[] = [];
  function visit(f: Fiber | null): void {
    if (!f || out.length >= max) return;
    if (isComponentFiber(f)) {
      out.push(f);
      visit(f.sibling);
      return;
    }
    visit(f.child);
    visit(f.sibling);
  }
  visit(fiber.child);
  return out;
}

function findParentComponentFiber(fiber: Fiber): Fiber | null {
  let cur: Fiber | null = fiber.return;
  while (cur) {
    if (isComponentFiber(cur)) return cur;
    cur = cur.return;
  }
  return null;
}

// ─── Fiber registry ──────────────────────────────────────────────────

const fiberRegistry = new Map<string, WeakRef<Fiber>>();
let fiberRegistryCounter = 0;

function registerFiber(fiber: Fiber): string {
  for (const [id, ref] of fiberRegistry) {
    if (ref.deref() === fiber) return id;
  }
  const id = `r${++fiberRegistryCounter}`;
  fiberRegistry.set(id, new WeakRef(fiber));
  if (fiberRegistry.size > 200) {
    const firstKey = fiberRegistry.keys().next().value;
    if (firstKey) fiberRegistry.delete(firstKey);
  }
  return id;
}

function lookupFiber(id: string): Fiber | null {
  const ref = fiberRegistry.get(id);
  if (!ref) return null;
  const fiber = ref.deref();
  if (!fiber) {
    fiberRegistry.delete(id);
    return null;
  }
  return fiber;
}

function fiberToRef(fiber: Fiber): ComponentRef {
  return {
    fiberId: registerFiber(fiber),
    name: getComponentName(fiber.type),
    kind: fiberKind(fiber),
    source: extractSource(fiber),
  };
}

function fiberFirstHostElement(fiber: Fiber): Element | null {
  const stack: Fiber[] = [fiber];
  while (stack.length > 0) {
    const f = stack.pop()!;
    if (f.tag === FIBER_TAG.HostComponent && f.stateNode instanceof Element) {
      return f.stateNode as Element;
    }
    if (f.child) stack.push(f.child);
    if (f.sibling) stack.push(f.sibling);
  }
  return null;
}

// ─── Render counter (commit hook) ────────────────────────────────────

const subscribed = new Map<string, { count: number; type: unknown; cb: (count: number, when: number) => void }>();

function setupCommitHook(hook: DevtoolsHook): void {
  const original = hook.onCommitFiberRoot;
  hook.onCommitFiberRoot = function (id, root, prio, didError) {
    try {
      processCommit(root.current);
    } catch {
      // never throw from a hook
    }
    if (original) {
      try {
        original.call(this, id, root, prio, didError);
      } catch {
        // ignore
      }
    }
  };
}

function processCommit(rootFiber: Fiber): void {
  if (subscribed.size === 0) return;
  const now = Date.now();
  const counts = new Map<string, number>();
  for (const [id, info] of subscribed) counts.set(id, info.count);
  const stack: Fiber[] = [rootFiber];
  let visited = 0;
  while (stack.length > 0 && visited < 5000) {
    const f = stack.pop()!;
    visited += 1;
    if (isComponentFiber(f)) {
      for (const [id, info] of subscribed) {
        if (info.type === f.type) counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    if (f.child) stack.push(f.child);
    if (f.sibling) stack.push(f.sibling);
  }
  for (const [id, info] of subscribed) {
    const next = counts.get(id) ?? info.count;
    if (next !== info.count) {
      info.count = next;
      info.cb(next, now);
    }
  }
}

// ─── Public adapter object ──────────────────────────────────────────

let devHook: DevtoolsHook | null = null;

export const reactAdapter: FrameworkAdapter = {
  name: 'React',

  init(): void {
    devHook = installDevtoolsHook();
    setupCommitHook(devHook);
  },

  recognizes(el: Element): boolean {
    return getFiberFromNode(el) !== null;
  },

  inspect(el: Element): ComponentInfo | null {
    const rawFiber = getFiberFromNode(el);
    if (!rawFiber) return null;
    const componentFiber = nearestComponentFiber(rawFiber);
    if (!componentFiber) {
      // Element has a fiber but no enclosing component (unusual, e.g. host inside HostRoot).
      return null;
    }
    const parent = findParentComponentFiber(componentFiber);
    const children = findChildComponentFibers(componentFiber);
    return {
      fiberId: registerFiber(componentFiber),
      name: getComponentName(componentFiber.type),
      kind: fiberKind(componentFiber),
      source: extractSource(componentFiber),
      props: serializeProps(componentFiber.memoizedProps),
      ownerChain: extractOwnerChain(componentFiber),
      parent: parent ? fiberToRef(parent) : null,
      children: children.map(fiberToRef),
      domTag: el.tagName.toLowerCase(),
      rect: rectFromElement(el),
    };
  },

  preview(el: Element): ComponentPreview {
    const rawFiber = getFiberFromNode(el);
    const componentFiber = rawFiber ? nearestComponentFiber(rawFiber) : null;
    const elementId = el.id || '';
    const className = el.getAttribute('class') ?? '';

    if (!componentFiber) {
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

    const props = componentFiber.memoizedProps;
    const propNames =
      props && typeof props === 'object' ? Object.keys(props as Record<string, unknown>) : [];
    const parent = findParentComponentFiber(componentFiber);
    const children = findChildComponentFibers(componentFiber, 8);
    const owners = extractOwnerChain(componentFiber, 5);

    return {
      name: getComponentName(componentFiber.type),
      kind: fiberKind(componentFiber),
      rect: rectFromElement(el),
      domTag: el.tagName.toLowerCase(),
      source: extractSource(componentFiber),
      propNames,
      parentName: parent ? getComponentName(parent.type) : null,
      childrenNames: children.map((c) => getComponentName(c.type)),
      ownerNames: owners.map((o) => o.name),
      elementId,
      className,
    };
  },

  resolveById(id: string): Element | null {
    const fiber = lookupFiber(id);
    if (!fiber) return null;
    return fiberFirstHostElement(fiber);
  },

  componentRect(el: Element): Rect {
    const rawFiber = getFiberFromNode(el);
    const componentFiber = rawFiber ? nearestComponentFiber(rawFiber) : null;
    if (!componentFiber) return rectFromElement(el);
    const r = fiberBoundingRect(componentFiber);
    return r.width > 0 ? r : rectFromElement(el);
  },

  findInstancesOfSameType(el: Element): Rect[] {
    const rawFiber = getFiberFromNode(el);
    const componentFiber = rawFiber ? nearestComponentFiber(rawFiber) : null;
    if (!componentFiber) return [];
    const targetType = componentFiber.type;
    const rects: Rect[] = [];
    const seen = new Set<Fiber>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let node: Node | null = walker.currentNode;
    while (node) {
      if (node instanceof Element) {
        const f = getFiberFromNode(node);
        if (f) {
          const comp = nearestComponentFiber(f);
          if (comp && !seen.has(comp) && comp.type === targetType) {
            seen.add(comp);
            const r = fiberBoundingRect(comp);
            if (r.width > 0 || r.height > 0) rects.push(r);
          }
        }
      }
      node = walker.nextNode();
    }
    return rects;
  },

  subscribeRenders(refId: string, onTick: (count: number, when: number) => void): () => void {
    const fiber = lookupFiber(refId);
    if (!fiber) return () => undefined;
    if (subscribed.has(refId)) return () => subscribed.delete(refId);
    subscribed.set(refId, { count: 0, type: fiber.type, cb: onTick });
    return () => {
      subscribed.delete(refId);
    };
  },

  version(): string | null {
    if (!devHook?.renderers) return null;
    try {
      const first = devHook.renderers.values().next().value;
      return first?.version ?? null;
    } catch {
      return null;
    }
  },
};
