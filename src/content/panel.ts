import type {
  ComponentInfo,
  ComponentRef,
  OwnerInfo,
  SerializedValue,
  SourceLocation,
} from '../shared/messages';

const PROPS_INITIAL = 8;
type PanelTab = 'comp' | 'dom' | 'css' | 'a11y';

export type PanelHandle = {
  updateRenderCount(count: number, lastRenderAt: number): void;
};

export type RenderPanelOptions = {
  info: ComponentInfo;
  targetEl: Element | null;
  onClose: () => void;
  onCopy: (text: string) => void;
  onNavigate: (fiberId: string) => void;
  onChipHover: (fiberId: string | null) => void;
  onToggleInstances: () => void;
  onPositionChange: (pos: { x: number; y: number }) => void;
  initialPosition: { x: number; y: number } | null;
};

// ─── Formatting ──────────────────────────────────────────────────────

function formatValue(v: SerializedValue): string {
  switch (v.type) {
    case 'primitive':
      if (typeof v.value === 'string') return v.value;
      return String(v.value);
    case 'undefined':
      return 'undefined';
    case 'function':
      return v.inline ? `ƒ <inline>` : `ƒ ${v.name}()`;
    case 'symbol':
      return `Symbol(${v.description})`;
    case 'array':
      return v.preview;
    case 'object':
      return v.preview;
    case 'react-element':
      return `<${v.name} />`;
    case 'circular':
      return '[Circular]';
    case 'error':
      return `[err: ${v.message}]`;
  }
}

function pathString(src: SourceLocation): string {
  const line = src.lineNumber != null ? `:${src.lineNumber}` : '';
  const col = src.columnNumber != null ? `:${src.columnNumber}` : '';
  return `${src.fileName}${line}${col}`;
}

export function selectorOf(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const className = (el.getAttribute('class') ?? '').trim();
  let cls = '';
  if (className) {
    const parts = className.split(/\s+/).filter(Boolean);
    const joined = '.' + parts.join('.');
    cls = joined.length > 28 ? joined.slice(0, 27) + '…' : joined;
  }
  return `<${tag}${id}${cls}>`;
}

// ─── Generic UI helpers ──────────────────────────────────────────────

type CopyFn = (text: string) => void;
type NavigateFn = (fiberId: string) => void;
type ChipHoverFn = (fiberId: string | null) => void;

function makeButton(
  text: string,
  variant: 'primary' | 'secondary' | 'ghost',
  onClick: () => void,
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = `btn btn-${variant}`;
  btn.type = 'button';
  btn.textContent = text;
  btn.addEventListener('click', onClick);
  return btn;
}

function makeIconBtn(svg: string, title: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'icon-btn';
  btn.innerHTML = svg;
  btn.title = title;
  btn.setAttribute('aria-label', title);
  btn.addEventListener('click', onClick);
  return btn;
}

function selectElementContents(root: ShadowRoot, el: Element): void {
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel =
    (root as unknown as { getSelection?: () => Selection | null }).getSelection?.() ??
    window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(range);
}

const ICON_COPY = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
const ICON_INSTANCES = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`;
const ICON_DRAG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg>`;
export const ICON_COPY_SM = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;

// ─── Drag handling ───────────────────────────────────────────────────

