import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { createApi } from "@/storefront/lib/api";
import { MOCK_NO_QUOTA_DOMAIN, MockStore, mockLang, sampleCodes } from "@/storefront/mock/api";

const NOW = Date.parse("2026-09-20T00:00:00Z");
const store = () => new MockStore(sampleCodes(NOW), [], () => NOW);

test("mock API: checks the redeem code in each of its states", () => {
  const s = store();
  expect(s.lookup({ code: "abcd-efgh-jklm-npqr" }).status).toBe(200);
  expect(s.lookup({ code: "MULT-2345-6789-ABCD" }).body.domains).toStrictEqual([
    "abnormalhq.com",
    "mail.abnormalhq.com",
  ]);
  expect(s.lookup({ code: "MULT-2345-6789-ABCD" }).body.quotaSupportedByDomain).toStrictEqual({
    "abnormalhq.com": true,
    "mail.abnormalhq.com": true,
  });
  expect(s.lookup({ code: "nope" }).body.kind).toBe("invalid_code");
  expect(s.lookup({ code: "USED-USED-USED-USED" }).body.kind).toBe("code_used");
  expect(s.lookup({ code: "EXPD-EXPD-EXPD-EXPD" }).body.kind).toBe("code_expired");
  expect(s.lookup({ code: "GONE-GONE-GONE-GONE" }).body.kind).toBe("code_disabled");
  expect(s.lookup(null).status).toBe(404);
});

test("mock API: the README redeem code table lists exactly the mock API's redeem codes", () => {
  const readme = readFileSync("README.md", "utf8");
  const listed = [...readme.matchAll(/^\| `([A-Z0-9]{4}(?:-[A-Z0-9]{4}){3})` \|/gm)].map(([, code]) =>
    code.replaceAll("-", ""),
  );
  expect(listed.toSorted()).toEqual(Object.keys(sampleCodes(NOW)).toSorted());
});

test("mock API: the username must be under a domain the redeem code allows and not taken", () => {
  const s = store();
  const base = { code: "ABCDEFGHJKLMNPQR", domain: "abnormalhq.com" };
  expect(s.checkUsername({ ...base, username: "Newbie@abnormalhq.com" }).status).toBe(200);
  expect(s.checkUsername({ ...base, username: "admin" }).body.kind).toBe("username_taken");
  expect(s.checkUsername({ ...base, username: ".bad" }).body.kind).toBe("username_invalid");
  expect(s.checkUsername({ ...base, domain: "mail.abnormalhq.com", username: "x" }).body.kind).toBe("domain_invalid");
});

test("mock API: after one activation a single-use redeem code is used up and the username taken; a single username / password is accepted too", () => {
  const s = store();
  const input = {
    code: "ABCD-EFGH-JKLM-NPQR",
    domain: "abnormalhq.com",
    username: "newbie",
    password: "Aa1aaaaa",
  };
  expect(s.redeem({ ...input, password: "weak" }).body.kind).toBe("password_invalid");
  const first = s.redeem(input);
  expect(first.status).toBe(201);
  const items = first.body.mailboxes as { ok: boolean; email?: string }[];
  expect(items[0]!.email).toBe("newbie@abnormalhq.com");
  expect((first.body.imap as { port: number }).port).toBe(993);
  expect(first.body.webmail).toBe("https://webmail.abnormalhq.com");
  expect(s.lookup({ code: input.code }).body.kind).toBe("code_used");
  expect(
    s.checkUsername({
      code: "MULT23456789ABCD",
      domain: "abnormalhq.com",
      username: "newbie",
    }).body.kind,
  ).toBe("username_taken");
});

test("mock redeem accepts the Stalwart password rules and returns the same credentials", () => {
  const s = store();
  const result = s.redeem({
    code: "ABCD-EFGH-JKLM-NPQR",
    domain: "abnormalhq.com",
    username: "simple",
    password: "abcdefgh",
  });
  expect(result.status).toBe(201);
  expect(result.body.mailboxes).toStrictEqual([
    {
      ok: true,
      index: 0,
      username: "simple",
      email: "simple@abnormalhq.com",
      password: "abcdefgh",
    },
  ]);
});

test("mock API: a batch within the quota activates one by one, over-quota, duplicate and taken names are stopped before activating", () => {
  const s = store();
  const base = { code: "MULT-2345-6789-ABCD", domain: "abnormalhq.com" };
  const pw = "Aa1aaaaa";
  const tooMany = s.redeem({
    ...base,
    mailboxes: Array.from({ length: 4 }, (_, i) => ({
      username: `u${i}`,
      password: pw,
    })),
  });
  expect(tooMany.body.kind).toBe("count_exceeded");
  const dup = s.redeem({
    ...base,
    mailboxes: [
      { username: "a", password: pw },
      { username: "a", password: pw },
    ],
  });
  expect([dup.body.kind, dup.body.index]).toStrictEqual(["username_invalid", 1]);
  const taken = s.redeem({
    ...base,
    mailboxes: [
      { username: "a", password: pw },
      { username: "admin", password: pw },
    ],
  });
  expect([taken.body.kind, taken.body.index]).toStrictEqual(["username_taken", 1]);

  const ok = s.redeem({
    ...base,
    mailboxes: [
      { username: "a", password: pw },
      { username: "b", password: "Bb2bbbbb" },
    ],
  });
  expect(ok.status).toBe(201);
  const items = ok.body.mailboxes as {
    ok: boolean;
    index: number;
    email?: string;
    password?: string;
  }[];
  expect(items.map((i) => [i.ok, i.index, i.email])).toStrictEqual([
    [true, 0, "a@abnormalhq.com"],
    [true, 1, "b@abnormalhq.com"],
  ]);
  expect(s.lookup({ code: base.code }).body.usesLeft).toBe(1);
  expect(s.lookup({ code: "TEAM-TEAM-TEAM-TEAM" }).body.usesLeft).toBe(1000);
});

