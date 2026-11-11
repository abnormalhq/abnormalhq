import { readFileSync } from "node:fs";
import { beforeEach, expect, test, vi } from "vitest";
import {
  STATUS_API_PATH,
  STATUS_FIELDS,
  STATUS_MAX_AGE_SECONDS,
  STATUS_STATES,
  forgetSharedStatus,
  formatUptime,
  readStatusSummary,
  sharedStatus,
  watchStatus,
  type StatusSummary,
  type StatusWatchHost,
} from "@/lib/status";
import { storefrontApi as worker, type StorefrontEnv } from "@/storefront/worker/index";
import { MAIL_STATUS_PATH, forgetStatus, proxyStatus } from "@/storefront/worker/status";

/** docs/onboard-contract.json: the values mail and this site must agree on (mail keeps an identical copy). */
const contract = JSON.parse(readFileSync("docs/onboard-contract.json", "utf8")) as {
  status: { route: string; method: string; states: string[]; days: number; fields: string[]; maxAgeSeconds: number };
};

const siteOrigin = "https://abnormalhq.com";
const mailOrigin = "https://console.abnormalhq.com";
const summary = { status: "up", days: 30, uptime: 99.98, updatedAt: "2026-11-10T12:00:00.000Z" };
type FetchHandler = (request: Request) => Promise<Response>;

function bindings(mail: FetchHandler): StorefrontEnv {
  return { MAIL: { fetch: mail }, MAIL_ORIGIN: mailOrigin };
}

function get(headers: HeadersInit = {}): Request {
  return new Request(`${siteOrigin}/api/status`, { headers });
}

beforeEach(() => {
  forgetStatus();
  forgetSharedStatus();
});

test("contract: the status route, states, fields, days and cache lifetime match mail's", () => {
  expect(MAIL_STATUS_PATH).toBe(`/api/${contract.status.route}`);
  expect(contract.status.method).toBe("GET");
  expect([...STATUS_STATES]).toEqual(contract.status.states);
  expect([...STATUS_FIELDS]).toEqual(contract.status.fields);
  expect(STATUS_MAX_AGE_SECONDS).toBe(contract.status.maxAgeSeconds);
  // Every state and a summary of exactly the contract's fields is accepted.
  for (const status of contract.status.states) {
    const read = readStatusSummary({ ...summary, status, days: contract.status.days });
    expect(Object.keys(read!), status).toEqual(contract.status.fields);
  }
});

test("the Worker reads mail's summary over the binding and sends nothing of the browser's request on", async () => {
  const mail = vi.fn(async (request: Request) => {
    expect(request.url).toBe(`${mailOrigin}/api/status/summary`);
    expect(request.method).toBe("GET");
    expect(request.redirect).toBe("manual");
    expect([...request.headers.keys()]).toEqual(["accept"]);
    return Response.json({ ...summary, internal: "mail-1.internal:993" }, { headers: { "Set-Cookie": "a=b" } });
  });
  const response = await worker.fetch(
    get({ Cookie: `mailhq_customer=${"c".repeat(43)}`, "CF-Connecting-IP": "203.0.113.7", "Accept-Language": "zh" }),
    bindings(mail),
  );
  expect(response.status).toBe(200);
  // Only the four checked fields are passed on, and none of mail's headers.
  expect(await response.json()).toEqual(summary);
  expect(response.headers.get("cache-control")).toBe("public, max-age=60");
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(mail).toHaveBeenCalledOnce();
});

test("one Worker instance asks mail once a minute, and browsers keep the answer for what is left of it", async () => {
  const mail = vi.fn(async () => Response.json(summary));
  const env = bindings(mail);
  const start = 1_800_000_000_000;
  expect((await proxyStatus(get(), env, start)).headers.get("cache-control")).toBe("public, max-age=60");
  const later = await proxyStatus(get(), env, start + 45_000);
  expect(later.headers.get("cache-control")).toBe("public, max-age=15");
  expect(await later.json()).toEqual(summary);
  expect(mail).toHaveBeenCalledOnce();
  await proxyStatus(get(), env, start + 60_000);
  expect(mail).toHaveBeenCalledTimes(2);
});

