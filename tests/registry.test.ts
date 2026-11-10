import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CN_THEME, cn } from "../src/lib/utils.ts";

const componentsDir = "src/components";
const ownComponents = readdirSync(componentsDir).filter((file) => file.endsWith(".tsx"));
const installed = readdirSync(join(componentsDir, "ui"));

test("the website pulls its components from the @abnormal registry", () => {
  const config = JSON.parse(readFileSync("components.json", "utf8"));
  assert.equal(config.registries["@abnormal"], "https://ui.abnormalhq.com/r/{name}.json");
  assert.ok(existsSync("src/styles/abnormal.css"), "@abnormal/theme is installed");
  assert.ok(existsSync("src/lib/utils.ts"), "@abnormal/utils is installed");
  assert.ok(installed.length > 0);
});

test("styles live in className and the theme: no CSS modules or old utility classes", () => {
  const files = readdirSync("src", { recursive: true, encoding: "utf8" });
  assert.deepEqual(
    files.filter((file) => file.endsWith(".module.css")),
    [],
  );
  const global = readFileSync("src/styles/global.css", "utf8");
  assert.ok(global.includes('@import "./abnormal.css"'));
  assert.doesNotMatch(global, /@utility/);
  for (const file of ownComponents) {
    assert.doesNotMatch(
      readFileSync(join(componentsDir, file), "utf8"),
      /\b(page-shell|section-space|btn-primary)\b/,
      file,
    );
  }
});

test("smooth scrolling respects reduced motion", () => {
  const global = readFileSync("src/styles/global.css", "utf8");
  const declaration = global.indexOf("scroll-behavior: smooth");
  assert.ok(declaration > global.indexOf("@media (prefers-reduced-motion: no-preference)"));
  assert.equal(global.match(/scroll-behavior/g)?.length, 1);
});

test("dark: utilities follow the system preference like the theme tokens", () => {
  // Process.tsx darkens the step band with dark:, which must still apply on a dark system when theme-init.js has not run.
  const theme = readFileSync("src/styles/abnormal.css", "utf8");
  const variant = theme.slice(theme.indexOf("@custom-variant dark"), theme.indexOf("@custom-variant data-open"));
  assert.match(variant, /&:where\(\[data-theme="dark"\], \[data-theme="dark"\] \*\)/);
  assert.match(variant, /@media \(prefers-color-scheme: dark\) \{\s*&:where\(:root:not\(\[data-theme="light"\]\)/);
});

test("registry components are not edited to import site code", () => {
  for (const file of installed) {
    const source = readFileSync(join(componentsDir, "ui", file), "utf8");
    for (const [, path] of source.matchAll(/from "(@\/[^"]+)"/g)) {
      assert.match(path!, /^@\/(lib\/utils|components\/ui\/)/, `${file}: ${path}`);
    }
  }
});

test("cn knows every custom name in the installed theme", () => {
  // utils.ts and abnormal.css are installed separately: a theme taken without its utils leaves cn guessing at the new names.
  const theme = readFileSync("src/styles/abnormal.css", "utf8");
  const tokens = (prefix: string) => [...theme.matchAll(new RegExp(`--${prefix}-([a-z-]+):`, "g"))].map((m) => m[1]!);
  assert.deepEqual([...CN_THEME.radius].sort(), tokens("radius").sort());
  assert.deepEqual([...CN_THEME.shadow].sort(), tokens("shadow").sort());
  assert.deepEqual([...CN_THEME.animate].sort(), tokens("animate").sort());
  const display = tokens("text").filter((name) => name.startsWith("display") && !name.endsWith("-line-height"));
  assert.deepEqual([...CN_THEME.text].sort(), display.sort());
  // A display size is a size, not a color: it stays beside a text color, and a later size replaces it.
  assert.equal(cn("text-display", "text-foreground"), "text-display text-foreground");
  assert.equal(cn("text-display-sm", "text-display"), "text-display");
});
