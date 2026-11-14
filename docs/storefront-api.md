# Redemption and Shop API Contract (mailhq side)

The storefront (redeem page, shop, orders, renewal and buyer account, formerly the standalone onboard site) is part of the website: its pages are prerendered by Next.js, the browser requests this site's Worker, and the Worker (`worker.ts` → `src/storefront/worker/`) calls mailhq (`abnormalhq/mail`) internally through the `MAIL` Service Binding.
This document is the contract both sides follow; merchant credentials, signature verification, orders, redeem codes and mailbox activation are all handled by mailhq. The redeem API is described first, then the shop API.

The values both sides would otherwise copy by hand (error `kind` values and status codes, the production site origins, the rules for redeem codes / usernames / passwords / notification addresses, shop routes and methods, cookies, the order page, public order fields, the human verification field names and action, etc.)
are also kept in data form in [`docs/onboard-contract.json`](onboard-contract.json). The mail repository has a byte-for-byte identical copy; the tests on both sides
(`tests/storefront/contract.test.ts` and `tests/storefront/worker.test.ts` here, `src/lib/__tests__/onboard-contract.test.ts` in mail) compare their own constants against it,
so when one side changes and the other does not follow, one side's tests fail. When changing the contract, change both files, both codebases and this document together.

## Redeem API general rules

- The browser always requests the same-origin `POST /api/onboard/{cdk|username|redeem}` at the root path of the origin; no public backend address override is supported. Under `pnpm dev` the same paths are answered by the mock API.
- The `MAIL` binding of the `abnormalhq` Worker points to `abnormalhq-mailhq` in the same account. The redeem API only forwards these three POSTs; the shop has its own allowlist of paths and methods listed below.
  Other API paths or methods are rejected by this site's Worker with a JSON `404` / `405`; `worker.ts` answers every `/api` request before OpenNext, so they never reach Next.js. Static assets such as scripts and fonts are served first.
- The Worker builds the internal request URL with the server-side `MAIL_ORIGIN`, so that mail's OpenNext initializes with its own origin; the production value has been verified as
  `https://console.abnormalhq.com`, configured in the `vars` of `wrangler.jsonc`, and must be updated when mail changes domain. The variable is not passed to the browser and
  does not change the binding's target service; calls always go through `MAIL.fetch`, and the `Origin` request header is still the browser's origin.
- Requests and responses are JSON (`Content-Type: application/json`). Requests **carry no cookies** (`credentials: omit`): the redeem code itself is the credential, and
  mailhq's `src/proxy.ts` must let unauthenticated requests through for `/api/onboard/` (as it does for `/api/health`).
- The redeem page sends `Accept-Language: zh` or `en` according to the selected language, and the Worker forwards it unchanged to mailhq; backend error descriptions are returned in the request language.
- All three endpoints require `code` in the body; without a valid redeem code no question is answered (not even whether a username is taken), so the API cannot become an entry point for probing usernames.
- Success: `2xx` + the response body described below. Failure: non-2xx + `{ "error": "<human-readable localized description>", "kind": "<see table below>", "field"?: "code" | "domain" | "count" | "username" | "password" | "notify", "index"?: <position within the batch, from 0> }`.
  `field` says which field the error should be shown next to; errors without `field` are shown at the bottom of the form. The redeem page picks local copy (in both languages) by `kind`, and shows `error` as-is when the `kind`
  is unknown.
