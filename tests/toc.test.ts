import { test } from "node:test";
import assert from "node:assert/strict";
import { currentSection } from "../src/lib/toc.ts";

test("the table of contents follows the last heading that has scrolled past the offset", () => {
  assert.equal(currentSection([], 100, false), -1);
  assert.equal(currentSection([300, 900, 1500], 100, false), -1, "nothing is current above the first heading");
  assert.equal(currentSection([100, 700, 1300], 100, false), 0, "a heading exactly at the offset counts");
  assert.equal(currentSection([-500, 40, 600], 100, false), 1);
  assert.equal(currentSection([-1500, -900, -300], 100, false), 2);
});

test("at the bottom of the page the last section is current, even if its heading never reached the offset", () => {
  assert.equal(currentSection([-900, -200, 400], 100, true), 2);
});
