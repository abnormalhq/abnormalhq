import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { copies, langs } from "../src/i18n/index.ts";

const demos = langs.map((lang) => [lang, copies[lang].demo] as const);

test("the demo's sample content behaves the same in both languages", () => {
  // Only the words differ: which mail is unread, starred, where it is filed and which labels it has must not depend on the language.
  const [[, first], ...rest] = demos;
  const shape = (demo: typeof first) => ({
    labels: demo.labels.map(({ id, color }) => ({ id, color })),
    mails: demo.mails.map(({ id, day, category, labels, unread, starred, attachment }) => ({
      id,
      day,
      category,
      labels,
      unread,
      starred,
      attachment: attachment !== "",
    })),
    events: demo.events.map(({ day, start, end, location }) => ({ day, start, end, location: location !== "" })),
  });
  for (const [lang, demo] of rest) assert.deepEqual(shape(demo), shape(first), lang);
});

test("the demo's sample content fits the demo", () => {
  for (const [lang, demo] of demos) {
    const ids = new Set(demo.labels.map((label) => label.id));
    assert.equal(new Set(demo.mails.map((mail) => mail.id)).size, demo.mails.length, `${lang}: mail ids are unique`);
    for (const mail of demo.mails) {
      for (const label of mail.labels) assert.ok(ids.has(label), `${lang}: ${mail.id} has unknown label ${label}`);
      assert.ok(mail.body.length > 0, `${lang}: ${mail.id} has a body`);
      // Sample senders never use a real domain.
      assert.match(mail.address, /\.example$/, `${lang}: ${mail.id}`);
    }
    for (const event of demo.events) {
      assert.ok(Number.isInteger(event.day) && event.day >= 0 && event.day <= 6, `${lang}: ${event.title} day`);
      assert.ok(event.start >= 8 && event.end <= 21 && event.start < event.end, `${lang}: ${event.title} hours`);
    }
  }
});

test("the demo sends nothing: no request leaves it", () => {
  const source = readFileSync("src/components/WebmailDemo.tsx", "utf8");
  assert.doesNotMatch(source, /\bfetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage/);
  assert.match(source, /^"use client";/);
  // It takes its copy through props, so the bundle does not carry the copy module.
  assert.doesNotMatch(source, /from "@\/i18n"(?!\/types)/);
});