function attachDrag(
  panel: HTMLElement,
  handle: HTMLElement,
  onChange: (pos: { x: number; y: number }) => void,
): void {
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  handle.addEventListener('mousedown', (ev) => {
    if ((ev.target as HTMLElement).closest('button')) return;
    dragging = true;
    const rect = panel.getBoundingClientRect();
    offsetX = ev.clientX - rect.left;
    offsetY = ev.clientY - rect.top;
    panel.classList.add('dragging');
    ev.preventDefault();
  });

  window.addEventListener('mousemove', (ev) => {
    if (!dragging) return;
    const x = Math.max(8, Math.min(window.innerWidth - 80, ev.clientX - offsetX));
    const y = Math.max(8, Math.min(window.innerHeight - 60, ev.clientY - offsetY));
    panel.style.left = `${x}px`;
    panel.style.top = `${y}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    onChange({ x, y });
  });

  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    panel.classList.remove('dragging');
  });
}

// ─── Sections ────────────────────────────────────────────────────────

type HeaderHandle = {
  el: HTMLElement;
};

function buildHeader(
  root: ShadowRoot,
  info: ComponentInfo,
  onClose: () => void,
  onCopy: CopyFn,
  onToggleInstances: () => void,
): HeaderHandle {
  const header = document.createElement('div');
  header.className = 'panel-header';

  const dragHandle = document.createElement('div');
  dragHandle.className = 'drag-handle';
  dragHandle.innerHTML = ICON_DRAG;
  dragHandle.title = 'Drag to move';

  const title = document.createElement('div');
  title.className = 'panel-title';

  const name = document.createElement('span');
  name.className = 'panel-name';
  name.textContent = info.name;
  name.title = `Click to select · ${info.kind}`;
  name.setAttribute('role', 'button');
  name.setAttribute('tabindex', '0');
  name.addEventListener('click', () => selectElementContents(root, name));
  name.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      selectElementContents(root, name);
    }
  });
  title.append(name);

  const copyNameBtn = makeIconBtn(ICON_COPY, 'Copy component name', () => onCopy(info.name));
  title.append(copyNameBtn);

  const actions = document.createElement('div');
  actions.className = 'panel-actions';

  const instancesBtn = makeIconBtn(ICON_INSTANCES, 'Highlight all instances on page', onToggleInstances);
  actions.append(instancesBtn);

  const closeBtn = makeButton('✕', 'ghost', onClose);
  closeBtn.classList.add('panel-close');
  closeBtn.title = 'Close (Esc)';
  actions.append(closeBtn);

  header.append(dragHandle, title, actions);

  return { el: header };
}

function buildPanelTabs(
  initialActive: PanelTab,
  badges: Partial<Record<PanelTab, number>>,
  onChange: (tab: PanelTab) => void,
): { el: HTMLElement; setActive: (tab: PanelTab) => void } {
  const wrap = document.createElement('div');
  wrap.className = 'panel-tabs';

  const defs: { id: PanelTab; label: string }[] = [
    { id: 'comp', label: 'Comp' },
    { id: 'dom', label: 'DOM' },
    { id: 'css', label: 'CSS' },
    { id: 'a11y', label: 'A11y' },
  ];

  const buttons = new Map<PanelTab, HTMLButtonElement>();

  function setActive(tab: PanelTab): void {
    for (const [id, btn] of buttons) {
      btn.classList.toggle('active', id === tab);
    }
  }

  for (const def of defs) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'panel-tab';
    if (def.id === initialActive) btn.classList.add('active');
    btn.textContent = def.label;
    const badge = badges[def.id];
    if (badge != null && badge > 0) {
      const b = document.createElement('span');
      b.className = 'panel-tab-badge';
      b.textContent = String(badge);
      btn.append(b);
    }
    btn.addEventListener('click', () => {
      setActive(def.id);
      onChange(def.id);
    });
    buttons.set(def.id, btn);
    wrap.append(btn);
  }

  return { el: wrap, setActive };
}

function buildNavSection(
  info: ComponentInfo,
  onNavigate: NavigateFn,
  onChipHover: ChipHoverFn,
): HTMLElement | null {
  if (!info.parent && info.children.length === 0) return null;
  const section = document.createElement('section');
  section.className = 'section';
  section.addEventListener('mouseleave', () => onChipHover(null));
  const heading = document.createElement('h4');
  heading.className = 'section-title';
  heading.textContent = 'Navigation';
  section.append(heading);

  if (info.parent) {
    const parentRow = buildNavRow(
      '↑',
      `Parent: ${info.parent.name}`,
      () => onNavigate(info.parent!.fiberId),
      info.parent.fiberId,
      onChipHover,
    );
    section.append(parentRow);
  }
  if (info.children.length > 0) {
    const list = document.createElement('div');
    list.className = 'children-list';
    const arrow = document.createElement('span');
    arrow.className = 'nav-arrow';
    arrow.textContent = '↓';
    const label = document.createElement('span');
    label.className = 'nav-label';
    label.textContent = `Children (${info.children.length})`;
    const wrap = document.createElement('div');
    wrap.className = 'nav-wrap';
    wrap.append(arrow, label);
    section.append(wrap);

    for (const child of info.children) {
      list.append(buildChildChip(child, onNavigate, onChipHover));
    }
    section.append(list);
  }
  return section;
}

function buildNavRow(
  arrow: string,
  text: string,
  onClick: () => void,
  fiberId: string,
  onChipHover: ChipHoverFn,
): HTMLElement {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'nav-row';
  const a = document.createElement('span');
  a.className = 'nav-arrow';
  a.textContent = arrow;
  const t = document.createElement('span');
  t.className = 'nav-text';
  t.textContent = text;
  row.append(a, t);
  row.addEventListener('click', onClick);
  row.addEventListener('mouseenter', () => onChipHover(fiberId));
  row.addEventListener('mouseleave', () => onChipHover(null));
  return row;
}

function buildChildChip(
  child: ComponentRef,
  onNavigate: NavigateFn,
  onChipHover: ChipHoverFn,
): HTMLElement {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'child-chip';
  chip.textContent = child.name;
  chip.title = child.source ? pathString(child.source) : child.kind;
  chip.addEventListener('click', () => onNavigate(child.fiberId));
  chip.addEventListener('mouseenter', () => onChipHover(child.fiberId));
  chip.addEventListener('mouseleave', () => onChipHover(null));
  return chip;
}

function buildRenderSection(): { section: HTMLElement; setCount: (n: number, when: number) => void } {
  const section = document.createElement('section');
  section.className = 'section';
  const heading = document.createElement('h4');
  heading.className = 'section-title';
  const titleText = document.createElement('span');
  titleText.textContent = 'Re-renders';
  const counter = document.createElement('span');
  counter.className = 'render-count';
  counter.textContent = '· 0';
  heading.append(titleText, counter);
  section.append(heading);

  const sub = document.createElement('div');
  sub.className = 'render-sub';
  sub.textContent = 'Watching commits…';
  section.append(sub);

  let lastSeen = 0;
  function setCount(n: number, when: number): void {
    counter.textContent = `· ${n}`;
    lastSeen = when;
    sub.textContent = `Last: just now`;
    sub.classList.add('flash');
    window.setTimeout(() => sub.classList.remove('flash'), 400);
    refresh();
  }
  function refresh(): void {
    if (lastSeen === 0) return;
    const ago = Math.max(0, Math.round((Date.now() - lastSeen) / 1000));
    sub.textContent = ago < 2 ? 'Last: just now' : `Last: ${ago}s ago`;
  }
  window.setInterval(refresh, 1000);

  return { section, setCount };
}

function buildPropsSection(info: ComponentInfo, onCopy: CopyFn): HTMLElement | null {
  const entries = Object.entries(info.props);
  if (entries.length === 0) return null;

  const section = document.createElement('section');
  section.className = 'section';
  const heading = document.createElement('h4');
  heading.className = 'section-title';
  heading.textContent = `Props · ${entries.length}`;
  section.append(heading);

  const list = document.createElement('div');
  list.className = 'props-list';
  const showAll = entries.length <= PROPS_INITIAL;
  const initial = showAll ? entries : entries.slice(0, PROPS_INITIAL);
  for (const [key, val] of initial) list.append(buildPropRow(key, val, onCopy));
  section.append(list);

  if (!showAll) {
    const remaining = entries.slice(PROPS_INITIAL);
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'more-btn';
    more.textContent = `+${remaining.length} more`;
    more.addEventListener('click', () => {
      for (const [k, v] of remaining) list.append(buildPropRow(k, v, onCopy));
      more.remove();
    });
    section.append(more);
  }
  return section;
}

function buildPropRow(key: string, val: SerializedValue, onCopy: CopyFn): HTMLElement {
  const row = document.createElement('div');
  row.className = 'prop-row';
  const k = document.createElement('span');
  k.className = 'prop-key';
  k.textContent = key;
  const v = document.createElement('span');
  v.className = 'prop-val';
  const formatted = formatValue(val);
  v.textContent = formatted;
  v.title = formatted;
  const copyBtn = makeIconBtn(ICON_COPY, `Copy ${key}`, () => onCopy(formatted));
  copyBtn.classList.add('row-copy');
  row.append(k, v, copyBtn);
  return row;
}

// ─── DOM helpers (shared with tooltip) ──────────────────────────────

function buildAttrNode(name: string, value: string, onCopy: CopyFn): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'tt-html-attr-wrap';
  const row = document.createElement('div');
  row.className = 'tt-html-attr';
  const k = document.createElement('span');
  k.className = 'tt-html-attr-name';
  k.textContent = name;
  const eq = document.createElement('span');
  eq.className = 'tt-html-attr-eq';
  eq.textContent = '=';
  const v = document.createElement('span');
  v.className = 'tt-html-attr-value';
  v.textContent = value;
  v.title = value;
  row.append(k, eq, v);
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'tt-row-copy';
  copyBtn.title = `Copy ${name}`;
  copyBtn.innerHTML = ICON_COPY_SM;
  copyBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    onCopy(value);
  });
  wrap.append(row, copyBtn);
  return wrap;
}

export function buildOpenTag(el: Element, copyOuterHtml: () => void, onCopy: CopyFn): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'tt-html';

  const head = document.createElement('div');
  head.className = 'tt-html-head';

  const lt = document.createElement('span');
  lt.className = 'tt-html-bracket';
  lt.textContent = '<';

  const tagName = document.createElement('span');
  tagName.className = 'tt-html-tag';
  tagName.textContent = el.tagName.toLowerCase();

  head.append(lt, tagName);

  const attrs = Array.from(el.attributes);
  if (attrs.length === 0) {
    const close = document.createElement('span');
    close.className = 'tt-html-bracket';
    close.textContent = '>';
    head.append(close);
    wrap.append(head);
  } else {
    wrap.append(head);
    const attrsList = document.createElement('div');
    attrsList.className = 'tt-html-attrs';
    for (const a of attrs) {
      attrsList.append(buildAttrNode(a.name, a.value, onCopy));
    }
    wrap.append(attrsList);
    const closeRow = document.createElement('div');
    closeRow.className = 'tt-html-close';
    closeRow.textContent = '>';
    wrap.append(closeRow);
  }

  const copyGroup = document.createElement('div');
  copyGroup.className = 'tt-html-copy-group';

  const classes = (el.getAttribute('class') ?? '').trim();
  if (classes) {
    const copyClsBtn = document.createElement('button');
    copyClsBtn.type = 'button';
    copyClsBtn.className = 'tt-html-copy';
    copyClsBtn.title = 'Copy classes';
    copyClsBtn.textContent = 'Classes';
    copyClsBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      onCopy(classes);
    });
    copyGroup.append(copyClsBtn);
  }

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'tt-html-copy';
  copyBtn.title = 'Copy outerHTML';
  copyBtn.textContent = 'HTML';
  copyBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    copyOuterHtml();
  });
  copyGroup.append(copyBtn);
  head.append(copyGroup);

  return wrap;
}

function buildDomSection(
  el: Element | null,
  onCopy: CopyFn,
  navigate: (el: Element) => void,
): HTMLElement {
  const section = document.createElement('div');

  if (!el) {
    const empty = document.createElement('div');
    empty.className = 'source-empty';
    empty.textContent = 'No DOM element available.';
    section.append(empty);
    return section;
  }

  if (el.parentElement && el.parentElement !== document.documentElement) {
    const upRow = document.createElement('button');
    upRow.type = 'button';
    upRow.className = 'tt-dom-up';
    const upArrow = document.createElement('span');
    upArrow.className = 'tt-dom-up-arrow';
    upArrow.textContent = '↑';
    const upSel = document.createElement('span');
    upSel.className = 'tt-dom-up-sel';
    upSel.textContent = `parent: ${selectorOf(el.parentElement)}`;
    upRow.append(upArrow, upSel);
    upRow.addEventListener('click', () => navigate(el.parentElement!));
    section.append(upRow);
  }

  section.append(buildOpenTag(el, () => onCopy(el.outerHTML), onCopy));

  const domAttrs = Array.from(el.attributes);
  if (domAttrs.length > 0) {
    const secH = document.createElement('div');
    secH.className = 'tt-section-h';
    secH.textContent = `Attributes · ${domAttrs.length}`;
    section.append(secH);

    const table = document.createElement('table');
    table.className = 'tt-attr-table';
    for (const a of domAttrs) {
      const tr = document.createElement('tr');
      tr.className = 'tt-attr-row';
      const tdName = document.createElement('td');
      tdName.className = 'tt-attr-name';
      tdName.textContent = a.name;
      const tdVal = document.createElement('td');
      tdVal.className = 'tt-attr-val';
      tdVal.textContent = a.value || '(empty)';
      tdVal.title = a.value;
      const tdCopy = document.createElement('td');
      tdCopy.className = 'tt-attr-copy-cell';
      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'tt-row-copy';
      copyBtn.title = `Copy ${a.name}`;
      copyBtn.innerHTML = ICON_COPY_SM;
      const val = a.value;
      copyBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        onCopy(val);
      });
      tdCopy.append(copyBtn);
      tr.append(tdName, tdVal, tdCopy);
      table.append(tr);
    }
    section.append(table);
  }

  if (el.children.length > 0) {
    const list = document.createElement('div');
    list.className = 'tt-dom-children';
    const max = 12;
    const shown = Array.from(el.children).slice(0, max);
    for (const child of shown) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'tt-dom-child';
      const arrow = document.createElement('span');
      arrow.className = 'tt-dom-child-arrow';
      arrow.textContent = '↳';
      const sel = document.createElement('span');
      sel.className = 'tt-dom-child-sel';
      sel.textContent = selectorOf(child);
      row.append(arrow, sel);
      row.addEventListener('click', () => navigate(child));
      list.append(row);
    }
    if (el.children.length > max) {
      const more = document.createElement('div');
      more.className = 'tt-dom-more';
      more.textContent = `+${el.children.length - max} more`;
      list.append(more);
    }
    section.append(list);
  } else {
    const text = (el.textContent ?? '').trim();
    if (text) {
      const t = document.createElement('div');
      t.className = 'tt-dom-text';
      t.textContent = text.length > 200 ? text.slice(0, 200) + '…' : text;
      t.title = text;
      section.append(t);
    } else {
      const empty = document.createElement('div');
      empty.className = 'tt-dom-empty';
      empty.textContent = '(empty)';
      section.append(empty);
    }
  }

  const closeTag = document.createElement('div');
  closeTag.className = 'tt-html-close-tag';
  closeTag.textContent = `</${el.tagName.toLowerCase()}>`;
  section.append(closeTag);

  return section;
}

// ─── Computed styles section ─────────────────────────────────────────

const COMPUTED_KEYS: { label: string; prop: string; editable: boolean; format?: (v: string) => string }[] = [
  { label: 'display', prop: 'display', editable: true },
  { label: 'position', prop: 'position', editable: true },
  { label: 'z-index', prop: 'z-index', editable: true },
  { label: 'background', prop: 'background-color', editable: true, format: shortenColor },
  { label: 'color', prop: 'color', editable: true, format: shortenColor },
  { label: 'font', prop: 'font', editable: false, format: shortenFont },
  { label: 'size', prop: 'box', editable: false, format: () => '' },
  { label: 'padding', prop: 'padding', editable: true, format: shortenSpacing },
  { label: 'margin', prop: 'margin', editable: true, format: shortenSpacing },
  { label: 'border', prop: 'border', editable: true, format: shortenBorder },
  { label: 'radius', prop: 'border-radius', editable: true },
];

function shortenFontFamily(v: string): string {
  const first = v.split(',')[0]?.trim() ?? '';
  return first.replace(/^["']|["']$/g, '');
}

function shortenColor(v: string): string {
  if (!v || v === 'rgba(0, 0, 0, 0)') return 'transparent';
  const m = v.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
  if (m) {
    const r = parseInt(m[1]!, 10);
    const g = parseInt(m[2]!, 10);
    const b = parseInt(m[3]!, 10);
    const a = m[4] != null ? parseFloat(m[4]) : 1;
    const hex = `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
    if (a < 1) return `${hex} · α${a.toFixed(2)}`;
    return hex;
  }
  return v;
}

function shortenFont(_v: string): string {
  return '';
}

function shortenSpacing(v: string): string {
  // collapse repeated zero values
  const parts = v.split(' ');
  if (parts.every((p) => p === parts[0])) return parts[0]!;
  return v;
}

function shortenBorder(v: string): string {
  return v.replace(/\s+/g, ' ').trim();
}

function buildComputedSection(el: Element, onCopy: CopyFn): HTMLElement | null {
  if (!el || !(el instanceof HTMLElement)) return null;
  const cs = window.getComputedStyle(el);
  const details = document.createElement('details');
  details.className = 'section section-collapse';
  const summary = document.createElement('summary');
  summary.className = 'section-title';
  summary.textContent = 'Computed';
  details.append(summary);

  const body = document.createElement('div');
  body.className = 'computed-list';

  for (const k of COMPUTED_KEYS) {
    if (k.editable) {
      body.append(buildEditableCssRow(el, k.prop, k.label, k.format));
      continue;
    }
    if (k.label === 'font') {
      // Split font into individually-readable & copiable rows
      body.append(buildKvRow('font-size', cs.getPropertyValue('font-size'), onCopy));
      body.append(buildKvRow('line-height', cs.getPropertyValue('line-height'), onCopy));
      body.append(buildKvRow('font-weight', cs.getPropertyValue('font-weight'), onCopy));
      body.append(buildKvRow('font-family', shortenFontFamily(cs.getPropertyValue('font-family')), onCopy));
      continue;
    }
    let value = '';
    if (k.label === 'size') {
      const r = el.getBoundingClientRect();
      value = `${Math.round(r.width)} × ${Math.round(r.height)}px`;
    }
    if (!value) continue;
    body.append(buildKvRow(k.label, value, onCopy));
  }
  body.append(buildAddCssRow(el, 'kv'));
  details.append(body);
  return details;
}

function buildKvRow(key: string, val: string, onCopy?: CopyFn): HTMLElement {
  const row = document.createElement('div');
  row.className = 'kv-row';
  const k = document.createElement('span');
  k.className = 'kv-key';
  k.textContent = key;
  const v = document.createElement('span');
  v.className = 'kv-val';
  v.textContent = val;
  v.title = val;
  row.append(k, v);
  if (onCopy) {
    const copyBtn = makeIconBtn(ICON_COPY, `Copy ${key}`, () => onCopy(val));
    copyBtn.classList.add('row-copy');
    row.append(copyBtn);
  }
  return row;
}

// ─── Editable CSS rows (used by Computed section + tooltip CSS tab) ──

type CssRowVariant = 'kv' | 'tt';

function cssRowClasses(variant: CssRowVariant): { row: string; key: string; val: string } {
  return variant === 'tt'
    ? { row: 'tt-kv tt-kv-edit', key: 'tt-kv-key', val: 'tt-kv-val tt-kv-input' }
    : { row: 'kv-row kv-row-edit', key: 'kv-key', val: 'kv-val kv-input' };
}

export function buildEditableCssRow(
  el: HTMLElement,
  prop: string,
  label: string,
  formatRead?: (v: string) => string,
  variant: CssRowVariant = 'kv',
): HTMLElement {
  const c = cssRowClasses(variant);
  const row = document.createElement('div');
  row.className = c.row;

  const k = document.createElement('span');
  k.className = c.key;
  k.textContent = label;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = c.val;
  input.spellcheck = false;

  const refresh = (): void => {
    const cs = window.getComputedStyle(el);
    const inline = el.style.getPropertyValue(prop);
    const raw = (inline || cs.getPropertyValue(prop)).trim();
    input.dataset.raw = raw;
    const display = formatRead ? formatRead(raw) || raw : raw;
    input.value = display;
    input.title = raw;
  };
  refresh();

  input.addEventListener('focus', () => {
    input.value = input.dataset.raw ?? '';
    input.select();
  });

  let committedViaKey = false;
  input.addEventListener('blur', () => {
    if (committedViaKey) {
      committedViaKey = false;
      return;
    }
    const desired = input.value.trim();
    const current = input.dataset.raw ?? '';
    if (desired !== current) {
      try {
        el.style.setProperty(prop, desired);
      } catch {
        /* invalid value — refresh restores last known */
      }
    }
    refresh();
  });

  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      const desired = input.value.trim();
      try {
        el.style.setProperty(prop, desired);
      } catch {
        /* noop */
      }
      committedViaKey = true;
      input.blur();
      refresh();
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      input.value = input.dataset.raw ?? '';
      committedViaKey = true;
      input.blur();
    }
  });

  row.append(k, input);
  return row;
}

