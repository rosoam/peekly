import type {
  RequestEntry,
  DriftEvent,
  AnomalyEvent,
  ErrorPattern,
  CacheEntry,
  N1Hit,
} from './types';

const MAX = 500;
let requests: RequestEntry[] = [];
let driftEvents: DriftEvent[] = [];
let anomalyEvents: AnomalyEvent[] = [];
const errorPatterns = new Map<string, ErrorPattern>();
const cacheTracker = new Map<string, CacheEntry>();
const n1Patterns = new Map<string, N1Hit>();

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

function notify(): void {
  for (const fn of listeners) fn();
}

function normalizePath(path: string): string {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/[0-9a-f]{24,}/gi, '/:id')
    .replace(/\/[0-9]+/g, '/:id');
}

export function addRequest(entry: RequestEntry): void {
  requests.push(entry);
  if (requests.length > MAX) requests.shift();
  trackErrorFingerprint(entry);
  updateCacheTracker(entry);
  detectN1(entry);
  notify();
}

export function addDriftEvent(evt: DriftEvent): void {
  driftEvents.unshift(evt);
  if (driftEvents.length > 100) driftEvents.pop();
  notify();
}

export function addAnomalyEvent(evt: AnomalyEvent): void {
  anomalyEvents.unshift(evt);
  if (anomalyEvents.length > 100) anomalyEvents.pop();
  notify();
}

export function clearAll(): void {
  requests = [];
  driftEvents = [];
  anomalyEvents = [];
  errorPatterns.clear();
  cacheTracker.clear();
  n1Patterns.clear();
  notify();
}

export function getState() {
  return {
    requests: [...requests],
    driftEvents: [...driftEvents],
    anomalyEvents: [...anomalyEvents],
    errorPatterns: [...errorPatterns.values()].sort((a, b) => b.count - a.count),
    cacheEntries: [...cacheTracker.values()]
      .filter((c) => c.count > 1)
      .sort((a, b) => b.count - a.count),
    n1Hits: [...n1Patterns.values()],
  };
}

function trackErrorFingerprint(r: RequestEntry): void {
  if (!r.status || r.status < 400) return;
  const template = normalizePath(r.path);
  const key = `${r.method} ${template} → ${r.status}`;
  const e = errorPatterns.get(key);
  if (e) {
    e.count++;
    e.requestIds.push(r.id);
  } else {
    errorPatterns.set(key, {
      fingerprint: key,
      method: r.method,
      template,
      status: r.status,
      count: 1,
      requestIds: [r.id],
    });
  }
}

function updateCacheTracker(r: RequestEntry): void {
  if (r.method !== 'GET' && r.method !== 'HEAD') return;
  const sig = `${r.method} ${r.path}${r.query ? '?' + r.query : ''}`;
  const e = cacheTracker.get(sig);
  if (e) {
    e.count++;
    e.requestIds.push(r.id);
  } else {
    cacheTracker.set(sig, {
      signature: sig,
      method: r.method,
      path: r.path,
      count: 1,
      requestIds: [r.id],
    });
  }
}

function detectN1(r: RequestEntry): void {
  const now = Date.now();
  const template = normalizePath(r.path);
  const key = `${r.method} ${template}`;
  const recent = requests.filter(
    (x) =>
      x.method === r.method &&
      normalizePath(x.path) === template &&
      now - x.timestamp < 3000,
  );
  if (recent.length >= 3) {
    n1Patterns.set(key, {
      fingerprint: key,
      method: r.method,
      template,
      count: recent.length,
      lastSeen: now,
    });
  }
}
