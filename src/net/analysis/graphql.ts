import type { RequestEntry, GraphQLInfo } from '../types';

/**
 * Detect and extract GraphQL operation info from a request.
 *
 * A request is considered GraphQL when it is a POST whose JSON body
 * contains a string `query` field. The operation type is inferred from
 * the leading keyword of the query string.
 *
 * @returns A `GraphQLInfo` object, or `null` if the request is not GraphQL.
 */
export function detectGraphQL(r: RequestEntry): GraphQLInfo | null {
  if (r.method !== 'POST' || !r.requestBody) return null;

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(r.requestBody) as Record<string, unknown>;
  } catch {
    return null;
  }

  if (typeof body['query'] !== 'string') return null;

  const queryStr = body['query'];
  const trimmed = queryStr.trim();

  let operationType: GraphQLInfo['operationType'] = 'unknown';
  if (trimmed.startsWith('query')) operationType = 'query';
  else if (trimmed.startsWith('mutation')) operationType = 'mutation';
  else if (trimmed.startsWith('subscription')) operationType = 'subscription';
  else if (trimmed.startsWith('{') || trimmed.startsWith('fragment')) operationType = 'query';

  const nameMatch = trimmed.match(/^(?:query|mutation|subscription)\s+(\w+)/);
  const operationName = nameMatch?.[1];

  const rawVariables = body['variables'];
  const variables =
    typeof rawVariables === 'object' && rawVariables !== null && !Array.isArray(rawVariables)
      ? (rawVariables as Record<string, unknown>)
      : undefined;

  const result: GraphQLInfo = { operationType, query: queryStr };
  if (operationName !== undefined) result.operationName = operationName;
  if (variables !== undefined) result.variables = variables;
  return result;
}
