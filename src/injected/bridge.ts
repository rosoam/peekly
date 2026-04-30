// Runs in MAIN world (page context). Has access to React internals.
import { RP_NAMESPACE } from '../shared/messages';
import type {
  BridgeMessage,
  ComponentInfo,
  ComponentKind,
  ComponentPreview,
  ComponentRef,
  FindInstancesRequest,
  FindInstancesResponse,
  HoverRequest,
  HoverResponse,
  InspectByIdRequest,
  InspectRequest,
  InspectResponse,
  OwnerInfo,
  ReactDetected,
  Rect,
  RenderTickEvent,
  SerializedValue,
  SourceLocation,
  SubscribeRendersRequest,
  UnsubscribeRendersRequest,
} from '../shared/messages';

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
  renderers?: Map<number, { version?: string; findFiberByHostInstance?: (n: Element) => Fiber | null }>;
  inject?: (renderer: unknown) => number;
  onCommitFiberRoot?: (
    rendererID: number,
    root: { current: Fiber },
    priorityLevel?: unknown,
    didError?: boolean,
  ) => void;
  onCommitFiberUnmount?: (rendererID: number, fiber: Fiber) => void;
  onPostCommitFiberRoot?: (rendererID: number, root: { current: Fiber }) => void;
  rp_originalOnCommit?: DevtoolsHook['onCommitFiberRoot'];
};

declare global {
  interface Window {
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: DevtoolsHook;
  }
}

const FIBER_KEY_PREFIX = '__reactFiber$';
const LEGACY_FIBER_KEY_PREFIX = '__reactInternalInstance$';
const TARGET_ATTR = 'data-rp-target';
const CURRENT_ATTR = 'data-rp-current';

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

// ─── DevTools hook installation (BEFORE React loads) ─────────────────

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

const devHook = installDevtoolsHook();

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
  let current: Fiber | null = fiber;
  while (current) {
    if (isComponentFiber(current)) return current;
    current = current.return;
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
      $$typeof?: symbol;
    };
    if (obj.displayName) return obj.displayName;
    if (obj.render) {
      return obj.render.displayName || obj.render.name || 'ForwardRef';
    }
    if (obj.type) return getComponentName(obj.type);
    return 'Anonymous';
  }
  return 'Unknown';
}

