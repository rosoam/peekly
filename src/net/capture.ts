import { BUFFER_MAX } from './types';
import type { RequestEntry } from './types';

const NET_SOURCE = 'peekly-net' as const;

function parseUrl(url: string): { path: string; query: string; host: string } {
  try {
    const u = new URL(url);
    return { path: u.pathname, query: u.search.slice(1), host: u.host };
  } catch {
    const idx = url.indexOf('?');
    return {
      path: idx > -1 ? url.slice(0, idx) : url,
      query: idx > -1 ? url.slice(idx + 1) : '',
      host: '',
    };
  }
}

function capBody(text: string): string {
  if (text.length > BUFFER_MAX) return text.slice(0, BUFFER_MAX) + '\n[truncated]';
  return text;
}

function headersToRecord(headers: Headers): Record<string, string> {
  const rec: Record<string, string> = {};
  headers.forEach((v, k) => {
    rec[k] = v;
  });
  return rec;
}

function postEntry(entry: RequestEntry): void {
  window.postMessage({ source: NET_SOURCE, kind: 'net-request', data: entry }, '*');
}

const SKIP_INTERNALS = [
  'capture.ts', 'at new Promise', 'at XMLHttpRequest',
  '<anonymous>', 'node_modules/', 'webpack-internal:', 'webpack://',
  'at Object.<', 'at Module.<', 'at __webpack',
];

function formatFrame(line: string): string | null {
  if (!line.includes(' at ')) return null;
  if (SKIP_INTERNALS.some((s) => line.includes(s))) return null;
  return line.trim().replace(/^at /, '');
}

