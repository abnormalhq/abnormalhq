# Abnormal · Email service

[Live site](https://abnormalhq.com/)

The bilingual (Chinese and English) marketing site for the Abnormal email service, built with Next.js (App Router), Tailwind CSS 4 and TypeScript, with UI components from [Abnormal's shadcn registry](https://github.com/abnormalhq/ui). The site is the home of all of Abnormal: it introduces the email service, publishes its plans and prices, sells mailboxes and activates them (the storefront: shop, redeem page, buyer account and guide, which used to be the separate onboard site), and sends visitors on to webmail and service status; mailboxes for a team (plans sold per mailbox) and mailboxes on the buyer's own domain are bought and set up in the storefront too, on plans that offer them; setup help is still handled through the inquiry dialog. Pages are prerendered at build time (except the pricing and download pages, which render per request) and run on a Cloudflare Worker through [@opennextjs/cloudflare](https://opennext.js.org/cloudflare); the navigation menu, theme toggle and inquiry dialog are React client components. Cloudflare Workers Builds watches `main` and deploys automatically; GitHub Actions only runs checks.

## Chinese and English

English is the default language, at the root (`/`, `/privacy/`, `/terms/`); Chinese is under `/zh/` (`/zh/`, `/zh/privacy/`, `/zh/terms/`). This is implemented by the two route groups `(en)` and `(zh)` under `src/app`, each with its own root layout. The default language and the language order are written once, in `defaultLang` and `langs` in `src/i18n/paths.ts`; paths, `hreflang`, the sitemap, `llms.txt` and the structured data all read them from there. The language toggle in the header (`langToggle`, labelled "EN" or the single Chinese character for Chinese) switches to the same page in the other language; every page emits `hreflang` links pointing at each other, with `x-default` pointing at the English version.

The addresses are only each language's canonical address; which language a visitor lands in is decided by their preference (`src/lib/lang.ts`, run in `worker.ts` before OpenNext, for whole-page GET / HEAD page requests only). Clicking the language toggle in the header adds `?lang=zh`; the Worker stores that choice in the cookie `abnormal_lang` (one year, `Domain=abnormalhq.com`, shared by the website and webmail, the same name as mail's `LOCALE_COOKIE`) and redirects to the address without the parameter. With the cookie set, an address whose language differs from the cookie is 302-redirected to the same page in the other language, so a shared link always opens in the reader's own language. Without a cookie, only the unprefixed English addresses follow `Accept-Language`; a prefixed address such as `/zh/` is the link author's explicit choice and is left alone. Requests without `Accept-Language` (crawlers) are never redirected, so both sets of addresses that `hreflang` points at stay crawlable. Redirect responses carry `Cache-Control: private, no-store` and enter no cache; requests that ask for Markdown (agents) are not redirected by language.

English used to live under `/en/`: `/en/`, `/en/privacy/`, `/en/terms/` and the matching `/md/en/...` are 301-redirected by `redirects()` in `next.config.ts` to the new addresses at the root, so old external links and search results keep working.

- All UI copy is in `src/i18n/zh.ts` and `src/i18n/en.ts`; both implement `Copy` from `src/i18n/types.ts`, so a missing field fails `pnpm typecheck`. `tests/i18n.test.ts` also checks item by item that the two copies have the same structure (including the fields of every list item, optional fields included) and requires the language-independent values `link`, `icon`, `anchor`, `featured`, `primary`, `path` and `wide` to be identical on both sides. Server components call `useCopy(lang)` for the current language's copy, linked-site addresses and language-prefixed site paths.
- Chinese headings end with a full-width full stop and English ones with a half-width one, taken from `t.dot`; headings that wrap only at some widths separate their two lines with `t.space` (a space in English).
- Decorative English labels (each section's `eyebrow`, the inquiry dialog's `kicker`, the footer's `tagline`, the legal page table of contents' `tocKicker`) are also in the copy: both languages write them in English and components render them with `lang="en"` so screen readers read them as English; the tests check that they contain no Chinese and that every `Eyebrow` on the page carries `lang="en"`.
- Sentences with a link or variable in the middle are written as templates, such as `inquiry.legal`'s "Requests and services are covered by the {terms} and {privacy}.", filled with links by `fillTemplate` in `src/lib/template.ts`; the spaces around the links are written in each language's copy, and components add none. Template fields are typed in `Copy` as `Template<"terms" | "privacy">`, so a component passing too few, too many or misspelled names fails `pnpm typecheck`; `tests/i18n.test.ts` then checks that each language's template uses exactly those names and that there are no unregistered templates. The inquiry dialog renders only in the browser, so prerendering cannot catch a typo here; these two checks have to.
- Buyer-journey addresses are generated by `linksFor(lang)`: the storefront pages follow the page language like every other page, while webmail and the status page follow the browser language and share one address for both languages.
- Client components (`Header`, `ThemePicker`, `InquiryDialog`, `CurrentYear`, `VideoPlayer`, `HomePricing`, `AddressCheck`, `CommandLine`, `TocSpy`, `DownloadHint`) do not import the copy module; `SiteLayout` passes each the copy it uses through props, so the browser bundle does not carry the full copy of both languages. For the same reason the sentences of the pricing copy that contain a number are templates (`"{price} LDC every {period}"`), not functions, which cannot cross from a server component to a client one; and the pricing components import `src/storefront/lib/catalog.ts` (catalog, validators, money formatting) rather than `shop.ts`, which also holds the order and account clients. The path helpers live in `src/i18n/paths.ts` for the same reason. The inquiry text and email subject are generated per language by `src/lib/inquiry.ts`.
- Legal pages: Chinese in `src/content/legal/zh/privacy.mdx` and `terms.mdx`, English in `src/content/legal/en/privacy.mdx` and `terms.mdx`. The English version opens by noting that it is a translation and the Chinese version governs; when changing the terms, change both and update `updated`.

## Storefront: shop, redeem page, account and guide

The storefront used to be its own site, [onboard](https://github.com/abnormalhq/onboard) at `onboard.abnormalhq.com`; it now lives here, under `src/storefront/`, with the same pages, flows and API. Merchant credentials, products, orders, redeem codes and mailboxes all stay in [mail](https://github.com/abnormalhq/mail) (mailhq); this site renders the pages and proxies the API.

| Page                                                                   | English              | Chinese                 |
| ---------------------------------------------------------------------- | -------------------- | ----------------------- |
| Buy a mailbox                                                          | `/shop/`             | `/zh/shop/`             |
| Order (payment return, code collection)                                | `/shop/orders/?id=…` | `/zh/shop/orders/?id=…` |
| Renewal                                                                | `/shop/renew/?t=…`   | `/zh/shop/renew/?t=…`   |
| My account (sign-up, sign-in, mailbox management, orders and renewals) | `/shop/account/`     | `/zh/shop/account/`     |
| Redeem a code and activate mailboxes                                   | `/redeem/`           | `/zh/redeem/`           |
| Guide (after activation: webmail, mail apps, Claude and ChatGPT)       | `/guide/`            | `/zh/guide/`            |

The order, renewal and account pages depend on a purchase or login session: they are `noindex`, have no Markdown version and are not in the sitemap (`sessionPagePaths` in `src/lib/pages.ts`), but the language redirect applies to them with their query string kept, and the header language toggle carries their own parameters (order number, renewal token, login and reset tokens; `switchHref` in `src/i18n/paths.ts`). Webmail (`https://webmail.abnormalhq.com/`) and the status page (`https://console.abnormalhq.com/status`) are mail's; the webmail sign-in page and the status page link back here.

### Page flow

1. **Redeem code**: once all 16 characters are typed it is checked against mailhq, showing the domains it can activate, its expiry and how many mailboxes are left; missing, used-up, expired and disabled codes are all reported at this step.
2. **Domain and count**: pick a domain when the code allows several, and a count when more than one can be activated (at most 20 per request).
3. **Accounts**: one row per mailbox; the username is validated live against mailhq's rules, checked for duplicates and, after a half-second pause, for availability; the password is 8 to 128 characters without whitespace, or "generated randomly".
4. **Notification address** (optional): after activation mailhq sends a copy of the new mailbox's address, password and server addresses there.
5. **Activate**: successes are listed with the IMAP / SMTP servers and the webmail entry (passwords are shown only this once, with confetti when everything activates; until a copy has been emailed, the browser asks before the page is reloaded, closed or left in the same tab, except by "Redeem again"); failures stay in the form with the reason beside them.

Buying happens at `/shop/` with Linux DO Credit, a card (Stripe) or USDT on TRON (TRC-20, sent to an address of the order's own and confirmed on chain); the order page collects the code after payment, and "My account" manages mailboxes, orders and subscriptions.

The checkout shows what it is doing. The shop page and the order page hold the shape of what is loading (grey blocks, not a sentence), plans and panels rise into place, the button that was pressed carries a spinner while the order is created, and a refused checkout is scrolled into view. The order page has a three-step progress line (order created, payment, code; `orderSteps` in `src/storefront/lib/order-progress.ts`) and says so while it is watching for the payment. A payment made in this tab is celebrated once, with the confetti of the redeem page: the order page notes an order it showed as pending in the tab's `sessionStorage` (`abnormal-order-awaiting`), so the celebration survives the trip to the payment page and back, and an order that was paid another day opens without it. All of it stops under reduced motion (the theme's rule in `src/styles/abnormal.css`); the storefront's own keyframes are in `src/styles/global.css`.

### Discount codes

"I have a discount code" on the shop page opens a field. "Apply" previews the code against the plans on the page in one request (`POST /api/shop/coupon` with up to 8 `{ productId, provider }` entries, which mail counts as one guess; a larger catalog takes further requests, at most 4 per press, since mail limits code guesses to 10 per 10 minutes per IP and counts previews and checkouts together), and each plan then shows its price with the code, or that the code cannot be used for it. A mail before that form answers 400 to it and is asked plan by plan instead. mail gives one answer for every reason a code cannot be used, so the page shows one sentence and no reason. Whatever is in the field is sent with checkout, for Linux DO Credit and card alike: mail prices the order with it or refuses the checkout, so a typed code is never dropped silently.

mail publishes an order's code and what it took off (`couponCode`, `couponDiscountCents`, in `docs/onboard-contract.json` since mail #221), and the order page and the account page's order list show them. A mail before that published neither, and published an order with a code and no plan discount with its original price equal to the price paid; for such a backend the shop page still keeps the code and the price before it in the tab's `sessionStorage` (`abnormal-coupon`, `src/storefront/lib/coupon.ts`) for each order it creates with a code, and the order page shows "Discount code WELCOME, −1.00 LDC" with the earlier price struck through from the difference. That storage is only the fallback for such an older backend: mail's own fields win whenever an order carries them, and the account page never reads it. In another browser an order of an older backend shows its price without the breakdown. The catalog's `coupons` flag decides whether the field is offered: mail always sends it, `false` hides the field without a request and `true` shows it; without the flag (an older mail) it is offered and disappears when the preview answers 404.

### Mailboxes for a team: plans sold per mailbox

mail sells a plan in one of two ways: fixed (a set number of mailboxes at one price) or per seat, where the buyer chooses how many mailboxes to pay for. Seat plans come under `seatProducts` in the catalog, apart from `products`, and the pages show them only when the key is there; a backend without them changes nothing.

- **Shop page**: a seat plan's card shows the price per mailbox, a quantity stepper within the plan's range and the total for either way of paying. The total is mail's: the page asks `POST /api/shop/quote` for the quantity on the card, one request per plan for every way of paying on offer (`src/storefront/lib/quote.ts`: a change of quantity waits 350 ms and cancels the request before it, answers are remembered, and a rate limit is waited out), and shows the quote's total, the price before the plan's discount and what each later period costs; it multiplies and rounds no money itself. While there is no quote (one on its way, the rate limit, a failed request, or a mail before the endpoint, which answers `404` and is then never asked again) the card shows the figure the page works out by mail's own rule (`seatOrderPrice` in `src/storefront/lib/catalog.ts`), marked as an estimate, as it did before quotes; mail prices the order at checkout either way and the order page shows what it charged. A quote mail refuses says why with a code: a total above what one order can charge closes that way of paying only, and a range that changed since the catalog was read moves the quantity into the new one. The range and the prices of one seat are read from the fields mail says them in outright (`minQuantity`, `maxQuantity`, `unitPriceCents`…), falling back to `seatMin`, `seatMax` and the plan's own price fields on a mail before them. Discount codes work as for fixed plans, previewed for the quantity on the card; the automatic quotes carry no code, since each quote with one is a guess against mail's limit on code guesses.
- **Pricing page**: the cards, the comparison table, the Markdown version and the structured data list seat plans with per-mailbox wording (`src/lib/pricing.ts`); a seat plan's offer is a unit price per mailbox with the range that can be bought.
- **Account page**: a seat subscription's group in "My mailboxes" shows seats used of total (`ShopSeats.tsx`). "Add seats" asks mail for the prorated price first and shows it before the confirm button; an LDC subscription then gets an order to pay on the order page, a card subscription is charged at once, and when the bank wants the buyer the seats rise only after Stripe confirms (the notice keeps the link to Stripe's invoice page and a refresh button). "Remove seats at renewal" takes the count and which mailboxes go; nothing changes before the renewal, and the removal can be cancelled until then.
- mail publishes an order that adds seats as a renewal order (kind `renewal`, one period) and gives the storefront no field to tell them apart, so the order page and the order list show it as a renewal order; the payment error on such an order says to add the seats again from the account, which is what mail asks for when the subscription was renewed after the order was priced.

The order quote and the four account routes (`account/seats/quote`, `add`, `remove`, `keep`) are proxied like the mailbox routes and are listed in `docs/onboard-contract.json` under `shop.quote.routes` and `shop.seats.routes` (contract version 3), with the fields of a seat plan, a quote and an account's seats; the contract tests check the Worker's route table and the parsers against them. A refusal about a quantity, a discount code, a plan or a buyer's domain carries a stable `code` and its text in both languages (`shop.refusalCodes`): the pages show the text of their own language and branch on the code. The contract, and every place mail's code differs from its own document, is under "Seat plans" in [docs/storefront-api.md](docs/storefront-api.md).

### Use my own domain

A buyer whose plan allows it (`customDomains` in the catalog) connects a domain they own from "My account", without an inquiry: `ShopDomains.tsx`, below "My mailboxes".

1. **Reserve**: enter a domain. mail refuses a name that is not a domain, a public suffix, the provider's own, or already in use; for the last it gives one sentence whoever has the name, and the page shows mail's sentence and adds nothing.
2. **Prove ownership**: the page shows the TXT record to publish, with copy buttons for its name, the part before the domain (which many DNS panels ask for) and its value, and until when the value works (7 days). "Verify" asks mail to look it up; a record that is not visible yet, or a rate limit, is shown as mail's reason or as a wait in minutes.
3. **Publish the mail records**: MX, SPF, DKIM, the DMARC suggestion and the optional client-discovery records, each with its purpose in plain words and its status in public DNS. The page checks again by itself, backing off (20 s, 30 s, 45 s, then every minute, six rounds), never while the tab is hidden, and then leaves a "Check again" button; DNS can take hours. Neither the site nor mail ever writes the buyer's DNS.
4. **Review and live**: a verified domain waits for the provider's approval unless the shop has switched that off. The page says so plainly and names no time, since mail defines none. Live, the domain is one more choice in the create-mailbox form of the orders whose plan allows own domains: mail lists it among the group's domains, and "My mailboxes" is read again when a domain goes live.

The panel is not rendered when the backend has no buyer domains (the list answers `404`) or the account has neither a plan that includes them nor a domain. The six routes (`account/domains`, `add`, `verify`, `check`, `refresh`, `remove`) are proxied with the account session cookie only, are never cached and never logged with a domain in them, and are listed in `docs/onboard-contract.json` under `shop.buyerDomains` (contract version 3) together with the statuses, phases, record statuses, types and purposes the client types against (`tests/storefront/domains.test.ts`). A refused verification says why with a code: an expired ownership value makes "Get a new value" the way on, and a domain that was verified meanwhile is read again. The contract, the mock's switches and the places mail's code differs from its document are under "Buyer domains" in [docs/storefront-api.md](docs/storefront-api.md).

### Code

```text
src/storefront/
  i18n.ts, lib/shop-copy.ts   Copy of the redeem page and guide, and of the shop pages (both languages)
  config.ts, site.ts          Support email, default domain, webmail address; site address and the same-origin API prefix
  metadata.ts                 <head> of the storefront pages, through pageMetadata in src/lib/metadata.ts
  components/                 Onboard (redeem page), Guide, Shop, ShopOrder, ShopRenew, ShopAccount and their parts; onboard/ holds the redeem form's state machine
  lib/                        API clients (api.ts, shop.ts; catalog.ts is the part without a session: catalog, address check, money), redeem code / username / password rules (onboard.ts),
                              the pricing page's server-side catalog (catalog-server.ts, catalog-live.ts), the carried address (address.ts), Markdown of the storefront pages (markdown.ts)
  mock/                       In-memory redeem and shop APIs for next dev
  worker/                     The Worker's /api proxy to mail (index.ts redeem, shop.ts shop, proxy.ts shared) and the old domain's redirects (legacy.ts)
src/app/(en)/{redeem,guide,shop}/, src/app/(zh)/zh/{redeem,guide,shop}/   The pages
src/app/api/{onboard,shop}/…/route.dev.ts   The mock API endpoints, which exist only under next dev
docs/storefront-api.md      API contract with mailhq; docs/onboard-contract.json is the same in data form, byte for byte the same as mail's copy
tests/storefront/           Vitest: validation rules, API clients, mock APIs, the Worker proxy, the form state machine and the contract
```

The storefront's breakpoints (`max-narrow:`, `max-tablet:`, `max-desk:`, `max-guide:`, `max-guide-lg:`) are in `src/styles/global.css` next to the site's own. The Stripe payment form follows the theme in effect through `<html data-theme>`.

### Backend API

The browser requests this site's own API, and `worker.ts` answers every `/api` request before OpenNext, calling mailhq internally through the `MAIL` Service Binding (`abnormalhq-mailhq`) by a path and method allowlist:

- `/api/onboard/cdk`, `username`, `redeem`: the three POST redeem endpoints.
- `/api/shop/catalog`, `orders`, `notify`, `account`, `account/mailboxes`: GET; `address` (the address check, see "Pricing and the address check"): POST, without cookies; `coupon` (the discount code preview, see "Discount codes"), `checkout`, `pay`, `pay/stripe`, `pay/usdt` (JSON, never a redirect; see "USDT payments" in [docs/storefront-api.md](docs/storefront-api.md)), `reconcile`, `renewal`, `renew` and the `account/*` endpoints (login, password, Google sign-in, mailbox management, seats, own domains): POST, except `account/domains` (the list): GET.
- `/api/status`: GET, the service status shown in the footer and the hero (state and 30-day availability, from mail's public status page; see "Service status" in [docs/storefront-api.md](docs/storefront-api.md)). Nothing of the browser's request is sent to mail for it, and the answer is cached for a minute.

The Worker keeps the browser's `Origin` and `CF-Connecting-IP` so mailhq can check the origin, rate-limit and verify Turnstile tokens; the redeem endpoints carry no cookies, and the shop endpoints forward only the `mailhq_shop` buyer cookie and the `mailhq_customer` account session (the `account/domains` routes the account session alone). Response headers are built by the Worker, API responses are never cached, and request bodies, passwords and redeem codes are never logged. `vars.MAIL_ORIGIN` in `wrangler.jsonc` (`https://console.abnormalhq.com`) is only the URL of internal requests, so mail's OpenNext recognises its own origin. The full contract is in [docs/storefront-api.md](docs/storefront-api.md).

On mail's side, `ONBOARD_ORIGIN` must list this site's origin, and the sales settings name the storefront address `https://abnormalhq.com` (mail then builds Chinese links under `/zh/`). The Credit application's home page is `https://abnormalhq.com/shop/`, its notification URL `https://abnormalhq.com/api/shop/notify` and its callback URI `https://abnormalhq.com/shop/orders/`.

### Development

`pnpm dev` mounts mock APIs under `/api/onboard/` and `/api/shop/` (`src/storefront/mock/`), with errors in the page language. `/api/status` answers a fixed summary (`src/app/api/status/route.dev.ts`). These redeem codes can be tried directly:

| Redeem code           | Situation                                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| `ABCD-EFGH-JKLM-NPQR` | Usable once, valid for 30 days                                                                            |
| `MULT-2345-6789-ABCD` | Usable three times, two domains to choose from, never expires                                             |
| `TEAM-TEAM-TEAM-TEAM` | Usable 1000 times (mail's cap), more than the 20 one request can activate                                 |
| `PART-PART-PART-PART` | Usable three times; the 2nd, 4th... of a batch fail with a simulated server error, to see partial success |
| `BARE-BARE-BARE-BARE` | Usable twice; `legacy.abnormalhq.com` simulates no support for the per-mailbox quota                      |
| `USED-USED-USED-USED` | Used up                                                                                                   |
| `EXPD-EXPD-EXPD-EXPD` | Expired                                                                                                   |
| `GONE-GONE-GONE-GONE` | Disabled                                                                                                  |

In the mock API `admin`, `support`, `postmaster`, `abuse`, `noreply`, `hello` and `kunish` are taken; a notification address ending in `@bounce.example` simulates a delivery failure. The demo plan at `/shop/` costs 7.50 LDC after a 25% discount, and paying only simulates success. The mock knows three discount codes: `WELCOME` (20% off everything), `LDC1` (1.00 LDC off, not for card orders) and `MONTHLY` (half off the monthly plan's first period); `MOCK_COUPONS=legacy pnpm dev` behaves like a backend with discount codes before mail #221 (no catalog flag, no several-plans preview, no code fields on orders) and `MOCK_COUPONS=off pnpm dev` like a backend without discount codes. The demo seat plan (3.33 LDC a mailbox at 10% off, or 1.99 USD by card, 2 to 50 mailboxes) gives a seat subscription as soon as it is "paid": adding seats to an LDC one creates an order to pay, to a card one it applies at once, except that adding exactly 7 answers "payment required" (the seats arrive on the second refresh) and adding exactly 9 a declined card; `MOCK_SEATS=off pnpm dev` behaves like a backend without seat plans, and `MOCK_QUOTE=off pnpm dev` like a backend before contract version 3 (no order quote, a seat plan with only `seatMin` and `seatMax`, refusals without a code), to see the pages fall back. The monthly demo plan allows one own domain and the seat plan two; what a demo domain does is decided by the start of its name (`pending-`, `expired-`, `busy-`, `slow-`, `review-`, `suspended-`, `conflict-`, `error-`, `grace-`, `taken…`; any other name verifies, gets its records in place after two checks and is approved two checks later; the table is in [docs/storefront-api.md](docs/storefront-api.md)), `MOCK_DOMAIN_APPROVAL=off` makes a verified domain live at once and `MOCK_DOMAINS=off` behaves like a backend without buyer domains. The demo plans can also be paid with USDT on TRON's Nile testnet (1.50, 0.80 and 0.60 a seat): the order page shows a fixed demo address, pay/usdt sees the transfer on its third check (every 5 seconds) and confirms it on the fourth, nothing is sent anywhere; `MOCK_USDT=off pnpm dev` behaves like a backend without USDT. Mock login sends no email: login and registration links are printed in the dev server terminal; after login "My mailboxes" works on the demo orders, in memory only.

To try the real API against a local mail: in mail set `ONBOARD_ORIGIN=http://localhost:8786` in `.dev.vars` and run `pnpm cf:preview --port 8788`; here run `cp .dev.vars.example .dev.vars` and `pnpm cf:preview`, then open `http://localhost:8786`. When mail is not running the API answers `503` with `kind: "unavailable"` and never falls back to production.

### Retiring onboard

`onboard.abnormalhq.com` (and `onboard.abnormal.bid`) are custom domains of this Worker (`routes` in `wrangler.jsonc`). `src/storefront/worker/legacy.ts` 301s every page there to the same page here (`/` → `/zh/redeem/`, `/en/shop/orders/?id=…` → `/shop/orders/?id=…` and so on, with the query string), and the API under `/api` keeps answering on that host, so Credit notifications and links in mail already sent keep working. Buyers' purchase and login sessions were host cookies of the old domain, so they sign in again once.

The order of the switch:

1. Deploy mail with `ONBOARD_ORIGIN` listing both `https://abnormalhq.com` and `https://onboard.abnormalhq.com` (mail's links for the old host keep the old layout).
2. Free the domains `onboard.abnormalhq.com` and `onboard.abnormal.bid` from the `abnormalhq-onboard` Worker: merge the onboard change that empties its `routes` (its deploy detaches them), or remove them in the Cloudflare dashboard. Then merge this change right away, so its deploy binds them here along with the new pages and API; the old domain is down only in between. If Workers Builds says a domain is still attached to the other Worker, detach it and retry the build.
3. On mailhq's sales page set the storefront address to `https://abnormalhq.com` and the redeem page to `https://abnormalhq.com/redeem/`; in the Credit application settings change the home page, notification URL and callback URI to the addresses above.
4. Point the `onboard.abnormal.bid` Redirect Rule at `https://abnormalhq.com` directly, delete the `abnormalhq-onboard` Worker and disconnect its Workers Builds, and archive the onboard repository.
5. Later, once nothing reaches the old host, remove `https://onboard.abnormalhq.com` from mail's `ONBOARD_ORIGIN` and from `redeem.storefrontOrigins` in both copies of `docs/onboard-contract.json`.

## Pricing and the address check

| Page                      | English                        | Chinese                           |
| ------------------------- | ------------------------------ | --------------------------------- |
| Plans and prices          | `/pricing/`                    | `/zh/pricing/`                    |
| The same on the home page | `/#pricing`                    | `/zh/#pricing`                    |
| A plan card's link        | `/shop/?plan=<product id>`     | `/zh/shop/?plan=<product id>`     |
| A checked address's link  | `/shop/?address=<name@domain>` | `/zh/shop/?address=<name@domain>` |

Prices are never written into the copy or the build: they come from the live catalog, `GET /api/shop/catalog`, the same answer the shop page reads. Where it is read depends on how the page is served:

- **The pricing page** is rendered on the Worker for every request (`export const dynamic = "force-dynamic"`, like the download page), and so is its Markdown version (`/md/pricing/`, `/md/zh/pricing/`). `src/storefront/lib/catalog-live.ts` asks mail directly through the `MAIL` Service Binding (under `pnpm dev`, the dev server's own mock API), and `catalog-server.ts` validates the answer with the browser client's parser and keeps it in the Worker's cache for 60 seconds per language, with a 3 second timeout. The HTML therefore carries the prices (for search engines, readers without JavaScript and agents), and the structured data can state them truthfully. A price change shows within a minute; an order is always priced by mail at checkout.
- **The home page** stays prerendered. Its "Plans and prices" section (`PricingSection`, section 03) and the hero's address check are client components that read the catalog in the browser, one request shared between them (`catalog-shared.ts`: a good answer is reused for 60 seconds, a failed one is forgotten, and a successful "Try again" in the pricing section brings the address check back too); a `<noscript>` link points at the pricing page.

Both render the same cards (`src/components/PlanCards.tsx`) from the same view of a plan (`src/lib/pricing.ts`), which the comparison table, the Markdown and the structured data also use, so the four cannot disagree: price with original price and discount, one-time or every N days, the card price where a plan can be bought by card, renewal price, mailboxes, storage per mailbox, domains and how long the redeem code is valid. Amounts are the backend's and are only formatted. With the shop closed (`available: false` or no plans) or the catalog unreadable, the pages say so and show no numbers; everything that does not depend on the catalog still renders. The comparison table appears with two or more plans; on a narrow screen it scrolls sideways inside its frame with the row labels pinned on the left. The pricing page ends with the help center's plans and billing articles (renewals, discount codes, team plans, deleting a mailbox), taken from the help content's `billing` topic.

"What every mailbox gets" (`Included`, copy under `pricing.included`) states the limits that hold on every plan and are mail's rules rather than the catalog's: storage as a quota of the mailbox's own, the username rules, the 7-day grace period and 30-day retention after a subscription ends, IMAP / SMTP / CalDAV / CardDAV, the apps, and webmail's attachment limit (10 files, 3 MB in all). They are written from mail's `subscription-rules.ts`, `docs/onboard-contract.json` and mail's `docs/managed-webmail.md`; `tests/pricing.test.ts` checks the numbers it can, and the copy must be updated when mail changes them. The daily sending limit is a per-server setting in mail and not public, so the site states none.

Structured data (`pricingStructuredData`): the page with a breadcrumb, plus a schema.org `Product` with an `Offer` for each plan that has a card price, in the shop's card currency. Plans sold only for LDC (Linux DO Credit) get none: LDC is not an ISO 4217 currency, and the offers are built from the very plans the page shows at that render.

**Check your address** (`src/components/AddressCheck.tsx`, in the hero and on the pricing page): a username, a domain from the catalog's plans, and whether the address is free. The username follows the redeem form's rules (`src/storefront/lib/onboard.ts`) and its debounce: validated as typed, asked of the server 500 ms after typing stops, an earlier request aborted by a newer one. The redeem page's own check (`/api/onboard/username`) requires a redeem code on purpose, so this one asks mail's `POST /api/shop/address`, which answers without one and is rate-limited instead (10 a minute and 100 a day per IP, 600 an hour per domain; see [docs/storefront-api.md](docs/storefront-api.md)). The check shows only when the catalog carries `addressCheck: true` (mail leaves it out while the check is switched off in its sales settings or nothing is on sale), and goes away if the endpoint answers 404. The Worker forwards no cookie to this route.

A free address leads to the shop with the address in the query string; a plan card leads there with its plan. The shop marks that plan, shows the address and keeps it in the tab's `sessionStorage` (`abnormal-address`, `src/storefront/lib/address.ts`), since paying leaves the site and comes back. After payment, "My mailboxes" opens its create form with the username and domain filled in (when the order offers that domain) and forgets the address once that mailbox exists; the redeem page starts its first row with the username only, the domain being the redeem code's to say, and forgets the address when a redemption creates exactly it. "Don't use this address" on the shop page forgets it and takes `?address=` out of the page's address, so a reload or the language toggle does not bring it back. The address is not reserved at any point, and is not sent to mail until one of those forms is submitted.

Under `pnpm dev` the mock answers the check (`admin`, `support`, `postmaster`, `abuse`, `noreply`, `hello` and `kunish` are taken); `MOCK_ADDRESS_CHECK=off pnpm dev` behaves like a backend with the check switched off.

## Help center

| Page       | English         | Chinese            |
| ---------- | --------------- | ------------------ |
| Index      | `/help/`        | `/zh/help/`        |
| An article | `/help/<slug>/` | `/zh/help/<slug>/` |

The articles are content, not UI copy, so they live apart from `src/i18n`: `src/content/help/en.ts` and `zh.ts`, typed by `HelpContent` in `types.ts`, where `helpSlugs` lists every article in the order the index, the sitemap and `llms.txt` use. An article has a topic, a title, a summary (the lead, the meta description and the index entry), search keywords and sections of paragraphs and lists, in the storefront copy's markup (`**bold**` and `[text](link)`, site links relative to the language root). To add one, add its slug to `helpSlugs` and write it in both files: the page (`src/app/(en)/help/[slug]/`, prerendered for exactly those slugs), its Markdown version, the sitemap, `llms.txt`, the language redirect and the `/en/` redirects all follow from the page list, which takes the slugs from there.

- **Where the facts come from**: this repository (storefront copy, `docs/storefront-api.md`, the privacy policy) and mail's `docs/` (client auto-configuration, WebMail security, import and export, rules, user settings, calendar, shop). "Buying mailboxes for a team" and "Using your own domain" are written from mail's `docs/shop.md` ("Seat-based plans", "Buyer-owned custom domains") and the code behind it: the 7-day grace and 30-day suspension of a lapsed plan, the 7-day life of an ownership value, removal only at renewal. They name no review time (mail defines none), no daily sending limit (a shop setting) and no DNS value (shown per domain on the account page), and say that plans offering either are only there when the shop sells them. The AI article repeats the privacy policy and nothing more. Values that differ per deployment, above all IMAP / SMTP / CalDAV / CardDAV host names and ports, are never written into an article: it says where the reader sees their own (after setup, under My mailboxes in My account, in webmail's Settings → Apps & sync). `tests/help.test.ts` refuses host names and mail ports in the articles, checks the numbers it can against `docs/onboard-contract.json`, and compares the two languages block by block (same sections, list lengths, link targets and procedures). When mail changes a limit an article names, change both languages.
- **Rendering**: `HelpArticle` → `DocArticle` (`src/components/`), the legal pages' layout: breadcrumb (the registry's `Breadcrumb`), title and lead, a table of contents beside the registry's `Prose`. Every article ends with "Not the article you were looking for?", linking back to the index and to the support address.
- **Search**: `HelpSearch` is a client component that narrows the prerendered list as you type (`src/lib/help-search.ts`: every word of the query must occur in an article's title, summary or keywords; full-width input is folded). No request, no index, no dependency; without JavaScript the page is the full list. It gets only the page language's entries through props. The query is kept in the address as `?q=` (replaced, not pushed), so coming back from an article finds the same list and a search can be shared as a link.
- **Related articles**: an article ends with up to three other articles of its topic, in the index's order (`HelpArticle`), before "Not the article you were looking for?".
- **Structured data**: every article has a "Home > Help center > article" breadcrumb. A section marked `howTo` in the content (a numbered procedure) is also described as a schema.org `HowTo` whose steps are exactly the list on the page. No help page claims to be an FAQ.
- **Links to it**: the header (where "Help" took the place of the home page's FAQ anchor, which the footer still has), the footer's Support column, the home page's FAQ section and the guide page.

## Security and privacy overview

`/security/` (Chinese `/zh/security/`, linked from the footer's Support column) says in one page what protects a mailbox, what is stored how, what is **not** offered, where data is processed and how to report a vulnerability. It is content like the help articles (`src/content/security/en.ts` and `zh.ts`, the same section-and-block shape, rendered by `SecurityOverview` through `DocArticle`), with a Markdown version, a sitemap and `llms.txt` entry, and a breadcrumb in its structured data.

The page may only state what a source backs up, and each sentence has one: the privacy policy (HTTPS everywhere, what is stored encrypted or hashed, session digests, payments, admin access and its logging, the providers and transfers abroad, never asking for passwords), and mail's `docs/`: `mail-transport-security.md` and `dane-dnssec.md` (MTA-STS in enforce mode, DANE TLSA with DNSSEC), `webmail-security.md` (two-step verification and app passwords, enforced by the mail server), `mail-safety.md` (message warnings), `antivirus.md` (the scanner and what webmail does with its verdict) and `webmail-user-settings.md` (the image proxy). It says plainly that there is no end-to-end and no zero-access encryption, makes no compliance or certification claim, names no server, port or key, and sends vulnerability reports to the support address, the only public contact (the link fills in the subject the paragraph asks for, "Security" or 安全). `tests/security-page.test.ts` holds it to that: the two languages block for block, the admin-access and transfer sentences against the policy's own wording, a list of words the page must not use, and the links. When a source changes, re-read the page against it in both languages and update `reviewed` (shown under the lead as "Last reviewed"). Two statements depend on how mail is deployed rather than on its code and should be confirmed with whoever runs it before each review: that the virus scanner is running in production (mail's `antivirus.md` describes the rollout), and that every mailbox domain publishes the MTA-STS policy.

## Claude connector page

`/claude/` (Chinese `/zh/claude/`, linked from the footer's Support column) is the public documentation of mail's MCP server as a Claude connector (`https://console.abnormalhq.com/api/mcp`, signed in to with OAuth 2.0): what it is, who can connect (an administrator of a workspace in the admin console; a shop buyer has no console account), how to connect in Claude and in Claude Code, what the consent page asks, the tools by resource with read and write, examples, how to disconnect and revoke, security and data, troubleshooting and support. It is the page the connector's directory listing points at, together with the privacy policy's section "Claude and other connected apps". It is content like the security overview (`src/content/claude/en.ts` and `zh.ts`, rendered by `ClaudeConnector` through `DocArticle`), with a Markdown version, a sitemap and `llms.txt` entry and a breadcrumb in its structured data. Its two commands are `code` blocks (`DocBlock`), shown with the download page's copy button and as fenced `sh` blocks in the Markdown; the connector URL and the commands are written once, in `src/content/claude/commands.ts`.

Every statement comes from mail: `docs/mcp.md` (tools generated from the API, reads `readOnlyHint`, every write `destructiveHint`, the shared rate limit), `docs/api.md` (scopes, operations, no message bodies except what follow-up tasks hold, message trace off for workspaces until a platform admin turns it on, failure handling) and the OAuth design (`packages/core/src/lib/api/oauth.ts`: one-hour access tokens, 30-day rotating refresh tokens, SHA-256 hashes, a grant ends with a password or email change and with the role or membership). `tests/claude-page.test.ts` compares the two languages block for block, checks the URL, the commands and those limits, and that the page and the policy point at each other. When mail changes the tools, the scopes, the consent page or the token rules, re-read the page and the policy section in both languages and update `reviewed`. The names of the console's "Connected apps" pages and of the connector in Claude's directory ("Abnormal Mail") follow the OAuth work in mail; check them once it ships.

## Developer documentation

The management API and MCP documentation is its own site, <https://developers.abnormalhq.com>, built in mail's repository (`apps/developers`, see its `docs/developers-site.md`) from the API's OpenAPI document, so there is no copy of it here. This site links to it from the footer's Product column (`linksFor(lang).developers`) and from `llms.txt`, and redirects its old addresses there permanently (`next.config.ts`): `/developers/`, `/zh/developers/`, their Markdown versions and `/developers/openapi.json`. `tests/developers-redirect.test.ts` holds those together.

## Working with the other sites

| Entry                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Address                                 | Repository                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------ |
| Buy a mailbox, redeem, my account, guide                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | this site (see "Storefront" above)      | this repository                            |
| Webmail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `https://webmail.abnormalhq.com/`       | [mail](https://github.com/abnormalhq/mail) |
| Service status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `https://console.abnormalhq.com/status` | mail                                       |
| The download page `/download/` (Chinese `/zh/download/`, linked from the "Product" column in the footer) offers the desktop client (`desktop/` in [mail](https://github.com/abnormalhq/mail)) as a macOS `.dmg` and Windows installers (one each for x64 and Arm), plus the Homebrew install command. The installers are uploaded by the mail repository's release flow to the public R2 bucket `downloads.abnormalhq.com`: `desktop/latest/` holds the latest version under fixed file names, and the download page links those addresses directly, so a new release needs no change to the site; `desktop/latest.json` lists the version number and SHA-256. The addresses are collected in `desktopDownloads` in `src/data/site.ts`. |

The download page also lists the current version (version number and release date) and past releases (each version's installers per platform, with sizes and SHA-256 checksums). The data comes from `desktop/releases.json` in the same bucket, regenerated by mail's release flow from each version's `desktop/<version>/latest.json`, sorted newest first, with `latest` naming the current version. The download page (`/download/`, `/zh/download/`) and its Markdown version (`/md/download/`, `/md/zh/download/`) are therefore not prerendered: they render on the Worker on every request and read this list (`src/lib/releases.ts`); the request is cached at the Cloudflare edge for 60 seconds, so after a new mail release the site needs no redeploy and shows it within about a minute. The pricing page is rendered per request for the same reason (see "Pricing and the address check"); all other pages are still prerendered at build time. When `releases.json` cannot be read, it falls back to `desktop/latest.json` and shows only the current version; the two are requested at the same time, so when neither can be read (3 second timeout) the page still returns after those 3 seconds, just without version information. The download buttons link to `desktop/latest/`, which is always the latest version. The three latest past releases are listed; the rest fold behind "Show N earlier versions" (a native `<details>`).

After the page loads, the browser works out the visitor's system (`detectDevice` in `src/lib/platform.ts`, from the user agent and, where available, its client hints) and `DownloadHint` badges the matching card "For this computer"; on a phone or tablet, including an iPad that reports a Mac, it shows a note above the cards pointing to webmail and the help center instead. The HTML itself is the same for every visitor and recommends nothing, so it hydrates without a mismatch and stays cacheable.

In the other direction: the "Website" link on the webmail sign-in page and the status page points back to `https://abnormalhq.com/`.

The right side of the header has "My account" (buyer sign-up, sign-in and mailbox management), "Log in" (webmail) and "Buy a mailbox". The home page strings the buyer journey together from top to bottom: hero (Buy a mailbox / Create an account, the address check when the backend offers it, with "Log in to manage mailboxes · Log in to webmail" below) → promo video (one per language, rendered from `video/`, see "Promo video" below) → 01 What's inside (nine webmail features in a hairline grid, folded on phones below 640px into a list of titles whose descriptions open on a tap, then where the mailbox can be used: webmail, the desktop app on the download page, and phones or any IMAP / SMTP app via the guide; copy under `features`, and its "Features" header link has `wide: "card"`, so the desktop bar shows it only from 1100px up, while "How it works" has `wide: "bar"` and shows from 1200px (`--breakpoint-bar`), where all six links fit the English bar; "Pricing" and "Help" are the header entries that are pages rather than sections of the home page (`path` instead of `anchor`); below 1024px (`--breakpoint-nav`) "My account" and "Log in" also leave the bar for the hero and footer, since the English header has no room for them there) → 02 Start here (four cards: Buy a mailbox, My account, Redeem, Webmail, plus links to the guide, status and support) → 03 Plans and prices (the plans on sale with live prices, then what every mailbox gets; see "Pricing and the address check") → 04 Email services (the personal mailbox goes straight to the shop, the domain and team cards to the pricing page, where the plans that include an own domain or are sold per mailbox are listed, and mailbox setup opens the inquiry dialog) → 05 How it works (Create an account → Choose a plan → Set up mailboxes under "My account" → Sign in and send, each step with a link; "Create an account" opens the account page's sign-up form directly with `?mode=register`) → 06 FAQ (with a link on to the help center) → closing panel (Buy a mailbox + ask for setup help).

## Components and styling

The site writes no CSS Modules; all styling is in `className`. The boundary between the two kinds of files:

- `src/components/ui/`, `src/styles/abnormal.css`, `src/styles/abnormal-fonts.css`, `src/lib/utils.ts`: copies installed from the registry, **do not edit directly**. To change them, change the [ui repository](https://github.com/abnormalhq/ui), publish, and reinstall, so all three sites stay consistent.
- `src/components/*.tsx`: the site's own page sections, which compose registry components and copy.
- `src/styles/global.css`: only the site's own breakpoints and global rules. Breakpoints are all in rem, because Tailwind can only sort breakpoints that share a unit.

The registry address is in `components.json`. To add or update a component:

```sh
pnpm dlx shadcn@latest add @abnormal/button --overwrite
```

## Entry points for agents

Follows the content-site checklist from [Is Your Site Agent-Ready](https://isitagentready.com/) (recheck with `POST https://isitagentready.com/api/scan`). The page list is in `src/lib/pages.ts`; everything below reads from it, so a new page is added in one place.

| Entry               | Address                                  | Implementation                                                                                                                                                                                                             |
| ------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crawl rules         | `/robots.txt`                            | `public/robots.txt`, with Content Signals and the sitemap                                                                                                                                                                  |
| Sitemap             | `/sitemap.xml`                           | `src/app/sitemap.ts`                                                                                                                                                                                                       |
| Index               | `/llms.txt`                              | `src/app/llms.txt/route.ts`, content generated by `src/lib/markdown.ts`                                                                                                                                                    |
| Full text           | `/llms-full.txt`                         | `src/app/llms-full.txt/route.ts`: every page's Markdown in one file, in llms.txt's order, each ending with its address; rendered per request, since it carries the pricing and download pages (`src/lib/page-markdown.ts`) |
| Markdown pages      | `/md/`, `/md/zh/privacy/`                | `src/app/md/[[...slug]]/route.ts`; the home page comes from the UI copy, help articles from `src/content/help/`, legal pages from the MDX body; the pricing and download pages have their own per-request routes           |
| Content negotiation | page address + `Accept: text/markdown`   | `worker.ts` decides by weight (`src/lib/negotiate.ts`) and forwards to the Markdown version above                                                                                                                          |
| Discovery headers   | the `Link` response header on every page | `headers()` in `next.config.ts`, which also emits `Vary: Accept`                                                                                                                                                           |
| IndexNow            | `/<key>.txt`                             | `src/lib/indexnow.ts` and `scripts/indexnow.ts`: after each production deploy `pnpm cf:deploy` submits every page, so Bing (and through it ChatGPT search and Copilot), Yandex, Naver and Seznam crawl them again          |

`Content-Signal` is currently `search=yes, ai-input=yes, ai-train=no`: search and AI answers may cite the site, model training is not authorized.

Content negotiation lives in `worker.ts`, which `pnpm dev` does not go through; to test it use `pnpm cf:preview`, or open the addresses under `/md/` directly.

This site implements no MCP, OAuth, API Catalog, Agent Skills or commerce protocol of its own; the MCP server and its OAuth sign-in belong to mail's admin console, documented for Claude at `/claude/` (see "Claude connector page"). The storefront's API is the browser's same-origin proxy to mail and is not a public API; the shop page's Markdown points agents at the public catalog endpoint `/api/shop/catalog` for plans and prices, and the pricing page's Markdown (`/md/pricing/`) lists them as text.

## Security headers

`worker.ts` adds the same headers to every response it gives (pages, the 404, Markdown, redirects and the storefront API), from `src/lib/security.ts`: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` with `Content-Security-Policy: frame-ancestors 'none'` (no page of the site is meant to be framed), and `Strict-Transport-Security: max-age=31536000`. The policy is `frame-ancestors` only: the pages embed Stripe and Turnstile and run the inline theme script, so a full Content-Security-Policy would have to list all of those first. HSTS leaves subdomains out, since webmail, the console and the download bucket are separate services. A header a response already carries is kept (the shop API's `Referrer-Policy: same-origin`); the storefront pages also narrow their referrer to `same-origin` with `<meta name="referrer">`. Files from the static asset service (fonts, `/_next/`, `public/`) do not pass through the Worker and carry none of these, and neither does `pnpm dev`; test with `pnpm cf:preview`.

## Search engines and social cards

| Item                         | Implementation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Title, description, hreflang | `pageMetadata` in `src/lib/metadata.ts`: canonical, Chinese and English `hreflang` pointing at each other (`x-default` points at English), `robots` allowing large image previews and full snippets                                                                                                                                                                                                                                                                                                                                        |
| Social cards                 | The same place emits Open Graph (with `og:site_name` and the other language's `og:locale:alternate`) and a `summary_large_image` Twitter card; images are in `public/og/`                                                                                                                                                                                                                                                                                                                                                                  |
| Structured data              | `src/lib/structured-data.ts`: every page has Organization (with `alternateName` and `sameAs` from `site` in `src/data/site.ts`, since "Abnormal" alone is also an unrelated email security company) and WebSite; the home page adds FAQPage (questions and answers from `faq.items`), legal pages add effective and revision dates and breadcrumbs, the pricing page a Product and Offer per plan with a card price, the download page the desktop app as a SoftwareApplication, the redeem and shop pages their numbered steps as a HowTo |
| Sitemap                      | `src/app/sitemap.ts`: legal pages' `lastmod` comes from `updated` in the frontmatter; update it when changing the terms                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Icons                        | `src/app/icon.svg`, `icon.png`, `favicon.ico` (16, 32 and 48 px, made from `icon.png`) for clients that ask for `/favicon.ico` only, and `apple-icon.png` (180×180) for the iOS home screen                                                                                                                                                                                                                                                                                                                                                |

The social images `public/og/zh.png` and `en.png` (1200×630) are generated by `scripts/og-images.ts`, with copy from the hero's `hero.eyebrow` and `hero.titleLines` and from `meta.socialDescription`; regenerate after changing those. This repository does not depend on Playwright; install it and Chromium globally first, then run the script with `NODE_PATH` pointing at the global directory:

```sh
npm install -g playwright && playwright install chromium
NODE_PATH="$(npm root -g)" node scripts/og-images.ts
```

The script needs network access to fetch Chinese glyphs from Google Fonts, and does not run at build time. The images' alt text is `meta.socialImageAlt` in the copy.

Search engines also need to be told the site exists. The sitemap is submitted once in [Google Search Console](https://search.google.com/search-console) (verify the domain through Cloudflare DNS) and [Bing Webmaster Tools](https://www.bing.com/webmasters) (which can import the Search Console property); Chinese readers search mostly on Baidu, which has its own [webmaster platform](https://ziyuan.baidu.com/). These are account settings, not code; IndexNow above only speeds up the engines that take it once the site is known to them.

The structured data only contains what is visible on the page; to add a question, write it into `faq.items` and FAQPage follows. Check with the [Rich Results Test](https://search.google.com/test/rich-results) or the [Schema Markup Validator](https://validator.schema.org/).

## Development

The development setup matches [mail](https://github.com/abnormalhq/mail) and [ui](https://github.com/abnormalhq/ui): Node.js 24 (see `.node-version`; `engines` in `package.json` states the minimum the toolchain actually needs, 22.22.1, and `tests/toolchain.test.ts` checks it is not below any direct dependency's requirement), pnpm 12 (version in `packageManager` in `package.json`), TypeScript, Prettier (print width 120), ESLint, husky + lint-staged + commitlint.

Type checking uses TypeScript 7's `tsc`. Dependencies follow [Microsoft's recommended dual-package aliasing](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6-0): `@typescript/native` points at TypeScript 7, and `typescript` points at the `@typescript/typescript6` compatibility package for the Next.js build and ESLint (typescript-eslint does not support TS 7 yet). Keep both aliases when upgrading dependencies, so all the repositories check the same registry components with the same compiler. `tsconfig.json` sets `useDefineForClassFields: true` explicitly: tsc and `node --test` already use define semantics for class fields with an ES2022 target, but Next.js's SWC only honors an explicit value and compiles with assignment semantics otherwise, so the build would differ from the tests.

```sh
pnpm install
pnpm dev
```

The dev server is at `http://localhost:4320`, and the local workerd preview at `http://localhost:8786`. Each repository uses different ports, so they can run at the same time:

| Repository | `next dev` | Local Worker preview                 |
| ---------- | ---------- | ------------------------------------ |
| abnormalhq | 4320       | 8786 (`pnpm cf:preview`)             |
| mail       | 3000       | 8788 (`pnpm cf:preview --port 8788`) |
| ui         | 4342       | 4341 (`pnpm serve`)                  |

```sh
pnpm check         # lint + typecheck + test
pnpm lint          # ESLint (eslint-config-next)
pnpm typecheck     # next typegen and TypeScript check
pnpm test          # node --test (tests/*.test.ts: inquiry logic, pricing, copy, metadata, legal documents, agent entry points, language, old-domain redirects, cache, security headers, theme), then vitest (tests/storefront/)
pnpm format:check  # format check
pnpm build         # next build
pnpm cf:preview    # OpenNext build, previewed in local workerd (port 8786)
pnpm cf:build      # full pre-release check: check, format:check, OpenNext build into .open-next/ and wrangler deploy --dry-run
pnpm cf:deploy     # deploy the existing .open-next/ output
```

`pnpm install` installs the git hooks through `prepare`: before a commit, lint-staged processes only staged files (code goes through `eslint --fix` and then `prettier --write`), and commitlint checks the commit message against Conventional Commits (the allowed types match mail). Dependabot checks for npm dependency and GitHub Actions updates every Monday.

## Project structure

```text
src/
  app/            Routes: (en)/ English pages (default language, at the root), (zh)/zh/ Chinese pages, each with its own root layout; global-not-found.tsx is the 404 shared by both languages
  components/     Page sections such as SiteLayout, header, Hero, Features, email service cards, process, FAQ and the inquiry dialog; ui/ holds components installed from the registry
  content/legal/  Privacy policy and terms of service written in MDX, one set each in zh/ and en/
  content/help/   Help center articles, one file per language (see "Help center")
  content/security/  The security and privacy overview, one file per language
  content/claude/  The Claude connector page, one file per language, and the connector URL and commands (commands.ts)
  storefront/     Shop, redeem page, buyer account and guide, and the Worker's API proxy to mail (see "Storefront")
  data/site.ts    Public contact details, buyer-journey addresses (linksFor), promo videos (promoVideos) and desktop client download addresses
  i18n/           Chinese and English copy (zh.ts, en.ts, types.ts) and language path helpers (paths.ts)
  lib/            pricing.ts what the pages, Markdown and structured data say about a plan; inquiry.ts pure functions for inquiry copy and contact details; metadata.ts page SEO and social cards; structured-data.ts structured data (JSON-LD); legal.ts frontmatter validation and table of contents for the legal documents; template.ts copy templates; time.ts media times for the video player; pages.ts page list; markdown.ts and negotiate.ts Markdown and content negotiation for agents; cache.ts browser cache headers; range.ts byte ranges for the promo videos; security.ts security headers of every Worker response
  scripts/        theme-init.js: the theme initialization script inlined into the head
  styles/         abnormal.css and abnormal-fonts.css come from the registry; global.css holds the site's own breakpoints and global rules
public/           Fonts, social images (og/), promo videos (video/) and other files served directly by the static asset service
scripts/          og-images.ts: generates the social images in public/og/
video/            Remotion project for the promo video, rendered into public/video/ (see "Promo video")
tests/            Regression tests for inquiry logic, copy structure, page metadata, legal documents, agent entry points, cache and security headers and theme behavior; tests/storefront/ holds the storefront's Vitest suite
open-next.config.ts  OpenNext configuration: prerendered output lives in read-only static assets
worker.ts            Worker entry: the storefront API, the old onboard domain's redirects, Markdown content negotiation, the language redirect, cache headers and security headers
wrangler.jsonc       Cloudflare Worker and static asset configuration
```

Layout, typography, states and responsive design all use Tailwind utilities. Only `Header`, `ThemePicker`, `InquiryDialog`, the footer year's `CurrentYear`, the video player, the home page's plans (`HomePricing`), the address check (`AddressCheck`), the download page's install commands with their copy button (`CommandLine`) and its "For this computer" badge and phone note (`DownloadHint`) and the table of contents that follows the section being read on the help, security and legal pages (`TocSpy`, marking its link `aria-current="location"`; `currentSection` in `src/lib/toc.ts`) are client components on the site's own pages; everything else is a server component, prerendered at build time (the pricing and download pages per request). Prerendered content does not change until the next deploy, so server components do not show the current time directly: the footer copyright year is first filled with the build-time year, and `CurrentYear` replaces it in the browser with the year of the visit. The Worker runtime cannot read project files with `fs`, so the legal documents are compiled from MDX into components at build time, and `theme-init.js` is bundled as a string by the `raw-loader` rule in `next.config.ts`. To open the inquiry dialog from anywhere on a page, use `InquiryButton` (`product` sets the preselected service).

## Visual design

The visuals are unified with [mailhq](https://github.com/abnormalhq/mail), using the abnormal brand (direction A): ink on warm gray paper, with the dark theme being the ink itself; the primary color is the ink, and highlight yellow is the only chromatic brand color. Body text is Inter, headings Bricolage Grotesque, code JetBrains Mono, laid over a Resend-style structure: 1px hairline dividers, unfilled panels, no shadows.

- Tokens (colors, radii, focus color) live in the registry's `@abnormal/theme`, installed into `src/styles/abnormal.css`; to change colors, change the ui repository. Tailwind utilities use the mapped names `text-foreground`, `text-muted-foreground`, `text-brand` and so on.
- The brand color is the ink and is used only on primary buttons: `#141412` with white text in light mode (18.4:1), `#f0f0ea` with ink text in dark mode (16.1:1). Check icons and link hovers use ink or gray.
- Highlight yellow `--highlight` (`#ffe14d`) is the only chromatic color and marks "current, selected, new, showcase": the brand mark, selected text, the step numbers in the activation process (a band of yellow as if drawn with a marker), the yellow card in the hero illustration, the icon tiles of the recommended entry and featured plan, and the inquiry dialog's title icon. Text on yellow is always ink; yellow text never appears on a light background.
- `--highlight-muted` (light `#fff4bf`, dark `#34311b`) is the soft pale yellow surface, reserved for selected or current rows and hint blocks; body text on it is 16.6:1 / 11.5:1, secondary text 6.1:1 / 5.3:1.
- `--signal` (ink in light mode, highlight yellow in dark mode) is for small indicators: the dot before eyebrow labels, the full stop at the end of headings, the period in the `abnormal.` wordmark, unread dots and the section numbers on legal pages. Yellow is too faint on a light background, so these small marks are ink in light mode.
- Radii are tightened to echo the square logo: badges 4px, buttons and controls 6px, small panels 8px, cards and dialogs 12px. Buttons scale to 0.98 when pressed; hover only changes the fill or outline, with no lift and no shadow.
- Controls follow mailhq: a translucent `control` fill and a thin `input` outline; the outline darkens on hover and focus, and keyboard focus is a 2px gray outline. Only floating layers (theme menu, inquiry dialog) use `--popover-bg` and the popover shadow.
- The brand mark is the same drawing as mailhq's BrandMark: a lowercase ink "a" on a highlight-yellow square, with an offset paper-white shadow and an arrow in the top right; its colors are fixed and do not follow the theme. `src/app/icon.svg` is the same drawing.
- The three variable fonts Inter (body), Bricolage Grotesque (headings) and JetBrains Mono (code) (Latin subsets, OFL) are self-hosted in `public/fonts/`, the same files as mailhq, and the page head preloads Inter and Bricolage Grotesque; Chinese glyphs fall back to system fonts such as PingFang and Microsoft YaHei, without contacting Google Fonts.

## Appearance themes

The navigation bar offers "System", "Light" and "Dark". A first visit defaults to following the system and updates when the system appearance changes; a manual choice is saved in the current browser's `localStorage` (`abnormal-theme`), and choosing System clears that preference. The choice syncs across tabs automatically, and switching still works temporarily when the browser blocks storage.

The theme initialization script runs synchronously in the page head and sets the actual theme early, so a refresh does not flash the wrong colors. Global colors are maintained in `src/styles/global.css`, one set of tokens each for light and dark, hung on `<html data-theme>`; when the script has not run, colors follow the system preference. `<meta name="theme-color">` switches with the effective theme (`#f7f7f4` / `#141412`).

## Configuring business details

Contact details are in `src/data/site.ts`; service and pricing copy is in `src/i18n/zh.ts` / `en.ts`:

- `site.contact.wechat`: the real WeChat ID.
- `site.contact.email`: the real inquiry email address; the email inquiry button fills in the selected service type, duration and needs.
- `site.contact.telegram`: a full `https://t.me/...` link. A valid Telegram link takes priority; when invalid, it falls back to email.
- `services.products` (one set in each copy): maintains the email service names, categories, descriptions, tags, `price` and `priceNote` in one place; `icon` picks the icon in the card's top-left corner (`mail`, `domain`, `team`, `setup`), and the card order can be changed freely. An empty `price` shows "On request"; a card with `href` set goes straight to that address (such as the shop), otherwise it opens the inquiry dialog.
- `linksFor` (site.ts) with `start.entries` and `process.steps` (copy): linked-site addresses, the home page entry cards and the activation process; the copy references addresses by `link` key.

These settings are published on the web pages, so never put keys, passwords or private information in them. Changes committed to `main` are rebuilt and deployed automatically.

When no contact details are configured, the page clearly says "Contact channels are coming soon". The inquiry dialog only composes and copies the request inside the browser; it sends no data, creates no orders and takes no payments. Specific plans, fees and service terms are confirmed in advance.

## Promo video

The video section under the hero (`src/components/PromoVideo.tsx`) shows a short promo film in the site's own player (`src/components/VideoPlayer.tsx`); it does not autoplay or interrupt visitors with sound, loads only metadata at first, and the poster image holds the layout. The player draws its controls in the site's style over a native `<video>`: a large play button over the poster (a replay button at the end), then a floating bar with play / pause, the time, a seek slider that also shows how much has buffered, mute with a volume slider (wide screens only; phones use their own buttons) and fullscreen (the whole player, or on iOS, which only lets `<video>` go fullscreen, the video's own). While the film plays the bar fades out once the pointer rests and comes back on any move, tap or focus. With focus in the player, Space / K play and pause, ← / → seek 5 seconds, M mutes and F toggles fullscreen; the sliders are `role="slider"` with arrow, Page Up / Down and Home / End keys, and their button names and the seek slider's spoken position (`seekTemplate`) are in the copy under `video`. The prerendered HTML is a plain `<video controls>`, so without JavaScript, or until the page hydrates, the browser's own player works; when the file cannot load, the player shows the `fallback` text over the poster. A "Download the video" link always sits below the video. Browsers load video in byte ranges, which the static asset service does not serve (it answers a `Range` request with the whole file, and playback then fails in Safari, and in Chrome once it resumes loading after the metadata), so `/video/*` is the one static path that runs through the Worker (`run_worker_first` in `wrangler.jsonc`), where `src/lib/range.ts` answers `206` with the requested bytes. There is one film per language, the text in the film is the page's language, and the title and description live under `video` in both copy files.

The video is generated by `video/` in this repository with [Remotion](https://www.remotion.dev/) (a framework for writing videos in React): six scenes (brand mark → hero headline → inbox illustration → the four activation steps → value strip → closing), 1920×1080, 30fps, about 35 seconds, drawn with the site's light-theme colors, radii and fonts (the files in `public/fonts/`, with Chinese glyphs from Google Fonts' Noto Sans SC, the same as the social images). The on-screen text is in `video/src/copy.ts` and consists of the hero, process and closing sentences of the site copy; when the site copy changes, change it too.

The background music is generated as well: `video/scripts/music.ts` writes a C major, 96 BPM loop with [Tone.js](https://tonejs.github.io/) (a pad of three detuned sawtooth voices, FM-synthesized electric piano chords, a bass with a filter envelope, an arpeggio through a ping-pong delay, a membrane-synth kick and noise-synthesized snare and hi-hat, entering in layers and resolving at the end), run through convolution reverb, compression and limiting, and rendered offline to `video/assets/music.wav` (not committed; `pnpm music` regenerates it in about 25 seconds). Tone.js is a browser library, so the script provides a Web Audio implementation with node-web-audio-api and fills in the globals it needs; the noise sources use a seeded random generator, so every run gives the same result. Remotion mixes it in with `<Audio>`; the finished film is about -17 LUFS. No third-party audio material is involved, so there are no copyright questions.

`video/` is a separate pnpm project (with its own lockfile) that is not part of the site's install: Remotion brings browser and encoder binaries that neither the site's CI nor the Cloudflare build needs, and the root `tsconfig.json` and ESLint do not include it either; Prettier formats it as usual.

```sh
cd video
pnpm install
pnpm studio      # preview and debug in the browser, http://localhost:3000
pnpm music       # synthesize the background music into assets/music.wav (studio and render run it first automatically)
pnpm render      # render the MP4 (with music) and the poster for both languages into ../public/video/
pnpm typecheck
```

The rendered `public/video/abnormal-{en,zh}.mp4` and the `.jpg` of the same name (the poster, frame 220) are committed and deployed with the site, served from the same origin by the static asset service, so there are no cross-origin or CORS issues; each film is about 1–2 MB. The addresses and upload dates are in `promoVideos` in `src/data/site.ts`: update `uploadDate` after re-rendering; when a language's `src` is left empty, that page does not show the section, and neither the `/md/` Markdown version nor the structured data mentions it. `tests/video.test.ts` requires the poster and date to be set along with the address, and the files for site paths to exist in `public/`; it also checks that the player never autoplays, loads only metadata and keeps native controls before hydration. Once configured, the home page's structured data gains a schema.org `VideoObject` (name and description from the copy, poster and date from the configuration), and `/md/` gains a heading with the video link.

When the machine has no Chrome, Remotion downloads a Chrome Headless Shell of its own; to use an installed browser, set `REMOTION_BROWSER_EXECUTABLE=/path/to/chromium`.

## Screenshots

Under the promo video, the "Take a look" section (`src/components/Screens.tsx`) shows WebMail as it really looks: the inbox with a message open across the full width, then the week view of the calendar beside the inbox on a phone, at the same height. Each picture is in the page's language, has a caption and a text alternative (`screens` in both copy files), and the section ends by saying the mail and events in them are samples. The pictures are plain `<img>` with `srcset` (the Worker has no image service for `next/image`), lazy-loaded, with `width` and `height` holding their place.

The files are `public/screens/{lang}-{inbox,calendar,phone}-{width}.webp`, each at its viewport width and twice that (1440 and 2880 for the two desktop pictures, 390 and 780 for the phone), listed once in `src/lib/screens.ts`. `tests/screens.test.ts` requires every file the page uses to exist with the width and aspect ratio its name and the layout say, and no other file to be in the folder.

They are taken from the real WebMail by `scripts/screenshots.mjs`, which drives the [mail](https://github.com/abnormalhq/mail) repository's browser-test stack (its WebMail under `next dev` against a stand-in mail server; mail's `docs/development.md`, "Browser tests"): it fills the test mailbox with the sample mail, labels and events written in the script for each language, takes the inbox at 1440×900 and the calendar at the same size at twice the density, the phone at 390×844 at three times, and writes the WebP files. The stack's test domain is shown as `abnormalhq.com`. Retake them when WebMail's look changes:

```sh
# in a checkout of mail, with Postgres up
pnpm --filter @mailhq/webmail-e2e e2e:serve
# then in this repository
MAIL_DIR=../mail node scripts/screenshots.mjs
```

Playwright comes from that checkout and sharp from `next`, so this repository depends on neither; `E2E_CHROMIUM` names another Chromium.

## Interactive demo

Under the screenshots, the "Try it yourself" section (`src/components/Demo.tsx`) holds a small WebMail that runs in the visitor's browser (`src/components/WebmailDemo.tsx`, a client component): folders (Inbox, Starred, Sent, Calendar), the inbox's categories with their unread counts, labels, search over sender, subject and body, opening a message (which marks it read), starring, "Mark as unread", replying and composing, and the week's calendar, where choosing an event shows its details. On a phone the folders become a row of tabs and an open message takes the list's place, with a back button.

Its content is sample mail, labels and events written in both copy files under `demo` (sender addresses on `.example` domains). The demo's state lives in the component only: nothing is stored, nothing is requested, and "Send" files the message under Sent with a notice that it was not sent; the section ends by saying so. `tests/demo.test.ts` requires the two languages' samples to behave the same (the same mail unread, starred, filed and labelled, the same events at the same times), every label a mail names to exist, events to fit the calendar's 08:00 to 21:00, and the component to make no request and use no browser storage. The demo receives only its own copy through props, like the other client components.

## Privacy policy and terms of service

`privacy.mdx` and `terms.mdx` under `src/content/legal/zh/` and `src/content/legal/en/` are compiled at build time by [`@next/mdx`](https://nextjs.org/docs/app/guides/mdx) and rendered through `src/components/LegalDocument.tsx`, published at `/privacy/` and `/terms/` (Chinese `/zh/privacy/`, `/zh/terms/`), linked from the footer and the inquiry dialog. The body is written in MDX (`{`, `}` and `<` in plain text are treated as syntax and must be written as `\{`, `\}`, `\<`); every second-level heading is numbered automatically and collected into a table of contents. The "Contact us" section is generated by the component from `site.contact`, so the body need not repeat the contact details.

Frontmatter fields: `title`, `description` (the page meta description), `eyebrow` (the English label at the top of the page), `summary` (the lead at the top of the page), `effective` and `updated` (`YYYY-MM-DD`; update `updated` after changing the body), `highlights` (the "At a glance" list at the top of the page). The page first validates the frontmatter with `parseLegalFrontmatter` from `src/lib/legal.ts`: a missing field, a date that is not a real `YYYY-MM-DD`, or an empty `highlights` fails the build outright and names the file and field. The table of contents takes every second-level heading in the document; do not write a first-level heading in the body (the page top is already the h1).

`tests/legal.test.ts` compiles the four documents with the same plugins as `next.config.ts` (listed in `src/content/legal/mdx.ts`) and requires the Chinese and English versions of the same page to match in the number of second-level headings, `effective` and `updated`, the number of `highlights` and the `eyebrow`; changing only one language makes the test complain.

The two texts cover the website (including the shop, the redeem page and the buyer account), and webmail and the status page (mail). The parts that correspond to system behavior (subscription periods counted from successful payment, the 7-day grace period and 30-day retention period after expiry, the purchase session cookie, 15-minute sign-in links, where data flows for AI features) are written from the mail repository's `src/lib/shop/` and the storefront copy (`src/storefront/`), and the section on connected apps (the Claude connector) from mail's `docs/mcp.md`, `docs/api.md` and `packages/core/src/lib/api/oauth.ts`, like the Claude connector page; update them when that logic changes.

The following are business conventions rather than system behavior, and should be checked against reality before operating for real: the order record retention period (12 months), refund rules (full refund for unused redeem codes, in principle no refund once activated, discretionary refund within 48 hours of a subscription charge), response and acceptance deadlines, the circumstances in which administrators access mailboxes, governing law and jurisdiction, and whether the name of the operating entity needs to be added.

## Deployment

The site is deployed through OpenNext as a Cloudflare Worker (`wrangler.jsonc`, Worker name `abnormalhq`, entry `worker.ts`, which wraps the generated `.open-next/worker.js`). All pages are prerendered, with the prerendered output in read-only static assets (`open-next.config.ts`), so no R2 or queue is needed; static files such as fonts are served directly by the static asset service. Production releases come from [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) watching the `main` branch directly: every push is checked, built and deployed automatically; if any step fails nothing is deployed and the last successful version stays live.

`.github/workflows/ci.yml` only runs the same checks and build on PRs and pushes to `main`; it does not release and needs no Cloudflare credentials. As in mail, Actions are pinned to major version tags only (such as `actions/checkout@v7`), and major upgrades arrive as Dependabot PRs.

### One-time Cloudflare setup

This is already configured; follow it when it needs to be rebuilt. In Workers & Pages, connect the GitHub repository `abnormalhq/abnormalhq`:

- Worker name: `abnormalhq` (must match `wrangler.jsonc`)
- Production branch: `main`, root directory: `/`
- Build command: `pnpm install --frozen-lockfile && pnpm cf:build`
- Deploy command: `pnpm cf:deploy` (deploys, then submits every page to IndexNow; see "Entry points for agents". A refused submission is reported in the log and never fails the deploy)
- Build variables:

  | Variable                  | Value     | Purpose                                                                         |
  | ------------------------- | --------- | ------------------------------------------------------------------------------- |
  | `PNPM_VERSION`            | `12.16.1` | Matches `packageManager` in `package.json`                                      |
  | `SKIP_DEPENDENCY_INSTALL` | `1`       | Skips the default install in favor of the frozen-lockfile install command above |
  | `NEXT_TELEMETRY_DISABLED` | `1`       | Disables Next.js build telemetry                                                |

The Node.js version is set by `.node-version`.

### Domains

The web domains are listed in `routes` in `wrangler.jsonc` and created by the deploy; the redirect rules and DNS placeholders for the old domains are not managed by wrangler and are maintained in Cloudflare. Deploys do not use `--strict`.

- `abnormalhq.com`: custom domain of the Worker `abnormalhq`, backed in DNS by a Cloudflare-managed `AAAA 100::` record. Before rebinding, make sure the hostname has no other A, AAAA or CNAME records.
- `www.abnormalhq.com`: custom domain of the same Worker, with its DNS record likewise created by the deploy. Inside the Worker, the `redirects` in `next.config.ts` 301 it to `https://abnormalhq.com`, keeping path and query string; the static asset service responds before the Worker, so fonts and files under `/_next/` do not redirect on this host. `wrangler dev` rewrites Host to the first route, so locally the redirect can only be tested with `--local-upstream www.abnormalhq.com`.
- `abnormal.bid`: the old address; the domain is still held. It also stays in `routes`, so its DNS record is not deleted; the zone's Redirect Rule (`http_request_dynamic_redirect` phase) 301s it to `https://abnormalhq.com` before the Worker, keeping path and query string. Do not remove it from `routes`: the deploy would delete its DNS record, and negative caching would make it unresolvable for about 30 minutes afterwards.
- `www.abnormal.bid`: the same Redirect Rule to `https://abnormalhq.com`; DNS has only a proxied `AAAA 100::` placeholder record.
- The MX and TXT records on the `abnormal.bid` apex belong to the mail service (`@abnormal.bid` mailboxes); do not touch them when changing DNS.

GitHub Pages is no longer used: the deploy workflow has been removed and production is served by the Worker above. GitHub does not allow disabling Pages for this repository (the API returns 422). The repository is now called `abnormalhq/abnormalhq`, which does not match `<organization>.github.io`, so it is a project site: `abnormal-bid.github.io` returns 404, and `abnormalhq.github.io/abnormalhq/` still 301s to `abnormal.bid`, which the Redirect Rule above then sends to the new address. Do not clear the custom domain in the Pages settings, or that address would serve the old site from the last deploy directly.

### Deploying from a local machine

Run `pnpm exec wrangler login` first, then:

```sh
pnpm cf:build
pnpm cf:deploy
```

## Other

- Uses native `<dialog>` and `<details>`, with keyboard operation, Esc to close, focus restoration and the reduced motion preference.
- Contains no analytics scripts or customer data storage; the only cookie is `abnormal_lang`, written when the language is switched by hand (see "Chinese and English") and described in the privacy policy. An address picked in the address check stays in the tab's `sessionStorage` until the mailbox is created or the tab closes, which the privacy policy describes too. So does the discount code of an order placed with one (with the price before it, for the order page of a backend that does not publish the code with the order), until the tab closes. "Use my own domain" stores nothing in the browser; what mail keeps about a buyer's domain (the name with the account, the ownership record, its state, the activity log entries) is in the privacy policy under "Your own domain", and both languages of that text should be read by whoever is responsible for the policy before the feature is switched on in production.
- Fonts are self-hosted with the site; no third-party font service is requested.
- The mailbox interface and address card in the hero are a conceptual illustration of the service, not an actual mail client interface.
