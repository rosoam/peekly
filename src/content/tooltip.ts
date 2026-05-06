import type { ComponentPreview, EditorId, SourceLocation } from '../shared/messages';
import { buildEditableCssRow, buildAddCssRow } from './panel';

const TOOLTIP_WIDTH = 340;
const TOOLTIP_OFFSET_X = 16;
const TOOLTIP_OFFSET_Y = 12;
const VIEWPORT_MARGIN = 8;

type Tab = 'comp' | 'dom' | 'css' | 'a11y';
let activeTab: Tab = 'comp';

export type TooltipState = {
  el: HTMLElement;
  setVisible(visible: boolean): void;
  update(args: { preview: ComponentPreview; targetEl: Element | null; cursor: { x: number; y: number } | null }): void;
  setPinned(pinned: boolean): void;
  isPinned(): boolean;
  hide(): void;
  contains(node: Node): boolean;
};

// ─── Helpers ─────────────────────────────────────────────────────────

function pathString(src: SourceLocation): string {
  const line = src.lineNumber != null ? `:${src.lineNumber}` : '';
  const col = src.columnNumber != null ? `:${src.columnNumber}` : '';
  return `${src.fileName}${line}${col}`;
}

function shortPath(src: SourceLocation): string {
  const full = pathString(src);
  const markers = ['/src/', '/app/', '/pages/', '/components/', '/lib/', '/features/'];
  for (const m of markers) {
    const idx = full.indexOf(m);
    if (idx > 0) return full.slice(idx + 1);
  }
  if (full.length <= 56) return full;
  return '…' + full.slice(-55);
}

function editorUrl(editor: EditorId, src: SourceLocation): string | null {
  const path = src.fileName;
  const line = src.lineNumber ?? 1;
  const col = src.columnNumber ?? 1;
  switch (editor) {
    case 'vscode': return `vscode://file/${path}:${line}:${col}`;
    case 'cursor': return `cursor://file/${path}:${line}:${col}`;
    case 'webstorm': return `webstorm://open?file=${encodeURIComponent(path)}&line=${line}&column=${col}`;
    case 'sublime': return `subl://open?url=${encodeURIComponent(`file://${path}`)}&line=${line}`;
    case 'none': return null;
  }
}

function classifyTwClass(c: string): string {
  const variants = [
    'sm:', 'md:', 'lg:', 'xl:', '2xl:',
    'dark:', 'hover:', 'focus:', 'focus-visible:', 'focus-within:',
    'active:', 'disabled:', 'group-hover:', 'group-focus:',
    'first:', 'last:', 'odd:', 'even:',
    'before:', 'after:', 'placeholder:', 'rtl:', 'ltr:',
    'motion-safe:', 'motion-reduce:', 'print:',
  ];
  for (const v of variants) {
    if (c.startsWith(v)) return v.slice(0, -1);
  }
  return 'base';
}

