import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { absoluteUrl, configuredVideo, promoVideos, site, videoMimeType, type PromoVideo } from "../src/data/site.ts";
import { copies, langs } from "../src/i18n/index.ts";
import { homeMarkdown } from "../src/lib/markdown.ts";
import { homeStructuredData } from "../src/lib/structured-data.ts";

const sample: PromoVideo = {
  src: "https://downloads.abnormalhq.com/video/abnormal-2026.mp4",
  poster: "https://downloads.abnormalhq.com/video/abnormal-2026.jpg",
  uploadDate: "2026-11-08",
};
const none: PromoVideo = { src: "", poster: "", uploadDate: "" };

type Node = Record<string, unknown>;
const nodes = (data: { "@graph": Node[] }) => data["@graph"];
const ofType = (graph: Node[], type: string) =>
  graph.find((node) => [node["@type"]].flat().includes(type)) as Node | undefined;

test("a language's video is configured only once it has an address", () => {
  assert.equal(configuredVideo("en", { en: none, zh: sample }), null);
  assert.equal(configuredVideo("en", { en: { ...sample, src: "  " }, zh: sample }), null);
  assert.equal(configuredVideo("zh", { en: none, zh: sample }), sample);
});

test("each configured video names its poster and upload date, and its files are in public/", () => {
  // The structured data needs poster and date; the files ship with the site, so a missing one would 404 in production.
  for (const lang of langs) {
    const video = configuredVideo(lang, promoVideos);
    if (!video) continue;
    assert.ok(video.poster, `${lang}: poster`);
    assert.match(video.uploadDate, /^\d{4}-\d{2}-\d{2}$/, `${lang}: uploadDate`);
    for (const path of [video.src, video.poster]) {
      if (path.startsWith("/")) assert.ok(existsSync(`public${path}`), `${lang}: public${path} is missing`);
    }
  }
});

test("site paths become absolute for Markdown and structured data; full addresses stay as they are", () => {
  assert.equal(absoluteUrl("/video/abnormal-en.mp4"), `${site.url}/video/abnormal-en.mp4`);
  assert.equal(absoluteUrl(sample.src), sample.src);
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
    // null, not undefined: undefined would fall back to the configured promoVideos and fail once one is published.
    const without = homeMarkdown(lang, null);
    assert.ok(!without.includes(t.video.title));
    assert.equal(ofType(nodes(homeStructuredData(lang, null)), "VideoObject"), undefined);

    const local: PromoVideo = { ...sample, src: "/video/a.mp4", poster: "/video/a.jpg" };
    const markdown = homeMarkdown(lang, local);
    assert.ok(markdown.includes(`## ${t.video.title}`));
    assert.ok(markdown.includes(`[${t.video.label}](${site.url}/video/a.mp4)`));
    assert.ok(markdown.indexOf(t.video.title) < markdown.indexOf(t.start.title), "the video comes before Start");

    const graph = nodes(homeStructuredData(lang, local));
    const video = ofType(graph, "VideoObject")!;
    assert.equal(video.name, t.video.title);
    assert.equal(video.description, t.video.description);
    assert.equal(video.contentUrl, `${site.url}/video/a.mp4`);
    assert.equal(video.thumbnailUrl, `${site.url}/video/a.jpg`);
    assert.equal(video.uploadDate, sample.uploadDate);
    assert.equal(video.inLanguage, t.htmlLang);
    const page = ofType(graph, "WebPage")!;
    assert.deepEqual(page.video, { "@id": video["@id"] });
    assert.ok((video["@id"] as string).startsWith(page.url as string));
  });
}