export function buildAddCssRow(el: HTMLElement, variant: CssRowVariant = 'kv'): HTMLElement {
  const c = cssRowClasses(variant);
  const row = document.createElement('div');
  row.className = `${c.row.split(' ')[0]} ${variant === 'tt' ? 'tt-kv-add' : 'kv-row-add'}`;

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = `${c.key} ${variant === 'tt' ? 'tt-kv-input' : 'kv-input'} kv-input-name`;
  nameInput.placeholder = '+ property';
  nameInput.spellcheck = false;

  const valInput = document.createElement('input');
  valInput.type = 'text';
  valInput.className = `${c.val.split(' ')[0]} ${variant === 'tt' ? 'tt-kv-input' : 'kv-input'}`;
  valInput.placeholder = 'value';
  valInput.spellcheck = false;

  function commit(): boolean {
    const prop = nameInput.value.trim();
    const val = valInput.value.trim();
    if (!prop || !val) return false;
    try {
      el.style.setProperty(prop, val);
    } catch {
      return false;
    }
    const newRow = buildEditableCssRow(el, prop, prop, undefined, variant);
    row.parentElement?.insertBefore(newRow, row);
    nameInput.value = '';
    valInput.value = '';
    return true;
  }

  nameInput.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === 'Tab') {
      if (nameInput.value.trim()) {
        ev.preventDefault();
        valInput.focus();
      }
    } else if (ev.key === 'Escape') {
      nameInput.value = '';
      valInput.value = '';
      nameInput.blur();
    }
  });
  valInput.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      if (commit()) nameInput.focus();
    } else if (ev.key === 'Escape') {
      nameInput.value = '';
      valInput.value = '';
      valInput.blur();
    }
  });

  row.append(nameInput, valInput);
  return row;
}

