import type {
  ComponentInfo,
  ComponentPreview,
  ComponentRef,
  OwnerInfo,
  Rect,
  SerializedValue,
  SourceLocation,
} from '../../shared/messages';
import type { FrameworkAdapter } from './types';

/**
 * Laravel Livewire adapter (v3+, also reads v2 snapshot fields).
 *
 * Livewire renders each PHP component into a wrapper element carrying:
 *
 *   wire:id="UNIQUE-ID"
 *   wire:snapshot="{ JSON snapshot of the component }"
 *
 * The snapshot contains:
 *   - data       — public properties (the "props" of the component)
 *   - memo.name  — fully-qualified class name (e.g. "App\\Livewire\\UserProfile")
 *   - memo.path  — request path the component was rendered for (Livewire 3)
 *   - memo.method/memo.children — component routing/tree info
 *
 * We never run server-side code; everything we surface is read straight from
 * the rendered HTML / window.Livewire global. Source locations are inferred
 * by the Laravel convention: class App\Livewire\UserProfile lives in
 * app/Livewire/UserProfile.php (best-effort, configurable later).
 */

declare global {
  interface Window {
    Livewire?: {
      all?: () => Array<{ id: string; name: string }>;
      find?: (id: string) => unknown;
      version?: string;
    };
  }
}

// ─── Detection ──────────────────────────────────────────────────────

function isLivewireRoot(el: Element): boolean {
  return el.hasAttribute('wire:id');
}

function nearestLivewireRoot(el: Element): Element | null {
  let cur: Element | null = el;
  while (cur) {
    if (isLivewireRoot(cur)) return cur;
    cur = cur.parentElement;
  }
  return null;
}

// ─── Snapshot parsing ───────────────────────────────────────────────

type LivewireSnapshot = {
  data?: Record<string, unknown>;
  memo?: {
    name?: string;
    path?: string;
    method?: string;
    listeners?: string[];
    children?: Record<string, unknown>;
    locale?: string;
  };
};

function readSnapshot(el: Element): LivewireSnapshot | null {
  const raw = el.getAttribute('wire:snapshot');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LivewireSnapshot;
  } catch {
    return null;
  }
}

function classToFilePath(fullyQualifiedName: string): SourceLocation | null {
  // App\Livewire\UserProfile -> app/Livewire/UserProfile.php
  // App\Http\Livewire\UserProfile -> app/Http/Livewire/UserProfile.php (Livewire 2)
  if (!fullyQualifiedName) return null;
  const parts = fullyQualifiedName.split('\\').filter(Boolean);
  if (parts.length === 0) return null;
  // Lowercase the first segment ("App" -> "app") — this is the Laravel convention.
  const [first, ...rest] = parts;
  const segments = [first!.toLowerCase(), ...rest];
  return { fileName: segments.join('/') + '.php' };
}

// Livewire's data array is stored as `[value, metadata]` tuples in v3.
// In v2 it's a plain object. Normalise to plain values.
function normalizeLivewireData(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(value) && value.length === 2 && typeof value[1] === 'object') {
      // Tuple [value, metadata] (Livewire 3 hydration format)
      out[key] = value[0];
    } else {
      out[key] = value;
    }
  }
  return out;
}

// ─── Serialization ──────────────────────────────────────────────────

function previewObject(obj: object, maxKeys = 5): string {
  const keys = Object.keys(obj).slice(0, maxKeys);
  const more = Object.keys(obj).length > maxKeys ? `, +${Object.keys(obj).length - maxKeys}` : '';
  return `{ ${keys.join(', ')}${more} }`;
}

function serialize(value: unknown, depth = 0, seen = new WeakSet<object>()): SerializedValue {
  if (depth > 2 && value && typeof value === 'object') {
    return { type: 'object', keys: Object.keys(value).slice(0, 10), preview: previewObject(value) };
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
  if (t === 'function') return { type: 'function', name: (value as { name?: string }).name || 'anonymous' };
  if (t === 'object') {
    const obj = value as object;
    if (seen.has(obj)) return { type: 'circular' };
    seen.add(obj);
    try {
      if (Array.isArray(obj)) return { type: 'array', length: obj.length, preview: `Array(${obj.length})` };
      const keys = Object.keys(obj);
      return { type: 'object', keys: keys.slice(0, 20), preview: previewObject(obj) };
    } catch (err) {
      return { type: 'error', message: (err as Error).message };
    }
  }
  return { type: 'error', message: `unsupported type ${t}` };
}

// ─── Naming ─────────────────────────────────────────────────────────

function shortClassName(fqn: string | undefined): string {
  if (!fqn) return 'LivewireComponent';
  const parts = fqn.split('\\').filter(Boolean);
  return parts[parts.length - 1] ?? fqn;
}

// ─── Walks ──────────────────────────────────────────────────────────

function findChildLivewireRoots(root: Element, max = 50): Element[] {
  const out: Element[] = [];
  function visit(node: Element): void {
    if (out.length >= max) return;
    for (const child of Array.from(node.children)) {
      if (isLivewireRoot(child)) {
        out.push(child);
        // Don't recurse into nested Livewire components.
      } else {
        visit(child);
      }
    }
  }
  visit(root);
  return out;
}

function nearestParentLivewireRoot(root: Element): Element | null {
  let cur: Element | null = root.parentElement;
  while (cur) {
    if (isLivewireRoot(cur)) return cur;
    cur = cur.parentElement;
  }
  return null;
}

function ownerChain(root: Element, max = 10): OwnerInfo[] {
  const chain: OwnerInfo[] = [];
  let cur: Element | null = root.parentElement;
  while (cur && chain.length < max) {
    if (isLivewireRoot(cur)) {
      const snap = readSnapshot(cur);
      const fqn = snap?.memo?.name;
      chain.push({
        name: shortClassName(fqn),
        kind: 'options',
        source: classToFilePath(fqn ?? ''),
      });
    }
    cur = cur.parentElement;
  }
  return chain;
}

function rectFromElement(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, width: r.width, height: r.height };
}

