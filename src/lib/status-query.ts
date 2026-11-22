import { queryOptions } from "@tanstack/react-query";
import { readStatusSummary, STATUS_API_PATH, STATUS_MAX_AGE_SECONDS } from "./status";

export const STATUS_QUERY_KEY = [STATUS_API_PATH] as const;

async function requestStatus() {
  try {
    const response = await fetch(STATUS_API_PATH, {
      headers: { Accept: "application/json" },
      credentials: "omit",
    });
    return response.ok ? readStatusSummary(await response.json()) : null;
  } catch {
    return null;
  }
}

export const statusQueryOptions = queryOptions({
  queryKey: STATUS_QUERY_KEY,
  queryFn: requestStatus,
  staleTime: (query) => (query.state.data === null ? 0 : STATUS_MAX_AGE_SECONDS * 1000),
  refetchInterval: STATUS_MAX_AGE_SECONDS * 1000,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
  refetchOnReconnect: false,
  retry: false,
  networkMode: "always",
});
