import { fixupConfigRules } from "@eslint/compat";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  // The eslint-plugin-react / import / jsx-a11y bundled with eslint-config-next still call old APIs that ESLint 10 removed,
  // such as context.getFilename(); @eslint/compat wraps them to add those back. Drop it once they support ESLint 10 natively.
  ...fixupConfigRules(nextVitals),
  ...fixupConfigRules(nextTs),
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
                "^(?:@/|(?:\\.\\./)+)storefront/(?!(?:index|content|server)(?:\\.ts)?$|components/(?:StorePage|Guide|Onboard|Shop|ShopAccount|ShopOrder|ShopRenew|ShopParts|ShopCatalogPrefetch|copy/[a-z-]+)$)",
              message:
                "Import the storefront through @/storefront, @/storefront/content, @/storefront/server or one of its page components.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    ".open-next/**",
    "next-env.d.ts",
    ".wrangler/**",
    ".artifacts/**",
    // Claude Code worktrees are full copies of the repository
    ".claude/**",
    // The promo video's Remotion project is a separate package with its own dependencies and typecheck (video/package.json)
    "video/**",
  ]),
]);

export default eslintConfig;
