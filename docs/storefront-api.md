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

| Method | Path                                   | Request                                                                                    | Success response                                                                     |
| ------ | -------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| GET    | `/api/shop/catalog`                    | None                                                                                       | `200`, `{ available, payment, products, onboardUrl }`                                |
| POST   | `/api/shop/checkout`                   | JSON: `{ productId, email?, provider? }`                                                   | `201`, `{ orderId }`, and sets the buyer cookie                                      |
| GET    | `/api/shop/orders?id=<order id>`       | Buyer cookie or account cookie                                                             | `200`, `{ order, code, codeStatus, onboardUrl, subscription }`                       |
| POST   | `/api/shop/pay`                        | Form: `orderId=<order id>&lang=zh\|en`, `application/x-www-form-urlencoded`                | `303` to LDC payment, Stripe's hosted payment page, or back to the order page        |
| POST   | `/api/shop/pay/stripe`                 | JSON: `{ orderId, lang? }`                                                                 | `200`, `{ status: "open", clientSecret, publishableKey }` or `{ status }`            |
| POST   | `/api/shop/reconcile`                  | JSON: `{ orderId }`                                                                        | `200`, `{ "status": "pending" }` or `{ "status": "paid" }`                           |
| GET    | `/api/shop/notify`                     | Credit signed notification parameters                                                      | `200`, plain text `success`; on failure `fail` with the corresponding non-2xx status |
| POST   | `/api/shop/renewal`                    | JSON: `{ token }` (renewal token)                                                          | `200`, the subscription's renewal info (see below)                                   |
| POST   | `/api/shop/renew`                      | JSON: `{ token, periods, email? }`                                                         | `201`, `{ orderId }`, and sets the buyer cookie                                      |
| GET    | `/api/shop/account`                    | Account cookie                                                                             | `200`, the account (see below); `401` when not logged in                             |
| POST   | `/api/shop/account/login`              | JSON: `{ email, turnstileToken? }`                                                         | `200`, `{ "sent": true }`, sends a login link to that email                          |
| POST   | `/api/shop/account/peek`               | JSON: `{ token }` (login token)                                                            | `200`, `{ email }`; read-only, does not consume the token or set a cookie            |
| POST   | `/api/shop/account/verify`             | JSON: `{ token }`                                                                          | `200`, `{ email, claimed }`, and sets the account cookie                             |
| POST   | `/api/shop/account/logout`             | JSON: `{}`                                                                                 | `200`, `{ "ok": true }`; the Worker always clears the account cookie                 |
| POST   | `/api/shop/account/portal`             | JSON: `{ subscriptionId }`                                                                 | `200`, `{ url }` (the customer portal at `https://billing.stripe.com/…`)             |
| POST   | `/api/shop/account/password-login`     | JSON: `{ email, password, turnstileToken? }`                                               | `200`, `{ email, claimed }`, and sets the account cookie                             |
| POST   | `/api/shop/account/password`           | JSON: `{ password, currentPassword? }` (account cookie)                                    | `200`, `{ "ok": true }`; sets or changes the login password                          |
| POST   | `/api/shop/account/register`           | JSON: `{ email, password, turnstileToken? }`                                               | `200`, `{ "sent": true }`, sends a registration confirmation link to that email      |
| GET    | `/api/shop/account/mailboxes`          | Account cookie                                                                             | `200`, mailbox management (see below); `401` when not logged in                      |
| POST   | `/api/shop/account/mailboxes/create`   | JSON: `{ orderId, domain, username, password }`                                            | `201`, `{ email, imap, smtp, webmail }`                                              |
| POST   | `/api/shop/account/mailboxes/password` | JSON: `{ mailboxId, password }`                                                            | `200`, `{ email }`                                                                   |
| POST   | `/api/shop/account/mailboxes/status`   | JSON: `{ mailboxId, status }` (`active` / `disabled`)                                      | `200`, `{ status }`                                                                  |
| POST   | `/api/shop/account/mailboxes/delete`   | JSON: `{ mailboxId, confirm }` (`confirm` repeats the email address)                       | `200`, `{ "ok": true }`                                                              |
| POST   | `/api/shop/account/forgot`             | JSON: `{ email, turnstileToken? }`                                                         | `200`, `{ "sent": true }`; sends a password reset email when this account exists     |
| POST   | `/api/shop/account/reset`              | JSON: `{ token, password }` (reset token)                                                  | `200`, `{ email, claimed }`, and sets the account cookie                             |
| POST   | `/api/shop/account/google/start`       | JSON: `{ lang?, link? }`                                                                   | `200`, `{ url }` (Google authorization page), and sets the Google state cookie       |
| POST   | `/api/shop/account/google`             | JSON: `{ code, state }` (as sent back by Google to the account page) + Google state cookie | `200`, `{ email, claimed, created, linked, lang }`, sets the account cookie on login |
| POST   | `/api/shop/account/google/unlink`      | JSON: `{}` (account cookie)                                                                | `200`, `{ "ok": true }`; `404` when not linked                                       |

