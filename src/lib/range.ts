/**
 * Byte ranges for the promo videos. The static asset service ignores a Range header: it answers 200 with the whole file and no
 * Accept-Ranges. Browsers load media in ranges, so the video then fails to play: Safari refuses a server without range support, and
 * Chrome, which stops reading after the metadata (preload="metadata"), fails when it later resumes with a Range request and gets the
 * file from its first byte again. wrangler.jsonc therefore sends /video/* to the Worker first (run_worker_first), and the Worker reads
 * the file from the asset service and cuts the requested range out of it.
 */

/** Paths answered with byte ranges; the same pattern is listed under assets.run_worker_first in wrangler.jsonc. */
export function isRangedAsset(pathname: string): boolean {
  return pathname.startsWith("/video/");
}

export type ByteRange = { start: number; end: number };

/**
 * The single range a Range header asks for in a file of the given size, both ends inclusive.
 * null: no range to serve (another unit, several ranges, malformed), so the whole file is the answer, as RFC 9110 allows.
 * "unsatisfiable": a well-formed range that lies outside the file (416).
 */
export function parseRange(header: string | null, size: number): ByteRange | "unsatisfiable" | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header?.trim() ?? "");
  if (!match || (!match[1] && !match[2])) return null;
  const [, first, last] = match;
  if (!first) {
    // bytes=-N: the last N bytes.
    const length = Number(last);
    if (length === 0 || size === 0) return "unsatisfiable";
    return { start: Math.max(size - length, 0), end: size - 1 };
  }
  const start = Number(first);
  const end = last ? Math.min(Number(last), size - 1) : size - 1;
  if (!Number.isSafeInteger(start) || start >= size) return "unsatisfiable";
  if (end < start) return null;
  return { start, end };
}

/**
 * Answers a request for an asset with the byte range it asks for. fetchAsset reads the file from the asset service.
 * Returns null when the asset does not exist, so the caller can show the site's own 404 page.
 * The file is read whole and then cut: the videos are a few megabytes, far below the Worker's memory limit.
 */
export async function serveByteRanges(
  request: Request,
  fetchAsset: (request: Request) => Promise<Response>,
): Promise<Response | null> {
  // The asset service never sees the Range header: it would ignore it today, and must not start answering 206 to a request this code slices again.
  const headers = new Headers(request.headers);
  const rangeHeader = headers.get("range");
  const ifRange = headers.get("if-range");
  headers.delete("range");
  headers.delete("if-range");
  const asset = await fetchAsset(new Request(request.url, { method: request.method, headers }));
  if (asset.status === 404) return null;
  // Redirects, 304 and errors pass as they are; only a complete file can be cut, and only an unencoded one has the file's own byte offsets.
  if (asset.status !== 200 || asset.headers.has("content-encoding")) return asset;

  const whole = new Response(asset.body, asset);
  whole.headers.set("Accept-Ranges", "bytes");
  if (request.method !== "GET" || !rangeHeader) return whole;
  // If-Range: the range applies only to the version the browser already holds part of; otherwise it gets the new file from the start.
  if (ifRange && ifRange !== asset.headers.get("etag")) return whole;

  const bytes = new Uint8Array(await whole.arrayBuffer());
  const range = parseRange(rangeHeader, bytes.byteLength);
  const partial = new Headers(whole.headers);
  if (range === "unsatisfiable") {
    partial.set("Content-Range", `bytes */${bytes.byteLength}`);
    partial.delete("content-type");
    partial.delete("content-length");
    return new Response(null, { status: 416, headers: partial });
  }
  if (!range) {
    partial.set("Content-Length", String(bytes.byteLength));
    return new Response(bytes, { status: 200, headers: partial });
  }
  partial.set("Content-Range", `bytes ${range.start}-${range.end}/${bytes.byteLength}`);
  partial.set("Content-Length", String(range.end - range.start + 1));
  return new Response(bytes.subarray(range.start, range.end + 1), { status: 206, headers: partial });
}
