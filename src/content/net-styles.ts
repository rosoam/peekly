export const netPanelCss = `
.net-panel {
  --np-bg: #0d0d0d;
  --np-bg-elevated: rgba(255,255,255,0.04);
  --np-bg-control: rgba(255,255,255,0.08);
  --np-bg-hover: rgba(255,255,255,0.055);
  --np-bg-selected: rgba(10,132,255,0.18);
  --np-label: rgba(255,255,255,0.95);
  --np-label-2: rgba(235,235,245,0.60);
  --np-label-3: rgba(235,235,245,0.30);
  --np-label-4: rgba(235,235,245,0.12);
  --np-sep: rgba(255,255,255,0.08);
  --np-sep-2: rgba(255,255,255,0.05);
  --np-blue: #0a84ff;
  --np-blue-2: rgba(10,132,255,0.35);
  --np-green: #32d74b;
  --np-orange: #ff9f0a;
  --np-red: #ff453a;
  --np-purple: #bf5af2;
  --np-r: 8px;
  --np-r-sm: 5px;

  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 82vw;
  height: 82vh;
  background: rgba(13, 13, 13, 0.97);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  box-shadow: 0 32px 80px rgba(0,0,0,0.75);
  display: flex;
  flex-direction: column;
  z-index: 2147483640;
  pointer-events: auto;

  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: 13px;
  -webkit-font-smoothing: antialiased;
  user-select: none;
  color: var(--np-label);
  overflow: hidden;
}

.net-panel.hidden { display: none; }

/* ─── Titlebar ──────────────────────────────────────────────────── */
.np-titlebar {
  height: 44px;
  background: transparent;
  border-bottom: 1px solid var(--np-sep-2);
  display: flex;
  align-items: center;
  padding: 0 16px;
  cursor: grab;
  user-select: none;
  flex-shrink: 0;
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
}
.np-titlebar:active { cursor: grabbing; }
.np-title {
  flex: 1;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--np-label-2);
}
.np-titlebar-actions { display: flex; gap: 6px; align-items: center; }
.np-intel-btn {
  background: var(--np-bg-elevated);
  border: 1px solid var(--np-sep);
  color: var(--np-label-2);
  font-size: 11.5px;
  padding: 3px 10px;
  border-radius: 5px;
  cursor: pointer;
}
.np-intel-btn:hover { color: var(--np-label); background: var(--np-bg-control); }
.np-intel-btn.active { background: var(--np-blue); color: white; border-color: var(--np-blue); }
.np-close-btn {
  width: 24px;
  height: 24px;
  background: none;
  border: none;
  color: var(--np-label-3);
  font-size: 18px;
  cursor: pointer;
  border-radius: 4px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.np-close-btn:hover { color: var(--np-label); background: var(--np-bg-hover); }

/* ─── Control bar ──────────────────────────────────────────────── */
.np-ctrlbar {
  height: 40px;
  background: transparent;
  border-bottom: 1px solid var(--np-sep);
  display: flex;
  align-items: center;
  padding: 0 8px;
  gap: 3px;
  flex-shrink: 0;
  overflow-x: auto;
}
.np-mf, .np-sf {
  background: none;
  border: 1px solid transparent;
  color: var(--np-label-2);
  font-size: 11px;
  font-weight: 600;
  padding: 4px 9px;
  border-radius: 5px;
  cursor: pointer;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
.np-mf:hover, .np-sf:hover { background: var(--np-bg-hover); color: var(--np-label); }
.np-mf.active, .np-sf.active {
  background: var(--np-bg-control);
  color: var(--np-label);
  border-color: var(--np-sep);
}
.np-btn-label { pointer-events: none; }
.np-btn-count {
  display: inline-block;
  min-width: 14px;
  margin-left: 4px;
  padding: 0 3px;
  background: rgba(255,255,255,0.08);
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
  color: rgba(235,235,245,0.5);
  line-height: 14px;
  vertical-align: middle;
  text-align: center;
  pointer-events: none;
}
.np-mf.active .np-btn-count, .np-sf.active .np-btn-count {
  background: rgba(255,255,255,0.12);
  color: rgba(235,235,245,0.75);
}
.np-btn-count:empty { display: none; }
.np-ctrlbar .np-sep {
  width: 1px;
  height: 18px;
  background: var(--np-sep-2);
  margin: 0 4px;
  flex-shrink: 0;
}
.np-search-wrap {
  flex: 0 0 auto;
  width: 150px;
  margin-left: auto;
  margin-right: 4px;
  display: flex;
  transition: width 0.18s ease;
}
.np-search-wrap:focus-within {
  width: 210px;
}
.np-search-input {
  width: 100%;
  background: var(--np-bg-elevated);
  border: 1px solid var(--np-sep-2);
  border-radius: 5px;
  padding: 4px 8px;
  font-size: 12px;
  color: var(--np-label);
  outline: none;
  font-family: inherit;
}
.np-search-input:focus { border-color: var(--np-blue-2); }
.np-clear-btn {
  background: none;
  border: 1px solid var(--np-sep-2);
  color: var(--np-label-2);
  font-size: 11px;
  padding: 3px 9px;
  border-radius: 5px;
  cursor: pointer;
}
.np-clear-btn:hover { background: var(--np-bg-hover); color: var(--np-label); }

/* ─── Main split ────────────────────────────────────────────────── */
.np-main {
  flex: 1;
  display: flex;
  overflow: hidden;
}
.np-main.hidden { display: none; }

/* ─── List pane ─────────────────────────────────────────────────── */
.np-list-pane {
  width: 34%;
  min-width: 200px;
  border-right: 1px solid var(--np-sep);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.np-list-header {
  height: 28px;
  display: flex;
  align-items: center;
  padding: 0 8px;
  background: var(--np-bg);
  border-bottom: 1px solid var(--np-sep-2);
  flex-shrink: 0;
  font-size: 11px;
  color: var(--np-label-3);
  gap: 6px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.np-list-header > span:nth-child(1) { width: 44px; }
.np-list-header > span:nth-child(2) { flex: 1; }
.np-list-header > span:nth-child(3) { width: 40px; text-align: right; }
.np-list-header > span:nth-child(4) { width: 50px; text-align: right; }
.np-req-list {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
}
.np-req-list::-webkit-scrollbar { width: 8px; }
.np-req-list::-webkit-scrollbar-thumb { background: var(--np-bg-control); border-radius: 4px; }

@keyframes npRowIn {
  from { opacity: 0; transform: translateX(-4px); }
  to   { opacity: 1; transform: translateX(0); }
}

.np-req-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  cursor: pointer;
  min-height: 32px;
  border-bottom: 1px solid var(--np-sep-2);
  transition: background 0.08s;
  animation: npRowIn 0.16s ease forwards;
}

@keyframes npCopiedFloat {
  0%   { opacity: 0; transform: translate(8px, -50%) scale(0.92); }
  18%  { opacity: 1; transform: translate(0, -50%) scale(1); }
  72%  { opacity: 1; transform: translate(0, -50%) scale(1); }
  100% { opacity: 0; transform: translate(0, calc(-50% - 6px)) scale(1); }
}
.np-rr-copied {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: linear-gradient(135deg, #32d74b, #28a745);
  color: #0d0d0d;
  font-size: 10px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 999px;
  letter-spacing: 0.02em;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(50,215,75,0.35), 0 0 0 1px rgba(50,215,75,0.5);
  animation: npCopiedFloat 1.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
  z-index: 2;
}
.np-req-row:hover { background: var(--np-bg-hover); }
.np-req-row.selected {
  background: rgba(10,132,255,0.22);
  border-left: 2px solid var(--np-blue) !important;
  padding-left: 6px;
}
.np-req-row.selected .np-rr-path { color: rgba(255,255,255,0.98); }
.np-req-row.is-4xx { border-left: 2px solid var(--np-orange); padding-left: 6px; }
.np-req-row.is-5xx { border-left: 2px solid var(--np-red); padding-left: 6px; }

.np-method-badge {
  font-size: 10px;
  font-weight: 700;
  border-radius: 3px;
  padding: 1px 5px;
  min-width: 40px;
  text-align: center;
  color: white;
  letter-spacing: 0.02em;
  flex-shrink: 0;
}
.np-method-badge.m-GET { background: #32d74b; }
.np-method-badge.m-POST { background: #0a84ff; }
.np-method-badge.m-PUT { background: #ff9f0a; }
.np-method-badge.m-DELETE { background: #ff453a; }
.np-method-badge.m-PATCH { background: #bf5af2; }
.np-method-badge.m-HEAD,
.np-method-badge.m-OPTIONS { background: var(--np-bg-control); color: var(--np-label-2); }

.np-rr-pathwrap { flex: 1; min-width: 0; overflow: hidden; }
.np-rr-path {
  font-size: 12px;
  color: var(--np-label);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.np-rr-smart-label {
  font-size: 10px;
  color: var(--np-label-3);
  display: block;
  margin-top: 1px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.np-rr-status {
  font-size: 11px;
  font-weight: 600;
  min-width: 32px;
  text-align: right;
  flex-shrink: 0;
}
.np-rr-status.s-2xx { color: var(--np-green); }
.np-rr-status.s-3xx { color: var(--np-orange); }
.np-rr-status.s-4xx { color: var(--np-orange); }
.np-rr-status.s-5xx { color: var(--np-red); }
.np-rr-status.s-0   { color: var(--np-label-3); }
.np-rr-dur {
  font-size: 11px;
  color: var(--np-label-3);
  min-width: 42px;
  text-align: right;
  flex-shrink: 0;
}
.np-req-row.is-slow .np-rr-dur {
  color: #ff9f0a;
}

.np-empty {
  padding: 32px 16px;
  text-align: center;
  color: var(--np-label-3);
  font-size: 13px;
}

/* ─── Detail pane ───────────────────────────────────────────────── */
.np-detail-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}
.np-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--np-label-3);
  font-size: 13px;
}
.np-placeholder.hidden { display: none; }

.np-detail-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.np-detail-view.hidden { display: none; }

.np-dv-head {
  padding: 10px 14px 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--np-sep-2);
  flex-shrink: 0;
}
.np-dv-method {
  font-size: 11px;
  font-weight: 700;
  border-radius: 4px;
  padding: 2px 7px;
  color: white;
  flex-shrink: 0;
}
.np-dv-method.m-GET { background: #32d74b; }
.np-dv-method.m-POST { background: #0a84ff; }
.np-dv-method.m-PUT { background: #ff9f0a; }
.np-dv-method.m-DELETE { background: #ff453a; }
.np-dv-method.m-PATCH { background: #bf5af2; }
.np-dv-method.m-HEAD,
.np-dv-method.m-OPTIONS { background: var(--np-bg-control); color: var(--np-label-2); }
.np-dv-url {
  flex: 1;
  font-size: 12px;
  font-family: 'SF Mono', Consolas, monospace;
  color: var(--np-label);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: text;
  user-select: text;
}
.np-dv-status { font-size: 12px; font-weight: 700; }
.np-dv-status.s-2xx { color: var(--np-green); }
.np-dv-status.s-3xx { color: var(--np-orange); }
.np-dv-status.s-4xx { color: var(--np-orange); }
.np-dv-status.s-5xx { color: var(--np-red); }
.np-dv-status.s-0   { color: var(--np-label-3); }
.np-dv-dur { font-size: 11px; color: var(--np-label-3); }
.np-dv-copy-bundle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: linear-gradient(180deg, rgba(10,132,255,0.28), rgba(10,132,255,0.18));
  border: 1px solid rgba(10,132,255,0.55);
  color: #4ea2ff;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px 4px 8px;
  border-radius: 5px;
  cursor: pointer;
  flex-shrink: 0;
  letter-spacing: 0.01em;
  box-shadow: 0 1px 0 rgba(255,255,255,0.04) inset, 0 2px 6px rgba(10,132,255,0.18);
  transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease, box-shadow 0.12s ease, transform 0.08s ease;
}
.np-dv-copy-bundle:hover {
  background: linear-gradient(180deg, rgba(10,132,255,0.4), rgba(10,132,255,0.26));
  color: #79bdff;
  border-color: rgba(10,132,255,0.75);
  box-shadow: 0 1px 0 rgba(255,255,255,0.06) inset, 0 3px 10px rgba(10,132,255,0.32);
}
.np-dv-copy-bundle:active { transform: translateY(1px); }
.np-dv-copy-bundle .np-dv-copy-icon { flex-shrink: 0; opacity: 0.95; }
.np-dv-copy-bundle.copied {
  background: linear-gradient(180deg, rgba(50,215,75,0.32), rgba(50,215,75,0.2));
  border-color: rgba(50,215,75,0.7);
  color: #5fe07a;
  box-shadow: 0 1px 0 rgba(255,255,255,0.06) inset, 0 3px 10px rgba(50,215,75,0.32);
}
.np-dv-copy-curl,
.np-dv-copy-ts {
  background: var(--np-bg-elevated);
  border: 1px solid var(--np-sep);
  color: var(--np-label-2);
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  cursor: pointer;
}
.np-dv-copy-curl:hover,
.np-dv-copy-ts:hover { background: var(--np-bg-control); color: var(--np-label); }

/* ─── Tab bar ───────────────────────────────────────────────────── */
.np-tab-bar {
  height: 32px;
  display: flex;
  align-items: flex-end;
  padding: 0 12px;
  gap: 1px;
  border-bottom: 1px solid var(--np-sep);
  flex-shrink: 0;
}
.np-tab {
  padding: 5px 12px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-size: 12px;
  color: var(--np-label-3);
  transition: color 0.12s;
  font-family: inherit;
}
.np-tab:hover { color: var(--np-label-2); }
.np-tab.active {
  color: var(--np-blue);
  border-bottom-color: var(--np-blue);
}
.np-tab.hidden { display: none; }

.np-tab-panels {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 10px 14px;
  scrollbar-width: thin;
}
.np-tab-panels::-webkit-scrollbar { width: 8px; }
.np-tab-panels::-webkit-scrollbar-thumb { background: var(--np-bg-control); border-radius: 4px; }
.np-panel.hidden { display: none; }

/* ─── KV tables ─────────────────────────────────────────────────── */
.np-kv-table { width: 100%; border-collapse: collapse; }
.np-kv-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--np-label-3);
  padding: 8px 0 4px;
}
.np-kv-row td {
  padding: 3px 6px 3px 0;
  font-size: 12px;
  vertical-align: top;
}
.np-kv-key {
  color: var(--np-label-3);
  min-width: 120px;
  white-space: nowrap;
}
.np-kv-val {
  color: var(--np-label);
  word-break: break-all;
  cursor: text;
  user-select: text;
}

/* ─── Body pre ──────────────────────────────────────────────────── */
.np-body-pre {
  font-family: 'SF Mono', Consolas, Menlo, monospace;
  font-size: 11.5px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--np-label);
  background: var(--np-bg-elevated);
  border-radius: 6px;
  padding: 10px;
  margin: 6px 0;
  border: 1px solid var(--np-sep-2);
  user-select: text;
}

/* ─── Actions row ───────────────────────────────────────────────── */
.np-actions-row {
  padding: 8px 14px;
  display: flex;
  gap: 8px;
  border-top: 1px solid var(--np-sep-2);
  flex-shrink: 0;
}
.np-action-btn {
  padding: 4px 12px;
  background: var(--np-bg-elevated);
  border: 1px solid var(--np-sep);
  border-radius: 5px;
  color: var(--np-label-2);
  font-size: 11.5px;
  cursor: pointer;
  font-family: inherit;
}
.np-action-btn:hover { background: var(--np-bg-control); color: var(--np-label); }

/* ─── Status bar ────────────────────────────────────────────────── */
.np-status-bar {
  height: 24px;
  display: flex;
  align-items: center;
  padding: 0 10px;
  gap: 14px;
  background: var(--np-bg-elevated);
  border-top: 1px solid var(--np-sep-2);
  flex-shrink: 0;
  font-size: 11px;
  color: var(--np-label-3);
  border-bottom-left-radius: 12px;
  border-bottom-right-radius: 12px;
}
.np-sb-badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 7px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
}
.np-sb-badge.hidden { display: none; }
.np-sb-n1 {
  background: rgba(255,159,10,0.15);
  color: var(--np-orange);
  border: 1px solid rgba(255,159,10,0.35);
}
.np-sb-errs {
  background: rgba(255,69,58,0.12);
  color: var(--np-red);
  border: 1px solid rgba(255,69,58,0.3);
}
.np-sb-sens {
  background: rgba(191,90,242,0.14);
  color: #d4a5ff;
  border: 1px solid rgba(191,90,242,0.35);
}

/* ─── Sensitive field badges (row + overlay) ───────────────────── */
.np-rr-sensitive {
  display: inline-block;
  margin-left: 6px;
  padding: 0 6px;
  border-radius: 8px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.02em;
  vertical-align: middle;
  border: 1px solid transparent;
}
.np-rr-sensitive.np-sens-auth {
  background: rgba(255,69,58,0.16);
  color: #ff8c85;
  border-color: rgba(255,69,58,0.4);
}
.np-rr-sensitive.np-sens-financial {
  background: rgba(255,159,10,0.16);
  color: #ffb547;
  border-color: rgba(255,159,10,0.4);
}
.np-rr-sensitive.np-sens-pii-high {
  background: rgba(191,90,242,0.16);
  color: #d4a5ff;
  border-color: rgba(191,90,242,0.4);
}
.np-rr-sensitive.np-sens-pii-medium {
  background: rgba(90,200,250,0.14);
  color: #6fd1f6;
  border-color: rgba(90,200,250,0.35);
}

/* Overlay: summary chips + per-finding rows */
.np-sens-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}
.np-sens-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
  border: 1px solid transparent;
}
.np-sens-chip.np-sens-auth,
.np-n1-count.np-sens-auth {
  background: rgba(255,69,58,0.16);
  color: #ff8c85;
  border-color: rgba(255,69,58,0.4);
}
.np-sens-chip.np-sens-financial,
.np-n1-count.np-sens-financial {
  background: rgba(255,159,10,0.16);
  color: #ffb547;
  border-color: rgba(255,159,10,0.4);
}
.np-sens-chip.np-sens-pii-high,
.np-n1-count.np-sens-pii-high {
  background: rgba(191,90,242,0.16);
  color: #d4a5ff;
  border-color: rgba(191,90,242,0.4);
}
.np-sens-chip.np-sens-pii-medium,
.np-n1-count.np-sens-pii-medium {
  background: rgba(90,200,250,0.14);
  color: #6fd1f6;
  border-color: rgba(90,200,250,0.35);
}
.np-sens-ep-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.np-sens-template {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.np-sens-toggle {
  background: transparent;
  border: 1px solid rgba(255,255,255,0.12);
  color: var(--np-label-2);
  width: 22px;
  height: 22px;
  border-radius: 5px;
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
}
.np-sens-toggle:hover {
  background: rgba(255,255,255,0.06);
  color: var(--np-label);
}
.np-sens-copy {
  background: rgba(99,102,241,0.16);
  border: 1px solid rgba(99,102,241,0.4);
  color: #a5b4fc;
  font-size: 10px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 6px;
  cursor: pointer;
  flex-shrink: 0;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.np-sens-copy:hover {
  background: rgba(99,102,241,0.28);
  color: #c7d2fe;
}
.np-sens-copy.copied {
  background: rgba(50,215,75,0.2);
  border-color: rgba(50,215,75,0.45);
  color: #6ee7a3;
}
.np-sens-group.collapsed .np-sens-finding-list { display: none; }

.np-sens-finding-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 6px;
}
.np-sens-finding {
  display: grid;
  grid-template-columns: 10px 56px 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  background: var(--np-bg-control);
  border-radius: 6px;
  font-size: 11px;
}
.np-sens-cat-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.np-sens-cat-dot.np-sens-auth { background: #ff8c85; }
.np-sens-cat-dot.np-sens-financial { background: #ffb547; }
.np-sens-cat-dot.np-sens-pii-high { background: #d4a5ff; }
.np-sens-cat-dot.np-sens-pii-medium { background: #6fd1f6; }
.np-sens-source {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--np-label-3);
  font-weight: 600;
}
.np-sens-path {
  color: var(--np-label);
  font-family: ui-monospace, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.np-sens-preview {
  color: var(--np-label-3);
  font-family: ui-monospace, monospace;
  font-size: 10px;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ─── JSON syntax highlighting ──────────────────────────────────── */
.np-json-key  { color: #5ac8fa; }
.np-json-str  { color: #32d74b; }
.np-json-num  { color: #ff9f0a; }
.np-json-bool { color: #bf5af2; }
.np-json-null { color: #ff453a; }

/* ─── Intel pane ────────────────────────────────────────────────── */
.np-intel-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.np-intel-pane.hidden { display: none; }
.np-intel-tab-bar {
  height: 32px;
  display: flex;
  align-items: flex-end;
  padding: 0 12px;
  gap: 1px;
  border-bottom: 1px solid var(--np-sep);
  flex-shrink: 0;
}
.np-intel-tab {
  padding: 5px 12px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-size: 12px;
  color: var(--np-label-3);
  font-family: inherit;
}
.np-intel-tab:hover { color: var(--np-label-2); }
.np-intel-tab.active {
  color: var(--np-blue);
  border-bottom-color: var(--np-blue);
}
.np-intel-content {
  flex: 1;
  overflow-y: auto;
  padding: 10px 14px;
  scrollbar-width: thin;
}
.np-intel-content::-webkit-scrollbar { width: 8px; }
.np-intel-content::-webkit-scrollbar-thumb { background: var(--np-bg-control); border-radius: 4px; }
/* ─── Call stack ─────────────────────────────────────────────────── */
.np-cs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
  margin-bottom: 2px;
}
.np-cs-header .np-kv-label { margin-top: 0; }

.np-cs-copy-all {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 2px 8px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.09);
  color: rgba(255,255,255,0.5);
  border-radius: 4px;
  cursor: pointer;
  font-family: ui-sans-serif, system-ui, sans-serif;
  transition: background 100ms, color 100ms, border-color 100ms;
}
.np-cs-copy-all:hover {
  background: rgba(99,102,241,0.18);
  color: #c7d2fe;
  border-color: rgba(99,102,241,0.4);
}

.np-callstack {
  background: var(--np-bg-elevated);
  border: 1px solid var(--np-sep-2);
  border-radius: 6px;
  padding: 6px 0;
  margin-top: 4px;
  font-family: 'SF Mono', ui-monospace, monospace;
  font-size: 10.5px;
}

.np-cs-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 3px;
  transition: background 0.08s;
}
.np-cs-row:hover { background: var(--np-bg-hover); }
.np-cs-row:hover .np-cs-copy { opacity: 1; }

.np-cs-idx {
  color: var(--np-label-3);
  min-width: 16px;
  text-align: right;
  flex-shrink: 0;
  font-size: 9.5px;
}

.np-cs-frame {
  flex: 1;
  color: var(--np-label-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.np-cs-frame:first-line { color: rgba(255,255,255,0.9); }

.np-cs-copy {
  opacity: 0;
  flex-shrink: 0;
  padding: 0 5px;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  color: rgba(255,255,255,0.4);
  border-radius: 3px;
  cursor: pointer;
  transition: background 100ms, color 100ms, opacity 100ms;
  font-family: ui-sans-serif, system-ui, sans-serif;
}
.np-cs-copy:hover {
  background: rgba(99,102,241,0.15);
  color: #c7d2fe;
  border-color: rgba(99,102,241,0.35);
}

.np-intel-card {
  background: var(--np-bg-elevated);
  border: 1px solid var(--np-sep-2);
  border-radius: 6px;
  padding: 10px;
  margin: 6px 0;
}
.np-intel-card-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--np-label);
  margin-bottom: 4px;
  font-family: 'SF Mono', monospace;
}
.np-intel-card-meta {
  font-size: 11px;
  color: var(--np-label-3);
  margin-bottom: 4px;
}
.np-intel-empty {
  color: var(--np-label-3);
  padding: 20px;
  text-align: center;
}
.np-field-added   { color: var(--np-green); font-size: 12px; }
.np-field-removed { color: var(--np-red); font-size: 12px; }
.np-field-changed { color: var(--np-orange); font-size: 12px; }
.np-anomaly-slow  { color: var(--np-orange); }
.np-anomaly-spike { color: var(--np-purple); }
.np-anomaly-critical { color: var(--np-red); font-weight: 600; }

/* ─── Token (JWT/Cookie) tab ───────────────────────────────────── */
.np-token-card {
  background: var(--np-bg-elevated);
  border-radius: 6px;
  padding: 10px 12px;
  margin: 6px 0;
  border: 1px solid var(--np-sep-2);
}
.np-token-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--np-label-3);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.np-token-section-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--np-label-3);
  margin: 8px 0 3px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.np-token-kv {
  display: flex;
  gap: 8px;
  font-size: 11.5px;
  margin: 2px 0;
  align-items: baseline;
}
.np-token-key {
  color: var(--np-label-3);
  min-width: 80px;
  flex-shrink: 0;
}
.np-token-val {
  color: var(--np-label);
  font-family: 'SF Mono', monospace;
  word-break: break-all;
  user-select: text;
  flex: 1;
}
.np-unix-time {
  color: var(--np-label-3);
  font-size: 10px;
  margin-left: 6px;
}

/* ─── TypeScript tab ───────────────────────────────────────────── */
.np-ts-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.np-ts-output {
  font-family: 'SF Mono', Consolas, Menlo, monospace;
  font-size: 11.5px;
  white-space: pre;
  color: var(--np-label);
  background: var(--np-bg-elevated);
  padding: 10px;
  border-radius: 6px;
  overflow-x: auto;
  user-select: text;
  border: 1px solid var(--np-sep-2);
  line-height: 1.5;
}

/* ─── Sparkline ─────────────────────────────────────────────────── */
.np-sb-spacer { flex: 1; }
.np-sb-spark {
  cursor: pointer;
  opacity: 0.75;
  border-radius: 3px;
  padding: 0 2px;
  display: flex;
  align-items: center;
  transition: opacity 0.15s;
}
.np-sb-spark:hover { opacity: 1; background: rgba(255,255,255,0.06); }

/* ─── Overlay ───────────────────────────────────────────────────── */
.np-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  border-radius: 12px;
  overflow: hidden;
}
.np-overlay.hidden { display: none; }
.np-overlay-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
}
.np-overlay-card {
  position: relative;
  background: rgba(22,22,24,0.98);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 10px;
  width: min(92%, 640px);
  max-height: 80%;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 60px rgba(0,0,0,0.7);
}
.np-overlay-head {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0;
}
.np-overlay-card-title {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255,255,255,0.9);
}
.np-overlay-close-btn {
  background: rgba(255,255,255,0.08);
  border: none;
  color: rgba(255,255,255,0.5);
  width: 22px; height: 22px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  display: flex; align-items: center; justify-content: center;
}
.np-overlay-close-btn:hover { background: rgba(255,255,255,0.14); color: rgba(255,255,255,0.9); }
.np-overlay-head-action {
  background: rgba(10,132,255,0.12);
  border: 1px solid rgba(10,132,255,0.25);
  color: rgba(10,132,255,0.9);
  font-size: 11px;
  font-weight: 500;
  padding: 3px 10px;
  border-radius: 5px;
  cursor: pointer;
  margin-right: 8px;
  white-space: nowrap;
}
.np-overlay-head-action:hover { background: rgba(10,132,255,0.22); color: #0a84ff; }
.np-overlay-body {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  scrollbar-width: thin;
  position: relative;
}
.np-chart-body { padding: 10px 14px 6px; }
.np-overlay-card.np-chart-card { width: min(96%, 900px); max-height: 90%; }

/* ─── Chart stats bar ────────────────────────────────────────────── */
.np-chart-stats-bar {
  display: flex;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 10px;
  flex-shrink: 0;
}
.np-chart-stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 10px;
  border-right: 1px solid rgba(255,255,255,0.06);
}
.np-chart-stat:last-child { border-right: none; }
.np-chart-stat-label {
  font-size: 9.5px;
  color: rgba(235,235,245,0.3);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 3px;
}
.np-chart-stat-value {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255,255,255,0.88);
  font-variant-numeric: tabular-nums;
}
.np-chart-stat-value.is-error { color: var(--np-red); }
.np-chart-stat-value.is-slow { color: var(--np-orange); }

/* ─── Chart view toggle ──────────────────────────────────────────── */
.np-chart-toggle {
  display: flex;
  gap: 2px;
  margin-bottom: 10px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  padding: 2px;
  width: fit-content;
  flex-shrink: 0;
}
.np-chart-toggle-btn {
  background: transparent;
  border: none;
  color: rgba(235,235,245,0.4);
  font-size: 12px;
  font-weight: 500;
  padding: 4px 14px;
  border-radius: 4px;
  cursor: pointer;
}
.np-chart-toggle-btn:hover { color: rgba(235,235,245,0.8); background: rgba(255,255,255,0.06); }
.np-chart-toggle-btn.active { background: rgba(10,132,255,0.22); color: #0a84ff; }
.np-chart-area { position: relative; }

/* ─── Waterfall rows ─────────────────────────────────────────────── */
.np-wf-wrap { display: flex; flex-direction: column; }
.np-wf-xaxis {
  position: relative;
  height: 16px;
  margin-bottom: 2px;
  margin-left: 196px;
  flex-shrink: 0;
}
.np-wf-xmark {
  position: absolute;
  transform: translateX(-50%);
  font-size: 9px;
  color: rgba(235,235,245,0.22);
  white-space: nowrap;
}
.np-wf-rows {
  overflow-y: auto;
  max-height: 340px;
  scrollbar-width: thin;
}
.np-wf-row {
  display: flex;
  align-items: center;
  height: 22px;
  gap: 6px;
  padding: 0 4px;
  border-radius: 3px;
  cursor: pointer;
}
.np-wf-row:hover { background: rgba(255,255,255,0.05); }
.np-wf-label {
  width: 190px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
}
.np-wf-path {
  flex: 1;
  font-size: 10.5px;
  font-family: 'SF Mono', Consolas, monospace;
  color: rgba(255,255,255,0.62);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.np-wf-timeline {
  flex: 1;
  position: relative;
  height: 10px;
}
.np-wf-bar {
  position: absolute;
  top: 0;
  height: 100%;
  border-radius: 2px;
  min-width: 3px;
  opacity: 0.82;
}
.np-wf-dur {
  width: 50px;
  flex-shrink: 0;
  text-align: right;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  color: rgba(235,235,245,0.35);
}
.np-wf-row.is-slow .np-wf-dur { color: var(--np-orange); }

/* ─── Tab copy bar ───────────────────────────────────────────────── */
.np-tab-copy-bar {
  display: flex;
  gap: 5px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  margin-bottom: 8px;
  flex-shrink: 0;
}
.np-tab-copy-btn {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.09);
  color: rgba(235,235,245,0.55);
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 4px;
  cursor: pointer;
}
.np-tab-copy-btn:hover { background: rgba(255,255,255,0.1); color: rgba(235,235,245,0.9); }

/* ─── N+1 / Error overlay content ──────────────────────────────── */
.np-n1-group {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 10px;
}
.np-n1-ep-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.np-n1-template {
  flex: 1;
  font-family: 'SF Mono', Consolas, monospace;
  font-size: 12px;
  color: rgba(255,255,255,0.85);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.np-n1-count {
  font-size: 11px;
  font-weight: 600;
  color: var(--np-orange);
  background: rgba(255,159,10,0.1);
  padding: 1px 8px;
  border-radius: 10px;
  white-space: nowrap;
  flex-shrink: 0;
}
.np-err-count { color: var(--np-red); background: rgba(255,69,58,0.1); }
.np-n1-sev-high { color: #ff6b35; background: rgba(255,107,53,0.12); }
.np-n1-sev-critical { color: var(--np-red); background: rgba(255,69,58,0.12); }
.np-n1-stats-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.np-n1-stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: rgba(235,235,245,0.65);
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 4px;
  padding: 1px 7px;
}
.np-n1-stat-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: rgba(235,235,245,0.35);
}
.np-n1-req-list { display: flex; flex-direction: column; gap: 2px; margin-bottom: 8px; }
.np-n1-req-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 6px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11.5px;
}
.np-n1-req-row:hover { background: rgba(255,255,255,0.06); }
.np-n1-path {
  flex: 1;
  font-family: 'SF Mono', Consolas, monospace;
  color: rgba(255,255,255,0.75);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.np-n1-more {
  font-size: 11px;
  color: rgba(235,235,245,0.3);
  padding: 2px 6px;
}
.np-n1-hint {
  font-size: 11px;
  color: rgba(235,235,245,0.4);
  font-style: italic;
  margin-top: 4px;
}

/* ─── Chart ─────────────────────────────────────────────────────── */
.np-chart-svg {
  display: block;
  width: 100%;
  height: auto;
  cursor: crosshair;
}
.np-chart-dot { cursor: pointer; transition: r 0.08s; }
.np-chart-waterfall {
  display: block;
  cursor: pointer;
}
.np-chart-section-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(235,235,245,0.25);
  padding: 8px 0 4px;
  margin-left: 52px;
}
.np-chart-tooltip {
  position: absolute;
  background: rgba(18,18,20,0.96);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 7px;
  padding: 7px 10px;
  pointer-events: none;
  z-index: 20;
  min-width: 160px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
}
.np-chart-tooltip.hidden { display: none; }
.np-chart-tt-path {
  font-family: 'SF Mono', Consolas, monospace;
  font-size: 11px;
  color: rgba(255,255,255,0.8);
  display: block;
  margin: 3px 0 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}
.np-chart-tt-meta {
  font-size: 11px;
  color: rgba(235,235,245,0.45);
}
`;
