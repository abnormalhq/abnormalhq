import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { checkContracts, compatibilityErrors, verifyArtifact } from "../scripts/contract-compat.ts";

const published = JSON.parse(readFileSync("docs/onboard-contract.json", "utf8"));
test("additive routes and response fields preserve a deployed consumer", () => {
  const next = structuredClone(published);
  next.version++;
  next.shop.routes["future-optional-feature"] = ["GET"];
  next.shop.publicOrderFields.push("optionalFutureField");
  assert.deepEqual(compatibilityErrors(next, published), []);
});
test("route removal, changed validation, new required input and unknown enums require migration", () => {
  for (const change of [
    (next: typeof published) => {
      delete next.shop.routes.checkout;
    },
    (next: typeof published) => {
      next.redeem.password.minLength++;
    },
    (next: typeof published) => {
      next.shop.quote.requestFields.push("requiredFutureInput");
    },
    (next: typeof published) => {
      next.shop.providers.push("future-provider");
    },
  ]) {
    const next = structuredClone(published);
    change(next);
    assert.ok(compatibilityErrors(next, published).length);
  }
});
test("USDT payment request fields remain closed to new required inputs", () => {
  const next = structuredClone(published);
  next.shop.usdt.payRequestFields.push("requiredNetworkSignature");
  assert.ok(compatibilityErrors(next, published).length);
});
test("new validation constraints and unknown error enums require migration", () => {
  for (const change of [
    (next: typeof published) => {
      next.redeem.username.minLength = 2;
    },
    (next: typeof published) => {
      next.redeem.errorKinds.new_error = { status: 400, field: null };
    },
    (next: typeof published) => {
      next.shop.refusalCodes.new_refusal = { status: 400, details: [] };
    },
  ]) {
    const next = structuredClone(published);
    change(next);
    assert.ok(compatibilityErrors(next, published).length);
  }
});
test("a version bump cannot authorize removal, while versioned replacement routes allow staged migration", () => {
  const next = structuredClone(published);
  next.version++;
  next.shop.routes["v4/checkout"] = ["POST"];
  assert.deepEqual(compatibilityErrors(next, published), []);
  delete next.shop.routes.checkout;
  assert.ok(compatibilityErrors(next, published).length);
});
test("a substituted snapshot fails its pinned checksum", () => {
  const lock = JSON.parse(readFileSync("docs/onboard-contract.lock.json", "utf8"));
  const snapshot = '{"version":3}';
  lock.sha256 = createHash("sha256").update(snapshot).digest("hex");
  assert.equal(verifyArtifact(snapshot, lock).version, 3);
  assert.throws(() => verifyArtifact("{}", lock), /checksum/);
});

test("the PR base protects later additions even when the pinned snapshot still passes", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "storefront-contract-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const source = JSON.stringify(published);
  const lock = JSON.parse(readFileSync("docs/onboard-contract.lock.json", "utf8"));
  lock.sha256 = createHash("sha256").update(source).digest("hex");
  const baseline = structuredClone(published);
  baseline.shop.routes["published-later"] = ["GET"];
  baseline.shop.publicOrderFields.push("publishedLaterField");
  const lockPath = join(directory, "lock.json");
  const consumerPath = join(directory, "consumer.json");
  const providerPath = join(directory, "provider.json");
  const baselinePath = join(directory, "base.json");
  writeFileSync(lockPath, JSON.stringify(lock));
  writeFileSync(consumerPath, source);
  writeFileSync(providerPath, source);
  writeFileSync(baselinePath, JSON.stringify(baseline));
  const args = ["--lock", lockPath, "--consumer", consumerPath, "--provider", providerPath];

  await checkContracts(args);
  await assert.rejects(checkContracts([...args, "--baseline", baselinePath]), (error: Error) => {
    assert.match(error.message, /contract.shop.routes.published-later/);
    assert.match(error.message, /contract.shop.publicOrderFields/);
    return true;
  });
  writeFileSync(providerPath, JSON.stringify(baseline));
  await checkContracts([...args, "--baseline", baselinePath]);
  await assert.rejects(checkContracts([...args, "--baseline", join(directory, "missing.json")]), /ENOENT/);
  await assert.rejects(checkContracts([...args, "--baseline"]), /Missing baseline contract path/);
});
