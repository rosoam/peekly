export const overlayCss = `
:host {
  all: initial;
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  pointer-events: none;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color-scheme: dark;
}

/* ─── Hover highlight ─────────────────────────────────────────────── */

.highlight {
  position: fixed;
  pointer-events: none;
  border: 2px solid #6366f1;
  background: rgba(99, 102, 241, 0.12);
  box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.6), 0 0 24px rgba(99, 102, 241, 0.35);
  border-radius: 3px;
  transition: left 80ms ease-out, top 80ms ease-out, width 80ms ease-out, height 80ms ease-out;
  display: none;
  contain: layout style paint;
}

.label {
  position: absolute;
  top: -22px;
  left: -2px;
  background: #6366f1;
  color: white;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 3px;
  white-space: nowrap;
  pointer-events: none;
  letter-spacing: 0.02em;
}

/* ─── Preview highlight (chip hover in panel) ─────────────────────── */

.preview-highlight {
  position: fixed;
  pointer-events: none;
  border: 2px dashed #fbbf24;
  background: rgba(251, 191, 36, 0.06);
  box-shadow: 0 0 0 1px rgba(251, 191, 36, 0.4), 0 0 18px rgba(251, 191, 36, 0.25);
  border-radius: 3px;
  display: none;
  contain: layout style paint;
  transition: opacity 80ms ease;
}

/* ─── Multi-instance highlight ────────────────────────────────────── */

.instances-layer {
  position: fixed;
  inset: 0;
  pointer-events: none;
}

.instance-box {
  position: fixed;
  pointer-events: none;
  border: 2px dashed #fbbf24;
  background: rgba(251, 191, 36, 0.08);
  border-radius: 3px;
  animation: rp-pulse 1.4s ease-in-out infinite;
}

@keyframes rp-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}

/* ─── Outline mode ────────────────────────────────────────────────── */

.outline-layer {
  position: fixed;
  inset: 0;
  pointer-events: none;
}

.outline-box {
  position: fixed;
  pointer-events: none;
  border: 1px dashed rgba(167, 139, 250, 0.55);
  border-radius: 2px;
}

/* ─── Panel ───────────────────────────────────────────────────────── */

.panel {
  position: fixed;
  bottom: 16px;
  right: 16px;
  width: 400px;
  max-height: 82vh;
  background: rgba(13, 13, 13, 0.97);
  color: #f5f5f5;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-size: 12px;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  backdrop-filter: blur(12px);
}

.panel.dragging {
  user-select: none;
  cursor: grabbing;
  opacity: 0.95;
}

/* ─── Header ──────────────────────────────────────────────────────── */

.panel-header {
  display: flex;
  align-items: center;
  padding: 10px 10px 10px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  gap: 8px;
  cursor: grab;
}

.panel-header:active {
  cursor: grabbing;
}

.drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 24px;
  color: rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.panel-name {
  font-size: 18px;
  font-weight: 700;
  color: #e0e7ff;
  letter-spacing: -0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: text;
  user-select: text;
  border-radius: 4px;
  padding: 1px 4px;
  margin-left: -4px;
  transition: background 100ms ease;
  outline: none;
}

.panel-name:hover {
  background: rgba(99, 102, 241, 0.12);
}

.panel-name:focus-visible {
  background: rgba(99, 102, 241, 0.16);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.4);
}

.panel-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.panel-close {
  width: 26px;
  height: 26px;
  padding: 0 !important;
  font-size: 13px !important;
  line-height: 1;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.55);
  border-radius: 6px;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 100ms ease, color 100ms ease, border-color 100ms ease;
}

.icon-btn:hover {
  background: rgba(99, 102, 241, 0.18);
  color: #c7d2fe;
  border-color: rgba(99, 102, 241, 0.4);
}

.icon-btn:active {
  transform: translateY(1px);
}

.icon-btn svg {
  display: block;
}

/* ─── Body ────────────────────────────────────────────────────────── */

.panel-body {
  overflow-y: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
}

.panel-body::-webkit-scrollbar { width: 6px; }
.panel-body::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 3px;
}
.panel-body::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.22); }
.panel-body::-webkit-scrollbar-track { background: transparent; }

/* ─── Source card ─────────────────────────────────────────────────── */

.source-card {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.18), rgba(139, 92, 246, 0.06));
  border: 1px solid rgba(99, 102, 241, 0.32);
  border-radius: 9px;
  padding: 12px 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.source-card-empty {
  background: rgba(255, 255, 255, 0.02);
  border-color: rgba(255, 255, 255, 0.08);
}

.source-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.source-card-label {
  font-size: 9px;
  letter-spacing: 0.1em;
  color: rgba(199, 210, 254, 0.6);
  font-weight: 700;
  text-transform: uppercase;
}

.source-path {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: #e0e7ff;
  word-break: break-all;
  line-height: 1.4;
  user-select: text;
  cursor: text;
}

.source-actions {
  display: flex;
  gap: 6px;
  align-items: stretch;
}

.source-empty {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
  line-height: 1.4;
  padding: 4px 0;
}

.source-empty-sub {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.35);
}

/* ─── Buttons ─────────────────────────────────────────────────────── */

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  border-radius: 7px;
  cursor: pointer;
  padding: 7px 12px;
  transition: background 100ms ease, color 100ms ease, transform 80ms ease;
  border: 1px solid transparent;
  white-space: nowrap;
  user-select: none;
}

.btn:active { transform: translateY(1px); }

.btn-primary {
  background: #6366f1;
  color: white;
  font-weight: 600;
  letter-spacing: 0.01em;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.12) inset, 0 4px 14px rgba(99, 102, 241, 0.35);
}

.btn-primary:hover { background: #5b5fe0; }

.btn-secondary {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.85);
  border-color: rgba(255, 255, 255, 0.1);
}

.btn-secondary:hover { background: rgba(255, 255, 255, 0.1); }

.btn-ghost {
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  border-color: rgba(255, 255, 255, 0.08);
}

.btn-ghost:hover { background: rgba(255, 255, 255, 0.06); color: white; }

.btn-grow { flex: 1; }
.btn-full { width: 100%; }

/* ─── Sections ────────────────────────────────────────────────────── */

.section-title {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.4);
  font-weight: 700;
  margin: 0 0 8px;
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.section {
  display: flex;
  flex-direction: column;
}

.section-collapse {
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 7px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.015);
}

.section-collapse > summary {
  cursor: pointer;
  list-style: none;
  user-select: none;
  margin: 0;
}

.section-collapse > summary::before {
  content: '▸';
  display: inline-block;
  margin-right: 4px;
  transition: transform 120ms ease;
  font-size: 8px;
  color: rgba(255, 255, 255, 0.5);
}

.section-collapse[open] > summary::before {
  transform: rotate(90deg);
}

.section-collapse[open] > .computed-list,
.section-collapse[open] > .tw-groups {
  margin-top: 8px;
}

.section-warn {
  background: rgba(251, 113, 133, 0.06);
  border: 1px solid rgba(251, 113, 133, 0.2);
  border-radius: 7px;
  padding: 8px 10px;
}

.section-hint {
  background: rgba(96, 165, 250, 0.05);
  border: 1px solid rgba(96, 165, 250, 0.16);
  border-radius: 7px;
  padding: 8px 10px;
}

/* ─── Nav (parent / children) ─────────────────────────────────────── */

.nav-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
  text-align: left;
  margin-bottom: 6px;
  transition: background 100ms ease, border-color 100ms ease;
}

.nav-row:hover {
  background: rgba(251, 191, 36, 0.1);
  border-color: rgba(251, 191, 36, 0.35);
  color: #fef3c7;
}

.nav-arrow {
  color: rgba(199, 210, 254, 0.7);
  font-size: 13px;
  flex-shrink: 0;
}

.nav-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.nav-wrap {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: 4px 0 6px;
}

.nav-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.45);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 600;
}

.children-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.child-chip {
  font-family: inherit;
  font-size: 11px;
  padding: 3px 9px;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.2);
  color: #c7d2fe;
  border-radius: 999px;
  cursor: pointer;
  transition: background 100ms ease, border-color 100ms ease;
  white-space: nowrap;
}

.child-chip:hover {
  background: rgba(251, 191, 36, 0.18);
  border-color: rgba(251, 191, 36, 0.5);
  color: #fef3c7;
}

/* ─── Re-renders ──────────────────────────────────────────────────── */

.render-count {
  color: #fbbf24;
  font-weight: 700;
  font-size: 11px;
  letter-spacing: 0;
  text-transform: none;
}

.render-sub {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  font-family: ui-monospace, monospace;
  transition: color 200ms ease;
}

.render-sub.flash {
  color: #fbbf24;
}

/* ─── Props ───────────────────────────────────────────────────────── */

.props-list { display: flex; flex-direction: column; }

.prop-row {
  display: grid;
  grid-template-columns: minmax(0, 28%) minmax(0, 1fr);
  gap: 10px;
  padding: 6px 0;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  align-items: baseline;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.prop-row:first-child { border-top: none; }

.prop-key {
  color: #fbbf24;
  font-weight: 500;
  word-break: break-word;
  user-select: text;
  cursor: text;
}

.prop-val {
  color: #d4d4d4;
  white-space: nowrap;
  overflow-x: auto;
  overflow-y: hidden;
  user-select: text;
  cursor: text;
  padding-bottom: 2px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.18) transparent;
}

.prop-val::-webkit-scrollbar { height: 4px; }
.prop-val::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
}
.prop-val::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.3); }
.prop-val::-webkit-scrollbar-track { background: transparent; }

.more-btn {
  margin-top: 8px;
  font-family: inherit;
  font-size: 11px;
  background: transparent;
  border: 1px dashed rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.55);
  padding: 5px 10px;
  border-radius: 6px;
  cursor: pointer;
  align-self: flex-start;
  transition: all 100ms ease;
}

.more-btn:hover {
  border-color: rgba(99, 102, 241, 0.5);
  color: #c7d2fe;
}

/* ─── Computed / kv ───────────────────────────────────────────────── */

.computed-list {
  display: flex;
  flex-direction: column;
}

.kv-row {
  display: grid;
  grid-template-columns: minmax(0, 28%) 1fr;
  gap: 10px;
  padding: 3px 0;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  align-items: baseline;
}

.kv-key {
  color: #86efac;
  font-weight: 500;
  user-select: text;
  cursor: text;
}

.kv-val {
  color: #d4d4d4;
  white-space: nowrap;
  overflow-x: auto;
  overflow-y: hidden;
  user-select: text;
  cursor: text;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.18) transparent;
}

.kv-val::-webkit-scrollbar { height: 3px; }
.kv-val::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
}
.kv-val::-webkit-scrollbar-track { background: transparent; }

/* ─── Tailwind decode ─────────────────────────────────────────────── */

.tw-groups {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tw-group {
  display: grid;
  grid-template-columns: 70px 1fr;
  gap: 8px;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  align-items: baseline;
}

.tw-key {
  color: #fbbf24;
  font-weight: 600;
  user-select: text;
  cursor: text;
}

.tw-val {
  color: #d4d4d4;
  white-space: nowrap;
  overflow-x: auto;
  overflow-y: hidden;
  user-select: text;
  cursor: text;
  padding-bottom: 2px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.18) transparent;
}

.tw-val::-webkit-scrollbar { height: 3px; }
.tw-val::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
}
.tw-val::-webkit-scrollbar-track { background: transparent; }

/* ─── Warnings & hints ────────────────────────────────────────────── */

.warn-row, .hint-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 3px 0;
  font-size: 11px;
  line-height: 1.4;
}

.warn-dot {
  color: #fb7185;
  font-size: 13px;
  line-height: 1;
  flex-shrink: 0;
}

.hint-dot {
  color: #60a5fa;
  font-size: 9px;
  line-height: 1.3;
  flex-shrink: 0;
}

.warn-text {
  color: rgba(255, 255, 255, 0.85);
}

.hint-text {
  color: rgba(255, 255, 255, 0.75);
}

/* ─── Owner chain ─────────────────────────────────────────────────── */

.owner-row {
  display: flex;
  gap: 8px;
  align-items: baseline;
  padding: 4px 0;
}

.owner-arrow {
  color: rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
  font-size: 11px;
}

.owner-main {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
}

.owner-name {
  color: #e0e7ff;
  font-size: 12px;
  font-weight: 500;
}

.owner-src {
  font-family: ui-monospace, monospace;
  font-size: 10px;
  color: rgba(134, 239, 172, 0.7);
  word-break: break-all;
  user-select: text;
}

.owner-src.clickable { cursor: pointer; transition: color 100ms ease; }
.owner-src.clickable:hover { color: #86efac; text-decoration: underline; }

/* ─── Footer ──────────────────────────────────────────────────────── */

.panel-footer {
  padding: 10px 14px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(255, 255, 255, 0.015);
}

/* ─── Tooltip (contextual debugger, Option+Shift) ─────────────────── */

.tooltip {
  position: fixed;
  top: 0;
  left: 0;
  width: 340px;
  max-height: 380px;
  background: rgba(13, 13, 13, 0.97);
  color: #f5f5f5;
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(99, 102, 241, 0.1);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: 12px;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  backdrop-filter: blur(10px);
  will-change: transform;
}

.tooltip.pinned {
  border-color: rgba(99, 102, 241, 0.55);
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(99, 102, 241, 0.3);
}

.tt-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 9px 12px 7px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.tt-name {
  font-size: 14px;
  font-weight: 700;
  color: #c7d2fe;
  letter-spacing: -0.01em;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tt-tag {
  font-family: ui-monospace, monospace;
  font-size: 10px;
  color: rgba(134, 239, 172, 0.65);
  flex-shrink: 0;
}

.tt-tabs {
  display: flex;
  gap: 2px;
  padding: 6px 8px 0;
  background: rgba(255, 255, 255, 0.015);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.tt-tab {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.55);
  font-family: inherit;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 5px 9px 7px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 100ms ease, border-color 100ms ease;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.tt-tab:hover { color: rgba(255, 255, 255, 0.85); }

.tt-tab.active {
  color: #c7d2fe;
  border-bottom-color: #6366f1;
}

.tt-badge {
  background: #fb7185;
  color: white;
  font-size: 9px;
  padding: 0 5px;
  border-radius: 999px;
  font-weight: 700;
  min-width: 14px;
  text-align: center;
  letter-spacing: 0;
}

.tt-body {
  flex: 1;
  overflow-y: auto;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 11px;
}

.tt-footer {
  padding: 6px 12px 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(255, 255, 255, 0.015);
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  text-align: center;
}

.tt-hint kbd {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 3px;
  padding: 0 4px;
  font-family: ui-monospace, monospace;
  font-size: 9px;
  color: rgba(255, 255, 255, 0.7);
}

.tt-row {
  display: flex;
  gap: 6px;
  align-items: baseline;
}

.tt-kind {
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(199, 210, 254, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 1px 6px;
  border-radius: 4px;
}

.tt-src {
  font-family: ui-monospace, monospace;
  font-size: 11px;
  color: #86efac;
  word-break: break-all;
  line-height: 1.4;
  background: rgba(134, 239, 172, 0.05);
  border: 1px solid rgba(134, 239, 172, 0.15);
  border-radius: 6px;
  padding: 6px 8px;
}

.tt-clickable { cursor: pointer; transition: background 100ms ease, border-color 100ms ease; }
.tt-clickable:hover {
  background: rgba(134, 239, 172, 0.12);
  border-color: rgba(134, 239, 172, 0.35);
}

.tt-empty {
  color: rgba(255, 255, 255, 0.4);
  font-style: italic;
  font-size: 11px;
  padding: 4px 0;
}

.tt-ok {
  color: #86efac;
  font-size: 11px;
  padding: 4px 0;
}

.tt-warn {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  color: rgba(255, 255, 255, 0.85);
  font-size: 11px;
  line-height: 1.4;
  padding: 2px 0;
}

.tt-warn-mark { color: #fb7185; flex-shrink: 0; }

.tt-kv {
  display: grid;
  grid-template-columns: 70px 1fr;
  gap: 8px;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  align-items: baseline;
}

.tt-kv-key { color: #fbbf24; font-weight: 500; }

.tt-kv-val {
  color: #d4d4d4;
  word-break: break-word;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tt-meta-grid {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.tt-chain {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-bottom: 6px;
}

.tt-chain-row {
  display: flex;
  gap: 6px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  align-items: baseline;
}

.tt-chain-mark { color: rgba(255, 255, 255, 0.3); flex-shrink: 0; }

.tt-current {
  display: flex;
  gap: 6px;
  align-items: baseline;
  padding: 4px 6px;
  background: rgba(99, 102, 241, 0.1);
  border-radius: 4px;
  margin-bottom: 6px;
}

.tt-cur-mark { color: #6366f1; font-size: 9px; flex-shrink: 0; }

.tt-cur-name {
  color: #e0e7ff;
  font-weight: 600;
  font-size: 12px;
}

.tt-cur-tag {
  font-family: ui-monospace, monospace;
  font-size: 10px;
  color: rgba(134, 239, 172, 0.65);
  margin-left: auto;
}

.tt-section-h {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.4);
  font-weight: 700;
  margin-top: 4px;
}

.tt-classes {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tt-cls-row {
  display: grid;
  grid-template-columns: 56px 1fr;
  gap: 8px;
  font-family: ui-monospace, monospace;
  font-size: 10px;
  align-items: baseline;
  line-height: 1.4;
}

.tt-cls-key { color: #fbbf24; font-weight: 600; }

.tt-cls-val { color: #d4d4d4; word-break: break-word; }

/* ─── Toast ───────────────────────────────────────────────────────── */

.toast {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: #6366f1;
  color: white;
  padding: 8px 14px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  pointer-events: none;
  opacity: 0;
  transition: opacity 140ms;
  font-family: ui-sans-serif, system-ui, sans-serif;
  letter-spacing: 0.02em;
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
}

.toast.visible { opacity: 1; }

/* ─── Error ───────────────────────────────────────────────────────── */

.error {
  color: #fca5a5;
  font-size: 11px;
  font-family: ui-sans-serif, sans-serif;
}
`;