Failure statuses: except for `pay` (always `303`, see below), every shop POST may return `403` (`Origin` is not the storefront address in the sales settings; the Worker rejects cross-site origins first),
`415` (wrong body type), `413` (body over 4 KiB), `400` (invalid body or field), `429` (rate limited, with `Retry-After`) and `503` (backend temporarily unavailable).
Per endpoint, additionally: `checkout` has `409` (product withdrawn, domain no longer managed or no card price) and `503` (sales paused or this payment method not enabled);
`orders` and `reconcile` have `404` (order does not exist or credential does not match); `renewal` has `404` (token invalid or expired); `renew` has `404` (token),
`409` (Stripe subscriptions cannot be renewed manually) and `400` (wrong number of periods or total over the per-payment limit); `account` has `401` (not logged in);
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
The platform notification is handled as plain text, the payment endpoint as form and redirect, and the remaining endpoints use JSON. A failed internal call does not automatically retry order creation or payment requests, nor fall back to the public backend address.

### Products, orders and payment

- `catalog` returns only products that are on sale and whose domains are still managed; when sales are not open, `available` is `false` and `products` is empty. A product contains `id`, `name`,
  `description`, `originalPriceCents`, `discountPercent`, `priceCents`, `domains`, `mailboxCount`, `quotaMb`, `quotaSupportedByDomain`, `codeExpiresDays`;
  subscription products also have `periodDays` (period length in days, 0 for a one-time purchase) and `renewPriceCents`, and those that can be bought by card have `fiatPriceMinor` (in the smallest unit of the shop currency, 0 meaning it cannot be bought by card);
  Client ID, Client Secret and backend settings are not returned. `payment` is `{ ldc: boolean, stripe: { currency } | null }`, with the two payment methods toggled separately, and
  `currency` is a three-letter lowercase ISO 4217 code; when an old backend does not return `payment`, treat it as LDC only.
  `originalPriceCents` is the original price and `priceCents` the price actually paid, both positive integers in cents; `discountPercent` is an integer 0-99, with 25 meaning 25% off.
  The original price must not be lower than the price paid, and the two are equal when there is no discount (0); the frontend displays the backend amounts and does not recalculate or submit the price paid itself.
  Prices are in integer hundredths of an LDC; `codeExpiresDays` of 0 means the redeem code never expires, and says nothing about the mailbox service period.
- `checkout` accepts only a product ID; `provider` defaults to `ldc`, and `stripe` means bank card (the product must have `fiatPriceMinor` and Stripe must be enabled in the backend);
  `email` is optional, the contact address for subscription expiry reminders. The backend saves a snapshot of the original price, discount rate, price paid and entitlements; later product adjustments do not change the order snapshot.
  Prices passed in by the browser play no part in billing; products whose sales are paused, that are withdrawn or whose domain is no longer valid cannot be ordered. The request language is recorded on the order, for reminder emails and the return page after payment.
