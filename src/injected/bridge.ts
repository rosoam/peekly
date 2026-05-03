// Runs in MAIN world (page context). Orchestrator over framework adapters.
// All framework-specific logic lives in src/injected/adapters/*.

import { RP_NAMESPACE } from '../shared/messages';
import type {
  BridgeMessage,
  ComponentInfo,
  ComponentPreview,
  FindFiberRectRequest,
  FindFiberRectResponse,
  FindInstancesRequest,
  FindInstancesResponse,
  HoverRequest,
  HoverResponse,
  InspectByIdRequest,
  InspectRequest,
  InspectResponse,
  ReactDetected,
  RenderTickEvent,
  SubscribeRendersRequest,
  UnsubscribeRendersRequest,
} from '../shared/messages';
import { initNetworkCapture } from '../net/capture';
import { alpineAdapter } from './adapters/alpine';
import { litAdapter } from './adapters/lit';
import { livewireAdapter } from './adapters/livewire';
import { plainDomAdapter } from './adapters/plain-dom';
import { preactAdapter } from './adapters/preact';
import { reactAdapter } from './adapters/react';
import { twigAdapter } from './adapters/twig';
import type { AdapterChain, FrameworkAdapter } from './adapters/types';
import { vue3Adapter } from './adapters/vue3';

const TARGET_ATTR = 'data-rp-target';
const CURRENT_ATTR = 'data-rp-current';

// ─── Adapter chain ──────────────────────────────────────────────────
//
// Order matters: more specific frameworks first, the universal Plain DOM
// fallback last. New adapters slot in before plain-dom.

const adapters: AdapterChain = [
  // Component-tree JS frameworks first, in rough order of probe specificity.
  // React goes before Preact because preact/compat sets fiber-shaped keys that
  // the React adapter happily reads.
  reactAdapter,
  preactAdapter,
  vue3Adapter,
  // PHP-side reactive frameworks
  livewireAdapter,
  // Web Components (native + Lit)
  litAdapter,
  // Lighter behavioral frameworks — tried before Twig because their probes are
  // cheaper (single property access vs comment-tree walk).
  alpineAdapter,
  // Server-rendered template attribution (Symfony/Twig with debug comments).
  // Comes after Alpine so that an x-data scope inside a Twig template is
  // attributed to Alpine (richer data) rather than Twig.
  twigAdapter,
  // Future: vue2Adapter, stimulusAdapter, angularAdapter, …
  plainDomAdapter,
];

for (const a of adapters) a.init?.();

function adapterFor(el: Element): FrameworkAdapter {
  for (const a of adapters) {
    if (a.recognizes(el)) return a;
  }
  // The Plain DOM adapter recognizes everything, so we never reach here, but
  // TypeScript wants a return path.
  return plainDomAdapter;
}

// ─── Element-by-id resolver: tries each adapter ──────────────────────
//
// Component reference IDs are namespaced by their first character (`r` for
// React fibers, `d` for plain DOM elements, etc.) so the lookup is O(1)
// against the right adapter, but we fall back to scanning all adapters in
// case of unknown prefixes.

function resolveElementByRefId(id: string): { el: Element; adapter: FrameworkAdapter } | null {
  for (const a of adapters) {
    const el = a.resolveById(id);
    if (el) return { el, adapter: a };
  }
  return null;
}

// ─── data-rp-current tagging ─────────────────────────────────────────
//
// After every inspect we tag the inspected element with data-rp-current so
// the content script can find it back from the response (used for the
// computed-styles / Tailwind / a11y sections of the panel which need a live
// Element ref, not just data).

function tagCurrent(el: Element, refId: string): void {
  document.querySelectorAll(`[${CURRENT_ATTR}]`).forEach((node) => {
    if (node !== el) node.removeAttribute(CURRENT_ATTR);
  });
  el.setAttribute(CURRENT_ATTR, refId);
}

function findTargetElement(selector: string): Element | null {
  return document.querySelector(`[${TARGET_ATTR}="${CSS.escape(selector)}"]`);
}

