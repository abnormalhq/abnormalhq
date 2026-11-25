/**
 * What the comparison page (/compare/), its Markdown version and its test show: every column's cells, built once from the copy in
 * src/content/compare/ and, for Abnormal Mail's own storage, trial and own-domain cells, from the live catalog, so the page never
 * states a size or a trial the shop does not sell. The page, the Markdown and the tests all call `compareView`.
 * Tests run this file with Node directly, so it imports types only with `import type` and other modules with their extension.
 */
import {
  compareContent,
  compareRows,
  type CompareMark,
  type CompareRow,
  markedRows,
  ourMarks,
  rivalMarks,
  rivals,
  rivalSources,
  type Rival,
} from "../content/compare/index.ts";
import type { Lang } from "../data/site.ts";
import { catalogPlans, type ShopCatalog } from "../storefront/index.ts";
import { fillText, sizeLabel } from "./pricing.ts";

export interface CompareCell {
  text: string;
  /** Only in the rows that answer "does it have this" (markedRows). */
  mark?: CompareMark;
}

export interface CompareColumn {
  id: "ours" | Rival;
  name: string;
  plan: string;
  cells: Record<CompareRow, CompareCell>;
}

export interface CompareSourceLink {
  label: string;
  url: string;
}

export interface CompareView {
  columns: CompareColumn[];
  /** The "look elsewhere if you need" list, with the catalog's storage and trial filled in. */
  notFit: string[];
  sources: { rival: Rival; name: string; links: CompareSourceLink[] }[];
}

const isMarked = (row: CompareRow): row is (typeof markedRows)[number] => markedRows.some((marked) => marked === row);

/**
 * The storage the plans on sale give one mailbox, as the plans write it ("1 GB"), or a range ("1 GB–5 GB") when plans differ.
 * Plans that state no quota of their own (0, or a domain without quotas) are left out; null when none states one.
 */
export function catalogStorage(catalog: ShopCatalog | null): string | null {
  if (!catalog?.available) return null;
  const sizes = catalogPlans(catalog)
    .filter(
      (plan) => plan.quotaMb > 0 && !plan.domains.some((domain) => plan.quotaSupportedByDomain?.[domain] === false),
    )
    .map((plan) => plan.quotaMb);
  if (sizes.length === 0) return null;
  const smallest = Math.min(...sizes);
  const largest = Math.max(...sizes);
  return smallest === largest ? sizeLabel(smallest) : `${sizeLabel(smallest)}–${sizeLabel(largest)}`;
}

/**
 * Whether a plan on sale lets the buyer connect a domain of their own. While the catalog cannot be read the cell keeps its
 * conditional wording ("on plans that include one"), which stays true whatever is on sale.
 */
function sellsOwnDomains(catalog: ShopCatalog | null): boolean {
  if (!catalog) return true;
  return catalogPlans(catalog).some((plan) => (plan.customDomains ?? 0) > 0);
}

export function compareView(lang: Lang, catalog: ShopCatalog | null): CompareView {
  const content = compareContent[lang];
  const ours = content.ours;
  const storage = catalogStorage(catalog);
  const trialDays = catalog?.trial?.days;
  const ownDomains = sellsOwnDomains(catalog);

  const ourText: Record<CompareRow, string> = {
    ...ours.cells,
    storage: storage ? fillText(ours.storage, { size: storage }) : ours.storageUnknown,
    free: trialDays ? fillText(ours.freeTrial, { days: trialDays }) : ours.freeNone,
    ownDomain: ownDomains ? ours.ownDomainYes : ours.ownDomainNo,
  };
  const ourMark = (row: CompareRow): CompareMark | undefined => {
    if (!isMarked(row)) return undefined;
    if (row === "ownDomain") return ownDomains ? "partial" : "no";
    return ourMarks[row];
  };
  const cellsOf = (text: Record<CompareRow, string>, markOf: (row: CompareRow) => CompareMark | undefined) =>
    Object.fromEntries(
      compareRows.map((row) => {
        const mark = markOf(row);
        return [row, mark ? { text: text[row], mark } : { text: text[row] }];
      }),
    ) as Record<CompareRow, CompareCell>;

  const columns: CompareColumn[] = [
    { id: "ours", name: ours.name, plan: ours.plan, cells: cellsOf(ourText, ourMark) },
    ...rivals.map((rival) => {
      const copy = content.rivals[rival];
      const marks = rivalMarks[rival];
      return {
        id: rival,
        name: copy.name,
        plan: copy.plan,
        cells: cellsOf(copy.cells, (row) => (isMarked(row) ? marks[row] : undefined)),
      };
    }),
  ];

  const notFit = [
    ...(storage ? [fillText(content.notFit.storage, { size: storage })] : []),
    ...content.notFit.items,
    trialDays ? fillText(content.notFit.free, { days: trialDays }) : content.notFit.freeNone,
  ];

  const sources = rivals.map((rival) => ({
    rival,
    name: content.rivals[rival].name,
    links: rivalSources[rival].map((source, index) => ({
      label: content.rivals[rival].sources[index] ?? source.url,
      url: source.url,
    })),
  }));

  return { columns, notFit, sources };
}
