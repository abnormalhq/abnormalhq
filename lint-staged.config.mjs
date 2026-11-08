// Before a commit only staged files are processed: code goes through eslint --fix and then prettier, everything else prettier can format goes to prettier.
// The two globs do not overlap, so no file is rewritten by two parallel tasks at once.
const config = {
  "*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}": ["eslint --fix --no-warn-ignored", "prettier --write"],
  "*.{json,jsonc,md,mdx,css,html,yml,yaml}": "prettier --write",
};

export default config;
