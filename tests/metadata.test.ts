import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { en } from "../src/i18n/en.ts";
import { zh } from "../src/i18n/zh.ts";
import { pageMetadata } from "../src/lib/metadata.ts";

test("a page with its own title and description shares them, not the homepage's", () => {
  const metadata = pageMetadata({
    lang: "zh",
    path: "/privacy/",
    title: "Privacy Policy — Abnormal",
    description: "How we handle your information.",
  });
  assert.equal(metadata.title, "Privacy Policy — Abnormal");
  assert.deepEqual(
    { title: metadata.openGraph?.title, description: metadata.openGraph?.description, url: metadata.openGraph?.url },
    { title: "Privacy Policy — Abnormal", description: "How we handle your information.", url: "/zh/privacy/" },
  );
});

test("the homepage shares the social copy of its language", () => {
  const metadata = pageMetadata({ lang: "zh", path: "/" });
  assert.equal(metadata.title, zh.meta.title);
  assert.equal(metadata.openGraph?.title, zh.meta.socialTitle);
  assert.equal(metadata.openGraph?.description, zh.meta.socialDescription);
  assert.equal(pageMetadata({ lang: "en", path: "/" }).openGraph?.title, en.meta.socialTitle);
  assert.deepEqual(metadata.alternates?.languages, { en: "/", "zh-CN": "/zh/", "x-default": "/" });
  assert.equal(metadata.alternates?.canonical, "/zh/");
});

test("the homepage introduces both family products instead of only mailbox offers", () => {
  for (const copy of [en, zh]) {
    const introduction = [
      copy.meta.title,
      copy.meta.description,
      copy.meta.socialTitle,
      copy.meta.socialDescription,
      copy.hero.eyebrow,
      ...copy.hero.titleLines,
      ...copy.hero.description,
      ...copy.products.items.flatMap(({ name, description }) => [name, description]),
    ].join(" ");
    assert.match(introduction, /Mail/);
    assert.match(introduction, /Doppel/);
    assert.match(copy.meta.description, /Mail/);
    assert.match(copy.meta.description, /Doppel/);
  }
});

test("every page shares a large card with its language's image, alt text and site name", () => {
  for (const lang of ["zh", "en"] as const) {
    const metadata = pageMetadata({ lang, path: "/terms/", title: "T", description: "D" });
    const t = { zh, en }[lang];
    const image = { url: `/og/${lang}.png`, width: 1200, height: 630, type: "image/png", alt: t.meta.socialImageAlt };
    assert.deepEqual(metadata.openGraph?.images, [image]);
    assert.equal((metadata.openGraph as { siteName?: string }).siteName, "Abnormal");
    assert.deepEqual(metadata.twitter, { card: "summary_large_image", title: "T", description: "D", images: [image] });
    assert.ok(existsSync(new URL(`../public${image.url}`, import.meta.url)), `public${image.url} is missing`);
  }
});

test("the other language is listed as an alternate locale", () => {
  const ogLocales = (lang: "zh" | "en") =>
    (pageMetadata({ lang, path: "/" }).openGraph as { alternateLocale?: string[] }).alternateLocale;
  assert.deepEqual(ogLocales("zh"), [en.ogLocale]);
  assert.deepEqual(ogLocales("en"), [zh.ogLocale]);
});
