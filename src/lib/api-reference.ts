/**
 * The developer documentation's endpoint list, derived from the management API's OpenAPI document. mail owns the document
 * (abnormalhq/mail docs/openapi.json, written from its code); this repository keeps a byte-for-byte copy in
 * public/developers/openapi.json, served as a static file for download and for tools that read OpenAPI.
 *
 * The page does not import that file: it is several hundred kilobytes and would be bundled into the Worker. The few fields the
 * page shows are kept in src/content/developers/reference.ts instead, written by `pnpm api-reference` from the copy, and
 * tests/developers-page.test.ts fails while the two disagree. Runs in Node as is (the script and the tests use it).
 */

export const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export interface ApiOperation {
  method: HttpMethod;
  /** Relative to the API base, as in the document: /mailboxes/{id}. */
  path: string;
  operationId: string;
  summary: string;
  /** Scopes the key needs; empty when any valid key will do. */
  scopes: readonly string[];
  deprecated: boolean;
}

export interface ApiGroup {
  /** The OpenAPI tag, in English (the document is English whatever the reader's language). */
  tag: string;
  description: string;
  operations: readonly ApiOperation[];
}

export interface ApiReference {
  /** The document's info.version. */
  version: string;
  groups: readonly ApiGroup[];
}

interface OpenApiOperation {
  operationId?: string;
  summary?: string;
  tags?: string[];
  deprecated?: boolean;
  "x-required-scopes"?: string[];
}

interface OpenApiDocument {
  info: { version: string };
  tags?: { name: string; description?: string }[];
  paths: Record<string, Partial<Record<HttpMethod, OpenApiOperation>> & Record<string, unknown>>;
}

/**
 * Groups the operations by their first tag, in the document's tag order, each group in path order as the document lists
 * them. Throws on what the page could not show truthfully: an operation without an id, a summary or a known tag.
 */
export function buildApiReference(document: OpenApiDocument): ApiReference {
  const tags = document.tags ?? [];
  const groups = new Map<string, ApiOperation[]>(tags.map((tag) => [tag.name, []]));
  for (const [path, item] of Object.entries(document.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = item[method];
      if (!operation) continue;
      const where = `${method.toUpperCase()} ${path}`;
      const tag = operation.tags?.[0];
      if (!operation.operationId || !operation.summary) throw new Error(`${where}: no operationId or summary`);
      if (!tag || !groups.has(tag)) throw new Error(`${where}: tag ${tag ?? "(none)"} is not in the document's tags`);
      groups.get(tag)!.push({
        method,
        path,
        operationId: operation.operationId,
        summary: operation.summary,
        scopes: operation["x-required-scopes"] ?? [],
        deprecated: operation.deprecated === true,
      });
    }
  }
  return {
    version: document.info.version,
    groups: tags
      .map((tag) => ({ tag: tag.name, description: tag.description ?? "", operations: groups.get(tag.name)! }))
      .filter((group) => group.operations.length > 0),
  };
}

/** Every operation, in page order. */
export function apiOperations(reference: ApiReference): ApiOperation[] {
  return reference.groups.flatMap((group) => group.operations);
}

/** The anchor of a group on the page: from the tag, so links survive operations being added. */
export function groupId(tag: string): string {
  return `api-${tag.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}
