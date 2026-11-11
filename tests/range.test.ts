import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { configuredVideo } from "../src/data/site.ts";
import { langs } from "../src/i18n/index.ts";
import { isRangedAsset, parseRange, serveByteRanges } from "../src/lib/range.ts";

const file = Uint8Array.from({ length: 1000 }, (_, index) => index % 251);
const etag = '"c6a834a2"';

/** The static asset service: the whole file whatever the request says, 304 to a matching If-None-Match, 404 for other paths. */
function assets(seen: Request[] = []) {
  return async (request: Request) => {
    seen.push(request);
    if (new URL(request.url).pathname !== "/video/abnormal-en.mp4") return new Response("Not found", { status: 404 });
    const headers = { "Content-Type": "video/mp4", ETag: etag, "Cache-Control": "public, max-age=0, must-revalidate" };
    if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
    return new Response(request.method === "HEAD" ? null : file, { headers });
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
  assert.equal(response.headers.get("cache-control"), "public, max-age=0, must-revalidate");
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
  // Without run_worker_first the asset service answers /video/* itself and the Worker's ranges never run.
  const wrangler = readFileSync("wrangler.jsonc", "utf8");
  assert.match(wrangler, /"run_worker_first": \["\/video\/\*"\]/);
  const worker = readFileSync("worker.ts", "utf8");
  assert.match(worker, /isRangedAsset\(pathname\)/);
  assert.match(worker, /env\.ASSETS\.fetch/);
});
