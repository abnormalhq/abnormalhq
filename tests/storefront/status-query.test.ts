import { QueryClient, QueryObserver, focusManager, useQueryClient } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import { QueryProvider } from "@/components/QueryProvider";
import { STATUS_API_PATH, STATUS_MAX_AGE_SECONDS, type StatusSummary } from "@/lib/status";
import { STATUS_QUERY_KEY, statusQueryOptions } from "@/lib/status-query";

vi.hoisted(() => {
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
});

const summary: StatusSummary = {
  status: "up",
  days: 30,
  uptime: 99.98,
  updatedAt: "2026-11-10T12:00:00.000Z",
};
const clients = new Set<QueryClient>();
const subscriptions = new Set<() => void>();

function createClient() {
  const client = new QueryClient();
  client.mount();
  clients.add(client);
  return client;
}

function observe(client: QueryClient, onUpdate: () => void = () => {}) {
  const observer = new QueryObserver(client, statusQueryOptions);
  const stopObserver = observer.subscribe(onUpdate);
  const unsubscribe = () => {
    stopObserver();
    subscriptions.delete(unsubscribe);
  };
  subscriptions.add(unsubscribe);
  return { observer, unsubscribe };
}

async function flushPromises() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

afterEach(() => {
  for (const unsubscribe of subscriptions) unsubscribe();
  for (const client of clients) {
    client.unmount();
    client.clear();
  }
  clients.clear();
  focusManager.setFocused(undefined);
  vi.useRealTimers();
});

test("status uses one in-flight request for staggered observers and preserves request options", async () => {
  vi.useFakeTimers();
  let answer!: (response: Response) => void;
  const fetcher = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        answer = resolve;
      }),
  );
  vi.stubGlobal("fetch", fetcher);
  const client = createClient();
  const first = observe(client);

  await flushPromises();
  expect(fetcher).toHaveBeenCalledWith(STATUS_API_PATH, {
    headers: { Accept: "application/json" },
    credentials: "omit",
  });
  expect(statusQueryOptions).toMatchObject({
    refetchInterval: STATUS_MAX_AGE_SECONDS * 1000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: false,
    retry: false,
    networkMode: "always",
  });
  await vi.advanceTimersByTimeAsync(250);

  const second = observe(client);
  expect(fetcher).toHaveBeenCalledOnce();
  answer(Response.json(summary));
  await flushPromises();

  expect(first.observer.getCurrentResult().data).toEqual(summary);
  expect(second.observer.getCurrentResult().data).toEqual(summary);
  expect(STATUS_QUERY_KEY).toEqual([STATUS_API_PATH]);
});

test("null results replace success, failures retry on the next mount, and bad answers stay empty", async () => {
  vi.useFakeTimers({ now: new Date(summary.updatedAt) });
  const answers: (() => Promise<Response>)[] = [
    async () => Response.json(summary),
    async () => new Response(null, { status: 503 }),
    async () => {
      throw new TypeError("Failed to fetch");
    },
    async () => new Response("{", { headers: { "Content-Type": "application/json" } }),
    async () => Response.json({ ...summary, status: "unknown" }),
    async () => Response.json(summary),
  ];
  const fetcher = vi.fn(() => answers.shift()!());
  vi.stubGlobal("fetch", fetcher);
  const client = createClient();
  const first = observe(client);
  await flushPromises();
  expect(first.observer.getCurrentResult().data).toEqual(summary);

  await vi.advanceTimersByTimeAsync(STATUS_MAX_AGE_SECONDS * 1000);
  await flushPromises();
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(first.observer.getCurrentResult().data).toBeNull();
  first.unsubscribe();

  for (const expectedCalls of [3, 4, 5, 6]) {
    const next = observe(client);
    await flushPromises();
    expect(fetcher).toHaveBeenCalledTimes(expectedCalls);
    expect(next.observer.getCurrentResult().data).toEqual(expectedCalls === 6 ? summary : null);
    next.unsubscribe();
  }
});

