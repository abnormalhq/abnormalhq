/**
 * The developer documentation's endpoint list and downloadable specification, derived from the management API's OpenAPI
 * document. mail owns the document (abnormalhq/mail docs/openapi.json, written from its code); this repository keeps a
 * byte-for-byte copy in docs/openapi.json.
 *
 * Two files are written from that copy by `pnpm api-reference` (scripts/api-reference.ts), and tests/developers-page.test.ts
 * fails while either differs from it:
 * - src/content/developers/reference.ts: the few fields the page shows. The page does not import the document itself, which
 *   is several hundred kilobytes and would be bundled into the Worker.
 * - public/developers/openapi.json: the document for download and API tools, with the production API address as its server.
 *   mail's document is instance-independent (`servers: [{ url: "/api/v1" }]`), and a tool resolving that against this site
 *   would call https://abnormalhq.com/api/v1, which is not the API.
 *
 * Runs in Node as is (the script and the tests use it).
 */

export const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

/**
 * Which key may call an operation:
 * - `scopes`: a key with every scope in `scopes`;
 * - `per-operation`: `POST /batch`, which checks the scope of each item it carries (`scopes` lists them all);
 * - `original-key`: only the key that created the resource (`GET /batch/{requestId}`); `scopes` is empty.
 */
export type KeyRule = "scopes" | "per-operation" | "original-key";

export interface ApiOperation {
  method: HttpMethod;
  /** Relative to the API base, as in the document: /mailboxes/{id}. */
  path: string;
  operationId: string;
  summary: string;
  keyRule: KeyRule;
  scopes: readonly string[];
  deprecated: boolean;
}

export interface ApiGroup {
  /** The OpenAPI tag, in English (the document is English whatever the reader's language). */
  tag: string;
  description: string;
  operations: readonly ApiOperation[];
}

/** One error code of the document's x-error-codes (mail's apps/console/src/lib/api/error-codes.ts). */
export type ApiErrorRetry = "no" | "after_wait" | "after_checking";
export interface ApiErrorEntry {
  code: string;
  statuses: readonly number[];
  /** The registry's area key, such as "domains"; the page names it in the reader's language. */
  area: string;
  meaning: string;
  action: string;
  retry: ApiErrorRetry;
  /** Named by the versioning policy, not answered yet. */
  reserved: boolean;
}

export interface ApiReference {
  /** The document's info.version. */
  version: string;
  groups: readonly ApiGroup[];
  /** Every error code, in the document's order (by area, then code). */
  errors: readonly ApiErrorEntry[];
}

interface OpenApiOperation {
  operationId?: string;
  summary?: string;
  tags?: string[];
  deprecated?: boolean;
  "x-required-scopes"?: string[];
  /** Batch: the scope each kind of item needs. */
  "x-operation-required-scopes"?: Record<string, string>;
  /** "original": only the key that created the resource. */
  "x-required-key"?: string;
}

export interface OpenApiDocument {
  info: { version: string };
  "x-error-codes"?: unknown;
  servers?: { url: string; description?: string }[];
  tags?: { name: string; description?: string }[];
  paths: Record<string, Partial<Record<HttpMethod, OpenApiOperation>> & Record<string, unknown>>;
}

/** Who may call an operation, from the document's extensions. An empty scope list alone is never read as "any key". */
function keyAccess(operation: OpenApiOperation, where: string): { keyRule: KeyRule; scopes: string[] } {
  const scopes = operation["x-required-scopes"] ?? [];
  if (scopes.length > 0) return { keyRule: "scopes", scopes };
  const perItem = operation["x-operation-required-scopes"];
  if (perItem) return { keyRule: "per-operation", scopes: [...new Set(Object.values(perItem))] };
  if (operation["x-required-key"] === "original") return { keyRule: "original-key", scopes: [] };
  throw new Error(
    `${where}: no scope, no per-operation scopes and no x-required-key; the page cannot say who may call it`,
  );
}

/**
 * Groups the operations by their first tag, in the document's tag order, each group in path order as the document lists
 * them. Throws on what the page could not show truthfully: an operation without an id, a summary, a known tag or a rule
 * for which key may call it.
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
        ...keyAccess(operation, where),
        deprecated: operation.deprecated === true,
      });
    }
  }
  return {
    version: document.info.version,
    errors: errorEntries(document["x-error-codes"]),
    groups: tags
      .map((tag) => ({ tag: tag.name, description: tag.description ?? "", operations: groups.get(tag.name)! }))
      .filter((group) => group.operations.length > 0),
  };
}

const RETRIES: readonly ApiErrorRetry[] = ["no", "after_wait", "after_checking"];

/** The document's x-error-codes, checked entry by entry: the page shows exactly these, so a malformed one throws. */
function errorEntries(value: unknown): ApiErrorEntry[] {
  if (!Array.isArray(value) || !value.length) throw new Error("the document has no x-error-codes");
  return value.map((raw, index) => {
    const entry = raw as Partial<ApiErrorEntry>;
    if (
      typeof entry.code !== "string" ||
      !/^[a-z][a-z0-9_]*$/.test(entry.code) ||
      !Array.isArray(entry.statuses) ||
      !entry.statuses.every((status) => Number.isInteger(status) && status >= 400 && status < 600) ||
      typeof entry.area !== "string" ||
      typeof entry.meaning !== "string" ||
      typeof entry.action !== "string" ||
      !RETRIES.includes(entry.retry as ApiErrorRetry) ||
      typeof entry.reserved !== "boolean"
    )
      throw new Error(`x-error-codes[${index}] is malformed`);
    return {
      code: entry.code,
      statuses: entry.statuses,
      area: entry.area,
      meaning: entry.meaning,
      action: entry.action,
      retry: entry.retry as ApiErrorRetry,
      reserved: entry.reserved,
    };
  });
}

/** The document as published on this site: the same contract, with `apiBase` (the production API) as its only server. */
export function publicOpenApiDocument(document: OpenApiDocument, apiBase: string): OpenApiDocument {
  return { ...document, servers: [{ url: apiBase, description: "Abnormal management API" }] };
}

/** How the script writes a JSON file, and how mail writes docs/openapi.json: two-space indent and a final newline. */
export function serializeJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/** Every operation, in page order. */
export function apiOperations(reference: ApiReference): ApiOperation[] {
  return reference.groups.flatMap((group) => group.operations);
}

/** The anchor of a group on the page: from the tag, so links survive operations being added. */
export function groupId(tag: string): string {
  return `api-${tag.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}
