// Runs in ISOLATED world. Talks to bridge.ts (MAIN world) via window.postMessage.
import {
  DEFAULT_SETTINGS,
  RP_NAMESPACE,
  SETTINGS_KEY,
} from '../shared/messages';
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
  NetRequestMessage,
  Rect,
  RenderTickEvent,
  Settings,
  SubscribeRendersRequest,
  UnsubscribeRendersRequest,
} from '../shared/messages';
import { addRequest, getState } from '../net/store';
import type { RequestEntry } from '../net/types';
import { overlayCss } from './styles';
import { renderNetPanel } from './net-panel';
import type { NetPanelHandle } from './net-panel';
import {
  type PanelHandle,
  renderPanel,
  showToast,
} from './panel';
import { type TooltipState, createTooltip } from './tooltip';

const TARGET_ATTR = 'data-rp-target';

type State = {
  settings: Settings;
  hoverEl: Element | null;
  reactDetected: boolean;
  reactVersion?: string;
  isTopFrame: boolean;
  currentEl: Element | null;
  currentFiberId: string | null;
  panelHandle: PanelHandle | null;
  panelPos: { x: number; y: number } | null;
  outlineMode: boolean;
  netPanelOpen: boolean;
  netPanelHandle: NetPanelHandle | null;
};

const isTopFrame = window === window.top;

const state: State = {
  settings: { ...DEFAULT_SETTINGS },
  hoverEl: null,
  reactDetected: false,
  isTopFrame,
  currentEl: null,
  currentFiberId: null,
  panelHandle: null,
  panelPos: null,
  outlineMode: false,
  netPanelOpen: false,
  netPanelHandle: null,
};

function isLocalhostHost(): boolean {
  const host = window.location.hostname;
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '[::1]' ||
    host === '::1' ||
    host.endsWith('.localhost')
  );
}

function isPickerEnabled(): boolean {
  if (state.settings.enabled) return true;
  if (state.settings.autoOnLocalhost && isLocalhostHost()) return true;
  return false;
}

const host = document.createElement('div');
host.id = 'react-picker-host';
host.style.cssText =
  'all: initial; position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;';
const shadow = host.attachShadow({ mode: 'closed' });
const style = document.createElement('style');
style.textContent = overlayCss;
shadow.append(style);

const highlight = document.createElement('div');
highlight.className = 'highlight';
const label = document.createElement('div');
label.className = 'label';
highlight.append(label);
shadow.append(highlight);

// Box model overlay — visualises content area (purple) and margin wings (orange).
const boxModelLayer = document.createElement('div');
boxModelLayer.className = 'bm-layer';
function makeBmEl(cls: string): [HTMLElement, HTMLElement] {
  const el = document.createElement('div');
  el.className = cls;
  const lbl = document.createElement('span');
  lbl.className = 'bm-label';
  el.append(lbl);
  return [el, lbl];
}
const [bmContent, bmContentLabel] = makeBmEl('bm-content');
const [bmMarginTop, bmMarginTopLabel] = makeBmEl('bm-margin');
const [bmMarginRight, bmMarginRightLabel] = makeBmEl('bm-margin');
const [bmMarginBottom, bmMarginBottomLabel] = makeBmEl('bm-margin');
const [bmMarginLeft, bmMarginLeftLabel] = makeBmEl('bm-margin');
boxModelLayer.append(bmContent, bmMarginTop, bmMarginRight, bmMarginBottom, bmMarginLeft);
shadow.append(boxModelLayer);

// Container for "highlight all instances" multi-overlay.
const instancesLayer = document.createElement('div');
instancesLayer.className = 'instances-layer';
shadow.append(instancesLayer);

// Container for outline-mode component boundaries.
const outlineLayer = document.createElement('div');
outlineLayer.className = 'outline-layer';
shadow.append(outlineLayer);

// Transient preview highlight: shows the DOM bounds of a navigation chip's
// target component when the user hovers it inside the panel.
const previewHighlight = document.createElement('div');
previewHighlight.className = 'preview-highlight';
shadow.append(previewHighlight);

// Contextual tooltip (y + x hover).
// Forward-declared because the tooltip's navigate/preview callbacks need to
// reach into module-level helpers defined later (e.g. requestHover, showPreviewHighlight).
function navigateTooltipToElement(target: Element): void {
  tooltipTargetEl = target;
  tooltip.setPinned(true);
  // Show synchronous preview from DOM right away
  tooltip.update({ preview: previewFromCache(target), targetEl: target, cursor: null });
  // Then refine with bridge data
  void requestHover(target).then((res) => {
    if (tooltipTargetEl !== target) return;
    if (res.ok && res.preview) {
      tooltip.update({ preview: res.preview, targetEl: target, cursor: null });
    }
  });
  // Paint amber preview around the new target so the user sees where they navigated
  const r = target.getBoundingClientRect();
  showPreviewHighlight({ x: r.left, y: r.top, width: r.width, height: r.height });
  lastPreviewedFiberId = `tooltip-nav-${Math.random().toString(36).slice(2)}`;
  // Auto-fade after 2.5s (user's eye has caught up by then)
  window.setTimeout(() => {
    if (tooltipTargetEl === target) clearPreviewHighlight();
  }, 2500);
}

