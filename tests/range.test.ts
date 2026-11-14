import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { configuredVideo } from "../src/data/site.ts";
import { langs } from "../src/i18n/index.ts";
import { isRangedAsset, parseRange, serveByteRanges, sliceStream, videoCacheControl } from "../src/lib/range.ts";

const file = Uint8Array.from({ length: 1000 }, (_, index) => index % 251);
const etag = '"c6a834a2"';

/** A body that arrives in chunks of the given size, recording how far it was read and whether it was cancelled. */
function chunked(bytes: Uint8Array, size: number) {
  const state = { read: 0, cancelled: false };
  const body = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (state.read >= bytes.byteLength) return controller.close();
        controller.enqueue(bytes.slice(state.read, state.read + size));
        state.read += size;
      },
      cancel() {
        state.cancelled = true;
      },
      // Pulled only when read, so `read` counts what the reader asked for, not the stream's own read-ahead.
    },
    { highWaterMark: 0 },
  );
  return { body, state };
}

/**
 * The static asset service: the whole file whatever the request says, with its Content-Length, 304 to a matching If-None-Match,
 * 404 for other paths. The body arrives in 64-byte chunks, as a stream does.
 */
function assets(seen: Request[] = [], reads: { read: number; cancelled: boolean }[] = []) {
  return async (request: Request) => {
    seen.push(request);
    if (new URL(request.url).pathname !== "/video/abnormal-en.mp4") return new Response("Not found", { status: 404 });
    const headers = { "Content-Type": "video/mp4", ETag: etag, "Cache-Control": "public, max-age=0, must-revalidate" };
    if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
    if (request.method === "HEAD") return new Response(null, { headers });
    const { body, state } = chunked(file, 64);
    reads.push(state);
    return new Response(body, { headers: { ...headers, "Content-Length": String(file.byteLength) } });
  };
}

const get = (headers: Record<string, string> = {}, init: RequestInit = {}, path = "/video/abnormal-en.mp4") =>
  new Request(`https://abnormalhq.com${path}`, { ...init, headers });

test("a Range header names one range of the file, clamped to its end", () => {
  assert.deepEqual(parseRange("bytes=0-", 1000), { start: 0, end: 999 });
  assert.deepEqual(parseRange("bytes=100-199", 1000), { start: 100, end: 199 });
  assert.deepEqual(parseRange("bytes=900-5000", 1000), { start: 900, end: 999 });
  assert.deepEqual(parseRange("bytes=-100", 1000), { start: 900, end: 999 });
  assert.deepEqual(parseRange("bytes=-5000", 1000), { start: 0, end: 999 });
  assert.deepEqual(parseRange(" bytes=0-0 ", 1000), { start: 0, end: 0 });
});

test("a range outside the file is unsatisfiable; anything else that is not one byte range means the whole file", () => {
  for (const header of ["bytes=1000-", "bytes=5000-6000", "bytes=-0"]) {
    assert.equal(parseRange(header, 1000), "unsatisfiable", header);
  }
  for (const header of [null, "", "bytes=-", "bytes=200-100", "bytes=0-1,5-6", "items=0-1", "bytes=a-b"]) {
    assert.equal(parseRange(header, 1000), null, String(header));
  }
});

test("a range request gets 206 with exactly those bytes, and the asset service never sees the Range header", async () => {
  const seen: Request[] = [];
  const response = await serveByteRanges(get({ Range: "bytes=100-199" }), assets(seen));
  assert.ok(response);
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("content-range"), "bytes 100-199/1000");
  assert.equal(response.headers.get("content-length"), "100");
  assert.equal(response.headers.get("accept-ranges"), "bytes");
  assert.equal(response.headers.get("content-type"), "video/mp4");
  assert.equal(response.headers.get("etag"), etag);
  // The asset service's max-age=0 gives way to the videos' own rule.
  assert.equal(response.headers.get("cache-control"), videoCacheControl);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), file.subarray(100, 200));
  assert.equal(seen[0].headers.has("range"), false);

  // What a browser sends first, and what it sends to resume after reading the metadata.
  const first = await serveByteRanges(get({ Range: "bytes=0-" }), assets());
  assert.equal(first?.status, 206);
  assert.equal(first?.headers.get("content-range"), "bytes 0-999/1000");
  const resumed = await serveByteRanges(get({ Range: "bytes=600-", "If-Range": etag }), assets());
  assert.equal(resumed?.status, 206);
  assert.deepEqual(new Uint8Array(await resumed!.arrayBuffer()), file.subarray(600));
});

test("without a usable range the whole file is served, announcing range support", async () => {
  const requests: Record<string, string>[] = [
    {},
    { Range: "bytes=0-1,5-6" },
    { Range: "bytes=600-", "If-Range": '"older"' },
  ];
  for (const headers of requests) {
    const response = await serveByteRanges(get(headers), assets());
    assert.equal(response?.status, 200, JSON.stringify(headers));
    assert.equal(response?.headers.get("accept-ranges"), "bytes");
    assert.equal(response?.headers.has("content-range"), false);
    assert.equal((await response!.arrayBuffer()).byteLength, 1000);
  }
  const head = await serveByteRanges(get({ Range: "bytes=0-9" }, { method: "HEAD" }), assets());
  assert.equal(head?.status, 200);
  assert.equal(head?.headers.get("accept-ranges"), "bytes");
});

