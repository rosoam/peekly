export const BUFFER_MAX = 512 * 1024;

export type RequestEntry = {
  id: string;
  timestamp: number;
  method: string;
  url: string;
  path: string;
  query: string;
  host: string;
  requestHeaders: Record<string, string>;
  requestBody: string;
  requestBodySize: number;
  responseHeaders: Record<string, string>;
  responseBody: string;
  responseBodySize: number;
  status: number;
  duration: number;
  type: 'http';
  component?: string;
  callStack?: string[];
};

export type DriftEvent = {
  endpoint: string;
  added: string[];
  removed: string[];
  typeChanged: Array<{ field: string; from: string; to: string }>;
  timestamp: number;
  requestId: string;
};

export type AnomalyEvent = {
  endpoint: string;
  type: 'slow' | 'frequency';
  severity: 'warning' | 'critical';
  value: number;
  baseline: { p95?: number; medianRate?: number };
  requestId: string;
  timestamp: number;
};

export type ErrorPattern = {
  fingerprint: string;
  method: string;
  template: string;
  status: number;
  count: number;
  requestIds: string[];
};

export type CacheEntry = {
  signature: string;
  method: string;
  path: string;
  count: number;
  requestIds: string[];
};

export type N1Hit = {
  fingerprint: string;
  method: string;
  template: string;
  count: number;
  lastSeen: number;
};

export type GraphQLInfo = {
  operationType: 'query' | 'mutation' | 'subscription' | 'unknown';
  operationName?: string;
  variables?: Record<string, unknown>;
  query: string;
};

export type JwtDecoded = {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  raw: string;
};