test("anything but a checked summary is a JSON 503, and an old summary is not served past its minute", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const answers: (() => Response | Promise<Response>)[] = [
    // A mail before the endpoint: its proxy answers 401.
    () => Response.json({ error: "unauthenticated" }, { status: 401 }),
    () => Response.json({ error: "unavailable" }, { status: 503 }),
    () => new Response(null, { status: 307, headers: { Location: `${mailOrigin}/login` } }),
    () => new Response("<html>", { headers: { "Content-Type": "text/html" } }),
    () => new Response("{", { headers: { "Content-Type": "application/json" } }),
    () => Response.json({ ...summary, status: "degraded" }),
    () => Response.json({ ...summary, uptime: 101 }),
    () => Promise.reject(new Error("connect failed: 10.0.0.5")),
  ];
  for (const [index, answer] of answers.entries()) {
    forgetStatus();
    const response = await worker.fetch(
      get({ "Accept-Language": "en" }),
      bindings(async () => answer()),
    );
    expect(response.status, String(index)).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("retry-after")).toBe("60");
    expect(await response.json()).toEqual({
      error: "The mail service is temporarily unavailable. Please try again shortly.",
      kind: "unavailable",
    });
  }

  forgetStatus();
  let up = true;
  const env = bindings(async () => (up ? Response.json(summary) : new Response(null, { status: 503 })));
  const start = 1_800_000_000_000;
  expect((await proxyStatus(get(), env, start)).status).toBe(200);
  up = false;
  expect((await proxyStatus(get(), env, start + 30_000)).status).toBe(200);
  expect((await proxyStatus(get(), env, start + 61_000)).status).toBe(503);
});

test("only GET is accepted, and nothing else under /api/status exists", async () => {
  const mail = vi.fn(async () => Response.json(summary));
  const posted = await worker.fetch(new Request(`${siteOrigin}/api/status`, { method: "POST" }), bindings(mail));
  expect([posted.status, posted.headers.get("allow")]).toEqual([405, "GET"]);
  for (const path of ["/api/status/summary", "/api/status/unsubscribe", "/api/statuses"]) {
    expect((await worker.fetch(new Request(`${siteOrigin}${path}`), bindings(mail))).status, path).toBe(404);
  }
  expect(mail).not.toHaveBeenCalled();
  expect((await worker.fetch(new Request(`${siteOrigin}/api/status/`), bindings(mail))).status).toBe(200);
});

test("a summary is taken only in its exact shape", () => {
  expect(readStatusSummary(summary)).toEqual(summary);
  expect(readStatusSummary({ ...summary, uptime: null, status: "pending" })?.uptime).toBeNull();
  for (const wrong of [
    null,
    [],
    "up",
    { ...summary, status: "UP" },
    { ...summary, days: 0 },
    { ...summary, days: 30.5 },
    { ...summary, uptime: "99.98" },
    { ...summary, uptime: -1 },
    { ...summary, uptime: Number.NaN },
    { ...summary, uptime: undefined },
    { ...summary, updatedAt: "yesterday" },
    { status: "up" },
  ]) {
    expect(readStatusSummary(wrong), JSON.stringify(wrong)).toBeNull();
  }
});

test("the figure reads 100 only when no check failed", () => {
  expect(formatUptime(100)).toBe("100");
  expect(formatUptime(99.999)).toBe("99.99");
  expect(formatUptime(99.98)).toBe("99.98");
  expect(formatUptime(99.5)).toBe("99.50");
  expect(formatUptime(0)).toBe("0.00");
  // mail's two decimals are shown as they are, whatever their binary form.
  expect(formatUptime(0.29)).toBe("0.29");
  expect(formatUptime(16.65)).toBe("16.65");
  expect(formatUptime(99.99)).toBe("99.99");
  expect(formatUptime(99.996)).toBe("99.99");
});

