import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import {
  handleWaitlist,
  normalizeWaitlistEmail,
  waitlistServices,
  type WaitlistServices,
} from "../src/lib/waitlist.ts";
import { createWaitlistMock } from "../src/lib/waitlist-mock.ts";
import { homeMarkdown } from "../src/lib/markdown.ts";
import { linksFor } from "../src/data/site.ts";
import { copies } from "../src/i18n/index.ts";

function request(
  body: unknown = { email: "Test+access@example.com", lang: "en" },
  headers: Record<string, string> = {},
  method = "POST",
) {
  return new Request("https://abnormalhq.com/api/waitlist/", {
    method,
    headers: { "Content-Type": "application/json", Origin: "https://abnormalhq.com", ...headers },
    ...(method === "GET" ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
}

test("email normalization accepts aliases and rejects malformed or oversized addresses", () => {
  assert.equal(normalizeWaitlistEmail("  O'Reilly+access@Example.COM "), "o'reilly+access@example.com");
  for (const email of [
    null,
    "",
    "a",
    "a@@example.com",
    "a@localhost",
    ".a@example.com",
    "a..b@example.com",
    "a@-bad.com",
    "a@bad-.com",
    "a@bad..com",
    "a".repeat(65) + "@example.com",
    "x@" + "a".repeat(64) + ".com",
    "x@例子.中国",
    "Name <a@example.com>",
  ]) {
    assert.equal(normalizeWaitlistEmail(email), null, String(email));
  }
});

test("migration and API persist normalized registrations without duplicates or disclosing membership", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync("migrations/waitlist/0001_doppel_waitlist.sql", "utf8"));
  const services: WaitlistServices = {
    async limit() {
      return { success: true };
    },
    async add(email, lang) {
      db.prepare("INSERT INTO doppel_waitlist (email, locale) VALUES (?, ?) ON CONFLICT(email) DO NOTHING").run(
        email,
        lang,
      );
    },
  };
  try {
    const first = await handleWaitlist(request(), services);
    const duplicate = await handleWaitlist(request({ email: " TEST+ACCESS@example.com ", lang: "zh" }), services);
    assert.equal(first.status, 200);
    assert.equal(first.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(await first.json(), { ok: true });
    assert.deepEqual(await duplicate.json(), { ok: true });
    const rows = db.prepare("SELECT * FROM doppel_waitlist").all();
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.email, "test+access@example.com");
    assert.equal(rows[0]!.locale, "en");
    assert.equal(typeof rows[0]!.created_at, "number");
    assert.deepEqual(Object.keys(rows[0]!).sort(), ["created_at", "email", "locale"]);
  } finally {
    db.close();
  }
});

test("invalid and unsafe requests never reach persistence", async () => {
  let writes = 0;
  const services: WaitlistServices = {
    async limit() {
      return { success: true };
    },
    async add() {
      writes++;
    },
  };
  for (const [req, status] of [
    [request(null, {}, "GET"), 405],
    [request({}, { Origin: "https://evil.example" }), 403],
    [request({}, { "Sec-Fetch-Site": "cross-site" }), 403],
    [request({}, { "Content-Type": "text/plain" }), 415],
    [request("x", { "Content-Length": "2049" }), 413],
    [request("x".repeat(2049)), 413],
    [request("{"), 400],
    [request([]), 400],
    [request({ email: "bad", lang: "en" }), 400],
    [request({ email: "x@example.com", lang: "xx" }), 400],
    [request({ email: "x@example.com" }), 400],
  ] as const) {
    const response = await handleWaitlist(req, services);
    assert.equal(response.status, status);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  }
  assert.equal(writes, 0);
});

test("rate limits, storage errors and disabled collection fail closed without false acknowledgement", async () => {
  let writes = 0;
  const limited = await handleWaitlist(request(), {
    async limit() {
      return { success: false };
    },
    async add() {
      writes++;
    },
  });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("Retry-After"), "60");
  assert.equal(writes, 0);
  for (const services of [
    undefined,
    {
      async limit() {
        throw new Error("private rate-limit error");
      },
      async add() {},
    },
    {
      async limit() {
        return { success: true };
      },
      async add() {
        throw new Error("test@example.com secret SQL");
      },
    },
  ]) {
    const response = await handleWaitlist(request(), services);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "unavailable" });
  }
  assert.equal(waitlistServices({}), undefined);
  assert.equal(waitlistServices({ DOPPEL_WAITLIST_ENABLED: "true" }), undefined);
});

test("local preview accepts only reserved test addresses and limits requests", async () => {
  const mock = createWaitlistMock();
  assert.equal((await handleWaitlist(request({ email: "someone@example.org", lang: "en" }), mock)).status, 503);
  assert.equal((await handleWaitlist(request(), mock)).status, 200);
  assert.equal((await handleWaitlist(request(), mock)).status, 200);
  await handleWaitlist(request(), mock);
  await handleWaitlist(request(), mock);
  assert.equal((await handleWaitlist(request(), mock)).status, 429);
});

test("both languages direct Doppel only to their waitlist and explain registration is not access", () => {
  for (const lang of ["en", "zh"] as const) {
    assert.equal(linksFor(lang).doppel, lang === "en" ? "/#doppel-waitlist" : "/zh/#doppel-waitlist");
    const markdown = homeMarkdown(lang);
    assert.ok(markdown.includes(copies[lang].waitlist.description));
    assert.ok(markdown.includes(copies[lang].waitlist.privacy));
    assert.ok(!markdown.includes("github.com/abnormalhq/doppel"));
    assert.match(copies[lang].products.items[1]!.note, /Not public|尚未公开/);
  }
});
