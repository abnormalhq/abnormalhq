import { afterEach, expect, test, vi } from "vitest";
import {
  ADDRESS_STORAGE_KEY,
  forgetAddress,
  formatAddress,
  parseAddress,
  parsePlan,
  recallAddress,
  rememberAddress,
  shopHref,
  storedAddress,
  subscribeAddress,
} from "@/storefront/lib/address";
import { catalogDomains, checkAddress, getShopCatalog, parseShopCatalog, ShopApiError } from "@/storefront/lib/catalog";
import {
  CATALOG_CACHE_SECONDS,
  catalogCacheKey,
  readCatalog,
  type CatalogCache,
} from "@/storefront/lib/catalog-server";
import { LOCAL_PART_PATTERN } from "@/storefront/lib/onboard";
import { MockShopStore } from "@/storefront/mock/shop";
import { storefrontApi as worker, type StorefrontEnv } from "@/storefront/worker/index";
import { catalogResponse } from "./fixtures/shop-contract";

const siteOrigin = "https://abnormalhq.com";
const mailOrigin = "https://console.abnormalhq.com";

/* ---- The carried address ---- */

test("address: only name@domain with a username the redeem form accepts and a plain host name is carried", () => {
  expect(parseAddress("ada.lovelace@abnormalhq.com")).toStrictEqual({
    username: "ada.lovelace",
    domain: "abnormalhq.com",
  });
  expect(parseAddress("  Ada@Abnormalhq.COM ")).toStrictEqual({ username: "ada", domain: "abnormalhq.com" });
  for (const raw of [
    null,
    undefined,
    "",
    "ada",
    "@abnormalhq.com",
    "ada@",
    "a@b@abnormalhq.com",
    "a..b@abnormalhq.com",
    ".ada@abnormalhq.com",
    "ada@localhost",
    "ada@abnormalhq.com/shop",
    "ada@-bad-.com",
    "<script>@abnormalhq.com",
    `${"a".repeat(65)}@abnormalhq.com`,
  ]) {
    expect(parseAddress(raw), String(raw)).toBeNull();
  }
  // Whatever parses is a username mail's own pattern accepts.
  expect(parseAddress("a_b-c.d@abnormalhq.com")!.username).toMatch(LOCAL_PART_PATTERN);
});

test("address: the shop link carries a well-formed plan and the chosen address, and nothing else", () => {
  const address = { username: "ada", domain: "abnormalhq.com" };
  expect(shopHref("/shop/", {})).toBe("/shop/");
  expect(shopHref("/zh/shop/", { plan: "demoproduct0001" })).toBe("/zh/shop/?plan=demoproduct0001");
  expect(shopHref("/shop/", { address })).toBe("/shop/?address=ada%40abnormalhq.com");
  expect(shopHref("/shop/", { plan: "demoproduct0001", address })).toBe(
    "/shop/?plan=demoproduct0001&address=ada%40abnormalhq.com",
  );
  expect(shopHref("/shop/", { plan: "../admin", address: null })).toBe("/shop/");
  // What the link carries is what the shop reads back.
  const params = new URL(shopHref("/shop/", { plan: "demoproduct0001", address }), siteOrigin).searchParams;
  expect(parseAddress(params.get("address"))).toStrictEqual(address);
  expect(parsePlan(params.get("plan"))).toBe("demoproduct0001");
  expect(parsePlan("DEMOPRODUCT0001")).toBeNull();
  expect(parsePlan(null)).toBeNull();
});

function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
    clear: () => items.clear(),
    key: () => null,
    get length() {
      return items.size;
    },
  };
}

afterEach(() => {
  forgetAddress();
});