test("requests that overlap at expiry do not erase each other's answer", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const start = 1_800_000_000_000;
  const pending: ((response: Response) => void)[] = [];
  const env = bindings(() => new Promise<Response>((resolve) => pending.push(resolve)));
  const first = proxyStatus(get(), env, start);
  const second = proxyStatus(get(), env, start);
  await vi.waitFor(() => expect(pending).toHaveLength(2));
  // The first is answered, then the second fails: the summary the first saved stays.
  pending[0]!(Response.json(summary));
  expect((await first).status).toBe(200);
  pending[1]!(new Response(null, { status: 503 }));
  expect((await second).status).toBe(200);
  const up = bindings(async () => expect.unreachable("the saved summary is still fresh"));
  expect(await (await proxyStatus(get(), up, start + 1000)).json()).toEqual(summary);
});

test("a page left open reads the status again every minute, and a failed refresh clears it", async () => {
  let now = 1_800_000_000_000;
  let hidden = false;
  let tick = () => {};
  let shown = () => {};
  const stopped = vi.fn();
  const answers: (() => Promise<Response>)[] = [];
  const fetcher = vi.fn(() => answers.shift()!()) as unknown as typeof fetch;
  const host: StatusWatchHost = {
    fetcher,
    now: () => now,
    every: (ms, run) => {
      expect(ms).toBe(60_000);
      tick = run;
      return stopped;
    },
    hidden: () => hidden,
    onVisible: (run) => {
      shown = run;
      return stopped;
    },
  };
  const footer: (StatusSummary | null)[] = [];
  const hero: (StatusSummary | null)[] = [];
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  answers.push(async () => Response.json(summary));
  const stopFooter = watchStatus((answer) => footer.push(answer), host);
  const stopHero = watchStatus((answer) => hero.push(answer), host);
  await settle();
  expect([footer, hero]).toEqual([[summary], [summary]]);
  expect(fetcher).toHaveBeenCalledOnce();

  // A minute on, an outage: both hear the new state from one request.
  now += 60_000;
  answers.push(async () => Response.json({ ...summary, status: "down" }));
  tick();
  await settle();
  expect(footer.at(-1)?.status).toBe("down");
  expect(hero.at(-1)?.status).toBe("down");
  expect(fetcher).toHaveBeenCalledTimes(2);

  // The refresh fails: what was shown is cleared, not kept.
  now += 60_000;
  answers.push(async () => new Response(null, { status: 503 }));
  tick();
  await settle();
  expect([footer.at(-1), hero.at(-1)]).toEqual([null, null]);

  // A background tab does not ask; it asks as soon as it is shown again.
  now += 60_000;
  hidden = true;
  tick();
  await settle();
  expect(fetcher).toHaveBeenCalledTimes(3);
  hidden = false;
  answers.push(async () => Response.json(summary));
  shown();
  await settle();
  expect(footer.at(-1)).toEqual(summary);
  expect(fetcher).toHaveBeenCalledTimes(4);

  // The hero leaves (another page), the footer stays and keeps the timer; the last one out stops it.
  stopHero();
  expect(stopped).not.toHaveBeenCalled();
  now += 60_000;
  answers.push(async () => Response.json(summary));
  const heard = hero.length;
  tick();
  await settle();
  expect(hero).toHaveLength(heard);
  stopFooter();
  expect(stopped).toHaveBeenCalledTimes(2);
});

test("a page's parts share one request, a failure is null and is asked again", async () => {
  const fetcher = vi.fn(async () => Response.json(summary)) as unknown as typeof fetch;
  let now = 1_800_000_000_000;
  const clock = () => now;
  const [footer, hero] = await Promise.all([sharedStatus(fetcher, clock), sharedStatus(fetcher, clock)]);
  expect(footer).toEqual(summary);
  expect(hero).toEqual(summary);
  expect(fetcher).toHaveBeenCalledOnce();
  expect(vi.mocked(fetcher).mock.calls[0]![0]).toBe(STATUS_API_PATH);
  now += 61_000;
  await sharedStatus(fetcher, clock);
  expect(fetcher).toHaveBeenCalledTimes(2);

  forgetSharedStatus();
  const failing = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ error: "x", kind: "unavailable" }, { status: 503 }))
    .mockRejectedValueOnce(new TypeError("Failed to fetch"))
    .mockResolvedValueOnce(Response.json(summary)) as unknown as typeof fetch;
  expect(await sharedStatus(failing, clock)).toBeNull();
  expect(await sharedStatus(failing, clock)).toBeNull();
  expect(await sharedStatus(failing, clock)).toEqual(summary);
});
