import { getState, subscribe, clearAll, addDriftEvent, addAnomalyEvent } from '../net/store';
import type { RequestEntry, N1Hit } from '../net/types';
import { smartLabel } from '../net/analysis/smart-labels';
import { detectGraphQL } from '../net/analysis/graphql';
import { extractJwtTokens, extractCookies, hasJwtOrCookies } from '../net/analysis/jwt';
import type { TokenEntry, CookieEntry } from '../net/analysis/jwt';
import { generateTsInterface } from '../net/analysis/typescript-gen';
import { checkDrift } from '../net/analysis/drift';
import { checkAnomaly } from '../net/analysis/anomaly';
import { netPanelCss } from './net-styles';

// ─── Types ──────────────────────────────────────────────────────────

export type NetPanelHandle = {
  element: HTMLElement;
  onNewRequest: () => void;
  destroy: () => void;
};

type IntelTab = 'drift' | 'anomalies' | 'forensics' | 'cache';
type DetailTab = 'overview' | 'request' | 'response' | 'graphql' | 'tokens' | 'ts';

type RenderOpts = {
  onClose: () => void;
  onCopy: (text: string) => Promise<void>;
};

// ─── Helpers ────────────────────────────────────────────────────────

function statusClass(status: number): string {
  if (status === 0) return 's-0';
  if (status >= 500) return 's-5xx';
  if (status >= 400) return 's-4xx';
  if (status >= 300) return 's-3xx';
  if (status >= 200) return 's-2xx';
  return 's-0';
}

function methodClass(method: string): string {
  return `m-${method.toUpperCase()}`;
}

function formatBytes(n: number): string {
  if (!n) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDuration(d: number): string {
  if (!d) return '—';
  if (d < 1000) return `${Math.round(d)}ms`;
  return `${(d / 1000).toFixed(2)}s`;
}

function normalizePath(path: string): string {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/[0-9a-f]{24,}/gi, '/:id')
    .replace(/\/[0-9]+/g, '/:id');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightJson(text: string): string {
  const escaped = escapeHtml(text);
  return escaped.replace(
    /("(\\u[0-9a-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      if (/^"/.test(match)) {
        if (/:$/.test(match)) return `<span class="np-json-key">${match}</span>`;
        return `<span class="np-json-str">${match}</span>`;
      }
      if (/true|false/.test(match)) return `<span class="np-json-bool">${match}</span>`;
      if (/null/.test(match)) return `<span class="np-json-null">${match}</span>`;
      return `<span class="np-json-num">${match}</span>`;
    },
  );
}

function isJsonContent(headers: Record<string, string>): boolean {
  const ct = (headers['content-type'] ?? headers['Content-Type'] ?? '').toLowerCase();
  return ct.includes('json');
}

function tryFormatJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function buildCurl(r: RequestEntry): string {
  const parts: string[] = [`curl -X ${r.method} '${r.url}'`];
  for (const [k, v] of Object.entries(r.requestHeaders)) {
    parts.push(`  -H '${k}: ${v.replace(/'/g, "'\\''")}'`);
  }
  if (r.requestBody) {
    parts.push(`  --data '${r.requestBody.replace(/'/g, "'\\''")}'`);
  }
  return parts.join(' \\\n');
}

function buildDebugBundle(r: RequestEntry): string {
  const sep = '─'.repeat(60);
  const size = formatBytes(r.responseBodySize);
  const fmtHeaders = (h: Record<string, string>): string =>
    Object.entries(h).length
      ? Object.entries(h).map(([k, v]) => `  ${k}: ${v}`).join('\n')
      : '  (none)';
  const fmtBody = (body: string): string => {
    if (!body) return '  (empty)';
    try {
      return JSON.stringify(JSON.parse(body), null, 2)
        .split('\n')
        .map((l) => `  ${l}`)
        .join('\n');
    } catch {
      return body.split('\n').map((l) => `  ${l}`).join('\n');
    }
  };
  return [
    sep,
    `Peekly — Debug Bundle`,
    sep,
    ``,
    `${r.method}  ${r.path}${r.query ? `?${r.query}` : ''}`,
    `URL       ${r.url}`,
    `Status ${r.status || '—'}   |   Duration ${r.duration}ms   |   Size ${size}`,
    `Time      ${new Date(r.timestamp).toLocaleString()}`,
    ``,
    `REQUEST HEADERS`,
    `···············`,
    fmtHeaders(r.requestHeaders),
    ``,
    `REQUEST BODY`,
    `············`,
    fmtBody(r.requestBody),
    ``,
    `RESPONSE HEADERS`,
    `················`,
    fmtHeaders(r.responseHeaders),
    ``,
    `RESPONSE BODY`,
    `·············`,
    fmtBody(r.responseBody),
    ...(r.callStack && r.callStack.length > 0
      ? [
          ``,
          `CALL STACK`,
          `··········`,
          ...r.callStack.map((f, i) => `  ${String(i).padStart(2, ' ')}  ${f}`),
        ]
      : []),
    ``,
    sep,
  ].join('\n');
}

function buildN1DebugBundle(hits: N1Hit[], requests: RequestEntry[]): string {
  const sep = '─'.repeat(60);
  const lines: string[] = [
    sep,
    `Peekly — N+1 Debug Bundle`,
    `Generated: ${new Date().toLocaleString()}   |   Patterns: ${hits.length}`,
    sep,
  ];
  for (const hit of hits) {
    const matching = requests.filter(
      (r) => r.method === hit.method && normalizePath(r.path) === hit.template,
    );
    const durations = matching.map((r) => r.duration);
    const avgDur = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;
    const totalDur = durations.reduce((a, b) => a + b, 0);
    const minTs = matching.length ? Math.min(...matching.map((r) => r.timestamp)) : 0;
    const maxTs = matching.length ? Math.max(...matching.map((r) => r.timestamp)) : hit.lastSeen;
    const burstMs = maxTs - minTs;
    const burstStr = burstMs < 1000 ? `${burstMs}ms` : `${(burstMs / 1000).toFixed(1)}s`;
    lines.push(
      ``,
      `${hit.method}  ${hit.template}`,
      `  Calls       ${hit.count}× in ${burstStr}`,
      `  Avg dur     ${avgDur}ms`,
      `  Total time  ${totalDur}ms`,
      `  First seen  ${new Date(minTs).toLocaleTimeString()}`,
      `  Last seen   ${new Date(maxTs).toLocaleTimeString()}`,
      ``,
      `  Requests (${matching.length}):`,
      ...matching.map(
        (r, i) =>
          `    ${String(i + 1).padStart(2)}  ${String(r.status || '—').padStart(3)}  ${r.path}${r.query ? '?' + r.query : ''}  ${r.duration}ms`,
      ),
    );
  }
  lines.push(``, sep);
  return lines.join('\n');
}

function decodeUnixTime(v: unknown): string | null {
  if (typeof v !== 'number') return null;
  if (v < 1_000_000_000 || v > 9_999_999_999) return null;
  try {
    const d = new Date(v * 1000);
    return d.toISOString().replace('T', ' ').slice(0, 19);
  } catch {
    return null;
  }
}

function makeEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag) as SVGElementTagNameMap[K];
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

// ─── Main render function ──────────────────────────────────────────

