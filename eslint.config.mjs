import { fixupConfigRules } from "@eslint/compat";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import css from "@eslint/css";
import { tailwind4 } from "tailwind-csstree";
import abnormal from "./eslint/eslint-plugin-abnormal.mjs";

/** Every script the JavaScript and TypeScript rules read; the CSS files linted below have a language of their own. */
const SCRIPTS = ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"];

/** Blocks with no `files` would also run on CSS, whose syntax their rules cannot read: scope the ones that set rules to scripts. */
const scripts = (configs) =>
  configs.map((config) =>
    config.files || !(config.rules || config.plugins || config.languageOptions)
      ? config
      : { ...config, files: SCRIPTS },
  );

/**
 * The theme's semantic colors, type scale, spacing steps, radii, shadows and layers instead of hand-picked values
 * (eslint/eslint-plugin-abnormal.mjs, installed from abnormalhq/ui). A value that has to stay takes a comment containing
 * `abnormal-allow:` on its line or the line above, saying why.
 * Tests spell out the classes a component renders, and the theme file is where the literal values live.
 */
const themeRules = [
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { abnormal },
  },
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}", "**/tests/**", "**/__tests__/**", "**/e2e/**"],
    rules: { "abnormal/no-hardcoded-classes": "error" },
  },
  {
    files: ["**/*.css"],
    ignores: ["src/styles/abnormal*.css"],
    language: "css/css",
    // Tailwind's syntax, so @theme, @utility and @apply with variants parse and every declaration in them is checked;
    // tolerant for the @keyframes inside @theme, which that syntax does not read yet.
    languageOptions: { customSyntax: tailwind4, tolerant: true },
    plugins: { css, abnormal },
    rules: { "abnormal/no-hardcoded-css": "error" },
  },
];

const eslintConfig = defineConfig([
  // The eslint-plugin-react / import / jsx-a11y bundled with eslint-config-next still call old APIs that ESLint 10 removed,
  // such as context.getFilename(); @eslint/compat wraps them to add those back. Drop it once they support ESLint 10 natively.
  ...fixupConfigRules(nextVitals),
  ...fixupConfigRules(nextTs),
  {
    // A few of typescript-eslint's type-aware rules: awaiting something that is not a promise, promises that are neither
    // awaited nor handled, promises passed where a void callback is expected, and type assertions the types already make
    // pointless. Only the rules: eslint-config-next/typescript already registers the plugin and parser.
    // no-unnecessary-condition is left out: TypeScript does not see a flag or signal.aborted change across an await, so it
    // flags most of the cancellation checks in the storefront's effects.
    files: ["**/*.{ts,tsx,mts}"],
    // The registry's copies are checked in abnormalhq/ui, where they are changed.
    ignores: ["src/components/ui/**"],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-floating-promises": [
        "error",
        {
          // node:test runs the tests it registers; the promise test() and describe() return needs no handling.
          allowForKnownSafeCalls: [
            { from: "package", package: "node:test", name: ["test", "it", "describe", "suite"] },
          ],
        },
      ],
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
    },
  },
  {
    // A bare <select> shows the browser's own arrow pressed against the right edge; NativeSelect draws the chevron with room for it.
    files: ["**/*.tsx"],
    ignores: ["src/components/ui/native-select.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXOpeningElement[name.name='select']",
          message: "Use NativeSelect from @/components/ui/native-select instead of a bare <select>.",
        },
      ],
    },
  },
  {
    // The storefront (src/storefront/) is used from the rest of the site only through its entry points: index.ts (catalog,
    // address check, username rules), content.ts (copy and Markdown), server.ts (live catalog, metadata) and its page
    // components. Its dev-only mock API is for the route.dev.ts handlers, and worker.ts reaches its Worker code directly.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/storefront/**", "src/app/**/route.dev.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex:
                "^(?:@/|(?:\\.\\./)+)storefront/(?!(?:index|content|server)(?:\\.ts)?$|components/(?:StorePage|Guide|Onboard|Shop|ShopAccount|ShopOrder|ShopRenew|ShopParts|ShopSeatStepper|ShopCatalogPrefetch|copy/[a-z-]+)$)",
              message:
                "Import the storefront through @/storefront, @/storefront/content, @/storefront/server or one of its page components.",
            },
          ],
        },
      ],
    },
  },
  ...themeRules,
  globalIgnores([
    ".next/**",
    ".open-next/**",
    "next-env.d.ts",
    "waitlist-bindings.d.ts",
    ".wrangler/**",
    ".artifacts/**",
    // Claude Code worktrees are full copies of the repository
    ".claude/**",
    // The promo video's Remotion project is a separate package with its own dependencies and typecheck (video/package.json)
    "video/**",
  ]),
]);

export default scripts(eslintConfig);
