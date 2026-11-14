/**
 * Byte ranges for the promo videos. The static asset service ignores a Range header: it answers 200 with the whole file and no
 * Accept-Ranges. Browsers load media in ranges, so the video then fails to play: Safari refuses a server without range support, and
 * Chrome, which stops reading after the metadata (preload="metadata"), fails when it later resumes with a Range request and gets the
 * file from its first byte again. wrangler.jsonc therefore sends /video/*.mp4 to the Worker first (run_worker_first), and the Worker reads
 * the file from the asset service and cuts the requested range out of it.
 */

/**
 * Paths answered with byte ranges; the same pattern (/video/*.mp4) is listed under assets.run_worker_first in wrangler.jsonc. The posters
 * next to the videos are ordinary images that the asset service answers itself.
 */
export function isRangedAsset(pathname: string): boolean {
  return pathname.startsWith("/video/") && pathname.endsWith(".mp4");
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
 * Browser cache of the promo videos. Their names are fixed (a new film keeps its address), so a day, then refreshed in the background;
 * the same rule as /video/* in public/_headers, which covers the posters the asset service answers itself.
 */
export const videoCacheControl = "public, max-age=86400, stale-while-revalidate=604800";

/** The FixedLengthStream of the Workers runtime: a body of known length is sent with Content-Length rather than chunked. Absent under Node. */
type FixedLengthStreamConstructor = new (length: number) => TransformStream<Uint8Array, Uint8Array>;

/**
 * The bytes start..start+length-1 of a stream, read as they arrive: the bytes before start are dropped, and once length bytes have passed
 * the rest of the source is cancelled, so neither the whole file nor anything after the range is ever held or read.
 */
export function sliceStream(
  source: ReadableStream<Uint8Array>,
  start: number,
  length: number,
): ReadableStream<Uint8Array> {
  const reader = source.getReader();
  let skip = start;
  let remaining = length;
  const sliced = new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (remaining > 0) {
        const { done, value } = await reader.read();
        if (done) {
          controller.error(new Error(`The asset ended ${remaining} bytes before the range did`));
          return;
        }
        let chunk = value;
        if (skip >= chunk.byteLength) {
          skip -= chunk.byteLength;
          continue;
        }
        chunk = chunk.subarray(skip, skip + remaining);
        skip = 0;
        remaining -= chunk.byteLength;
        controller.enqueue(chunk);
        if (remaining > 0) return;
      }
      controller.close();
      // The rest of the file is not needed: stop reading it.
      await reader.cancel().catch(() => {});
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
  const FixedLength = (globalThis as { FixedLengthStream?: FixedLengthStreamConstructor }).FixedLengthStream;
  return FixedLength ? sliced.pipeThrough(new FixedLength(length)) : sliced;
}

/** The file's size from the asset's Content-Length; null when it is missing or not a byte count. */
function declaredSize(response: Response): number | null {
  const header = response.headers.get("content-length");
  if (header === null || !/^\d+$/.test(header.trim())) return null;
  const size = Number(header);
  return Number.isSafeInteger(size) ? size : null;
}

/**
 * Answers a request for an asset with the byte range it asks for. fetchAsset reads the file from the asset service.
 * Returns null when the asset does not exist, so the caller can show the site's own 404 page.
 * The range is streamed out of the asset's body: the bytes before it are skipped as they arrive and the read stops at its end, so a
 * request for the last megabyte of a video neither buffers the whole file nor waits for it. Only an asset without a Content-Length
 * (never the case for the asset service today) is read whole to learn its size, then cut.
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
  // Redirects and errors pass as they are; only a complete file can be cut, and only an unencoded one has the file's own byte offsets.
  if (asset.status === 304) return withVideoCaching(new Response(null, asset));
  if (asset.status !== 200 || asset.headers.has("content-encoding")) return asset;

  const whole = withVideoCaching(new Response(asset.body, asset));
  whole.headers.set("Accept-Ranges", "bytes");
  if (request.method !== "GET" || !rangeHeader) return whole;
  // If-Range: the range applies only to the version the browser already holds part of; otherwise it gets the new file from the start.
  if (ifRange && ifRange !== asset.headers.get("etag")) return whole;

  const known = declaredSize(asset);
  // No declared size: the file has to be read whole to know where its end is.
  const bytes = known === null ? new Uint8Array(await whole.arrayBuffer()) : null;
  const size = known ?? bytes!.byteLength;
  const body = whole.body;
  const range = parseRange(rangeHeader, size);
  const partial = new Headers(whole.headers);
  if (range === "unsatisfiable") {
    await body?.cancel().catch(() => {});
    partial.set("Content-Range", `bytes */${size}`);
    partial.delete("content-type");
    partial.delete("content-length");
    return new Response(null, { status: 416, headers: partial });
  }
  if (!range) {
    partial.set("Content-Length", String(size));
    return new Response(bytes ?? body, { status: 200, headers: partial });
  }
  const length = range.end - range.start + 1;
  partial.set("Content-Range", `bytes ${range.start}-${range.end}/${size}`);
  partial.set("Content-Length", String(length));
  const slice = bytes ? bytes.subarray(range.start, range.end + 1) : sliceStream(body!, range.start, length);
  return new Response(slice, { status: 206, headers: partial });
}

/** Sets the videos' own browser cache rule over the asset service's max-age=0 (a 304 refreshes the stored copy's headers too). */
function withVideoCaching(response: Response): Response {
  response.headers.set("Cache-Control", videoCacheControl);
  return response;
}
