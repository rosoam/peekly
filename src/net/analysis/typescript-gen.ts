/**
 * Generate a TypeScript `interface Response` declaration from a JSON
 * response body. Returns `null` when the body is not parseable JSON.
 */

function toTsType(val: unknown, depth: number): string {
  const inner = '  '.repeat(depth + 1);
  const base = '  '.repeat(depth);

  if (val === null) return 'null';
  if (val === undefined) return 'undefined';

  if (Array.isArray(val)) {
    if (!val.length) return 'unknown[]';
    const item = val[0];
    if (typeof item !== 'object' || item === null) return `${typeof item}[]`;
    const entries = Object.entries(item as Record<string, unknown>);
    const body = entries
      .map(([k, v]) => `${inner}  ${k}: ${toTsType(v, depth + 2)};`)
      .join('\n');
    return `Array<{\n${body}\n${inner}}>`;
  }

  if (typeof val === 'object') {
    const entries = Object.entries(val as Record<string, unknown>);
    if (!entries.length) return 'Record<string, unknown>';
    const lines = entries
      .map(([k, v]) => `${inner}${k}: ${toTsType(v, depth + 1)};`)
      .join('\n');
    return `{\n${lines}\n${base}}`;
  }

  return typeof val;
}

/**
 * Build a `export interface Response { ... }` declaration matching the
 * structure of the provided JSON response body.
 *
 * @param responseBody Raw JSON string.
 * @returns A TypeScript interface declaration, or `null` on parse error.
 */
export function generateTsInterface(responseBody: string): string | null {
  try {
    const json: unknown = JSON.parse(responseBody);
    return `export interface Response ${toTsType(json, 0)}`;
  } catch {
    return null;
  }
}