test("address: kept in this tab's sessionStorage only, re-validated when read, and announced to the page", () => {
  const session = memoryStorage();
  vi.stubGlobal("sessionStorage", session);
  const changes = vi.fn();
  const unsubscribe = subscribeAddress(changes);
  expect(recallAddress()).toBeNull();
  expect(storedAddress()).toBe("");

  rememberAddress({ username: "ada", domain: "abnormalhq.com" });
  expect(session.getItem(ADDRESS_STORAGE_KEY)).toBe("ada@abnormalhq.com");
  expect(formatAddress(recallAddress()!)).toBe("ada@abnormalhq.com");
  expect(storedAddress()).toBe("ada@abnormalhq.com");
  expect(changes).toHaveBeenCalledTimes(1);

  // Something else wrote the key: a value that is no address is not carried.
  session.setItem(ADDRESS_STORAGE_KEY, "javascript:alert(1)");
  expect(recallAddress()).toBeNull();

  rememberAddress({ username: "ada", domain: "abnormalhq.com" });
  forgetAddress();
  expect(session.getItem(ADDRESS_STORAGE_KEY)).toBeNull();
  expect(changes).toHaveBeenCalledTimes(3);
  unsubscribe();
  rememberAddress({ username: "ada", domain: "abnormalhq.com" });
  expect(changes).toHaveBeenCalledTimes(3);
});

test("address: blocked storage means the address is simply not carried", () => {
  vi.stubGlobal("sessionStorage", {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
    removeItem() {
      throw new Error("blocked");
    },
  });
  expect(() => rememberAddress({ username: "ada", domain: "abnormalhq.com" })).not.toThrow();
  expect(recallAddress()).toBeNull();
  expect(() => forgetAddress()).not.toThrow();
});

/* ---- The browser client ---- */

test("catalog client: the address check exists only when the backend says so", async () => {
  expect(parseShopCatalog(catalogResponse)).not.toHaveProperty("addressCheck");
  expect(parseShopCatalog({ ...catalogResponse, addressCheck: true }).addressCheck).toBe(true);
  // Only the literal true turns the check on.
  for (const value of [false, "true", 1, null, {}]) {
    expect(parseShopCatalog({ ...catalogResponse, addressCheck: value }), String(value)).not.toHaveProperty(
      "addressCheck",
    );
  }
  vi.stubGlobal("fetch", async () => Response.json({ ...catalogResponse, addressCheck: true }));
  expect((await getShopCatalog()).addressCheck).toBe(true);
});

test("catalog client: the address check offers each domain on sale once, in catalog order", () => {
  const product = catalogResponse.products[0]!;
  const catalog = parseShopCatalog({
    ...catalogResponse,
    products: [
      { ...product, domains: ["abnormalhq.com", "abnormal.bid"] },
      { ...product, id: "productabcdefgi", domains: ["abnormal.bid", "example.com"] },
    ],
  });
  expect(catalogDomains(catalog)).toStrictEqual(["abnormalhq.com", "abnormal.bid", "example.com"]);
});

test("address check client: one cookie-less POST in the page language; taken is an answer, not an error", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  let body: unknown = { available: true, email: "ada@abnormalhq.com" };
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Response.json(body);
  });
  expect(await checkAddress("abnormalhq.com", "ada", undefined, "en")).toStrictEqual({
    available: true,
    email: "ada@abnormalhq.com",
  });
  expect(calls[0]!.url).toBe("/api/shop/address");
  expect(calls[0]!.init).toMatchObject({ method: "POST", credentials: "omit", mode: "same-origin", cache: "no-store" });
  expect(JSON.parse(String(calls[0]!.init.body))).toStrictEqual({ domain: "abnormalhq.com", username: "ada" });
  expect(calls[0]!.init.headers).toMatchObject({ "Accept-Language": "en", "Content-Type": "application/json" });

  body = { available: false, email: "kunish@abnormalhq.com" };
  expect((await checkAddress("abnormalhq.com", "kunish")).available).toBe(false);

  // A half-right answer is a failed request, not "available".
  for (const wrong of [{ available: "yes", email: "a@b.c" }, { available: true }, null, []]) {
    body = wrong;
    await expect(checkAddress("abnormalhq.com", "ada")).rejects.toBeInstanceOf(ShopApiError);
  }
});