// ─── Request handlers ───────────────────────────────────────────────

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
    const adapter = adapterFor(el);
    const preview: ComponentPreview = adapter.preview(el);
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
    const adapter = adapterFor(el);
    let info: ComponentInfo | null = adapter.inspect(el);
    // If a framework adapter recognizes the element but couldn't produce info
    // (rare — e.g. fragment with no enclosing component), fall through to plain DOM.
    if (!info && adapter !== plainDomAdapter) {
      info = plainDomAdapter.inspect(el);
    }
    if (!info) {
      respond({ ok: false, error: 'Could not inspect element' });
      return;
    }
    tagCurrent(el, info.fiberId);
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
    const resolved = resolveElementByRefId(req.fiberId);
    if (!resolved) {
      respond({ ok: false, error: 'Component no longer exists (unmounted?)' });
      return;
    }
    const info = resolved.adapter.inspect(resolved.el);
    if (!info) {
      respond({ ok: false, error: 'Could not re-inspect element' });
      return;
    }
    tagCurrent(resolved.el, info.fiberId);
    respond({ ok: true, data: info });
  } catch (err) {
    respond({ ok: false, error: (err as Error).message });
  }
}

function handleFindFiberRect(req: FindFiberRectRequest): void {
  const respond = (payload: Omit<FindFiberRectResponse, 'source' | 'kind' | 'requestId'>): void => {
    const msg: FindFiberRectResponse = {
      source: RP_NAMESPACE,
      kind: 'find-fiber-rect-response',
      requestId: req.requestId,
      ...payload,
    };
    window.postMessage(msg, '*');
  };
  try {
    const resolved = resolveElementByRefId(req.fiberId);
    if (!resolved) {
      respond({ ok: false, rect: null, error: 'Component not found' });
      return;
    }
    const rect = resolved.adapter.componentRect(resolved.el);
    if (rect.width <= 0 || rect.height <= 0) {
      respond({ ok: false, rect: null, error: 'Component has no rendered DOM' });
      return;
    }
    respond({ ok: true, rect });
  } catch (err) {
    respond({ ok: false, rect: null, error: (err as Error).message });
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
    const resolved = resolveElementByRefId(req.fiberId);
    if (!resolved) {
      respond({ ok: false, rects: [], error: 'Component not found' });
      return;
    }
    const rects = resolved.adapter.findInstancesOfSameType(resolved.el);
    respond({ ok: true, rects });
  } catch (err) {
    respond({ ok: false, rects: [], error: (err as Error).message });
  }
}

// ─── Render subscriptions (currently React-only) ────────────────────

const activeSubscriptions = new Map<string, () => void>();

function handleSubscribeRenders(req: SubscribeRendersRequest): void {
  if (activeSubscriptions.has(req.fiberId)) return;
  const resolved = resolveElementByRefId(req.fiberId);
  if (!resolved || !resolved.adapter.subscribeRenders) return;
  const unsubscribe = resolved.adapter.subscribeRenders(req.fiberId, (count, when) => {
    const msg: RenderTickEvent = {
      source: RP_NAMESPACE,
      kind: 'render-tick',
      fiberId: req.fiberId,
      count,
      lastRenderAt: when,
    };
    window.postMessage(msg, '*');
  });
  activeSubscriptions.set(req.fiberId, unsubscribe);
}

function handleUnsubscribeRenders(req: UnsubscribeRendersRequest): void {
  const unsubscribe = activeSubscriptions.get(req.fiberId);
  if (unsubscribe) {
    unsubscribe();
    activeSubscriptions.delete(req.fiberId);
  }
}

// ─── React detection ping (for popup status, future use) ────────────

function postReactDetection(): void {
  const version = reactAdapter.version();
  const detected =
    version !== null ||
    (document.querySelector('*') !== null && reactAdapter.recognizes(document.body));
  const msg: ReactDetected = {
    source: RP_NAMESPACE,
    kind: 'react-detected',
    detected,
    version: version ?? undefined,
  };
  window.postMessage(msg, '*');
}

// ─── Listener ───────────────────────────────────────────────────────

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
        handleSubscribeRenders(data as SubscribeRendersRequest);
        break;
      case 'unsubscribe-renders':
        handleUnsubscribeRenders(data as UnsubscribeRendersRequest);
        break;
      case 'find-instances-request':
        handleFindInstances(data as FindInstancesRequest);
        break;
      case 'find-fiber-rect-request':
        handleFindFiberRect(data as FindFiberRectRequest);
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

initNetworkCapture();
