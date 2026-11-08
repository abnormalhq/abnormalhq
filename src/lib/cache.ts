/**
 * OpenNext hardcodes s-maxage=..., stale-while-revalidate=2592000 on prerendered responses.
 * There is no CDN cache in front of this site, so the header only affects browsers: a browser serves the cached RSC response first and refreshes in the background.
 * After a deploy the JS and CSS the old response references no longer exist, so they 404. These responses are therefore revalidated with the Worker every time, like static assets.
 */
export function revalidateInBrowser(response: Response): Response {
  if (!response.headers.get("cache-control")?.includes("s-maxage")) return response;
  const revalidating = new Response(response.body, response);
  revalidating.headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  return revalidating;
}