test("mock API: the notification address is optional and a bad shape is stopped; after activation it says whether it was sent, bounce.example simulates a rejection", () => {
  const s = store();
  const base = { code: "TEAM-TEAM-TEAM-TEAM", domain: "abnormalhq.com" };
  const box = (username: string) => ({ username, password: "Aa1aaaaa" });

  const bad = s.redeem({ ...base, mailboxes: [box("n1")], notify: "nope" });
  expect([bad.status, bad.body.kind, bad.body.field]).toStrictEqual([400, "notify_invalid", "notify"]);
  expect(s.redeem({ ...base, mailboxes: [box("n1")], notify: 42 }).body.kind).toBe("notify_invalid");
  expect(s.lookup({ code: "n1" }).status, "nothing is activated when stopped").toBe(404);

  const none = s.redeem({ ...base, mailboxes: [box("n1")], notify: "  " });
  expect(none.status).toBe(201);
  expect(none.body.notification, "empty equals not given").toBe(null);

  const sent = s.redeem({
    ...base,
    mailboxes: [box("n2")],
    notify: " Me@Example.com ",
  });
  expect(sent.body.notification).toStrictEqual({
    to: "me@example.com",
    sent: true,
    error: null,
  });

  const bounced = s.redeem({
    ...base,
    mailboxes: [box("n3")],
    notify: "me@bounce.example",
  });
  const notification = bounced.body.notification as {
    to: string;
    sent: boolean;
    error: string | null;
  };
  expect(notification.sent).toBe(false);
  expect(notification.error ?? "").toMatch(/拒绝了收件人 me@bounce\.example/);
});

test("mock API: the PART redeem code fails the 2nd, 4th... of a batch, refunding quota and username, and the client reads the partial result as usual", async () => {
  const s = store();
  const base = { code: "PART-PART-PART-PART", domain: "abnormalhq.com" };
  const box = (username: string) => ({ username, password: "Aa1aaaaa" });
  // The client the pages use reads the mock API's answer directly.
  const api = createApi("", async (_url, init) => {
    const result = s.redeem(JSON.parse(String(init!.body)));
    return Response.json(result.body, { status: result.status });
  });
  const outcome = await api.redeem({ ...base, mailboxes: [box("p1"), box("p2"), box("p3")] });
  expect(outcome.mailboxes.map((item) => [item.ok, item.index])).toStrictEqual([
    [true, 0],
    [false, 1],
    [true, 2],
  ]);
  expect(outcome.mailboxes[1]).toMatchObject({ ok: false, kind: "unavailable", username: "p2" });
  expect(s.lookup({ code: base.code }).body.usesLeft, "the failed one takes no quota").toBe(1);
  expect(s.checkUsername({ ...base, username: "p2" }).status, "the failed username is not taken").toBe(200);
});

test("mock API: the legacy domain of the BARE redeem code does not support the per-mailbox quota", () => {
  expect(store().lookup({ code: "BARE-BARE-BARE-BARE" }).body.quotaSupportedByDomain).toStrictEqual({
    "abnormalhq.com": true,
    [MOCK_NO_QUOTA_DOMAIN]: false,
  });
});

test("mock API: error messages and the notification result follow the request language", () => {
  expect(mockLang("en")).toBe("en");
  expect(mockLang("en-US,en;q=0.9")).toBe("en");
  expect(mockLang("zh")).toBe("zh");
  expect(mockLang(null)).toBe("zh");
  const s = store();
  expect(s.lookup({ code: "nope" }, "en").body.error).toBe("This code does not exist. Check it and try again.");
  expect(s.lookup({ code: "nope" }).body.error).toBe("这个兑换码不存在，请检查后重试。");
  const bounced = s.redeem(
    {
      code: "TEAM-TEAM-TEAM-TEAM",
      domain: "abnormalhq.com",
      mailboxes: [{ username: "en1", password: "Aa1aaaaa" }],
      notify: "me@bounce.example",
    },
    "en",
  );
  expect((bounced.body.notification as { error: string }).error).toBe(
    "The mail server rejected me@bounce.example. Make sure this address exists.",
  );
  const duplicate = s.redeem(
    {
      code: "TEAM-TEAM-TEAM-TEAM",
      domain: "abnormalhq.com",
      mailboxes: [
        { username: "x1", password: "Aa1aaaaa" },
        { username: "x1", password: "Aa1aaaaa" },
      ],
    },
    "en",
  );
  expect(duplicate.body.error).toBe("Mailbox 2 has the same username as mailbox 1.");
});
