export const RP_NAMESPACE = 'react-picker';

export type InspectRequest = {
  source: typeof RP_NAMESPACE;
  kind: 'inspect-request';
  requestId: string;
  selector: string;
};

export type InspectByIdRequest = {
  source: typeof RP_NAMESPACE;
  kind: 'inspect-by-id-request';
  requestId: string;
  fiberId: string;
};

export type InspectResponse = {
  source: typeof RP_NAMESPACE;
  kind: 'inspect-response';
  requestId: string;
  ok: boolean;
  data?: ComponentInfo;
  error?: string;
};

export type HoverRequest = {
  source: typeof RP_NAMESPACE;
  kind: 'hover-request';
  requestId: string;
  selector: string;
};

export type HoverResponse = {
  source: typeof RP_NAMESPACE;
  kind: 'hover-response';
  requestId: string;
  ok: boolean;
  preview?: ComponentPreview;
  error?: string;
};

export type SubscribeRendersRequest = {
  source: typeof RP_NAMESPACE;
  kind: 'subscribe-renders';
  fiberId: string;
};

export type UnsubscribeRendersRequest = {
  source: typeof RP_NAMESPACE;
  kind: 'unsubscribe-renders';
  fiberId: string;
};

export type RenderTickEvent = {
  source: typeof RP_NAMESPACE;
  kind: 'render-tick';
  fiberId: string;
  count: number;
  lastRenderAt: number;
};

export type FindInstancesRequest = {
  source: typeof RP_NAMESPACE;
  kind: 'find-instances-request';
  requestId: string;
  fiberId: string;
};

export type FindInstancesResponse = {
  source: typeof RP_NAMESPACE;
  kind: 'find-instances-response';
  requestId: string;
  ok: boolean;
  rects: Rect[];
  error?: string;
};

export type FindFiberRectRequest = {
  source: typeof RP_NAMESPACE;
  kind: 'find-fiber-rect-request';
  requestId: string;
  fiberId: string;
};

export type FindFiberRectResponse = {
  source: typeof RP_NAMESPACE;
  kind: 'find-fiber-rect-response';
  requestId: string;
  ok: boolean;
  rect: Rect | null;
  error?: string;
};

export type ReactDetected = {
  source: typeof RP_NAMESPACE;
  kind: 'react-detected';
  detected: boolean;
  version?: string;
};

export type BridgeMessage =
  | InspectRequest
  | InspectByIdRequest
  | InspectResponse
  | HoverRequest
  | HoverResponse
  | SubscribeRendersRequest
  | UnsubscribeRendersRequest
  | RenderTickEvent
  | FindInstancesRequest
  | FindInstancesResponse
  | FindFiberRectRequest
  | FindFiberRectResponse
  | ReactDetected;

export type ComponentPreview = {
  name: string;
  kind: ComponentKind;
  rect: Rect;
  domTag: string;
  source: SourceLocation | null;
  propNames: string[];
  parentName: string | null;
  childrenNames: string[];
  ownerNames: string[];
  elementId: string;
  className: string;
};

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ComponentRef = {
  fiberId: string;
  name: string;
  kind: ComponentKind;
  source: SourceLocation | null;
};

export type ComponentInfo = {
  fiberId: string;
  name: string;
  kind: ComponentKind;
  source: SourceLocation | null;
  props: Record<string, SerializedValue>;
  ownerChain: OwnerInfo[];
  parent: ComponentRef | null;
  children: ComponentRef[];
  domTag: string;
  rect: Rect;
};

export type ComponentKind =
  | 'function'        // React / Preact function component, generic functional
  | 'class'           // React / Preact class component
  | 'forwardRef'      // React.forwardRef
  | 'memo'            // React.memo / SimpleMemo
  | 'lazy'            // React.lazy
  | 'composition'     // Vue 3 setup() / <script setup>
  | 'options'         // Vue 2 / Vue 3 Options API
  | 'lit'             // Lit element
  | 'web-component'   // generic Custom Element
  | 'host'            // bare DOM element (Plain DOM adapter)
  | 'unknown';

export type SourceLocation = {
  fileName: string;
  lineNumber?: number;
  columnNumber?: number;
};

export type OwnerInfo = {
  name: string;
  kind: ComponentKind;
  source: SourceLocation | null;
};

export type SerializedValue =
  | { type: 'primitive'; value: string | number | boolean | null }
  | { type: 'undefined' }
  | { type: 'function'; name: string; inline?: boolean }
  | { type: 'symbol'; description: string }
  | { type: 'array'; length: number; preview: string }
  | { type: 'object'; keys: string[]; preview: string }
  | { type: 'react-element'; name: string }
  | { type: 'circular' }
  | { type: 'error'; message: string };

export type EditorId = 'vscode' | 'cursor' | 'webstorm' | 'sublime' | 'none';

export type Settings = {
  enabled: boolean;
  autoOnLocalhost: boolean;
  editor: EditorId;
};

export const DEFAULT_SETTINGS: Settings = {
  enabled: false,
  autoOnLocalhost: true,
  editor: 'vscode',
};

export const SETTINGS_KEY = 'rp-settings';

export type RuntimeMessage = { kind: 'open-editor'; url: string };

export type NetRequestData = {
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
};

export type NetRequestMessage = {
  source: 'peekly-net';
  kind: 'net-request';
  data: NetRequestData;
};