// ─── Tailwind decode ─────────────────────────────────────────────────

const TAILWIND_VARIANTS = [
  'sm:', 'md:', 'lg:', 'xl:', '2xl:',
  'dark:', 'hover:', 'focus:', 'focus-visible:', 'focus-within:',
  'active:', 'disabled:', 'aria-', 'data-',
  'group-hover:', 'group-focus:', 'peer-hover:', 'peer-focus:',
  'first:', 'last:', 'odd:', 'even:',
  'before:', 'after:', 'placeholder:',
  'rtl:', 'ltr:', 'motion-safe:', 'motion-reduce:', 'print:',
];

function classifyTailwindClass(c: string): string {
  for (const v of TAILWIND_VARIANTS) {
    if (c.startsWith(v)) {
      // for chained variants like md:hover:bg-..., return the first
      return v.slice(0, v.length - 1) || v;
    }
  }
  return 'base';
}

function buildTailwindSection(el: Element | null): HTMLElement | null {
  if (!el) return null;
  const className = (el.getAttribute('class') ?? '').trim();
  if (!className) return null;
  const classes = className.split(/\s+/).filter(Boolean);
  if (classes.length === 0) return null;

  const groups = new Map<string, string[]>();
  for (const c of classes) {
    const g = classifyTailwindClass(c);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(c);
  }

  const details = document.createElement('details');
  details.className = 'section section-collapse';
  const summary = document.createElement('summary');
  summary.className = 'section-title';
  summary.textContent = `Classes · ${classes.length}`;
  details.append(summary);

  const body = document.createElement('div');
  body.className = 'tw-groups';
  // Render base first, then alphabetical
  const orderedKeys = ['base', ...[...groups.keys()].filter((k) => k !== 'base').sort()];
  for (const key of orderedKeys) {
    const list = groups.get(key);
    if (!list || list.length === 0) continue;
    const group = document.createElement('div');
    group.className = 'tw-group';
    const k = document.createElement('span');
    k.className = 'tw-key';
    k.textContent = key;
    const v = document.createElement('span');
    v.className = 'tw-val';
    v.textContent = list.join(' ');
    group.append(k, v);
    body.append(group);
  }
  details.append(body);
  return details;
}

