import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { copies, langs } from "../src/i18n/index.ts";

const weeks = langs.map((lang) => [lang, copies[lang].features.samples] as const);

test("the calendar sample is the same week in both languages", () => {
  // Only the words differ: which day and hours an event takes, and whether it has a place, must not depend on the language.
  const [head, ...rest] = weeks;
  assert.ok(head, "no languages");
  const [, first] = head;
  const shape = (samples: typeof first) =>
    samples.events.map(({ day, start, end, location }) => ({ day, start, end, location: location !== "" }));
  for (const [lang, samples] of rest) assert.deepEqual(shape(samples), shape(first), lang);
});

test("the calendar sample fits its week view", () => {
  for (const [lang, samples] of weeks) {
    for (const event of samples.events) {
      assert.ok(Number.isInteger(event.day) && event.day >= 0 && event.day <= 6, `${lang}: ${event.title} day`);
      assert.ok(event.start >= 8 && event.end <= 21 && event.start < event.end, `${lang}: ${event.title} hours`);
    }
  }
});

test("the demo is WebMail's own demo page in a frame, and this site sends it nothing", () => {
  const source = readFileSync("src/components/WebmailDemo.tsx", "utf8");
  assert.match(source, /^"use client";/);
  // The one WebMail page that may be framed by this site (abnormalhq/mail, docs/webmail-demo.md).
  assert.match(source, /"https:\/\/webmail\.abnormalhq\.com\/demo"/);
  assert.match(source, /<iframe\b/);
  assert.doesNotMatch(source, /\bfetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|postMessage/);
  // It takes its title through props, so the bundle does not carry the copy module.
  assert.doesNotMatch(source, /from "@\/i18n"(?!\/types)/);
});
