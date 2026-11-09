import { expect, test } from "vitest";
import { ApiError, NetworkError, createApi, readApiError, readCdkInfo, readRedeemResult } from "@/storefront/lib/api";

test("error responses: known kind and field are taken as is, unknown ones become other, 429 becomes rate_limited", () => {
  const known = readApiError(409, {
    error: "已被占用",
    kind: "username_taken",
    field: "username",
  });
  expect(known.kind).toBe("username_taken");
  expect(known.field).toBe("username");
  expect(known.message).toBe("已被占用");
  expect(known.status).toBe(409);

  const unknown = readApiError(500, {
    error: "内部错误",
    kind: "boom",
    field: "nope",
  });
  expect(unknown.kind).toBe("other");
  expect(unknown.field).toBe(null);

  expect(readApiError(429, null).kind).toBe("rate_limited");
  expect(readApiError(502, "not json").message).toBe("HTTP 502");

  const notify = readApiError(400, {
    error: "接收邮箱不对",
    kind: "notify_invalid",
    field: "notify",
  });
  expect(notify.kind).toBe("notify_invalid");
  expect(notify.field).toBe("notify");
});

test("redeem code info: domains are lower-cased, defaults filled in, a bad shape counts as a network error", () => {
  expect(
    readCdkInfo({
      domains: [" Abnormal.bid ", "", 3],
      expiresAt: "",
      usesLeft: 2,
    }),
  ).toStrictEqual({
    domains: ["abnormal.bid"],
    expiresAt: null,
    usesLeft: 2,
  });
  // The remaining count is always a non-negative integer (no "unlimited"); any other shape is not an answer from mail.
  for (const usesLeft of ["2", null, undefined, -1, 1.5, Number.POSITIVE_INFINITY]) {
    expect(() => readCdkInfo({ domains: ["abnormal.bid"], expiresAt: null, usesLeft }), String(usesLeft)).toThrow(
      NetworkError,
    );
  }
  expect(() => readCdkInfo({ domains: [] })).toThrow(NetworkError);
  expect(() => readCdkInfo("x")).toThrow(NetworkError);
});

test("redeem code info: with human verification on the backend returns the site key, empty strings and non-strings count as off", () => {
  const base = { domains: ["abnormal.bid"], expiresAt: null, usesLeft: 1 };
  expect(readCdkInfo({ ...base, turnstileSiteKey: " 0x4AAA " }).turnstileSiteKey).toBe("0x4AAA");
  expect(readCdkInfo({ ...base, turnstileSiteKey: "" })).not.toHaveProperty("turnstileSiteKey");
  expect(readCdkInfo({ ...base, turnstileSiteKey: 1 })).not.toHaveProperty("turnstileSiteKey");
  expect(readCdkInfo(base)).not.toHaveProperty("turnstileSiteKey");
});

test("a failed human verification has its own error type", () => {
  const error = readApiError(403, { error: "人机验证没有通过", kind: "challenge_failed" });
  expect(error.kind).toBe("challenge_failed");
  expect(error.field).toBeNull();
});

test("activation result: entry by entry, server info omitted when incomplete, webmail only accepted over https", () => {
  const result = readRedeemResult({
    domain: "abnormal.bid",
    mailboxes: [
      {
        ok: true,
        index: 0,
        username: "k",
        email: "k@abnormal.bid",
        password: "Aa1aaaaa",
      },
      {
        ok: false,
        index: 1,
        username: "admin",
        error: "占用",
        kind: "username_taken",
        field: "username",
      },
      { ok: false, username: "x", error: "怪", kind: "nope" },
    ],
    imap: { host: "imap.abnormal.bid", port: "993" },
    smtp: { host: "", port: 465, security: "tls" },
    webmail: "http://insecure.example/",
  });
  expect(result.imap).toStrictEqual({
    host: "imap.abnormal.bid",
    port: 993,
    security: "tls",
  });
  expect(result.smtp).toBe(null);
  expect(result.webmail).toBe(null);
  expect(result.mailboxes.length).toBe(3);
  expect(result.mailboxes[0]).toStrictEqual({
    ok: true,
    index: 0,
    username: "k",
    email: "k@abnormal.bid",
    password: "Aa1aaaaa",
  });
  expect(result.mailboxes[1]).toStrictEqual({
    ok: false,
    index: 1,
    username: "admin",
    error: "占用",
    kind: "username_taken",
    field: "username",
  });
  expect(result.mailboxes[2]).toStrictEqual({
    ok: false,
    index: 2,
    username: "x",
    error: "怪",
    kind: "other",
    field: null,
  });
  expect(result.notification, "no notification means null").toBe(null);
  expect(() => readRedeemResult({ domain: "abnormal.bid", mailboxes: [] })).toThrow(NetworkError);
  expect(() => readRedeemResult({ mailboxes: [{ ok: true, email: "k@abnormal.bid" }] })).toThrow(NetworkError);
});

