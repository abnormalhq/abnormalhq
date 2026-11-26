import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { langs } from "../src/i18n/index.ts";
import { screens, screenSrc, screenSrcSet, screenThemes, screenWidths } from "../src/lib/screens.ts";

/** Every file the pages use: each language, picture, theme and width. */
const files = langs.flatMap((lang) =>
  screens.flatMap((screen) =>
    screenThemes.flatMap((theme) =>
      screenWidths(screen).map((width) => ({
        lang,
        screen,
        theme,
        width,
        src: screenSrc(lang, screen.key, width, theme),
      })),
    ),
  ),
);

test("every screenshot is in public/ for every language, theme and width", () => {
  // The files ship with the site; a missing one would be a broken picture on the home page.
  assert.equal(files.length, 24);
  for (const { src } of files) assert.ok(existsSync(`public${src}`), `public${src} is missing`);
});

test("public/screens/ holds no picture the page does not use", () => {
  const used = new Set(files.map(({ src }) => src));
  for (const file of readdirSync("public/screens"))
    assert.ok(used.has(`/screens/${file}`), `unused: public/screens/${file}`);
});

test("the WebP files are as wide as their names say", () => {
  // VP8X (extended) WebP stores width-1 and height-1 as 24-bit little-endian at bytes 24 and 27; VP8L and VP8 differ, so all three are read.
  const size = (bytes: Buffer) => {
    const chunk = bytes.toString("ascii", 12, 16);
    if (chunk === "VP8X") return { width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
    if (chunk === "VP8L") {
      const bits = bytes.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
  };
  for (const { src, screen, width } of files) {
    const actual = size(readFileSync(`public${src}`));
    assert.equal(actual.width, width, src);
    assert.ok(
      Math.abs(actual.height - (width * screen.height) / screen.width) <= 1,
      `${src}: the aspect ratio differs from the ${screen.width}×${screen.height} the layout reserves`,
    );
  }
});

test("srcset lists both widths, of the theme asked for", () => {
  assert.equal(screenSrcSet("zh", screens[2]), "/screens/zh-phone-390.webp 390w, /screens/zh-phone-780.webp 780w");
  assert.equal(
    screenSrcSet("en", screens[0], "dark"),
    "/screens/en-inbox-dark-1440.webp 1440w, /screens/en-inbox-dark-2880.webp 2880w",
  );
});

test("a picture with a dark version shows one per theme, both lazy, so only the one on show is fetched", () => {
  const source = readFileSync("src/components/ThemedImage.tsx", "utf8");
  assert.match(source, /"dark:hidden"\)\}\s+loading="lazy"/);
  assert.match(source, /"hidden dark:block"\)\}\s+loading="lazy"/);
  assert.match(
    readFileSync("src/components/Hero.tsx", "utf8"),
    /dark=\{\{ src: screenSrc\(lang, inbox\.key, inbox\.width, "dark"\)/,
  );
});
