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
