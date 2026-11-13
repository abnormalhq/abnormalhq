/**
 * Submits every page to IndexNow (src/lib/indexnow.ts). Runs after the deploy in `pnpm cf:deploy`, which is Workers Builds' deploy
 * command, so each production release is announced once it is live; it can also be run by hand:
 *
 *   node scripts/indexnow.ts
 *
 * The deploy has already happened when this runs, so it never fails: a refused or unreachable endpoint is reported and the exit
 * code stays 0. The crawlers simply come back on their own schedule, as without it.
 */
import { indexNowEndpoint, indexNowRequest } from "../src/lib/indexnow.ts";

const body = indexNowRequest();
try {
  const response = await fetch(indexNowEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  // 200 and 202 both mean accepted (202: the key is still being checked).
  if (response.ok) console.log(`IndexNow: submitted ${body.urlList.length} addresses (${response.status}).`);
  else console.warn(`IndexNow: the endpoint answered ${response.status}: ${(await response.text()).slice(0, 300)}`);
} catch (error) {
  console.warn(`IndexNow: not submitted (${error instanceof Error ? error.message : String(error)}).`);
}
