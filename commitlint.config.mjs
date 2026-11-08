const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Ops changes (servers, DNS, Ansible) use ops.
    "type-enum": [
      2,
      "always",
      ["build", "chore", "ci", "docs", "feat", "fix", "ops", "perf", "refactor", "revert", "style", "test"],
    ],
    // The body is usually one paragraph of Chinese prose, not wrapped to a line width.
    "body-max-line-length": [0],
    "footer-max-line-length": [0],
  },
};

export default config;