function extractSource(fiber: Fiber): SourceLocation | null {
  if (fiber._debugSource) {
    return {
      fileName: fiber._debugSource.fileName,
      lineNumber: fiber._debugSource.lineNumber,
      columnNumber: fiber._debugSource.columnNumber,
    };
  }
  return null;
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

// Detect inline arrow / anonymous functions: `name === ''` or single-letter minified.
function isInlineFn(fn: unknown): boolean {
  if (typeof fn !== 'function') return false;
  const name = (fn as { name?: string }).name;
  if (!name) return true;
  if (name.length <= 2) return true;
  if (name.startsWith('bound ')) return true;
  return false;
}

function serialize(value: unknown, depth = 0, seen = new WeakSet<object>()): SerializedValue {
  if (depth > 2) {
    if (value && typeof value === 'object') {
      return {
        type: 'object',
        keys: Object.keys(value).slice(0, 10),
        preview: previewObject(value),
      };
    }
  }
  if (value === null) return { type: 'primitive', value: null };
  if (value === undefined) return { type: 'undefined' };
  const t = typeof value;
  if (t === 'string') {
    const s = value as string;
    return { type: 'primitive', value: s.length > 200 ? s.slice(0, 200) + '…' : s };
  }
  if (t === 'number' || t === 'boolean') {
    return { type: 'primitive', value: value as number | boolean };
  }
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
        return {
          type: 'array',
          length: obj.length,
          preview: `Array(${obj.length})`,
        };
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
  let current: Fiber | null = fiber._debugOwner ?? fiber.return ?? null;
  while (current && chain.length < max) {
    if (isComponentFiber(current)) {
      chain.push({
        name: getComponentName(current.type),
        kind: fiberKind(current),
        source: extractSource(current),
      });
    }
    current = current._debugOwner ?? current.return ?? null;
  }
  return chain;
}

// Walks a fiber subtree, unions host descendants' rects.
function fiberBoundingRect(fiber: Fiber): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
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

// Walk the immediate component children (skip host wrappers).
function findChildComponentFibers(fiber: Fiber, max = 50): Fiber[] {
  const out: Fiber[] = [];
  function visit(f: Fiber | null): void {
    if (!f || out.length >= max) return;
    if (isComponentFiber(f)) {
      out.push(f);
      // Don't descend into a component's subtree — we only want immediate children.
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
  let current: Fiber | null = fiber.return;
  while (current) {
    if (isComponentFiber(current)) return current;
    current = current.return;
  }
  return null;
}

// ─── Fiber registry (id-based references) ────────────────────────────

const fiberRegistry = new Map<string, WeakRef<Fiber>>();
let fiberRegistryCounter = 0;

function registerFiber(fiber: Fiber): string {
  // Use existing id if we already registered this fiber recently.
  for (const [id, ref] of fiberRegistry) {
    if (ref.deref() === fiber) return id;
  }
  const id = `f${++fiberRegistryCounter}`;
  fiberRegistry.set(id, new WeakRef(fiber));
  // Cap registry size
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

// ─── React detection ─────────────────────────────────────────────────

function detectReact(): { detected: boolean; version?: string } {
  if (devHook.renderers && devHook.renderers.size > 0) {
    try {
      const first = devHook.renderers.values().next().value;
      return { detected: true, version: first?.version };
    } catch {
      return { detected: true };
    }
  }
  const scan = document.querySelector('*');
  if (scan && getFiberFromNode(scan)) return { detected: true };
  return { detected: false };
}

// ─── Inspect / hover / find ──────────────────────────────────────────

function previewFromElement(el: Element): ComponentPreview | null {
  const rawFiber = getFiberFromNode(el);
  if (!rawFiber) return null;
  const componentFiber = nearestComponentFiber(rawFiber);
  if (!componentFiber) {
    return {
      name: el.tagName.toLowerCase(),
      kind: 'host',
      rect: rectFromElement(el),
      domTag: el.tagName.toLowerCase(),
    };
  }
  const rect = fiberBoundingRect(componentFiber);
  return {
    name: getComponentName(componentFiber.type),
    kind: fiberKind(componentFiber),
    rect: rect.width > 0 ? rect : rectFromElement(el),
    domTag: el.tagName.toLowerCase(),
  };
}

function tagFiberHost(fiber: Fiber, fiberId: string): void {
  document.querySelectorAll(`[${CURRENT_ATTR}]`).forEach((el) => el.removeAttribute(CURRENT_ATTR));
  const stack: Fiber[] = [fiber];
  while (stack.length > 0) {
    const f = stack.pop()!;
    if (f.tag === FIBER_TAG.HostComponent && f.stateNode instanceof Element) {
      (f.stateNode as Element).setAttribute(CURRENT_ATTR, fiberId);
      return;
    }
    if (f.child) stack.push(f.child);
    if (f.sibling) stack.push(f.sibling);
  }
}

function inspectFiber(fiber: Fiber, domTag: string, fallbackEl?: Element): ComponentInfo {
  const rect = fiberBoundingRect(fiber);
  const parent = findParentComponentFiber(fiber);
  const children = findChildComponentFibers(fiber);
  const fiberId = registerFiber(fiber);
  tagFiberHost(fiber, fiberId);
  return {
    fiberId,
    name: getComponentName(fiber.type),
    kind: fiberKind(fiber),
    source: extractSource(fiber),
    props: serializeProps(fiber.memoizedProps),
    ownerChain: extractOwnerChain(fiber),
    parent: parent ? fiberToRef(parent) : null,
    children: children.map(fiberToRef),
    domTag,
    rect: rect.width > 0 ? rect : fallbackEl ? rectFromElement(fallbackEl) : rect,
  };
}

function inspectElement(el: Element): ComponentInfo | null {
  const rawFiber = getFiberFromNode(el);
  if (!rawFiber) return null;
  const componentFiber = nearestComponentFiber(rawFiber);
  if (!componentFiber) {
    return {
      fiberId: '',
      name: el.tagName.toLowerCase(),
      kind: 'host',
      source: null,
      props: {},
      ownerChain: [],
      parent: null,
      children: [],
      domTag: el.tagName.toLowerCase(),
      rect: rectFromElement(el),
    };
  }
  return inspectFiber(componentFiber, el.tagName.toLowerCase(), el);
}

function findTargetElement(selector: string): Element | null {
  return document.querySelector(`[${TARGET_ATTR}="${CSS.escape(selector)}"]`);
}

// ─── Find all instances of a component type ──────────────────────────

function findInstancesOfType(targetType: unknown): Rect[] {
  const rects: Rect[] = [];
  if (!devHook.renderers) return rects;
  for (const renderer of devHook.renderers.values()) {
    // Collect all component fibers matching targetType, then their rects.
    // We do this by walking from any host root we can find.
    void renderer;
  }
  // Fallback approach: scan all DOM nodes with a fiber, walk up to component, match type.
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  const seen = new Set<Fiber>();
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
}

// ─── Render counter (commit hook) ────────────────────────────────────

const subscribed = new Map<string, { count: number; type: unknown }>();
let lastCommitAt = 0;

function setupCommitHook(): void {
  const original = devHook.onCommitFiberRoot;
  devHook.rp_originalOnCommit = original;
  devHook.onCommitFiberRoot = function (id, root, prio, didError) {
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
setupCommitHook();

function processCommit(rootFiber: Fiber): void {
  if (subscribed.size === 0) return;
  lastCommitAt = Date.now();
  const counts = new Map<string, number>();
  // Initialize current counts
  for (const [id, info] of subscribed) {
    counts.set(id, info.count);
  }
  // Walk the fiber tree, increment counts whose type matches a tracked type.
  const stack: Fiber[] = [rootFiber];
  let visited = 0;
  while (stack.length > 0 && visited < 5000) {
    const f = stack.pop()!;
    visited++;
    if (isComponentFiber(f)) {
      for (const [id, info] of subscribed) {
        if (info.type === f.type) {
          counts.set(id, (counts.get(id) ?? 0) + 1);
        }
      }
    }
    if (f.child) stack.push(f.child);
    if (f.sibling) stack.push(f.sibling);
  }
  // Emit ticks for changed counts
  for (const [id, info] of subscribed) {
    const next = counts.get(id) ?? info.count;
    if (next !== info.count) {
      info.count = next;
      const msg: RenderTickEvent = {
        source: RP_NAMESPACE,
        kind: 'render-tick',
        fiberId: id,
        count: next,
        lastRenderAt: lastCommitAt,
      };
      window.postMessage(msg, '*');
    }
  }
}

function subscribeRenders(fiberId: string): void {
  const fiber = lookupFiber(fiberId);
  if (!fiber) return;
  if (subscribed.has(fiberId)) return;
  subscribed.set(fiberId, { count: 0, type: fiber.type });
}

function unsubscribeRenders(fiberId: string): void {
  subscribed.delete(fiberId);
}

// ─── Message handling ────────────────────────────────────────────────

function handleHoverRequest(req: HoverRequest): void {
  const respond = (payload: Omit<HoverResponse, 'source' | 'kind' | 'requestId'>): void => {
    const msg: HoverResponse = {
      source: RP_NAMESPACE,
      kind: 'hover-response',
      requestId: req.requestId,
      ...payload,
    };
    window.postMessage(msg, '*');
  };
  try {
    const el = findTargetElement(req.selector);
    if (!el) {
      respond({ ok: false, error: 'not-found' });
      return;
    }
    const preview = previewFromElement(el);
    if (!preview) {
      respond({
        ok: true,
        preview: {
          name: el.tagName.toLowerCase(),
          kind: 'host',
          rect: rectFromElement(el),
          domTag: el.tagName.toLowerCase(),
        },
      });
      return;
    }
    respond({ ok: true, preview });
  } catch (err) {
    respond({ ok: false, error: (err as Error).message });
  }
}

function handleInspectRequest(req: InspectRequest): void {
  const respond = (payload: Omit<InspectResponse, 'source' | 'kind' | 'requestId'>): void => {
    const msg: InspectResponse = {
      source: RP_NAMESPACE,
      kind: 'inspect-response',
      requestId: req.requestId,
      ...payload,
    };
    window.postMessage(msg, '*');
  };
  try {
    const el = findTargetElement(req.selector);
    if (!el) {
      respond({ ok: false, error: 'Target element not found' });
      return;
    }
    const info = inspectElement(el);
    if (!info) {
      respond({ ok: false, error: 'No React fiber attached to this element' });
      return;
    }
    respond({ ok: true, data: info });
  } catch (err) {
    respond({ ok: false, error: (err as Error).message });
  }
}

function handleInspectByIdRequest(req: InspectByIdRequest): void {
  const respond = (payload: Omit<InspectResponse, 'source' | 'kind' | 'requestId'>): void => {
    const msg: InspectResponse = {
      source: RP_NAMESPACE,
      kind: 'inspect-response',
      requestId: req.requestId,
      ...payload,
    };
    window.postMessage(msg, '*');
  };
  try {
    const fiber = lookupFiber(req.fiberId);
    if (!fiber) {
      respond({ ok: false, error: 'Fiber no longer exists (component unmounted?)' });
      return;
    }
    const info = inspectFiber(fiber, '');
    respond({ ok: true, data: info });
  } catch (err) {
    respond({ ok: false, error: (err as Error).message });
  }
}

function handleFindInstances(req: FindInstancesRequest): void {
  const respond = (payload: Omit<FindInstancesResponse, 'source' | 'kind' | 'requestId'>): void => {
    const msg: FindInstancesResponse = {
      source: RP_NAMESPACE,
      kind: 'find-instances-response',
      requestId: req.requestId,
      ...payload,
    };
    window.postMessage(msg, '*');
  };
  try {
    const fiber = lookupFiber(req.fiberId);
    if (!fiber) {
      respond({ ok: false, rects: [], error: 'Fiber not found' });
      return;
    }
    const rects = findInstancesOfType(fiber.type);
    respond({ ok: true, rects });
  } catch (err) {
    respond({ ok: false, rects: [], error: (err as Error).message });
  }
}

function postReactDetection(): void {
  const status = detectReact();
  const msg: ReactDetected = {
    source: RP_NAMESPACE,
    kind: 'react-detected',
    detected: status.detected,
    version: status.version,
  };
  window.postMessage(msg, '*');
}

function listen(): void {
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data as Partial<BridgeMessage> | null;
    if (!data || data.source !== RP_NAMESPACE) return;
    switch (data.kind) {
      case 'inspect-request':
        handleInspectRequest(data as InspectRequest);
        break;
      case 'inspect-by-id-request':
        handleInspectByIdRequest(data as InspectByIdRequest);
        break;
      case 'hover-request':
        handleHoverRequest(data as HoverRequest);
        break;
      case 'subscribe-renders':
        subscribeRenders((data as SubscribeRendersRequest).fiberId);
        break;
      case 'unsubscribe-renders':
        unsubscribeRenders((data as UnsubscribeRendersRequest).fiberId);
        break;
      case 'find-instances-request':
        handleFindInstances(data as FindInstancesRequest);
        break;
      default:
        break;
    }
  });
}

listen();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', postReactDetection, { once: true });
} else {
  postReactDetection();
}
setTimeout(postReactDetection, 1500);