function relLuminance(rgb: [number, number, number]): number {
  const [R, G, B] = rgb.map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
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

function effectiveBg(el: Element): [number, number, number, number] | null {
  let cur: Element | null = el;
  while (cur && cur instanceof HTMLElement) {
    const cs = window.getComputedStyle(cur);
    const rgb = parseRgb(cs.backgroundColor);
    if (rgb && rgb[3] > 0) return rgb;
    cur = cur.parentElement;
  }
  return [255, 255, 255, 1];
}

// ─── A11y check (compact for tooltip) ────────────────────────────────

function quickA11y(el: Element): string[] {
  const w: string[] = [];
  const tag = el.tagName.toLowerCase();
  if (tag === 'img' && el.getAttribute('alt') == null) w.push('Missing alt on <img>');
  if ((tag === 'button' || tag === 'a') && !(el.textContent ?? '').trim() && !el.getAttribute('aria-label') && !el.getAttribute('title')) {
    w.push(`<${tag}> has no accessible name`);
  }
  if ((tag === 'input' || tag === 'select' || tag === 'textarea') && !el.getAttribute('aria-label') && !el.closest('label') && !(el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`))) {
    w.push(`<${tag}> has no associated label`);
  }
  if (el instanceof HTMLElement) {
    const cs = window.getComputedStyle(el);
    const fg = parseRgb(cs.color);
    const bg = effectiveBg(el);
    if (fg && bg) {
      const ratio = (Math.max(relLuminance([fg[0], fg[1], fg[2]]), relLuminance([bg[0], bg[1], bg[2]])) + 0.05) /
                    (Math.min(relLuminance([fg[0], fg[1], fg[2]]), relLuminance([bg[0], bg[1], bg[2]])) + 0.05);
      const fontSize = parseFloat(cs.fontSize);
      const isLarge = fontSize >= 18 || (fontSize >= 14 && parseInt(cs.fontWeight, 10) >= 700);
      const min = isLarge ? 3 : 4.5;
      if (ratio < min) w.push(`Contrast ${ratio.toFixed(1)}:1 (needs ${min}:1)`);
    }
  }
  return w;
}

// ─── DOM helpers ────────────────────────────────────────────────────

function cssShorthand(cs: CSSStyleDeclaration, prop: 'margin' | 'padding'): string {
  const t = cs.getPropertyValue(`${prop}-top`);
  const r = cs.getPropertyValue(`${prop}-right`);
  const b = cs.getPropertyValue(`${prop}-bottom`);
  const l = cs.getPropertyValue(`${prop}-left`);
  if (t === r && r === b && b === l) return t;
  if (t === b && r === l) return `${t} ${r}`;
  if (r === l) return `${t} ${r} ${b}`;
  return `${t} ${r} ${b} ${l}`;
}

function shortColor(v: string): string {
  if (!v || v === 'rgba(0, 0, 0, 0)') return 'transparent';
  const m = v.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
  if (!m) return v;
  const [, r, g, b, a] = m;
  const hex = `#${[r, g, b].map((n) => parseInt(n!, 10).toString(16).padStart(2, '0')).join('')}`;
  return a != null && parseFloat(a) < 1 ? `${hex} ·α${parseFloat(a).toFixed(2)}` : hex;
}

// ─── Rendering ───────────────────────────────────────────────────────

function renderTabs(host: HTMLElement, available: { id: Tab; label: string; badge?: number }[], onChange: (t: Tab) => void): void {
  host.replaceChildren();
  for (const t of available) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tt-tab';
    btn.dataset.tab = t.id;
    if (t.id === activeTab) btn.classList.add('active');
    btn.textContent = t.label;
    if (t.badge != null && t.badge > 0) {
      const badge = document.createElement('span');
      badge.className = 'tt-badge';
      badge.textContent = String(t.badge);
      btn.append(badge);
    }
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      onChange(t.id);
    });
    host.append(btn);
  }
}

function renderCompTab(body: HTMLElement, p: ComponentPreview, editor: EditorId): void {
  body.replaceChildren();
  if (p.kind === 'host') {
    const empty = document.createElement('div');
    empty.className = 'tt-empty';
    empty.textContent = 'No React component on this DOM node.';
    body.append(empty);
    return;
  }
  const head = document.createElement('div');
  head.className = 'tt-row';
  const kind = document.createElement('span');
  kind.className = 'tt-kind';
  kind.textContent = p.kind;
  head.append(kind);
  body.append(head);

  if (p.source) {
    const src = document.createElement('div');
    src.className = 'tt-src';
    src.textContent = shortPath(p.source);
    src.title = pathString(p.source);
    const url = editorUrl(editor, p.source);
    if (url) {
      src.classList.add('tt-clickable');
      src.addEventListener('click', (ev) => {
        ev.stopPropagation();
        void chrome.runtime.sendMessage({ kind: 'open-editor', url });
      });
    }
    body.append(src);
  } else {
    const noSrc = document.createElement('div');
    noSrc.className = 'tt-empty';
    noSrc.textContent = 'No source (production build)';
    body.append(noSrc);
  }

  if (p.parentName) {
    body.append(buildKv('parent', p.parentName));
  }
  if (p.childrenNames.length > 0) {
    body.append(buildKv('children', `${p.childrenNames.length}: ${p.childrenNames.slice(0, 4).join(', ')}${p.childrenNames.length > 4 ? '…' : ''}`));
  }
  if (p.propNames.length > 0) {
    body.append(buildKv('props', `${p.propNames.length}: ${p.propNames.slice(0, 5).join(', ')}${p.propNames.length > 5 ? '…' : ''}`));
  }
}

function selectorOf(el: Element): string {
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

function buildOpenTag(el: Element, copyOuterHtml: () => void, onCopy: (text: string) => void): HTMLElement {
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
      attrsList.append(buildAttr(a.name, a.value, onCopy));
    }
    wrap.append(attrsList);

    const closeRow = document.createElement('div');
    closeRow.className = 'tt-html-close';
    closeRow.textContent = '>';
    wrap.append(closeRow);
  }

  // Copy button group (outerHTML + classes) at top-right of the open tag
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

const ICON_COPY_TT = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;

