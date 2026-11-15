import assert from "node:assert/strict";
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
  assert.equal(verifyArtifact(readFileSync("docs/onboard-contract.json", "utf8"), lock).version, 3);
  assert.throws(() => verifyArtifact("{}", lock), /checksum/);
});