// ─── A11y mini-audit ─────────────────────────────────────────────────

function checkA11y(el: Element | null): string[] {
  if (!el) return [];
  const warnings: string[] = [];
  const tag = el.tagName.toLowerCase();

  if (tag === 'img') {
    const alt = el.getAttribute('alt');
    if (alt == null) warnings.push('<img> is missing alt attribute');
  }

  if (tag === 'button' || tag === 'a') {
    const text = (el.textContent ?? '').trim();
    const aria = el.getAttribute('aria-label') ?? el.getAttribute('aria-labelledby');
    const title = el.getAttribute('title');
    if (!text && !aria && !title) {
      warnings.push(`<${tag}> has no accessible name (no text, aria-label, or title)`);
    }
    if (tag === 'a' && !el.getAttribute('href')) {
      warnings.push('<a> without href — should be <button>');
    }
  }

  if (tag === 'input' || tag === 'select' || tag === 'textarea') {
    const id = el.getAttribute('id');
    const aria = el.getAttribute('aria-label') ?? el.getAttribute('aria-labelledby');
    const wrappingLabel = el.closest('label');
    const labelFor = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
    if (!aria && !wrappingLabel && !labelFor) {
      warnings.push(`<${tag}> has no associated <label>`);
    }
  }

  // onClick on non-interactive without role
  const interactive = ['a', 'button', 'input', 'select', 'textarea', 'summary'];
  if (!interactive.includes(tag)) {
    const role = el.getAttribute('role');
    const tabindex = el.getAttribute('tabindex');
    const looksClickable =
      el.hasAttribute('onclick') || (el as HTMLElement).style.cursor === 'pointer';
    if (looksClickable && !role && tabindex == null) {
      warnings.push(`<${tag}> looks clickable but has no role or tabindex`);
    }
  }

  // contrast (foreground vs background) — naive
  if (el instanceof HTMLElement) {
    const cs = window.getComputedStyle(el);
    const fg = parseRgb(cs.color);
    const bg = effectiveBackground(el);
    if (fg && bg) {
      const ratio = contrastRatio(fg, bg);
      const fontSize = parseFloat(cs.fontSize);
      const isLarge = fontSize >= 18 || (fontSize >= 14 && parseInt(cs.fontWeight, 10) >= 700);
      const min = isLarge ? 3 : 4.5;
      if (ratio < min) {
        warnings.push(
          `Contrast ratio ${ratio.toFixed(2)}:1 (needs ${min}:1 for ${isLarge ? 'large' : 'body'} text)`,
        );
      }
    }
  }

  return warnings;
}

