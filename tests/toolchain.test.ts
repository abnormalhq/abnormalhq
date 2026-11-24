import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { satisfies } from "./support/semver.ts";

const manifest = JSON.parse(readFileSync("package.json", "utf8"));

test("engines.node is a floor every tool this website runs supports", () => {
  // engines is what contributors and tools (pnpm, Dependabot) read as the minimum, so it has to be
  // the highest minimum among the dependencies, not a version where `pnpm install` warns or a commit hook breaks.
  const floor = manifest.engines.node.match(/^>=(\d+\.\d+\.\d+)$/)?.[1];
  assert.ok(floor, `engines.node is a plain >= floor, not ${manifest.engines.node}`);
  const needs: [string, string][] = [
    // `pnpm test` runs node --test on .ts sources: type stripping without a flag.
    ["node --test on TypeScript", "^22.18.0 || >=23.6.0"],
  ];
  for (const name of Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })) {
    const engines = JSON.parse(readFileSync(join("node_modules", name, "package.json"), "utf8")).engines?.node;
    if (engines) needs.push([name, engines]);
  }
  for (const [name, range] of needs) assert.ok(satisfies(floor, range), `${name} needs Node.js ${range}`);
  const pinned = readFileSync(".node-version", "utf8").trim();
  assert.ok(satisfies(pinned, manifest.engines.node), `.node-version ${pinned} is inside engines.node`);
});

test("tsconfig pins the class-field semantics, so Next compiles fields as tsc and the tests do", () => {
  // Next's SWC reads only an explicit useDefineForClassFields and compiles [[Set]] fields without it, while tsc, node
  // --test (type stripping keeps fields as they are) use define semantics for an ES2022 target.
  const { compilerOptions } = JSON.parse(readFileSync("tsconfig.json", "utf8"));
  assert.equal(compilerOptions.target, "ES2022");
  assert.equal(compilerOptions.useDefineForClassFields, true);
});

test("the range check reads ranges as npm does", () => {
  assert.ok(satisfies("0.5.2", "^0.5.2"));
  assert.ok(satisfies("0.5.9", "^0.5.2"));
  assert.ok(!satisfies("0.5.0", "^0.5.2"));
  assert.ok(!satisfies("0.6.0", "^0.5.2"));
  assert.ok(satisfies("1.9.0", "^1.2.3"));
  assert.ok(!satisfies("2.0.0", "^1.2.3"));
  assert.ok(!satisfies("1.2.2", "^1.2.3"));
  assert.ok(!satisfies("0.0.4", "^0.0.3"));
  assert.ok(satisfies("22.22.1", ">=22.22.1"));
  assert.ok(!satisfies("22.18.0", ">=22.22.1"));
  assert.ok(satisfies("22.0.0", ">= 22"));
  assert.ok(!satisfies("21.9.9", ">=22"));
  const eslint = "^20.19.0 || ^22.13.0 || >=24";
  assert.ok(!satisfies("22.12.0", eslint));
  assert.ok(satisfies("22.13.0", eslint));
  assert.ok(!satisfies("23.0.0", eslint));
  assert.ok(satisfies("24.18.0", eslint));
  assert.ok(satisfies("22.5.1", "~22.5.0"));
  assert.ok(!satisfies("22.6.0", "~22.5.0"));
  assert.ok(satisfies("22.9.0", "22"));
  assert.ok(!satisfies("23.0.0", "<=22"));
  assert.ok(satisfies("23.0.0", ">22"));
  assert.ok(!satisfies("22.99.0", ">22"));
  assert.ok(satisfies("22.12.0", ">=20 <23"));
  assert.ok(satisfies("1.0.0", "*"));
  assert.throws(() => satisfies("22.0.0", "20 - 22"));
  assert.throws(() => satisfies("22.0.0", ">=22.0.0-0"));
});
