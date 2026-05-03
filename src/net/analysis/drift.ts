import type { RequestEntry, DriftEvent } from '../types';

/**
 * Schema drift detection for JSON responses.
 *
 * Tracks a fingerprint of the response shape per `METHOD path` endpoint.
 * Emits a `DriftEvent` whenever the shape changes between two consecutive
 * 2xx responses (added/removed fields or any other shape change).
 */

const schemas = new Map<string, string>();
const MAX_SCHEMAS = 200;

/**
 * Build a compact textual schema for a JSON value. Recursion is bounded
 * (depth & object width) to keep the fingerprint small and stable.
 */
function schemaOf(val: unknown, depth = 0): string {
  if (depth > 6 || val === null || val === undefined) return typeof val;
  if (Array.isArray(val)) {
    return val.length ? `[${schemaOf(val[0], depth + 1)}]` : '[]';
  }
  if (typeof val === 'object') {
    const entries = Object.entries(val as Record<string, unknown>).slice(0, 20);
    return (
      '{' +
      entries.map(([k, v]) => `${k}:${schemaOf(v, depth + 1)}`).join(',') +
      '}'
    );
  }
  return typeof val;
}

/**
 * Extract top-level keys mentioned in a schema fingerprint.
 * (We only diff the outermost object level — nested drifts roll up.)
 */
function parseSchemaKeys(schema: string): Set<string> {
  const keys = new Set<string>();
  schema.replace(/\{([^{}]+)\}/g, (_match, inner: string) => {
    inner.split(',').forEach((pair) => {
      const key = pair.split(':')[0];
      if (key) keys.add(key);
    });
    return '';
  });
  return keys;
}

/**
 * Compare the current response shape to the previously seen one for the
 * same endpoint. Stores the new shape regardless of the comparison result.
 *
 * @returns A `DriftEvent` if the shape changed, otherwise `null`.
 */
export function checkDrift(r: RequestEntry): DriftEvent | null {
  if (!r.responseBody || r.status < 200 || r.status >= 300) return null;

  let body: unknown;
  try {
    body = JSON.parse(r.responseBody);
  } catch {
    return null;
  }

  const endpoint = `${r.method} ${r.path}`;
  const newSchema = schemaOf(body);
  const oldSchema = schemas.get(endpoint);

  // Cap memory: don't track new endpoints once full.
  if (schemas.size >= MAX_SCHEMAS && !schemas.has(endpoint)) return null;
  schemas.set(endpoint, newSchema);

  if (!oldSchema || oldSchema === newSchema) return null;

  const oldKeys = parseSchemaKeys(oldSchema);
  const newKeys = parseSchemaKeys(newSchema);

  const added = [...newKeys].filter((k) => !oldKeys.has(k));
  const removed = [...oldKeys].filter((k) => !newKeys.has(k));
  const typeChanged: Array<{ field: string; from: string; to: string }> = [];

  if (added.length === 0 && removed.length === 0 && oldSchema !== newSchema) {
    typeChanged.push({
      field: '(schema)',
      from: oldSchema.slice(0, 50),
      to: newSchema.slice(0, 50),
    });
  }

  if (!added.length && !removed.length && !typeChanged.length) return null;

  return {
    endpoint,
    added,
    removed,
    typeChanged,
    timestamp: Date.now(),
    requestId: r.id,
  };
}
