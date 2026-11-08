# Abnormal · Email service

[Live site](https://abnormalhq.com/)

The bilingual (Chinese and English) marketing site for the Abnormal email service, built with Next.js (App Router), Tailwind CSS 4 and TypeScript, with UI components from [Abnormal's shadcn registry](https://github.com/abnormalhq/ui). The site is the landing page for all of Abnormal: it introduces the email service and sends visitors on to the sites for buying, redeeming and activating, webmail, guides and service status; domain mailboxes, team mailboxes and setup help are still handled through the inquiry dialog. Pages are prerendered at build time and run on a Cloudflare Worker through [@opennextjs/cloudflare](https://opennext.js.org/cloudflare); the navigation menu, theme toggle and inquiry dialog are React client components. Cloudflare Workers Builds watches `main` and deploys automatically; GitHub Actions only runs checks.

## Chinese and English

English is the default language, at the root (`/`, `/privacy/`, `/terms/`); Chinese is under `/zh/` (`/zh/`, `/zh/privacy/`, `/zh/terms/`). This is implemented by the two route groups `(en)` and `(zh)` under `src/app`, each with its own root layout. The default language and the language order are written once, in `defaultLang` and `langs` in `src/i18n/paths.ts`; paths, `hreflang`, the sitemap, `llms.txt` and the structured data all read them from there. The language toggle in the header (`langToggle`, labelled "EN" or the single Chinese character for Chinese) switches to the same page in the other language; every page emits `hreflang` links pointing at each other, with `x-default` pointing at the English version.

The addresses are only each language's canonical address; which language a visitor lands in is decided by their preference (`src/lib/lang.ts`, run in `worker.ts` before OpenNext, for whole-page GET / HEAD page requests only). Clicking the language toggle in the header adds `?lang=zh`; the Worker stores that choice in the cookie `abnormal_lang` (one year, `Domain=abnormalhq.com`, shared by the website, onboard and webmail, the same name as mail's `LOCALE_COOKIE`) and redirects to the address without the parameter. With the cookie set, an address whose language differs from the cookie is 302-redirected to the same page in the other language, so a shared link always opens in the reader's own language. Without a cookie, only the unprefixed English addresses follow `Accept-Language`; a prefixed address such as `/zh/` is the link author's explicit choice and is left alone. Requests without `Accept-Language` (crawlers) are never redirected, so both sets of addresses that `hreflang` points at stay crawlable. Redirect responses carry `Cache-Control: private, no-store` and enter no cache; requests that ask for Markdown (agents) are not redirected by language.

English used to live under `/en/`: `/en/`, `/en/privacy/`, `/en/terms/` and the matching `/md/en/...` are 301-redirected by `redirects()` in `next.config.ts` to the new addresses at the root, so old external links and search results keep working.

- All UI copy is in `src/i18n/zh.ts` and `src/i18n/en.ts`; both implement `Copy` from `src/i18n/types.ts`, so a missing field fails `pnpm typecheck`. `tests/i18n.test.ts` also checks item by item that the two copies have the same structure (including the fields of every list item, optional fields included) and requires the language-independent values `link`, `icon`, `anchor`, `featured`, `primary` and `path` to be identical on both sides. Server components call `useCopy(lang)` for the current language's copy, linked-site addresses and language-prefixed site paths.
- Chinese headings end with a full-width full stop and English ones with a half-width one, taken from `t.dot`; headings that wrap only at some widths separate their two lines with `t.space` (a space in English).
- Decorative English labels (each section's `eyebrow`, the inquiry dialog's `kicker`, the footer's `tagline`, the legal page table of contents' `tocKicker`) are also in the copy: both languages write them in English and components render them with `lang="en"` so screen readers read them as English; the tests check that they contain no Chinese and that every `Eyebrow` on the page carries `lang="en"`.
- Sentences with a link or variable in the middle are written as templates, such as `inquiry.legal`'s "Requests and services are covered by the {terms} and {privacy}.", filled with links by `fillTemplate` in `src/lib/template.ts`; the spaces around the links are written in each language's copy, and components add none. Template fields are typed in `Copy` as `Template<"terms" | "privacy">`, so a component passing too few, too many or misspelled names fails `pnpm typecheck`; `tests/i18n.test.ts` then checks that each language's template uses exactly those names and that there are no unregistered templates. The inquiry dialog renders only in the browser, so prerendering cannot catch a typo here; these two checks have to.
- Linked-site addresses are generated by `linksFor(lang)`: onboard's English pages are under `/en/`, while webmail and the status page follow the browser language and share one address for both languages.
- Client components (`Header`, `ThemePicker`, `InquiryDialog`, `CurrentYear`) do not import the copy module; `SiteLayout` passes each the copy it uses through props, so the browser bundle does not carry the full copy of both languages. The path helpers live in `src/i18n/paths.ts` for the same reason. The inquiry text and email subject are generated per language by `src/lib/inquiry.ts`.
- Legal pages: Chinese in `src/content/legal/zh/privacy.mdx` and `terms.mdx`, English in `src/content/legal/en/privacy.mdx` and `terms.mdx`. The English version opens by noting that it is a translation and the Chinese version governs; when changing the terms, change both and update `updated`.

## Working with the other sites

The site itself takes no payments and activates no mailboxes; the actual work happens on the sites below. Their addresses are generated in one place by `linksFor(lang)` in `src/data/site.ts` (onboard's English pages are under `/en/`), and the header, hero, "Start here" entry cards, service cards, activation process, closing panel and footer all read them from there, so a domain change touches one place.

| Entry                                                                  | Address                                        | Repository                                       |
| ---------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------ |
| Buy a mailbox                                                          | `https://onboard.abnormalhq.com/shop/`         | [onboard](https://github.com/abnormalhq/onboard) |
| Redeem and activate                                                    | `https://onboard.abnormalhq.com/`              | onboard                                          |
| My account (sign-up, sign-in, mailbox management, orders and renewals) | `https://onboard.abnormalhq.com/shop/account/` | onboard                                          |
| Guide                                                                  | `https://onboard.abnormalhq.com/guide/`        | onboard                                          |
| Webmail                                                                | `https://webmail.abnormalhq.com/`              | [mail](https://github.com/abnormalhq/mail)       |
| Service status                                                         | `https://console.abnormalhq.com/status`        | mail                                             |

The download page `/download/` (Chinese `/zh/download/`, linked from the "Product" column in the footer) offers the desktop client (`desktop/` in [mail](https://github.com/abnormalhq/mail)) as a macOS `.dmg` and Windows installers (one each for x64 and Arm), plus the Homebrew install command. The installers are uploaded by the mail repository's release flow to the public R2 bucket `downloads.abnormalhq.com`: `desktop/latest/` holds the latest version under fixed file names, and the download page links those addresses directly, so a new release needs no change to the site; `desktop/latest.json` lists the version number and SHA-256. The addresses are collected in `desktopDownloads` in `src/data/site.ts`.

The download page also lists the current version (version number and release date) and past releases (each version's installers per platform, with sizes and SHA-256 checksums). The data comes from `desktop/releases.json` in the same bucket, regenerated by mail's release flow from each version's `desktop/<version>/latest.json`, sorted newest first, with `latest` naming the current version. The download page (`/download/`, `/zh/download/`) and its Markdown version (`/md/download/`, `/md/zh/download/`) are therefore not prerendered: they render on the Worker on every request and read this list (`src/lib/releases.ts`); the request is cached at the Cloudflare edge for 60 seconds, so after a new mail release the site needs no redeploy and shows it within about a minute. All other pages are still prerendered at build time. When `releases.json` cannot be read, it falls back to `desktop/latest.json` and shows only the current version; when neither can be read (3 second timeout) the page still returns, just without version information. The download buttons link to `desktop/latest/`, which is always the latest version.

In the other direction: the "Website" link in onboard's header and footer, and the "Website" link on the webmail sign-in page and the status page, all point back to `https://abnormalhq.com/`.

The right side of the header has "My account" (buyer sign-up, sign-in and mailbox management), "Log in" (webmail) and "Buy a mailbox". The home page strings the buyer journey together from top to bottom: hero (Buy a mailbox / Create an account, with "Log in to manage mailboxes · Log in to webmail" below) → promo video (one per language, rendered from `video/`, see "Promo video" below) → 01 Start here (four cards: Buy a mailbox, My account, Redeem, Webmail, plus links to the guide, status and support) → 02 Email services (the personal mailbox goes straight to the shop, the other three are inquiries) → 03 How it works (Create an account → Choose a plan → Set up mailboxes under "My account" → Sign in and send, each step with a link; "Create an account" opens the account page's sign-up form directly with `?mode=register`) → 04 FAQ → closing panel (Buy a mailbox + talk to us about custom needs).

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

| Entry               | Address                                  | Implementation                                                                                         |
| ------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Crawl rules         | `/robots.txt`                            | `public/robots.txt`, with Content Signals and the sitemap                                              |
| Sitemap             | `/sitemap.xml`                           | `src/app/sitemap.ts`                                                                                   |
| Index               | `/llms.txt`                              | `src/app/llms.txt/route.ts`, content generated by `src/lib/markdown.ts`                                |
| Markdown pages      | `/md/`, `/md/zh/privacy/`                | `src/app/md/[[...slug]]/route.ts`; the home page comes from the UI copy, legal pages from the MDX body |
| Content negotiation | page address + `Accept: text/markdown`   | `worker.ts` decides by weight (`src/lib/negotiate.ts`) and forwards to the Markdown version above      |
| Discovery headers   | the `Link` response header on every page | `headers()` in `next.config.ts`, which also emits `Vary: Accept`                                       |

`Content-Signal` is currently `search=yes, ai-input=yes, ai-train=no`: search and AI answers may cite the site, model training is not authorized.

Content negotiation lives in `worker.ts`, which `pnpm dev` does not go through; to test it use `pnpm cf:preview`, or open the addresses under `/md/` directly.

MCP, OAuth, API Catalog, Agent Skills and commerce protocols are not implemented: the site has no API and takes no payments, so those checks do not apply to it. The purchase flow is in onboard.

## Search engines and social cards

| Item                         | Implementation                                                                                                                                                                                           |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Title, description, hreflang | `pageMetadata` in `src/lib/metadata.ts`: canonical, Chinese and English `hreflang` pointing at each other (`x-default` points at English), `robots` allowing large image previews and full snippets      |
| Social cards                 | The same place emits Open Graph (with `og:site_name` and the other language's `og:locale:alternate`) and a `summary_large_image` Twitter card; images are in `public/og/`                                |
| Structured data              | `src/lib/structured-data.ts`: every page has Organization and WebSite; the home page adds FAQPage (questions and answers from `faq.items`), legal pages add effective and revision dates and breadcrumbs |
| Sitemap                      | `src/app/sitemap.ts`: legal pages' `lastmod` comes from `updated` in the frontmatter; update it when changing the terms                                                                                  |
| Icons                        | `src/app/icon.svg`, `icon.png`, and `apple-icon.png` (180×180) for the iOS home screen                                                                                                                   |

The social images `public/og/zh.png` and `en.png` (1200×630) are generated by `scripts/og-images.ts`, with copy from the hero's `hero.eyebrow` and `hero.titleLines` and from `meta.socialDescription`; regenerate after changing those. This repository does not depend on Playwright; install it and Chromium globally first, then run the script with `NODE_PATH` pointing at the global directory:

```sh
npm install -g playwright && playwright install chromium
NODE_PATH="$(npm root -g)" node scripts/og-images.ts
```

The script needs network access to fetch Chinese glyphs from Google Fonts, and does not run at build time. The images' alt text is `meta.socialImageAlt` in the copy.

The structured data only contains what is visible on the page; to add a question, write it into `faq.items` and FAQPage follows. Check with the [Rich Results Test](https://search.google.com/test/rich-results) or the [Schema Markup Validator](https://validator.schema.org/).

## Development

The development setup matches [mail](https://github.com/abnormalhq/mail), [onboard](https://github.com/abnormalhq/onboard) and [ui](https://github.com/abnormalhq/ui): Node.js 24 (see `.node-version`; `engines` in `package.json` states the minimum the toolchain actually needs, 22.22.1, and `tests/toolchain.test.ts` checks it is not below any direct dependency's requirement), pnpm 12 (version in `packageManager` in `package.json`), TypeScript, Prettier (print width 120), ESLint, husky + lint-staged + commitlint.

Type checking uses TypeScript 7's `tsc`. Dependencies follow [Microsoft's recommended dual-package aliasing](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6-0): `@typescript/native` points at TypeScript 7, and `typescript` points at the `@typescript/typescript6` compatibility package for the Next.js build and ESLint (typescript-eslint does not support TS 7 yet). Keep both aliases when upgrading dependencies, so all four repositories check the same registry components with the same compiler. `tsconfig.json` sets `useDefineForClassFields: true` explicitly: tsc and `node --test` already use define semantics for class fields with an ES2022 target, but Next.js's SWC only honors an explicit value and compiles with assignment semantics otherwise, so the build would differ from the tests.

```sh
pnpm install
pnpm dev
```

The dev server is at `http://localhost:4320`, and the local workerd preview at `http://localhost:8786`. Each repository uses different ports, so they can run at the same time:

| Repository | `next dev` | Local Worker preview                 |
| ---------- | ---------- | ------------------------------------ |
| abnormalhq | 4320       | 8786 (`pnpm cf:preview`)             |
| onboard    | 4321       | 8787 (`pnpm preview`)                |
| mail       | 3000       | 8788 (`pnpm cf:preview --port 8788`) |
| ui         | 4342       | 4341 (`pnpm serve`)                  |

```sh
pnpm check         # lint + typecheck + test
pnpm lint          # ESLint (eslint-config-next)
pnpm typecheck     # next typegen and TypeScript check
pnpm test          # inquiry logic, copy structure, page metadata, legal documents, agent entry points, cache headers and theme preference tests
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
  components/     Page sections such as SiteLayout, header, Hero, email service cards, process, FAQ and the inquiry dialog; ui/ holds components installed from the registry
  content/legal/  Privacy policy and terms of service written in MDX, one set each in zh/ and en/
  data/site.ts    Public contact details, linked-site addresses (linksFor), promo videos (promoVideos) and desktop client download addresses
  i18n/           Chinese and English copy (zh.ts, en.ts, types.ts) and language path helpers (paths.ts)
  lib/            inquiry.ts pure functions for inquiry copy and contact details; metadata.ts page SEO and social cards; structured-data.ts structured data (JSON-LD); legal.ts frontmatter validation and table of contents for the legal documents; template.ts copy templates; pages.ts page list; markdown.ts and negotiate.ts Markdown and content negotiation for agents; cache.ts browser cache headers
  scripts/        theme-init.js: the theme initialization script inlined into the head
  styles/         abnormal.css and abnormal-fonts.css come from the registry; global.css holds the site's own breakpoints and global rules
public/           Fonts, social images (og/), promo videos (video/) and other files served directly by the static asset service
scripts/          og-images.ts: generates the social images in public/og/
video/            Remotion project for the promo video, rendered into public/video/ (see "Promo video")
tests/            Regression tests for inquiry logic, copy structure, page metadata, legal documents, agent entry points, cache headers and theme behavior
open-next.config.ts  OpenNext configuration: prerendered output lives in read-only static assets
worker.ts            Worker entry: Markdown content negotiation and cache headers
wrangler.jsonc       Cloudflare Worker and static asset configuration
```

Layout, typography, states and responsive design all use Tailwind utilities. Only `Header`, `ThemePicker`, `InquiryDialog` and the footer year's `CurrentYear` are client components; everything else is a server component, prerendered at build time. Prerendered content does not change until the next deploy, so server components do not show the current time directly: the footer copyright year is first filled with the build-time year, and `CurrentYear` replaces it in the browser with the year of the visit. The Worker runtime cannot read project files with `fs`, so the legal documents are compiled from MDX into components at build time, and `theme-init.js` is bundled as a string by the `raw-loader` rule in `next.config.ts`. To open the inquiry dialog from anywhere on a page, use `InquiryButton` (`product` sets the preselected service).

## Visual design

The visuals are unified with [mailhq](https://github.com/abnormalhq/mail) and [onboard](https://github.com/abnormalhq/onboard), using the abnormal brand (direction A): ink on warm gray paper, with the dark theme being the ink itself; the primary color is the ink, and highlight yellow is the only chromatic brand color. Body text is Inter, headings Bricolage Grotesque, code JetBrains Mono, laid over a Resend-style structure: 1px hairline dividers, unfilled panels, no shadows.

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

The video section under the hero (`src/components/PromoVideo.tsx`) shows a short promo film in a native `<video>` with playback controls; it does not autoplay or interrupt visitors with sound, loads only metadata at first, and the poster image holds the layout. A "Download the video" link always sits below the video. There is one film per language, the text in the film is the page's language, and the title and description live under `video` in both copy files.

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

The rendered `public/video/abnormal-{en,zh}.mp4` and the `.jpg` of the same name (the poster, frame 220) are committed and deployed with the site, served from the same origin by the static asset service, so there are no cross-origin or CORS issues; each film is about 1–2 MB. The addresses and upload dates are in `promoVideos` in `src/data/site.ts`: update `uploadDate` after re-rendering; when a language's `src` is left empty, that page does not show the section, and neither the `/md/` Markdown version nor the structured data mentions it. `tests/video.test.ts` requires the poster and date to be set along with the address, and the files for site paths to exist in `public/`. Once configured, the home page's structured data gains a schema.org `VideoObject` (name and description from the copy, poster and date from the configuration), and `/md/` gains a heading with the video link.

When the machine has no Chrome, Remotion downloads a Chrome Headless Shell of its own; to use an installed browser, set `REMOTION_BROWSER_EXECUTABLE=/path/to/chromium`.

## Privacy policy and terms of service

`privacy.mdx` and `terms.mdx` under `src/content/legal/zh/` and `src/content/legal/en/` are compiled at build time by [`@next/mdx`](https://nextjs.org/docs/app/guides/mdx) and rendered through `src/components/LegalDocument.tsx`, published at `/privacy/` and `/terms/` (Chinese `/zh/privacy/`, `/zh/terms/`), linked from the footer and the inquiry dialog. The body is written in MDX (`{`, `}` and `<` in plain text are treated as syntax and must be written as `\{`, `\}`, `\<`); every second-level heading is numbered automatically and collected into a table of contents. The "Contact us" section is generated by the component from `site.contact`, so the body need not repeat the contact details.

Frontmatter fields: `title`, `description` (the page meta description), `eyebrow` (the English label at the top of the page), `summary` (the lead at the top of the page), `effective` and `updated` (`YYYY-MM-DD`; update `updated` after changing the body), `highlights` (the "At a glance" list at the top of the page). The page first validates the frontmatter with `parseLegalFrontmatter` from `src/lib/legal.ts`: a missing field, a date that is not a real `YYYY-MM-DD`, or an empty `highlights` fails the build outright and names the file and field. The table of contents takes every second-level heading in the document; do not write a first-level heading in the body (the page top is already the h1).

`tests/legal.test.ts` compiles the four documents with the same plugins as `next.config.ts` (listed in `src/content/legal/mdx.ts`) and requires the Chinese and English versions of the same page to match in the number of second-level headings, `effective` and `updated`, the number of `highlights` and the `eyebrow`; changing only one language makes the test complain.

The two texts cover the marketing site, the shop and activation page (onboard), and webmail and the status page (mail). The parts that correspond to system behavior (subscription periods counted from successful payment, the 7-day grace period and 30-day retention period after expiry, the purchase session cookie, 15-minute sign-in links, where data flows for AI features) are written from the mail repository's `src/lib/shop/` and onboard's copy; update them when that logic changes.

The following are business conventions rather than system behavior, and should be checked against reality before operating for real: the order record retention period (12 months), refund rules (full refund for unused redeem codes, in principle no refund once activated, discretionary refund within 48 hours of a subscription charge), response and acceptance deadlines, the circumstances in which administrators access mailboxes, governing law and jurisdiction, and whether the name of the operating entity needs to be added.

## Deployment

The site is deployed through OpenNext as a Cloudflare Worker (`wrangler.jsonc`, Worker name `abnormalhq`, entry `worker.ts`, which wraps the generated `.open-next/worker.js`). All pages are prerendered, with the prerendered output in read-only static assets (`open-next.config.ts`), so no R2 or queue is needed; static files such as fonts are served directly by the static asset service. Production releases come from [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) watching the `main` branch directly: every push is checked, built and deployed automatically; if any step fails nothing is deployed and the last successful version stays live.

`.github/workflows/ci.yml` only runs the same checks and build on PRs and pushes to `main`; it does not release and needs no Cloudflare credentials. As in mail and onboard, Actions are pinned to major version tags only (such as `actions/checkout@v7`), and major upgrades arrive as Dependabot PRs.

### One-time Cloudflare setup

This is already configured; follow it when it needs to be rebuilt. In Workers & Pages, connect the GitHub repository `abnormalhq/abnormalhq`:

- Worker name: `abnormalhq` (must match `wrangler.jsonc`)
- Production branch: `main`, root directory: `/`
- Build command: `pnpm install --frozen-lockfile && pnpm cf:build`
- Deploy command: `pnpm cf:deploy`
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
- Contains no analytics scripts or customer data storage; the only cookie is `abnormal_lang`, written when the language is switched by hand (see "Chinese and English") and described in the privacy policy.
- Fonts are self-hosted with the site; no third-party font service is requested.
- The mailbox interface and address card in the hero are a conceptual illustration of the service, not an actual mail client interface.