function buildAttr(name: string, value: string, onCopy: (text: string) => void): HTMLElement {
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
  copyBtn.innerHTML = ICON_COPY_TT;
  copyBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    onCopy(value);
  });
  wrap.append(row, copyBtn);
  return wrap;
}

function buildChildRow(child: Element, onNavigate: (el: Element) => void, onPreview: (el: Element | null) => void): HTMLElement {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'tt-dom-child';
  const arrow = document.createElement('span');
  arrow.className = 'tt-dom-child-arrow';
  arrow.textContent = '↳';
  const sel = document.createElement('span');
  sel.className = 'tt-dom-child-sel';
  sel.textContent = selectorOf(child);
  sel.title = `Click to inspect ${child.tagName.toLowerCase()}${child.id ? `#${child.id}` : ''}`;
  row.append(arrow, sel);
  row.addEventListener('click', (ev) => {
    ev.stopPropagation();
    onNavigate(child);
  });
  row.addEventListener('mouseenter', () => onPreview(child));
  row.addEventListener('mouseleave', () => onPreview(null));
  return row;
}

function renderDomTab(
  body: HTMLElement,
  _p: ComponentPreview,
  el: Element | null,
  onNavigate: (el: Element) => void,
  onPreview: (el: Element | null) => void,
  onCopy: (text: string) => void,
): void {
  body.replaceChildren();

  if (!el) {
    const empty = document.createElement('div');
    empty.className = 'tt-empty';
    empty.textContent = 'No element to inspect.';
    body.append(empty);
    return;
  }

  // Up navigation — go to parent element
  if (el.parentElement && el.parentElement !== document.body && el.parentElement !== document.documentElement) {
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
    upRow.addEventListener('click', (ev) => {
      ev.stopPropagation();
      onNavigate(el.parentElement!);
    });
    upRow.addEventListener('mouseenter', () => onPreview(el.parentElement!));
    upRow.addEventListener('mouseleave', () => onPreview(null));
    body.append(upRow);
  }

  // Open tag with attributes (selectable, scrollable values)
  body.append(buildOpenTag(el, () => onCopy(el.outerHTML), onCopy));

  // Attributes table — quick copy per attribute
  const domAttrs = Array.from(el.attributes);
  if (domAttrs.length > 0) {
    const secH = document.createElement('div');
    secH.className = 'tt-section-h';
    secH.textContent = `Attributes · ${domAttrs.length}`;
    body.append(secH);

    const table = document.createElement('table');
    table.className = 'tt-attr-table';
    for (const a of domAttrs) {
      const tr = document.createElement('tr');
      tr.className = 'tt-attr-row';
      const tdName = document.createElement('td');
      tdName.className = 'tt-attr-name';
      tdName.textContent = a.name;
      tdName.title = a.name;
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
      copyBtn.innerHTML = ICON_COPY_TT;
      const val = a.value;
      copyBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        onCopy(val);
      });
      tdCopy.append(copyBtn);
      tr.append(tdName, tdVal, tdCopy);
      table.append(tr);
    }
    body.append(table);
  }

  // Children navigation OR inline text content
  if (el.children.length > 0) {
    const list = document.createElement('div');
    list.className = 'tt-dom-children';
    const max = 12;
    const shown = Array.from(el.children).slice(0, max);
    for (const child of shown) {
      list.append(buildChildRow(child, onNavigate, onPreview));
    }
    body.append(list);
    if (el.children.length > max) {
      const more = document.createElement('div');
      more.className = 'tt-dom-more';
      more.textContent = `+${el.children.length - max} more`;
      body.append(more);
    }
  } else {
    const text = (el.textContent ?? '').trim();
    if (text) {
      const t = document.createElement('div');
      t.className = 'tt-dom-text';
      const truncated = text.length > 200 ? text.slice(0, 200) + '…' : text;
      t.textContent = truncated;
      t.title = text;
      body.append(t);
    } else {
      const empty = document.createElement('div');
      empty.className = 'tt-dom-empty';
      empty.textContent = '(empty)';
      body.append(empty);
    }
  }

  // Closing tag
  const closeTag = document.createElement('div');
  closeTag.className = 'tt-html-close-tag';
  closeTag.textContent = `</${el.tagName.toLowerCase()}>`;
  body.append(closeTag);
}

