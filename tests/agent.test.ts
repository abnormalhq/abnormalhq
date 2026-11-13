import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { absoluteUrl, desktopDownloads, linksFor, site } from "../src/data/site.ts";
import { copies, langs } from "../src/i18n/index.ts";
import { contactChannels } from "../src/lib/inquiry.ts";
import {
  downloadMarkdown,
  homeMarkdown,
  legalMarkdown,
  llmsFullTxt,
  llmsTxt,
  pricingMarkdown,
  stripFrontmatter,
} from "../src/lib/markdown.ts";
import { markdownUrl, varyOnAccept, wantsMarkdown } from "../src/lib/negotiate.ts";
import { helpSlugs } from "../src/content/help/index.ts";
import { pages } from "../src/lib/pages.ts";
import { storeMarkdown, storeMarkdownPaths } from "../src/storefront/lib/markdown.ts";
import { parseReleaseIndex } from "../src/lib/releases.ts";
import { releaseIndex, releaseIndexWithLinux } from "./support/releases.ts";
import { catalog, seatCatalog, seatPlan } from "./support/catalog.ts";

test("every page has a Markdown path under /md/ that mirrors its URL", () => {
  assert.deepEqual(
    pages.map((page) => [page.url, page.markdown]),
    [
      ["/", "/md/"],
      ["/pricing/", "/md/pricing/"],
      ["/shop/", "/md/shop/"],
      ["/redeem/", "/md/redeem/"],
      ["/guide/", "/md/guide/"],
      ["/help/", "/md/help/"],
      ...helpSlugs.map((slug) => [`/help/${slug}/`, `/md/help/${slug}/`]),
      ["/security/", "/md/security/"],
      ["/claude/", "/md/claude/"],
      ["/download/", "/md/download/"],
      ["/privacy/", "/md/privacy/"],
      ["/terms/", "/md/terms/"],
      ["/zh/", "/md/zh/"],
      ["/zh/pricing/", "/md/zh/pricing/"],
      ["/zh/shop/", "/md/zh/shop/"],
      ["/zh/redeem/", "/md/zh/redeem/"],
      ["/zh/guide/", "/md/zh/guide/"],
      ["/zh/help/", "/md/zh/help/"],
      ...helpSlugs.map((slug) => [`/zh/help/${slug}/`, `/md/zh/help/${slug}/`]),
      ["/zh/security/", "/md/zh/security/"],
      ["/zh/claude/", "/md/zh/claude/"],
      ["/zh/download/", "/md/zh/download/"],
      ["/zh/privacy/", "/md/zh/privacy/"],
      ["/zh/terms/", "/md/zh/terms/"],
    ],
  );
});

