import type { RequestEntry } from '../types';

/**
 * Sensitive-field detector.
 *
 * Walks JSON request/response bodies and flags keys whose names look like
 * personal, financial, or authentication data. Detection is conservative —
 * key-name matching only, no value-based heuristics — so the false-positive
 * rate stays low and the panel can render the badge without scaring users
 * on every API.
 *
 * Categories:
 *   - auth         credentials, tokens, secrets, session keys
 *   - financial    card numbers, IBAN, routing/account numbers, CVV
 *   - pii-high     SSN, passport, national ID, medical, geolocation precise
 *   - pii-medium   email, phone, address, DOB, full name, IP
 */

export type SensitiveCategory = 'auth' | 'financial' | 'pii-high' | 'pii-medium';

export type SensitiveFinding = {
  /** Dotted JSON path, e.g. "user.email" or "items[0].card.number". */
  path: string;
  /** The key name as observed (original case). */
  key: string;
  /** Where the field was found. */
  source: 'request' | 'response';
  category: SensitiveCategory;
  /** Short, redacted preview of the value (first 24 chars + "…"). */
  preview: string;
};

const MAX_FINDINGS = 50;
const MAX_NODES = 5000;
const PREVIEW_MAX = 24;

// Patterns are tested against lowercased key names with non-alphanumeric chars
// stripped (so `user_email`, `userEmail`, `User-Email` all collapse to `useremail`).
type Pattern = { test: (k: string) => boolean; category: SensitiveCategory };

function exact(...keys: string[]): (k: string) => boolean {
  const set = new Set(keys);
  return (k) => set.has(k);
}

function endsWith(...suffixes: string[]): (k: string) => boolean {
  return (k) => suffixes.some((s) => k.endsWith(s));
}

function contains(...needles: string[]): (k: string) => boolean {
  return (k) => needles.some((n) => k.includes(n));
}

function any(...preds: Array<(k: string) => boolean>): (k: string) => boolean {
  return (k) => preds.some((p) => p(k));
}

const PATTERNS: Pattern[] = [
  // — Auth / secrets ————————————————————————————————————————
  {
    category: 'auth',
    test: any(
      exact('password', 'passwd', 'pwd', 'pass', 'passphrase', 'pin', 'otp'),
      contains('apikey', 'api_key', 'accesstoken', 'access_token', 'refreshtoken', 'refresh_token'),
      contains('idtoken', 'id_token', 'sessiontoken', 'sessionid', 'sessionkey', 'csrf'),
      contains('privatekey', 'secretkey', 'clientsecret'),
      exact('secret', 'token', 'jwt', 'bearer', 'auth'),
      endsWith('secret', '_token', 'token', '_key', 'apikey'),
    ),
  },
  // — Financial ————————————————————————————————————————————
  {
    category: 'financial',
    test: any(
      contains('cardnumber', 'card_number', 'ccnumber', 'cc_number', 'pan'),
      exact('cvv', 'cvc', 'csc', 'cardcode'),
      contains('iban', 'bic', 'swift', 'routingnumber', 'routing_number', 'accountnumber', 'account_number'),
      contains('expirymonth', 'expiryyear', 'expmonth', 'expyear', 'cardexpiry'),
    ),
  },
  // — PII high (regulated identifiers) ——————————————————————
  {
    category: 'pii-high',
    test: any(
      exact('ssn', 'sin', 'nino', 'avs', 'ahv', 'fiscalcode', 'taxid', 'tax_id'),
      contains('socialsecurity', 'social_security', 'nationalid', 'national_id'),
      contains('passport', 'driverlicense', 'drivers_license', 'driverslicense'),
      contains('healthcard', 'medicalrecord', 'patientid', 'insurancenumber'),
      contains('latitude', 'longitude', 'geolocation', 'gpscoord'),
    ),
  },
  // — PII medium (contact + low-entropy identifiers) ————————
  {
    category: 'pii-medium',
    test: any(
      exact('email', 'mail', 'phone', 'mobile', 'tel', 'telephone', 'fax'),
      contains('emailaddress', 'phonenumber', 'mobilenumber'),
      exact('dob', 'birthdate', 'birthday', 'dateofbirth'),
      exact('firstname', 'lastname', 'fullname', 'middlename', 'maidenname'),
      contains('streetaddress', 'postaladdress', 'homeaddress', 'shippingaddress', 'billingaddress'),
      exact('street', 'city', 'postalcode', 'zip', 'zipcode'),
      exact('ipaddress', 'ip', 'remoteip', 'clientip', 'useragent'),
    ),
  },
];

function normalizeKey(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function classify(key: string): SensitiveCategory | null {
  const n = normalizeKey(key);
  if (!n) return null;
  for (const p of PATTERNS) {
    if (p.test(n)) return p.category;
  }
  return null;
}

function tryParseJson(s: string): unknown | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (!trimmed) return null;
  if (trimmed[0] !== '{' && trimmed[0] !== '[') return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

function previewValue(v: unknown): string {
  if (v === null) return 'null';
  if (typeof v === 'undefined') return 'undefined';
  if (typeof v === 'string') {
    return v.length > PREVIEW_MAX ? v.slice(0, PREVIEW_MAX) + '…' : v;
  }
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return `[${v.length}]`;
  return '{…}';
}

type Walker = {
  findings: SensitiveFinding[];
  source: 'request' | 'response';
  nodes: number;
};

function walk(value: unknown, path: string, w: Walker): void {
  if (w.findings.length >= MAX_FINDINGS) return;
  if (w.nodes >= MAX_NODES) return;
  w.nodes += 1;

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      walk(value[i], `${path}[${i}]`, w);
      if (w.findings.length >= MAX_FINDINGS) return;
    }
    return;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const nextPath = path ? `${path}.${k}` : k;
      const cat = classify(k);
      if (cat) {
        w.findings.push({
          path: nextPath,
          key: k,
          source: w.source,
          category: cat,
          preview: previewValue(v),
        });
        // Don't recurse into a flagged value: avoids producing N findings for
        // a single nested user object (e.g. user.email + user.address.street
        // is intentional, but user.password.plaintext isn't useful extra).
        if (typeof v !== 'object' || v === null) continue;
      }
      walk(v, nextPath, w);
      if (w.findings.length >= MAX_FINDINGS) return;
    }
  }
}

export function detectSensitiveFields(r: RequestEntry): SensitiveFinding[] {
  const out: SensitiveFinding[] = [];

  const reqJson = tryParseJson(r.requestBody);
  if (reqJson) {
    const w: Walker = { findings: out, source: 'request', nodes: 0 };
    walk(reqJson, '', w);
  }

  if (out.length < MAX_FINDINGS) {
    const resJson = tryParseJson(r.responseBody);
    if (resJson) {
      const w: Walker = { findings: out, source: 'response', nodes: 0 };
      walk(resJson, '', w);
    }
  }

  return out;
}

export function hasSensitiveFields(r: RequestEntry): boolean {
  return detectSensitiveFields(r).length > 0;
}

export function severityOf(findings: SensitiveFinding[]): SensitiveCategory | null {
  if (findings.length === 0) return null;
  const order: SensitiveCategory[] = ['auth', 'financial', 'pii-high', 'pii-medium'];
  for (const cat of order) {
    if (findings.some((f) => f.category === cat)) return cat;
  }
  return null;
}
