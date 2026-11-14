import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { localDate, localDateTime } from "../src/lib/dates.ts";

// In the runtime's own time zone, so only the shape is fixed here.
const at = "2026-11-13T16:05:30.000Z";

test("dates and times are written with digits and dashes on a 24-hour clock", () => {
  assert.match(localDate(at) ?? "", /^\d{4}-\d{2}-\d{2}$/);
  assert.match(localDateTime(at) ?? "", /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  assert.equal(localDateTime(at)?.slice(0, 10), localDate(at));
});

test("a value that is no date gives null", () => {
  assert.equal(localDate("soon"), null);
  assert.equal(localDateTime(""), null);
});

test("the visitor's zone decides the day and the time", () => {
  // A fresh process per zone: the formatter takes the zone it starts in.
  const run = (zone: string) =>
    execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `const { localDateTime } = await import(${JSON.stringify(new URL("../src/lib/dates.ts", import.meta.url).href)});
         process.stdout.write(localDateTime(${JSON.stringify(at)}) ?? "");`,
      ],
      { env: { ...process.env, TZ: zone }, encoding: "utf8" },
    );
  assert.equal(run("Asia/Shanghai"), "2026-11-14 00:05");
  assert.equal(run("UTC"), "2026-11-13 16:05");
});