function parseRgb(v: string): [number, number, number, number] | null {
  const m = v.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
  if (!m) return null;
  return [
    parseInt(m[1]!, 10),
    parseInt(m[2]!, 10),
    parseInt(m[3]!, 10),
    m[4] != null ? parseFloat(m[4]) : 1,
  ];
}

function effectiveBackground(el: HTMLElement): [number, number, number, number] | null {
  let cur: HTMLElement | null = el;
  while (cur) {
    const cs = window.getComputedStyle(cur);
    const rgb = parseRgb(cs.backgroundColor);
    if (rgb && rgb[3] > 0) return rgb;
    cur = cur.parentElement;
  }
  return [255, 255, 255, 1];
}

function relativeLuminance([r, g, b]: [number, number, number, number]): number {
  const [R, G, B] = [r, g, b].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(
  fg: [number, number, number, number],
  bg: [number, number, number, number],
): number {
  const L1 = relativeLuminance(fg);
  const L2 = relativeLuminance(bg);
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}

// ─── Generic anti-pattern hints ──────────────────────────────────────

function checkHints(info: ComponentInfo, el: Element | null): string[] {
  const hints: string[] = [];
  const inlineFns = Object.entries(info.props).filter(
    ([, v]) => v.type === 'function' && v.inline,
  );
  if (inlineFns.length > 0) {
    hints.push(
      `${inlineFns.length} inline function${inlineFns.length > 1 ? 's' : ''} in props (${inlineFns
        .map(([k]) => k)
        .join(', ')}) — recreated on each parent render`,
    );
  }

  if ('dangerouslySetInnerHTML' in info.props) {
    hints.push('Uses dangerouslySetInnerHTML — verify XSS safety');
  }

  if (el) {
    const cls = el.getAttribute('class') ?? '';
    const count = cls.split(/\s+/).filter(Boolean).length;
    if (count >= 20) {
      hints.push(`${count} classes on root element — consider extracting`);
    }
  }
  return hints;
}

function buildA11yTabContent(info: ComponentInfo, el: Element | null): HTMLElement {
  const section = document.createElement('div');
  const warnings = checkA11y(el);
  const hints = checkHints(info, el);

  if (warnings.length === 0 && hints.length === 0) {
    const ok = document.createElement('div');
    ok.className = 'a11y-ok';
    ok.textContent = '✓ No accessibility issues detected';
    section.append(ok);
    return section;
  }

  if (warnings.length > 0) {
    const heading = document.createElement('h4');
    heading.className = 'section-title';
    heading.textContent = `A11y · ${warnings.length}`;
    section.append(heading);
    for (const w of warnings) {
      const row = document.createElement('div');
      row.className = 'warn-row';
      const dot = document.createElement('span');
      dot.className = 'warn-dot';
      dot.textContent = '⚠';
      const text = document.createElement('span');
      text.className = 'warn-text';
      text.textContent = w;
      row.append(dot, text);
      section.append(row);
    }
  }

  if (hints.length > 0) {
    const heading = document.createElement('h4');
    heading.className = 'section-title';
    heading.textContent = `Hints · ${hints.length}`;
    section.append(heading);
    for (const h of hints) {
      const row = document.createElement('div');
      row.className = 'hint-row';
      const dot = document.createElement('span');
      dot.className = 'hint-dot';
      dot.textContent = '◆';
      const text = document.createElement('span');
      text.className = 'hint-text';
      text.textContent = h;
      row.append(dot, text);
      section.append(row);
    }
  }

  return section;
}

// ─── Owner chain ─────────────────────────────────────────────────────

function buildOwnerSection(
  info: ComponentInfo,
  onNavigate: NavigateFn,
  onChipHover: ChipHoverFn,
): HTMLElement | null {
  if (info.ownerChain.length === 0) return null;
  const section = document.createElement('section');
  section.className = 'section';
  section.addEventListener('mouseleave', () => onChipHover(null));
  const heading = document.createElement('h4');
  heading.className = 'section-title';
  heading.textContent = 'Rendered by';
  section.append(heading);
  for (const owner of info.ownerChain) {
    section.append(buildOwnerRow(owner, onNavigate, onChipHover));
  }
  return section;
}

function buildOwnerRow(
  owner: OwnerInfo,
  onNavigate: NavigateFn,
  onChipHover: ChipHoverFn,
): HTMLElement {
  const navigable = !!owner.fiberId;
  const row = document.createElement(navigable ? 'button' : 'div');
  row.className = 'owner-row';
  if (navigable) {
    (row as HTMLButtonElement).type = 'button';
    row.classList.add('owner-row-nav');
    const fiberId = owner.fiberId!;
    row.addEventListener('click', () => onNavigate(fiberId));
    row.addEventListener('mouseenter', () => onChipHover(fiberId));
    row.addEventListener('mouseleave', () => onChipHover(null));
  }

  const arrow = document.createElement('span');
  arrow.className = 'owner-arrow';
  arrow.textContent = '↑';

  const main = document.createElement('div');
  main.className = 'owner-main';
  const name = document.createElement('span');
  name.className = 'owner-name';
  name.textContent = owner.name;
  main.append(name);

  if (owner.source) {
    const file = owner.source.fileName.split('/').pop() ?? owner.source.fileName;
    const line = owner.source.lineNumber != null ? `:${owner.source.lineNumber}` : '';
    const src = document.createElement('span');
    src.className = 'owner-src';
    src.textContent = `${file}${line}`;
    src.title = pathString(owner.source);
    main.append(src);
  }

  row.append(arrow, main);
  return row;
}

// ─── Main render ─────────────────────────────────────────────────────

export function renderPanel(root: ShadowRoot, opts: RenderPanelOptions): PanelHandle {
  root.querySelector('.panel')?.remove();

  const {
    info,
    targetEl,
    onClose,
    onCopy,
    onNavigate,
    onChipHover,
    onToggleInstances,
    onPositionChange,
    initialPosition,
  } = opts;

  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.addEventListener('mouseleave', () => onChipHover(null));

  const renderSection = buildRenderSection();

  let currentDomEl: Element | null = targetEl;
  let activeTab: PanelTab = 'comp';

  const a11yCount = checkA11y(targetEl).length + checkHints(info, targetEl).length;
  const tabsHandle = buildPanelTabs(
    activeTab,
    { a11y: a11yCount > 0 ? a11yCount : undefined },
    (tab) => {
      activeTab = tab;
      const newBody = buildBody();
      body.replaceWith(newBody);
      body = newBody;
    },
  );

  function buildBody(): HTMLElement {
    const b = document.createElement('div');
    b.className = 'panel-body';
    switch (activeTab) {
      case 'comp': {
        const navSection = buildNavSection(info, onNavigate, onChipHover);
        if (navSection) b.append(navSection);
        b.append(renderSection.section);
        const propsSection = buildPropsSection(info, onCopy);
        if (propsSection) b.append(propsSection);
        const ownerSection = buildOwnerSection(info, onNavigate, onChipHover);
        if (ownerSection) b.append(ownerSection);
        break;
      }
      case 'dom': {
        b.append(
          buildDomSection(currentDomEl, onCopy, (el) => {
            currentDomEl = el;
            const newBody = buildBody();
            body.replaceWith(newBody);
            body = newBody;
          }),
        );
        break;
      }
      case 'css': {
        const cssEl = currentDomEl instanceof HTMLElement
          ? currentDomEl
          : targetEl instanceof HTMLElement ? targetEl : null;
        if (cssEl) {
          const computedSection = buildComputedSection(cssEl, onCopy);
          if (computedSection) {
            computedSection.setAttribute('open', '');
            b.append(computedSection);
          }
        }
        const tailwindSection = buildTailwindSection(currentDomEl ?? targetEl);
        if (tailwindSection) {
          tailwindSection.setAttribute('open', '');
          b.append(tailwindSection);
        }
        break;
      }
      case 'a11y': {
        b.append(buildA11yTabContent(info, currentDomEl ?? targetEl));
        break;
      }
    }
    return b;
  }

  let body = buildBody();

  const headerHandle = buildHeader(root, info, onClose, onCopy, onToggleInstances);
  panel.append(headerHandle.el, tabsHandle.el, body);
  attachDrag(panel, headerHandle.el, onPositionChange);

  if (initialPosition) {
    panel.style.left = `${initialPosition.x}px`;
    panel.style.top = `${initialPosition.y}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  }

  root.append(panel);

  return {
    updateRenderCount: (n, when) => renderSection.setCount(n, when),
  };
}

export function showToast(root: ShadowRoot, text: string, durationMs = 1200): void {
  let toast = root.querySelector<HTMLDivElement>('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    root.append(toast);
  }
  toast.textContent = text;
  toast.classList.add('visible');
  window.setTimeout(() => {
    toast?.classList.remove('visible');
  }, durationMs);
}
