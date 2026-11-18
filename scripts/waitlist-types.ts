import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

// Example bindings are deliberately not present in the production config.
// Module scope prevents workerd DOM declarations from overriding Next/browser types.
const file = "waitlist-bindings.d.ts";
execFileSync(
  "pnpm",
  [
    "exec",
    "wrangler",
    "types",
    file,
    "--config",
    "wrangler.waitlist.example.jsonc",
    "--env-interface",
    "DoppelWaitlistBindings",
    "--strict-vars",
    "false",
  ],
  { stdio: "inherit" },
);
const generated = readFileSync(file, "utf8");
writeFileSync(
  file,
  generated.replace(
    "/* eslint-disable */",
    [
      "/* eslint-disable */",
      "// Kept module-scoped so workerd DOM types do not replace Next.js / browser DOM types.",
      "export type { DoppelWaitlistBindings };",
    ].join("\n"),
  ),
);