function getStackInfo(): { component: string | undefined; callStack: string[] } {
  let component: string | undefined;
  const callStack: string[] = [];
  try {
    const lines = (new Error().stack ?? '').split('\n');
    for (const line of lines) {
      if (!line.includes(' at ')) continue;
      if (SKIP_INTERNALS.some((s) => line.includes(s))) continue;

      // Collect meaningful frames (cap at 12)
      if (callStack.length < 12) {
        const frame = formatFrame(line);
        if (frame) callStack.push(frame);
      }

      // First PascalCase function = component
      if (!component) {
        const m = line.match(/at (?:new )?([A-Z][a-zA-Z0-9$]+)[\s.(]/);
        if (m?.[1] && !['Object', 'Array', 'Promise', 'Error', 'Map', 'Set', 'Function'].includes(m[1])) {
          component = m[1];
        }
        if (!component) {
          const f = line.match(/\/(?:component|page|view|screen|feature)s?\/([A-Za-z][A-Za-z0-9_-]+)\./);
          if (f?.[1]) component = f[1];
        }
      }
    }
  } catch { /* ignore */ }
  return { component, callStack };
}

export function initNetworkCapture(): void {
  const origFetch = window.fetch.bind(window);

  type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  const patchedFetch: FetchFn = async function (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const startTime = performance.now();
    const id = Math.random().toString(36).slice(2);
    const reqUrl =
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    // Skip extension internal requests
    if (reqUrl.startsWith('chrome-extension://') || reqUrl.startsWith('moz-extension://')) {
      return origFetch(input, init);
    }

    const { path, query, host } = parseUrl(reqUrl);
    const { component, callStack } = getStackInfo();
    const method = (
      init?.method ??
      (typeof input === 'object' && 'method' in input ? input.method : 'GET') ??
      'GET'
    ).toUpperCase();

    let reqBody = '';
    if (init?.body) {
      try {
        reqBody = typeof init.body === 'string' ? init.body : JSON.stringify(init.body);
      } catch {
        reqBody = String(init.body);
      }
    } else if (typeof input === 'object' && 'bodyUsed' in input) {
      try {
        const clonedReq = (input as Request).clone();
        reqBody = await clonedReq.text().catch(() => '');
      } catch {
        /* ignore */
      }
    }

    const reqHeaders: Record<string, string> = {};
    const headersInit = init?.headers;
    if (headersInit instanceof Headers) {
      headersInit.forEach((v, k) => {
        reqHeaders[k] = v;
      });
    } else if (Array.isArray(headersInit)) {
      for (const pair of headersInit) {
        if (pair.length >= 2) reqHeaders[pair[0]!] = pair[1]!;
      }
    } else if (headersInit && typeof headersInit === 'object') {
      Object.entries(headersInit).forEach(([k, v]) => {
        if (typeof v === 'string') reqHeaders[k] = v;
      });
    }

    // Also read headers from the Request object itself (init headers take priority)
    if (typeof input === 'object' && input instanceof Request) {
      input.headers.forEach((v, k) => {
        if (!(k in reqHeaders)) reqHeaders[k] = v;
      });
    }

    let response: Response;
    let status = 0;
    let responseBody = '';
    let responseHeaders: Record<string, string> = {};

    try {
      response = await origFetch(input, init);
      status = response.status;
      responseHeaders = headersToRecord(response.headers);
      const clone = response.clone();
      try {
        responseBody = capBody(await clone.text());
      } catch {
        responseBody = '[unreadable]';
      }
    } catch (err) {
      const duration = Math.round(performance.now() - startTime);
      postEntry({
        id,
        timestamp: Date.now(),
        method,
        url: reqUrl,
        path,
        query,
        host,
        component,
        callStack,
        requestHeaders: reqHeaders,
        requestBody: capBody(reqBody),
        requestBodySize: reqBody.length,
        responseHeaders: {},
        responseBody: String(err),
        responseBodySize: 0,
        status: 0,
        duration,
        type: 'http',
      });
      throw err;
    }

    const duration = Math.round(performance.now() - startTime);
    postEntry({
      id,
      timestamp: Date.now(),
      method,
      url: reqUrl,
      path,
      query,
      host,
      component,
      callStack,
      requestHeaders: reqHeaders,
      requestBody: capBody(reqBody),
      requestBodySize: reqBody.length,
      responseHeaders,
      responseBody,
      responseBodySize: responseBody.length,
      status,
      duration,
      type: 'http',
    });
    return response;
  };
  (window as unknown as { fetch: FetchFn }).fetch = patchedFetch;

  // XHR patching
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  type PatchedXHR = XMLHttpRequest & {
    _pMethod?: string;
    _pUrl?: string;
    _pBody?: string;
    _pHeaders?: Record<string, string>;
  };

  const origSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.setRequestHeader = function (
    this: PatchedXHR,
    name: string,
    value: string,
  ) {
    if (!this._pHeaders) this._pHeaders = {};
    this._pHeaders[name.toLowerCase()] = value;
    return origSetRequestHeader.call(this, name, value);
  };

  XMLHttpRequest.prototype.open = function (
    this: PatchedXHR,
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ) {
    this._pMethod = method.toUpperCase();
    this._pUrl = url instanceof URL ? url.href : url;
    return (origOpen as unknown as (...a: unknown[]) => void).call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (
    this: PatchedXHR,
    body?: Document | XMLHttpRequestBodyInit | null,
  ) {
    const startTime = performance.now();
    const id = Math.random().toString(36).slice(2);
    const reqUrl = this._pUrl ?? '';
    const method = this._pMethod ?? 'GET';

    if (reqUrl.startsWith('chrome-extension://') || reqUrl.startsWith('moz-extension://')) {
      return origSend.call(this, body ?? null);
    }

    const { path, query, host } = parseUrl(reqUrl);
    const { component, callStack } = getStackInfo();
    let reqBody = '';
    if (body && typeof body === 'string') reqBody = body;

    this.addEventListener('loadend', () => {
      const duration = Math.round(performance.now() - startTime);
      const responseText =
        this.responseType === '' || this.responseType === 'text'
          ? capBody(this.responseText || '')
          : '[binary]';
      const respHeaders: Record<string, string> = {};
      const raw = this.getAllResponseHeaders();
      raw
        .trim()
        .split('\r\n')
        .forEach((line) => {
          const idx = line.indexOf(': ');
          if (idx > -1) respHeaders[line.slice(0, idx).toLowerCase()] = line.slice(idx + 2);
        });
      postEntry({
        id,
        timestamp: Date.now(),
        method,
        url: reqUrl,
        path,
        query,
        host,
        component,
        callStack,
        requestHeaders: this._pHeaders ?? {},
        requestBody: capBody(reqBody),
        requestBodySize: reqBody.length,
        responseHeaders: respHeaders,
        responseBody: responseText,
        responseBodySize: responseText.length,
        status: this.status,
        duration,
        type: 'http',
      });
    });

    return origSend.call(this, body ?? null);
  };
}
