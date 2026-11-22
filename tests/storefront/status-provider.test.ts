import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { QueryProvider } from "@/components/QueryProvider";
import { ServiceStatus } from "@/components/ServiceStatus";
import type { Copy } from "@/i18n/types";

const summary = {
  status: "up",
  days: 30,
  uptime: 99.98,
  updatedAt: "2026-11-10T12:00:00.000Z",
};
const copy = {
  label: "Service status",
  states: { up: "All systems operational", down: "Partial outage", maintenance: "Under maintenance" },
  uptime: "{percent}% uptime over the last {days} days",
} as Copy["serviceStatus"];

test("server renders have isolated clients and do not fetch or prerender a status", () => {
  const fetcher = vi.fn(async () => Response.json(summary));
  vi.stubGlobal("fetch", fetcher);
  const serverClients: QueryClient[] = [];
  function ServerStatus() {
    serverClients.push(useQueryClient());
    return createElement(ServiceStatus, { copy, href: "/status/" });
  }

  const render = () => renderToString(createElement(QueryProvider, null, createElement(ServerStatus)));

  expect(render()).toBe("");
  expect(render()).toBe("");
  expect(serverClients).toHaveLength(2);
  expect(serverClients[0]).not.toBe(serverClients[1]);
  expect(fetcher).not.toHaveBeenCalled();
});