test("fresh cache survives remount and focus; stale status resumes on visibility", async () => {
  vi.useFakeTimers({ now: new Date(summary.updatedAt) });
  focusManager.setFocused(false);
  const fetcher = vi.fn(async () => Response.json(summary));
  vi.stubGlobal("fetch", fetcher);
  const client = createClient();
  const first = observe(client);
  await flushPromises();
  expect(first.observer.getCurrentResult().data).toEqual(summary);
  expect(fetcher).toHaveBeenCalledOnce();

  await vi.advanceTimersByTimeAsync(20_000);
  first.unsubscribe();
  focusManager.setFocused(true);
  const remounted = observe(client);
  await flushPromises();
  expect(remounted.observer.getCurrentResult().data).toEqual(summary);
  expect(fetcher).toHaveBeenCalledOnce();
  focusManager.setFocused(false);
  focusManager.setFocused(true);
  await flushPromises();
  expect(fetcher).toHaveBeenCalledOnce();

  focusManager.setFocused(false);
  await vi.advanceTimersByTimeAsync(STATUS_MAX_AGE_SECONDS * 1000);
  expect(fetcher).toHaveBeenCalledOnce();
  focusManager.setFocused(true);
  await flushPromises();
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test("staggered observers share polling refreshes and an unsubscribed observer stops updating", async () => {
  vi.useFakeTimers({ now: new Date(summary.updatedAt) });
  const downSummary: StatusSummary = { ...summary, status: "down", uptime: 0 };
  let resolveDown!: (response: Response) => void;
  const answers: (() => Promise<Response>)[] = [
    async () => Response.json(summary),
    () => new Promise((resolve) => (resolveDown = resolve)),
    async () => Response.json(summary),
  ];
  const fetcher = vi.fn(() => answers.shift()!());
  vi.stubGlobal("fetch", fetcher);
  const client = createClient();
  const firstUpdates = vi.fn();
  const first = observe(client, firstUpdates);
  await flushPromises();

  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(first.observer.getCurrentResult().data).toEqual(summary);

  await vi.advanceTimersByTimeAsync(20_000);
  const second = observe(client);
  await flushPromises();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(second.observer.getCurrentResult().data).toEqual(summary);

  await vi.advanceTimersByTimeAsync(39_999);
  expect(fetcher).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  await flushPromises();
  expect(fetcher).toHaveBeenCalledTimes(2);
  resolveDown(Response.json(downSummary));
  await flushPromises();

  expect(first.observer.getCurrentResult().data).toEqual(downSummary);
  expect(second.observer.getCurrentResult().data).toEqual(downSummary);
  expect(fetcher).toHaveBeenCalledTimes(2);

  await vi.advanceTimersByTimeAsync(20_000);
  await flushPromises();
  expect(fetcher).toHaveBeenCalledTimes(2);
  const firstUpdateCount = firstUpdates.mock.calls.length;
  first.unsubscribe();

  await vi.advanceTimersByTimeAsync(40_000);
  await flushPromises();
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(second.observer.getCurrentResult().data).toEqual(summary);
  expect(first.observer.getCurrentResult().data).toEqual(downSummary);
  expect(firstUpdates).toHaveBeenCalledTimes(firstUpdateCount);
});

test("last observer cleanup stops polling", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn(async () => Response.json(summary));
  vi.stubGlobal("fetch", fetcher);
  const client = createClient();
  const first = observe(client);
  const second = observe(client);
  await flushPromises();
  expect(fetcher).toHaveBeenCalledOnce();

  first.unsubscribe();
  await vi.advanceTimersByTimeAsync(STATUS_MAX_AGE_SECONDS * 1000);
  expect(fetcher).toHaveBeenCalledTimes(2);

  second.unsubscribe();
  await vi.advanceTimersByTimeAsync(STATUS_MAX_AGE_SECONDS * 1000 * 2);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test("browser renders reuse the provider's query client", () => {
  const browserClients: QueryClient[] = [];
  function QueryClientProbe() {
    browserClients.push(useQueryClient());
    return null;
  }
  const render = () => renderToString(createElement(QueryProvider, null, createElement(QueryClientProbe)));

  expect(render()).toBe("");
  expect(render()).toBe("");
  expect(browserClients).toHaveLength(2);
  expect(browserClients[0]).toBe(browserClients[1]);
});
