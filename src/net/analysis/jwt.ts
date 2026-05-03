import type { RequestEntry, JwtDecoded } from '../types';

/**
 * Decode a base64url-encoded segment to its UTF-8 string content.
 * Returns an empty string when the input is malformed.
 */
function base64urlDecode(str: string): string {
  const padded = str
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(str.length / 4) * 4, '=');
  try {
    return atob(padded);
  } catch {
    return '';
  }
}

/**
 * Decode a JWT into header/payload/raw. Does NOT verify the signature.
 */
export function decodeJwt(token: string): JwtDecoded | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(base64urlDecode(parts[0]!)) as Record<string, unknown>;
    const payload = JSON.parse(base64urlDecode(parts[1]!)) as Record<string, unknown>;
    return { header, payload, raw: token };
  } catch {
    return null;
  }
}

export type TokenEntry = { name: string; decoded: JwtDecoded; raw: string };
export type CookieEntry = { name: string; value: string };

/**
 * Extract every JWT token observed on a request, both from the request's
 * Authorization header and from any response header whose name contains "token".
 */
export function extractJwtTokens(r: RequestEntry): TokenEntry[] {
  const tokens: TokenEntry[] = [];

  const auth = r.requestHeaders['authorization'] ?? r.requestHeaders['Authorization'] ?? '';
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    const decoded = decodeJwt(token);
    if (decoded) tokens.push({ name: 'Authorization', decoded, raw: token });
  }

  for (const [k, v] of Object.entries(r.responseHeaders)) {
    if (k.toLowerCase().includes('token') && typeof v === 'string') {
      const decoded = decodeJwt(v.trim());
      if (decoded) tokens.push({ name: k, decoded, raw: v.trim() });
    }
  }

  return tokens;
}

/**
 * Extract cookies seen on a request, both from the request `Cookie` header
 * and from a single `Set-Cookie` response header (if present).
 */
export function extractCookies(r: RequestEntry): CookieEntry[] {
  const cookies: CookieEntry[] = [];

  const cookieHeader = r.requestHeaders['cookie'] ?? r.requestHeaders['Cookie'] ?? '';
  if (cookieHeader) {
    cookieHeader.split(';').forEach((part) => {
      const idx = part.indexOf('=');
      if (idx > -1) {
        cookies.push({
          name: part.slice(0, idx).trim(),
          value: part.slice(idx + 1).trim(),
        });
      }
    });
  }

  const setCookie = r.responseHeaders['set-cookie'] ?? r.responseHeaders['Set-Cookie'] ?? '';
  if (setCookie) {
    const idx = setCookie.indexOf('=');
    if (idx > -1) {
      const name = setCookie.slice(0, idx).trim();
      const rest = setCookie.slice(idx + 1).split(';')[0]?.trim() ?? '';
      if (!cookies.find((c) => c.name === name)) {
        cookies.push({ name, value: rest });
      }
    }
  }

  return cookies;
}

/**
 * Convenience predicate: does this request carry any JWT or cookie?
 */
export function hasJwtOrCookies(r: RequestEntry): boolean {
  return extractJwtTokens(r).length > 0 || extractCookies(r).length > 0;
}
