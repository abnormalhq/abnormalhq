import { readFileSync } from "node:fs";
import { expect, test, vi } from "vitest";
import { storefrontApi as worker, type StorefrontEnv } from "@/storefront/worker/index";
import {
  BUYER_COOKIE,
  BUYER_TOKEN,
  COOKIE_MAX_AGE,
  CUSTOMER_COOKIE,
  CUSTOMER_MAX_AGE,
  CUSTOMER_TOKEN,
  GOOGLE_COOKIE,
  GOOGLE_COOKIE_PATH,
  GOOGLE_MAX_AGE,
  GOOGLE_TOKEN,
  ORDER_ID,
  ORDER_PAGE,
  paymentLocation,
  SHOP_ROUTES,
} from "@/storefront/worker/shop";

/** docs/onboard-contract.json: the values mail and this Worker must agree on (mail keeps an identical copy). */
const contract = JSON.parse(readFileSync("docs/onboard-contract.json", "utf8")) as {
  redeem: {
    routes: string[];
    errorKinds: Record<string, { status: number; field: string | null }>;
    storefrontOrigins: string[];
    originForbiddenStatus: number;
  };
  shop: {
    routes: Record<string, "GET" | "POST">;
    // Version 3: the routes mail added after the first list, each in a list of its own. A route that answers two methods
    // lists both (shop.trials.routes).
    seats: { routes: Record<string, "GET" | "POST"> };
    buyerDomains: { routes: Record<string, "GET" | "POST"> };
    trials: { routes: Record<string, ("GET" | "POST")[]> };
    cookies: Record<"buyer" | "customer", { name: string; pattern: string; maxAgeSeconds: number }> & {
      google: { name: string; pattern: string; maxAgeSeconds: number; path: string };
    };
    orderIdPattern: string;
    orderPages: Record<"zh" | "en", string>;
    payRedirects: string[];
  };
  turnstile: { siteKeyField: string; siteKeyRoutes: string[]; tokenField: string; actions: Record<string, string> };
};

const siteOrigin = "https://abnormalhq.com";
const mailOrigin = "https://console.abnormalhq.com";
type FetchHandler = (request: Request) => Promise<Response>;

function bindings(
  mail: FetchHandler = async () => {
    expect.unreachable("mailhq must not be called");
  },
): StorefrontEnv {
  return {
    MAIL: { fetch: mail },
    MAIL_ORIGIN: mailOrigin,
  };
}

