/**
 * Short caching of the two pages that render on the Worker on every request (/pricing/ and /download/, both languages): their HTML is the same
 * for every visitor who gets it (prices and the release list, no cookies, no session), so it is kept for a minute in the Worker's cache
 * (caches.default), sparing a render and two upstream reads on every view. Browsers still revalidate every time (max-age=0): HTML from
 * before a deploy names script and style files the new deployment no longer has (see cache.ts), and a browser copy could outlive it.
 *
 * What is not the same for every visitor is whether they get this page or a redirect to the other language: lang.ts decides that from the
 * cookie and Accept-Language before this runs, so the edge copy is only ever served to a request that would have rendered the same page.
 * Responses also carry Vary: Cookie, Accept-Language, so no cache on the way reuses a copy once the language choice changes.
 *
 * The edge copy is keyed by the deployment's version as well: HTML from before a deploy names script and style files the new deployment no
 * longer has (see cache.ts), so it must never outlive the deploy.
 */
import { langs, localePath } from "../i18n/paths.ts";

/** What browsers get: revalidate every time, so a page never outlives the deployment whose script and style files it names. */
export const livePageCacheControl = "public, max-age=0, must-revalidate";

/** What the copy in the Worker's cache is stored with: a minute; the key carries the deployment, so it never outlives one either. */
export const livePageEdgeCacheControl = "public, s-maxage=60";

/** The response as browsers get it, whether rendered or from the edge copy. */
function forBrowser(response: Response): Response {
  const browser = new Response(response.body, response);
  browser.headers.set("Cache-Control", livePageCacheControl);
  return browser;
}

const livePageUrls = new Set(
  langs.flatMap((lang) => ["/pricing/", "/download/"].map((path) => localePath(lang, path))),
);

/** The part of the Workers Cache API used here (caches.default); lib.dom's CacheStorage does not know it. */
export interface EdgeCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

/** Whether this is a whole-page load of a live page: GET, not a client-side navigation or prefetch, which get RSC data rather than HTML. */
export function isLivePageRequest(request: Request): boolean {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  if (!livePageUrls.has(url.pathname) || url.searchParams.has("_rsc")) return false;
  return !["rsc", "next-router-prefetch", "next-router-state-tree", "next-router-segment-prefetch"].some((name) =>
    request.headers.has(name),
  );
}

/** Adds names to a Vary header, keeping what it already lists. */
function withVary(current: string | null, names: string[]): string {
  const listed = (current ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  const lower = new Set(listed.map((name) => name.toLowerCase()));
  return [...listed, ...names.filter((name) => !lower.has(name.toLowerCase()))].join(", ");
}

/** The response with the short public cache rule; null when it must not be stored: not a complete HTML page, or one that sets a cookie. */
export function cacheableLivePage(response: Response): Response | null {
  if (response.status !== 200 || response.headers.has("set-cookie")) return null;
  if (!response.headers.get("content-type")?.startsWith("text/html")) return null;
  const cacheable = new Response(response.body, response);
  cacheable.headers.set("Cache-Control", livePageCacheControl);
  cacheable.headers.set("Vary", withVary(response.headers.get("vary"), ["Cookie", "Accept-Language"]));
  return cacheable;
}

/** The cache key: the address without anything visitor-specific, and the deployment it was rendered by. */
function cacheKey(request: Request, version: string): Request {
  const url = new URL(request.url);
  url.searchParams.set("__deployment", version);
  return new Request(url.toString(), { method: "GET" });
}

/**
 * Serves a live page from the edge cache, or renders it and stores the result. Without a cache or a deployment version (next dev, tests,
 * a Worker without the version_metadata binding) it only renders, still with the browser cache rule.
 */
export async function serveLivePage(
  request: Request,
  render: () => Promise<Response>,
  options: { cache?: EdgeCache; version?: string; waitUntil?: (promise: Promise<unknown>) => void },
): Promise<Response> {
  const { cache, version, waitUntil } = options;
  const key = cache && version ? cacheKey(request, version) : null;
  if (key) {
    const hit = await cache!.match(key).catch(() => undefined);
    if (hit) return forBrowser(hit);
  }
  const rendered = await render();
  const cacheable = cacheableLivePage(rendered);
  if (!cacheable) return rendered;
  if (key) {
    const edgeCopy = cacheable.clone();
    edgeCopy.headers.set("Cache-Control", livePageEdgeCacheControl);
    const stored = cache!.put(key, edgeCopy).catch(() => {});
    if (waitUntil) waitUntil(stored);
    else await stored;
  }
  return cacheable;
}