test("activation result: whether the notification was sent is taken as is, a bad shape counts as no notification", () => {
  const base = {
    domain: "abnormal.bid",
    mailboxes: [
      {
        ok: true,
        index: 0,
        username: "k",
        email: "k@abnormal.bid",
        password: "Aa1aaaaa",
      },
    ],
  };
  expect(
    readRedeemResult({
      ...base,
      notification: { to: " me@example.com ", sent: true },
    }).notification,
  ).toStrictEqual({ to: "me@example.com", sent: true, error: null });
  expect(
    readRedeemResult({
      ...base,
      notification: { to: "me@example.com", sent: false, error: " 被拒收 " },
    }).notification,
  ).toStrictEqual({ to: "me@example.com", sent: false, error: "被拒收" });
  expect(readRedeemResult({ ...base, notification: { sent: true } }).notification).toBe(null);
  expect(readRedeemResult({ ...base, notification: "yes" }).notification).toBe(null);
  expect(
    readRedeemResult({
      ...base,
      notification: { to: "me@example.com", sent: "yes" },
    }).notification?.sent,
    "sent other than true counts as not sent",
  ).toBe(false);
});

test("index in an error response points at the position in the batch", () => {
  const error = readApiError(409, {
    error: "第 2 个占用",
    kind: "username_taken",
    field: "username",
    index: 1,
  });
  expect(error.index).toBe(1);
  expect(readApiError(409, { error: "x", kind: "count_exceeded", field: "count" }).index).toBe(null);
  expect(readApiError(409, { error: "x", kind: "count_exceeded", index: -1 }).index).toBe(null);
});

test("client: POSTs JSON to {base}/api/onboard/..., non-2xx throws ApiError, unreachable throws NetworkError", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const api = createApi("", async (url, init) => {
    calls.push({ url: String(url), init: init ?? {} });
    if (String(url).endsWith("/cdk")) {
      return new Response(
        JSON.stringify({
          domains: ["abnormal.bid"],
          expiresAt: null,
          usesLeft: 1,
        }),
        { status: 200 },
      );
    }
    if (String(url).endsWith("/username")) {
      return new Response(
        JSON.stringify({
          error: "占用",
          kind: "username_taken",
          field: "username",
        }),
        { status: 409 },
      );
    }
    throw new TypeError("fetch failed");
  });

  const info = await api.lookup("ABCDEFGHJKLMNPQR");
  expect(info.domains[0]).toBe("abnormal.bid");
  expect(calls[0]!.url).toBe("/api/onboard/cdk");
  expect(calls[0]!.init.method).toBe("POST");
  expect(calls[0]!.init.mode).toBe("same-origin");
  expect(calls[0]!.init.credentials).toBe("omit");
  expect(new Headers(calls[0]!.init.headers).get("Accept-Language")).toBe(null);
  expect(JSON.parse(String(calls[0]!.init.body)).code).toBe("ABCDEFGHJKLMNPQR");

  await expect(
    api.checkUsername({
      code: "ABCDEFGHJKLMNPQR",
      domain: "abnormal.bid",
      username: "admin",
    }),
  ).rejects.toSatisfy(
    (error: unknown) => error instanceof ApiError && error.kind === "username_taken" && error.field === "username",
  );
  await expect(
    api.redeem({
      code: "ABCDEFGHJKLMNPQR",
      domain: "abnormal.bid",
      mailboxes: [{ username: "k", password: "Aa1aaaaa" }],
      notify: "me@example.com",
      lang: "en",
    }),
  ).rejects.toThrow(NetworkError);
  const redeemBody = JSON.parse(String(calls[2]!.init.body));
  expect(redeemBody.notify, "the notification address is sent to the server as is").toBe("me@example.com");
  expect(redeemBody.lang).toBe("en");
});

test("client: the explicit page language goes with every redeem request, abort signal and body are kept", async () => {
  for (const lang of ["zh", "en"] as const) {
    const signal = new AbortController().signal;
    const calls: { url: string; init: RequestInit }[] = [];
    const api = createApi(
      "",
      async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        if (String(url).endsWith("/cdk")) {
          return Response.json({ domains: ["abnormal.bid"], expiresAt: null, usesLeft: 1 });
        }
        if (String(url).endsWith("/redeem")) {
          return Response.json({
            domain: "abnormal.bid",
            mailboxes: [
              {
                ok: true,
                username: "alice",
                email: "alice@abnormal.bid",
                password: "a-password",
              },
            ],
          });
        }
        return Response.json({ available: true });
      },
      lang,
    );
    const input = {
      code: "test-code",
      domain: "abnormal.bid",
      mailboxes: [{ username: "alice", password: "a-password" }],
      notify: "me@example.com",
      lang,
    };
    await api.lookup(input.code, signal);
    await api.checkUsername({ ...input, username: "alice" }, signal);
    await api.redeem(input, signal);

    expect(calls.length).toBe(3);
    for (const { init } of calls) {
      expect(new Headers(init.headers).get("Accept-Language")).toBe(lang);
      expect(init.signal).toBe(signal);
      expect(init.credentials).toBe("omit");
    }
    expect(JSON.parse(String(calls[2]!.init.body))).toStrictEqual(input);
  }
});

test("redeem code capabilities: only the boolean quota flag of the optional domains is kept", () => {
  const info = readCdkInfo({
    domains: ["abnormal.bid", "legacy.example"],
    expiresAt: null,
    usesLeft: 1,
    quotaSupportedByDomain: {
      "abnormal.bid": false,
      "legacy.example": true,
      "outside.example": false,
    },
  });
  expect(info.quotaSupportedByDomain).toStrictEqual({
    "abnormal.bid": false,
    "legacy.example": true,
  });
});