- Order lookup only reads the single order the current browser can access: the buyer cookie is the one that placed the order, or the logged-in account owns it; there is no public order list. `order` is the order's public projection
  (mail's `PUBLIC_ORDER_FIELDS`): `id`, `productName`, the price and entitlement snapshot (`originalPriceCents`, `discountPercent`,
  `priceCents`, `domains`, `mailboxCount`, `quotaMb`, `quotaSupportedByDomain`, `codeExpiresDays`, `periodDays`, `renewPriceCents`),
  `kind` (`purchase` / `renewal`), `subscriptionId`, `periods`, `provider`, `currency` (the currency of Stripe orders, in whose smallest unit `priceCents` is expressed),
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

### Renewal

- Renewal tokens are issued by mail and appear in the renewal links on the order page, the account page and the expiry reminder emails (`/shop/renew/?t=…`; reminder emails link to the Chinese or English page according to the subscription's language),
  and need neither login nor the original browser. The page carries it along when switching language.
- `renewal` returns `{ subscriptionId, productName, mailboxCount, periodDays, renewPriceCents, currentPeriodEnd, state, mailboxes, maxPeriods, hasContactEmail, provider, autoRenew }`;
  an invalid or expired token gives `404`. Stripe subscriptions are charged automatically by Stripe each period and cannot be renewed manually on the renewal page (`maxPeriods` is 0 and `renew` returns `409`); they are managed on the account page.
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

### Cookies, origin and caching

- The purchase credential is `mailhq_shop` (64 lowercase hex characters), set only by the server via an HttpOnly, SameSite=Lax cookie; over HTTPS it is also Secure, the path is `/`,
  it is valid for one year and is extended on every order or renewal. The database stores only a digest of the token; the order id is not an access credential.
- The account session is `mailhq_customer` (43 base64url characters), set when `account/verify` or `account/password-login` succeeds, valid for 30 days, with the same attributes as above; the database likewise stores only a digest.
  On `account/logout` the Worker returns a `Set-Cookie` that clears it regardless of how mail answers (including failures and internal call exceptions), except for cross-site or malformed requests rejected at the Worker;
  the page also treats a `5xx` with a JSON body on logout (the Worker's answer) as logged out; Cloudflare's own error pages (Worker threw or exceeded limits, cookie not cleared) do not count.
- Shop browser requests use same-origin cookies; the Worker forwards only these two cookies (each when unique and well-formed), and rebuilds only the corresponding one on success of `checkout` / `renew` and `account/verify` / `account/password-login`
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

## Proposed

Nothing under this heading exists in mail yet. The website already implements its side against the contract below (client, Worker
route, `pnpm dev` mock, tests), and hides the feature until mail has it; the routes are deliberately **not** in
`docs/onboard-contract.json`, which must stay byte for byte equal to mail's copy. When mail implements one, move its section up
into "Shop API", add the route to both copies of the contract file, and delete it from here.

### `POST /api/shop/address` Check an address before buying

"Check your address" in the home page's hero and on the pricing page (`src/components/AddressCheck.tsx`): the visitor types a
username, picks one of the domains the plans on sale offer, and sees whether the address is free, before there is an order or a redeem
code. The existing `POST /api/onboard/username` cannot serve this: it requires a valid redeem code precisely so that it is not an entry
point for probing usernames. This endpoint answers without one, so it is an enumeration oracle by design and the limits below are part
of the contract, not an implementation detail.

Request: `{ "domain": "abnormalhq.com", "username": "kunish" }`, `Content-Type: application/json`, same-origin `Origin`. No redeem
code, no cookie (the browser sends `credentials: omit`, and the Worker forwards none to this route even when the browser has shop
cookies), no Turnstile token.

Response `200`: `{ "available": true, "email": "kunish@abnormalhq.com" }`, or `{ "available": false, "email": "…" }` when the address
cannot be had. `email` is the normalised address the answer is about.

- `username` is normalised with `normalizeUsername` and validated against `LOCAL_PART_PATTERN`, exactly as `/api/onboard/username`
  does; a username that fails is `400` with `{ error }` in the request language (the page then shows its own wording of the rule).
- `domain` must be a domain of a product currently in `GET /api/shop/catalog` (on sale, domain still managed). Any other domain, managed
  or not, is `400`: the endpoint must not reveal which addresses exist on domains that are not publicly for sale.
- "Taken" is the same test as `assertUsernameAvailable` (local records, and `listMailboxes(domain)` on the Stalwart server). Reserved
  and blocked names answer `available: false` like a taken one, with nothing to tell them apart. Unlike the redeem API, taken is a `200`
  answer here rather than a `409` error: it is the normal outcome of a search, and shop errors have no `kind` to switch on.
- Failure statuses, all `{ error }` in the request language like every shop endpoint: `400` (invalid username or domain), `403` (`Origin`
  is not the storefront address), `413` / `415` (body), `429` with `Retry-After` (rate limited), `503` (the mail server could not be
  asked: never answer `available: true` on a guess). `404` means "this backend has no address check".
- Rate limiting, per source IP (`CF-Connecting-IP`, which the Worker keeps): the page asks once per pause in typing (500 ms debounce,
  one request in flight), so a person needs a handful of requests. Proposed: 10 per minute and 100 per day per IP in a new
  `shop:address` rule (stricter than `ONBOARD_RULES.lookup`'s 30 per minute, which is protected by a redeem code), plus a global ceiling
  per domain (for example 600 per hour) so a distributed sweep degrades to `429` instead of listing the domain's mailboxes. Usernames
  asked about are not logged or stored.
- Turnstile is deliberately not part of the request: tokens are single-use and the check runs as the visitor types. If rate limiting
  proves too weak, the fallback is to require a token (action `shop-address`) and have the page check on an explicit button press
  instead of on a pause; that would be a contract change on both sides.
- The answer reserves nothing. The page says so, and the forms that create the mailbox (`account/mailboxes/create`, `/api/onboard/redeem`)
  stay authoritative.

`GET /api/shop/catalog` gains `addressCheck: true` when the endpoint is available (a sales setting may switch it off; absent on every
backend before it). The pages show the check only when the catalog carries the flag, so nothing appears, and no request is made, against
a mail that does not have the endpoint. As a second line, the Worker turns mail's `404` for this route (Next.js's HTML not-found page
included) into a JSON `404` instead of the usual `503 unavailable`, and the page removes the form when it sees one.

What the website does with a free address: the result links to `/shop/?address=<name@domain>` (the plan cards link to
`/shop/?plan=<product id>`; both parameters survive the header's language toggle). The shop points out the plan, shows the address and
keeps it in the tab's `sessionStorage` (`abnormal-address`), because the way from the shop to the mailbox form leaves the site for the
payment page. "My mailboxes" on the account page then opens its create form with the username and domain filled in when the order
offers that domain, and the redeem page starts its first row with the username. None of this is sent to mail before the visitor submits
one of those forms.

`pnpm dev` implements all of this in the mock (`src/storefront/mock/shop.ts`); start it with `MOCK_ADDRESS_CHECK=off pnpm dev` to see
the pages against a backend without the endpoint.

## Self-hosted mail server and quotas

mailhq currently uses only Stalwart; activation, password changes, quotas and domain ownership are handled server-side by active connection. Mail is sent, received and stored in Stalwart;
the Worker provides the application and protocol connections, and PostgreSQL stores business records and a rebuildable reading cache, not the primary mailbox storage.

`quotaSupportedByDomain` in `/api/onboard/cdk` and in public products and orders returns a boolean per domain; only a single, valid Stalwart binding promises a per-mailbox hard quota.
`false` or mixed capability must not be read as unlimited storage; the UI shows that the quota is unavailable or that the selected domain's server settings apply, respectively.
When `quotaMb > 0` and the domain supports quotas, the product / redeem code's capacity is used; `quotaMb = 0` means the connection's default quota, and only when the server default is also 0 is no capacity limit set.
Orders keep `quotaMb` and the other sales terms from the time of purchase; `quotaSupportedByDomain` is recomputed at query time from the current domain bindings, and the actual activation follows the current server configuration.

The portal URL is returned from `STALWART_WEBMAIL_URL`, currently configured in the repository as `https://webmail.abnormalhq.com`.
Users can view client settings and change their password with the current password under "Settings" in the webmail; forgotten passwords are still reset by an administrator after verification.
