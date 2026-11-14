import { test } from "node:test";
import assert from "node:assert/strict";
import { desktopAppName, desktopDownloads, site } from "../src/data/site.ts";
import { copies } from "../src/i18n/index.ts";
import { linksFor } from "../src/data/site.ts";
import { planViews } from "../src/lib/pricing.ts";
import { parseReleaseIndex } from "../src/lib/releases.ts";
import { copy as storeCopy } from "../src/storefront/copy.ts";
import { shopCopy } from "../src/storefront/lib/shop-copy.ts";
import { storeMarkdownPaths } from "../src/storefront/lib/markdown.ts";
import {
  downloadStructuredData,
  homeStructuredData,
  legalStructuredData,
  pricingStructuredData,
  serializeJsonLd,
  storeStructuredData,
} from "../src/lib/structured-data.ts";
import { catalog, seatCatalog } from "./support/catalog.ts";
import { releaseIndex, releaseIndexWithLinux } from "./support/releases.ts";

type Node = Record<string, unknown>;
const nodes = (data: { "@graph": Node[] }) => data["@graph"];
const ofType = (graph: Node[], type: string) =>
  graph.find((node) => [node["@type"]].flat().includes(type)) as Node | undefined;

for (const lang of ["zh", "en"] as const) {
  test(`${lang} home describes the organization, the site and every FAQ answer on the page`, () => {
    const t = copies[lang];
    const graph = nodes(homeStructuredData(lang));
    assert.equal(ofType(graph, "Organization")?.name, site.name);
    assert.equal(ofType(graph, "WebSite")?.url, `${site.url}/`);
    const page = ofType(graph, "FAQPage")!;
    assert.equal(page.url, lang === "en" ? `${site.url}/` : `${site.url}/zh/`);
    assert.equal(page.inLanguage, t.htmlLang);
    const questions = page.mainEntity as { name: string; acceptedAnswer: { text: string } }[];
    assert.deepEqual(
      questions.map(({ name, acceptedAnswer }) => [name, acceptedAnswer.text]),
      t.faq.items.map(({ question, answer }) => [question, answer]),
    );
  });
}

test("a legal page carries its dates and a breadcrumb back to its language's home", () => {
  const frontmatter = {
    title: "Terms of Service",
    description: "The rules.",
    eyebrow: "TERMS",
    summary: "Summary.",
    effective: "2026-09-21",
    updated: "2026-11-04",
    highlights: ["One"],
  };
  const page = ofType(nodes(legalStructuredData("zh", "/terms/", frontmatter)), "WebPage")!;
  assert.equal(page.url, `${site.url}/zh/terms/`);
  assert.equal(page.datePublished, "2026-09-21");
  assert.equal(page.dateModified, "2026-11-04");
  const crumbs = (page.breadcrumb as { itemListElement: { item: string }[] }).itemListElement;
  assert.deepEqual(
    crumbs.map(({ item }) => item),
    [`${site.url}/zh/`, `${site.url}/zh/terms/`],
  );
});