for (const lang of ["zh", "en"] as const) {
  test(`${lang} home Markdown carries the page's content and links`, () => {
    const t = copies[lang];
    const markdown = homeMarkdown(lang);
    assert.ok(markdown.startsWith(`# ${t.meta.title}\n`));
    for (const entry of t.start.entries) assert.ok(markdown.includes(entry.description));
    for (const product of t.services.products) assert.ok(markdown.includes(`### ${product.name}`));
    for (const step of t.process.steps) assert.ok(markdown.includes(step.description));
    for (const item of t.faq.items) assert.ok(markdown.includes(item.answer));
    // Storefront links are site paths on the page; Markdown carries full addresses.
    for (const url of Object.values(linksFor(lang))) assert.ok(markdown.includes(`(${absoluteUrl(url)})`), url);
    assert.ok(markdown.includes(site.contact.email));
    assert.ok(!markdown.includes("undefined"));
  });

  test(`${lang} download Markdown carries both installers, the brew command and the checksums`, () => {
    const d = copies[lang].download;
    const markdown = downloadMarkdown(lang, parseReleaseIndex(releaseIndex));
    assert.ok(markdown.startsWith(`# ${d.title}\n`));
    for (const url of [
      desktopDownloads.macos,
      desktopDownloads.windows,
      desktopDownloads.windowsArm,
      desktopDownloads.manifest,
    ]) {
      assert.ok(markdown.includes(`(${url})`), url);
    }
    assert.ok(markdown.includes(desktopDownloads.brew));
    for (const step of d.signInSteps) assert.ok(markdown.includes(step));
    assert.ok(!markdown.includes("undefined"));
  });

  test(`${lang} download Markdown lists the current version and the previous ones`, () => {
    const d = copies[lang].download;
    const markdown = downloadMarkdown(lang, parseReleaseIndex(releaseIndex));
    assert.ok(markdown.includes(`${d.currentLabel} 0.2.0 · ${d.releasedLabel} 2026-12-01`), "current version");
    assert.ok(markdown.includes(`## ${d.historyTitle}`));
    assert.ok(markdown.includes(d.historyIntro));
    assert.ok(
      markdown.includes("- 0.1.0 (2026-11-07) · [macOS, 20.4 MB](https://downloads.abnormalhq.com/desktop/0.1.0/"),
    );
    assert.ok(markdown.includes("(https://downloads.abnormalhq.com/desktop/0.1.0/latest.json)"));
    assert.ok(!markdown.includes("- 0.2.0"), "the current version is not a previous one");
  });

  test(`${lang} download Markdown says when there are no previous versions, and works without any`, () => {
    const d = copies[lang].download;
    const only = { latest: "0.1.0", releases: releaseIndex.releases.slice(1) };
    assert.ok(downloadMarkdown(lang, parseReleaseIndex(only)).includes(d.historyEmpty));
    const without = downloadMarkdown(lang, undefined);
    assert.ok(!without.includes(d.currentLabel));
    assert.ok(!without.includes(d.historyTitle));
    assert.ok(without.includes(`(${desktopDownloads.macos})`));
  });

  test(`${lang} download Markdown offers Linux only when the current release has Linux packages`, () => {
    const d = copies[lang].download;
    for (const markdown of [
      downloadMarkdown(lang, parseReleaseIndex(releaseIndex)),
      downloadMarkdown(lang, undefined),
    ]) {
      assert.ok(!markdown.includes(`## ${d.linux.name}`));
      assert.ok(!markdown.includes(".deb"));
      assert.ok(!markdown.includes("apt install"));
      assert.ok(markdown.includes(d.intro));
    }

    const markdown = downloadMarkdown(lang, parseReleaseIndex(releaseIndexWithLinux));
    assert.ok(markdown.includes(d.introWithLinux));
    const linux = markdown.indexOf(`## ${d.linux.name}`);
    assert.ok(linux > markdown.indexOf(`## ${d.windows.name}`) && linux < markdown.indexOf(`## ${d.signInTitle}`));
    assert.ok(markdown.includes(d.linux.requirement));
    assert.ok(
      markdown.includes(
        `[${d.linux.download}](https://downloads.abnormalhq.com/desktop/0.3.0/Abnormal-Mail-0.3.0-linux-x64.deb)`,
      ),
    );
    assert.ok(
      markdown.includes(
        `[${d.linux.armDownload}](https://downloads.abnormalhq.com/desktop/0.3.0/Abnormal-Mail-0.3.0-linux-arm64.deb)`,
      ),
    );
    assert.ok(
      markdown.includes(
        "```sh\n# x64\nsudo apt install ./Abnormal-Mail-0.3.0-linux-x64.deb\n# Arm\nsudo apt install ./Abnormal-Mail-0.3.0-linux-arm64.deb\n```",
      ),
    );
    assert.ok(markdown.includes(d.linux.note));
    // No fixed latest/ address for Linux: those do not exist until a release has Linux packages.
    assert.ok(!markdown.includes("/desktop/latest/Abnormal-Mail-linux"));
    assert.ok(!markdown.includes("undefined"));
  });
}