function post(path: string, headers: HeadersInit = {}): Request {
  return new Request(`${siteOrigin}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: '{"code":"test-code"}',
  });
}

async function errorBody(response: Response) {
  const body = (await response.json()) as { error: string; kind: string };
  expect(body).toMatchObject({ error: expect.any(String) });
  expect(body).toHaveProperty("kind");
  return body;
}

test("Worker: forwards only the three redeem endpoints to mailhq, normalises the trailing slash and drops the query string", async () => {
  for (const route of ["cdk", "username", "redeem"]) {
    for (const suffix of ["", "/"]) {
      let calls = 0;
      const response = await worker.fetch(
        post(`/api/onboard/${route}${suffix}?code=private-code`),
        bindings(async (request) => {
          calls += 1;
          const url = new URL(request.url);
          expect(url.origin).toBe(mailOrigin);
          expect(url.origin).not.toBe(siteOrigin);
          expect(url.pathname).toBe(`/api/onboard/${route}`);
          expect(url.search).toBe("");
          expect(request.method).toBe("POST");
          expect(request.redirect).toBe("manual");
          return Response.json({ ok: true });
        }),
      );
      expect(calls).toBe(1);
      expect(response.status).toBe(200);
    }
  }
});

test("Worker: keeps the raw JSON body, page language, Origin and real IP, forwards no cookies or identity headers to mailhq", async () => {
  const body = "private-password { 这不是可解析的 JSON";
  const allowedHeaders = {
    accept: "application/json",
    "accept-language": "en",
    "content-type": "application/json; charset=UTF-8",
    origin: siteOrigin,
    "cf-connecting-ip": "203.0.113.7",
    "cf-ray": "test-ray",
  };
  const request = new Request(`${siteOrigin}/api/onboard/redeem`, {
    method: "POST",
    headers: {
      ...allowedHeaders,
      cookie: "session=private-cookie",
      authorization: "Bearer private-token",
      forwarded: "for=198.51.100.2",
      "x-forwarded-for": "198.51.100.3",
      "x-forwarded-host": "untrusted.example",
      "x-real-ip": "198.51.100.4",
      "x-private-header": "private-value",
    },
    body,
  });
  const response = await worker.fetch(
    request,
    bindings(async (forwarded) => {
      expect(new URL(forwarded.url).origin).toBe(mailOrigin);
      expect(Object.fromEntries(forwarded.headers)).toStrictEqual(allowedHeaders);
      expect(await forwarded.text()).toBe(body);
      return Response.json({ ok: true });
    }),
  );
  expect(response.status).toBe(200);
});

test("Worker: non-JSON upstream responses become unavailable, without leaking sensitive bodies or retrying", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  for (const [status, contentType] of [
    [200, "text/html; charset=utf-8"],
    [500, "text/html"],
    [503, "text/plain; charset=utf-8"],
    [503, "application/jsonp"],
  ] as const) {
    let calls = 0;
    const response = await worker.fetch(
      post("/api/onboard/redeem?password=private-password"),
      bindings(async () => {
        calls += 1;
        return new Response("internal failure: private-password private-token", {
          status,
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=86400",
            "Set-Cookie": "session=private-cookie",
          },
        });
      }),
    );
    expect(calls).toBe(1);
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Set-Cookie")).toBe(null);
    expect(response.headers.get("Content-Type") ?? "").toMatch(/application\/json/);
    const result = await errorBody(response);
    expect(result.kind).toBe("unavailable");
    expect(JSON.stringify(result)).not.toMatch(/private-|internal failure/);
  }
  expect(log).toHaveBeenCalledTimes(4);
  for (const call of log.mock.calls) {
    expect(call).toStrictEqual([{ event: "mail_invalid_response", path: "/api/onboard/redeem" }]);
  }
});

test("Worker: rejects cross-site Origin, non-JSON and non-POST, requests never reach mailhq", async () => {
  for (const origin of ["https://other.example", "null"]) {
    const response = await worker.fetch(post("/api/onboard/cdk", { Origin: origin }), bindings());
    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  }
  for (const contentType of ["text/plain", "application/jsonp", ""]) {
    const response = await worker.fetch(post("/api/onboard/cdk", { "Content-Type": contentType }), bindings());
    expect(response.status).toBe(415);
  }
  for (const method of ["GET", "PUT", "OPTIONS"]) {
    const response = await worker.fetch(new Request(`${siteOrigin}/api/onboard/cdk`, { method }), bindings());
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
  }
});

test("Worker: other API paths return a JSON 404", async () => {
  for (const path of [
    "/api",
    "/api/",
    "/api/onboard",
    "/api/onboard/unknown",
    "/api/onboard/cdk/extra",
    "/api/admin",
  ]) {
    const response = await worker.fetch(post(path), bindings());
    expect(response.status, path).toBe(404);
    expect(response.headers.get("Content-Type") ?? "").toMatch(/application\/json/);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await errorBody(response);
  }
});

test("Worker: passes upstream success, business error and rate-limit responses through, returning only Content-Type and Retry-After, no caching or cookies", async () => {
  for (const status of [200, 201, 400, 429, 503]) {
    const body = `upstream body ${status}`;
    const response = await worker.fetch(
      post("/api/onboard/redeem"),
      bindings(
        async () =>
          new Response(body, {
            status,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Cache-Control": "public, max-age=86400",
              "Retry-After": "30",
              "Set-Cookie": "session=private; Secure",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": "true",
              "Access-Control-Allow-Headers": "Content-Type",
              "Access-Control-Allow-Methods": "POST, OPTIONS",
              "Access-Control-Expose-Headers": "Retry-After",
              "Access-Control-Max-Age": "86400",
              // Headers added by mail's OpenNext and Next.js must not appear on the public site.
              "Content-Security-Policy": "default-src 'self' https://console.abnormalhq.com",
              Link: "</_next/static/app.css>; rel=preload",
              "Server-Timing": "db;dur=12",
              "X-OpenNext": "1",
              "X-Nextjs-Cache": "MISS",
              "X-Powered-By": "Next.js",
            },
          }),
      ),
    );
    expect(response.status).toBe(status);
    expect(await response.text()).toBe(body);
    expect(response.headers.get("Retry-After")).toBe("30");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Set-Cookie")).toBe(null);
    expect([...response.headers.keys()].sort()).toStrictEqual(["cache-control", "content-type", "retry-after"]);
  }
});

test("Worker: redeem endpoints answer errors in the page language; a misconfigured MAIL_ORIGIN gives a JSON 503 instead of throwing", async () => {
  const english = { "Accept-Language": "en" };
  const notFound = await worker.fetch(post("/api/onboard/unknown", english), bindings());
  expect((await errorBody(notFound)).error).toBe("Endpoint not found.");
  const wrongType = await worker.fetch(
    post("/api/onboard/cdk", { ...english, "Content-Type": "text/plain" }),
    bindings(),
  );
  expect((await errorBody(wrongType)).error).toBe("Requests must use application/json.");
  const crossSite = await worker.fetch(
    post("/api/onboard/cdk", { ...english, Origin: "https://x.example" }),
    bindings(),
  );
  expect((await errorBody(crossSite)).error).toBe("Origin is not allowed.");
  const zh = await worker.fetch(post("/api/onboard/unknown", { "Accept-Language": "zh" }), bindings());
  expect((await errorBody(zh)).error).toBe("接口不存在。");

  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const env = { ...bindings(), MAIL_ORIGIN: "not a url" } as unknown as StorefrontEnv;
  const redeem = await worker.fetch(post("/api/onboard/redeem", english), env);
  expect(redeem.status).toBe(503);
  expect(await errorBody(redeem)).toStrictEqual({
    error: "The mail service is temporarily unavailable. Please try again shortly.",
    kind: "unavailable",
  });
  const shop = await worker.fetch(new Request(`${siteOrigin}/api/shop/catalog`), env);
  expect(shop.status).toBe(503);
  expect(log.mock.calls).toStrictEqual([
    [{ event: "mail_unavailable", path: "/api/onboard/redeem" }],
    [{ event: "mail_shop_unavailable", route: "catalog" }],
  ]);
});

test("Worker: does not follow mailhq redirects, and writes neither internal exceptions nor sensitive request content to the log", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  for (const status of [301, 302, 307, 308]) {
    let calls = 0;
    const response = await worker.fetch(
      post("/api/onboard/cdk?code=private-code"),
      bindings(async (request) => {
        calls += 1;
        expect(request.redirect).toBe("manual");
        return new Response(null, {
          status,
          headers: { Location: "https://untrusted.example/private-location" },
        });
      }),
    );
    expect(calls).toBe(1);
    expect(response.status).toBe(503);
    expect(response.headers.get("Location")).toBe(null);
    expect((await errorBody(response)).kind).toBe("unavailable");
  }

  const response = await worker.fetch(
    post("/api/onboard/redeem?password=private-password"),
    bindings(async () => {
      throw new Error("internal failure: private-token private-password");
    }),
  );
  expect(response.status).toBe(503);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  const result = await errorBody(response);
  expect(result.kind).toBe("unavailable");
  expect(JSON.stringify(result)).not.toMatch(/private-|internal failure/);
  expect(log).toHaveBeenCalled();
  const logged = JSON.stringify(log.mock.calls);
  expect(logged).toMatch(/\/api\/onboard\/redeem/);
  expect(logged).not.toMatch(/private-|internal failure/);
});

const buyerToken = "a1".repeat(32);

function shopRequest(route: string, init: RequestInit = {}, origin = siteOrigin): Request {
  const mutation = ["checkout", "reconcile", "pay"].includes(route.split("?")[0].replace(/\/$/, ""));
  return new Request(`${origin}/api/shop/${route}`, {
    ...(mutation
      ? {
          method: "POST",
          body: route.startsWith("pay") ? "orderId=test-order" : '{"productId":"test-product"}',
          headers: {
            Origin: origin,
            "Content-Type": route.startsWith("pay") ? "application/x-www-form-urlencoded" : "application/json",
          },
        }
      : {}),
    ...init,
  });
}

function expectShopHeaders(response: Response) {
  expect(response.headers.get("Cache-Control") ?? "").toMatch(/no-store/);
  expect(response.headers.get("Referrer-Policy")).toBe("same-origin");
}

test("shop proxy: English pages get English errors, notify always returns plain fail", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const englishHeaders = { "Accept-Language": "en" };
  const cases = [
    [shopRequest("unknown", { headers: englishHeaders }), 404, "Endpoint not found."],
    [shopRequest("catalog", { method: "POST", headers: englishHeaders }), 405, "Only GET is accepted."],
    [
      shopRequest("checkout", {
        headers: { ...englishHeaders, "Content-Type": "application/json" },
      }),
      403,
      "Origin is not allowed.",
    ],
    [
      shopRequest("checkout", {
        headers: {
          ...englishHeaders,
          Origin: siteOrigin,
          "Content-Type": "text/plain",
        },
      }),
      415,
      "Requests must use application/json.",
    ],
    [
      shopRequest("catalog", { headers: englishHeaders }),
      503,
      "The mail service is temporarily unavailable. Please try again shortly.",
    ],
  ] as const;
  for (const [request, status, error] of cases) {
    const response = await worker.fetch(
      request,
      bindings(async () => new Response("upstream HTML")),
    );
    expect(response.status).toBe(status);
    expect(await response.json()).toStrictEqual({ error });
    expectShopHeaders(response);
  }
  const notify = await worker.fetch(shopRequest("notify", { method: "POST", headers: englishHeaders }), bindings());
  expect(notify.status).toBe(405);
  expect(await notify.text()).toBe("fail");
  expect(notify.headers.get("content-type") ?? "").toMatch(/^text\/plain/);
});

test("shop proxy: allowlisted routes, methods and request formats; browser writes with cross-site or missing Origin are refused", async () => {
  // pay is a full-page form submit: when refused it also never reaches mail, but goes back to the order page instead of stopping on a page of JSON.
  const refused = (route: string) => (route === "pay" ? 303 : null);
  for (const route of ["checkout", "reconcile", "pay"]) {
    for (const origin of [undefined, "null", "https://attacker.example", `${siteOrigin}.attacker.example`]) {
      const headers = new Headers({
        "Content-Type": route === "pay" ? "application/x-www-form-urlencoded" : "application/json",
        "X-Forwarded-Host": new URL(siteOrigin).host,
      });
      if (origin !== undefined) headers.set("Origin", origin);
      const response = await worker.fetch(shopRequest(route, { headers }), bindings());
      expect(response.status).toBe(refused(route) ?? 403);
      if (route === "pay") expect(response.headers.get("Location")).toBe(`${siteOrigin}/zh/shop/orders/?error=payment`);
      expectShopHeaders(response);
    }
    for (const contentType of ["", "text/plain", "application/jsonp", "application/x-www-form-urlencoded-malicious"]) {
      const response = await worker.fetch(
        shopRequest(route, {
          headers: { Origin: siteOrigin, "Content-Type": contentType },
        }),
        bindings(),
      );
      expect(response.status).toBe(refused(route) ?? 415);
      if (route === "pay") expect(response.headers.get("Location")).toBe(`${siteOrigin}/zh/shop/orders/?error=payment`);
      expectShopHeaders(response);
    }
    const response = await worker.fetch(new Request(`${siteOrigin}/api/shop/${route}`), bindings());
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
  }
  for (const route of ["catalog", "orders", "notify"]) {
    for (const method of ["POST", "PUT", "OPTIONS", "HEAD"]) {
      const response = await worker.fetch(shopRequest(route, { method }), bindings());
      expect(response.status).toBe(405);
      expect(response.headers.get("Allow")).toBe("GET");
      expectShopHeaders(response);
    }
  }
  for (const path of [
    "/api/shop",
    "/api/shop/",
    "/api/shop/settings",
    "/api/shop/catalog/extra",
    "/api/shop/../admin",
  ]) {
    const response = await worker.fetch(new Request(`${siteOrigin}${path}`), bindings());
    expect(response.status).toBe(404);
  }
});

test("shop proxy: uses MAIL's own address, keeps the real browser Origin and body, strips the query and admin credentials", async () => {
  for (const route of ["checkout", "reconcile", "pay"]) {
    const type = route === "pay" ? "application/x-www-form-urlencoded" : "application/json";
    const body = "private body passed verbatim without JSON parsing";
    const request = shopRequest(`${route}/?secret=private-query`, {
      method: "POST",
      body,
      headers: {
        Origin: siteOrigin,
        "Content-Type": `${type}; charset=UTF-8`,
        Accept: "application/json",
        "Accept-Language": "en",
        "CF-Connecting-IP": "203.0.113.17",
        "CF-Ray": "test-ray",
        Cookie: `admin_session=private-admin; mailhq_shop=${buyerToken}; session=private-session`,
        Authorization: "Bearer private-token",
        Forwarded: "host=attacker.example",
        "X-Forwarded-Host": "attacker.example",
        "X-Forwarded-For": "198.51.100.1",
        "X-Real-IP": "198.51.100.2",
        Host: "attacker.example",
      },
    });
    let calls = 0;
    const response = await worker.fetch(
      request,
      bindings(async (upstream) => {
        calls += 1;
        expect(upstream.url).toBe(`${mailOrigin}/api/shop/${route}`);
        expect(upstream.redirect).toBe("manual");
        expect(await upstream.text()).toBe(body);
        expect(Object.fromEntries(upstream.headers)).toStrictEqual({
          accept: "application/json",
          "accept-language": "en",
          "cf-connecting-ip": "203.0.113.17",
          "cf-ray": "test-ray",
          "content-type": `${type}; charset=UTF-8`,
          cookie: `mailhq_shop=${buyerToken}`,
          origin: siteOrigin,
        });
        return route === "pay"
          ? new Response(null, { status: 303, headers: { Location: "https://credit.linux.do/paying?trade_no=1" } })
          : Response.json({ ok: true });
      }),
    );
    expect(calls).toBe(1);
    expect(response.status).toBe(route === "pay" ? 303 : 200);
    expectShopHeaders(response);
  }
});

test("shop proxy: forwards only a single valid lower-case hex buyer cookie", async () => {
  for (const cookie of [
    "session=private",
    `mailhq_shop=${buyerToken.toUpperCase()}`,
    "mailhq_shop=short",
    `mailhq_shop=${buyerToken}; mailhq_shop=${buyerToken}`,
    `mailhq_shop=invalid; mailhq_shop=${buyerToken}`,
    `mailhq_shop="${buyerToken}"`,
    `other_mailhq_shop=${buyerToken}`,
    `mailhq_shop=${buyerToken}%0a`,
  ]) {
    const response = await worker.fetch(
      shopRequest("orders?id=order", { headers: { Cookie: cookie } }),
      bindings(async (upstream) => {
        expect(upstream.headers.get("cookie")).toBe(null);
        return Response.json({ error: "Not found" }, { status: 404 });
      }),
    );
    expect(response.status).toBe(404);
  }
});

test("shop proxy: public catalog requests drop arbitrary parameters, orders carry only id, the notify signature query keeps its original order and encoding", async () => {
  const notificationQuery = "?name=hello%20world&sign=a%2Fb%2Bc&money=20.00&empty=&name=second+value";
  for (const [route, expectedQuery] of [
    ["catalog/?admin=1&secret=private", ""],
    ["orders/?id=order123&secret=private&admin=1", "?id=order123"],
    [`notify/${notificationQuery}`, notificationQuery],
  ]) {
    const response = await worker.fetch(
      shopRequest(route, {
        headers: {
          Cookie: `mailhq_shop=${buyerToken}`,
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        },
      }),
      bindings(async (upstream) => {
        const upstreamUrl = new URL(upstream.url);
        expect(upstreamUrl.origin).toBe(mailOrigin);
        expect(upstreamUrl.search).toBe(expectedQuery);
        expect(upstreamUrl.pathname.endsWith("/")).toBe(false);
        expect(upstream.method).toBe("GET");
        expect(upstream.headers.get("accept-language")).toBe("zh-CN,zh;q=0.9,en;q=0.8");
        if (route.startsWith("notify")) {
          expect(upstream.headers.get("origin")).toBe(null);
          expect(upstream.headers.get("cookie")).toBe(null);
          return new Response("success", {
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
        return Response.json({ ok: true });
      }),
    );
    expect(response.status).toBe(200);
    expectShopHeaders(response);
  }
});

test("shop proxy: checkout only rebuilds the buyer cookie, clearing upstream Domain, Path, admin cookies and CORS", async () => {
  for (const origin of [siteOrigin, "http://localhost:4321"]) {
    const upstreamHeaders = new Headers({
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=86400",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": "true",
      "X-Middleware-Set-Cookie": "admin=private",
    });
    upstreamHeaders.append("Set-Cookie", "session=private-admin; HttpOnly; Path=/");
    upstreamHeaders.append(
      "Set-Cookie",
      `mailhq_shop=${buyerToken}; Domain=.abnormalhq.com; Path=/admin; SameSite=None; Max-Age=2147483647`,
    );
    const response = await worker.fetch(
      shopRequest("checkout", {}, origin),
      bindings(
        async () =>
          new Response('{"orderId":"order123"}', {
            status: 201,
            headers: upstreamHeaders,
          }),
      ),
    );
    expect(response.status).toBe(201);
    expect(response.headers.getSetCookie()).toStrictEqual([
      `mailhq_shop=${buyerToken}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${origin.startsWith("https:") ? "; Secure" : ""}`,
    ]);
    expectShopHeaders(response);
    expect(
      [...response.headers.keys()].some(
        (name) => name.startsWith("access-control-") || name.startsWith("x-middleware-"),
      ),
    ).toBe(false);
  }
});

test("shop proxy: checkout rejects invalid or duplicate upstream cookies; a failed checkout and other endpoints set no cookie", async () => {
  for (const values of [
    [`mailhq_shop=${buyerToken.toUpperCase()}`],
    ["mailhq_shop=short"],
    [`mailhq_shop=${buyerToken}`, `mailhq_shop=${buyerToken}`],
    [`mailhq_shop=${buyerToken}; Path=/`, "mailhq_shop=invalid"],
    [`session=private, mailhq_shop=${buyerToken}`],
  ]) {
    const headers = new Headers({ "Content-Type": "application/json" });
    for (const value of values) headers.append("Set-Cookie", value);
    const response = await worker.fetch(
      shopRequest("checkout"),
      bindings(async () => new Response("{}", { headers })),
    );
    expect(response.headers.get("set-cookie")).toBe(null);
  }
  for (const [route, status] of [
    ["catalog", 200],
    ["orders", 200],
    ["reconcile", 200],
    ["pay", 303],
    ["notify", 200],
    ["checkout", 400],
  ] as const) {
    const response = await worker.fetch(
      shopRequest(route),
      bindings(
        async () =>
          new Response(route === "notify" ? "success" : "{}", {
            // A JSON business error (400) from pay is turned by the proxy into a 303 back to the order page.
            status: route === "pay" ? 400 : status,
            headers: {
              "Content-Type": route === "notify" ? "text/plain" : "application/json",
              "Set-Cookie": `mailhq_shop=${buyerToken}; Path=/`,
            },
          }),
      ),
    );
    expect(response.status).toBe(status);
    expect(response.headers.get("set-cookie")).toBe(null);
  }
});

/** A Checkout Session URL in the shape Stripe returns: the page state is in the fragment and Checkout needs it. */
const stripeCheckoutUrl =
  "https://checkout.stripe.com/c/pay/cs_test_a1B2c3D4e5F6g7H8i9J0kLmNoPqRsTuVwXyZ0123456789abcdefGHIJ" +
  "#fidkdWxOYHwnPyd1blpxYHZxWjA0T2BqVFVNfEtTbTJrMG9nRGJMQHdmdz1EQGJxVV9iYHE2aWNRYXJ%2FN0N0UzZHZnEnKSdjd2poVmB3c2B3Jz9xd3BgKSdpZHxqcHFRfHVgJz8ndmxrYmlgWmxxYGgnKSdga2RnaWBVaWRmYG1qaWFgd3YnP3F3cGB4JSUl";

test("shop proxy: only a pay 303 may redirect to Credit payment, Stripe Checkout or this site's order page", async () => {
  for (const location of [
    "https://credit.linux.do/paying?trade_no=123",
    stripeCheckoutUrl,
    "https://checkout.stripe.com/c/pay/cs_live_a1",
    // Compatibility fixtures, not documented Stripe examples: accept API-provided paths without guessing their shape.
    "https://checkout.stripe.com/pay/cs_test_a1?locale=en#fid=abc",
    "https://checkout.stripe.com/h/pay/cs_test_a1?locale=zh#fid=abc",
    "https://checkout.stripe.com/elsewhere",
    "https://checkout.stripe.com/elsewhere#fid=abc",
    "/shop/orders?id=123&error=payment",
    "/shop/orders/?id=123",
    "/zh/shop/orders/?id=123",
    "/zh/shop/orders?id=123&error=payment",
    `${siteOrigin}/shop/orders?id=123`,
    "/en/shop/orders/?id=123",
    "/en/shop/orders?id=123&error=payment",
  ]) {
    const response = await worker.fetch(
      shopRequest("pay"),
      bindings(
        async () =>
          new Response("private redirect body", {
            status: 303,
            headers: {
              Location: location,
              "Set-Cookie": `mailhq_shop=${buyerToken}`,
              "Cache-Control": "public",
            },
          }),
      ),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe(new URL(location, siteOrigin).href);
    expect(await response.text()).toBe("");
    expect(response.headers.get("Set-Cookie")).toBe(null);
    expectShopHeaders(response);
  }
  // Checkout does not open without the fragment: it must reach the browser untouched.
  const stripe = await worker.fetch(
    shopRequest("pay"),
    bindings(async () => new Response(null, { status: 303, headers: { Location: stripeCheckoutUrl } })),
  );
  expect(stripe.headers.get("Location")).toBe(stripeCheckoutUrl);
  expect(new URL(stripe.headers.get("Location")!).hash).toBe(new URL(stripeCheckoutUrl).hash);
});

test("shop proxy: refuses payment redirects to external sites, the admin, forged Credit domains and URLs with credentials, returning to the order page", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  for (const location of [
    "https://attacker.example/shop/orders?id=123",
    `${mailOrigin}/shop/orders?id=123`,
    "https://credit.linux.do.attacker.example/paying",
    "http://credit.linux.do/paying",
    "https://credit.linux.do/paying/evil",
    "https://credit.linux.do@attacker.example/paying",
    "https://user:password@credit.linux.do/paying",
    "https://checkout.stripe.com.attacker.example/c/pay/cs_test_1",
    "https://checkout.stripe.com@attacker.example/pay/cs_test_1",
    "https://checkout.stripe.com:444/pay/cs_test_1",
    "https://user:password@checkout.stripe.com/c/pay/cs_test_1#fid=abc",
    "https://user@checkout.stripe.com/pay/cs_test_1",
    "https://:password@checkout.stripe.com/pay/cs_test_1",
    "http://checkout.stripe.com/c/pay/cs_test_1",
    `${siteOrigin}/sales`,
    "/shop/orders/evil?id=123",
    "/shop/orders?id=123#private",
    "/en/shop/orders?id=123#private",
    "/fr/shop/orders?id=123",
    "/en/shop/orders/evil?id=123",
    "/zh/shop/orders/evil?id=123",
    "/zh/en/shop/orders/?id=123",
    "https://credit.linux.do/paying?trade_no=1#private",
    "javascript:alert(1)",
    "https://[invalid",
    "",
  ]) {
    const response = await worker.fetch(
      shopRequest("pay", { body: "orderId=abcdefghijklmno" }),
      bindings(async () => new Response(null, { status: 303, headers: { Location: location } })),
    );
    expect(response.status, location).toBe(303);
    expect(response.headers.get("Location"), location).toBe(
      `${siteOrigin}/zh/shop/orders/?id=abcdefghijklmno&error=payment`,
    );
    expectShopHeaders(response);
  }
  // Only the origin of the refused destination is logged, not the path or query (which may hold a payment session or transaction id).
  expect(log).toHaveBeenCalledWith({
    event: "mail_shop_unexpected_redirect",
    route: "pay",
    status: 303,
    target: "https://attacker.example",
  });
  expect(log).toHaveBeenCalledWith({
    event: "mail_shop_unexpected_redirect",
    route: "pay",
    status: 303,
    target: "https://checkout.stripe.com",
  });
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/cs_test|trade_no|abcdefghijklmno|private/);
  for (const [route, status] of [
    ["checkout", 303],
    ["catalog", 303],
    ["orders", 303],
    ["notify", 303],
    ["pay", 302],
    ["pay", 307],
    ["pay", 308],
  ] as const) {
    const response = await worker.fetch(
      shopRequest(route),
      bindings(
        async () =>
          new Response(null, {
            status,
            headers: { Location: "https://credit.linux.do/paying?order=123" },
          }),
      ),
    );
    if (route === "pay") {
      expect(response.status).toBe(303);
      expect(response.headers.get("Location")).toBe(`${siteOrigin}/zh/shop/orders/?error=payment`);
    } else {
      expect(response.status).toBe(503);
      expect(response.headers.get("Location")).toBe(null);
    }
    expectShopHeaders(response);
  }
});

test("shop proxy: any pay failure returns to the order page in the form's language with the payment error", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const id = "abcdefghijklmno";
  const pay = (body: string, headers: Record<string, string> = {}) =>
    shopRequest("pay", {
      body,
      headers: { Origin: siteOrigin, "Content-Type": "application/x-www-form-urlencoded", ...headers },
    });
  const upstreams: [string, () => Promise<Response>][] = [
    ["mail JSON error", async () => Response.json({ error: "订单号无效。" }, { status: 400 })],
    ["mail 503", async () => Response.json({ error: "unavailable" }, { status: 503 })],
    ["HTML", async () => new Response("<h1>error</h1>", { status: 500, headers: { "Content-Type": "text/html" } })],
    ["JSON 200", async () => Response.json({ ok: true })],
    [
      "network",
      async () => {
        throw new Error("private failure");
      },
    ],
  ];
  for (const [name, upstream] of upstreams) {
    for (const [body, headers, expected] of [
      [`orderId=${id}`, {}, `${siteOrigin}/zh/shop/orders/?id=${id}&error=payment`],
      [`orderId=${id}&lang=en`, {}, `${siteOrigin}/shop/orders/?id=${id}&error=payment`],
      [`orderId=${id}&lang=zh`, { "Accept-Language": "en" }, `${siteOrigin}/zh/shop/orders/?id=${id}&error=payment`],
      [`orderId=${id}`, { "Accept-Language": "en-US,en;q=0.9" }, `${siteOrigin}/shop/orders/?id=${id}&error=payment`],
      ["orderId=NOT-AN-ORDER&lang=en", {}, `${siteOrigin}/shop/orders/?error=payment`],
      [`orderId=${id}&orderId=${id}`, {}, `${siteOrigin}/zh/shop/orders/?error=payment`],
      ["", {}, `${siteOrigin}/zh/shop/orders/?error=payment`],
    ] as const) {
      const response = await worker.fetch(pay(body, headers), bindings(upstream));
      expect(response.status, `${name}: ${body}`).toBe(303);
      expect(response.headers.get("Location"), `${name}: ${body}`).toBe(expected);
      expect(await response.text()).toBe("");
      expectShopHeaders(response);
    }
  }
  // An oversized body is neither read to the end nor forwarded, and also returns to the order page.
  const large = await worker.fetch(pay(`orderId=${id}&pad=${"x".repeat(5000)}`), bindings());
  expect([large.status, large.headers.get("Location")]).toEqual([303, `${siteOrigin}/zh/shop/orders/?error=payment`]);
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/private failure/);
  // The form fields only pick which page to return to: the body forwarded to mail is still the browser's original.
  const forwarded: string[] = [];
  await worker.fetch(
    pay(`orderId=${id}&lang=en`),
    bindings(async (request) => {
      forwarded.push(await request.text());
      return new Response(null, { status: 303, headers: { Location: `/en/shop/orders/?id=${id}` } });
    }),
  );
  expect(forwarded).toStrictEqual([`orderId=${id}&lang=en`]);
});

test("shop proxy: rejects HTML or wrong content types, keeps JSON business errors and rate limits, never caches any response", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  for (const [route, contentType] of [
    ["catalog", "text/html"],
    ["checkout", "application/jsonp"],
    ["pay", "text/html; charset=utf-8"],
    ["notify", "application/json"],
  ]) {
    let calls = 0;
    const response = await worker.fetch(
      shopRequest(route),
      bindings(async () => {
        calls += 1;
        return new Response("private-key internal details", {
          status: 500,
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public",
            "Set-Cookie": "session=private",
          },
        });
      }),
    );
    expect(calls).toBe(1);
    // pay is a full-page form: back to the order page; other endpoints answer 503.
    expect(response.status).toBe(route === "pay" ? 303 : 503);
    expect(await response.text()).not.toMatch(/private|internal/);
    expect(response.headers.get("Set-Cookie")).toBe(null);
    expectShopHeaders(response);
  }
  expect(log.mock.calls.map(([entry]) => entry)).toStrictEqual(
    ["catalog", "checkout", "pay", "notify"].map((route) => ({
      event: "mail_shop_invalid_response",
      route,
      status: 500,
    })),
  );
  for (const status of [200, 201, 400, 404, 409, 429, 503]) {
    const body = JSON.stringify({ error: `business error ${status}` });
    const response = await worker.fetch(
      shopRequest("reconcile"),
      bindings(
        async () =>
          new Response(body, {
            status,
            headers: {
              "Content-Type": "application/json; charset=UTF-8",
              "Retry-After": "60",
              "Cache-Control": "public",
              Refresh: "0; url=https://attacker.example",
              ETag: "cached",
            },
          }),
      ),
    );
    expect(response.status).toBe(status);
    expect(await response.text()).toBe(body);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(response.headers.get("Refresh")).toBe(null);
    expect(response.headers.get("ETag")).toBe(null);
    expectShopHeaders(response);
  }
});

test("shop proxy: notify always answers with text, and network failures neither retry nor log parameters or exception content", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  for (const route of ["checkout?secret=private", "notify?sign=private&trade_no=private"]) {
    let calls = 0;
    const response = await worker.fetch(
      shopRequest(route),
      bindings(async () => {
        calls += 1;
        throw new Error("private-key internal-error");
      }),
    );
    expect(calls).toBe(1);
    expect(response.status).toBe(503);
    expectShopHeaders(response);
    if (route.startsWith("notify")) {
      expect(await response.text()).toBe("fail");
      expect(response.headers.get("content-type") ?? "").toMatch(/^text\/plain/);
    } else {
      expect(await response.text()).not.toMatch(/private|internal/);
    }
  }
  expect(log).toHaveBeenCalledTimes(2);
  expect(log.mock.calls).toStrictEqual([
    [{ event: "mail_shop_unavailable", route: "checkout" }],
    [{ event: "mail_shop_unavailable", route: "notify" }],
  ]);
});

test("shop proxy: the renewal endpoint only takes POST JSON, renew rebuilds the buyer cookie like checkout", async () => {
  const forwarded: string[] = [];
  const env = bindings(async (request: Request) => {
    forwarded.push(new URL(request.url).pathname);
    const headers = new Headers({ "Content-Type": "application/json" });
    headers.append("Set-Cookie", `mailhq_shop=${buyerToken}; Path=/admin`);
    return new Response('{"orderId":"order123"}', { status: 201, headers });
  });
  const post = (route: string) =>
    new Request(`${siteOrigin}/api/shop/${route}`, {
      method: "POST",
      body: '{"token":"t"}',
      headers: { Origin: siteOrigin, "Content-Type": "application/json" },
    });
  const renew = await worker.fetch(post("renew"), env);
  expect(renew.status).toBe(201);
  expect(renew.headers.getSetCookie()).toStrictEqual([
    `mailhq_shop=${buyerToken}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax; Secure`,
  ]);
  const lookup = await worker.fetch(post("renewal"), env);
  expect(lookup.status).toBe(201);
  expect(lookup.headers.getSetCookie()).toStrictEqual([]);
  expect(forwarded).toStrictEqual(["/api/shop/renew", "/api/shop/renewal"]);
  const get = await worker.fetch(new Request(`${siteOrigin}/api/shop/renewal`), env);
  expect(get.status).toBe(405);
  expect(get.headers.get("Allow")).toBe("POST");
});

test("shop proxy: account endpoints forward only the two shop cookies, rebuild the session cookie on login and clear it on logout", async () => {
  const session = "S".repeat(43);
  const seen: { path: string; cookie: string | null }[] = [];
  const env = bindings(async (request: Request) => {
    const path = new URL(request.url).pathname;
    seen.push({ path, cookie: request.headers.get("cookie") });
    const headers = new Headers({ "Content-Type": "application/json" });
    if (
      path.endsWith("/verify") ||
      path.endsWith("/peek") ||
      path.endsWith("/password-login") ||
      path.endsWith("/password") ||
      path.endsWith("/reset") ||
      path.endsWith("/forgot")
    )
      headers.append("Set-Cookie", `mailhq_customer=${session}; Path=/admin; Domain=.example`);
    return new Response("{}", { status: 200, headers });
  });
  const cookie = `admin_session=private; mailhq_shop=${buyerToken}; mailhq_customer=${session}`;
  const post = (route: string) =>
    new Request(`${siteOrigin}/api/shop/${route}`, {
      method: "POST",
      body: "{}",
      headers: { Origin: siteOrigin, "Content-Type": "application/json", Cookie: cookie },
    });

  const account = await worker.fetch(
    new Request(`${siteOrigin}/api/shop/account`, { headers: { Cookie: cookie } }),
    env,
  );
  expect(account.status).toBe(200);
  const verify = await worker.fetch(post("account/verify"), env);
  expect(verify.headers.getSetCookie()).toStrictEqual([
    `mailhq_customer=${session}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax; Secure`,
  ]);
  const logout = await worker.fetch(post("account/logout"), env);
  expect(logout.headers.getSetCookie()).toStrictEqual([
    "mailhq_customer=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure",
  ]);
  const login = await worker.fetch(post("account/login"), env);
  expect(login.headers.getSetCookie()).toStrictEqual([]);
  // peek only reads which mailbox a login link belongs to without changing the session: even a session cookie from upstream is not passed on.
  const peek = await worker.fetch(post("account/peek"), env);
  expect(peek.headers.getSetCookie()).toStrictEqual([]);
  // Password login also installs the session cookie; setting a password does not (mail only logs other browsers out, the current session stays).
  const passwordLogin = await worker.fetch(post("account/password-login"), env);
  expect(passwordLogin.headers.getSetCookie()).toStrictEqual([
    `mailhq_customer=${session}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax; Secure`,
  ]);
  const password = await worker.fetch(post("account/password"), env);
  expect(password.headers.getSetCookie()).toStrictEqual([]);
  // Setting a new password through a reset link logs in: the session cookie is installed too; requesting a reset (forgot) does not.
  const reset = await worker.fetch(post("account/reset"), env);
  expect(reset.headers.getSetCookie()).toStrictEqual([
    `mailhq_customer=${session}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax; Secure`,
  ]);
  const forgot = await worker.fetch(post("account/forgot"), env);
  expect(forgot.headers.getSetCookie()).toStrictEqual([]);

  expect(seen.map(({ path }) => path)).toStrictEqual([
    "/api/shop/account",
    "/api/shop/account/verify",
    "/api/shop/account/logout",
    "/api/shop/account/login",
    "/api/shop/account/peek",
    "/api/shop/account/password-login",
    "/api/shop/account/password",
    "/api/shop/account/reset",
    "/api/shop/account/forgot",
  ]);
  for (const { cookie: forwarded } of seen) {
    expect(forwarded).toBe(`mailhq_shop=${buyerToken}; mailhq_customer=${session}`);
  }
  const wrongMethod = await worker.fetch(new Request(`${siteOrigin}/api/shop/account`, { method: "POST" }), env);
  expect(wrongMethod.status).toBe(405);
  const peekGet = await worker.fetch(new Request(`${siteOrigin}/api/shop/account/peek`), env);
  expect(peekGet.status).toBe(405);
  const unknown = await worker.fetch(post("account/delete"), env);
  expect(unknown.status).toBe(404);
});

test("shop proxy: the Google login state cookie is set only at the start, sent only to account/google, and cleared once handed over", async () => {
  const session = "S".repeat(43);
  const state = `${"h".repeat(36)}.${"p".repeat(300)}.${"s".repeat(43)}`;
  const seen: { path: string; cookie: string | null }[] = [];
  let status = 200;
  const env = bindings(async (request: Request) => {
    const path = new URL(request.url).pathname;
    seen.push({ path, cookie: request.headers.get("cookie") });
    const headers = new Headers({ "Content-Type": "application/json" });
    if (path.endsWith("/google/start"))
      headers.append("Set-Cookie", `mailhq_shop_google=${state}; Path=/; Domain=.example; Max-Age=999999`);
    if (path.endsWith("/account/google")) {
      headers.append("Set-Cookie", "mailhq_shop_google=; Path=/api/shop/account/google; Max-Age=0");
      if (status === 200) headers.append("Set-Cookie", `mailhq_customer=${session}; Path=/admin`);
    }
    return new Response(status === 200 ? "{}" : '{"error":"no"}', { status, headers });
  });
  const post = (route: string, cookie: string) =>
    new Request(`${siteOrigin}/api/shop/${route}`, {
      method: "POST",
      body: "{}",
      headers: { Origin: siteOrigin, "Content-Type": "application/json", Cookie: cookie },
    });
  const base = `mailhq_shop=${buyerToken}`;
  const clear = "mailhq_shop_google=; Path=/api/shop/account/google; Max-Age=0; HttpOnly; SameSite=Lax; Secure";

  const start = await worker.fetch(post("account/google/start", base), env);
  expect(start.headers.getSetCookie()).toStrictEqual([
    `mailhq_shop_google=${state}; Path=/api/shop/account/google; Max-Age=600; HttpOnly; SameSite=Lax; Secure`,
  ]);
  // A state cookie of any other shape is not passed on.
  const malformed = await worker.fetch(
    post("account/google/start", base),
    bindings(
      async () =>
        new Response("{}", {
          headers: { "Content-Type": "application/json", "Set-Cookie": "mailhq_shop_google=not-a-token" },
        }),
    ),
  );
  expect([malformed.status, malformed.headers.getSetCookie()]).toStrictEqual([200, []]);

  const withState = `${base}; mailhq_shop_google=${state}`;
  const finish = await worker.fetch(post("account/google", withState), env);
  expect(finish.headers.getSetCookie()).toStrictEqual([
    `mailhq_customer=${session}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax; Secure`,
    clear,
  ]);
  // Refused: no session, and the state cookie is cleared all the same.
  status = 400;
  const refused = await worker.fetch(post("account/google", withState), env);
  expect([refused.status, refused.headers.getSetCookie()]).toStrictEqual([400, [clear]]);
  // When mail fails, redirects or answers something else, the Worker answers 503 itself, and still clears the state cookie.
  for (const upstream of [
    async () => {
      throw new Error("unreachable");
    },
    async () => new Response(null, { status: 302, headers: { Location: "https://elsewhere.example/" } }),
    async () => new Response("<html>", { headers: { "Content-Type": "text/html" } }),
  ]) {
    const failed = await worker.fetch(post("account/google", withState), bindings(upstream));
    expect([failed.status, failed.headers.getSetCookie()]).toStrictEqual([503, [clear]]);
  }
  // The state cookie goes to account/google only.
  status = 200;
  await worker.fetch(post("account/google/unlink", `${withState}; mailhq_customer=${session}`), env);

  expect(seen).toStrictEqual([
    { path: "/api/shop/account/google/start", cookie: base },
    { path: "/api/shop/account/google", cookie: `${base}; mailhq_shop_google=${state}` },
    { path: "/api/shop/account/google", cookie: `${base}; mailhq_shop_google=${state}` },
    { path: "/api/shop/account/google/unlink", cookie: `${base}; mailhq_customer=${session}` },
  ]);
});

test("shop proxy: without a forwardable account session the Worker answers logged out itself without calling mail", async () => {
  const session = "S".repeat(43);
  for (const cookie of [
    undefined,
    `mailhq_shop=${buyerToken}`,
    "mailhq_customer=too-short",
    `mailhq_customer=${session}; mailhq_customer=${session}`,
  ]) {
    for (const [lang, error, route] of [
      ["zh", "请先登录。", "account"],
      ["en", "Please sign in first.", "account"],
      ["zh", "请先登录。", "account/mailboxes"],
    ] as const) {
      const response = await worker.fetch(
        new Request(`${siteOrigin}/api/shop/${route}`, {
          headers: { "Accept-Language": lang, ...(cookie ? { Cookie: cookie } : {}) },
        }),
        bindings(),
      );
      expect(response.status).toBe(401);
      expect(await response.json()).toStrictEqual({ error });
      expectShopHeaders(response);
    }
  }
  let calls = 0;
  const signedIn = await worker.fetch(
    new Request(`${siteOrigin}/api/shop/account`, { headers: { Cookie: `mailhq_customer=${session}` } }),
    bindings(async () => {
      calls += 1;
      return Response.json({ error: "请先登录。" }, { status: 401 });
    }),
  );
  expect([signedIn.status, calls], "session expiry is decided by mail").toStrictEqual([401, 1]);
});

test("shop proxy: logout clears the session cookie whatever mail answers; cross-site or malformed requests do not clear it", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const clear = "mailhq_customer=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure";
  const logout = (headers: Record<string, string> = {}) =>
    new Request(`${siteOrigin}/api/shop/account/logout`, {
      method: "POST",
      body: "{}",
      headers: { Origin: siteOrigin, "Content-Type": "application/json", ...headers },
    });
  for (const [status, upstream] of [
    [200, async () => Response.json({ ok: true })],
    [503, async () => Response.json({ error: "数据库不可用" }, { status: 503 })],
    [403, async () => Response.json({ error: "来源不对" }, { status: 403 })],
    [503, async () => new Response("<html>", { status: 500, headers: { "Content-Type": "text/html" } })],
    [503, async () => new Response(null, { status: 302, headers: { Location: "/login" } })],
    [
      503,
      async () => {
        throw new Error("down");
      },
    ],
  ] as const) {
    const response = await worker.fetch(logout(), bindings(upstream));
    expect(response.status).toBe(status);
    expect(response.headers.getSetCookie()).toStrictEqual([clear]);
    expectShopHeaders(response);
  }
  const refusals: Record<string, string>[] = [{ Origin: "https://attacker.example" }, { "Content-Type": "text/plain" }];
  for (const headers of refusals) {
    const refused = await worker.fetch(logout(headers), bindings());
    expect(refused.status).not.toBe(200);
    expect(refused.headers.getSetCookie()).toStrictEqual([]);
  }
});

test("contract: the redeem and shop routes and methods the Worker forwards match mail's four route lists, every other path is 404", async () => {
  for (const route of contract.redeem.routes) {
    const mail = vi.fn(async () => Response.json({}));
    expect((await worker.fetch(post(`/api/onboard/${route}`), bindings(mail))).status, route).toBe(200);
    expect(mail).toHaveBeenCalledOnce();
  }
  expect((await worker.fetch(post("/api/onboard/lookup"), bindings())).status).toBe(404);

  // The four route lists of the contract (shop.routes, and the seat, buyer-domain and trial routes mail lists apart): the
  // Worker proxies every one of them, and nothing else under /api/shop/.
  const lists: Record<string, ("GET" | "POST")[]>[] = [
    Object.fromEntries(Object.entries(contract.shop.routes).map(([route, method]) => [route, [method]])),
    Object.fromEntries(Object.entries(contract.shop.seats.routes).map(([route, method]) => [route, [method]])),
    Object.fromEntries(Object.entries(contract.shop.buyerDomains.routes).map(([route, method]) => [route, [method]])),
    contract.shop.trials.routes,
  ];
  // No route is in two lists, as mail's own contract test requires.
  const listed = lists.flatMap((list) => Object.keys(list));
  expect(new Set(listed).size).toBe(listed.length);
  const routes: Record<string, ("GET" | "POST")[]> = Object.assign({}, ...lists);
  expect(Object.keys(contract.shop.seats.routes)).toContain("quote");
  // The Worker's own table names exactly these routes and methods: a route added to either side alone fails here.
  expect(
    Object.fromEntries(
      Object.entries(SHOP_ROUTES)
        .map(([route, methods]) => [route, [...methods]] as const)
        .toSorted(([a], [b]) => a.localeCompare(b)),
    ),
  ).toEqual(Object.fromEntries(Object.entries(routes).toSorted(([a], [b]) => a.localeCompare(b))));

  for (const [route, methods] of Object.entries(routes)) {
    const form = route === "pay";
    const request = (verb: string) => {
      const headers: Record<string, string> = { Origin: siteOrigin, Cookie: `mailhq_customer=${"c".repeat(43)}` };
      if (verb === "POST") headers["Content-Type"] = form ? "application/x-www-form-urlencoded" : "application/json";
      return new Request(`${siteOrigin}/api/shop/${route}`, {
        method: verb,
        headers,
        ...(verb === "POST" ? { body: form ? "orderId=abcdefghijklmno" : "{}" } : {}),
      });
    };
    for (const method of methods) {
      const mail = vi.fn(async (forwarded: Request) => {
        // The route and the method reach mail as they are.
        expect([new URL(forwarded.url).pathname, forwarded.method], route).toEqual([`/api/shop/${route}`, method]);
        return form
          ? new Response(null, { status: 303, headers: { Location: `${siteOrigin}/shop/orders/?id=abcdefghijklmno` } })
          : route === "notify"
            ? new Response("success", { headers: { "Content-Type": "text/plain" } })
            : Response.json({});
      });
      const response = await worker.fetch(request(method), bindings(mail));
      expect(mail, route).toHaveBeenCalledOnce();
      expect(response.status, route).toBe(form ? 303 : 200);
      // With or without the trailing slash.
      const slashed = new Request(`${siteOrigin}/api/shop/${route}/`, request(method));
      expect((await worker.fetch(slashed, bindings(mail))).status, route).toBe(form ? 303 : 200);
    }
    // Every other method is refused before mail is called, and the answer names the ones the route takes.
    for (const verb of ["GET", "POST", "PUT", "DELETE"].filter((verb) => !(methods as string[]).includes(verb))) {
      const wrong = await worker.fetch(request(verb), bindings());
      expect([wrong.status, wrong.headers.get("Allow")], `${verb} ${route}`).toEqual([405, methods.join(", ")]);
    }
  }
  // Stripe calls its webhook on mail's own host; the storefront never proxies it.
  for (const route of [
    "stripe/webhook",
    "account/delete",
    "admin",
    "quote/extra",
    "account/seats",
    "account/seats/quote/extra",
    "account/domains/approve",
    "account/trial/claim",
    "constructor",
    "__proto__",
  ]) {
    expect((await worker.fetch(shopRequest(route), bindings())).status, route).toBe(404);
  }
});

test("contract: the Worker's cookies, order number, order page and payment destinations match mail's", () => {
  const { buyer, customer } = contract.shop.cookies;
  expect([BUYER_COOKIE, BUYER_TOKEN.source, COOKIE_MAX_AGE]).toEqual([buyer.name, buyer.pattern, buyer.maxAgeSeconds]);
  expect([CUSTOMER_COOKIE, CUSTOMER_TOKEN.source, CUSTOMER_MAX_AGE]).toEqual([
    customer.name,
    customer.pattern,
    customer.maxAgeSeconds,
  ]);
  const { google } = contract.shop.cookies;
  expect([GOOGLE_COOKIE, GOOGLE_TOKEN.source, GOOGLE_MAX_AGE, GOOGLE_COOKIE_PATH]).toEqual([
    google.name,
    google.pattern,
    google.maxAgeSeconds,
    google.path,
  ]);
  expect(ORDER_ID.source).toBe(contract.shop.orderIdPattern);
  for (const page of Object.values(contract.shop.orderPages)) expect(page).toMatch(ORDER_PAGE);
  const [credit, stripe] = contract.shop.payRedirects;
  expect(paymentLocation(`${credit}?code=x`, siteOrigin)).toBe(`${credit}?code=x`);
  expect(paymentLocation(`${stripe}cs_test_1#fid=x`, siteOrigin)).toBe(`${stripe}cs_test_1#fid=x`);
});

