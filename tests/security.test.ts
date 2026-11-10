import { test } from "node:test";
import assert from "node:assert/strict";
import { withSecurityHeaders } from "../src/lib/security.ts";

test("every response carries the security headers, with its status, body and own headers kept", async () => {
  const page = withSecurityHeaders(
    new Response("<!doctype html>", {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", Vary: "RSC" },
    }),
  );
  assert.equal(page.headers.get("x-content-type-options"), "nosniff");
  assert.equal(page.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.equal(page.headers.get("x-frame-options"), "DENY");
  assert.equal(page.headers.get("strict-transport-security"), "max-age=31536000");
  assert.equal(page.status, 404);
  assert.equal(page.headers.get("content-type"), "text/html; charset=utf-8");
  assert.equal(page.headers.get("cache-control"), "private, no-store");
  assert.equal(page.headers.get("vary"), "RSC");
  assert.equal(await page.text(), "<!doctype html>");

  const redirect = withSecurityHeaders(new Response(null, { status: 302, headers: { Location: "/zh/" } }));
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.get("location"), "/zh/");
  assert.equal(redirect.headers.get("x-frame-options"), "DENY");
});

test("the content security policy only forbids framing: the pages embed Stripe and Turnstile and run an inline theme script", () => {
  const policy = withSecurityHeaders(new Response("ok")).headers.get("content-security-policy");
  assert.equal(policy, "frame-ancestors 'none'");
});

test("a header the response set itself is kept, such as the shop API's stricter referrer policy", () => {
  const api = withSecurityHeaders(Response.json({}, { headers: { "Referrer-Policy": "same-origin" } }));
  assert.equal(api.headers.get("referrer-policy"), "same-origin");
  assert.equal(api.headers.get("x-content-type-options"), "nosniff");
});
