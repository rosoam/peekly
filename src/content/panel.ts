import type {
  ComponentInfo,
  ComponentRef,
  EditorId,
  OwnerInfo,
  SerializedValue,
  SourceLocation,
} from '../shared/messages';

const PROPS_INITIAL = 8;

export type PanelHandle = {
  updateRenderCount(count: number, lastRenderAt: number): void;
};

export type RenderPanelOptions = {
  info: ComponentInfo;
  targetEl: Element | null;
  editor: EditorId;
  onClose: () => void;
  onCopy: (text: string) => void;
  onNavigate: (fiberId: string) => void;
  onToggleInstances: () => void;
  onPositionChange: (pos: { x: number; y: number }) => void;
  initialPosition: { x: number; y: number } | null;
};

// ─── Formatting ──────────────────────────────────────────────────────

function formatValue(v: SerializedValue): string {
  switch (v.type) {
    case 'primitive':
      if (typeof v.value === 'string') return JSON.stringify(v.value);
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

function editorUrl(editor: EditorId, src: SourceLocation): string | null {
  const path = src.fileName;
  const line = src.lineNumber ?? 1;
  const col = src.columnNumber ?? 1;
  switch (editor) {
    case 'vscode':
      return `vscode://file/${path}:${line}:${col}`;
    case 'cursor':
      return `cursor://file/${path}:${line}:${col}`;
    case 'webstorm':
      return `webstorm://open?file=${encodeURIComponent(path)}&line=${line}&column=${col}`;
    case 'sublime':
      return `subl://open?url=${encodeURIComponent(`file://${path}`)}&line=${line}`;
    case 'none':
      return null;
  }
}

function editorLabel(editor: EditorId): string {
  switch (editor) {
    case 'vscode':
      return 'VS Code';
    case 'cursor':
      return 'Cursor';
    case 'webstorm':
      return 'WebStorm';
    case 'sublime':
      return 'Sublime';
    case 'none':
      return '';
  }
}

function pathString(src: SourceLocation): string {
  const line = src.lineNumber != null ? `:${src.lineNumber}` : '';
  const col = src.columnNumber != null ? `:${src.columnNumber}` : '';
  return `${src.fileName}${line}${col}`;
}

function displayPath(src: SourceLocation): string {
  const full = pathString(src);
  const markers = ['/src/', '/app/', '/pages/', '/components/', '/lib/', '/features/'];
  for (const m of markers) {
    const idx = full.indexOf(m);
    if (idx > 0) return full.slice(idx + 1);
  }
  if (full.length <= 70) return full;
  return '…' + full.slice(-69);
}

function buildSummary(info: ComponentInfo): string {
  const lines: string[] = [];
  lines.push(`${info.name} (${info.kind})`);
  if (info.source) lines.push(pathString(info.source));
  else lines.push('(no source — production build)');
  const propEntries = Object.entries(info.props);
  if (propEntries.length > 0) {
    lines.push('');
    lines.push(`Props (${propEntries.length}):`);
    for (const [k, v] of propEntries) lines.push(`  ${k}: ${formatValue(v)}`);
  }
  if (info.children.length > 0) {
    lines.push('');
    lines.push('Children:');
    for (const c of info.children) {
      const where = c.source ? ` — ${pathString(c.source)}` : '';
      lines.push(`  ${c.name}${where}`);
    }
  }
  if (info.ownerChain.length > 0) {
    lines.push('');
    lines.push('Rendered by:');
    for (const o of info.ownerChain) {
      const where = o.source ? ` — ${pathString(o.source)}` : '';
      lines.push(`  ${o.name}${where}`);
    }
  }
  return lines.join('\n');
}

// ─── Generic UI helpers ──────────────────────────────────────────────

type CopyFn = (text: string) => void;
type NavigateFn = (fiberId: string) => void;

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

function buildHeader(
  root: ShadowRoot,
  info: ComponentInfo,
  onClose: () => void,
  onCopy: CopyFn,
  onToggleInstances: () => void,
): HTMLElement {
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
  return header;
}

function buildSourceCard(
  info: ComponentInfo,
  editor: EditorId,
  onCopy: CopyFn,
): HTMLElement {
  const card = document.createElement('section');
  card.className = 'source-card';

  if (!info.source) {
    card.classList.add('source-card-empty');
    const msg = document.createElement('div');
    msg.className = 'source-empty';
    msg.innerHTML =
      'No source location.<br/><span class="source-empty-sub">Production build, or React JSX dev transform missing.</span>';
    card.append(msg);
    return card;
  }

  const cardHeader = document.createElement('div');
  cardHeader.className = 'source-card-header';
  const cardLabel = document.createElement('span');
  cardLabel.className = 'source-card-label';
  cardLabel.textContent = 'SOURCE';
  cardHeader.append(cardLabel);

  const path = document.createElement('div');
  path.className = 'source-path';
  path.textContent = displayPath(info.source);
  path.title = pathString(info.source);

  const actions = document.createElement('div');
  actions.className = 'source-actions';

  const url = editor !== 'none' ? editorUrl(editor, info.source) : null;
  if (url) {
    const openBtn = makeButton(`Open in ${editorLabel(editor)} →`, 'primary', () => {
      void chrome.runtime.sendMessage({ kind: 'open-editor', url });
    });
    openBtn.classList.add('btn-grow');
    actions.append(openBtn);
  }

  const copyBtn = makeButton('Copy path', 'secondary', () => onCopy(pathString(info.source!)));
  actions.append(copyBtn);

  card.append(cardHeader, path, actions);
  return card;
}

function buildNavSection(info: ComponentInfo, onNavigate: NavigateFn): HTMLElement | null {
  if (!info.parent && info.children.length === 0) return null;
  const section = document.createElement('section');
  section.className = 'section';
  const heading = document.createElement('h4');
  heading.className = 'section-title';
  heading.textContent = 'Navigation';
  section.append(heading);

  if (info.parent) {
    const parentRow = buildNavRow('↑', `Parent: ${info.parent.name}`, () =>
      onNavigate(info.parent!.fiberId),
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
      list.append(buildChildChip(child, onNavigate));
    }
    section.append(list);
  }
  return section;
}

function buildNavRow(arrow: string, text: string, onClick: () => void): HTMLElement {
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
  return row;
}

function buildChildChip(child: ComponentRef, onNavigate: NavigateFn): HTMLElement {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'child-chip';
  chip.textContent = child.name;
  chip.title = child.source ? pathString(child.source) : child.kind;
  chip.addEventListener('click', () => onNavigate(child.fiberId));
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

function buildPropsSection(info: ComponentInfo): HTMLElement | null {
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
  for (const [key, val] of initial) list.append(buildPropRow(key, val));
  section.append(list);

  if (!showAll) {
    const remaining = entries.slice(PROPS_INITIAL);
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'more-btn';
    more.textContent = `+${remaining.length} more`;
    more.addEventListener('click', () => {
      for (const [k, v] of remaining) list.append(buildPropRow(k, v));
      more.remove();
    });
    section.append(more);
  }
  return section;
}

function buildPropRow(key: string, val: SerializedValue): HTMLElement {
  const row = document.createElement('div');
  row.className = 'prop-row';
  const k = document.createElement('span');
  k.className = 'prop-key';
  k.textContent = key;
  const v = document.createElement('span');
  v.className = 'prop-val';
  v.textContent = formatValue(val);
  v.title = formatValue(val);
  row.append(k, v);
  return row;
}

// ─── Computed styles section ─────────────────────────────────────────

const COMPUTED_KEYS: { label: string; prop: string; format?: (v: string) => string }[] = [
  { label: 'display', prop: 'display' },
  { label: 'position', prop: 'position' },
  { label: 'z-index', prop: 'z-index' },
  { label: 'background', prop: 'background-color', format: shortenColor },
  { label: 'color', prop: 'color', format: shortenColor },
  { label: 'font', prop: 'font', format: shortenFont },
  { label: 'size', prop: 'box', format: () => '' },
  { label: 'padding', prop: 'padding', format: shortenSpacing },
  { label: 'margin', prop: 'margin', format: shortenSpacing },
  { label: 'border', prop: 'border', format: shortenBorder },
  { label: 'radius', prop: 'border-radius' },
];

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

function buildComputedSection(el: Element): HTMLElement | null {
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
    let value = '';
    if (k.label === 'font') {
      const fs = cs.getPropertyValue('font-size');
      const fw = cs.getPropertyValue('font-weight');
      const lh = cs.getPropertyValue('line-height');
      value = `${fs} / ${lh} · ${fw}`;
    } else if (k.label === 'size') {
      const r = el.getBoundingClientRect();
      value = `${Math.round(r.width)} × ${Math.round(r.height)}px`;
    } else {
      const raw = cs.getPropertyValue(k.prop);
      value = k.format ? k.format(raw) : raw;
    }
    if (!value) continue;
    body.append(buildKvRow(k.label, value));
  }
  details.append(body);
  return details;
}

function buildKvRow(key: string, val: string): HTMLElement {
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

function buildA11ySection(el: Element | null): HTMLElement | null {
  const warnings = checkA11y(el);
  if (warnings.length === 0) return null;
  const section = document.createElement('section');
  section.className = 'section section-warn';
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
  return section;
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

function buildHintsSection(info: ComponentInfo, el: Element | null): HTMLElement | null {
  const hints = checkHints(info, el);
  if (hints.length === 0) return null;
  const section = document.createElement('section');
  section.className = 'section section-hint';
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
  return section;
}

// ─── Owner chain ─────────────────────────────────────────────────────

function buildOwnerSection(info: ComponentInfo, editor: EditorId): HTMLElement | null {
  if (info.ownerChain.length === 0) return null;
  const section = document.createElement('section');
  section.className = 'section';
  const heading = document.createElement('h4');
  heading.className = 'section-title';
  heading.textContent = 'Rendered by';
  section.append(heading);
  for (const owner of info.ownerChain) section.append(buildOwnerRow(owner, editor));
  return section;
}

function buildOwnerRow(owner: OwnerInfo, editor: EditorId): HTMLElement {
  const row = document.createElement('div');
  row.className = 'owner-row';

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
    if (editor !== 'none') {
      const url = editorUrl(editor, owner.source);
      if (url) {
        src.classList.add('clickable');
        src.title = `Open ${pathString(owner.source)} in ${editorLabel(editor)}`;
        src.addEventListener('click', () =>
          chrome.runtime.sendMessage({ kind: 'open-editor', url }),
        );
      }
    }
    main.append(src);
  }

  row.append(arrow, main);
  return row;
}

// ─── Footer ──────────────────────────────────────────────────────────

function buildFooter(info: ComponentInfo, onCopy: CopyFn): HTMLElement {
  const footer = document.createElement('div');
  footer.className = 'panel-footer';
  const copyAll = makeButton('Copy all', 'ghost', () => onCopy(buildSummary(info)));
  copyAll.classList.add('btn-full');
  footer.append(copyAll);
  return footer;
}

// ─── Main render ─────────────────────────────────────────────────────

export function renderPanel(root: ShadowRoot, opts: RenderPanelOptions): PanelHandle {
  root.querySelector('.panel')?.remove();

  const { info, targetEl, editor, onClose, onCopy, onNavigate, onToggleInstances, onPositionChange, initialPosition } =
    opts;

  const panel = document.createElement('div');
  panel.className = 'panel';

  const body = document.createElement('div');
  body.className = 'panel-body';

  body.append(buildSourceCard(info, editor, onCopy));

  const navSection = buildNavSection(info, onNavigate);
  if (navSection) body.append(navSection);

  const renderSection = buildRenderSection();
  body.append(renderSection.section);

  const propsSection = buildPropsSection(info);
  if (propsSection) body.append(propsSection);

  const computedSection = buildComputedSection(targetEl ?? document.body);
  if (computedSection) body.append(computedSection);

  const tailwindSection = buildTailwindSection(targetEl);
  if (tailwindSection) body.append(tailwindSection);

  const a11ySection = buildA11ySection(targetEl);
  if (a11ySection) body.append(a11ySection);

  const hintsSection = buildHintsSection(info, targetEl);
  if (hintsSection) body.append(hintsSection);

  const ownerSection = buildOwnerSection(info, editor);
  if (ownerSection) body.append(ownerSection);

  const header = buildHeader(root, info, onClose, onCopy, onToggleInstances);
  panel.append(header, body, buildFooter(info, onCopy));

  if (initialPosition) {
    panel.style.left = `${initialPosition.x}px`;
    panel.style.top = `${initialPosition.y}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  }

  attachDrag(panel, header, onPositionChange);

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
