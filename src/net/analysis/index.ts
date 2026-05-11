/**
 * Barrel for the network analysis modules.
 *
 * Each submodule is purely functional and depends only on `../types`.
 * Modules with module-level state (`drift`, `anomaly`) are scoped to
 * the host context (one extension content-script instance per tab).
 */

export { smartLabel } from './smart-labels';
export { detectGraphQL } from './graphql';
export {
  decodeJwt,
  extractJwtTokens,
  extractCookies,
  hasJwtOrCookies,
} from './jwt';
export type { TokenEntry, CookieEntry } from './jwt';
export { generateTsInterface } from './typescript-gen';
export { checkDrift } from './drift';
export { checkAnomaly } from './anomaly';
export {
  detectSensitiveFields,
  hasSensitiveFields,
  severityOf,
} from './sensitive';
export type { SensitiveFinding, SensitiveCategory } from './sensitive';