function previewElementInPage(target: Element | null): void {
  if (!target) {
    clearPreviewHighlight();
    lastPreviewedFiberId = null;
    return;
  }
  const r = target.getBoundingClientRect();
  showPreviewHighlight({ x: r.left, y: r.top, width: r.width, height: r.height });
  lastPreviewedFiberId = `tooltip-hover-${Math.random().toString(36).slice(2)}`;
}

const tooltip: TooltipState = createTooltip(shadow, {
  onNavigateToElement: navigateTooltipToElement,
  onPreviewElement: previewElementInPage,
  onCopyText: (text) => {
    void navigator.clipboard.writeText(text).then(
      () => showToast(shadow, 'Copied'),
      () => showToast(shadow, 'Copy failed'),
    );
  },
});

function attachHost(): void {
  if (host.isConnected) return;
  if (document.documentElement) {
    document.documentElement.append(host);
  } else {
    document.addEventListener(
      'DOMContentLoaded',
      () => document.documentElement.append(host),
      { once: true },
    );
  }
}

function showBoxModel(el: Element): void {
  if (!(el instanceof HTMLElement)) { clearBoxModel(); return; }
  const cs = window.getComputedStyle(el);
  const r = el.getBoundingClientRect();

  const pt = parseFloat(cs.paddingTop) || 0;
  const pr = parseFloat(cs.paddingRight) || 0;
  const pb = parseFloat(cs.paddingBottom) || 0;
  const pl = parseFloat(cs.paddingLeft) || 0;
  const mt = parseFloat(cs.marginTop) || 0;
  const mr = parseFloat(cs.marginRight) || 0;
  const mb = parseFloat(cs.marginBottom) || 0;
  const ml = parseFloat(cs.marginLeft) || 0;
  const bt = parseFloat(cs.borderTopWidth) || 0;
  const br_w = parseFloat(cs.borderRightWidth) || 0;
  const bb = parseFloat(cs.borderBottomWidth) || 0;
  const bl = parseFloat(cs.borderLeftWidth) || 0;

  const classes = (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);

  // Find the most specific Tailwind class responsible for a given margin/padding side.
  function sideClass(side: 't' | 'r' | 'b' | 'l', prop: 'p' | 'm'): string | null {
    const axis = (side === 't' || side === 'b') ? 'y' : 'x';
    for (const prefix of [`${prop}${side}-`, `${prop}${axis}-`, `${prop}-`]) {
      const found = classes.find((c) => {
        const base = c.replace(/^[a-z0-9-]+:/, '');
        return base.startsWith(prefix) || base.startsWith(`-${prefix}`);
      });
      if (found) return found;
    }
    return null;
  }

  function applyWing(
    wingEl: HTMLElement, lbl: HTMLElement,
    x: number, y: number, w: number, h: number,
    text: string,
  ): void {
    if (w > 0 && h > 0) {
      wingEl.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px;display:block`;
      lbl.textContent = (w >= 16 && h >= 12) ? text : '';
    } else {
      wingEl.style.display = 'none';
      lbl.textContent = '';
    }
  }

  // Content box: sits inside border + padding edges.
  const cw = r.width - bl - br_w - pl - pr;
  const ch = r.height - bt - bb - pt - pb;
  if (cw > 0 && ch > 0 && (pt > 0 || pr > 0 || pb > 0 || pl > 0)) {
    bmContent.style.cssText = `left:${r.left + bl + pl}px;top:${r.top + bt + pt}px;width:${cw}px;height:${ch}px;display:block`;
    if (cw >= 16 && ch >= 12) {
      // Prefer a single generic `p-*` class; fall back to computed shorthand.
      const padCls = classes.find((c) => /^(?:[a-z0-9-]+:)?-?p-/.test(c));
      if (padCls) {
        bmContentLabel.textContent = padCls;
      } else {
        const vals = [pt, pr, pb, pl].map((v) => `${Math.round(v)}px`);
        if (vals[0] === vals[1] && vals[1] === vals[2] && vals[2] === vals[3]) {
          bmContentLabel.textContent = vals[0]!;
        } else if (vals[0] === vals[2] && vals[1] === vals[3]) {
          bmContentLabel.textContent = `${vals[0]} ${vals[1]}`;
        } else {
          bmContentLabel.textContent = `${vals[0]} ${vals[1]} ${vals[2]} ${vals[3]}`;
        }
      }
    } else {
      bmContentLabel.textContent = '';
    }
  } else {
    bmContent.style.display = 'none';
    bmContentLabel.textContent = '';
  }

  applyWing(bmMarginTop, bmMarginTopLabel, r.left, r.top - mt, r.width, mt,
    sideClass('t', 'm') ?? `${Math.round(mt)}px`);
  applyWing(bmMarginBottom, bmMarginBottomLabel, r.left, r.bottom, r.width, mb,
    sideClass('b', 'm') ?? `${Math.round(mb)}px`);
  applyWing(bmMarginLeft, bmMarginLeftLabel, r.left - ml, r.top - mt, ml, r.height + mt + mb,
    sideClass('l', 'm') ?? `${Math.round(ml)}px`);
  applyWing(bmMarginRight, bmMarginRightLabel, r.right, r.top - mt, mr, r.height + mt + mb,
    sideClass('r', 'm') ?? `${Math.round(mr)}px`);
}

function clearBoxModel(): void {
  bmContent.style.display = 'none';
  bmMarginTop.style.display = 'none';
  bmMarginRight.style.display = 'none';
  bmMarginBottom.style.display = 'none';
  bmMarginLeft.style.display = 'none';
}

function setHighlightFromRect(rect: Rect | null, labelText: string | null, altIsDown: boolean): void {
  if (!rect || !altIsDown || !isPickerEnabled()) {
    highlight.style.display = 'none';
    clearBoxModel();
    return;
  }
  highlight.style.display = 'block';
  highlight.style.left = `${rect.x}px`;
  highlight.style.top = `${rect.y}px`;
  highlight.style.width = `${rect.width}px`;
  highlight.style.height = `${rect.height}px`;
  label.textContent = labelText ?? '';
  label.style.display = labelText ? 'inline-block' : 'none';
}

function clearHighlight(): void {
  highlight.style.display = 'none';
  clearBoxModel();
  state.hoverEl = null;
}

function isInsideHost(target: EventTarget | null): boolean {
  if (!(target instanceof Node)) return false;
  return host.contains(target);
}

function elementUnderCursor(x: number, y: number): Element | null {
  const prev = host.style.pointerEvents;
  host.style.pointerEvents = 'none';

  let el = document.elementFromPoint(x, y);

  // Targeted fix for overlay text / dialog content that uses `pointer-events: none`
  // for design reasons: hit-testing skips them, so we land on the parent card / backdrop.
  // We walk elementsFromPoint and prefer a deeper element ONLY when it is opted out of
  // hit-testing AND visually contains the point. This keeps normal cases (button > span)
  // unchanged because regular elements don't have pointer-events: none.
  const stack = document.elementsFromPoint?.(x, y) ?? [];
  if (stack.length > 1) {
    let best: Element | null = null;
    let bestDepth = el ? depthOf(el) : -1;
    for (const cand of stack) {
      if (host.contains(cand)) continue;
      if (cand === document.documentElement || cand === document.body) continue;
      if (cand === el) continue;
      const cs = window.getComputedStyle(cand);
      if (cs.pointerEvents !== 'none') continue;
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const r = cand.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
      const d = depthOf(cand);
      if (d > bestDepth) {
        best = cand;
        bestDepth = d;
      }
    }
    if (best) el = best;
  }

  // Pierce open shadow DOMs (web components) so we target the deepest real
  // element rather than the shadow host.
  let depth = 0;
  while (el && el.shadowRoot && depth < 16) {
    const inner = el.shadowRoot.elementFromPoint?.(x, y);
    if (!inner || inner === el) break;
    el = inner;
    depth += 1;
  }
  host.style.pointerEvents = prev;
  if (!el) return null;
  if (host.contains(el)) return null;
  return el;
}

function depthOf(el: Element): number {
  let d = 0;
  let cur: Element | null = el;
  while (cur && cur.parentElement) {
    cur = cur.parentElement;
    d++;
  }
  return d;
}

function clearPanel(): void {
  if (state.currentFiberId) {
    const msg: UnsubscribeRendersRequest = {
      source: RP_NAMESPACE,
      kind: 'unsubscribe-renders',
      fiberId: state.currentFiberId,
    };
    window.postMessage(msg, '*');
  }
  state.currentFiberId = null;
  state.currentEl = null;
  state.panelHandle = null;
  shadow.querySelector('.panel')?.remove();
  clearInstancesHighlight();
  clearPreviewHighlight();
  lastPreviewedFiberId = null;
}

const pendingInspects = new Map<string, (res: InspectResponse) => void>();
const pendingHovers = new Map<string, (res: HoverResponse) => void>();
const pendingInstances = new Map<string, (res: FindInstancesResponse) => void>();
const pendingFiberRects = new Map<string, (res: FindFiberRectResponse) => void>();

function newId(): string {
  return Math.random().toString(36).slice(2);
}

function tagElement(el: Element, id: string): void {
  el.setAttribute(TARGET_ATTR, id);
}

function untagElement(el: Element): void {
  el.removeAttribute(TARGET_ATTR);
}

function requestInspect(el: Element): Promise<InspectResponse> {
  const id = newId();
  tagElement(el, id);
  const req: InspectRequest = {
    source: RP_NAMESPACE,
    kind: 'inspect-request',
    requestId: id,
    selector: id,
  };
  window.postMessage(req, '*');
  return new Promise<InspectResponse>((resolve) => {
    const timeout = window.setTimeout(() => {
      pendingInspects.delete(id);
      untagElement(el);
      resolve({
        source: RP_NAMESPACE,
        kind: 'inspect-response',
        requestId: id,
        ok: false,
        error: 'Bridge did not respond (React not present?)',
      });
    }, 1500);
    pendingInspects.set(id, (res) => {
      window.clearTimeout(timeout);
      untagElement(el);
      resolve(res);
    });
  });
}

function requestInspectById(fiberId: string): Promise<InspectResponse> {
  const id = newId();
  const req: InspectByIdRequest = {
    source: RP_NAMESPACE,
    kind: 'inspect-by-id-request',
    requestId: id,
    fiberId,
  };
  window.postMessage(req, '*');
  return new Promise<InspectResponse>((resolve) => {
    const timeout = window.setTimeout(() => {
      pendingInspects.delete(id);
      resolve({
        source: RP_NAMESPACE,
        kind: 'inspect-response',
        requestId: id,
        ok: false,
        error: 'Bridge did not respond',
      });
    }, 1500);
    pendingInspects.set(id, (res) => {
      window.clearTimeout(timeout);
      resolve(res);
    });
  });
}

function requestHover(el: Element): Promise<HoverResponse> {
  const id = newId();
  tagElement(el, id);
  const req: HoverRequest = {
    source: RP_NAMESPACE,
    kind: 'hover-request',
    requestId: id,
    selector: id,
  };
  window.postMessage(req, '*');
  return new Promise<HoverResponse>((resolve) => {
    const timeout = window.setTimeout(() => {
      pendingHovers.delete(id);
      untagElement(el);
      resolve({
        source: RP_NAMESPACE,
        kind: 'hover-response',
        requestId: id,
        ok: false,
        error: 'timeout',
      });
    }, 800);
    pendingHovers.set(id, (res) => {
      window.clearTimeout(timeout);
      untagElement(el);
      resolve(res);
    });
  });
}

function requestFindInstances(fiberId: string): Promise<FindInstancesResponse> {
  const id = newId();
  const req: FindInstancesRequest = {
    source: RP_NAMESPACE,
    kind: 'find-instances-request',
    requestId: id,
    fiberId,
  };
  window.postMessage(req, '*');
  return new Promise<FindInstancesResponse>((resolve) => {
    const timeout = window.setTimeout(() => {
      pendingInstances.delete(id);
      resolve({
        source: RP_NAMESPACE,
        kind: 'find-instances-response',
        requestId: id,
        ok: false,
        rects: [],
        error: 'timeout',
      });
    }, 1500);
    pendingInstances.set(id, (res) => {
      window.clearTimeout(timeout);
      resolve(res);
    });
  });
}

function requestFiberRect(fiberId: string): Promise<FindFiberRectResponse> {
  const id = newId();
  const req: FindFiberRectRequest = {
    source: RP_NAMESPACE,
    kind: 'find-fiber-rect-request',
    requestId: id,
    fiberId,
  };
  window.postMessage(req, '*');
  return new Promise<FindFiberRectResponse>((resolve) => {
    const timeout = window.setTimeout(() => {
      pendingFiberRects.delete(id);
      resolve({
        source: RP_NAMESPACE,
        kind: 'find-fiber-rect-response',
        requestId: id,
        ok: false,
        rect: null,
        error: 'timeout',
      });
    }, 800);
    pendingFiberRects.set(id, (res) => {
      window.clearTimeout(timeout);
      resolve(res);
    });
  });
}

// ─── Preview highlight (chip hover) ──────────────────────────────────

let lastPreviewedFiberId: string | null = null;

function showPreviewHighlight(rect: Rect): void {
  previewHighlight.style.display = 'block';
  previewHighlight.style.left = `${rect.x}px`;
  previewHighlight.style.top = `${rect.y}px`;
  previewHighlight.style.width = `${rect.width}px`;
  previewHighlight.style.height = `${rect.height}px`;
}

function clearPreviewHighlight(): void {
  previewHighlight.style.display = 'none';
}

function previewChip(fiberId: string | null): void {
  lastPreviewedFiberId = fiberId;
  if (!fiberId) {
    clearPreviewHighlight();
    return;
  }
  void requestFiberRect(fiberId).then((res) => {
    if (lastPreviewedFiberId !== fiberId) return;
    if (res.ok && res.rect) showPreviewHighlight(res.rect);
    else clearPreviewHighlight();
  });
}

function applyPreview(preview: ComponentPreview, altIsDown: boolean): void {
  // Show both the component identity and the actual DOM tag so the user
  // immediately sees what they're hovering AND which component it belongs to.
  const labelText =
    preview.kind === 'host'
      ? `<${preview.domTag}>`
      : `${preview.name} · <${preview.domTag}>`;
  setHighlightFromRect(preview.rect, labelText, altIsDown);
}

let lastHoverEl: Element | null = null;
let hoverTimer: number | null = null;

function scheduleHover(el: Element, altIsDown: boolean): void {
  if (lastHoverEl === el) return;
  lastHoverEl = el;
  if (hoverTimer != null) window.clearTimeout(hoverTimer);
  const rect = el.getBoundingClientRect();
  setHighlightFromRect(
    { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
    `<${el.tagName.toLowerCase()}>`,
    altIsDown,
  );
  hoverTimer = window.setTimeout(() => {
    hoverTimer = null;
    if (lastHoverEl !== el) return;
    void requestHover(el).then((res) => {
      if (lastHoverEl !== el) return;
      if (res.ok && res.preview) {
        applyPreview(res.preview, altIsDown);
        // Refresh tooltip with the rich bridge data, if it's currently showing this element.
        if (tooltipTargetEl === el && (tooltip.isPinned() || tooltip.el.style.display !== 'none')) {
          tooltip.update({ preview: res.preview, targetEl: el, cursor: null });
        }
      }
    });
  }, 30);
}

// ─── Instances highlight ─────────────────────────────────────────────

function clearInstancesHighlight(): void {
  instancesLayer.replaceChildren();
}

function showInstancesHighlight(rects: Rect[]): void {
  clearInstancesHighlight();
  const fragment = document.createDocumentFragment();
  for (const r of rects) {
    const box = document.createElement('div');
    box.className = 'instance-box';
    box.style.left = `${r.x}px`;
    box.style.top = `${r.y}px`;
    box.style.width = `${r.width}px`;
    box.style.height = `${r.height}px`;
    fragment.append(box);
  }
  instancesLayer.append(fragment);
}

async function toggleInstancesHighlight(): Promise<void> {
  if (instancesLayer.children.length > 0) {
    clearInstancesHighlight();
    return;
  }
  if (!state.currentFiberId) return;
  const res = await requestFindInstances(state.currentFiberId);
  if (res.ok) {
    showInstancesHighlight(res.rects);
    showToast(shadow, `${res.rects.length} instance${res.rects.length !== 1 ? 's' : ''} highlighted`);
    window.setTimeout(clearInstancesHighlight, 4000);
  }
}

// ─── Outline mode ────────────────────────────────────────────────────

function clearOutlineLayer(): void {
  outlineLayer.replaceChildren();
}

function renderOutlines(): void {
  clearOutlineLayer();
  const fragment = document.createDocumentFragment();
  // We outline every distinct component fiber by sampling DOM elements.
  // Sample limited to first 250 fiber-tagged elements to avoid jank.
  const seen = new WeakSet<object>();
  const elements = document.querySelectorAll('*');
  let count = 0;
  for (let i = 0; i < elements.length && count < 250; i++) {
    const el = elements[i]!;
    for (const k of Object.keys(el)) {
      if (k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')) {
        const fiber = (el as unknown as Record<string, { type: unknown }>)[k];
        if (!fiber || seen.has(fiber)) break;
        seen.add(fiber);
        // Only outline component fibers via type
        if (typeof fiber.type === 'function' || typeof fiber.type === 'object') {
          const r = el.getBoundingClientRect();
          if (r.width > 4 && r.height > 4) {
            const box = document.createElement('div');
            box.className = 'outline-box';
            box.style.left = `${r.left}px`;
            box.style.top = `${r.top}px`;
            box.style.width = `${r.width}px`;
            box.style.height = `${r.height}px`;
            fragment.append(box);
            count++;
          }
        }
        break;
      }
    }
  }
  outlineLayer.append(fragment);
}

function setOutlineMode(active: boolean): void {
  state.outlineMode = active;
  if (active) {
    renderOutlines();
  } else {
    clearOutlineLayer();
  }
}

// ─── Panel ───────────────────────────────────────────────────────────

function showInspectResult(info: ComponentInfo, el: Element | null): void {
  // Unsubscribe from previous fiber before replacing.
  if (state.currentFiberId && state.currentFiberId !== info.fiberId) {
    const msg: UnsubscribeRendersRequest = {
      source: RP_NAMESPACE,
      kind: 'unsubscribe-renders',
      fiberId: state.currentFiberId,
    };
    window.postMessage(msg, '*');
  }
  state.currentFiberId = info.fiberId;
  state.currentEl = el;
  clearInstancesHighlight();

  const onCopy = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(shadow, 'Copied');
    } catch {
      showToast(shadow, 'Copy failed');
    }
  };

  const onNavigate = async (fiberId: string): Promise<void> => {
    const res = await requestInspectById(fiberId);
    if (res.ok && res.data) {
      showInspectResult(res.data, null);
    } else {
      showToast(shadow, res.error ?? 'Component not found');
    }
  };

  const handle = renderPanel(shadow, {
    info,
    targetEl: el,
    onClose: clearPanel,
    onCopy,
    onNavigate,
    onChipHover: previewChip,
    onToggleInstances: () => void toggleInstancesHighlight(),
    onPositionChange: (pos) => {
      state.panelPos = pos;
    },
    initialPosition: state.panelPos,
  });
  state.panelHandle = handle;

  // Inject Related Requests section when component has captured network activity.
  if (info.name) {
    const relatedReqs = getState().requests.filter((r) => r.component === info.name);
    if (relatedReqs.length > 0) {
      const panelEl = shadow.querySelector('.panel') as HTMLElement | null;
      if (panelEl) {
        const section = document.createElement('div');
        section.style.cssText =
          'border-top:1px solid rgba(255,255,255,0.08);padding:10px 14px 12px;';

        const heading = document.createElement('div');
        heading.textContent = `Related Requests (${relatedReqs.length})`;
        heading.style.cssText =
          'font-size:10.5px;font-weight:600;color:rgba(235,235,245,0.4);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:7px;';
        section.appendChild(heading);

        for (const r of relatedReqs.slice(0, 8)) {
          const row = document.createElement('div');
          row.style.cssText =
            'display:flex;align-items:center;gap:6px;padding:3px 0;font-size:11.5px;';

          const mColor =
            r.method === 'GET'
              ? '#32d74b'
              : r.method === 'POST'
                ? '#0a84ff'
                : r.method === 'DELETE'
                  ? '#ff453a'
                  : '#ff9f0a';
          const mEl = document.createElement('span');
          mEl.textContent = r.method;
          mEl.style.cssText = `color:${mColor};font-weight:700;font-size:10px;min-width:38px;`;

          const pEl = document.createElement('span');
          pEl.textContent = r.path + (r.query ? `?${r.query}` : '');
          pEl.style.cssText =
            'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:monospace;color:rgba(255,255,255,0.68);';

          const sEl = document.createElement('span');
          sEl.textContent = r.status ? String(r.status) : '—';
          sEl.style.cssText = `color:${r.status >= 500 ? '#ff453a' : r.status >= 400 ? '#ff9f0a' : '#32d74b'};font-size:10.5px;min-width:28px;text-align:right;`;

          const dEl = document.createElement('span');
          dEl.textContent = r.duration < 1000 ? `${r.duration}ms` : `${(r.duration / 1000).toFixed(2)}s`;
          dEl.style.cssText = `font-size:10.5px;color:${r.duration > 500 ? '#ff9f0a' : 'rgba(235,235,245,0.3)'};min-width:48px;text-align:right;`;

          row.append(mEl, pEl, sEl, dEl);
          section.appendChild(row);
        }

        if (relatedReqs.length > 8) {
          const more = document.createElement('div');
          more.textContent = `+${relatedReqs.length - 8} more — open Network Inspector (<) for full view`;
          more.style.cssText =
            'font-size:10.5px;color:rgba(235,235,245,0.28);margin-top:5px;font-style:italic;';
          section.appendChild(more);
        }

        panelEl.appendChild(section);
      }
    }
  }

  // Subscribe to live re-render counts.
  if (info.fiberId) {
    const sub: SubscribeRendersRequest = {
      source: RP_NAMESPACE,
      kind: 'subscribe-renders',
      fiberId: info.fiberId,
    };
    window.postMessage(sub, '*');
  }
}

function showInspectError(message: string): void {
  shadow.querySelector('.panel')?.remove();
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.style.padding = '12px';
  const err = document.createElement('div');
  err.className = 'error';
  err.textContent = message;
  panel.append(err);
  shadow.append(panel);
  window.setTimeout(() => panel.remove(), 3000);
}

// ─── Event handlers ──────────────────────────────────────────────────

// Track which DOM element the tooltip currently shows, so we can hold position
// stable while the cursor stays within the same element.
let tooltipTargetEl: Element | null = null;

// Modifier-key state. Hold X or Y to activate the component picker (hover + tooltip).
// Click while held to open the full inspector panel.
let xDown = false;
// Right-click while holding X dismisses the tooltip until the next right-click.
let tooltipDismissed = false;

function isEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  return false;
}

// composedPath()[0] pierces shadow DOM — ev.target is retargeted to the host when
// focus sits inside a closed shadow root (e.g. the net panel search field).
function isEditingEvent(ev: KeyboardEvent): boolean {
  const actual = (ev.composedPath()[0] ?? ev.target) as EventTarget | null;
  return isEditingTarget(actual);
}

function handleMouseMove(ev: MouseEvent): void {
  if (!isPickerEnabled() || !xDown) {
    clearHighlight();
    if (!tooltip.isPinned()) tooltip.hide();
    return;
  }
  // Cursor over our own UI: keep state, don't track.
  if (isInsideHost(ev.target)) return;

  const el = elementUnderCursor(ev.clientX, ev.clientY);
  if (!el) {
    clearHighlight();
    return;
  }
  state.hoverEl = el;
  scheduleHover(el, true);
  showBoxModel(el);

  // Tooltip follows the cursor whenever X is held, unless dismissed by right-click.
  if (!tooltipDismissed && el !== tooltipTargetEl) {
    tooltipTargetEl = el;
    tooltip.setVisible(true);
    tooltip.update({
      preview: previewFromCache(el),
      targetEl: el,
      cursor: { x: ev.clientX, y: ev.clientY },
    });
  }
}

// Synthesize a minimal preview from the DOM element while we wait for the bridge response.
// Avoids tooltip flicker on first show.
function previewFromCache(el: Element) {
  return {
    name: el.tagName.toLowerCase(),
    kind: 'host' as const,
    rect: el.getBoundingClientRect(),
    domTag: el.tagName.toLowerCase(),
    source: null,
    propNames: [],
    parentName: null,
    childrenNames: [],
    ownerNames: [],
    elementId: el.id || '',
    className: el.getAttribute('class') ?? '',
  };
}

function handleMouseDown(ev: MouseEvent): void {
  if (!isPickerEnabled() || !xDown || ev.button !== 0) return;
  if (isInsideHost(ev.target)) return;
  const el = elementUnderCursor(ev.clientX, ev.clientY);
  if (!el) return;
  ev.preventDefault();
  ev.stopPropagation();
  // Opening the full panel — close the contextual tooltip to avoid duplicate surfaces.
  tooltip.hide();
  tooltipTargetEl = null;
  void requestInspect(el).then((res) => {
    if (res.ok && res.data) {
      showInspectResult(res.data, el);
    } else {
      showInspectError(res.error ?? 'Unknown error');
    }
  });
}

function handleClick(ev: MouseEvent): void {
  if (xDown && isPickerEnabled() && !isInsideHost(ev.target)) {
    ev.preventDefault();
    ev.stopPropagation();
  }
}

function handleAuxClick(ev: MouseEvent): void {
  if (xDown && isPickerEnabled() && !isInsideHost(ev.target)) {
    ev.preventDefault();
    ev.stopPropagation();
  }
}

function handleContextMenu(ev: MouseEvent): void {
  if (!isPickerEnabled() || !xDown) return;
  if (isInsideHost(ev.target)) return;
  ev.preventDefault();
  ev.stopPropagation();
  tooltipDismissed = !tooltipDismissed;
  tooltipTargetEl = null;
  if (tooltipDismissed) {
    tooltip.hide();
  }
}

// AltGr on Windows reports as ctrlKey + altKey simultaneously. Detecting it lets us
// keep firing for plain X / Y on European layouts (and RDP / Windows Server contexts
// where layout state can spuriously raise modifier flags).
function hasRealModifier(ev: KeyboardEvent): boolean {
  const altGraph = ev.getModifierState && ev.getModifierState('AltGraph');
  if (altGraph) return false;
  return ev.ctrlKey || ev.metaKey || ev.altKey;
}

// Configurable hotkey matcher: compares against ev.key (any layout) and ev.code
// (physical key, for letters/digits). Configured value is normalised to single
// lowercase character when it comes from popup capture.
function matchesHotkey(ev: KeyboardEvent, key: string): boolean {
  if (!key) return false;
  const k = key.toLowerCase();
  if (ev.key.toLowerCase() === k) return true;
  if (k.length === 1 && k >= 'a' && k <= 'z') return ev.code === `Key${k.toUpperCase()}`;
  if (k.length === 1 && k >= '0' && k <= '9') {
    return ev.code === `Digit${k}` || ev.code === `Numpad${k}`;
  }
  return false;
}

function handleKeyDown(ev: KeyboardEvent): void {
  if (ev.key === 'Escape') {
    clearPanel();
    clearHighlight();
    setOutlineMode(false);
    tooltip.hide();
    tooltipTargetEl = null;
    if (state.netPanelOpen) {
      state.netPanelHandle?.destroy();
      state.netPanelHandle = null;
      state.netPanelOpen = false;
    }
  }

  // Network panel toggle works regardless of picker enabled state.
  if (!isEditingEvent(ev) && !hasRealModifier(ev)) {
    if (matchesHotkey(ev, state.settings.hotkeys.network) && !ev.repeat) {
      if (!state.netPanelHandle?.isInputFocused()) {
        toggleNetPanel();
        return;
      }
    }
  }

  if (!isPickerEnabled()) return;
  // Don't intercept while the user is typing in a form field or composing text.
  if (isEditingEvent(ev)) return;
  // Don't fight native browser/OS shortcuts (e.g. Cmd+X, Ctrl+X).
  if (hasRealModifier(ev)) return;

  if (matchesHotkey(ev, state.settings.hotkeys.inspect) && !xDown) {
    // Unpin any previously-pinned tooltip so it resumes following the cursor.
    if (tooltip.isPinned()) tooltip.setPinned(false);
    xDown = true;
  }
}

function toggleNetPanel(): void {
  if (state.netPanelOpen) {
    state.netPanelHandle?.destroy();
    state.netPanelHandle = null;
    state.netPanelOpen = false;
  } else {
    const handle = renderNetPanel(shadow, {
      onClose: () => {
        state.netPanelHandle = null;
        state.netPanelOpen = false;
      },
      onCopy: async (text: string) => {
        try {
          await navigator.clipboard.writeText(text);
          showToast(shadow, 'Copied');
        } catch {
          showToast(shadow, 'Copy failed');
        }
      },
    });
    state.netPanelHandle = handle;
    state.netPanelOpen = true;
  }
}

function handleKeyUp(ev: KeyboardEvent): void {
  if (matchesHotkey(ev, state.settings.hotkeys.inspect)) {
    xDown = false;
    clearHighlight();
    if (tooltipTargetEl) {
      tooltip.setPinned(true);
    } else if (!tooltip.isPinned()) {
      tooltip.hide();
      tooltipTargetEl = null;
    }
  }
}

function handleBlur(): void {
  // Window lost focus: assume the keys are no longer held (we won't see keyup).
  xDown = false;
  clearHighlight();
  setOutlineMode(false);
  // If a tooltip was being shown, pin it so it survives the blur — user dismisses
  // via click-outside or Esc, never implicitly.
  if (tooltipTargetEl) {
    tooltip.setPinned(true);
  } else if (!tooltip.isPinned()) {
    tooltip.hide();
    tooltipTargetEl = null;
  }
}

function handleScroll(): void {
  clearHighlight();
  clearPreviewHighlight();
  lastPreviewedFiberId = null;
  if (instancesLayer.children.length > 0) clearInstancesHighlight();
  if (state.outlineMode) renderOutlines();
  // When floating, the tooltip is anchored to a viewport position that no longer matches the element.
  if (!tooltip.isPinned()) {
    tooltip.hide();
    tooltipTargetEl = null;
  }
}

// Click outside the tooltip while pinned: dismiss it.
function handleClickAnywhere(ev: MouseEvent): void {
  if (tooltip.isPinned() && !isInsideHost(ev.target)) {
    tooltip.hide();
    tooltipTargetEl = null;
  }
}

function handleBridgeMessage(ev: MessageEvent): void {
  if (ev.source !== window) return;
  const raw = ev.data as { source?: unknown; kind?: unknown } | null;
  if (raw && raw.source === 'peekly-net') {
    const netMsg = raw as NetRequestMessage;
    if (netMsg.kind === 'net-request') {
      addRequest(netMsg.data as RequestEntry);
      state.netPanelHandle?.onNewRequest();
    }
    return;
  }
  const data = ev.data as Partial<BridgeMessage> | null;
  if (!data || data.source !== RP_NAMESPACE) return;
  switch (data.kind) {
    case 'inspect-response': {
      const res = data as InspectResponse;
      const handler = pendingInspects.get(res.requestId);
      if (handler) {
        pendingInspects.delete(res.requestId);
        handler(res);
      }
      break;
    }
    case 'hover-response': {
      const res = data as HoverResponse;
      const handler = pendingHovers.get(res.requestId);
      if (handler) {
        pendingHovers.delete(res.requestId);
        handler(res);
      }
      break;
    }
    case 'find-instances-response': {
      const res = data as FindInstancesResponse;
      const handler = pendingInstances.get(res.requestId);
      if (handler) {
        pendingInstances.delete(res.requestId);
        handler(res);
      }
      break;
    }
    case 'find-fiber-rect-response': {
      const res = data as FindFiberRectResponse;
      const handler = pendingFiberRects.get(res.requestId);
      if (handler) {
        pendingFiberRects.delete(res.requestId);
        handler(res);
      }
      break;
    }
    case 'render-tick': {
      const tick = data as RenderTickEvent;
      if (state.currentFiberId === tick.fiberId && state.panelHandle) {
        state.panelHandle.updateRenderCount(tick.count, tick.lastRenderAt);
      }
      break;
    }
    case 'react-detected':
      state.reactDetected = data.detected ?? false;
      state.reactVersion = data.version;
      break;
    default:
      break;
  }
}

async function loadSettings(): Promise<void> {
  try {
    const stored = await chrome.storage.local.get(SETTINGS_KEY);
    const persisted = stored[SETTINGS_KEY] as Partial<Settings> | undefined;
    state.settings = { ...DEFAULT_SETTINGS, ...(persisted ?? {}) };
  } catch {
    state.settings = { ...DEFAULT_SETTINGS };
  }
}

function watchSettings(): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (SETTINGS_KEY in changes) {
      const next = changes[SETTINGS_KEY]?.newValue as Partial<Settings> | undefined;
      state.settings = { ...DEFAULT_SETTINGS, ...(next ?? {}) };
      if (!isPickerEnabled()) {
        clearHighlight();
        clearPanel();
        setOutlineMode(false);
      }
    }
  });
}

function init(): void {
  attachHost();

  window.addEventListener('mousemove', handleMouseMove, true);
  window.addEventListener('mousedown', handleMouseDown, true);
  window.addEventListener('click', handleClick, true);
  window.addEventListener('click', handleClickAnywhere);
  window.addEventListener('auxclick', handleAuxClick, true);
  window.addEventListener('contextmenu', handleContextMenu, true);
  window.addEventListener('keydown', handleKeyDown, true);
  window.addEventListener('keyup', handleKeyUp, true);
  window.addEventListener('blur', handleBlur);
  window.addEventListener('message', handleBridgeMessage);
  window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      xDown = false;
      clearHighlight();
      if (!tooltip.isPinned()) {
        tooltip.hide();
        tooltipTargetEl = null;
      }
    }
  });

  void loadSettings();
  watchSettings();
}

init();