for (const lang of ["zh", "en"] as const) {
  test(`${lang} pricing Markdown lists every plan with the catalog's own amounts, the comparison and what every mailbox gets`, () => {
    const p = copies[lang].pricing;
    const markdown = pricingMarkdown(lang, catalog);
    assert.ok(markdown.startsWith(`# ${p.title}\n`));
    for (const product of catalog.products) assert.ok(markdown.includes(`## ${product.name}`), product.name);
    // 750 and 500 hundredths of an LDC, the renewal price and the card price, as the backend gave them.
    for (const amount of ["7.50 LDC", "10.00 LDC", "5.00 LDC", "4.00 LDC", "2.99"]) {
      assert.ok(markdown.includes(amount), amount);
    }
    assert.ok(markdown.includes(`(${site.url}${linksFor(lang).shop}?plan=${catalog.products[0]!.id})`));
    assert.ok(markdown.includes(`## ${p.compare.title}`));
    assert.match(markdown, /^\| --- \| --- \| --- \|$/m);
    for (const item of p.included.items) assert.ok(markdown.includes(item.description));
    assert.ok(!markdown.includes("undefined"));
    for (const [, href] of markdown.matchAll(/\]\(([^)\s]+)\)/g)) assert.match(href!, /^https:\/\//, href);
  });

  test(`${lang} pricing Markdown lists a plan sold per mailbox with per-mailbox amounts and its own-domain allowance`, () => {
    const p = copies[lang].pricing;
    const markdown = pricingMarkdown(lang, seatCatalog);
    assert.ok(markdown.includes(`## ${seatPlan.name}`));
    // The amounts are for one mailbox, and the text says so before listing them.
    assert.ok(markdown.includes(p.plan.seatNote));
    assert.ok(markdown.includes(lang === "en" ? "3.00 LDC / mailbox / 30 days" : "3.00 LDC / 邮箱 / 30 天"));
    assert.ok(markdown.includes(lang === "en" ? "2 to 50, you choose" : "2 ～ 50 个，数量自选"));
    // "Your own domain" is a row once a plan includes it, and absent from a catalog where none does.
    assert.ok(markdown.includes(`| ${p.compare.rows.ownDomains} |`));
    assert.match(markdown, /^\| --- \| --- \| --- \| --- \|$/m);
    assert.ok(!pricingMarkdown(lang, catalog).includes(p.compare.rows.ownDomains));
    assert.ok(!markdown.includes("undefined"));
  });

  test(`${lang} pricing Markdown never invents a price: a closed shop or an unread catalog says so`, () => {
    const p = copies[lang].pricing;
    const closed = pricingMarkdown(lang, { ...catalog, available: false, products: [] });
    assert.ok(closed.includes(p.closedBody));
    const unread = pricingMarkdown(lang, null);
    assert.ok(unread.includes(p.errorBody));
    for (const markdown of [closed, unread]) {
      assert.ok(!markdown.includes("LDC /"), "no price line");
      assert.ok(!markdown.includes(`## ${p.compare.title}`));
      // What does not depend on the catalog is still there.
      assert.ok(markdown.includes(`## ${p.included.title}`));
      assert.ok(markdown.includes(`(${site.url}${linksFor(lang).shop})`));
    }
  });

  test(`${lang} home Markdown sends readers to the pricing page instead of quoting a price`, () => {
    const p = copies[lang].pricing;
    const markdown = homeMarkdown(lang);
    assert.ok(markdown.includes(`## ${p.title}`));
    assert.ok(markdown.includes(`[${p.compareLink}](${site.url}${linksFor(lang).pricing})`));
    for (const item of p.included.items) assert.ok(markdown.includes(item.description));
    assert.doesNotMatch(markdown, /\d+\.\d{2} LDC/);
  });
}