function renderCssTab(body: HTMLElement, p: ComponentPreview, el: Element | null): void {
  body.replaceChildren();
  if (!el || !(el instanceof HTMLElement)) {
    const empty = document.createElement('div');
    empty.className = 'tt-empty';
    empty.textContent = 'No element to inspect.';
    body.append(empty);
    return;
  }
  const cs = window.getComputedStyle(el);
  const r = el.getBoundingClientRect();

  const grid = document.createElement('div');
  grid.className = 'tt-meta-grid';
  // Editable single-prop rows
  grid.append(buildEditableCssRow(el, 'display', 'display', undefined, 'tt'));
  grid.append(buildEditableCssRow(el, 'position', 'position', undefined, 'tt'));
  // Read-only composite (size = bounding rect)
  grid.append(buildKv('size', `${Math.round(r.width)}×${Math.round(r.height)}`));
  grid.append(buildKv('margin', cssShorthand(cs, 'margin')));
  grid.append(buildKv('padding', cssShorthand(cs, 'padding')));
  grid.append(buildEditableCssRow(el, 'z-index', 'z-index', undefined, 'tt'));
  grid.append(buildEditableCssRow(el, 'background-color', 'bg', shortColor, 'tt'));
  grid.append(buildEditableCssRow(el, 'color', 'color', shortColor, 'tt'));
  // Read-only composite font display
  grid.append(buildKv('font', `${cs.fontSize} / ${parseInt(cs.fontWeight, 10)}`));
  // Add-property row
  grid.append(buildAddCssRow(el, 'tt'));
  body.append(grid);

  // Spacing source classes (Tailwind p-*, m-* patterns)
  const spacingClasses = (el.getAttribute('class') ?? '')
    .split(/\s+/)
    .filter((c) => {
      const base = c.replace(/^[a-z0-9-]+:/, '');
      return /^-?(?:(?:p|m)(?:[xytrbl])?|space-[xy]|gap(?:-[xy])?)-/.test(base);
    });
  if (spacingClasses.length > 0) {
    const spacingHead = document.createElement('div');
    spacingHead.className = 'tt-section-h';
    spacingHead.textContent = `Spacing classes · ${spacingClasses.length}`;
    body.append(spacingHead);
    const chips = document.createElement('div');
    chips.className = 'tt-spacing-chips';
    for (const c of spacingClasses) {
      const chip = document.createElement('span');
      chip.className = 'tt-spacing-chip';
      chip.textContent = c;
      chips.append(chip);
    }
    body.append(chips);
  }

  const classes = (p.className || '').split(/\s+/).filter(Boolean);
  if (classes.length > 0) {
    const groups = new Map<string, string[]>();
    for (const c of classes) {
      const g = classifyTwClass(c);
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(c);
    }
    const heading = document.createElement('div');
    heading.className = 'tt-section-h';
    heading.textContent = `Classes · ${classes.length}`;
    body.append(heading);

    const cls = document.createElement('div');
    cls.className = 'tt-classes';
    const orderedKeys = ['base', ...[...groups.keys()].filter((k) => k !== 'base').sort()];
    for (const key of orderedKeys) {
      const list = groups.get(key);
      if (!list || list.length === 0) continue;
      const row = document.createElement('div');
      row.className = 'tt-cls-row';
      const k = document.createElement('span');
      k.className = 'tt-cls-key';
      k.textContent = key;
      const v = document.createElement('span');
      v.className = 'tt-cls-val';
      v.textContent = list.join(' ');
      row.append(k, v);
      cls.append(row);
    }
    body.append(cls);
  }
}

function renderA11yTab(body: HTMLElement, el: Element | null): void {
  body.replaceChildren();
  if (!el) {
    const empty = document.createElement('div');
    empty.className = 'tt-empty';
    empty.textContent = 'No element to inspect.';
    body.append(empty);
    return;
  }
  const warnings = quickA11y(el);
  if (warnings.length === 0) {
    const ok = document.createElement('div');
    ok.className = 'tt-ok';
    ok.textContent = '✓ No accessibility issues detected';
    body.append(ok);
    return;
  }
  for (const w of warnings) {
    const row = document.createElement('div');
    row.className = 'tt-warn';
    const mark = document.createElement('span');
    mark.className = 'tt-warn-mark';
    mark.textContent = '⚠';
    const text = document.createElement('span');
    text.textContent = w;
    row.append(mark, text);
    body.append(row);
  }
}

function buildKv(label: string, value: string): HTMLElement {
  const row = document.createElement('div');
  row.className = 'tt-kv';
  const k = document.createElement('span');
  k.className = 'tt-kv-key';
  k.textContent = label;
  const v = document.createElement('span');
  v.className = 'tt-kv-val';
  v.textContent = value;
  v.title = value;
  row.append(k, v);
  return row;
}

// ─── Position ────────────────────────────────────────────────────────