- Origin check: the browser-to-this-site API request is same-origin and needs no CORS preflight. This site's Worker preserves `Origin`, and mailhq still verifies the origin against `ONBOARD_ORIGIN`,
  so that variable must include this site's actual origin; separate multiple origins with spaces or commas. Production lists `https://abnormalhq.com` and the retired
  `https://onboard.abnormalhq.com` (the contract's `redeem.storefrontOrigins`; the old one can go once its domain only redirects here), and the local Wrangler preview is
  `http://localhost:8786`. mailhq's existing CORS handling stays in place, but the browser no longer talks to mailhq directly.
- Rate limiting: limited per source IP, with the exact quotas defined by mailhq's `ONBOARD_RULES`; exceeding them returns `429` + `kind: "rate_limited"` and `Retry-After`. The redeem code space is
  32<sup>16</sup>, so brute force is infeasible; rate limiting only prevents harassment and consumption of the provider's API write quota. This site's Worker preserves `CF-Connecting-IP`, so that mailhq
  can rate-limit by client IP and record the redemption origin.
- Redeem code normalization: strip everything that is not a letter or digit and uppercase; 16 characters; alphabet `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (0/O and 1/I removed).
  For display, group in fours separated by hyphens.
- When the internal call fails, or mail returns a redirect or a non-JSON response (for example the plain-text `503` when the local binding is not yet connected), this site's Worker returns a JSON
  `503` with `kind: "unavailable"`; it does not retry activation requests and does not fall back to the public mailhq address. A misconfigured `MAIL_ORIGIN` gives the same `503`.
  The Worker builds the response headers itself, taking only `Content-Type` and `Retry-After` from mail and adding `Cache-Control: no-store`; the Worker's own error descriptions are likewise returned in the request language.
  The Worker does not log request or response bodies, passwords or redeem codes.

### Development and local integration with mail

`pnpm dev` serves a mock API at `http://localhost:4320` and needs no mail service. For real integration, first prepare the local database and `.dev.vars` in the mail repository,
set `ONBOARD_ORIGIN=http://localhost:8786`, and run `pnpm cf:preview --port 8788` (the command includes the build);
then in this repository run `cp .dev.vars.example .dev.vars`, pair `MAIL_ORIGIN=http://localhost:8788` with mail's port,
run `pnpm cf:preview`, and open `http://localhost:8786`. When changing mail's port, update `MAIL_ORIGIN` here accordingly;
when changing this site's preview port, update mail's `ONBOARD_ORIGIN`.
Wrangler connects the local `MAIL` binding by Worker name; when mail is not running it returns `503 unavailable` and never calls the production mail.

### `kind` and HTTP status

| kind               | Status  | field    | Meaning                                                                                                  |
| ------------------ | ------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `invalid_code`     | 404     | code     | The redeem code does not exist (or is malformed)                                                         |
| `code_used`        | 409     | code     | No uses left                                                                                             |
| `code_expired`     | 410     | code     | Past its expiry date                                                                                     |
| `code_disabled`    | 403     | code     | Disabled by an administrator                                                                             |
| `count_exceeded`   | 409     | count    | The batch size exceeds what the redeem code can still activate, or exceeds the limit of 20 per request   |
| `domain_invalid`   | 400     | domain   | This redeem code does not allow activation on that domain                                                |
| `username_invalid` | 400     | username | Does not meet the local-part rules (see below)                                                           |
| `username_taken`   | 409     | username | Already exists under the same domain (in local records or already on the Stalwart server)                |
| `password_invalid` | 400     | password | Does not meet mailhq's password requirements                                                             |
| `notify_invalid`   | 400     | notify   | The address that receives the account details is malformed or too long                                   |
| `rate_limited`     | 429     | -        | Too many requests                                                                                        |
| `challenge_failed` | 403     | -        | Human verification is on and no token was sent, or the token is invalid, expired or already used         |
| `unavailable`      | 503     | -        | Internal call failed, mail service not connected, API error or write rate limit; cannot activate for now |
| `other`            | 4xx/5xx | -        | Other (invalid parameters, internal error; an origin not in `ONBOARD_ORIGIN` gives 403)                  |

## `POST /api/onboard/cdk` Verify the redeem code

Request: `{ "code": "ABCD-EFGH-JKLM-NPQR" }`

Response `200`:

```json
{
  "domains": ["abnormalhq.com"],
  "quotaSupportedByDomain": { "abnormalhq.com": true },
  "expiresAt": "2026-10-20T00:00:00.000Z",
  "usesLeft": 1
}
```

- `domains`: the domains on which this redeem code can activate mailboxes, at least one, the first being the default; only domains managed in "Settings" are listed.
- `quotaSupportedByDomain`: per-mailbox hard quota capability returned per domain; only domains explicitly bound to a single active Stalwart connection return `true`. Contains no management connection credentials.
- `expiresAt`: ISO 8601, `null` means never expires. `usesLeft`: how many more mailboxes can be activated, always a non-negative integer (every redeem code has a limited number of uses, at most 1000 in mail; there is no "unlimited");
  the redeem page uses it to show the count dropdown (at most 20 per request), and treats a value that is not a non-negative integer as an invalid response format.
- `turnstileSiteKey`: present only when mailhq has Cloudflare Turnstile human verification enabled. The redeem page uses it to render the verification widget above the submit button and sends the token when activating.
- The redeem page calls this as soon as the user has typed all 16 characters, and shows the domain selector (when there are several) and the expiry according to the response.

## `POST /api/onboard/username` Check the username

Request: `{ "code": "…", "domain": "abnormalhq.com", "username": "kunish" }`

Response `200`: `{ "available": true, "email": "kunish@abnormalhq.com" }`; taken usernames and similar cases go through the error response (`username_taken` etc.).

- The server first normalizes with mailhq's `normalizeUsername` (trim whitespace, lowercase, drop everything after @), then validates against `LOCAL_PART_PATTERN`
  (`^[a-z0-9](?:(?:[a-z0-9_-]|\.(?!\.)){0,62}[a-z0-9])?$`: starts and ends with a letter or digit, no two consecutive dots, at most 64 characters).
- "Taken" is determined by mailhq's `existingUsernames` query against local records and by `listMailboxes(domain)` against the Stalwart server; existence in either means taken.
- The redeem page calls this 500ms after typing pauses, only as an early hint; the activation step is authoritative.

## `POST /api/onboard/redeem` Activate mailboxes

Request: `{ "code": "…", "domain": "abnormalhq.com", "mailboxes": [{ "username": "kunish", "password": "Aa1aaaaaaaaaaaaa" }, …], "notify"?: "me@example.com", "lang"?: "zh", "turnstileToken"?: "…" }`

- `turnstileToken`: required when mailhq has human verification enabled; it is the one-time token issued by the Turnstile widget (action `onboard-redeem`), verified before anything else is processed;
  missing or invalid returns `challenge_failed` (403). The token can be used only once, and the redeem page resets the widget after every submission.

- `mailboxes` is the batch of mailboxes to activate, 1 to 20, with distinct usernames; the total must not exceed what the redeem code can still activate (`usesLeft`).
  The earlier single form `{ "code", "domain", "username", "password" }` is also accepted and is equivalent to a one-element array.
- `notify` optional: the address that receives the account details. The server trims whitespace and lowercases, checks only the most basic shape (exactly one `@`, non-empty on both sides, a dot in the domain)
  and the 254-character limit, and returns `notify_invalid` (400, `field: "notify"`) when it does not comply; an empty string or absence counts as not provided. `lang` optional, `zh` / `en`,
  only determines the language of the notification email; when absent or unrecognized, the request language is used (`Accept-Language`, `en` when nothing matches).
- Batch-wide problems (redeem code, domain, count exceeded, a username that is invalid or taken, an invalid password, duplicate names within the batch, an invalid notification address) are returned as a normal error response,
  and no mailbox is activated; errors that point at one mailbox carry `index` (from 0). `kind: "count_exceeded"` (409, `field: "count"`) means the quota was exceeded.

Response `201`:

```json
{
  "domain": "abnormalhq.com",
  "mailboxes": [
    {
      "ok": true,
      "index": 0,
      "username": "kunish",
      "email": "kunish@abnormalhq.com",
      "password": "Aa1aaaaaaaaaaaaa"
    },
    {
      "ok": false,
      "index": 1,
      "username": "team",
      "error": "邮件服务暂时不可用，请稍后再试。",
      "kind": "unavailable",
      "field": null
    }
  ],
  "imap": { "host": "mail.example.com", "port": 993, "security": "tls" },
  "smtp": { "host": "mail.example.com", "port": 465, "security": "tls" },
  "webmail": "https://webmail.abnormalhq.com",
  "notification": { "to": "me@example.com", "sent": true, "error": null }
}
```

- Mailboxes are activated one by one; one failure does not affect the others, and every one gets a result in `mailboxes`: success carries the credentials, failure carries the reason (`kind` / `field` are the same set as in the error response);
  when the redeem code runs out midway, all the following ones are `code_used`. When all fail, the first one's reason is returned as a normal error response.
- Password validation matches mailhq's `mailboxPasswordError` and `parsePassword`: 8-128 characters, no whitespace, no specific character classes required.
- What the server does for each mailbox, in order: take one use from the redeem code (atomically) -> `createMailbox` (register locally as "pending", `cdk_id` records the origin, no note is written) ->
  push to the Stalwart server bound to the domain to create it (using the redeem code's quota when it is configured with a positive quota and the domain supports it, otherwise the connection's default quota) -> mark as "active" -> write the redemption record (whose IP, which mailbox, when) ->
  write the operation log (`action: "mailbox.redeem"`, `target` is the mailbox, `detail` carries the redeem code). A local registration collision or a push failure returns the use and deletes the local record,
  leaving no pending record; if the remote creation succeeds but the local status update or logging fails, the created mailbox is kept and the credentials are returned, without creating again or returning the use.
- `imap` / `smtp` are resolved from the single active connection of the domain activated in this request. For a manually configured connection the IMAP / SMTP settings in "Settings" are used; other connections use their own TLS endpoints.
  When not configured or unresolvable they are `null`; `security` is `tls` / `starttls` / `none`. The servers in the example above are illustrative; clients must use the actual response values.
  `webmail` comes from mailhq's `STALWART_WEBMAIL_URL`, `null` when not configured. The redeem page only accepts a valid HTTPS URL; without one it does not show the webmail button.
  The static FAQ / tutorials use `webmailUrl` from `src/config.ts` (`https://webmail.abnormalhq.com`), which does not override the activation result.
- The password is returned only in this activation response; the redeem page shows it in the current page state and does not write it to persistent browser storage. mailhq still stores the mailbox password for management and protocol login, so the one-time display on the frontend must not be taken to mean the backend does not store passwords.
- `notification`: when the request carried `notify` and at least one mailbox was activated, the server sends the successfully activated mailbox addresses, passwords, IMAP / SMTP servers and webmail entry point of this batch
  to that address (sent from the service mailbox in mailhq's "Settings", with the same SMTP as invitation / password reset emails), and then reports the result here: `sent` is `true` when it was sent successfully,
  and when `false`, `error` is the reason it was not sent (returned in the request language). A send failure does not affect activation; the mailboxes are still activated and their credentials are given in `mailboxes`.
  Without `notify` the whole field is `null` (the redeem page also accepts it being absent). One email per request: activating in several requests sends several emails.
- When no mail service is connected (local-registration-only mode) redemption must not be open: return `unavailable`, otherwise the user gets a mailbox that does not exist at all.

## Admin side (the "Redeem codes" page in mailhq)

The redeem page never accesses the admin side or the database directly; mailhq's implementation lives in `src/lib/cdk/` (`cdks.ts`, `rules.ts`), `src/app/cdks/` and `src/app/actions/cdks.ts`,
with the table structure in each workspace's schema (`migrations/postgres-tenant/`), connecting to PostgreSQL through Hyperdrive without query caching. The earlier SQLite / D1 migrations
(including `0009_cdks.sql`) were removed from the mail repository on 2026-11-01 and remain only in Git history.

- Table `cdks`: `id`, `code` (plaintext, since administrators must copy it and send it to people; the same trade-off as storing mailbox passwords in plaintext; unique index), `domains`
  (JSON array, an empty array meaning all managed domains), `uses_max`, `uses_left`, `quota_mb` (0 means the connection's default quota), `expires` (ISO, empty means never expires),
  `disabled`, `note`, `created_by` (administrator email), `created`, `updated`. Table `cdk_redemptions`: `id`, `cdk_id`, `mailbox_id`,
  `ip`, `created`.
- Pages: bulk-generate N codes (choose domains, uses, expiry, quota, note), list (status: available / used up / expired / disabled, uses left,
  redemption records), copy / export CSV, disable / delete (codes that already have redemption records can only be disabled). Permissions are at the same level as "edit mailbox accounts" (administrators, operators).
- Operation log: one entry each for generation, disabling and deletion.

## Shop API

The buyer entry point is `https://abnormalhq.com/shop/`, the order page is `/shop/orders/?id=<order id>`, the renewal page is `/shop/renew/?t=<renewal token>`,
and the account page is `/shop/account/`; as on the rest of the site these are the English pages, and the Chinese ones are under `/zh/` (`/zh/shop/orders/` etc.). Mailbox redemption is at `/redeem/` (`/zh/redeem/`), and the admin side stays at
`https://console.abnormalhq.com/sales`. These endpoints live at the root path `/api/shop/` of the origin and call the backend through the same `MAIL` Service Binding as the redeem API,
so the browser never makes cross-origin requests to mailhq directly. The Stripe webhook (`/api/shop/stripe/webhook`) is called by Stripe directly on mail's domain and does not go through this site.

| Method | Path                                   | Request                                                                                    | Success response                                                                       |
| ------ | -------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| GET    | `/api/shop/catalog`                    | None                                                                                       | `200`, `{ available, payment, products, seatProducts?, onboardUrl, coupons }`          |
| POST   | `/api/shop/address`                    | JSON: `{ domain, username }`, no cookie                                                    | `200`, `{ available, email }` (see "Checking an address before buying")                |
| POST   | `/api/shop/coupon`                     | JSON: `{ productId, provider?, coupon, quantity? }`, or `{ products: [...], coupon }`      | `200`, `{ valid: true, … }` or `{ valid: false }`; `{ quotes }` (see "Discount codes") |
| POST   | `/api/shop/quote`                      | JSON: `{ productId, providers?, provider?, quantity?, coupon? }` (see "Seat plans")        | `200`, what the order would cost, one price per way of paying asked                    |
| POST   | `/api/shop/checkout`                   | JSON: `{ productId, email?, provider?, coupon?, quantity? }`                               | `201`, `{ orderId }`, and sets the buyer cookie                                        |
| GET    | `/api/shop/orders?id=<order id>`       | Buyer cookie or account cookie                                                             | `200`, `{ order, code, codeStatus, onboardUrl, subscription }`                         |
| POST   | `/api/shop/pay`                        | Form: `orderId=<order id>&lang=zh\|en`, `application/x-www-form-urlencoded`                | `303` to LDC payment, Stripe's hosted payment page, or back to the order page          |
| POST   | `/api/shop/pay/stripe`                 | JSON: `{ orderId, lang? }`                                                                 | `200`, `{ status: "open", clientSecret, publishableKey }` or `{ status }`              |
| POST   | `/api/shop/pay/usdt`                   | JSON: `{ orderId }` (see "USDT payments")                                                  | `200`, `{ status: "open", address, amount, … }` or `{ status: "paid" }`                |
| POST   | `/api/shop/reconcile`                  | JSON: `{ orderId }`                                                                        | `200`, `{ "status": "pending" }` or `{ "status": "paid" }`                             |
| GET    | `/api/shop/notify`                     | Credit signed notification parameters                                                      | `200`, plain text `success`; on failure `fail` with the corresponding non-2xx status   |
| POST   | `/api/shop/renewal`                    | JSON: `{ token }` (renewal token)                                                          | `200`, the subscription's renewal info (see below)                                     |
| POST   | `/api/shop/renew`                      | JSON: `{ token, periods, email?, provider?, coupon? }`                                     | `201`, `{ orderId }`, and sets the buyer cookie                                        |
| GET    | `/api/shop/account`                    | Account cookie                                                                             | `200`, the account (see below); `401` when not logged in                               |
| POST   | `/api/shop/account/login`              | JSON: `{ email, turnstileToken? }`                                                         | `200`, `{ "sent": true }`, sends a login link to that email                            |
| POST   | `/api/shop/account/peek`               | JSON: `{ token }` (login token)                                                            | `200`, `{ email }`; read-only, does not consume the token or set a cookie              |
| POST   | `/api/shop/account/verify`             | JSON: `{ token }`                                                                          | `200`, `{ email, claimed }`, and sets the account cookie                               |
| POST   | `/api/shop/account/logout`             | JSON: `{}`                                                                                 | `200`, `{ "ok": true }`; the Worker always clears the account cookie                   |
| POST   | `/api/shop/account/portal`             | JSON: `{ subscriptionId }`                                                                 | `200`, `{ url }` (the customer portal at `https://billing.stripe.com/…`)               |
| POST   | `/api/shop/account/password-login`     | JSON: `{ email, password, turnstileToken? }`                                               | `200`, `{ email, claimed }`, and sets the account cookie                               |
| POST   | `/api/shop/account/password`           | JSON: `{ password, currentPassword? }` (account cookie)                                    | `200`, `{ "ok": true }`; sets or changes the login password                            |
| POST   | `/api/shop/account/register`           | JSON: `{ email, password, turnstileToken? }`                                               | `200`, `{ "sent": true }`, sends a registration confirmation link to that email        |
| GET    | `/api/shop/account/mailboxes`          | Account cookie                                                                             | `200`, mailbox management (see below); `401` when not logged in                        |
| POST   | `/api/shop/account/mailboxes/create`   | JSON: `{ orderId, domain, username, password }`                                            | `201`, `{ email, imap, smtp, webmail }`                                                |
| POST   | `/api/shop/account/mailboxes/password` | JSON: `{ mailboxId, password }`                                                            | `200`, `{ email }`                                                                     |
| POST   | `/api/shop/account/mailboxes/status`   | JSON: `{ mailboxId, status }` (`active` / `disabled`)                                      | `200`, `{ status }`                                                                    |
| POST   | `/api/shop/account/mailboxes/delete`   | JSON: `{ mailboxId, confirm }` (`confirm` repeats the email address)                       | `200`, `{ "ok": true }`                                                                |
| POST   | `/api/shop/account/seats/quote`        | JSON: `{ orderId, add }` (see "Seat plans")                                                | `200`, `{ add, seats, provider, currency, priceCents, exact, periodEnd }`              |
| POST   | `/api/shop/account/seats/add`          | JSON: `{ orderId, add }`                                                                   | LDC `201`, `{ orderId }` and the buyer cookie; card `200`, `{ status, seats, … }`      |
| POST   | `/api/shop/account/seats/remove`       | JSON: `{ orderId, remove, mailboxIds }`                                                    | `200`, `{ seats, seatsNext, effective, removing }`                                     |
| POST   | `/api/shop/account/seats/keep`         | JSON: `{ orderId }`                                                                        | `200`, `{ seats, seatsNext: null, effective, removing: [] }`                           |
| GET    | `/api/shop/account/domains`            | Account cookie (see "Buyer domains")                                                       | `200`, `{ limit, domains }`; `401` when not logged in                                  |
| POST   | `/api/shop/account/domains/add`        | JSON: `{ domain }`                                                                         | `201`, `{ domain }` with the ownership TXT record                                      |
| POST   | `/api/shop/account/domains/verify`     | JSON: `{ id }`                                                                             | `200`, `{ domain, records, ready, checkedAt }`                                         |
| POST   | `/api/shop/account/domains/check`      | JSON: `{ id }`                                                                             | `200`, `{ domain, records, ready, checkedAt }`                                         |
| POST   | `/api/shop/account/domains/refresh`    | JSON: `{ id }`                                                                             | `200`, `{ domain }` with a new ownership value                                         |
| POST   | `/api/shop/account/domains/remove`     | JSON: `{ id }`                                                                             | `200`, `{ "ok": true }`                                                                |
| POST   | `/api/shop/account/forgot`             | JSON: `{ email, turnstileToken? }`                                                         | `200`, `{ "sent": true }`; sends a password reset email when this account exists       |
| POST   | `/api/shop/account/reset`              | JSON: `{ token, password }` (reset token)                                                  | `200`, `{ email, claimed }`, and sets the account cookie                               |
| POST   | `/api/shop/account/google/start`       | JSON: `{ lang?, link? }`                                                                   | `200`, `{ url }` (Google authorization page), and sets the Google state cookie         |
| POST   | `/api/shop/account/google`             | JSON: `{ code, state }` (as sent back by Google to the account page) + Google state cookie | `200`, `{ email, claimed, created, linked, lang }`, sets the account cookie on login   |
| POST   | `/api/shop/account/google/unlink`      | JSON: `{}` (account cookie)                                                                | `200`, `{ "ok": true }`; `404` when not linked                                         |

Failure statuses: except for `pay` (always `303`, see below), every shop POST may return `403` (`Origin` is not the storefront address in the sales settings; the Worker rejects cross-site origins first),
`415` (wrong body type), `413` (body over 4 KiB), `400` (invalid body or field), `429` (rate limited, with `Retry-After`) and `503` (backend temporarily unavailable).
Per endpoint, additionally: `checkout` has `409` (product withdrawn, domain no longer managed or no card price), `400` (a discount code that cannot be used) and `503` (sales paused or this payment method not enabled);
`orders` and `reconcile` have `404` (order does not exist or credential does not match); `renewal` has `404` (token invalid or expired); `renew` has `404` (token),
`409` (Stripe subscriptions cannot be renewed manually) and `400` (wrong number of periods or total over the per-payment limit); `account` has `401` (not logged in);
`pay/usdt` has `404` (order not found or credential mismatch; also a mail before USDT), `409` (not a USDT order, USDT switched off, or an order that can no longer be paid) and `503` (USDT not configured);
`account/peek` and `account/verify` have `400` (link invalid, expired or already used); `account/login` has `403` (human verification on and token missing, invalid or already used)
and `503` (email could not be sent);
`account/portal` has `401` (not logged in), `404` (not a Stripe subscription of this account) and `503`;
`account/password-login` has `401` (wrong email or password; a non-existent account or one that never set a password gives the same) and `403` (human verification, as for `account/login`);
`account/password` has `401` (not logged in), `400` (new password not 8-128 characters) and `403` (current password required but missing or wrong);
`account/register` has `400` (invalid email or password), `403` (human verification) and `503` (email could not be sent);
`account/mailboxes/*` have `401` (not logged in), `404` (order or mailbox not under this account, without saying whether it exists), `409` (subscription suspended, or username taken, or redeem code used up)
and `400` (invalid username, password, domain or status, or the email address typed wrong on delete).

General shop errors are non-2xx `{ "error": "<human-readable description>" }`, returned in the request language (`Accept-Language: zh` or `en`, which the shop pages send explicitly);
do not apply the redeem API's `kind` enum. Pages show this description first, and fall back to their own generic copy by status only when there is none.

**Coded refusals** (contract version 3, `shop.refusalFields`, `refusalLanguages` and `refusalCodes` in `docs/onboard-contract.json`). The refusals about a
seat quantity, a discount code, a plan and a buyer's domain answer `{ error, code, messages: { zh, en }, ...details }` with the status the contract gives
the code: `code` is stable and is what the pages branch on, `messages` is the buyer-facing text in both languages, and the details are numbers only (`min`
and `max` of a plan's range, `maxTotalCents`, and `index` where the refused request listed several plans: the position, from 0, of the entry of the
preview's `products` it is about). `maxTotalCents` is one number for every way of paying (`shop.seats.maxTotalCents`), counted in the unit that way
charges in (`shop.seats.maxTotalCentsUnit`: hundredths of an LDC, or the smallest unit of the card currency). The client (`parseRefusal` and `ShopApiError` in `src/storefront/lib/catalog.ts`) keeps all three, and
`shopError` shows `messages[<page language>]` when a `code` is there, falling back to `error` (a mail before coded refusals, a refusal without a code, a
language mail did not send). A code this storefront does not know yet is kept and its text shown. The codes: `seat_quantity_invalid`,
`seat_quantity_out_of_range` (`min`, `max`), `seat_total_too_large` (`maxTotalCents`), `coupon_invalid` (checkout and `pay/stripe`),
`product_unavailable` (checkout and the quote, `409`), and for a buyer's domain `domain_not_found` (`404`), `domain_ownership_not_found`,
`domain_ownership_expired`, `domain_dns_lookup_failed`, `domain_already_verified`, `domain_verification_refused` (`409`) and `domain_unavailable`
(`503`). The Worker passes the body through unchanged.
The platform notification is handled as plain text, the payment endpoint as form and redirect, and the remaining endpoints use JSON. A failed internal call does not automatically retry order creation or payment requests, nor fall back to the public backend address.

### Products, orders and payment

- `catalog` returns only products that are on sale and whose domains are still managed; when sales are not open, `available` is `false` and `products` is empty. A product contains `id`, `name`,
  `description`, `originalPriceCents`, `discountPercent`, `priceCents`, `domains`, `mailboxCount`, `quotaMb`, `quotaSupportedByDomain`, `codeExpiresDays`;
  subscription products also have `periodDays` (period length in days, 0 for a one-time purchase) and `renewPriceCents`, and those that can be bought by card have `fiatPriceMinor` (in the smallest unit of the shop currency, 0 meaning it cannot be bought by card);
  Client ID, Client Secret and backend settings are not returned. `payment` is `{ ldc: boolean, stripe: { currency } | null, usdt: { currency, network, contract } | null }`, with the payment methods toggled separately, and
  `stripe.currency` is a three-letter lowercase ISO 4217 code; when an old backend does not return `payment`, treat it as LDC only, and a `payment` without `usdt` (a mail before USDT) as without USDT.
  Products that can be bought with USDT also have `usdtPriceMinor` (hundredths of a USDT; 0 or absent meaning not with USDT; see "USDT payments").
  `originalPriceCents` is the original price and `priceCents` the price actually paid, both positive integers in cents; `discountPercent` is an integer 0-99, with 25 meaning 25% off.
  The original price must not be lower than the price paid, and the two are equal when there is no discount (0); the frontend displays the backend amounts and does not recalculate or submit the price paid itself.
  Prices are in integer hundredths of an LDC; `codeExpiresDays` of 0 means the redeem code never expires, and says nothing about the mailbox service period.
- `checkout` accepts only a product ID; `provider` defaults to `ldc`, `stripe` means bank card (the product must have `fiatPriceMinor` and Stripe must be enabled in the backend),
  and `usdt` means USDT on TRON (the product must have `usdtPriceMinor` and `payment.usdt` must be on). Every client request sends `provider` whenever it is not `ldc`, and never for LDC, so a mail that only knows LDC sees no new field;
  `email` is optional, the contact address for subscription expiry reminders. The backend saves a snapshot of the original price, discount rate, price paid and entitlements; later product adjustments do not change the order snapshot.
  Prices passed in by the browser play no part in billing; products whose sales are paused, that are withdrawn or whose domain is no longer valid cannot be ordered. The request language is recorded on the order, for reminder emails and the return page after payment.
- Order lookup only reads the single order the current browser can access: the buyer cookie is the one that placed the order, or the logged-in account owns it; there is no public order list. `order` is the order's public projection
  (mail's `PUBLIC_ORDER_FIELDS`): `id`, `productName`, the price and entitlement snapshot (`originalPriceCents`, `discountPercent`,
  `priceCents`, `domains`, `mailboxCount`, `quotaMb`, `quotaSupportedByDomain`, `codeExpiresDays`, `periodDays`, `renewPriceCents`),
  `kind` (`purchase` / `renewal`), `subscriptionId`, `periods`, `provider`, `currency` (the currency of Stripe orders, in whose smallest unit `priceCents` is expressed; `"usdt"` for USDT orders, in hundredths of a USDT),
  `status`, `created` and `paidAt`. The merchant ID (LDC Client ID), the payment provider's transaction ID, the product id and the redeem code's row id are not returned; pages also do not read these fields when an old mail version returns them.
  While payment is pending, `code` and `codeStatus` are `null`; only after payment is confirmed are the formatted redeem code and its status (`available` / `used` / `expired` / `disabled`) returned.
  Paid subscription purchase orders and renewal orders carry `subscription`: `{ currentPeriodEnd, state, renewToken, provider, autoRenew }`, where `state` is `active` / `grace` / `suspended` / `expired`.
  `renewToken` is currently always a string; pages also accept `null` (the same rule as `account`: Stripe subscriptions, or a renewal price outside the payable range), in which case no renewal link is shown.
  Only once all deployed pages accept `null` will mail switch to returning it under that rule. When the order is not found or the credential does not match, `404` is returned uniformly.
- `pay/stripe` pays a card order on the order page itself: the page initializes Stripe.js with the returned `clientSecret` (a Checkout Session in `ui_mode: elements`) and `publishableKey`
  (the Stripe publishable key, which is public anyway) and embeds Stripe Elements, so the card number only passes through Stripe's iframe. `status` may also be
  `hosted` (no publishable key configured in the backend: the page uses the `pay` form below instead), `paid` (already paid, possibly completed in this very step) or `processing` (the buyer
  already paid and the bank debit is on its way; nothing more to pay). `lang` is the page language: a payment method that must authenticate on a bank or wallet page is sent back by Stripe to
  the order page in that language; cards are confirmed in place and the buyer never leaves the page. When an old Worker or mail does not have this endpoint (`404`), the page falls back to the
  `pay` form the same way. Errors: `404` (order not found or credential mismatch), `409` (not a card order, or Stripe is off), `429` (6 per order per minute).
- `pay` is signed by the backend, which talks to Credit or Stripe; the browser never touches merchant secrets. The form's `lang` is the language of the page where "Pay" was clicked: success, cancellation and failure all return to the order page in that language
  (`/shop/orders/` or `/zh/shop/orders/`; while the storefront address in mail's sales settings is still the old onboard site, mail builds that site's layout, `/shop/orders/` for Chinese and `/en/shop/orders/` for English). When an old page does not send it, the payment provider's return addresses (LDC's `return_url`, Stripe's success and cancel URLs, which send the browser straight to the page)
  use the language recorded at order time; mail's own `303`s (already paid, Checkout already completed, `&error=payment`) go through the Worker, and the old Worker only allows `/shop/orders`,
  so they still return to the Chinese order page. LDC's per-payment return address carries the order id, and the application-level callback URI is only a fallback
  that must not forcibly override `return_url`; when the storefront address only has room for the Chinese path (100-character limit), English buyers also return to the Chinese order page.
- The Worker allows only three `303` destinations: `https://credit.linux.do/paying`, `https://checkout.stripe.com/c/pay/…` (keeping the `#fid…` fragment, without which Checkout does not open)
  and this site's `/shop/orders`, `/zh/shop/orders` or the old site's `/en/shop/orders` (without fragment; `next.config.ts` 301s the last to `/shop/orders/`); other destinations and other redirect statuses are not allowed, and the log records only the origin of the rejected destination.
  `pay` is a full-page form submission, so any failure of it (destination not allowed, a JSON error from mail, a non-JSON response, a failed internal call, a cross-site or malformed request) is turned by the Worker into a
  `303` back to `/shop/orders/?id=<order id>&error=payment` in the form language (without `id` when the order id is invalid), and the page uses this to say the payment did not open, instead of stopping on a page of JSON.
- `notify` does not depend on browser cookies or `Origin`; mailhq verifies the signature, merchant, order, amount and transaction status and then atomically issues one CDK.
  Duplicate or concurrent notifications do not issue a code twice. The browser return and its query parameters by themselves cannot confirm payment; when the notification is delayed, `reconcile` has the backend query Credit or Stripe to fill in the status.

### USDT payments

`shop.usdt` in `docs/onboard-contract.json` (mail's docs/shop.md, "USDT payments"). The buyer sends USDT (TRC-20) on TRON to an address that
belongs to their order alone (mail derives it from the shop's extended public key); mail watches the chain (TronGrid) and the order is paid,
and its code issued, once the confirmed total at that address reaches the amount, about a minute after sending.

- **Units.** Every amount of a USDT order, quote, plan or seat subscription is in hundredths of a USDT with `currency: "usdt"` (four letters, not
  ISO 4217). The pages write it `12.34 USDT` (two decimals, no Intl currency style). Like a card price a USDT price has no plan discount
  (`discountPercent` 0, `originalPriceCents === priceCents` before a code). `seat_total_too_large.maxTotalCents` for USDT is in hundredths of a USDT
  (`shop.seats.maxTotalCentsUnit.usdt`).
- **Catalog.** `payment.usdt` is `{ currency: "usdt", network: "mainnet" | "nile", contract }` while USDT is on, and `null` or absent otherwise;
  `nile` is TRON's testnet, and the pages show a "Testnet (Nile)" badge next to the USDT price and on the payment panel. A `payment.usdt` with an
  unknown network or a contract that is no TRON address counts as off, like a card with an unusable currency. A plan offers USDT when
  `payment.usdt` is there and its `usdtPriceMinor` is above 0; a seat plan's `unitUsdtPriceMinor` (one seat; `shop.usdt.seatPlanFields`) falls back to
  `usdtPriceMinor` the way `unitFiatPriceMinor` falls back to `fiatPriceMinor`. The shop page shows a third button, "Pay with USDT", with its price
  (per period for a subscription); a seat plan's USDT total is quantity × `unitUsdtPriceMinor` as an estimate until the quote has mail's number.
- **Checkout, quote, discount codes.** `checkout`, `coupon` (both forms), `renew` and the quote's `providers` take `"usdt"`. A USDT quote price has
  `currency: "usdt"`, `discountPercent: 0` and `planDiscountCents: 0`; an entry (or a code preview) whose currency is not the one of its way of paying
  (`""` for LDC, the card currency for Stripe, `"usdt"` for USDT) fails the answer. A percentage code applies to a USDT price; a fixed-amount code never
  does (`{ valid: false }`), and the page says the code can't be used with USDT.
- **`pay/usdt`** (`POST`, JSON `{ orderId }`, same origin, the buyer and account cookies as for `pay/stripe`) answers `{ status: "paid" }` (already
  paid, possibly just now) or `{ status: "open", network, token: "USDT", contract, address, amount, amountMinor, received, confirming }`
  (`shop.usdt.payFields`): `address` is the order's own base58 TRON address (`T` and 33 characters), `amount` the exact amount to send as a decimal string
  (`amountMinor` the same in hundredths; the client refuses an answer where the two disagree), `received` what the chain has confirmed at the address so
  far and `confirming` what it has seen but not yet confirmed (decimal strings, up to six decimals). Each call has mail look at the chain (it throttles
  that itself), so the order page calls it every 5 seconds while the tab is visible, for up to 2 hours, then stops and offers "Check again". While
  `confirming` is above 0 the page says the payment was detected and is waiting for confirmation; when `received` is above 0 but below `amount` it says
  how much arrived and asks for the rest (the order is paid once the confirmed total reaches the amount). On `paid` the page reads the order again
  (`orders`) and shows the code as for any other way of paying. `reconcile` also works for a USDT order. Errors: `404` (order not found or credential
  mismatch), `409` (not a USDT order, USDT switched off, or an order that can no longer be paid, such as a seat order priced to a period that was
  renewed since), `429` with `Retry-After` and `503` (USDT not configured). The Worker proxies it like `pay/stripe` (JSON in and out, never a
  redirect: the `pay` redirect allowlist is unchanged), and turns the 404 page of a mail before USDT into a JSON 404, which the page shows as
  "not available".
- **Order page.** The USDT panel shows the network (TRON · TRC-20, and the testnet badge on `nile`), the amount and the address with copy buttons, a
  QR code of the address alone (wallets scan an address; amounts in payment URIs are not the same across wallets; drawn as inline SVG with
  [uqr](https://github.com/unjs/uqr)), a warning to send USDT on TRON (TRC-20) only and to make sure the amount that arrives covers any exchange
  withdrawal fee, and the status line.
- **Renewal, account, seats.** A subscription bought with USDT has `provider: "usdt"` and `currency: "usdt"` in `renewal` and `account`; its
  `renewPriceCents` is in hundredths of a USDT and it renews with USDT only (`renew` with `provider: "usdt"`), paid on the order page like a purchase.
  LDC subscriptions never renew with USDT, and trial upgrades (`upgradePayment`) have no USDT. A USDT seat subscription behaves like an LDC one
  (`exact: true`; `add` creates an order paid on the order page), with its amounts in USDT. The account shows USDT amounts and the renewal link like LDC.
- **Development.** The mock shop (`MOCK_USDT`, on by default) offers USDT on `nile` with demo USDT prices, prices quotes and codes for it, and answers
  `pay/usdt` with a fixed demo address: the first two calls see nothing, the third the transfer (`confirming` = the amount), the fourth the payment.

### Renewal

- Renewal tokens are issued by mail and appear in the renewal links on the order page, the account page and the expiry reminder emails (`/shop/renew/?t=…`; reminder emails link to the Chinese or English page according to the subscription's language),
  and need neither login nor the original browser. The page carries it along when switching language.
- `renewal` returns `{ subscriptionId, productName, mailboxCount, periodDays, renewPriceCents, currentPeriodEnd, state, mailboxes, maxPeriods, hasContactEmail, provider, autoRenew }`;
  an invalid or expired token gives `404`. Stripe subscriptions are charged automatically by Stripe each period and cannot be renewed manually on the renewal page (`maxPeriods` is 0 and `renew` returns `409`); they are managed on the account page.
  A USDT subscription (`provider: "usdt"`, `currency: "usdt"`) renews with USDT only, at a `renewPriceCents` in hundredths of a USDT (see "USDT payments").
- `renew` creates a renewal order at the renewal price locked in at purchase (`periods` is 1 to 12, and the total must not exceed the per-payment limit), which is then paid as usual through the order page and `pay`.

### Account and login

- The account page `/shop/account/?mode=register` opens the registration form directly (the website's "Register an account" links here); without the parameter it is the login form; the primary button on the order page after payment is "Activate in my account".
- Registration: `account/register` registers with email and password (8-128 characters, sharing the Turnstile widget and action `shop-login` with the login form, and the rate limit with login links).
  mail sends a confirmation email to the address; the link goes to the same confirmation page as login links (`/shop/account/?login=<token>`); `account/peek` then returns `register: true`,
  the page asks "Complete registration and log in as ...?", and only after confirmation does `account/verify` create the account, set the password chosen at registration and log this account out of other browsers.
  When the email is already registered the answer is the same, revealing nothing about who has an account; confirming then amounts to a password reset (whoever can receive mail at that address could already do this with a login link).
- Forgot password: clicking "Forgot password? Reset it" on the login form makes `account/forgot` send a reset email to the address (`/shop/account/?reset=<token>`, valid for 15 minutes, single use).
  When the email has no account nothing is sent, but the answer is the same; mail puts the email into the outbox queue before sending, so response time reveals no difference either; rate limited per source IP and per email, sharing Turnstile with the login form.
  After opening the link, the account page first uses `account/peek` (returns `reset: true`) to say which account it is; the buyer types the new password twice, and only then does `account/reset` consume the link: it sets the new password,
  logs this account out of all browsers, logs in the current browser (the Worker rebuilds the session cookie as for `account/verify`) and sends a "password changed / set" notice.
  A reset link cannot be used as a login link (`account/verify` returns `400`), and a login link cannot be used to reset.
- Sign in with Google: there is a "Sign in with Google" button under the login and registration forms. `account/google/start` has mail set a signed 10-minute state cookie in this browser
  (`mailhq_shop_google`, `Path=/api/shop/account/google`; the Worker rebuilds it as usual, not inheriting the upstream Domain / Path) and returns the Google authorization page URL, to which the page navigates as a whole.
  Google only returns to one address: `/shop/account?code=…&state=…` (without the trailing `/`; on cancel `?error=access_denied&state=…`), which the site 307s to the Chinese account page `/shop/account/` preserving the query parameters; this address without the `/` must be registered verbatim in the Google OAuth client's
  "Authorized redirect URIs"; the page language at the start is recorded in the state, `account/google` returns `lang`, and the page uses it to go back to the English account page.
  The account page hands `code` and `state` to `account/google`: the Worker attaches the state cookie to this one endpoint only; mail matches `state`, exchanges the authorization code for the Google identity, verifies it and logs in;
  the Worker swaps in the account session cookie and clears the state cookie whatever the result (one login, one hand-over). Another browser given this address cannot log into any account (no matching cookie).
  Which account is entered: the one already linked to this Google account; otherwise the email is trusted only when Google manages that mailbox (Gmail, or a Google Workspace account whose `hd` matches the email domain):
  an account with the same email is linked automatically (the account owner receives a notification email), and if there is none a new account is created (`created: true`). For other emails, Google's "verified" may be from long ago and
  the mailbox may have changed hands, so neither linking nor account creation happens and `403` is returned: the buyer first logs in with a password or an email link, then clicks "Link Google account" under "Google sign-in" on the account page
  (`account/google/start` with `link: true`, requires being logged in; on return `account/google` links the Google account to the account that started the linking, requires this browser to still be logged into it,
  does not change the session, and returns `linked: true`). Emails not verified by Google cannot log in; when the account with the same email is already linked to another Google account, or this Google account is already linked to another shop account, `409` is returned.
  After login the "Google sign-in" section of the account page shows the linked Google email (`google` in `account`), and `account/google/unlink` can unlink it.
  Within 10 minutes of signing in with Google, setting a password does not require the current password, as with login links.
- Accounts also work without a password: `account/login` sends a one-time login link to the email (`/shop/account/?login=<token>`, in the page language, valid for 15 minutes, single use).
  Any email can log in (an account is created on first login), rate limited per source IP and per email separately.
- Log in with a password: the password set at registration, or set after login under "Login password" on the account page (8-128 characters); the login form defaults to email + password, and `account/password-login` exchanges email and password for a session.
  A non-existent account, no password set and a wrong password all return the same `401` and description; mail runs an equally expensive password check in every case, so neither the answer nor the timing reveals who has an account;
  rate limited per source IP (10 per 10 minutes) and per email (5 per 10 minutes) separately; shares one Turnstile widget and action `shop-login` with the login link form.
  On success, orders are claimed as for a login link this browser requested itself: orders under this browser's buyer cookie, and orders whose contact email is this email.
- `account/password` sets or changes the password. Within 10 minutes of logging in with a login link or Google, `currentPassword` may be omitted (first-time setup and forgot-password resets rely on this);
  at all other times (including sessions logged in with a password) the correct current password must be given, otherwise `403`; this way a stolen session cookie cannot be used to permanently take over the account.
  After saving, mail invalidates all of this account's sessions in other browsers; the current browser stays logged in.
- When mailhq has Cloudflare Turnstile human verification enabled, `catalog` carries `turnstileSiteKey`, and the account page uses it to render the verification widget in the login form (action `shop-login`);
  `account/login` must carry the one-time `turnstileToken` it issues. mail verifies it before rate limiting and sending; missing or invalid returns `403` with `{ error }` in the request language;
  the page resets the widget after every submission. When the catalog cannot be read or the script failed to load, submit as usual and let the backend decide.
- Opening a login link **does not log in directly**: the account page first asks `account/peek` which email the link belongs to and shows "Log in as ...?" (also saying it will switch accounts when another account is logged in),
  and only after the buyer confirms does it call `account/verify` to exchange for a session; if not confirmed, the token is removed from the address bar. Otherwise someone could send over their own login link, and opening it would log this browser into their account,
  so that orders, redeem codes and renewal links from then on would belong to them. When `peek` fails temporarily (offline, `429`, `5xx`) the page asks again after a second; if it still fails (including old backends without `peek`)
  it still asks for confirmation, just without showing the email. On `400` (link invalid, expired or already used) it goes straight back to the login form.
- After login, `account/verify` claims two kinds of orders for the account: orders under this browser's buyer cookie (only when this browser itself requested the login link), and orders whose contact email is this email;
  orders already claimed by someone else are left alone. `claimed` is the number of orders claimed this time. Purchase and renewal orders placed while logged in belong to the account from the start. After switching devices or clearing browser data, orders can be recovered by logging in.
- The shop page, order page and renewal page show "Logged in: <email> - New orders will go to this account" and a logout button when there is an account session, so a login that is not one's own is visible at a glance.
  This line reads `account` every time a page is opened; when the browser has no account session cookie that the Worker would forward, the Worker returns `401` directly (with the same description as mail) without calling mail.
- `account` returns `{ email, hasPassword, subscriptions, orders }` (`hasPassword`: whether a login password is set; old backends omit it, in which case the page does not show the "Login password" section). Subscriptions: `{ id, productName, state, currentPeriodEnd, periodDays, renewPriceCents, mailboxCount, mailboxes, renewToken, provider, autoRenew, currency, fiatRenewMinor }`,
  with `renewToken` `null` when the renewal price is outside the payable range or for Stripe subscriptions; orders: `{ id, kind, productName, priceCents, periods, periodDays, status, provider, currency, created, paidAt, code, codeStatus }`,
  most recent first. The page checks these fields one by one and treats a wrong shape as a failed request.
- Mailbox management (like Spacemail Manager): `account/mailboxes` returns `{ groups, servers, webmail }`. `groups` is every paid purchase order under this account:
  `{ orderId, productName, code, codeStatus, usesLeft, mailboxLimit, codeExpires, domains, locked, mailboxes }`, where `domains` are the domains on which new mailboxes can currently be created
  (empty when none can), and `locked` being true means the subscription is suspended and read-only until renewed; `mailboxes` are the mailboxes created with this order's redeem code,
  `{ id, email, status: "active" | "disabled", quotaMb, usageMb, created }` (`null` when quota and usage have never been synced). `servers` gives IMAP / SMTP per domain.
  - `create` creates a mailbox directly with this order's redeem code, with exactly the same rules as the redeem page (username, password, domain, uses, push and rollback), so the redeem code need not be copied to the redeem page; the redeem code can still be used on the redeem page.
  - `password` sets a new password for the mailbox, and webmail and client sessions logged in with the old password stop working; `status` disables or enables; `delete` requires repeating the email address in `confirm`,
    and the mailbox and its mail are permanently deleted and the use is returned to the redeem code.
  - Ownership: when a mailbox's redeem code is the redeem code of a paid purchase order of this account, this account manages it, including mailboxes that others created with a redeem code the buyer passed on. mail records it in the activity log as "shop account <email>".
- `account/portal` is only for a logged-in account that owns this Stripe subscription, and returns the customer portal URL (change card, cancel or resume auto-renewal); the portal's return address is the account page in the same language.

### Checking an address before buying

`POST /api/shop/address` serves "Check your address" in the home page's hero and on the pricing page
(`src/components/AddressCheck.tsx`): the visitor types a username, picks one of the domains the plans on sale offer, and sees whether
the address is free, before there is an order or a redeem code. The existing `POST /api/onboard/username` cannot serve this: it
requires a valid redeem code precisely so that it is not an entry point for probing usernames. This endpoint answers without one, so
it is an enumeration oracle by design and the limits below are part of the contract, not an implementation detail. On mail's side it is
`apps/console/src/app/api/shop/address/route.ts`, described in mail's `docs/shop.md`.

Request: `{ "domain": "abnormalhq.com", "username": "kunish" }`, `Content-Type: application/json`, with the storefront's `Origin`
(the Worker requires the same origin, and mail checks it against the storefront address in the sales settings like the other shop
endpoints). No redeem code, no cookie (the browser sends `credentials: omit`, and the Worker forwards none to this route even when
the browser has shop cookies), no Turnstile token: tokens are single-use and the check runs as the visitor types.

Response `200`: `{ "available": true, "email": "kunish@abnormalhq.com" }`, or `{ "available": false, "email": "…" }` when the address
cannot be had. `email` is the normalised address the answer is about.

- `username` is normalised with `normalizeUsername` and validated against `LOCAL_PART_PATTERN`, exactly as `/api/onboard/username`
  does; an empty one or one that fails is `400` with `{ error }` in the request language (the page then shows its own wording of the
  rule).
- `domain` must be a domain of a plan currently in `GET /api/shop/catalog` (listed, every domain still managed, payment open). Any
  other domain, managed or not, gets the same `400`: the endpoint says nothing about domains that are not publicly for sale.
- "Taken" is the same test as the redeem page's `assertUsernameAvailable` (the local records, and `listMailboxes(domain)` on the mail
  server). Nothing tells why an address is unavailable. Unlike the redeem API, taken is a `200` answer here rather than a `409`
  error: it is the normal outcome of a search, and shop errors have no `kind` to switch on.
- Failure statuses, all `{ error }` in the request language like every shop endpoint: `400` (username or domain), `403` (`Origin` is
  not the storefront address), `413` / `415` (body), `429` with `Retry-After` (rate limited), `503` (the mail server could not be
  asked: the endpoint never answers `available: true` on a guess), and `404` while the check is switched off in the sales settings.
- Rate limits, in mail's `shop_rate_limits`: 10 a minute and 100 a day per source IP (`CF-Connecting-IP`, which the Worker keeps),
  counted before the body is read, and 600 an hour per domain across all sources, so a distributed sweep degrades to `429` instead of
  listing a domain's mailboxes. The page asks once per pause in typing (500 ms debounce, one request in flight), so a person needs a
  handful of requests. Every `429` of the shop API carries `Retry-After` (the seconds left in the counter's window). The username
  asked about is neither stored nor logged.
- The answer reserves nothing. The page says so, and the forms that create the mailbox (`account/mailboxes/create`,
  `/api/onboard/redeem`) stay authoritative.

`GET /api/shop/catalog` carries `addressCheck: true` while the endpoint answers and something is on sale; "Let visitors check whether
an address is free" under Settings → Sales in mail (on by default) switches both off, and every backend before the endpoint leaves the
flag out. The pages show the check only when the catalog carries the flag, so nothing appears, and no request is made, against a mail
without it. As a second line, the Worker turns a `404` for this route (mail's JSON one while the check is off, or the HTML not-found
page of a mail before the endpoint) into a JSON `404` instead of the usual `503 unavailable`, and the page removes the form when it
sees one.

What the website does with a free address: the result links to `/shop/?address=<name@domain>` (the plan cards link to
`/shop/?plan=<product id>`; both parameters survive the header's language toggle). The shop points out the plan, shows the address and
keeps it in the tab's `sessionStorage` (`abnormal-address`), because the way from the shop to the mailbox form leaves the site for the
payment page. "My mailboxes" on the account page then opens its create form with the username and domain filled in when the order
offers that domain, and the redeem page starts its first row with the username. None of this is sent to mail before the visitor submits
one of those forms.

`pnpm dev` implements all of this in the mock (`src/storefront/mock/shop.ts`); start it with `MOCK_ADDRESS_CHECK=off pnpm dev` to see
the pages against a backend with the check switched off.

### Discount codes

Besides a plan's own discount percentage, mail has discount codes that a buyer types in (mail's `docs/shop.md`, "Discount codes":
a percentage or a fixed amount per way of paying, optionally limited to plans, an expiry, a total number of uses and uses per
buyer). mail implements all of the endpoints below, and the route and the order fields are in `docs/onboard-contract.json`
(mail #221). The shop page uses the preview and `coupon` at checkout; the one thing not built is under "Proposed" at the end of
this document (a code field on the order page).

- **Preview**: `POST /api/shop/coupon`, JSON `{ productId, provider?, coupon }` with the storefront's `Origin`; `provider` as at
  checkout (`ldc` by default). It answers `200` with
  `{ valid: true, code, provider, currency, basePriceCents, discountCents, priceCents, firstPeriodOnly }` (amounts in hundredths
  of an LDC, or in the smallest unit of `currency` for `stripe`, where `currency` is `""` for LDC; `basePriceCents` is the price
  before the code: the plan's discounted LDC price or its card price; `firstPeriodOnly` is true for a subscription plan), or with
  `{ valid: false }`. The second answer is the same whatever the reason (unknown, disabled, expired, used up, another plan,
  another way of paying, a plan that is not on sale), so there is no reason to show and the page shows one sentence. It reserves
  nothing, and checkout has the final say. `400` is a malformed request (no plan id, an unknown provider, no code), `403` a wrong
  origin, `429` with `Retry-After` the rate limit. The client (`previewCoupon` in `src/storefront/lib/shop.ts`) treats an answer
  whose three amounts do not agree, or that is for another way of paying than asked, as a failed request.
- **Several plans in one request** (mail #221): the same endpoint takes `{ products: [{ productId, provider?, quantity? }], coupon }`
  with 1 to 8 entries (each entry as the single form's fields; `quantity` for a seat plan) and answers `200` with
  `{ quotes: [...] }`: one entry per entry asked, in the order asked, either
  `{ productId, code, provider, currency, basePriceCents, discountCents, priceCents, firstPeriodOnly }` or `null` where the
  single form would answer `{ valid: false }`. An empty list, more than 8 entries or a malformed entry (a seat plan without a
  valid quantity, or with a total above what one order can charge, included) is `400` for the whole request, with no partial
  answer; `products` wins when both forms are sent. The whole request is **one** guess against the rate limit below. The client
  (`previewCoupons`) checks every entry like the single form's answer, and that it is for the plan asked at its place. A mail
  before this form reads the body as the single form without a plan and answers `400`.
- **The Worker** proxies it like `checkout`: same-origin `Origin`, JSON, the client IP kept, and the `mailhq_shop` and
  `mailhq_customer` cookies forwarded, so that a per-buyer limit is known to the preview. Nothing is set in the answer. A mail before
  discount codes answers its own `404` page; the Worker turns that into a JSON `404` (as for the address check), and the shop page
  then hides the field.
- **Pricing**: the code is applied after the plan's discount, to the plan's discounted LDC price or to its card price; a percentage
  is rounded half up, and a code never makes an order free. For a subscription it lowers the first period only: the order's
  `renewPriceCents` is the price before the code. Trial upgrades may also discount one paid period; subsequent LDC and Stripe renewals are at the full price.
- **Checkout**: optional `coupon` (a string; absent, `null` or blank means none). mail prices the order; a code that cannot be used
  fails the checkout with `400` and one message for every reason, and no order is created, so a buyer is never silently charged
  the full price. The redemption is taken when the order is created and only _held_ while it is unpaid (30 minutes, 25 hours once
  the payment was opened); when the hold lapsed and the code can no longer be taken, `pay/stripe` answers `409` and the pay form
  returns to the order page with `&error=payment`, and the buyer places a new order.
- **Rate limit**: code guesses are limited to 10 per 10 minutes per source IP across the preview, `checkout` (when it carries a
  code), trial upgrades through `renew`, and the pay endpoints, on top of each endpoint's own limit. A request counts once, whether it asks about one plan or
  eight. This is why the shop page does not preview as the buyer types.
- **`pay` and `pay/stripe`** also take an optional `coupon` (form field or JSON) that adds a code to an unpaid purchase order
  without one, before its first payment page is opened. The storefront does not send it: the order page has no code field.

What the shop page does (`src/storefront/components/Shop.tsx`):

- "I have a discount code" opens a field above the plans. "Apply" (or Enter) previews the code for the plans on the page, once per
  way of paying a plan offers, the plan the visitor arrived for (`?plan=`) first, in **one request** for up to 8 of those
  combinations (`previewCouponPlans`, `COUPON_PREVIEW_PLANS`). A catalog with more takes further requests of up to 8, and never
  more than 4 requests per press (`COUPON_PREVIEW_REQUESTS`, so 32 combinations), because every request is a guess against the
  limit above. A way of paying that cannot take a seat plan's quantity is not asked about. A plan shows "With CODE: price" per way
  of paying, that the code applies to the first period only for a subscription, or that the code cannot be used for it; what
  was not asked (past the 4 requests, or after a request failed) says the code is checked when ordering, and the field then says
  that not all plans were checked rather than that the code cannot be used. When every plan was asked and none can use it the
  field shows one sentence, "This code can't be used."
- **A mail before the several-plans form** answers `400` to it. The page then asks plan by plan in the single form, within the
  same 4 requests of the press (the refused one counted, so 3 plans the first time), and starts with the single form on later
  presses. A `400` to the single form as well is shown as mail's message.
- Whatever is in the field goes with `checkout`, for Linux DO Credit and card alike, whether or not it was previewed. So a typed
  code is applied or the checkout is refused with mail's message (the form stays as it is); to buy without it the buyer removes it.
- The catalog's `coupons` flag decides whether the field is offered. mail always sends it (mail #221): `true` while something
  is on sale and at least one code can be used right now, `false` otherwise, which hides the field without a request. Only a
  mail before the flag sends none: the field is then offered and goes away when the preview answers `404`.
- **The order page** shows the code and what it took off under the price: "Discount code WELCOME, −1.00 LDC" and the price before
  the code struck through, plus the first-period note for a subscription. mail publishes both with the order (`couponCode`, `couponDiscountCents`)
  and the page uses them. A mail before those fields published neither, and published an order with a code but no plan discount
  with `originalPriceCents` equal to `priceCents`, so the fields alone showed no discount. For such a backend the shop page
  still remembers, for each order it creates with a code, the code and the price before it (the plan's
  `priceCents`, or `fiatPriceMinor` for a card order) in the tab's `sessionStorage` (`abnormal-coupon`, the last 5 orders;
  `src/storefront/lib/coupon.ts`), since paying leaves the site and comes back. This is kept **only as the fallback for such a
  backend**: whenever the order carries mail's fields they win and the remembered values are not read. Without the fields the
  order page takes the difference between the remembered price and the order's `priceCents` as the discount, and only when the
  order really is cheaper; opened in another browser, a new tab or from the account page, such an order shows its price without
  the breakdown. The remembered values are only shown; they are never sent to mail and play no part in billing.
- **The account page** lists each order with its code and what it took off ("Discount code WELCOME · −1.00 LDC"), from the
  `couponCode` and `couponDiscountCents` mail publishes with the account's orders (`parseAccountOrder`); an order without a code
  (`""` and `0`), and every order of a mail before the fields, shows no such row. The list never reads the tab's storage.

`pnpm dev` implements both forms of the preview, `coupon` at checkout, the catalog flag and the order fields in the mock, with
three codes: `WELCOME` (20% off every plan, either way of paying), `LDC1` (1.00 LDC off, so not for card orders) and `MONTHLY`
(half off the monthly plan's first period only). `MOCK_COUPONS=legacy pnpm dev` behaves like a mail with discount codes before
mail #221: no `coupons` flag, `400` to the several-plans form, and orders without `couponCode` and `couponDiscountCents` (the
order page then shows what the tab remembered). `MOCK_COUPONS=off pnpm dev` behaves like a mail before discount codes: the
preview answers `404`, checkout ignores the field and the catalog has no flag.

### Seat plans

A plan is sold in one of two ways: **fixed**, a set number of mailboxes at one price, or **per seat**, where the buyer chooses how
many mailboxes to pay for (mail's `docs/shop.md`, "Seat-based plans"; `packages/core/src/lib/shop/pricing.ts`,
`apps/console/src/lib/shop/seats.ts`, `quote.ts` and the routes under `apps/console/src/app/api/shop/`). mail implements everything
below and the storefront uses it; the routes, the fields of a seat plan, a quote and an account's seats, the limits and the
refusal codes are in `docs/onboard-contract.json` under `shop.planKinds`, `shop.seats`, `shop.quote` and `shop.refusalCodes`
(contract version 3), which the contract tests check against the Worker and the parsers. This section is written from mail's code; where its
`docs/shop.md` says something else, the code is what the storefront follows, and the differences are listed at the end of the
section.

**Catalog.** `GET /api/shop/catalog` gains `seatProducts`, present only while a seat plan is on sale. `products` keeps listing
fixed plans only, so a page that knows nothing of seats sells none of them wrongly. A seat product has every field of a product
plus `kind: "seat"`, `seatMin` and `seatMax` (1 to 1000, `seatMin` ≤ `seatMax`); `originalPriceCents`, `discountPercent`,
`priceCents`, `renewPriceCents` and `fiatPriceMinor` are **for one seat** (per period for a subscription), and `mailboxCount`
equals `seatMin`. Since contract version 3 an entry also says what a buyer page needs outright (`shop.seats.planFields`):
`planKind: "seats"` (one of `shop.planKinds`; the same word, `shop.planKindField`, is on every entry of `products` as
`planKind: "fixed"` and on a quote, while the older `kind: "seat"` is mail's stored word and nothing new reads it), `minQuantity` and `maxQuantity` (the range of the quantity field),
`unitOriginalPriceCents` and `unitPriceCents` (one seat before and after the plan's discount), `unitRenewPriceCents` (one seat
per later period: the plan's renewal price, or its discounted price when it has none; `0` for a one-time plan) and
`unitFiatPriceMinor` (one seat by card; `0` when the plan cannot be bought by card). The parser (`parseSeatProduct` in
`src/storefront/lib/catalog.ts`) reads the explicit fields and falls back, field by field, to the ones a mail before version 3
sends (`seatMin`, `seatMax`, the plan's own price fields, and `renewPriceCents || priceCents` for a subscription's renewal):
`planKind: "seats"` or, without a `planKind`, `kind: "seat"` marks a seat plan; where both forms of a number are sent the
explicit one wins, and the plan's own price fields of the parsed plan carry the same per-seat numbers, so everything that shows
a seat plan reads one set. A field that is present must be usable (a range mail itself would accept, prices that agree like any
plan's); a malformed seat plan fails the catalog like a malformed product. An entry of `products` that says a `planKind` other than
`"fixed"` fails it too (its prices would be read as a whole plan's); one that says none is a mail before the field. `customDomains` (a number, on `products` and
`seatProducts` alike; absent or `0` when the plan has none) says how many domains of their own the plan's buyer may connect.

**Pricing an order.** mail prices the order; the browser sends only the quantity, and asks mail's quote for the total it shows.

- **`POST /api/shop/quote`** `{ productId, providers?, provider?, quantity?, coupon? }` (`shop.quote`). `providers` lists the
  ways of paying to price, 1 to as many as the shop has, each once; the single `provider` (as at checkout) is a list of one,
  `ldc` is priced when neither is sent, and `providers` wins when both are. `quantity` is for a seat plan only. It answers
  `200` with what is the same whichever way the order is paid, `{ productId, planKind: "seats" | "fixed", quantity,
minQuantity, maxQuantity, periodDays, prices }` (`shop.quote.fields`), and in `prices` one entry per way asked, in the
  order asked: `{ provider, available: true, currency, unitOriginalPriceCents, unitPriceCents, subtotalCents,
discountPercent, planDiscountCents, basePriceCents, coupon, totalCents, renewPriceCents }` (`shop.quote.priceFields`).
  `totalCents` is what the buyer pays now,
  `subtotalCents` the order before the plan's discount, `planDiscountCents` what that discount takes off, `basePriceCents` the
  price before a discount code and `renewPriceCents` each later period for this quantity (`0` for a one-time purchase). `coupon`
  is `null` when none was sent, `{ valid: true, code, discountCents, firstPeriodOnly }` when it applies (`totalCents =
basePriceCents − discountCents`) and `{ valid: false }` when it cannot be used, for every reason alike; the quote still answers
  `200` with the total without the code. A fixed plan can be quoted too (`planKind: "fixed"`, the three quantities all 1). It
  reserves nothing: checkout prices the order again by the same rules and has the final say.
- **A way of paying that cannot take the order** is `{ provider, available: false, refusal }` in its entry
  (`shop.quote.unavailableFields`), `refusal` being the coded refusal a quote for that way alone would get
  (`shop.quote.unavailableCodes`: `product_unavailable`, or `seat_total_too_large` with `maxTotalCents`); the other entries
  are priced. When no way asked about can take the order the request itself is refused, with the first one's refusal.
- Refusals of the whole request with a code: `400 seat_quantity_invalid`, `400 seat_quantity_out_of_range` (`min`, `max`),
  `409 product_unavailable` (the plan is not on sale) and, when it is so for every way asked about, `400
seat_total_too_large` (`maxTotalCents`) or `409 product_unavailable`. Without one: `400` a malformed `productId`, `provider`
  or `providers`, `403` wrong `Origin`, `413` / `415` body, `429` with `Retry-After` (60 quotes per 10 minutes per source IP,
  a request counting **once** however many ways of paying it prices; a quote that carries a code is also one guess against
  the limit on code guesses, 10 per 10 minutes per IP, likewise once per request). A mail before the endpoint
  answers its own `404` page, which the Worker turns into a JSON `404`.
- The Worker proxies it like the code preview (`QUOTE_ROUTE` in `src/storefront/worker/shop.ts`): same-origin `Origin`, JSON,
  the client IP kept, the `mailhq_shop` and `mailhq_customer` cookies forwarded (a code's per-buyer limit), never cached.
- The client (`quotePurchase` and `parsePurchaseQuote` in `src/storefront/lib/quote.ts`) always sends `providers`, and accepts
  a quote only for the plan and quantity it asked about, with exactly one entry per way of paying asked and in that order,
  each priced or refused with a code, with a currency exactly when it is a card price, and with amounts that add up the way
  the list above says (`planDiscountCents = subtotalCents − basePriceCents`, `totalCents = basePriceCents −` the code's
  `discountCents`); what mail multiplies and rounds is not redone. Anything else is a failed request.
- **The board** (`QuoteBoard` in the same file) holds the quotes of a page, one slot per plan: its ask names every way of
  paying on offer for the plan, so a settled change of quantity is **one** request per plan, and `viewOf` reads each way's
  figure off the one answer (its price, its own refusal, or the request's refusal). The first ask of a slot
  goes out at once; a change of quantity waits 350 ms (`QUOTE_DEBOUNCE_MS`) and a further change within that time replaces it,
  so stepping from 2 to 12 is one request; the request in flight for a slot is cancelled when its ask changes, so a late
  answer is never shown for another quantity. Quotes and coded refusals are remembered per ask (going back to a quantity asks
  nothing). A `429` stops every request until `Retry-After` has passed (60 seconds when mail says none), then the waiting
  slots are asked once more. A `404` means the backend has no quote: every slot becomes `unsupported` and nothing is asked
  again. Any other failure leaves the slot `unavailable` and is not remembered.
- **The fallback.** Without a quote (`unsupported`, `loading`, `limited`, `unavailable`) the page shows the total it works out
  by mail's rule, exactly as it did before the endpoint existed (`seatOrderPrice`, `seatCardPrice` and `seatTotals` in
  `catalog.ts`), marked as an estimate confirmed at checkout:
  - LDC: `quantity × unitOriginalPriceCents`, then the plan's discount on the whole order, rounded half up **once**
    (`floor((total × (100 − discountPercent) + 50) / 100)`, mail's `seatOrderPrice`). It is not `quantity × unitPriceCents`:
    3.33 a seat at 10% off is 20.98 for 7 seats (23.31 × 0.9 = 20.979), not 7 × 3.00.
  - Card: `quantity × unitFiatPriceMinor`, per period for a subscription.
  - The limit on what one order can charge (`shop.seats.maxTotalCents`, or the `maxTotalCents` a refusal named) is applied per
    way of paying: a quantity whose LDC total is above it can still be bought by card and the other way round.
- A period renews at `seats × unitRenewPriceCents` (LDC) or `seats × unitFiatPriceMinor` (card): `renewPriceCents` of the quote.

**Checkout and the code preview.** `POST /api/shop/checkout` takes `quantity` (a JSON number) for a seat plan: `400` when it is
missing, `null`, not a whole number or outside the plan's range, or when the total is above what one order can charge
(1,000,000.00), each with its code (`seat_quantity_invalid`, `seat_quantity_out_of_range` with `min` and `max`,
`seat_total_too_large` with `maxTotalCents`). A fixed plan takes none: `0`, `1`, `null` or absent are accepted and anything
above 1 is `400 seat_quantity_invalid`. The storefront sends `quantity` for seat plans only. `POST /api/shop/coupon` takes the
same `quantity` for a seat plan and its three amounts are then for that many seats; a quantity sent for a fixed plan is
ignored. A quantity the plan does not sell is never answered as `{ valid: false }` (which would read as "this code does not
work"): it is `400` with one of the same three codes, in the single form and in the `products` form alike, where it fails the
whole request and also carries `index`, the position (from 0) in the request's `products` of the entry it is about. The shop page shows such a refusal for what it is, with the numbers mail sent ("This plan sells 2 to 5
mailboxes…", "…more than one order can charge (1000000.00 at most)…"), takes the range (for the plan `index` names: `errorAt` of `previewCouponPlans`) or the limit over for its own cards
and asks for its quotes again; it never takes a coded `400` as the sign of a mail before the `products` form (which answers an
uncoded `400`, and is then asked plan by plan). The order of a seat plan has the seats in `mailboxCount`.

**The shop page** (`src/storefront/components/Shop.tsx`) lists the seat plans after the fixed ones: the price per mailbox, a
quantity stepper within the plan's range (`ShopSeatStepper`), and the total for either way of paying: mail's quote
(`totalCents`, with `subtotalCents` struck through when the plan has a discount, and "Then … every N days" when
`renewPriceCents` is not the total), or the estimate with its note while there is no quote (`seatFigure` in `quote.ts`). A
quote refused with `seat_total_too_large` closes that way of paying and says so, and one with `seat_quantity_out_of_range`
moves the quantity into the range mail named (a quote's own `minQuantity` and `maxQuantity` are taken the same way, since the
catalog on the page can be older); any other refusal is shown in mail's words and closes the button. A fixed plan's price is
the catalog's `priceCents`, which is already mail's number for the whole order, so no quote is asked for it. The quotes the page
asks by itself carry no discount code: a quote with a code is one guess against mail's limit on code guesses, which a change of
quantity must not spend. A discount code is therefore still previewed on "Apply", for the quantity on the card; when the
quantity changes after "Apply", the card says the code is checked when ordering until it is applied again. The pricing page, its Markdown and its structured data list seat plans with per-mailbox wording
(`src/lib/pricing.ts`); the offer of a seat plan is a `UnitPriceSpecification` per mailbox with the `eligibleQuantity` range.

**The account's seats.** Each group of `GET /api/shop/account/mailboxes` carries `seats`: `null` unless the order is a seat
**subscription**, otherwise `{ seats, seatsNext, min, max, seatPriceCents, provider, currency, periodDays, periodEnd, removing }`
(`shop.seats.accountFields`). `seatsNext` is the count from the next renewal on (`null` when no removal is scheduled), `removing`
the ids of the mailboxes that go with it, `seatPriceCents` one seat per period in hundredths of an LDC or the smallest unit of
`currency` (`""` for LDC), and `periodDays` the length of that period (since contract version 3; the page says "every 30 days"
with it and "per period" on a mail that sends none). `mailboxLimit` and
`usesLeft` of the group follow the seats; while a removal is scheduled `usesLeft` only offers what the new count has room for. A
backend before seat plans sends no `seats` key. The page (`ShopSeats.tsx`, inside the group in "My mailboxes") shows seats used
of total, the price of a seat, the period end and a scheduled removal with its mailboxes.

The four routes take `orderId`, the subscription's **purchase order** (the group's `orderId`), need the account session, and are
proxied like `account/mailboxes/create` (`SEAT_ROUTES` in `src/storefront/worker/shop.ts`): same-origin `Origin`, JSON, the client
IP kept, the `mailhq_shop` and `mailhq_customer` cookies forwarded, never cached, nothing logged but the route name.

- **`quote`** `{ orderId, add }` → `{ add, seats, provider, currency, priceCents, exact, periodEnd }`. `priceCents` is what the
  added seats cost for the rest of the period (`seats × seat price × time left ÷ period length`, rounded **down** to 0.01 and
  never below it), `seats` the count after adding. `exact` is `true` for LDC (the order's price if placed at once: it falls as
  the period runs down) and `false` for a card subscription, where it is mail's estimate and Stripe's invoice has the final
  amount. It reserves nothing. The page asks for it on "See the price" and shows it before the confirm button appears.
- **`add`** `{ orderId, add }`. LDC: `201 { orderId }`, a new order paid on the order page with the `pay` form like a renewal
  order; the Worker rebuilds the buyer cookie as for `renew`; the seats and the code's allowance rise when it is paid. Card:
  `200 { status: "applied", seats, invoiceUrl: null }` when the card was charged (`seats` is the new count), or
  `{ status: "payment_required", seats, invoiceUrl }` when the bank wants the buyer: **nothing has changed**, `seats` is still the
  old count, and the seats rise only when Stripe reports the paid invoice to mail. The page keeps a notice with a link to
  `invoiceUrl` (Stripe's hosted invoice page; accepted only on an `https` `stripe.com` host, otherwise treated as `null` and the
  notice points at "Manage auto-renewal") and a "Refresh seats" button until the list shows the new count.
- **`remove`** `{ orderId, remove, mailboxIds }` → `{ seats, seatsNext, effective, removing }`. Takes effect at the next renewal,
  never before, and nothing is refunded. `mailboxIds` are the mailboxes that go with the seats: at most `remove` of them, and
  enough for the remaining ones to fit the new count (it may be empty, or absent, when they already fit). Scheduling again
  replaces the earlier removal. The page shows the mailboxes as checkboxes only when some have to go.
- **`keep`** `{ orderId }` → `{ seats, seatsNext: null, effective, removing: [] }`: takes a scheduled removal back.
- Status codes: `401` not signed in; `403` wrong `Origin`; `404` not a seat subscription of this account (the same answer whether
  or not it exists); `400` a count that is not a whole number from 1 to 1000, mailbox ids that are malformed, repeated or not this
  subscription's, more mailboxes than seats removed, or too few chosen (the message says how many more); `409` the period has
  ended or the subscription is not active (add), a removal is scheduled (add), above the plan's most (add), below the plan's
  fewest (remove), the subscription is suspended (remove), the seats changed meanwhile (remove), no removal is scheduled (keep),
  or Stripe refused the change (add, remove and keep of a card subscription); `413` / `415` body; `429` with `Retry-After`
  (`add`, `remove` and `keep` share 10 per 10 minutes per account, `add` also 30 per 10 minutes per source IP, `quote` 60 per 10
  minutes per account; the page shows the wait from `Retry-After`); `503` the way of paying is not configured. A mail before seat
  plans answers its own `404` page, which the Worker turns into a JSON `404`.

**Orders that add seats.** mail's order kind is `seats`, but `toPublicOrder` publishes it as `kind: "renewal"` with `periods: 1`
and the seats added in `mailboxCount` (in `orders` and in the account's order list), because a storefront before seat plans
rejects an unknown kind. No published field tells such an order from a one-period renewal, so the order page and the account's
order list show it as mail labels it, a renewal order. Its `pay` form returns to the order page with `&error=payment` when the
subscription was renewed after the order was priced (mail's `409` inside the redirect): the payment error on a renewal order
therefore adds that an order that added seats must be placed again from "My account". A card subscription's seats are recorded
by mail as an already-paid order of the same kind.

**Renewal page.** No change in shape: for a seat subscription `mailboxCount` and `renewPriceCents` of `renewal` are the seats and
the price of the next period, already lowered when a removal is scheduled; paying that renewal applies the removal. A trial's
upgrade to a seat plan (`upgradePlans`) is priced for the seats chosen by the same quote (`upgradePeriodPrices` in `quote.ts`:
`basePriceCents` is the first period and `renewPriceCents` each later one, per way of paying), with the page's own arithmetic
as the fallback; the quote knows nothing of further periods or of the trial's own conditions, so the page still adds the later
periods itself and `renew` has the final say.

**Where mail's code differs from its `docs/shop.md`** (the storefront follows the code):

- `seats` of a mailbox group is `null` for a **one-time** order of a seat plan as well (`listCustomerMailboxes` only loads
  subscriptions of orders with `periodDays > 0`), not only for a fixed plan's order as the document says. Seats of a one-time
  order cannot be added or removed.
- `checkout` treats `quantity: null` like an absent one, and accepts `0` and `1` for a fixed plan; the preview ignores a quantity
  sent for a fixed plan. The document only says a fixed plan takes none.
- A mail before contract version 3 answered `{ valid: false }` (not `400`) from the preview when a seat order's total was above
  the payable limit; the page never asks the preview about such a total, in either case.
- The quote's `unitPriceCents` and the catalog's are one seat's discounted price (rounded per seat), while an order's discount
  is rounded once on the whole order: `quantity × unitPriceCents` is not the total, which is why the page shows `totalCents`.
- A mail before `index` does not say which entry of the preview's `products` a seat refusal is about: with one seat plan on
  the page the range is taken for that plan, otherwise the page only shows the numbers and lets the quotes say which plan
  they are for.
- `add` is refused with `409` whenever the subscription's phase is not `active` (grace included) and also when the prorated
  amount falls outside the payable range, with the "at most N seats" message; the document names the period end only.
- `remove` and `keep` of a card subscription can also answer `409` when Stripe refuses the quantity change; the document lists
  that for `add` only. `remove` treats an absent `mailboxIds` as empty.
- A count above 1000 is `400` on every seat route ("a whole number of seats"), before any plan limit is looked at.

`pnpm dev` sells a demo seat plan (`demoproduct0003`: 3.33 LDC a mailbox at 10% off, or 1.99 USD by card, 2 to 50 mailboxes, every
30 days, two own domains). Paying is simulated, so a seat subscription exists as soon as "Pay" is pressed. Adding seats to an
LDC subscription creates an order to pay; to a card subscription it applies at once, except that adding exactly 7 answers
`payment_required` (the seats arrive on the second refresh of the list, as if Stripe had confirmed) and adding exactly 9 answers
the declined-card `409`. The mock answers the quote, the explicit plan fields, `periodDays` and the coded refusals like mail
(`src/storefront/mock/shop.ts`). `MOCK_SEATS=off pnpm dev` behaves like a mail before seat plans: no `seatProducts`, the four routes answer `404`,
and the groups carry no `seats`. `MOCK_QUOTE=off pnpm dev` behaves like a mail before contract version 3: the quote answers
`404`, a seat plan carries only `kind`, `seatMin`, `seatMax` and its per-seat price fields, the seats of a group carry no
`periodDays`, and every refusal is `{ error }` only; the pages then show their estimates and mail's `error`, as before.

### Buyer domains

"Use my own domain": a buyer whose plan allows it connects a domain they own from the account page, and the mailboxes of their
orders can then be set up on it (mail's `docs/shop.md`, "Buyer-owned custom domains"; `apps/console/src/lib/shop/buyer-domains.ts`
and the routes under `apps/console/src/app/api/shop/account/domains/`). mail implements all of it and the storefront uses it; the
routes, the fields of `Domain` and `Record`, the status enums and the refusal codes are in `docs/onboard-contract.json` under
`shop.buyerDomains` and `shop.refusalCodes` (contract version 3). The client's enums (`DOMAIN_STATUSES`, `DOMAIN_PHASES`,
`DNS_RECORD_STATUSES`, `DNS_RECORD_TYPES`, `DNS_RECORD_PURPOSES` in `src/storefront/lib/domains.ts`), from which its types are
derived, are checked against them. Written from mail's code; the differences from its document are at the end of the section.

**Who gets it.** A plan carries `customDomains` (a number above 0) in the catalog when its buyer may connect domains; the shop
and pricing pages show it. The account's allowance is `limit` of `GET account/domains`: the most any of its paid purchase orders
allows whose plan has not lapsed past its grace period; `0` means no plan of the account includes it. The panel
(`src/storefront/components/ShopDomains.tsx`) is not rendered when the list answers `404` (a mail before buyer domains) or `401`,
nor for an account with `limit: 0` and no domain.

**The six routes** need the account session. They are proxied like `account/mailboxes/*` (`DOMAIN_ROUTES` in
`src/storefront/worker/shop.ts`) with one difference mail's document states: **only the `mailhq_customer` cookie is forwarded**,
not the purchase session, since a domain belongs to an account. Writes need the storefront's `Origin` and JSON; the `GET` does
not. The client IP is kept (mail rate-limits by it), answers are never cached (the ownership value is for the reserving account
only), and the Worker logs the route name alone: a domain travels in the body only and is never logged. Without a forwardable
account cookie the Worker answers the `GET` with `401` itself.

- **`Domain`**: `{ id, name, status, phase, ownership, verifiedAt, created }`.
  - `status`: `pending` (publish the ownership TXT, then verify), `provisioning` (ownership verified, the mail service is still
    setting the domain up), `review` (waiting for the provider's approval), `live`, `suspended` (by the provider).
  - `phase`: `active`, `grace`, `suspended` or `expired`: where the buyer's plans that allow own domains stand, at the same
    moments as a subscription's mailboxes (7 days of grace, then 30 days suspended, then awaiting removal). The page shows a
    renewal prompt for anything but `active`.
  - `ownership`: `{ type: "TXT", name, value, expiresAt }` while `status` is `pending`, otherwise `null`. `name` is the full
    record name (`_mailhq-verification.<domain>`); the page also shows the part before the domain, which many DNS panels want.
    The value expires after 7 days.
- **`Record`**: `{ type, name, value, priority?, purpose, required, status, observed }`. `type` is `MX`, `TXT`, `CNAME` or `SRV`
  (an SRV `value` is `priority weight port target`); `purpose` is one of `ownership`, `mx`, `spf`, `dkim`, `dmarc`,
  `mta-sts-host`, `mta-sts`, `tls-rpt`, `dmarc-report`, `autoconfig-host`, `client-discovery` (the page names a purpose it does
  not know by the record's type); `required: false` marks the optional ones; `status` is `matched`, `missing`, `conflict`
  (`observed` lists what public DNS returned), `error` (the lookup failed, which is not "missing") or `pending`.
- **`add`** `{ domain }` → `201 { domain }`. Nothing is looked up in DNS yet. What is typed is trimmed and stripped of a scheme,
  path, port or mailbox part before it is sent (`normalizeDomainInput`); mail validates the name.
- **`verify`** `{ id }` → `{ domain, records, ready, checkedAt }`. mail looks the TXT record up and, when it is there, sets the
  domain up (once, however often it is pressed). `records` is empty while the mail service is still setting the domain up.
- **`check`** `{ id }` → the same shape, submitting nothing: what the page polls. It also moves a domain on once the mail service
  has finished (`provisioning` → `review` or `live`).
- **`refresh`** `{ id }` → `{ domain }` with a new ownership value for a reservation that was not verified in time.
- **`remove`** `{ id }` → `{ ok: true }`: gives a reservation up. Only before ownership is verified.
- `ready` is true when every required record matches. Mailboxes can be set up once `status` is `live`, whether or not `ready`
  is; a live domain then appears in the `domains` (and `servers`) of the account's mailbox groups whose plan allows own domains,
  so the create-mailbox form's domain picker offers it without knowing where it came from. The account page reads "My mailboxes"
  again when a check first reports a domain live.
- **Status codes**: `401` not signed in; `403` wrong `Origin`, or (`add`) no running plan of the account includes own domains;
  `404` not this account's domain (the same answer whether or not it exists); `400` (`add`) not a domain name, or a public
  suffix; `409` (`add`) the provider's own domain, a domain that is already in use (one message for managed, reserved by someone
  else and being onboarded: the page shows that sentence and nothing more), or the account's limit is reached; `409` (`verify`)
  the TXT record is not visible, wrong or expired, told apart by `code` (below); `409` (`refresh`) ownership is already verified;
  `409` (`remove`) the domain is already set up on the mail service; `413` / `415` body; `429` with `Retry-After`; `503` the mail
  server could not be asked or no mail server can take the domain: nothing was changed.
- **Refused verification.** A refusal of `verify`, `check` or `refresh` is coded (see "Coded refusals" under the route table):
  `domain_ownership_not_found` (the TXT record is not visible, or has another value), `domain_ownership_expired` (the value
  ran out before it was verified), `domain_dns_lookup_failed` (public DNS could not be asked), `domain_already_verified`
  (`refresh`: there is no value to replace), `domain_verification_refused` (nothing the buyer can act on), all `409`;
  `domain_unavailable` (`503`) and `domain_not_found` (`404`, every route that takes an `id`). The text is written for the
  buyer in both languages and the page shows its own. Two codes change what the card does: after
  `domain_ownership_expired` "Get a new value" becomes the leading button whatever the browser's clock says, and after
  `domain_already_verified` the card checks the domain once to show where it stands. The refusals of `add` and `remove` keep
  answering `{ error }` only.
- **Rate limits** (every `429` carries `Retry-After`, and the page shows the wait from it): `add` 5 an hour per account and 10 an
  hour per source IP; `verify` 10 per 10 minutes per account, 30 per 10 minutes per IP and 30 a day per domain; `check` 30 per 10
  minutes per account and 60 per IP; `refresh` and `remove` share 10 per 10 minutes per account and 30 per IP.

**What the page does.** Enter a domain → the ownership TXT record with a copy button for its name, the host part and its value,
and until when the value works → "Verify" (mail's refusal is shown as it is; an expired value offers "Get a new value") → the
DNS records to publish, each with its purpose in plain words, required or optional, copy buttons and its live status → the
state: waiting for ownership, being set up, waiting for the provider's review (said plainly, with no time promised, since mail
defines none), live, or suspended by the provider. The page never writes DNS and neither does mail.

**Polling** (`domainPollDelay` and `domainSettled` in `src/storefront/lib/domains.ts`): a domain past its reservation is checked
once as the page opens (the list carries no records), then again after 20, 30, 45, 60, 60 and 60 seconds, and then stops with a
"Check again" button, which starts the rounds over. No check runs while the tab is hidden (`document.hidden`); coming back
starts the wait again. A failed or rate-limited check ends the automatic rounds. Polling ends for good when the domain is live
with every required record in place, and never runs for a reservation or a suspended domain. That schedule is one
domain's, while mail's limit on `check` is per account: the cards of the page therefore share one budget (`domainCheckBudget`,
24 checks in any 10 minutes, below mail's 30), so that several waiting domains do not run into the limit together. When it is
used up a card stops its rounds as it does after the sixth; "Check again" is never held back by the page, but counts.

**Where mail's code differs from its `docs/shop.md`** (the storefront follows the code):

- `refresh` and `remove` are also limited to 30 per 10 minutes per source IP; the document names the per-account limit only.
- `add` also answers `503` when no mail server can be picked for the new domain; the document's `503` speaks of the mail server
  not answering.
- `add` answers `400` for a value that is not a string or longer than 255 characters before any other check, and checks the
  plan (`403`) after the name's shape and the public suffix list but before the provider's own names: a buyer without the
  feature learns nothing about which names the provider holds.
- Before contract version 3 `verify`'s `409` reasons were the admin console's domain-onboarding sentences
  (`settings.onboarding.*`); they are now buyer-facing texts with a code. A failed ownership DNS **lookup** is a `409`
  (`domain_dns_lookup_failed`), not a `503`.
- `records` is empty in a `check` or `verify` answer whenever the onboarding is still pending, and after that it is the
  onboarding workflow's whole list, which can include a record with purpose `ownership`.
- `limit` counts plans in grace as running (mail's `holdsMailboxes` is false for `grace`); the document says "running plans".
- The per-domain verify limit (30 a day) is keyed by the domain's record id and only applied when the id is well-formed.

`pnpm dev` implements the six routes in the mock (`src/storefront/mock/domains.ts`). The monthly demo plan allows one own domain
and the seat plan two. Nothing is looked up in DNS: the first label of the name decides what happens, so each state can be seen
on purpose.

| Name starts with | What happens                                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------------------------- |
| anything else    | "Verify" succeeds, the required records match after two checks, and the approval arrives two checks after that |
| `pending-`       | The ownership TXT record is never found: "Verify" answers `409` with mail's reason                             |
| `expired-`       | The ownership value has expired: "Verify" answers `409` until "Get a new value"                                |
| `busy-`          | "Verify" is rate limited: `429` with `Retry-After: 300`                                                        |
| `down-`          | The mail server cannot be asked: "Verify" answers `503`                                                        |
| `slow-`          | Stays `provisioning` for two checks after "Verify"                                                             |
| `review-`        | Is never approved                                                                                              |
| `suspended-`     | Is suspended by the provider once verified                                                                     |
| `conflict-`      | The MX record stays in conflict, with what DNS returned                                                        |
| `error-`         | The SPF lookup keeps failing                                                                                   |
| `grace-`         | The plan has lapsed into its grace period                                                                      |
| `taken…`         | Already in use on the mail service (`409` when adding)                                                         |

Public suffixes (`co.uk`, `github.io`…) and the provider's own names (`abnormalhq.com`, `abnormal.bid` and anything above or
below them) are refused when adding. `MOCK_DOMAIN_APPROVAL=off pnpm dev` makes a verified domain go live at once, like a shop
with approval switched off; `MOCK_DOMAINS=off pnpm dev` behaves like a mail before buyer domains: no plan carries
`customDomains` and the six routes answer `404`.

### Cookies, origin and caching

- The purchase credential is `mailhq_shop` (64 lowercase hex characters), set only by the server via an HttpOnly, SameSite=Lax cookie; over HTTPS it is also Secure, the path is `/`,
  it is valid for one year and is extended on every order or renewal. The database stores only a digest of the token; the order id is not an access credential.
- The account session is `mailhq_customer` (43 base64url characters), set when `account/verify` or `account/password-login` succeeds, valid for 30 days, with the same attributes as above; the database likewise stores only a digest.
  On `account/logout` the Worker returns a `Set-Cookie` that clears it regardless of how mail answers (including failures and internal call exceptions), except for cross-site or malformed requests rejected at the Worker;
  the page also treats a `5xx` with a JSON body on logout (the Worker's answer) as logged out; Cloudflare's own error pages (Worker threw or exceeded limits, cookie not cleared) do not count.
- Shop browser requests use same-origin cookies; the Worker forwards only these two cookies (each when unique and well-formed; the `account/domains` routes get the account cookie alone, the address check none), and rebuilds only the corresponding one on success of `checkout` / `renew` / `account/seats/add` and `account/verify` / `account/password-login`
  (not inheriting upstream Domain, Path and other attributes); it does not forward the backend login cookie, Authorization or other private request headers.
  The redeem API keeps using `credentials: omit` and does not carry cookies because of the shop.
- For shop POST requests, this site's Worker requires a real `Origin` exactly equal to the current origin, rejecting missing, `null` and cross-origin values; it preserves the original value when forwarding and must not forge it.
  mailhq uniformly requires `Origin` to equal the storefront address in the sales settings for order creation, payment and active order lookup.
- The internal request URL keeps using `MAIL_ORIGIN=https://console.abnormalhq.com`, ensuring OpenNext initializes with its own origin; the internal address must not be changed to this site in order to pass the origin check.
- Shop API responses always carry `Cache-Control: private, no-store, max-age=0`, plus `Referrer-Policy: same-origin` and `X-Robots-Tag: noindex, nofollow`;
  the Worker builds the response headers itself, taking only `Content-Type` and `Retry-After` from mail (likewise for the redeem API, just with `Cache-Control: no-store`), and does not expose upstream CORS, CSP, framework or timing headers.
  Product data, orders and redeem codes are never put into the static page build output: the shop and the home page's pricing section
  read the catalog in the browser, and the pricing page (`/pricing/`) is rendered on the Worker for each request, reading `catalog` from
  mail over the same `MAIL` binding (`src/storefront/lib/catalog-server.ts`: `GET`, `Accept-Language` of the page, no cookie, 3 second
  timeout). That one server-side read keeps a validated answer in the Worker's cache for 60 seconds per language, so prices on the
  pricing page can trail a change in the sales settings by up to a minute; checkout always prices the order in mail. Pages use `Referrer-Policy: same-origin`, keeping the Origin of same-origin forms and avoiding sending the referring page cross-site.
- Order creation, payment, active order lookup, renewal, login and login link verification are each rate limited by mailhq; the proxy preserves `CF-Connecting-IP`. Neither side logs request bodies, response bodies, cookies, signing keys or redeem codes.

### Configuration

The storefront address and the mailbox redeem page in the sales settings are `https://abnormalhq.com` (mail builds Chinese pages under `/zh/` for it; for the retired
`https://onboard.abnormalhq.com` it still builds that site's layout, Chinese at the root and English under `/en/`).
The Credit application home page is `https://abnormalhq.com/shop/`, the notification URL is `https://abnormalhq.com/api/shop/notify`,
and the callback URI is `https://abnormalhq.com/shop/orders/`. The current Yipay-compatible mode needs no Ed25519 public key.
Until those are changed, the old addresses keep working: the `onboard.abnormalhq.com` domain is bound to this Worker, which still answers its `/api` and 301s its pages here.

The buyer's purchase, payment return, order lookup, renewal, account and code collection all happen on this site; mail handles sales management and the internal business API.

Local integration uses the dual-Worker setup described above, with the storefront address in the local mail sales settings changed to this site's preview origin (`http://localhost:8786`).
The shop origin setting and the redeem API's `ONBOARD_ORIGIN` are two independent settings; check both when changing ports. Never put production merchant credentials into browser-side code or the mock API.
The shop mock API of `pnpm dev` (`src/storefront/mock/shop.ts`) answers by the same rules, and login links are printed in the dev server's terminal.

## Service status

The footer of every page and the home page's hero show the live service status as one link to the status page: the state and the availability of the last 30 days, for example "All systems operational · 99.98% uptime over the last 30 days" (`src/components/ServiceStatus.tsx`). It is mail's public status page (`https://console.abnormalhq.com/status`) in one line, so it never says more than that page does: no service names, hosts, outage periods or maintenance text.

- **Browser to this site**: `GET /api/status` (same origin, no cookies). Response `200`: `{ "status": "up", "days": 30, "uptime": 99.98, "updatedAt": "2026-11-10T12:00:00.000Z" }`.
  - `status`: `up` (every service up), `down` (an outage outside maintenance), `maintenance` (a maintenance in progress and no other outage) or `pending` (no data yet).
  - `uptime`: successful checks out of all checks of every service on the status page over the last `days` days (today included), as a percentage with two decimals, rounded down so it reads `100` only when no check failed; `null` before the first check.
  - `updatedAt`: when mail read the data (ISO 8601).
- **This site to mail**: the Worker (`src/storefront/worker/status.ts`) reads mail's `GET /api/status/summary` through the `MAIL` binding. Nothing of the browser's request is sent on (no cookie, client IP, language or body): the answer is the same for everyone. mail's `src/proxy.ts` lets the route through signed out, and mail reads its database for it at most once a minute.
- **Caching**: a Worker instance keeps the summary for 60 seconds and answers with `Cache-Control: public, max-age=<what is left of them>`; a tab also shares one request between the footer and the hero and reuses it for a minute across pages (`src/lib/status.ts`). While a page stays open the status is read again every minute (not in a background tab, which reads as soon as it is shown again), and a refresh that fails clears what is shown, so a page left open does not keep saying "All systems operational" through a later outage. What is shown is at most a few minutes old.
- **Failure**: the Worker passes on only a summary it has checked, rebuilt from the four fields. Anything else (mail unreachable, a mail before the endpoint answering `401`, a redirect, a non-JSON or malformed body, an unknown state, a figure outside 0 to 100) is a JSON `503` with `kind: "unavailable"`, `Cache-Control: no-store` and `Retry-After: 60`, and a summary that could not be refreshed is not served past its minute. The pages then show nothing, as they do for `pending`; the footer's "Service status" link stays.
- **Contract**: the route, method, states, fields, days and cache lifetime are in `docs/onboard-contract.json` (`status`), checked by `tests/storefront/status.test.ts` here and by mail's contract test.
- Other methods get `405` with `Allow: GET`; nothing else under `/api/status` exists here (mail's subscription endpoints are not proxied).
- `pnpm dev` answers `/api/status` with a fixed summary (`src/app/api/status/route.dev.ts`).

## Proposed

Nothing under this heading is agreed in data form yet: none of it is in `docs/onboard-contract.json`, which must stay byte for byte
equal to mail's copy, and mail's `docs/shop.md` lists the same points as proposed.

- **Discount codes**, **seat plans** and **buyer domains** are no longer proposed. mail's copy of the contract file took the
  `coupon` route and the order fields `couponCode` and `couponDiscountCents` (mail #221), and with version 3 the order quote
  (`shop.quote`), the seat routes (`shop.seats`), the buyer-domain routes and enums (`shop.buyerDomains`), the trial route
  (`shop.trials.routes`, which lists both of its methods), `shop.planKinds` and the coded refusals (`shop.refusalCodes`); this
  repository's copy follows byte for byte, and the Worker's route table (`SHOP_ROUTES`) is checked against all the route
  lists, each of which gives a route the list of its methods. See "Discount codes", "Seat plans" and "Buyer domains" above.
- **Seat orders**: mail proposes `quantity` and `seatPriceCents` in `publicOrderFields` (0 for a fixed plan's order) and a third
  order `kind`, `"seats"`. The storefront's order parser does not accept `"seats"` yet; when mail is ready to publish it, the
  parser, the order page ("Seats added" instead of "Renewal order", "add seats again" instead of "pay" after a stale price) and
  the account's order list change first, then mail stops rewriting the kind. `tests/storefront/seats.test.ts` fails once the
  contract file takes the two fields, as the reminder. See "Seat plans" above for what the storefront does until then.
- **A code on the order page**: a field on an unpaid purchase order without a code, sent as `coupon` with the pay form or
  `pay/stripe` (it only works before the first press on "Pay"). Not built: the Worker's pay form handling and the order page would
  both need it, and the shop page covers the common case.

## Self-hosted mail server and quotas

mailhq currently uses only Stalwart; activation, password changes, quotas and domain ownership are handled server-side by active connection. Mail is sent, received and stored in Stalwart;
the Worker provides the application and protocol connections, and PostgreSQL stores business records and a rebuildable reading cache, not the primary mailbox storage.

`quotaSupportedByDomain` in `/api/onboard/cdk` and in public products and orders returns a boolean per domain; only a single, valid Stalwart binding promises a per-mailbox hard quota.
`false` or mixed capability must not be read as unlimited storage; the UI shows that the quota is unavailable or that the selected domain's server settings apply, respectively.
When `quotaMb > 0` and the domain supports quotas, the product / redeem code's capacity is used; `quotaMb = 0` means the connection's default quota, and only when the server default is also 0 is no capacity limit set.
Orders keep `quotaMb` and the other sales terms from the time of purchase; `quotaSupportedByDomain` is recomputed at query time from the current domain bindings, and the actual activation follows the current server configuration.

The portal URL is returned from `STALWART_WEBMAIL_URL`, currently configured in the repository as `https://webmail.abnormalhq.com`.
Users can view client settings and change their password with the current password under "Settings" in the webmail; forgotten passwords are still reset by an administrator after verification.

## Free trials

`GET /api/shop/account/trial` requires a verified account session and returns `{ trial: null }`, an unclaimed offer (`claimed: false`, `days`, `quotaMb`, `domains`, `productName`), or the account's lifetime claim (`claimed: true`, `orderId`). `POST` to the same endpoint with `{}` and a same-origin request claims the offer atomically and returns `{ orderId }`; retries return the same claim. It collects no card or payment information. The catalog's optional `trial: { days, quotaMb }` advertises an enabled, available offer.

Trial orders have `trial: true`, `status: "paid"` (the entitlement is available), and zero price; no payment was collected. Only this explicit grant shape permits a zero-price order. Trial subscriptions publish `trial: true` and skip the usual grace period. The existing account mailbox manager sets up the one mailbox and rejects changes at expiry.

The renewal response may include `trial`, `fiatRenewMinor` and `currency`. A request to `POST /api/shop/renew` can select `provider: "stripe"` for a manual card payment when that amount is offered. Otherwise it uses LDC as before. This buys only the selected periods and never starts auto-renewal. The first paid upgrade keeps the trial's mailbox and starts its paid term at payment time. The account's single trial remains used after upgrading or expiry.

### Discount codes on trial upgrades

The signed-in trial owner can enter a code such as `WELCOME10` on the upgrade form. `renew` takes optional `coupon` with either `ldc` or `stripe`. The backend checks the live trial state and owner, applies the discount to only one paid period, and keeps the subscription's regular renewal prices. A three-period upgrade therefore discounts one period and charges the other two in full. After upgrading, later renewals reject discount codes. The existing expiry, total-use and per-buyer limits apply across purchases and trial upgrades together.

The upgrade form shows regular prices and explains that the order confirmation shows the final discount before payment. Renewal order pages display the server's `couponCode` and `couponDiscountCents`; they never infer a renewal discount from browser storage. Stripe upgrades remain one-time payments of the discounted total, without enabling automatic billing.

### Direct trial-to-Team upgrades

For a signed-in trial owner, `renewal` also returns localized `upgradePlans` and `upgradePayment`. A plan contains `id`, `name`, `description`, `seatMin`, `seatMax`, `quotaMb`, `customDomains`, `periodDays`, `priceCents`, `originalPriceCents`, `discountPercent`, `renewPriceCents` and `fiatPriceMinor`. Payment availability has `{ ldc: boolean, stripe: { currency } | null }`. Ineligible or anonymous requests get no choices. Only enabled per-seat plans preserving the trial's quota and domains are offered.

`renew` accepts `{ token, productId, quantity, periods, coupon?, provider? }`; `quantity` is the total Team seat count including the existing mailbox. The server owns all prices. Public and account orders may carry `trialUpgrade: true` for the confirmation and success copy. The existing subscription, mailbox and mail stay in place, with extra slots and the paid plan's own-domain entitlement available after payment. WELCOME10 reduces the first paid period only; additional prepaid periods, renewals and later seat changes retain full rates. Both LDC and card upgrades require manual renewal. Deploy after the Console API and migration 0059.
