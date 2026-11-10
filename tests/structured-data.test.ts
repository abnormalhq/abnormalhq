import { test } from "node:test";
import assert from "node:assert/strict";
import { site } from "../src/data/site.ts";
import { copies } from "../src/i18n/index.ts";
import { linksFor } from "../src/data/site.ts";
import { planViews } from "../src/lib/pricing.ts";
import {
  homeStructuredData,
  legalStructuredData,
  pricingStructuredData,
  serializeJsonLd,
} from "../src/lib/structured-data.ts";
import { catalog } from "./support/catalog.ts";

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

test("every @id the graph refers to is defined in it", () => {
  const graph = nodes(homeStructuredData("zh"));
  const defined = new Set(graph.map((node) => node["@id"]));
  const refs = JSON.stringify(graph).match(/\{"@id":"[^"]+"\}/g) ?? [];
  for (const ref of refs) assert.ok(defined.has(JSON.parse(ref)["@id"]), ref);
});

test("serialized JSON-LD cannot close its script tag", () => {
  const text = serializeJsonLd({ answer: "</script><script>alert(1)</script>" });
  assert.ok(!text.includes("<"));
  assert.deepEqual(JSON.parse(text), { answer: "</script><script>alert(1)</script>" });
});