export function renderNetPanel(shadow: ShadowRoot, opts: RenderOpts): NetPanelHandle {
  // Inject styles once.
  if (!shadow.getElementById('np-style')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'np-style';
    styleEl.textContent = netPanelCss;
    shadow.appendChild(styleEl);
  }

  // Local state.
  let selectedId: string | null = null;
  let filterMethod = 'ALL';
  let filterStatus = 'ALL';
  let filterSearch = '';
  let filterSlow = false;
  let intelMode = false;
  let intelTab: IntelTab = 'drift';
  let detailTab: DetailTab = 'overview';

  const seenRequestIds = new Set<string>();

  // Build root element.
  const panel = makeEl('div', 'net-panel');
  panel.tabIndex = -1;
  panel.addEventListener('wheel', (ev) => ev.stopPropagation(), { passive: true });

  // ─── Titlebar ──────────────────────────────────────────────────
  const titlebar = makeEl('div', 'np-titlebar');
  const titlebarSpacer = makeEl('div');
  titlebarSpacer.style.width = '90px';
  titlebar.appendChild(titlebarSpacer);

  const title = makeEl('span', 'np-title', 'Network Inspector');
  titlebar.appendChild(title);

  const titlebarActions = makeEl('div', 'np-titlebar-actions');
  const intelBtn = makeEl('button', 'np-intel-btn', 'Intel ◈');
  intelBtn.type = 'button';
  titlebarActions.appendChild(intelBtn);
  const closeBtn = makeEl('button', 'np-close-btn', '×');
  closeBtn.type = 'button';
  titlebarActions.appendChild(closeBtn);
  titlebar.appendChild(titlebarActions);
  panel.appendChild(titlebar);

  // ─── Control bar ───────────────────────────────────────────────
  const ctrlbar = makeEl('div', 'np-ctrlbar');

  const methodFilters = ['ALL', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
  const methodBtns: HTMLButtonElement[] = [];
  for (const m of methodFilters) {
    const b = makeEl('button', `np-mf${m === 'ALL' ? ' active' : ''}`, m);
    b.type = 'button';
    b.dataset['method'] = m;
    b.addEventListener('click', () => {
      filterMethod = m;
      methodBtns.forEach((x) => x.classList.toggle('active', x.dataset['method'] === m));
      refreshList();
    });
    ctrlbar.appendChild(b);
    methodBtns.push(b);
  }

  ctrlbar.appendChild(makeEl('div', 'np-sep'));

  const statusFilters: Array<{ key: string; label: string }> = [
    { key: 'ALL', label: 'ALL' },
    { key: '2xx', label: '2xx' },
    { key: '3xx', label: '3xx' },
    { key: '4xx', label: '4xx' },
    { key: '5xx', label: '5xx' },
  ];
  const statusBtns: HTMLButtonElement[] = [];
  for (const s of statusFilters) {
    const b = makeEl('button', `np-sf${s.key === 'ALL' ? ' active' : ''}`, s.label);
    b.type = 'button';
    b.dataset['status'] = s.key;
    b.addEventListener('click', () => {
      filterStatus = s.key;
      statusBtns.forEach((x) => x.classList.toggle('active', x.dataset['status'] === s.key));
      refreshList();
    });
    ctrlbar.appendChild(b);
    statusBtns.push(b);
  }

  ctrlbar.appendChild(makeEl('div', 'np-sep'));

  const slowBtn = makeEl('button', 'np-sf', 'SLOW');
  slowBtn.type = 'button';
  slowBtn.addEventListener('click', () => {
    filterSlow = !filterSlow;
    slowBtn.classList.toggle('active', filterSlow);
    refreshList();
  });
  ctrlbar.appendChild(slowBtn);

  const searchWrap = makeEl('div', 'np-search-wrap');
  const searchInput = makeEl('input', 'np-search-input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search (use - to negate)';
  searchInput.addEventListener('input', () => {
    filterSearch = searchInput.value;
    refreshList();
  });
  searchWrap.appendChild(searchInput);
  ctrlbar.appendChild(searchWrap);

  const clearBtn = makeEl('button', 'np-clear-btn', 'Clear');
  clearBtn.type = 'button';
  clearBtn.addEventListener('click', () => {
    clearAll();
    selectedId = null;
    seenRequestIds.clear();
    refreshList();
    showPlaceholder();
  });
  ctrlbar.appendChild(clearBtn);

  panel.appendChild(ctrlbar);

  // ─── Main split ────────────────────────────────────────────────
  const main = makeEl('div', 'np-main');

  // List pane
  const listPane = makeEl('div', 'np-list-pane');
  const listHeader = makeEl('div', 'np-list-header');
  listHeader.appendChild(makeEl('span', '', 'Method'));
  listHeader.appendChild(makeEl('span', '', 'Path'));
  listHeader.appendChild(makeEl('span', '', 'Status'));
  listHeader.appendChild(makeEl('span', '', 'Time'));
  listPane.appendChild(listHeader);
  const reqList = makeEl('div', 'np-req-list');
  listPane.appendChild(reqList);
  main.appendChild(listPane);

  // Detail pane
  const detailPane = makeEl('div', 'np-detail-pane');
  const placeholder = makeEl('div', 'np-placeholder', '← Select a request');
  detailPane.appendChild(placeholder);

  const detailView = makeEl('div', 'np-detail-view hidden');

  const dvHead = makeEl('div', 'np-dv-head');
  const dvMethod = makeEl('span', 'np-dv-method');
  const dvUrl = makeEl('span', 'np-dv-url');
  const dvStatus = makeEl('span', 'np-dv-status');
  const dvDur = makeEl('span', 'np-dv-dur');
  const dvCopyBundle = makeEl('button', 'np-dv-copy-bundle', 'Copy');
  dvCopyBundle.type = 'button';
  dvCopyBundle.title = 'Copy debug bundle';
  const dvCopyCurl = makeEl('button', 'np-dv-copy-curl', 'cURL');
  dvCopyCurl.type = 'button';
  const dvCopyTs = makeEl('button', 'np-dv-copy-ts', 'TS');
  dvCopyTs.type = 'button';
  dvHead.appendChild(dvMethod);
  dvHead.appendChild(dvUrl);
  dvHead.appendChild(dvStatus);
  dvHead.appendChild(dvDur);
  dvHead.appendChild(dvCopyBundle);
  dvHead.appendChild(dvCopyCurl);
  dvHead.appendChild(dvCopyTs);
  detailView.appendChild(dvHead);

  const tabBar = makeEl('div', 'np-tab-bar');
  const tabDefs: Array<{ key: DetailTab; label: string; hidden?: boolean }> = [
    { key: 'overview', label: 'Overview' },
    { key: 'request', label: 'Request' },
    { key: 'response', label: 'Response' },
    { key: 'graphql', label: 'GraphQL', hidden: true },
    { key: 'tokens', label: 'Tokens', hidden: true },
    { key: 'ts', label: 'TS', hidden: false },
  ];
  const tabButtons = new Map<DetailTab, HTMLButtonElement>();
  for (const t of tabDefs) {
    const b = makeEl('button', `np-tab${t.key === 'overview' ? ' active' : ''}${t.hidden ? ' hidden' : ''}`, t.label);
    b.type = 'button';
    b.dataset['tab'] = t.key;
    b.addEventListener('click', () => switchDetailTab(t.key));
    tabBar.appendChild(b);
    tabButtons.set(t.key, b);
  }
  detailView.appendChild(tabBar);

  const tabPanels = makeEl('div', 'np-tab-panels');
  const pOverview = makeEl('div', 'np-panel');
  pOverview.id = 'np-p-overview';
  const pRequest = makeEl('div', 'np-panel hidden');
  pRequest.id = 'np-p-request';
  const pResponse = makeEl('div', 'np-panel hidden');
  pResponse.id = 'np-p-response';
  const pGraphql = makeEl('div', 'np-panel hidden');
  pGraphql.id = 'np-p-graphql';
  const pTokens = makeEl('div', 'np-panel hidden');
  pTokens.id = 'np-p-tokens';
  const pTs = makeEl('div', 'np-panel hidden');
  pTs.id = 'np-p-ts';
  tabPanels.appendChild(pOverview);
  tabPanels.appendChild(pRequest);
  tabPanels.appendChild(pResponse);
  tabPanels.appendChild(pGraphql);
  tabPanels.appendChild(pTokens);
  tabPanels.appendChild(pTs);
  detailView.appendChild(tabPanels);

  detailPane.appendChild(detailView);
  main.appendChild(detailPane);

  panel.appendChild(main);

  // ─── Intel pane (alternate to main) ────────────────────────────
  const intelPane = makeEl('div', 'np-intel-pane hidden');
  const intelTabBar = makeEl('div', 'np-intel-tab-bar');
  const intelTabDefs: Array<{ key: IntelTab; label: string }> = [
    { key: 'drift', label: 'Drift' },
    { key: 'anomalies', label: 'Anomalies' },
    { key: 'forensics', label: 'Forensics' },
    { key: 'cache', label: 'Cache' },
  ];
  const intelTabButtons = new Map<IntelTab, HTMLButtonElement>();
  for (const t of intelTabDefs) {
    const b = makeEl('button', `np-intel-tab${t.key === 'drift' ? ' active' : ''}`, t.label);
    b.type = 'button';
    b.dataset['intelTab'] = t.key;
    b.addEventListener('click', () => {
      intelTab = t.key;
      intelTabButtons.forEach((btn, k) => btn.classList.toggle('active', k === intelTab));
      renderIntelContent();
    });
    intelTabBar.appendChild(b);
    intelTabButtons.set(t.key, b);
  }
  intelPane.appendChild(intelTabBar);
  const intelContent = makeEl('div', 'np-intel-content');
  intelPane.appendChild(intelContent);
  panel.appendChild(intelPane);

  // ─── Overlay (shared: chart, N+1 detail) ──────────────────────
  const overlay = makeEl('div', 'np-overlay hidden');
  const overlayBackdrop = makeEl('div', 'np-overlay-backdrop');
  const overlayCard = makeEl('div', 'np-overlay-card');
  const overlayHead = makeEl('div', 'np-overlay-head');
  const overlayTitleEl = makeEl('div', 'np-overlay-card-title', 'Detail');
  const overlayCloseBtn = makeEl('button', 'np-overlay-close-btn', '×');
  overlayCloseBtn.type = 'button';
  const overlayBody = makeEl('div', 'np-overlay-body');
  let overlayHeaderAction: HTMLElement | null = null;
  overlayHead.appendChild(overlayTitleEl);
  overlayHead.appendChild(overlayCloseBtn);
  overlayCard.appendChild(overlayHead);
  overlayCard.appendChild(overlayBody);
  overlay.appendChild(overlayBackdrop);
  overlay.appendChild(overlayCard);
  panel.appendChild(overlay);

  // ─── Status bar ────────────────────────────────────────────────
  const statusBar = makeEl('div', 'np-status-bar');
  const sbTotal = makeEl('span', 'np-sb-total', '0 reqs');
  const sbTiming = makeEl('span', 'np-sb-timing', 'avg — · p95 —');
  const sbN1 = makeEl('span', 'np-sb-n1 np-sb-badge hidden', 'N+1 ⚠ 0');
  const sbErrs = makeEl('span', 'np-sb-errs np-sb-badge hidden', 'Errors ⚠ 0');
  const sbSpark = makeEl('div', 'np-sb-spark');
  sbSpark.title = 'View request chart';
  statusBar.appendChild(sbTotal);
  statusBar.appendChild(sbTiming);
  statusBar.appendChild(sbN1);
  statusBar.appendChild(sbErrs);
  const sbSpacer = makeEl('span', 'np-sb-spacer');
  statusBar.appendChild(sbSpacer);
  statusBar.appendChild(sbSpark);
  panel.appendChild(statusBar);

  // ─── Wire actions ──────────────────────────────────────────────
  // panelDestroy is assigned after all closures (onKeyDown, onMouseMove, unsubscribe) are set up.
  let panelDestroy: () => void = () => undefined;
  closeBtn.addEventListener('click', () => { panelDestroy(); opts.onClose(); });

  dvCopyBundle.addEventListener('click', () => {
    const r = getSelectedRequest();
    if (!r) return;
    void opts.onCopy(buildDebugBundle(r));
  });

  intelBtn.addEventListener('click', () => {
    intelMode = !intelMode;
    intelBtn.classList.toggle('active', intelMode);
    main.classList.toggle('hidden', intelMode);
    intelPane.classList.toggle('hidden', !intelMode);
    if (intelMode) renderIntelContent();
  });

  dvCopyCurl.addEventListener('click', () => {
    const r = getSelectedRequest();
    if (!r) return;
    void opts.onCopy(buildCurl(r));
  });
  dvCopyTs.addEventListener('click', () => {
    const r = getSelectedRequest();
    if (!r) return;
    const ts = generateTsInterface(r.responseBody);
    if (ts) void opts.onCopy(ts);
  });

  overlayBackdrop.addEventListener('click', () => closeOverlay());
  overlayCloseBtn.addEventListener('click', () => closeOverlay());

  sbN1.addEventListener('click', () => openN1Overlay());
  sbErrs.addEventListener('click', () => openErrorsOverlay());
  sbSpark.addEventListener('click', () => openChartOverlay());

  // Assign destroy after all closures below are initialized.

  // ─── Draggable titlebar ────────────────────────────────────────
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let dragging = false;
  // Track current absolute position once dragging begins (replaces center transform).
  let panelLeft: number | null = null;
  let panelTop: number | null = null;

  const onMouseMove = (e: MouseEvent): void => {
    if (!dragging) return;
    panelLeft = e.clientX - dragOffsetX;
    panelTop = e.clientY - dragOffsetY;
    panel.style.left = `${panelLeft}px`;
    panel.style.top = `${panelTop}px`;
    panel.style.transform = 'none';
  };
  const onMouseUp = (): void => {
    dragging = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };
  titlebar.addEventListener('mousedown', (e: MouseEvent) => {
    if (e.target instanceof HTMLElement && e.target.closest('button')) return;
    const rect = panel.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    dragging = true;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });

  // ─── Keyboard navigation ───────────────────────────────────────
  const onKeyDown = (e: KeyboardEvent): void => {
    if (panel.classList.contains('hidden')) return;
    if (!panel.isConnected) return;
    // Use composedPath to pierce shadow DOM — e.target is retargeted when focus
    // is inside a nested shadow root (our own panel within Peekly's shadow root).
    const target = (e.composedPath()[0] ?? e.target) as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

    if (e.key === 'j' || e.key === 'ArrowDown') {
      e.preventDefault();
      moveSelection(1);
    } else if (e.key === 'k' || e.key === 'ArrowUp') {
      e.preventDefault();
      moveSelection(-1);
    } else if (e.key === 'Escape') {
      if (filterSearch) {
        filterSearch = '';
        searchInput.value = '';
        refreshList();
      }
    } else if (e.key === '/' && document.activeElement !== searchInput) {
      e.preventDefault();
      searchInput.focus();
    }
  };
  window.addEventListener('keydown', onKeyDown, true);

  // ─── Subscribe to store ────────────────────────────────────────
  const unsubscribe = subscribe(() => {
    refreshList();
    if (intelMode) renderIntelContent();
    if (selectedId) {
      const r = getSelectedRequest();
      if (!r) {
        selectedId = null;
        showPlaceholder();
      }
    }
  });

  // All closures now defined — wire up destroy.
  panelDestroy = () => {
    unsubscribe();
    window.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    panel.remove();
  };

  // ─── Local helpers ─────────────────────────────────────────────
  function getSelectedRequest(): RequestEntry | null {
    if (!selectedId) return null;
    return getState().requests.find((r) => r.id === selectedId) ?? null;
  }

  function showPlaceholder(): void {
    placeholder.classList.remove('hidden');
    detailView.classList.add('hidden');
  }

  function showDetail(): void {
    placeholder.classList.add('hidden');
    detailView.classList.remove('hidden');
  }

  function getFiltered(): RequestEntry[] {
    const all = getState().requests;
    const search = filterSearch.trim();
    const positives: string[] = [];
    const negatives: string[] = [];
    if (search) {
      for (const part of search.split(/\s+/)) {
        if (!part) continue;
        if (part.startsWith('-') && part.length > 1) negatives.push(part.slice(1).toLowerCase());
        else positives.push(part.toLowerCase());
      }
    }

    return all.filter((r) => {
      if (filterMethod !== 'ALL' && r.method !== filterMethod) return false;
      if (filterStatus !== 'ALL') {
        const bucket = `${Math.floor(r.status / 100)}xx`;
        if (bucket !== filterStatus) return false;
      }
      if (filterSlow && r.duration <= 500) return false;
      if (positives.length || negatives.length) {
        const haystack = `${r.method} ${r.path} ${r.host} ${r.requestBody} ${r.responseBody}`.toLowerCase();
        for (const p of positives) if (!haystack.includes(p)) return false;
        for (const n of negatives) if (haystack.includes(n)) return false;
      }
      return true;
    });
  }

  function refreshList(): void {
    const filtered = getFiltered();

    // Empty state.
    if (!filtered.length) {
      reqList.innerHTML = '';
      const empty = makeEl('div', 'np-empty', 'No requests captured yet');
      reqList.appendChild(empty);
    } else {
      reqList.innerHTML = '';
      for (const r of filtered) {
        const row = makeEl('div', 'np-req-row');
        if (r.id === selectedId) row.classList.add('selected');
        if (r.status >= 400 && r.status < 500) row.classList.add('is-4xx');
        if (r.status >= 500) row.classList.add('is-5xx');
        if (r.duration > 500) row.classList.add('is-slow');
        row.dataset['id'] = r.id;

        const badge = makeEl('span', `np-method-badge ${methodClass(r.method)}`, r.method);
        row.appendChild(badge);

        const pathwrap = makeEl('div', 'np-rr-pathwrap');
        const pathEl = makeEl('div', 'np-rr-path', r.path + (r.query ? `?${r.query}` : ''));
        pathwrap.appendChild(pathEl);
        const label = smartLabel(r.method, r.path);
        if (label) {
          const labelEl = makeEl('span', 'np-rr-smart-label', label);
          pathwrap.appendChild(labelEl);
        }
        row.appendChild(pathwrap);

        const statusEl = makeEl('span', `np-rr-status ${statusClass(r.status)}`, r.status ? String(r.status) : '—');
        row.appendChild(statusEl);

        const durEl = makeEl('span', 'np-rr-dur', formatDuration(r.duration));
        row.appendChild(durEl);

        row.addEventListener('click', () => selectRequest(r.id));
        reqList.appendChild(row);
      }
    }

    updateStatusBar();

    // Re-render detail if currently selected.
    if (selectedId) {
      const r = getSelectedRequest();
      if (r) renderDetailHeader(r);
    }
  }

  function updateStatusBar(): void {
    const state = getState();
    const reqs = state.requests;
    sbTotal.textContent = `${reqs.length} reqs`;

    if (reqs.length) {
      const dursSorted = reqs.map((r) => r.duration).sort((a, b) => a - b);
      const avg = dursSorted.reduce((s, x) => s + x, 0) / dursSorted.length;
      const p95Idx = Math.min(Math.floor(dursSorted.length * 0.95), dursSorted.length - 1);
      const p95 = dursSorted[p95Idx] ?? 0;
      sbTiming.textContent = `avg ${formatDuration(avg)} · p95 ${formatDuration(p95)}`;
    } else {
      sbTiming.textContent = 'avg — · p95 —';
    }

    const n1Count = state.n1Hits.length;
    if (n1Count > 0) {
      sbN1.textContent = `N+1 ⚠ ${n1Count}`;
      sbN1.classList.remove('hidden');
    } else {
      sbN1.classList.add('hidden');
    }

    const errCount = state.errorPatterns.reduce((s, e) => s + e.count, 0);
    if (errCount > 0) {
      sbErrs.textContent = `Errors ⚠ ${errCount}`;
      sbErrs.classList.remove('hidden');
    } else {
      sbErrs.classList.add('hidden');
    }

    renderSparkline(sbSpark, reqs.slice(-60));
  }

  function moveSelection(delta: number): void {
    const filtered = getFiltered();
    if (!filtered.length) return;
    const idx = selectedId ? filtered.findIndex((r) => r.id === selectedId) : -1;
    let next = idx + delta;
    if (idx === -1) next = delta > 0 ? 0 : filtered.length - 1;
    next = Math.max(0, Math.min(filtered.length - 1, next));
    const target = filtered[next];
    if (target) selectRequest(target.id);
  }

  function selectRequest(id: string): void {
    selectedId = id;
    // Update selection highlight without rebuilding list.
    reqList.querySelectorAll('.np-req-row').forEach((el) => {
      const rowEl = el as HTMLElement;
      rowEl.classList.toggle('selected', rowEl.dataset['id'] === id);
    });
    const r = getSelectedRequest();
    if (!r) {
      showPlaceholder();
      return;
    }
    showDetail();
    renderDetailHeader(r);
    updateTabVisibility(r);
    renderActiveDetailTab(r);

    // Scroll selected row into view.
    const selected = reqList.querySelector(`.np-req-row[data-id="${id}"]`) as HTMLElement | null;
    if (selected) {
      const parent = reqList;
      const top = selected.offsetTop;
      const bottom = top + selected.offsetHeight;
      if (top < parent.scrollTop) parent.scrollTop = top;
      else if (bottom > parent.scrollTop + parent.clientHeight) {
        parent.scrollTop = bottom - parent.clientHeight;
      }
    }
  }

  function renderDetailHeader(r: RequestEntry): void {
    dvMethod.textContent = r.method;
    dvMethod.className = `np-dv-method ${methodClass(r.method)}`;
    dvUrl.textContent = r.path + (r.query ? `?${r.query}` : '');
    dvStatus.textContent = r.status ? String(r.status) : '—';
    dvStatus.className = `np-dv-status ${statusClass(r.status)}`;
    dvDur.textContent = formatDuration(r.duration);
  }

  function updateTabVisibility(r: RequestEntry): void {
    const isGql = !!detectGraphQL(r);
    const hasTokens = hasJwtOrCookies(r);
    tabButtons.get('graphql')?.classList.toggle('hidden', !isGql);
    tabButtons.get('tokens')?.classList.toggle('hidden', !hasTokens);

    // If active tab became hidden, fall back to overview.
    const activeBtn = tabButtons.get(detailTab);
    if (activeBtn?.classList.contains('hidden')) {
      switchDetailTab('overview');
    }
  }

  function switchDetailTab(tab: DetailTab): void {
    detailTab = tab;
    tabButtons.forEach((btn, k) => btn.classList.toggle('active', k === tab));
    pOverview.classList.toggle('hidden', tab !== 'overview');
    pRequest.classList.toggle('hidden', tab !== 'request');
    pResponse.classList.toggle('hidden', tab !== 'response');
    pGraphql.classList.toggle('hidden', tab !== 'graphql');
    pTokens.classList.toggle('hidden', tab !== 'tokens');
    pTs.classList.toggle('hidden', tab !== 'ts');
    const r = getSelectedRequest();
    if (r) renderActiveDetailTab(r);
  }

  function renderActiveDetailTab(r: RequestEntry): void {
    if (detailTab === 'overview') renderOverviewTab(r);
    else if (detailTab === 'request') renderRequestTab(r);
    else if (detailTab === 'response') renderResponseTab(r);
    else if (detailTab === 'graphql') renderGraphqlTab(r);
    else if (detailTab === 'tokens') renderTokensTab(r);
    else if (detailTab === 'ts') renderTsTab(r);
  }

  // ─── Detail tab renderers ─────────────────────────────────────

  function buildKvTable(rows: Array<[string, string]>): HTMLElement {
    const table = makeEl('table', 'np-kv-table');
    for (const [k, v] of rows) {
      const tr = makeEl('tr', 'np-kv-row');
      const tdk = makeEl('td', 'np-kv-key', k);
      const tdv = makeEl('td', 'np-kv-val', v);
      tr.appendChild(tdk);
      tr.appendChild(tdv);
      table.appendChild(tr);
    }
    return table;
  }

  function renderOverviewTab(r: RequestEntry): void {
    pOverview.innerHTML = '';
    const rows: Array<[string, string]> = [
      ['URL', r.url],
      ['Host', r.host],
      ['Method', r.method],
      ['Status', r.status ? String(r.status) : '—'],
      ['Duration', formatDuration(r.duration)],
      ['Request size', formatBytes(r.requestBodySize)],
      ['Response size', formatBytes(r.responseBodySize)],
      ['Timestamp', new Date(r.timestamp).toISOString()],
    ];
    if (r.component) rows.push(['Component', r.component]);
    pOverview.appendChild(buildCopyBar([{
      label: 'Copy all',
      getText: () => rows.map(([k, v]) => `${k}: ${v}`).join('\n'),
    }]));
    pOverview.appendChild(buildKvTable(rows));

    // Insights
    const insights: HTMLElement[] = [];

    if (r.duration > 1000) {
      const card = makeEl('div', 'np-intel-card', '');
      card.appendChild(makeEl('div', 'np-intel-card-title', 'Slow request'));
      card.appendChild(makeEl('div', '', `${formatDuration(r.duration)} response time`));
      addCopyBtn(card, () => `Slow request: ${r.method} ${r.path} took ${r.duration}ms`);
      insights.push(card);
    }

    const anomaly = getState().anomalyEvents.find((a) => a.requestId === r.id);
    if (anomaly) {
      const card = makeEl('div', 'np-intel-card', '');
      card.appendChild(makeEl('div', 'np-intel-card-title', 'Anomaly'));
      card.appendChild(makeEl('div', '', `${anomaly.type} ${anomaly.severity}: ${anomaly.endpoint}`));
      addCopyBtn(card, () => {
        const baseline = anomaly.type === 'slow' ? anomaly.baseline.p95 ?? 0 : anomaly.baseline.medianRate ?? 0;
        return `${anomaly.endpoint} — ${anomaly.type} ${anomaly.severity}: ${anomaly.value} (baseline ${baseline})`;
      });
      insights.push(card);
    }

    const errPat = getState().errorPatterns.find((e) => e.requestIds.includes(r.id));
    if (errPat) {
      const card = makeEl('div', 'np-intel-card', '');
      card.appendChild(makeEl('div', 'np-intel-card-title', 'Error pattern'));
      card.appendChild(makeEl('div', '', `${errPat.fingerprint} (${errPat.count} occurrences)`));
      addCopyBtn(card, () => `${errPat.fingerprint} — ${errPat.count} occurrences (HTTP ${errPat.status})`);
      insights.push(card);
    }

    if (insights.length) {
      pOverview.appendChild(makeEl('div', 'np-kv-label', 'Insights'));
      for (const c of insights) pOverview.appendChild(c);
    }

    // Call stack
    if (r.callStack && r.callStack.length > 0) {
      const csHeader = makeEl('div', 'np-cs-header');
      csHeader.appendChild(makeEl('span', 'np-kv-label', 'Call stack'));
      const csAllCopy = makeEl('button', 'np-cs-copy-all', 'Copy all');
      (csAllCopy as HTMLButtonElement).type = 'button';
      csAllCopy.addEventListener('click', () => void opts.onCopy(r.callStack!.join('\n')));
      csHeader.appendChild(csAllCopy);
      pOverview.appendChild(csHeader);

      const stackWrap = makeEl('div', 'np-callstack');
      r.callStack.forEach((frame, i) => {
        const row = makeEl('div', 'np-cs-row');
        const idx = makeEl('span', 'np-cs-idx', String(i));
        const text = makeEl('span', 'np-cs-frame', frame);
        text.title = frame;
        const copyBtn = makeEl('button', 'np-cs-copy', 'Copy');
        (copyBtn as HTMLButtonElement).type = 'button';
        copyBtn.addEventListener('click', () => void opts.onCopy(frame));
        row.append(idx, text, copyBtn);
        stackWrap.appendChild(row);
      });
      pOverview.appendChild(stackWrap);
    }
  }

  function renderHeadersAndBody(
    panelEl: HTMLElement,
    headers: Record<string, string>,
    body: string,
    bodyLabel: string,
    copyActions?: Array<{ label: string; getText: () => string }>,
  ): void {
    panelEl.innerHTML = '';
    if (copyActions?.length) panelEl.appendChild(buildCopyBar(copyActions));

    const hLabel = makeEl('div', 'np-kv-label', 'Headers');
    panelEl.appendChild(hLabel);
    if (Object.keys(headers).length) {
      const rows: Array<[string, string]> = Object.entries(headers).map(([k, v]) => [k, v]);
      panelEl.appendChild(buildKvTable(rows));
    } else {
      const empty = makeEl('div', '', '(no headers)');
      empty.style.color = 'var(--np-label-3)';
      empty.style.fontSize = '12px';
      empty.style.padding = '4px 0';
      panelEl.appendChild(empty);
    }

    const bLabel = makeEl('div', 'np-kv-label', bodyLabel);
    panelEl.appendChild(bLabel);
    if (body) {
      const pre = makeEl('pre', 'np-body-pre');
      if (isJsonContent(headers)) {
        const formatted = tryFormatJson(body);
        pre.innerHTML = highlightJson(formatted);
      } else {
        pre.textContent = body;
      }
      panelEl.appendChild(pre);
    } else {
      const empty = makeEl('div', '', '(empty body)');
      empty.style.color = 'var(--np-label-3)';
      empty.style.fontSize = '12px';
      empty.style.padding = '4px 0';
      panelEl.appendChild(empty);
    }
  }

  function renderRequestTab(r: RequestEntry): void {
    const fmtHeaders = (h: Record<string, string>) =>
      Object.entries(h).map(([k, v]) => `${k}: ${v}`).join('\n') || '(none)';
    renderHeadersAndBody(pRequest, r.requestHeaders, r.requestBody, 'Body', [
      { label: 'Copy headers', getText: () => fmtHeaders(r.requestHeaders) },
      { label: 'Copy body', getText: () => tryFormatJson(r.requestBody) || r.requestBody || '(empty)' },
      { label: 'Copy all', getText: () => `HEADERS\n${fmtHeaders(r.requestHeaders)}\n\nBODY\n${tryFormatJson(r.requestBody) || r.requestBody || '(empty)'}` },
    ]);
  }

  function renderResponseTab(r: RequestEntry): void {
    const fmtHeaders = (h: Record<string, string>) =>
      Object.entries(h).map(([k, v]) => `${k}: ${v}`).join('\n') || '(none)';
    renderHeadersAndBody(pResponse, r.responseHeaders, r.responseBody, 'Body', [
      { label: 'Copy headers', getText: () => fmtHeaders(r.responseHeaders) },
      { label: 'Copy body', getText: () => tryFormatJson(r.responseBody) || r.responseBody || '(empty)' },
      { label: 'Copy all', getText: () => `HEADERS\n${fmtHeaders(r.responseHeaders)}\n\nBODY\n${tryFormatJson(r.responseBody) || r.responseBody || '(empty)'}` },
    ]);
  }

  function renderGraphqlTab(r: RequestEntry): void {
    pGraphql.innerHTML = '';
    const info = detectGraphQL(r);
    if (!info) {
      pGraphql.appendChild(makeEl('div', 'np-empty', 'Not a GraphQL request'));
      return;
    }
    const rows: Array<[string, string]> = [
      ['Operation', info.operationType],
      ['Name', info.operationName ?? '—'],
    ];
    pGraphql.appendChild(buildKvTable(rows));

    if (info.variables) {
      pGraphql.appendChild(makeEl('div', 'np-kv-label', 'Variables'));
      const pre = makeEl('pre', 'np-body-pre');
      pre.innerHTML = highlightJson(JSON.stringify(info.variables, null, 2));
      pGraphql.appendChild(pre);
    }

    pGraphql.appendChild(makeEl('div', 'np-kv-label', 'Query'));
    const queryPre = makeEl('pre', 'np-body-pre');
    queryPre.textContent = info.query;
    pGraphql.appendChild(queryPre);

    // Surface GraphQL errors if present in response body.
    try {
      const parsed = JSON.parse(r.responseBody) as { errors?: unknown };
      if (Array.isArray(parsed.errors) && parsed.errors.length) {
        pGraphql.appendChild(makeEl('div', 'np-kv-label', 'Errors'));
        const ePre = makeEl('pre', 'np-body-pre');
        ePre.innerHTML = highlightJson(JSON.stringify(parsed.errors, null, 2));
        pGraphql.appendChild(ePre);
      }
    } catch {
      /* not JSON, skip */
    }
  }

  function renderTokenCard(t: TokenEntry): HTMLElement {
    const card = makeEl('div', 'np-token-card');
    const title = makeEl('div', 'np-token-title', `JWT — ${t.name}`);
    card.appendChild(title);

    const headerLabel = makeEl('div', 'np-token-section-label', 'Header');
    card.appendChild(headerLabel);
    for (const [k, v] of Object.entries(t.decoded.header)) {
      const row = makeEl('div', 'np-token-kv');
      row.appendChild(makeEl('span', 'np-token-key', k));
      row.appendChild(makeEl('span', 'np-token-val', JSON.stringify(v)));
      card.appendChild(row);
    }

    const payloadLabel = makeEl('div', 'np-token-section-label', 'Payload');
    card.appendChild(payloadLabel);
    for (const [k, v] of Object.entries(t.decoded.payload)) {
      const row = makeEl('div', 'np-token-kv');
      row.appendChild(makeEl('span', 'np-token-key', k));
      const valEl = makeEl('span', 'np-token-val', JSON.stringify(v));
      row.appendChild(valEl);
      const decoded = decodeUnixTime(v);
      if (decoded) {
        const ts = makeEl('span', 'np-unix-time', decoded);
        row.appendChild(ts);
      }
      card.appendChild(row);
    }
    return card;
  }

  function renderCookieCard(cookies: CookieEntry[]): HTMLElement {
    const card = makeEl('div', 'np-token-card');
    card.appendChild(makeEl('div', 'np-token-title', 'Cookies'));
    for (const c of cookies) {
      const row = makeEl('div', 'np-token-kv');
      row.appendChild(makeEl('span', 'np-token-key', c.name));
      row.appendChild(makeEl('span', 'np-token-val', c.value));
      card.appendChild(row);
    }
    return card;
  }

  function renderTokensTab(r: RequestEntry): void {
    pTokens.innerHTML = '';
    const tokens = extractJwtTokens(r);
    const cookies = extractCookies(r);
    if (!tokens.length && !cookies.length) {
      pTokens.appendChild(makeEl('div', 'np-empty', 'No JWT tokens or cookies on this request'));
      return;
    }
    for (const t of tokens) pTokens.appendChild(renderTokenCard(t));
    if (cookies.length) pTokens.appendChild(renderCookieCard(cookies));
  }

  function renderTsTab(r: RequestEntry): void {
    pTs.innerHTML = '';
    const toolbar = makeEl('div', 'np-ts-toolbar');
    const ts = generateTsInterface(r.responseBody);
    if (!ts) {
      pTs.appendChild(makeEl('div', 'np-empty', 'Response body is not valid JSON'));
      return;
    }
    const copyBtn = makeEl('button', 'np-action-btn', 'Copy interface');
    copyBtn.type = 'button';
    copyBtn.addEventListener('click', () => void opts.onCopy(ts));
    toolbar.appendChild(copyBtn);
    pTs.appendChild(toolbar);

    const pre = makeEl('pre', 'np-ts-output');
    pre.textContent = ts;
    pTs.appendChild(pre);
  }

  // ─── Copy button helper ───────────────────────────────────────
  function addCopyBtn(card: HTMLElement, getText: () => string): void {
    card.style.position = 'relative';
    const btn = document.createElement('button');
    btn.className = 'np-action-btn';
    btn.textContent = 'Copy';
    btn.type = 'button';
    btn.style.cssText = 'position:absolute;top:8px;right:8px;font-size:10px;padding:2px 7px;';
    btn.addEventListener('click', () => void opts.onCopy(getText()));
    card.appendChild(btn);
  }

  function buildCopyBar(actions: Array<{ label: string; getText: () => string }>): HTMLElement {
    const bar = makeEl('div', 'np-tab-copy-bar');
    for (const a of actions) {
      const btn = makeEl('button', 'np-tab-copy-btn', a.label);
      btn.type = 'button';
      btn.addEventListener('click', () => void opts.onCopy(a.getText()));
      bar.appendChild(btn);
    }
    return bar;
  }

  // ─── Intel rendering ──────────────────────────────────────────
  function renderIntelContent(): void {
    intelContent.innerHTML = '';
    const state = getState();
    if (intelTab === 'drift') {
      if (!state.driftEvents.length) {
        intelContent.appendChild(makeEl('div', 'np-intel-empty', 'No schema drift detected yet'));
        return;
      }
      for (const evt of state.driftEvents) {
        const card = makeEl('div', 'np-intel-card');
        card.appendChild(makeEl('div', 'np-intel-card-title', evt.endpoint));
        const meta = makeEl('div', 'np-intel-card-meta', new Date(evt.timestamp).toLocaleTimeString());
        card.appendChild(meta);
        for (const a of evt.added) {
          card.appendChild(makeEl('div', 'np-field-added', `+ ${a}`));
        }
        for (const rm of evt.removed) {
          card.appendChild(makeEl('div', 'np-field-removed', `− ${rm}`));
        }
        for (const tc of evt.typeChanged) {
          card.appendChild(makeEl('div', 'np-field-changed', `~ ${tc.field}: ${tc.from} → ${tc.to}`));
        }
        addCopyBtn(card, () =>
          `Schema drift on ${evt.endpoint}\n+${evt.added.join(', ')}\n-${evt.removed.join(', ')}\n~${evt.typeChanged.map((tc) => tc.field).join(', ')}`,
        );
        intelContent.appendChild(card);
      }
    } else if (intelTab === 'anomalies') {
      if (!state.anomalyEvents.length) {
        intelContent.appendChild(makeEl('div', 'np-intel-empty', 'No anomalies detected yet'));
        return;
      }
      for (const a of state.anomalyEvents) {
        const card = makeEl('div', 'np-intel-card');
        const cls = a.type === 'slow' ? 'np-anomaly-slow' : 'np-anomaly-spike';
        const titleEl = makeEl('div', `np-intel-card-title ${cls}`, a.endpoint);
        card.appendChild(titleEl);
        const meta = makeEl('div', 'np-intel-card-meta',
          `${a.type} · ${a.severity} · ${new Date(a.timestamp).toLocaleTimeString()}`);
        card.appendChild(meta);
        if (a.type === 'slow') {
          card.appendChild(makeEl('div', '',
            `Duration ${formatDuration(a.value)} (p95 ${formatDuration(a.baseline.p95 ?? 0)})`));
        } else {
          card.appendChild(makeEl('div', '',
            `Rate ${a.value}/min (median ${a.baseline.medianRate ?? 0}/min)`));
        }
        addCopyBtn(card, () => {
          const baseline = a.type === 'slow' ? a.baseline.p95 ?? 0 : a.baseline.medianRate ?? 0;
          return `${a.endpoint} — ${a.type} ${a.severity}: ${a.value} (baseline ${baseline})`;
        });
        intelContent.appendChild(card);
      }
    } else if (intelTab === 'forensics') {
      if (!state.errorPatterns.length) {
        intelContent.appendChild(makeEl('div', 'np-intel-empty', 'No error patterns yet'));
        return;
      }
      for (const e of state.errorPatterns) {
        const card = makeEl('div', 'np-intel-card');
        card.appendChild(makeEl('div', 'np-intel-card-title', e.fingerprint));
        card.appendChild(makeEl('div', 'np-intel-card-meta', `${e.count} occurrences`));
        addCopyBtn(card, () => `${e.fingerprint} — ${e.count} occurrences (HTTP ${e.status})`);
        intelContent.appendChild(card);
      }
    } else if (intelTab === 'cache') {
      if (!state.cacheEntries.length) {
        intelContent.appendChild(makeEl('div', 'np-intel-empty', 'No duplicate GET requests yet'));
        return;
      }
      for (const c of state.cacheEntries) {
        const card = makeEl('div', 'np-intel-card');
        card.appendChild(makeEl('div', 'np-intel-card-title', c.signature));
        card.appendChild(makeEl('div', 'np-intel-card-meta', `${c.count} hits — cacheable?`));
        addCopyBtn(card, () => `${c.signature} — ${c.count} duplicate requests`);
        intelContent.appendChild(card);
      }
    }
  }

  // ─── On new request: run analysis ─────────────────────────────
  function runAnalysisOnNew(): void {
    const reqs = getState().requests;
    for (const r of reqs) {
      if (seenRequestIds.has(r.id)) continue;
      seenRequestIds.add(r.id);
      const drift = checkDrift(r);
      if (drift) addDriftEvent(drift);
      const anomaly = checkAnomaly(r);
      if (anomaly) addAnomalyEvent(anomaly);
    }
  }

  // ─── Overlay helpers ──────────────────────────────────────────
  function openOverlay(
    title: string,
    renderFn: (container: HTMLElement) => void,
    wide = false,
    headerAction?: HTMLElement,
  ): void {
    overlayTitleEl.textContent = title;
    overlayBody.innerHTML = '';
    if (overlayHeaderAction) {
      overlayHeaderAction.remove();
      overlayHeaderAction = null;
    }
    if (headerAction) {
      overlayCloseBtn.before(headerAction);
      overlayHeaderAction = headerAction;
    }
    overlayCard.classList.toggle('np-chart-card', wide);
    renderFn(overlayBody);
    overlay.classList.remove('hidden');
  }

  function closeOverlay(): void {
    overlay.classList.add('hidden');
  }

  function openN1Overlay(): void {
    const st = getState();
    const hasHits = st.n1Hits.length > 0;
    const copyAllBtn = hasHits ? makeEl('button', 'np-overlay-head-action', 'Copy all') : undefined;

    openOverlay('N+1 Patterns', (body) => {
      if (!hasHits) {
        body.appendChild(makeEl('div', 'np-intel-empty', 'No N+1 patterns detected'));
        return;
      }
      body.addEventListener('wheel', (ev) => ev.stopPropagation(), { passive: true });

      for (const hit of st.n1Hits) {
        const matching = st.requests.filter(
          (r) => r.method === hit.method && normalizePath(r.path) === hit.template,
        );
        const durations = matching.map((r) => r.duration);
        const avgDur = durations.length
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : 0;
        const totalDur = durations.reduce((a, b) => a + b, 0);
        const minTs = matching.length ? Math.min(...matching.map((r) => r.timestamp)) : 0;
        const maxTs = matching.length ? Math.max(...matching.map((r) => r.timestamp)) : hit.lastSeen;
        const burstMs = maxTs - minTs;
        const burstStr = burstMs < 1000 ? `${burstMs}ms` : `${(burstMs / 1000).toFixed(1)}s`;
        const severity = hit.count >= 10 ? 'critical' : hit.count >= 5 ? 'high' : 'moderate';

        const group = makeEl('div', 'np-n1-group');

        const epRow = makeEl('div', 'np-n1-ep-row');
        epRow.appendChild(makeEl('span', `np-method-badge ${methodClass(hit.method)}`, hit.method));
        epRow.appendChild(makeEl('span', 'np-n1-template', hit.template));
        epRow.appendChild(makeEl('span', `np-n1-count np-n1-sev-${severity}`, `×${hit.count} in ${burstStr}`));
        group.appendChild(epRow);

        const statsRow = makeEl('div', 'np-n1-stats-row');
        for (const [label, value] of [
          ['avg', `${avgDur}ms`],
          ['total', formatDuration(totalDur)],
          ['first', new Date(minTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })],
          ['last', new Date(maxTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })],
        ] as [string, string][]) {
          const chip = makeEl('span', 'np-n1-stat');
          const labelEl = makeEl('span', 'np-n1-stat-label', label);
          chip.appendChild(labelEl);
          chip.appendChild(document.createTextNode(value));
          statsRow.appendChild(chip);
        }
        group.appendChild(statsRow);

        const rList = makeEl('div', 'np-n1-req-list');
        for (const r of matching.slice(0, 8)) {
          const row = makeEl('div', 'np-n1-req-row');
          row.appendChild(makeEl('span', `np-rr-status ${statusClass(r.status)}`, String(r.status || '—')));
          row.appendChild(makeEl('span', 'np-n1-path', r.path));
          row.appendChild(makeEl('span', 'np-rr-dur', formatDuration(r.duration)));
          row.addEventListener('click', () => { selectRequest(r.id); closeOverlay(); });
          rList.appendChild(row);
        }
        if (matching.length > 8) {
          rList.appendChild(makeEl('div', 'np-n1-more', `+${matching.length - 8} more identical calls`));
        }
        group.appendChild(rList);

        const hints: Record<string, string> = {
          moderate: '→ Consider batching or adding a client-side cache to deduplicate.',
          high: '→ High frequency — batch via a bulk endpoint or DataLoader pattern.',
          critical: '→ Critical: deduplicate immediately with request memoization or server-side batching.',
        };
        group.appendChild(makeEl('div', 'np-n1-hint', hints[severity]));
        body.appendChild(group);
      }
    }, false, copyAllBtn);

    if (copyAllBtn) {
      copyAllBtn.addEventListener('click', () => {
        const bundle = buildN1DebugBundle(st.n1Hits, st.requests);
        navigator.clipboard.writeText(bundle).catch(() => {});
        copyAllBtn.textContent = 'Copied!';
        setTimeout(() => { copyAllBtn.textContent = 'Copy all'; }, 1500);
      });
    }
  }

  function openErrorsOverlay(): void {
    openOverlay('Error Patterns', (body) => {
      const st = getState();
      if (!st.errorPatterns.length) {
        body.appendChild(makeEl('div', 'np-intel-empty', 'No error patterns detected'));
        return;
      }
      for (const pat of st.errorPatterns) {
        const group = makeEl('div', 'np-n1-group');
        const epRow = makeEl('div', 'np-n1-ep-row');
        epRow.appendChild(makeEl('span', `np-method-badge ${methodClass(pat.method)}`, pat.method));
        epRow.appendChild(makeEl('span', 'np-n1-template', pat.template));
        epRow.appendChild(makeEl('span', `np-n1-count np-err-count`, `${pat.count}× HTTP ${pat.status}`));
        group.appendChild(epRow);

        const matching = st.requests.filter((r) => pat.requestIds.includes(r.id));
        const rList = makeEl('div', 'np-n1-req-list');
        for (const r of matching.slice(0, 6)) {
          const row = makeEl('div', 'np-n1-req-row');
          row.appendChild(makeEl('span', `np-rr-status ${statusClass(r.status)}`, String(r.status)));
          row.appendChild(makeEl('span', 'np-n1-path', r.path));
          row.appendChild(makeEl('span', 'np-rr-dur', formatDuration(r.duration)));
          row.addEventListener('click', () => { selectRequest(r.id); closeOverlay(); });
          rList.appendChild(row);
        }
        if (matching.length > 6) {
          rList.appendChild(makeEl('div', 'np-n1-more', `+${matching.length - 6} more`));
        }
        group.appendChild(rList);
        body.appendChild(group);
      }
    });
  }

  function openChartOverlay(): void {
    openOverlay('Request Chart', (body) => {
      const st = getState();
      if (!st.requests.length) {
        body.appendChild(makeEl('div', 'np-intel-empty', 'No requests captured'));
        return;
      }
      body.classList.add('np-chart-body');
      const reqs = st.requests;

      // Stats bar
      const dursSorted = [...reqs.map((r) => r.duration)].sort((a, b) => a - b);
      const avg = Math.round(dursSorted.reduce((s, x) => s + x, 0) / dursSorted.length);
      const p95Idx = Math.min(Math.floor(dursSorted.length * 0.95), dursSorted.length - 1);
      const p95v = dursSorted[p95Idx] ?? 0;
      const errCount = reqs.filter((r) => r.status >= 400).length;
      const slowCount = reqs.filter((r) => r.duration > 500).length;

      const statsBar = makeEl('div', 'np-chart-stats-bar');
      for (const [lbl, val, cls] of [
        ['Total', `${reqs.length}`, ''],
        ['Avg', formatDuration(avg), ''],
        ['p95', formatDuration(p95v), ''],
        ['Errors', `${errCount}`, errCount > 0 ? 'is-error' : ''],
        ['Slow', `${slowCount}`, slowCount > 0 ? 'is-slow' : ''],
      ] as Array<[string, string, string]>) {
        const item = makeEl('div', 'np-chart-stat');
        item.appendChild(makeEl('span', 'np-chart-stat-label', lbl));
        item.appendChild(makeEl('span', `np-chart-stat-value${cls ? ` ${cls}` : ''}`, val));
        statsBar.appendChild(item);
      }
      body.appendChild(statsBar);

      // View toggle
      let viewMode: 'timeline' | 'waterfall' = 'timeline';
      const toggleWrap = makeEl('div', 'np-chart-toggle');
      const btnTimeline = makeEl('button', 'np-chart-toggle-btn active', 'Timeline');
      btnTimeline.type = 'button';
      const btnWaterfall = makeEl('button', 'np-chart-toggle-btn', 'Waterfall');
      btnWaterfall.type = 'button';
      toggleWrap.appendChild(btnTimeline);
      toggleWrap.appendChild(btnWaterfall);
      body.appendChild(toggleWrap);

      const chartArea = makeEl('div', 'np-chart-area');
      body.appendChild(chartArea);

      function renderView(): void {
        chartArea.innerHTML = '';
        if (viewMode === 'timeline') renderTimelineChart(chartArea, reqs, p95v);
        else renderWaterfallChart(chartArea, reqs);
      }

      btnTimeline.addEventListener('click', () => {
        viewMode = 'timeline';
        btnTimeline.classList.add('active');
        btnWaterfall.classList.remove('active');
        renderView();
      });
      btnWaterfall.addEventListener('click', () => {
        viewMode = 'waterfall';
        btnWaterfall.classList.add('active');
        btnTimeline.classList.remove('active');
        renderView();
      });

      renderView();
    }, true);
  }

  function renderTimelineChart(container: HTMLElement, reqs: RequestEntry[], p95v: number): void {
    const W = 760, H = 220;
    const pL = 52, pR = 24, pT = 16, pB = 32;
    const iW = W - pL - pR;
    const iH = H - pT - pB;

    const minT = Math.min(...reqs.map((r) => r.timestamp));
    const maxT = Math.max(...reqs.map((r) => r.timestamp));
    const timeSpan = Math.max(maxT - minT, 1);

    const dursSorted = [...reqs.map((r) => r.duration)].sort((a, b) => a - b);
    const p99 = dursSorted[Math.max(0, Math.floor(dursSorted.length * 0.99) - 1)] ?? 0;
    const yMax = Math.max(p99 * 1.1, 600);

    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'np-chart-svg' });
    (svg as unknown as HTMLElement).style.width = '100%';
    (svg as unknown as HTMLElement).style.height = 'auto';

    svg.appendChild(svgEl('rect', { x: pL, y: pT, width: iW, height: iH, fill: 'rgba(255,255,255,0.02)', rx: 4 }));

    const gridMs = [0, 100, 300, 500, 1000, 2000, 5000].filter((v) => v <= yMax);
    for (const g of gridMs) {
      const y = pT + iH - (g / yMax) * iH;
      svg.appendChild(svgEl('line', { x1: pL, y1: y, x2: W - pR, y2: y, stroke: 'rgba(255,255,255,0.06)', 'stroke-width': 1 }));
      const lbl = document.createElementNS(SVG_NS, 'text');
      lbl.setAttribute('x', String(pL - 4));
      lbl.setAttribute('y', String(y + 3));
      lbl.setAttribute('text-anchor', 'end');
      lbl.setAttribute('font-size', '9');
      lbl.setAttribute('fill', 'rgba(235,235,245,0.3)');
      lbl.textContent = g >= 1000 ? `${g / 1000}s` : `${g}ms`;
      svg.appendChild(lbl);
    }

    // 500ms threshold (orange dashed)
    if (yMax > 500) {
      const y500 = pT + iH - (500 / yMax) * iH;
      svg.appendChild(svgEl('line', { x1: pL, y1: y500, x2: W - pR, y2: y500, stroke: 'rgba(255,159,10,0.4)', 'stroke-width': 1, 'stroke-dasharray': '4 3' }));
      const lbl = document.createElementNS(SVG_NS, 'text');
      lbl.setAttribute('x', String(W - pR + 2));
      lbl.setAttribute('y', String(y500 + 3));
      lbl.setAttribute('font-size', '8');
      lbl.setAttribute('fill', 'rgba(255,159,10,0.55)');
      lbl.textContent = 'slow';
      svg.appendChild(lbl);
    }

    // p95 line (blue dashed)
    if (p95v > 0 && p95v <= yMax) {
      const yP95 = pT + iH - (p95v / yMax) * iH;
      svg.appendChild(svgEl('line', { x1: pL, y1: yP95, x2: W - pR, y2: yP95, stroke: 'rgba(10,132,255,0.5)', 'stroke-width': 1, 'stroke-dasharray': '3 3' }));
      const lbl = document.createElementNS(SVG_NS, 'text');
      lbl.setAttribute('x', String(W - pR + 2));
      lbl.setAttribute('y', String(yP95 + 3));
      lbl.setAttribute('font-size', '8');
      lbl.setAttribute('fill', 'rgba(10,132,255,0.65)');
      lbl.textContent = 'p95';
      svg.appendChild(lbl);
    }

    // X axis time labels
    const xSteps = 5;
    for (let i = 0; i <= xSteps; i++) {
      const t = minT + (i / xSteps) * timeSpan;
      const x = pL + (i / xSteps) * iW;
      svg.appendChild(svgEl('line', { x1: x, y1: pT + iH, x2: x, y2: pT + iH + 4, stroke: 'rgba(255,255,255,0.12)', 'stroke-width': 1 }));
      const d = new Date(t);
      const ts = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
      const xlbl = document.createElementNS(SVG_NS, 'text');
      xlbl.setAttribute('x', String(x));
      xlbl.setAttribute('y', String(H - 4));
      xlbl.setAttribute('text-anchor', i === xSteps ? 'end' : i === 0 ? 'start' : 'middle');
      xlbl.setAttribute('font-size', '9');
      xlbl.setAttribute('fill', 'rgba(235,235,245,0.25)');
      xlbl.textContent = ts;
      svg.appendChild(xlbl);
    }

    // Floating tooltip
    const tooltip = makeEl('div', 'np-chart-tooltip hidden');
    container.appendChild(tooltip);

    // Dots
    for (const r of reqs) {
      const px = pL + ((r.timestamp - minT) / timeSpan) * iW;
      const py = pT + iH - Math.min((r.duration / yMax) * iH, iH);
      const color = r.status >= 500 ? '#ff453a' : r.status >= 400 ? '#ff9f0a' : r.status === 0 ? '#8e8e93' : '#32d74b';
      const dot = svgEl('circle', { cx: px, cy: py, r: 4, fill: color, opacity: 0.82, class: 'np-chart-dot' });

      (dot as unknown as HTMLElement).addEventListener('mouseenter', (e: MouseEvent) => {
        dot.setAttribute('r', '6');
        dot.setAttribute('opacity', '1');
        tooltip.innerHTML = `<span class="np-method-badge m-${r.method}" style="font-size:10px;padding:1px 5px">${r.method}</span><span class="np-chart-tt-path">${r.path}</span><div class="np-chart-tt-meta">${r.status || '—'} · ${formatDuration(r.duration)}</div>`;
        tooltip.classList.remove('hidden');
        const cr = container.getBoundingClientRect();
        let lx = e.clientX - cr.left + 10;
        let ly = e.clientY - cr.top - 36;
        if (lx + 180 > cr.width) lx = e.clientX - cr.left - 190;
        if (ly < 0) ly = e.clientY - cr.top + 10;
        tooltip.style.left = `${lx}px`;
        tooltip.style.top = `${ly}px`;
      });
      (dot as unknown as HTMLElement).addEventListener('mouseleave', () => {
        dot.setAttribute('r', '4');
        dot.setAttribute('opacity', '0.82');
        tooltip.classList.add('hidden');
      });
      (dot as unknown as HTMLElement).addEventListener('click', () => { selectRequest(r.id); closeOverlay(); });
      svg.appendChild(dot);
    }

    container.appendChild(svg);
  }

  function renderWaterfallChart(container: HTMLElement, reqs: RequestEntry[]): void {
    const sorted = [...reqs].sort((a, b) => a.timestamp - b.timestamp);
    const minT = sorted[0]?.timestamp ?? 0;
    const maxEnd = sorted.reduce((m, r) => Math.max(m, r.timestamp + r.duration), minT);
    const totalSpan = Math.max(maxEnd - minT, 1);

    const wrap = makeEl('div', 'np-wf-wrap');

    // X axis
    const xaxis = makeEl('div', 'np-wf-xaxis');
    for (const frac of [0, 0.25, 0.5, 0.75, 1.0]) {
      const ms = totalSpan * frac;
      const lbl = makeEl('span', 'np-wf-xmark', ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`);
      lbl.style.left = `${frac * 100}%`;
      if (frac === 1.0) lbl.style.transform = 'translateX(-100%)';
      xaxis.appendChild(lbl);
    }
    wrap.appendChild(xaxis);

    const rowsWrap = makeEl('div', 'np-wf-rows');
    for (const r of sorted) {
      const row = makeEl('div', `np-wf-row${r.duration > 500 ? ' is-slow' : ''}`);
      row.dataset['id'] = r.id;

      const labelDiv = makeEl('div', 'np-wf-label');
      const badge = makeEl('span', `np-method-badge ${methodClass(r.method)}`, r.method);
      badge.style.fontSize = '9px';
      badge.style.padding = '0 4px';
      badge.style.flexShrink = '0';
      const pathEl = makeEl('span', 'np-wf-path', r.path + (r.query ? `?${r.query}` : ''));
      labelDiv.appendChild(badge);
      labelDiv.appendChild(pathEl);

      const timeline = makeEl('div', 'np-wf-timeline');
      const offsetPct = ((r.timestamp - minT) / totalSpan) * 100;
      const widthPct = Math.max((r.duration / totalSpan) * 100, 0.4);
      const color = r.status >= 500 ? '#ff453a' : r.status >= 400 ? '#ff9f0a' : r.status === 0 ? '#636366' : '#32d74b';
      const bar = makeEl('div', 'np-wf-bar');
      bar.style.left = `${offsetPct}%`;
      bar.style.width = `${widthPct}%`;
      bar.style.background = color;
      timeline.appendChild(bar);

      const durEl = makeEl('span', 'np-wf-dur', formatDuration(r.duration));

      row.appendChild(labelDiv);
      row.appendChild(timeline);
      row.appendChild(durEl);
      row.addEventListener('click', () => { selectRequest(r.id); closeOverlay(); });
      rowsWrap.appendChild(row);
    }

    wrap.appendChild(rowsWrap);
    container.appendChild(wrap);
  }

  function renderSparkline(container: HTMLElement, reqs: RequestEntry[]): void {
    container.innerHTML = '';
    if (!reqs.length) return;
    const W = 72, H = 14;
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H });
    const maxDur = Math.max(...reqs.map((r) => r.duration), 1);
    const n = reqs.length;
    const bw = Math.max(1, (W - n * 0.5) / n);
    reqs.forEach((r, i) => {
      const h = Math.max(1, (r.duration / maxDur) * H);
      const color =
        r.status >= 500 ? '#ff453a' : r.status >= 400 ? '#ff9f0a' : r.status === 0 ? '#636366' : '#32d74b';
      svg.appendChild(
        svgEl('rect', {
          x: i * (bw + 0.5),
          y: H - h,
          width: bw,
          height: h,
          fill: color,
          rx: 0.5,
        }),
      );
    });
    container.appendChild(svg);
  }

  // Attach to shadow DOM.
  shadow.appendChild(panel);

  // Initial render.
  refreshList();

  return {
    element: panel,
    onNewRequest: () => {
      runAnalysisOnNew();
      refreshList();
    },
    destroy: () => panelDestroy(),
  };
}
