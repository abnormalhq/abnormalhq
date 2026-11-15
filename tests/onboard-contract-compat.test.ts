import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { compatibilityErrors, verifyArtifact } from "../scripts/contract-compat.ts";

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
