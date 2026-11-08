import { fixupConfigRules } from "@eslint/compat";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  // eslint-config-next 自带的 eslint-plugin-react / import / jsx-a11y 还在调用 ESLint 10 已移除的
  // context.getFilename() 等旧 API，用 @eslint/compat 包一层补回；等它们原生支持 ESLint 10 后可以去掉。
  ...fixupConfigRules(nextVitals),
  ...fixupConfigRules(nextTs),
  globalIgnores([
    ".next/**",
    ".open-next/**",
    "next-env.d.ts",
    ".wrangler/**",
    ".artifacts/**",
    // Claude Code 的 worktree 是整份仓库副本
    ".claude/**",
    // 宣传视频的 Remotion 工程是独立的包，有自己的依赖与 typecheck（video/package.json）
    "video/**",
  ]),
]);

export default eslintConfig;