test("llms.txt follows the format and lists every page and linked site in both languages", () => {
  const text = llmsTxt();
  assert.match(text, /^# Abnormal\n\n> /);
  for (const page of pages) assert.ok(text.includes(`(${site.url}${page.markdown})`), page.markdown);
  // Descriptions and sections follow the shared language order, default language first.
  const positions = langs.map((lang) => text.indexOf(`> ${copies[lang].meta.description}`));
  assert.ok(
    positions.every((at, i) => at > 0 && (i === 0 || at > positions[i - 1]!)),
    String(positions),
  );
  const sections = [...text.matchAll(/^## (.+)$/gm)].map(([, heading]) => heading);
  assert.deepEqual(sections, ["English", "中文"]);
  for (const lang of ["zh", "en"] as const) {
    for (const url of Object.values(linksFor(lang))) assert.ok(text.includes(`(${absoluteUrl(url)})`), url);
  }
});

test("llms.txt points at llms-full.txt", () => {
  assert.ok(llmsTxt().includes(`(${site.url}/llms-full.txt)`));
});

test("llms-full.txt carries every page's Markdown in the order of llms.txt, each with its address", () => {
  const text = llmsFullTxt((page) => `# Page ${page.markdown}\n\nBody of ${page.url}.\n`);
  assert.match(text, /^# Abnormal\n\n> /);
  assert.ok(text.includes(`(${site.url}/llms.txt)`));
  let at = 0;
  for (const page of pages) {
    const next = text.indexOf(
      `# Page ${page.markdown}\n\nBody of ${page.url}.\n\nSource: ${site.url}${page.url}\n`,
      at,
    );
    assert.ok(next > at, page.url);
    at = next;
  }
  assert.equal(text.split("\n\n---\n\n").length, pages.length + 1);
  assert.ok(text.endsWith(`Source: ${site.url}${pages.at(-1)!.url}\n`));
});

for (const lang of ["zh", "en"] as const) {
  test(`${lang} storefront Markdown (redeem, guide, shop) is generated from the storefront copy with full addresses`, () => {
    for (const path of storeMarkdownPaths) {
      const markdown = storeMarkdown(lang, path);
      assert.match(markdown, /^# \S/, path);
      assert.ok(!markdown.includes("undefined"), path);
      // Every link is a full address on this site, an external one or mail; none is left relative to the old language root.
      for (const [, href] of markdown.matchAll(/\]\(([^)\s]+)\)/g))
        assert.match(href!, /^(https:\/\/|mailto:)/, `${path}: ${href}`);
    }
    assert.ok(storeMarkdown(lang, "/redeem/").includes(`(${site.url}${linksFor(lang).guide})`));
    assert.ok(storeMarkdown(lang, "/shop/").includes(`(${site.url}/api/shop/catalog)`));
  });
}

test("legal Markdown drops the frontmatter and keeps the metadata and body", () => {
  const source = readFileSync(new URL("../src/content/legal/en/terms.mdx", import.meta.url), "utf8");
  const body = stripFrontmatter(source);
  assert.ok(body.startsWith("This English version"));
  assert.ok(!body.includes("highlights:"));

  const markdown = legalMarkdown(
    "en",
    {
      title: "Terms",
      description: "",
      eyebrow: "",
      summary: "Summary",
      effective: "2026-01-01",
      updated: "2026-01-02",
      highlights: ["One"],
    },
    "Body",
  );
  assert.ok(markdown.startsWith("# Terms\n\nSummary\n"));
  assert.ok(markdown.includes("- Effective: 2026-01-01"));
  assert.ok(markdown.includes("- One"));
  assert.ok(markdown.includes("\n\nBody\n\n## Contact us\n"));
  assert.ok(markdown.includes(copies.en.legal.contactBody("Terms")));
  assert.ok(markdown.includes(`- Email: [${site.contact.email}](mailto:${site.contact.email})`));
});

test("legal documents stay plain Markdown, so the raw body is safe to serve", () => {
  for (const file of ["en/privacy", "en/terms", "zh/privacy", "zh/terms"]) {
    const source = readFileSync(new URL(`../src/content/legal/${file}.mdx`, import.meta.url), "utf8");
    assert.doesNotMatch(stripFrontmatter(source), /^(import|export) |<[A-Z]/m, file);
  }
});

test("robots.txt allows crawling, declares content signals and points at the sitemap", () => {
  const robots = readFileSync(new URL("../public/robots.txt", import.meta.url), "utf8");
  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Allow: \/$/m);
  assert.match(robots, /^Content-Signal: search=yes, ai-input=yes, ai-train=no$/m);
  assert.ok(robots.includes(`Sitemap: ${site.url}/sitemap.xml`));
});

test("contact channels skip what isn't configured and keep the order of the legal page", () => {
  const labels = { email: "Email", wechat: "WeChat", telegram: "Telegram" };
  assert.deepEqual(contactChannels({ email: " ", wechat: "", telegram: "not a url" }, labels), []);
  assert.deepEqual(contactChannels({ email: "a@b.c", wechat: "wx", telegram: "https://t.me/x" }, labels), [
    { label: "Email", value: "a@b.c", href: "mailto:a@b.c" },
    { label: "WeChat", value: "wx" },
    { label: "Telegram", value: "https://t.me/x", href: "https://t.me/x" },
  ]);
});

test("Markdown is served only when the Accept header prefers it", () => {
  const cases: [string | null, boolean][] = [
    ["text/markdown", true],
    ["TEXT/Markdown", true],
    ["text/markdown, text/html;q=0.9", true],
    ["text/html;q=0.9, text/markdown", true],
    ["text/markdown;q=0.8, */*;q=0.1", true],
    ["text/html, text/markdown", true],
    [null, false],
    ["", false],
    ["*/*", false],
    ["text/*", false],
    ["text/html", false],
    ["text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", false],
    ["text/markdown;q=0", false],
    ["text/html, text/markdown;q=0", false],
    ["text/html, text/markdown;q=0.5", false],
    ["text/markdown;q=0.5, text/*;q=1", false],
    ["text/markdown;q=0.5, */*", false],
    ["text/markdown;q=nonsense", false],
    // A range with parameters is more specific, and only charset=utf-8 can match our response.
    ["text/markdown;charset=utf-8;q=0, text/markdown;q=1, text/html;q=0.5", false],
    ["text/markdown;q=1, text/markdown;charset=utf-8;q=0, text/html;q=0.5", false],
    ['text/markdown;charset="UTF-8"', true],
    ["text/markdown;charset=utf-8, text/html;q=0.5", true],
    ["text/markdown;charset=gbk, text/html;q=0.5", false],
    ["text/markdown;variant=gfm, text/html;q=0.5", false],
    ["text/markdown;charset=gbk;q=1, text/markdown;q=0.5, text/html;q=0.4", true],
    ["text/markdown;q=0.5, text/html;charset=utf-8;q=1, text/html;q=0", false],
    ["text/markdown;q=0.5;ext=1, text/html;q=0.4", true],
    // RFC 9110 allows empty parameters, such as a stray trailing semicolon.
    ["text/markdown;", true],
    ["text/markdown;charset=utf-8;", true],
    ["text/markdown;;q=0.5, text/html;q=0.4", true],
    ["text/markdown;q=0.5, text/html;", false],
    ["text/markdown;charset=utf-8;;q=0, text/markdown;q=1", false],
  ];
  for (const [accept, expected] of cases) assert.equal(wantsMarkdown(accept), expected, String(accept));
});

test("only GET and HEAD for a listed page on the main host are sent to Markdown", () => {
  const request = (url: string, method = "GET", accept = "text/markdown") =>
    new Request(url, { method, headers: { accept } });

  assert.equal(markdownUrl(request("https://abnormalhq.com/"))?.href, "https://abnormalhq.com/md/");
  assert.equal(
    markdownUrl(request("https://abnormalhq.com/zh/privacy/?a=1"))?.href,
    "https://abnormalhq.com/md/zh/privacy/?a=1",
  );
  assert.equal(markdownUrl(request("https://abnormalhq.com/terms/", "HEAD"))?.pathname, "/md/terms/");

  assert.equal(markdownUrl(request("https://www.abnormalhq.com/privacy/")), undefined);
  assert.equal(markdownUrl(request("https://abnormalhq.com/", "POST")), undefined);
  assert.equal(markdownUrl(request("https://abnormalhq.com/", "GET", "text/html")), undefined);
  assert.equal(markdownUrl(request("https://abnormalhq.com/md/")), undefined);
  assert.equal(markdownUrl(request("https://abnormalhq.com/privacy")), undefined);
  assert.equal(markdownUrl(request("https://abnormalhq.com/llms.txt")), undefined);
});

test("negotiated responses add Accept to Vary and keep everything else", async () => {
  const response = varyOnAccept(
    new Response("# Title", {
      headers: { "Content-Type": "text/markdown; charset=utf-8", Vary: "RSC, Next-Url", Link: '</>; rel="canonical"' },
    }),
  );
  assert.equal(response.headers.get("vary"), "RSC, Next-Url, Accept");
  assert.equal(response.headers.get("content-type"), "text/markdown; charset=utf-8");
  assert.equal(response.headers.get("link"), '</>; rel="canonical"');
  assert.equal(await response.text(), "# Title");

  assert.equal(varyOnAccept(new Response(null)).headers.get("vary"), "Accept");
});

test("pricing Markdown escapes backslashes and pipes in table cells, so a plan name cannot break out of its cell", () => {
  const first = catalog.products[0]!;
  const markdown = pricingMarkdown("en", {
    ...catalog,
    products: [{ ...first, name: "Solo\\|Duo" }, ...catalog.products.slice(1)],
  });
  const header = markdown.split("\n").find((line) => line.startsWith("|") && line.includes("Solo"));
  assert.ok(header, "the comparison table names the plan");
  assert.ok(header.includes("Solo\\\\\\|Duo"), header);
});
