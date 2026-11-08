import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { configuredVideo, promoVideo, videoMimeType, type PromoVideo } from "../src/data/site.ts";
import { copies } from "../src/i18n/index.ts";
import { homeMarkdown } from "../src/lib/markdown.ts";
import { homeStructuredData } from "../src/lib/structured-data.ts";

const sample: PromoVideo = {
  src: "https://downloads.abnormalhq.com/video/abnormal-2026.mp4",
  poster: "https://downloads.abnormalhq.com/video/abnormal-2026.jpg",
  uploadDate: "2026-11-08",
  captions: { zh: "https://downloads.abnormalhq.com/video/abnormal-2026.zh.vtt", en: "" },
};

type Node = Record<string, unknown>;
const nodes = (data: { "@graph": Node[] }) => data["@graph"];
const ofType = (graph: Node[], type: string) =>
  graph.find((node) => [node["@type"]].flat().includes(type)) as Node | undefined;

test("the video is configured only once it has an address", () => {
  assert.equal(configuredVideo({ ...sample, src: "" }), undefined);
  assert.equal(configuredVideo({ ...sample, src: "  " }), undefined);
  assert.equal(configuredVideo(sample), sample);
});

test("a configured video names its poster and upload date", () => {
  // The structured data needs both; filling in only the address would publish an incomplete VideoObject.
  const video = configuredVideo(promoVideo);
  if (video) {
    assert.ok(video.poster, "promoVideo.poster");
    assert.match(video.uploadDate, /^\d{4}-\d{2}-\d{2}$/, "promoVideo.uploadDate");
  }
});

test("the <source> type follows the file's extension", () => {
  assert.equal(videoMimeType(sample.src), "video/mp4");
  assert.equal(videoMimeType("https://example.com/a.WEBM?v=2"), "video/webm");
  assert.equal(videoMimeType("https://example.com/stream"), undefined);
});

test("the section renders nothing without a video, and never autoplays", () => {
  const source = readFileSync("src/components/PromoVideo.tsx", "utf8");
  assert.match(source, /if \(!video\) return null;/);
  assert.doesNotMatch(source, /autoPlay/);
  assert.match(source, /<video[\s\S]*?\bcontrols\b/);
});

for (const lang of ["zh", "en"] as const) {
  test(`${lang} home Markdown and structured data carry the video only when it is configured`, () => {
    const t = copies[lang];
    const without = homeMarkdown(lang, undefined);
    assert.ok(!without.includes(t.video.title));
    assert.equal(ofType(nodes(homeStructuredData(lang, undefined)), "VideoObject"), undefined);

    const markdown = homeMarkdown(lang, sample);
    assert.ok(markdown.includes(`## ${t.video.title}`));
    assert.ok(markdown.includes(`[${t.video.label}](${sample.src})`));
    assert.ok(markdown.indexOf(t.video.title) < markdown.indexOf(t.start.title), "the video comes before Start");

    const graph = nodes(homeStructuredData(lang, sample));
    const video = ofType(graph, "VideoObject")!;
    assert.equal(video.name, t.video.title);
    assert.equal(video.description, t.video.description);
    assert.equal(video.contentUrl, sample.src);
    assert.equal(video.thumbnailUrl, sample.poster);
    assert.equal(video.uploadDate, sample.uploadDate);
    assert.equal(video.inLanguage, t.htmlLang);
    const page = ofType(graph, "WebPage")!;
    assert.deepEqual(page.video, { "@id": video["@id"] });
    assert.ok((video["@id"] as string).startsWith(page.url as string));
  });
}