for (const lang of ["zh", "en"] as const) {
  test(`${lang} pricing offers only what the page shows: a card price in a real currency, never LDC`, () => {
    const p = copies[lang].pricing;
    const plans = planViews(catalog, lang, p, linksFor(lang).shop);
    const graph = nodes(pricingStructuredData(lang, plans));
    const page = ofType(graph, "WebPage")!;
    assert.equal(page.url, lang === "en" ? `${site.url}/pricing/` : `${site.url}/zh/pricing/`);
    assert.equal(page.name, p.metaTitle);
    const products = graph.filter((node) => node["@type"] === "Product");
    // The one-time plan is sold for LDC only, which is no ISO 4217 currency: it gets no Product at all.
    assert.deepEqual(
      products.map(({ name }) => name),
      ["Team | Monthly"],
    );
    assert.deepEqual(products[0]!.offers, {
      "@type": "Offer",
      price: "2.99",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: `${site.url}${linksFor(lang).shop}?plan=planmonthlyabcd`,
      seller: { "@id": `${site.url}/#organization` },
    });
    assert.deepEqual(page.mainEntity, [{ "@id": products[0]!["@id"] }]);
    const defined = new Set(graph.map((node) => node["@id"]));
    for (const ref of JSON.stringify(graph).match(/\{"@id":"[^"]+"\}/g) ?? [])
      assert.ok(defined.has(JSON.parse(ref)["@id"]), ref);
  });
}

test("pricing without a readable catalog, or with the shop closed, claims no product", () => {
  for (const plans of [[], planViews({ ...catalog, available: false }, "en", copies.en.pricing, "/shop/")]) {
    const graph = nodes(pricingStructuredData("en", plans));
    assert.equal(ofType(graph, "Product"), undefined);
    assert.equal("mainEntity" in ofType(graph, "WebPage")!, false);
  }
  // Card payment off: the same plans carry no card price, so nothing can be offered in a real currency.
  const ldcOnly = { ...catalog, payment: { ldc: true, stripe: null } };
  const graph = nodes(pricingStructuredData("en", planViews(ldcOnly, "en", copies.en.pricing, "/shop/")));
  assert.equal(ofType(graph, "Product"), undefined);
});

test("a plan sold per mailbox is offered as a unit price with the range that can be bought, never as the plan's whole price", () => {
  for (const lang of ["en", "zh"] as const) {
    const plans = planViews(seatCatalog, lang, copies[lang].pricing, linksFor(lang).shop);
    const graph = nodes(pricingStructuredData(lang, plans));
    const product = graph.find((node) => String(node["@id"]).endsWith("#plan-planseatsabcdef"))!;
    const offer = product.offers as Node;
    assert.equal("price" in offer, false);
    const unit = copies[lang].pricing.plan.seatUnitName;
    assert.deepEqual(offer.priceSpecification, {
      "@type": "UnitPriceSpecification",
      price: "1.99",
      priceCurrency: "USD",
      unitText: unit,
      referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitText: unit },
    });
    assert.deepEqual(offer.eligibleQuantity, {
      "@type": "QuantitativeValue",
      minValue: 2,
      maxValue: 50,
      unitText: unit,
    });
    // The fixed plan beside it keeps its plain price.
    const fixed = graph.find((node) => String(node["@id"]).endsWith("#plan-planmonthlyabcd"))!;
    assert.equal((fixed.offers as Node).price, "2.99");
  }
});

test("the organization names the brand apart from the unrelated companies called Abnormal", () => {
  const organization = ofType(nodes(homeStructuredData("en")), "Organization")!;
  assert.equal(organization.name, "Abnormal");
  assert.deepEqual(organization.alternateName, ["Abnormal Mail", "abnormalhq"]);
  assert.deepEqual(organization.sameAs, ["https://github.com/abnormalhq"]);
});

for (const lang of ["zh", "en"] as const) {
  test(`${lang} download page describes the desktop app with the systems and installers the page offers`, () => {
    const d = copies[lang].download;
    const graph = nodes(downloadStructuredData(lang, parseReleaseIndex(releaseIndex)));
    const page = ofType(graph, "WebPage")!;
    assert.equal(page.url, lang === "en" ? `${site.url}/download/` : `${site.url}/zh/download/`);
    assert.equal(page.name, d.metaTitle);
    const app = ofType(graph, "SoftwareApplication")!;
    assert.equal(app.name, desktopAppName);
    assert.equal(app.operatingSystem, `${d.macos.name}, ${d.windows.name}`);
    assert.deepEqual(app.downloadUrl, [desktopDownloads.macos, desktopDownloads.windows, desktopDownloads.windowsArm]);
    assert.equal(app.softwareVersion, "0.2.0");
    assert.equal(app.datePublished, "2026-12-01");
    assert.deepEqual(page.mainEntity, { "@id": app["@id"] });
    // Nothing the page does not say: no price, no rating.
    assert.equal("offers" in app, false);
    assert.equal("aggregateRating" in app, false);
  });

  test(`${lang} download page lists Linux only with Linux packages, and no version without the release list`, () => {
    const d = copies[lang].download;
    const withLinux = ofType(
      nodes(downloadStructuredData(lang, parseReleaseIndex(releaseIndexWithLinux))),
      "SoftwareApplication",
    )!;
    assert.equal(withLinux.operatingSystem, `${d.macos.name}, ${d.windows.name}, ${d.linux.name}`);
    assert.ok((withLinux.downloadUrl as string[]).some((url) => url.endsWith(".deb")));
    const without = ofType(nodes(downloadStructuredData(lang, undefined)), "SoftwareApplication")!;
    assert.equal("softwareVersion" in without, false);
    assert.equal("datePublished" in without, false);
    assert.equal(without.operatingSystem, `${d.macos.name}, ${d.windows.name}`);
  });

  test(`${lang} storefront pages carry a breadcrumb, and the steps the redeem and shop pages walk through`, () => {
    for (const path of storeMarkdownPaths) {
      const graph = nodes(storeStructuredData(lang, path));
      const page = ofType(graph, "WebPage")!;
      assert.equal(page.url, `${site.url}${lang === "en" ? "" : "/zh"}${path}`);
      const crumbs = (page.breadcrumb as { itemListElement: { name: string; item: string }[] }).itemListElement;
      assert.deepEqual(
        crumbs.map(({ item }) => item),
        [`${site.url}${lang === "en" ? "/" : "/zh/"}`, page.url],
      );
      assert.ok(!crumbs[1]!.name.includes(" · "), crumbs[1]!.name);
      const howTo = ofType(graph, "HowTo");
      const steps = (howTo?.step as { text: string }[] | undefined)?.map(({ text }) => text);
      if (path === "/guide/") assert.equal(howTo, undefined);
      if (path === "/shop/") assert.deepEqual(steps, [...shopCopy[lang].steps]);
      if (path === "/redeem/") {
        const { code, options, accounts, notify } = storeCopy[lang].steps;
        assert.deepEqual(
          steps,
          [code, options, accounts, notify].map((step) => `${step.label}: ${step.hint}`),
        );
      }
    }
  });
}

test("every @id the graph refers to is defined in it", () => {
  for (const data of [
    homeStructuredData("zh"),
    downloadStructuredData("en", parseReleaseIndex(releaseIndex)),
    ...storeMarkdownPaths.map((path) => storeStructuredData("zh", path)),
  ]) {
    const graph = nodes(data);
    const defined = new Set(graph.map((node) => node["@id"]));
    const refs = JSON.stringify(graph).match(/\{"@id":"[^"]+"\}/g) ?? [];
    for (const ref of refs) assert.ok(defined.has(JSON.parse(ref)["@id"]), ref);
  }
});

test("serialized JSON-LD cannot close its script tag", () => {
  const text = serializeJsonLd({ answer: "</script><script>alert(1)</script>" });
  assert.ok(!text.includes("<"));
  assert.deepEqual(JSON.parse(text), { answer: "</script><script>alert(1)</script>" });
});
