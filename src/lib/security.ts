/**
 * Security headers of every response the Worker gives (pages, Markdown, redirects and the storefront API). Neither Next.js nor OpenNext sets them,
 * and headers() in next.config.ts only reaches the listed pages, not the 404, the redirects or the API, so they are added at the Worker layer like the cache headers.
 * Files served by the static asset service (fonts, /_next/, public/) never pass through the Worker and are not covered.
 */
const securityHeaders: Record<string, string> = {
  // The declared Content-Type is final: a response is never sniffed into a script or a style sheet.
  "X-Content-Type-Options": "nosniff",
  // Other sites learn only the origin, never the path or the query string (order numbers, login and renewal tokens). The storefront pages narrow this further
  // to same-origin with <meta name="referrer"> (src/storefront/metadata.ts), and the shop API sets its own.
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // No page of this site is shown inside a frame, so no other site can overlay one (clickjacking). frame-ancestors is the current form, X-Frame-Options the one
  // old browsers know. The policy is frame-ancestors only: the pages embed Stripe and Turnstile and run an inline theme script, which a full policy would have to list.
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "frame-ancestors 'none'",
  // HTTPS only for a year once visited. Subdomains are left out: webmail, the console and the download bucket are other services that decide for themselves.
  "Strict-Transport-Security": "max-age=31536000",
};

/** Adds the security headers; a header the response already carries (the shop API's Referrer-Policy) is kept. */
export function withSecurityHeaders(response: Response): Response {
  const secured = new Response(response.body, response);
  for (const [name, value] of Object.entries(securityHeaders)) {
    if (!secured.headers.has(name)) secured.headers.set(name, value);
  }
  return secured;
}