test("contract: every storefront origin in the contract is a custom domain of this Worker", () => {
  // mail's ONBOARD_ORIGIN lists only storefrontOrigins: the site itself, and the retired onboard domain whose /api this Worker still answers.
  const source = readFileSync("wrangler.jsonc", "utf8")
    .replace(/"(?:\\.|[^"\\])*"|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (token) => (token.startsWith('"') ? token : ""))
    .replace(/,(\s*[}\]])/g, "$1");
  const config = JSON.parse(source) as {
    routes: { pattern: string; custom_domain?: boolean; previews_enabled?: boolean }[];
  };
  for (const route of config.routes) {
    expect(route, route.pattern).toMatchObject({ custom_domain: true, previews_enabled: false });
  }
  const served = config.routes.map(({ pattern }) => `https://${pattern}`);
  for (const origin of contract.redeem.storefrontOrigins) expect(served).toContain(origin);
  expect(contract.redeem.storefrontOrigins).toContain(siteOrigin);
});

test("contract: redeem requests with a wrong origin get 403, like mail", async () => {
  const response = await worker.fetch(post("/api/onboard/cdk", { Origin: "https://other.example" }), bindings());
  expect(response.status).toBe(contract.redeem.originForbiddenStatus);
});

test("contract: the Turnstile site key and token pass through the Worker unchanged, and on rejection mail's answer reaches the page along with kind", async () => {
  const { siteKeyField, siteKeyRoutes, tokenField, actions } = contract.turnstile;
  const failed = contract.redeem.errorKinds.challenge_failed!.status;
  const customer = `mailhq_customer=${"c".repeat(43)}`;
  const request = (route: string, body?: string) =>
    new Request(`${siteOrigin}/api/${route}`, {
      ...(body === undefined
        ? {}
        : { method: "POST", body, headers: { Origin: siteOrigin, "Content-Type": "application/json" } }),
    });
  for (const route of siteKeyRoutes) {
    const answer = { domains: ["abnormal.bid"], [siteKeyField]: "0x4AAAsite" };
    const response = await worker.fetch(
      request(route, route.startsWith("onboard/") ? '{"code":"ABCD-EFGH-JKLM-NPQR"}' : undefined),
      bindings(async (forwarded) => {
        expect(new URL(forwarded.url).pathname).toBe(`/api/${route}`);
        return Response.json(answer);
      }),
    );
    expect(await response.json(), route).toStrictEqual(answer);
  }

  for (const route of Object.keys(actions)) {
    // mail checks the token together with the visitor IP at siteverify: not a byte of the body changes and CF-Connecting-IP is still carried.
    const body = JSON.stringify({ email: "buyer@example.com", code: "ABCD-EFGH-JKLM-NPQR", [tokenField]: "token" });
    const refusal = route.startsWith("onboard/")
      ? { error: "The human check did not pass.", kind: "challenge_failed" }
      : { error: "The human check did not pass." };
    const sent = request(route, body);
    sent.headers.set("CF-Connecting-IP", "203.0.113.7");
    sent.headers.set("Accept-Language", "en");
    sent.headers.set("Cookie", customer);
    const response = await worker.fetch(
      sent,
      bindings(async (forwarded) => {
        expect(new URL(forwarded.url).pathname).toBe(`/api/${route}`);
        expect(await forwarded.text()).toBe(body);
        expect(forwarded.headers.get("cf-connecting-ip")).toBe("203.0.113.7");
        expect(forwarded.headers.get("accept-language")).toBe("en");
        return Response.json(refusal, { status: failed });
      }),
    );
    expect(response.status, route).toBe(failed);
    expect(await response.json(), route).toStrictEqual(refusal);
    expect(response.headers.get("Cache-Control") ?? "", route).toMatch(/no-store/);
  }
});