test("address check client: a backend without the endpoint, an invalid name and the rate limit keep their status", async () => {
  for (const status of [404, 400, 429, 503]) {
    vi.stubGlobal("fetch", async () => Response.json({ error: "no" }, { status }));
    await expect(checkAddress("abnormalhq.com", "ada")).rejects.toMatchObject({ status, answered: true });
  }
});

/* ---- The dev mock ---- */

const NOW = Date.parse("2026-11-10T00:00:00.000Z");

function mockPost(route: string, body: unknown, headers: HeadersInit = {}): Request {
  return new Request(`http://localhost:4320/api/shop/${route}`, {
    method: "POST",
    headers: { Origin: "http://localhost:4320", "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

test("dev shop: the address check answers for domains on sale by the redeem form's rules, without a session", async () => {
  const store = new MockShopStore(() => NOW, true);
  const ask = async (body: unknown, headers?: HeadersInit) => {
    const response = await store.fetch("address", mockPost("address", body, headers));
    return [response.status, await response.json()] as const;
  };
  expect(await ask({ domain: "abnormalhq.com", username: "ada" })).toStrictEqual([
    200,
    { available: true, email: "ada@abnormalhq.com" },
  ]);
  expect(await ask({ domain: "abnormalhq.com", username: " Kunish@elsewhere.example " })).toStrictEqual([
    200,
    { available: false, email: "kunish@abnormalhq.com" },
  ]);
  expect((await ask({ domain: "abnormalhq.com", username: "a..b" }))[0]).toBe(400);
  expect((await ask({ domain: "abnormalhq.com" }))[0]).toBe(400);
  // A domain no plan sells cannot be probed.
  expect((await ask({ domain: "example.com", username: "ada" }))[0]).toBe(400);
  expect((await ask({ domain: "abnormalhq.com", username: "ada" }, { "Accept-Language": "en" }))[0]).toBe(200);
  const crossSite = await store.fetch(
    "address",
    mockPost("address", { domain: "abnormalhq.com", username: "ada" }, { Origin: "https://attacker.example" }),
  );
  expect(crossSite.status).toBe(403);
  const get = await store.fetch("address", new Request("http://localhost:4320/api/shop/address"));
  expect([get.status, get.headers.get("Allow")]).toStrictEqual([405, "POST"]);

  const catalog = await (await store.fetch("catalog", new Request("http://localhost:4320/api/shop/catalog"))).json();
  expect(parseShopCatalog(catalog).addressCheck).toBe(true);
});

test("dev shop: with the address check off it behaves like a backend before it, no flag and a 404", async () => {
  const store = new MockShopStore(() => NOW, false);
  const catalog = await (await store.fetch("catalog", new Request("http://localhost:4320/api/shop/catalog"))).json();
  expect(catalog).not.toHaveProperty("addressCheck");
  const response = await store.fetch("address", mockPost("address", { domain: "abnormalhq.com", username: "ada" }));
  expect(response.status).toBe(404);
});

test("dev shop: the catalog names its demo plans in the request's language", async () => {
  const store = new MockShopStore(() => NOW, true);
  const names = async (lang: string) => {
    const request = new Request("http://localhost:4320/api/shop/catalog", { headers: { "Accept-Language": lang } });
    const catalog = parseShopCatalog(await (await store.fetch("catalog", request)).json());
    return catalog.products.map((product) => product.name);
  };
  expect((await names("zh"))[0]).toMatch(/演示套餐/);
  expect((await names("en"))[0]).toBe("Demo plan · One mailbox");
});

/* ---- The Worker's proxy ---- */

function bindings(mail: (request: Request) => Promise<Response>): StorefrontEnv {
  return { MAIL: { fetch: mail }, MAIL_ORIGIN: mailOrigin };
}

function addressRequest(init: RequestInit = {}, headers: Record<string, string> = {}): Request {
  return new Request(`${siteOrigin}/api/shop/address`, {
    method: "POST",
    body: '{"domain":"abnormalhq.com","username":"ada"}',
    headers: { Origin: siteOrigin, "Content-Type": "application/json", ...headers },
    ...init,
  });
}

test("shop proxy: the address check reaches mail without any cookie, with the visitor's IP and Origin, and is never cached", async () => {
  const mail = vi.fn(async (request: Request) => {
    expect(request.url).toBe(`${mailOrigin}/api/shop/address`);
    expect(request.method).toBe("POST");
    // The buyer and account sessions belong to other routes: an availability question carries no identity.
    expect(request.headers.get("cookie")).toBeNull();
    expect(request.headers.get("authorization")).toBeNull();
    expect(request.headers.get("origin")).toBe(siteOrigin);
    // mail rate-limits the check by this address: it is the only brake on enumerating names.
    expect(request.headers.get("cf-connecting-ip")).toBe("203.0.113.9");
    expect(await request.text()).toBe('{"domain":"abnormalhq.com","username":"ada"}');
    return Response.json(
      { available: true, email: "ada@abnormalhq.com" },
      { headers: { "Set-Cookie": "mailhq_shop=x", "Cache-Control": "public, max-age=3600" } },
    );
  });
  const response = await worker.fetch(
    addressRequest(
      {},
      {
        Cookie: `mailhq_shop=${"a".repeat(64)}; mailhq_customer=${"c".repeat(43)}; session=admin`,
        Authorization: "Bearer admin",
        "CF-Connecting-IP": "203.0.113.9",
      },
    ),
    bindings(mail),
  );
  expect(mail).toHaveBeenCalledOnce();
  expect(response.status).toBe(200);
  expect(await response.json()).toStrictEqual({ available: true, email: "ada@abnormalhq.com" });
  expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
  expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  expect(response.headers.getSetCookie()).toStrictEqual([]);
});

test("shop proxy: the address check is a same-origin JSON POST like every other shop write", async () => {
  const never = bindings(async () => expect.unreachable("mail must not be called"));
  for (const origin of [undefined, "null", "https://attacker.example"]) {
    const headers = new Headers({ "Content-Type": "application/json" });
    if (origin) headers.set("Origin", origin);
    const response = await worker.fetch(addressRequest({ headers }), never);
    expect(response.status, String(origin)).toBe(403);
  }
  expect((await worker.fetch(addressRequest({}, { "Content-Type": "text/plain" }), never)).status).toBe(415);
  const get = await worker.fetch(new Request(`${siteOrigin}/api/shop/address`), never);
  expect([get.status, get.headers.get("Allow")]).toStrictEqual([405, "POST"]);
  expect((await worker.fetch(new Request(`${siteOrigin}/api/shop/address/ada`), never)).status).toBe(404);
});

test("shop proxy: a mail without the address check answers a JSON 404, so pages hide the check instead of reporting an outage", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  // Next.js's own not-found page, as a mail before the endpoint serves it.
  const html = await worker.fetch(
    addressRequest({}, { "Accept-Language": "en" }),
    bindings(
      async () => new Response("<html>Not found</html>", { status: 404, headers: { "Content-Type": "text/html" } }),
    ),
  );
  expect(html.status).toBe(404);
  expect(html.headers.get("Content-Type")).toMatch(/application\/json/);
  expect(await html.json()).toStrictEqual({ error: "Endpoint not found." });
  expect(html.headers.get("Cache-Control")).toMatch(/no-store/);

  // Anything else that is not JSON is still "unavailable", as on every route.
  const broken = await worker.fetch(
    addressRequest(),
    bindings(async () => new Response("upstream down", { status: 502, headers: { "Content-Type": "text/plain" } })),
  );
  expect(broken.status).toBe(503);

  // The rate limit passes through with its Retry-After.
  const limited = await worker.fetch(
    addressRequest(),
    bindings(async () => Response.json({ error: "slow down" }, { status: 429, headers: { "Retry-After": "30" } })),
  );
  expect([limited.status, limited.headers.get("Retry-After")]).toStrictEqual([429, "30"]);
});

/* ---- The pricing page's server-side catalog ---- */

function memoryCache(): CatalogCache & { entries: Map<string, Response> } {
  const entries = new Map<string, Response>();
  return {
    entries,
    match: async (key) => entries.get(key)?.clone(),
    put: async (key, response) => void entries.set(key, response),
  };
}

test("pricing catalog: asked of mail in the page language, without following redirects, and validated like the browser's", async () => {
  const mail = vi.fn(async (request: Request) => {
    expect(request.url).toBe(`${mailOrigin}/api/shop/catalog`);
    expect(request.method).toBe("GET");
    expect(request.headers.get("accept-language")).toBe("zh");
    expect(request.headers.get("cookie")).toBeNull();
    expect(request.redirect).toBe("manual");
    return Response.json(catalogResponse);
  });
  const catalog = await readCatalog({ fetch: mail }, mailOrigin, "zh");
  expect(catalog?.products[0]).toMatchObject({ id: "productabcdefgh", priceCents: 750 });
  // Fields the page does not show are dropped by the parser, as in the browser.
  expect(catalog?.products[0]).not.toHaveProperty("enabled");
});

test("pricing catalog: a good answer is reused for a minute per language; nothing else is ever cached", async () => {
  const cache = memoryCache();
  const mail = vi.fn(async () => Response.json(catalogResponse));
  await readCatalog({ fetch: mail }, mailOrigin, "en", cache);
  await readCatalog({ fetch: mail }, mailOrigin, "en", cache);
  expect(mail).toHaveBeenCalledOnce();
  expect([...cache.entries.keys()]).toStrictEqual([catalogCacheKey("en")]);
  expect(cache.entries.get(catalogCacheKey("en"))!.headers.get("Cache-Control")).toBe(
    `public, max-age=${CATALOG_CACHE_SECONDS}`,
  );
  expect(CATALOG_CACHE_SECONDS).toBeLessThanOrEqual(60);
  // Plan names are localised: the other language asks for itself.
  await readCatalog({ fetch: mail }, mailOrigin, "zh", cache);
  expect(mail).toHaveBeenCalledTimes(2);
  expect(catalogCacheKey("zh")).not.toBe(catalogCacheKey("en"));
});

test("pricing catalog: an error, a redirect, an unknown shape or a dead binding gives null and caches nothing", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const cache = memoryCache();
  const answers: (() => Promise<Response>)[] = [
    async () => Response.json({ error: "down" }, { status: 503 }),
    async () => new Response(null, { status: 302, headers: { Location: "https://elsewhere.example/" } }),
    async () => Response.json({ available: true, products: [{ id: 1 }] }),
    async () => new Response("<html>", { headers: { "Content-Type": "text/html" } }),
    async () => {
      throw new Error("binding not connected");
    },
  ];
  for (const fetch of answers) expect(await readCatalog({ fetch }, mailOrigin, "en", cache)).toBeNull();
  expect(cache.entries.size).toBe(0);
  // A broken cache costs the saving, not the page.
  const broken: CatalogCache = {
    match: async () => {
      throw new Error("cache down");
    },
    put: async () => {
      throw new Error("cache down");
    },
  };
  expect(
    await readCatalog({ fetch: async () => Response.json(catalogResponse) }, mailOrigin, "en", broken),
  ).not.toBeNull();
  // A cached entry that no longer parses is ignored.
  cache.entries.set(catalogCacheKey("en"), Response.json({ nonsense: true }));
  expect(
    await readCatalog({ fetch: async () => Response.json(catalogResponse) }, mailOrigin, "en", cache),
  ).not.toBeNull();
});
