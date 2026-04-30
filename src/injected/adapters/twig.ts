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
 * Twig debug comments adapter (Symfony / Twig with `twig.debug: true` enabled).
 *
 * Symfony renders templates wrapping their output with HTML comments:
 *
 *   <!-- BEGIN templates/blocks/header.html.twig -->
 *   <header>...</header>
 *   <!-- END templates/blocks/header.html.twig -->
 *
 * This adapter walks DOM siblings backward to find the enclosing BEGIN comment
 * for any element, then surfaces the template path as the source location and
 * the chain of nested templates as the owner chain.
 *
 * No PHP-side cooperation needed — the user just enables Twig debug in their
 * Symfony dev environment. Many Symfony projects already have it on by default.
 */

const BEGIN_PATTERN = /^\s*BEGIN\s+(.+\.twig)\s*$/i;
const END_PATTERN = /^\s*END\s+(.+\.twig)\s*$/i;
// Some bundles emit slightly different markers — accept the shorter form too.
const BEGIN_BLOCK_PATTERN = /\bBEGIN\b\s+(?:block\s+'[^']+'\s+)?\(?([^()<\s][^()<>\n]*\.twig)\)?/i;

// ─── Detection ──────────────────────────────────────────────────────

/**
 * Walk siblings backward, then up to parent and repeat, until we find the
 * enclosing BEGIN comment for an element. Returns the template path or null.
 */
function findEnclosingTwigTemplate(el: Element): string | null {
  let cur: Node | null = el;
  let depth = 0;

  while (cur) {
    let prev: Node | null = cur.previousSibling;
    while (prev) {
      if (prev.nodeType === Node.COMMENT_NODE) {
        const text = (prev as Comment).data;
        const endMatch = END_PATTERN.exec(text);
        const beginMatch = BEGIN_PATTERN.exec(text) ?? BEGIN_BLOCK_PATTERN.exec(text);
        if (endMatch) {
          depth += 1;
        } else if (beginMatch) {
          if (depth === 0) return beginMatch[1] ?? null;
          depth -= 1;
        }
      }
      prev = prev.previousSibling;
    }
    cur = cur.parentNode;
    if (!cur || cur.nodeType !== Node.ELEMENT_NODE) break;
  }

  return null;
}

/**
 * Walk up the tree collecting all enclosing template paths (innermost first).
 * Used to build the "Rendered by" / template chain.
 */
function findEnclosingTwigChain(el: Element, max = 10): string[] {
  const out: string[] = [];
  let cur: Node | null = el;
  let skipDepth = 0;

  while (cur && out.length < max) {
    let prev: Node | null = cur.previousSibling;
    while (prev && out.length < max) {
      if (prev.nodeType === Node.COMMENT_NODE) {
        const text = (prev as Comment).data;
        const endMatch = END_PATTERN.exec(text);
        const beginMatch = BEGIN_PATTERN.exec(text) ?? BEGIN_BLOCK_PATTERN.exec(text);
        if (endMatch) {
          skipDepth += 1;
        } else if (beginMatch) {
          if (skipDepth === 0) {
            const path = beginMatch[1];
            if (path && !out.includes(path)) out.push(path);
          } else {
            skipDepth -= 1;
          }
        }
      }
      prev = prev.previousSibling;
    }
    cur = cur.parentNode;
    if (!cur || cur.nodeType !== Node.ELEMENT_NODE) break;
  }

  return out;
}

// ─── Helpers ────────────────────────────────────────────────────────

function templateBasename(path: string): string {
  const slash = path.lastIndexOf('/');
  const file = slash >= 0 ? path.slice(slash + 1) : path;
  return file.replace(/\.html\.twig$/, '').replace(/\.twig$/, '');
}

function rectFromElement(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, width: r.width, height: r.height };
}

function attributesAsProps(el: Element): Record<string, SerializedValue> {
  const out: Record<string, SerializedValue> = {};
  for (const attr of Array.from(el.attributes)) {
    const value = attr.value;
    out[attr.name] = {
      type: 'primitive',
      value: value.length > 200 ? value.slice(0, 200) + '…' : value,
    };
  }
  return out;
}

function templateChainAsOwners(paths: string[]): OwnerInfo[] {
  return paths.map((path) => ({
    name: templateBasename(path),
    kind: 'options',
    source: { fileName: path },
  }));
}

// ─── Registry ───────────────────────────────────────────────────────

const elementRegistry = new Map<string, WeakRef<Element>>();
let registryCounter = 0;

function registerElement(el: Element): string {
  for (const [id, ref] of elementRegistry) {
    if (ref.deref() === el) return id;
  }
  const id = `t${++registryCounter}`;
  elementRegistry.set(id, new WeakRef(el));
  if (elementRegistry.size > 200) {
    const firstKey = elementRegistry.keys().next().value;
    if (firstKey) elementRegistry.delete(firstKey);
  }
  return id;
}

function lookupElement(id: string): Element | null {
  const ref = elementRegistry.get(id);
  if (!ref) return null;
  const el = ref.deref();
  if (!el || !el.isConnected) {
    elementRegistry.delete(id);
    return null;
  }
  return el;
}

// ─── Public adapter object ──────────────────────────────────────────

export const twigAdapter: FrameworkAdapter = {
  name: 'Twig',

  recognizes(el: Element): boolean {
    return findEnclosingTwigTemplate(el) !== null;
  },

  inspect(el: Element): ComponentInfo | null {
    const path = findEnclosingTwigTemplate(el);
    if (!path) return null;
    const chain = findEnclosingTwigChain(el);
    // The first item in the chain is the same as `path` — drop it from the owner chain.
    const owners = templateChainAsOwners(chain.slice(1));
    const parent: ComponentRef | null = chain[1]
      ? {
          fiberId: registerElement(el.parentElement ?? el),
          name: templateBasename(chain[1]),
          kind: 'options',
          source: { fileName: chain[1] },
        }
      : null;
    return {
      fiberId: registerElement(el),
      name: templateBasename(path),
      kind: 'options',
      source: { fileName: path },
      props: attributesAsProps(el),
      ownerChain: owners,
      parent,
      children: [],
      domTag: el.tagName.toLowerCase(),
      rect: rectFromElement(el),
    };
  },

  preview(el: Element): ComponentPreview {
    const path = findEnclosingTwigTemplate(el);
    const elementId = el.id || '';
    const className = el.getAttribute('class') ?? '';
    const source: SourceLocation | null = path ? { fileName: path } : null;
    const chain = path ? findEnclosingTwigChain(el).slice(1) : [];

    if (!path) {
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

    return {
      name: templateBasename(path),
      kind: 'options',
      rect: rectFromElement(el),
      domTag: el.tagName.toLowerCase(),
      source,
      propNames: Array.from(el.attributes).map((a) => a.name),
      parentName: chain[0] ? templateBasename(chain[0]) : null,
      childrenNames: [],
      ownerNames: chain.map((p) => templateBasename(p)),
      elementId,
      className,
    };
  },

  resolveById(id: string): Element | null {
    return lookupElement(id);
  },

  componentRect(el: Element): Rect {
    return rectFromElement(el);
  },

  findInstancesOfSameType(el: Element): Rect[] {
    // Same template = "same type" for Twig. We could scan all comments and union
    // the matching ones, but it's a niche feature. Return only the current rect.
    return [rectFromElement(el)];
  },

  version(): string | null {
    return null;
  },
};
