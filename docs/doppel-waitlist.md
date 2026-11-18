# Doppel access waitlist

Doppel is not public. The website takes a request for future access updates only: no product route, sign-in, account, license, invitation, redirect or email is created. Mail is unchanged.

## Review without collecting real data

- Run `pnpm dev`. Both homepages link to their own `#doppel-waitlist`.
- The local form, action and result explicitly say this is a simulation; only `@example.com` addresses can be accepted. Its result never claims real membership or promises email. The mock keeps these in memory until restart and sends nothing.
- Local rate limiting is five attempts per minute across the mock. Reloading does not reset it; restart or wait a minute.
- The production Worker intercepts `/api/waitlist[/]` before the storefront catch-all. The UI checks runtime availability before showing any email field. With the unchanged live configuration, GET reports closed and no email field or submission action is shown; POST returns 503, not a false success.
- No Cloudflare resource, deployment, migration or real registration was made for this change.

## Contract

`GET /api/waitlist/` returns `{"mode":"closed"}`, `{"mode":"preview"}` or `{"mode":"open"}`, using the same runtime services gate as POST. It never reads registrations, writes data or uses a rate-limit attempt. Both the response and client fetch are no-store. While checking, on failure, or when closed, no form is rendered. Static product/footer/Markdown links are availability-neutral. A closed response during submission removes the form too.

`POST /api/waitlist/`, same-origin JSON: `{"email":"person@example.com","lang":"en"}` (`zh` also supported).

| Status | Meaning                                                                                                                                |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| 200    | `{"ok":true,"mode":"open"}`: new or existing normalized address stored; mock uses `"preview"`                                          |
| 400    | Invalid JSON, email or locale, or non-test email in the local mock                                                                     |
| 403    | Cross-origin request                                                                                                                   |
| 405    | Unsupported method; Allow: GET, POST                                                                                                   |
| 413    | Body exceeds 2 KiB, including chunked bodies                                                                                           |
| 415    | Not application/json                                                                                                                   |
| 429    | Rate limited; Retry-After: 60                                                                                                          |
| 503    | Closed/missing bindings (`{"error":"registration_closed","mode":"closed"}`) or persistence/limiter failure (`{"error":"unavailable"}`) |

Addresses are trimmed and lowercased, limited to 254 ASCII characters, and validated on the server. The database uses a unique email key and a parameterized insert with conflict-do-nothing: retries do not change the original locale/date, add duplicates or reveal membership. Success and failure responses never echo personal data. There is no public list/read/export endpoint and no automatic invitation or email.

## Future activation — not performed or approved by this PR

The durable D1 adapter and migration are reviewable now, but **real collection stays off**. `wrangler.waitlist.example.jsonc` contains placeholder bindings for type generation, not deployment. The Worker requires all of:

1. `DOPPEL_WAITLIST_ENABLED="true"` in the real Worker environment.
2. A separately provisioned `DOPPEL_WAITLIST_DB` D1 binding with `migrations_dir: "migrations/waitlist"`, and the reviewed migration applied.
3. `DOPPEL_WAITLIST_LIMITER` with its own rate-limit namespace and `simple: {limit: 5, period: 60}`.

After approval, copy those settings into the real Wrangler config with a real database ID; preserve the existing domains, assets, services and observability. Confirm the first migration is applied before enabling. No fallback to Mail, email, analytics or browser storage exists.

`node scripts/waitlist-types.ts` regenerates the committed bindings from the example using the installed Wrangler. It wraps generated runtime types in module scope to avoid replacing Next.js/browser DOM types. After real binding configuration, generate from that config instead and keep the same isolation.

The table stores only email, preferred language and creation timestamp. IP is used only as the rate-limit key, not stored in the table; no email, IP, body or exception is application-logged. Existing host access logs are subject to the privacy policy. Staff access must remain restricted to the database console; a deletion request can be handled there using a parameterized delete. This PR adds no admin interface, CRM integration or mail campaign.

This is a request list, not an invitation system. Future access notifications, membership removal operations and opening Doppel itself require separate work; joining never grants access.
