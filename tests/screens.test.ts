import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { langs } from "../src/i18n/index.ts";
import { screens, screenSrc, screenSrcSet, screenWidths } from "../src/lib/screens.ts";

test("every screenshot is in public/ for every language and width", () => {
  // The files ship with the site; a missing one would be a broken picture on the home page.
  for (const lang of langs)
    for (const screen of screens)
      for (const width of screenWidths(screen)) {
        const path = `public${screenSrc(lang, screen.key, width)}`;
        assert.ok(existsSync(path), `${path} is missing`);
      }
});

test("public/screens/ holds no picture the page does not use", () => {
  const used = new Set(
    langs.flatMap((lang) =>
      screens.flatMap((screen) => screenWidths(screen).map((width) => screenSrc(lang, screen.key, width))),
    ),
  );
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
  for (const lang of langs)
    for (const screen of screens)
      for (const width of screenWidths(screen)) {
        const actual = size(readFileSync(`public${screenSrc(lang, screen.key, width)}`));
        assert.equal(actual.width, width, `${lang}-${screen.key}-${width}`);
        assert.ok(
          Math.abs(actual.height - (width * screen.height) / screen.width) <= 1,
          `${lang}-${screen.key}-${width}: the aspect ratio differs from the ${screen.width}×${screen.height} the layout reserves`,
        );
      }
});

test("srcset lists both widths", () => {
  assert.equal(screenSrcSet("zh", screens[2]), "/screens/zh-phone-390.webp 390w, /screens/zh-phone-780.webp 780w");
});