function positionTooltip(el: HTMLElement, anchor: { x: number; y: number }): void {
  const w = el.offsetWidth || TOOLTIP_WIDTH;
  const h = el.offsetHeight || 200;

  let x = anchor.x + TOOLTIP_OFFSET_X;
  let y = anchor.y + TOOLTIP_OFFSET_Y;

  if (x + w + VIEWPORT_MARGIN > window.innerWidth) {
    x = anchor.x - TOOLTIP_OFFSET_X - w;
  }
  if (x < VIEWPORT_MARGIN) x = VIEWPORT_MARGIN;

  if (y + h + VIEWPORT_MARGIN > window.innerHeight) {
    y = anchor.y - TOOLTIP_OFFSET_Y - h;
  }
  if (y < VIEWPORT_MARGIN) y = VIEWPORT_MARGIN;

  el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
}

// ─── Public factory ──────────────────────────────────────────────────

export type CreateTooltipOptions = {
  getEditor: () => EditorId;
  onNavigateToElement: (el: Element) => void;
  onPreviewElement: (el: Element | null) => void;
  onCopyText: (text: string) => void;
};

export function createTooltip(
  shadow: ShadowRoot,
  opts: CreateTooltipOptions,
): TooltipState {
  const { getEditor, onNavigateToElement, onPreviewElement, onCopyText } = opts;
  const el = document.createElement('div');
  el.className = 'tooltip';
  el.style.display = 'none';
  el.addEventListener('wheel', (ev) => ev.stopPropagation(), { passive: true });

  const header = document.createElement('div');
  header.className = 'tt-header';
  const name = document.createElement('span');
  name.className = 'tt-name';
  const tag = document.createElement('span');
  tag.className = 'tt-tag';
  header.append(name, tag);

  const tabsEl = document.createElement('div');
  tabsEl.className = 'tt-tabs';

  const body = document.createElement('div');
  body.className = 'tt-body';

  const footer = document.createElement('div');
  footer.className = 'tt-footer';
  footer.innerHTML = '<span class="tt-hint">Click while holding <kbd>x</kbd> to open full panel</span>';

  el.append(header, tabsEl, body, footer);
  shadow.append(el);

  let lastPreview: ComponentPreview | null = null;
  let lastEl: Element | null = null;
  let lastAnchor: { x: number; y: number } | null = null;
  let pinned = false;

  function rerender(): void {
    if (!lastPreview) return;
    name.textContent = lastPreview.name;
    tag.textContent =
      lastPreview.kind === 'host'
        ? ''
        : `<${lastPreview.domTag}${lastPreview.elementId ? `#${lastPreview.elementId}` : ''}>`;

    const tabs: { id: Tab; label: string; badge?: number }[] = [];
    if (lastPreview.kind !== 'host') tabs.push({ id: 'comp', label: 'Comp' });
    tabs.push({ id: 'dom', label: 'DOM' });
    tabs.push({ id: 'css', label: 'CSS' });
    const a11yWarnings = lastEl ? quickA11y(lastEl) : [];
    tabs.push({ id: 'a11y', label: 'A11y', badge: a11yWarnings.length > 0 ? a11yWarnings.length : undefined });

    if (lastPreview.kind === 'host' && activeTab === 'comp') activeTab = 'dom';

    renderTabs(tabsEl, tabs, (t) => {
      activeTab = t;
      rerender();
    });

    switch (activeTab) {
      case 'comp':
        renderCompTab(body, lastPreview, getEditor());
        break;
      case 'dom':
        renderDomTab(body, lastPreview, lastEl, onNavigateToElement, onPreviewElement, onCopyText);
        break;
      case 'css':
        renderCssTab(body, lastPreview, lastEl);
        break;
      case 'a11y':
        renderA11yTab(body, lastEl);
        break;
    }
  }

  return {
    el,
    setVisible(visible) {
      el.style.display = visible ? 'block' : 'none';
    },
    update({ preview, targetEl, cursor }) {
      lastPreview = preview;
      lastEl = targetEl;
      if (cursor && !pinned) lastAnchor = cursor;
      rerender();
      // Position only when not pinned and anchor exists
      if (!pinned && lastAnchor) positionTooltip(el, lastAnchor);
    },
    setPinned(p) {
      pinned = p;
      el.classList.toggle('pinned', p);
    },
    isPinned() {
      return pinned;
    },
    hide() {
      el.style.display = 'none';
      pinned = false;
      lastPreview = null;
      lastEl = null;
      lastAnchor = null;
    },
    contains(node) {
      return el.contains(node);
    },
  };
}
