/**
 * Smart label generator for HTTP requests.
 *
 * Converts a method + path into a human-readable label such as
 * "Create User" or "Get Order". Returns `null` when no meaningful
 * resource segment can be extracted (e.g. root path, only ids).
 */

const METHOD_VERBS: Record<string, string> = {
  GET: 'Get',
  POST: 'Create',
  PUT: 'Update',
  PATCH: 'Update',
  DELETE: 'Delete',
  HEAD: 'Check',
  OPTIONS: 'Options',
};

const NUMERIC_RE = /^[0-9]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LONG_HEX_RE = /^[0-9a-f]{20,}$/i;

/**
 * Generate a human-friendly label from an HTTP method and URL path.
 *
 * @param method HTTP method (case-sensitive — "GET", "POST", ...)
 * @param path URL path component, e.g. "/api/users/42"
 * @returns Label such as "Create User" or `null` when no resource segment found.
 */
export function smartLabel(method: string, path: string): string | null {
  const verb = METHOD_VERBS[method] ?? method;
  const segments = path.split('/').filter(Boolean);
  if (!segments.length) return null;

  let resource: string | null = null;
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i]!;
    if (NUMERIC_RE.test(seg)) continue;
    if (UUID_RE.test(seg)) continue;
    if (LONG_HEX_RE.test(seg)) continue;
    resource = seg;
    break;
  }
  if (!resource) return null;

  let noun = resource
    .replace(/[-_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();

  if (noun.endsWith('ies')) {
    noun = noun.slice(0, -3) + 'y';
  } else if (noun.endsWith('ses') || noun.endsWith('xes') || noun.endsWith('zes')) {
    noun = noun.slice(0, -2);
  } else if (noun.endsWith('s') && !noun.endsWith('ss')) {
    noun = noun.slice(0, -1);
  }

  noun = noun.replace(/\b\w/g, (c) => c.toUpperCase());
  return `${verb} ${noun}`;
}