test("a range past the end is 416 with the file's size; 304 passes through; a missing file is left to the caller", async () => {
  const beyond = await serveByteRanges(get({ Range: "bytes=1000-" }), assets());
  assert.equal(beyond?.status, 416);
  assert.equal(beyond?.headers.get("content-range"), "bytes */1000");

  const unchanged = await serveByteRanges(get({ Range: "bytes=0-", "If-None-Match": etag }), assets());
  assert.equal(unchanged?.status, 304);
  assert.equal(unchanged?.headers.get("cache-control"), videoCacheControl);

  assert.equal(await serveByteRanges(get({ Range: "bytes=0-" }, {}, "/video/missing.mp4"), assets()), null);
});

test("an encoded asset is not cut: its bytes are not the file's", async () => {
  const gzip = async () => new Response("compressed", { headers: { "Content-Encoding": "gzip" } });
  const response = await serveByteRanges(get({ Range: "bytes=0-3" }), gzip);
  assert.equal(response?.status, 200);
  assert.equal(await response?.text(), "compressed");
});

test("the Worker answers the promo videos before the asset service does", () => {
  for (const lang of langs) {
    const video = configuredVideo(lang);
    if (video?.src.startsWith("/")) assert.ok(isRangedAsset(video.src), `${lang}: ${video.src}`);
  }
  assert.equal(isRangedAsset("/fonts/inter.woff2"), false);
  assert.equal(isRangedAsset("/"), false);
  // The posters are plain images: the asset service answers them without running the Worker.
  for (const lang of langs) {
    const poster = configuredVideo(lang)?.poster;
    if (poster?.startsWith("/")) assert.equal(isRangedAsset(poster), false, `${lang}: ${poster}`);
  }
  // Without run_worker_first the asset service answers the videos itself and the Worker's ranges never run.
  const wrangler = readFileSync("wrangler.jsonc", "utf8");
  assert.match(wrangler, /"run_worker_first": \["\/video\/\*\.mp4"\]/);
  const worker = readFileSync("worker.ts", "utf8");
  assert.match(worker, /isRangedAsset\(pathname\)/);
  assert.match(worker, /env\.ASSETS\.fetch/);
});

test("a range is streamed out of the asset: the bytes before it are skipped, and the read stops at its end", async () => {
  const reads: { read: number; cancelled: boolean }[] = [];
  const response = await serveByteRanges(get({ Range: "bytes=100-299" }), assets([], reads));
  assert.equal(response?.status, 206);
  assert.equal(response?.headers.get("content-range"), "bytes 100-299/1000");
  assert.equal(response?.headers.get("content-length"), "200");
  assert.deepEqual(new Uint8Array(await response!.arrayBuffer()), file.subarray(100, 300));
  // 64-byte chunks: the range ends in the fifth (bytes 256-319), and nothing after it is read.
  assert.equal(reads[0]!.read, 320);
  assert.equal(reads[0]!.cancelled, true);

  // A range past the end is refused from the declared size alone, without reading the file.
  const beyond = await serveByteRanges(get({ Range: "bytes=5000-" }), assets([], reads));
  assert.equal(beyond?.status, 416);
  assert.equal(reads[1]!.read, 0);
});

test("an asset without a Content-Length is read whole to find its size, then cut", async () => {
  const unsized = async () =>
    new Response(chunked(file, 100).body, { headers: { "Content-Type": "video/mp4", ETag: etag } });
  const response = await serveByteRanges(get({ Range: "bytes=-10" }), unsized);
  assert.equal(response?.status, 206);
  assert.equal(response?.headers.get("content-range"), "bytes 990-999/1000");
  assert.deepEqual(new Uint8Array(await response!.arrayBuffer()), file.subarray(990));
  const beyond = await serveByteRanges(get({ Range: "bytes=1000-" }), unsized);
  assert.equal(beyond?.headers.get("content-range"), "bytes */1000");
});

test("a stream slice spans chunk boundaries and fails when the source ends early", async () => {
  for (const [start, length, size] of [
    [0, 1000, 64],
    [63, 2, 64],
    [64, 64, 64],
    [999, 1, 7],
    [0, 1, 1000],
  ] as const) {
    const sliced = sliceStream(chunked(file, size).body, start, length);
    const bytes = new Uint8Array(await new Response(sliced).arrayBuffer());
    assert.deepEqual(bytes, file.subarray(start, start + length), `${start}+${length} in chunks of ${size}`);
  }
  await assert.rejects(new Response(sliceStream(chunked(file, 64).body, 900, 200)).arrayBuffer());
});