// ─── Registry ───────────────────────────────────────────────────────

const livewireRegistry = new Map<string, WeakRef<Element>>();
let registryCounter = 0;

function registerRoot(el: Element): string {
  for (const [id, ref] of livewireRegistry) {
    if (ref.deref() === el) return id;
  }
  const id = `w${++registryCounter}`;
  livewireRegistry.set(id, new WeakRef(el));
  if (livewireRegistry.size > 200) {
    const firstKey = livewireRegistry.keys().next().value;
    if (firstKey) livewireRegistry.delete(firstKey);
  }
  return id;
}

function lookupRoot(id: string): Element | null {
  const ref = livewireRegistry.get(id);
  if (!ref) return null;
  const el = ref.deref();
  if (!el || !el.isConnected) {
    livewireRegistry.delete(id);
    return null;
  }
  return el;
}

function rootToRef(el: Element): ComponentRef {
  const snap = readSnapshot(el);
  const fqn = snap?.memo?.name;
  return {
    fiberId: registerRoot(el),
    name: shortClassName(fqn),
    kind: 'options',
    source: classToFilePath(fqn ?? ''),
  };
}

// ─── Public adapter object ──────────────────────────────────────────

export const livewireAdapter: FrameworkAdapter = {
  name: 'Laravel Livewire',

  recognizes(el: Element): boolean {
    return nearestLivewireRoot(el) !== null;
  },

  inspect(el: Element): ComponentInfo | null {
    const root = nearestLivewireRoot(el);
    if (!root) return null;
    const snap = readSnapshot(root);
    const fqn = snap?.memo?.name;

    // Build props: data + listeners (as a synthetic key for visibility)
    const props: Record<string, SerializedValue> = {};
    const data = normalizeLivewireData(snap?.data);
    for (const [k, v] of Object.entries(data)) {
      try {
        props[k] = serialize(v);
      } catch (err) {
        props[k] = { type: 'error', message: (err as Error).message };
      }
    }
    const listeners = snap?.memo?.listeners ?? [];
    if (listeners.length > 0) {
      props['$listeners'] = {
        type: 'array',
        length: listeners.length,
        preview: listeners.join(', '),
      };
    }
    if (snap?.memo?.path) {
      props['$path'] = { type: 'primitive', value: snap.memo.path };
    }

    const parent = nearestParentLivewireRoot(root);
    const children = findChildLivewireRoots(root);

    return {
      fiberId: registerRoot(root),
      name: shortClassName(fqn),
      kind: 'options',
      source: classToFilePath(fqn ?? ''),
      props,
      ownerChain: ownerChain(root),
      parent: parent ? rootToRef(parent) : null,
      children: children.map(rootToRef),
      domTag: el.tagName.toLowerCase(),
      rect: rectFromElement(el),
    };
  },

  preview(el: Element): ComponentPreview {
    const root = nearestLivewireRoot(el);
    const elementId = el.id || '';
    const className = el.getAttribute('class') ?? '';

    if (!root) {
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

    const snap = readSnapshot(root);
    const fqn = snap?.memo?.name;
    const data = normalizeLivewireData(snap?.data);
    const propNames = Object.keys(data);
    const owners = ownerChain(root, 5).map((o) => o.name);
    const children = findChildLivewireRoots(root, 8).map((c) =>
      shortClassName(readSnapshot(c)?.memo?.name),
    );
    const parent = nearestParentLivewireRoot(root);

    return {
      name: shortClassName(fqn),
      kind: 'options',
      rect: rectFromElement(el),
      domTag: el.tagName.toLowerCase(),
      source: classToFilePath(fqn ?? ''),
      propNames,
      parentName: parent ? shortClassName(readSnapshot(parent)?.memo?.name) : null,
      childrenNames: children,
      ownerNames: owners,
      elementId,
      className,
    };
  },

  resolveById(id: string): Element | null {
    return lookupRoot(id);
  },

  componentRect(el: Element): Rect {
    const root = nearestLivewireRoot(el);
    if (!root) return rectFromElement(el);
    return rectFromElement(root);
  },

  findInstancesOfSameType(el: Element): Rect[] {
    const root = nearestLivewireRoot(el);
    if (!root) return [];
    const targetName = readSnapshot(root)?.memo?.name;
    if (!targetName) return [];
    const rects: Rect[] = [];
    const all = document.querySelectorAll('[wire\\:id]');
    for (let i = 0; i < all.length && rects.length < 200; i += 1) {
      const candidate = all[i]!;
      const snap = readSnapshot(candidate);
      if (snap?.memo?.name === targetName) {
        const r = candidate.getBoundingClientRect();
        if (r.width > 0 || r.height > 0) {
          rects.push({ x: r.left, y: r.top, width: r.width, height: r.height });
        }
      }
    }
    return rects;
  },

  version(): string | null {
    return window.Livewire?.version ?? null;
  },
};
