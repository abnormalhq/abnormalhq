/**
 * The shape of the comparison page (/compare/): Abnormal Mail beside other mail services, row by row. The marks and the sources
 * are the same in both languages and live in ./data.ts; the words of each language are in ./en.ts and ./zh.ts.
 */
import type { Template } from "../../lib/template.ts";

/** The services the page compares Abnormal Mail with, in the order of the table's columns. */
export const rivals = ["gmail", "outlook", "icloud", "proton", "fastmail"] as const;
export type Rival = (typeof rivals)[number];

/** The rows of the table, top to bottom. */
export const compareRows = [
  "storage",
  "free",
  "adFree",
  "ownDomain",
  "masked",
  "e2e",
  "imap",
  "sync",
  "phone",
  "desktop",
  "attachments",
] as const;
export type CompareRow = (typeof compareRows)[number];

/**
 * Rows that answer "does it have this" carry a mark as well as their words; the other rows (storage, the free plan, attachment
 * size) are amounts, which a mark would only blur.
 */
export const markedRows = [
  "adFree",
  "ownDomain",
  "masked",
  "e2e",
  "imap",
  "sync",
  "phone",
  "desktop",
] as const satisfies readonly CompareRow[];
export type MarkedRow = (typeof markedRows)[number];

/** Yes; only on a paid plan, a business edition or with a condition the cell names; not offered. */
export type CompareMark = "yes" | "partial" | "no";

/** A provider's own page that backs the cells of its column, and the rows it backs. */
export interface CompareSource {
  url: string;
  rows: readonly CompareRow[];
}

/** One service's column in one language. */
export interface RivalCopy {
  name: string;
  /** Which plan the column describes: the free one, or the cheapest where there is none. */
  plan: string;
  cells: Record<CompareRow, string>;
  /** The link text of each source in ./data.ts, in the same order. */
  sources: readonly string[];
}

/** The words of the page in one language. */
export interface CompareContent {
  title: string;
  summary: string;
  /** The date every cell was last checked against its source, YYYY-MM-DD. */
  reviewed: string;
  rows: Record<CompareRow, string>;
  /** Abnormal Mail's column. Storage, the free plan and own domains are read from the live catalog (src/lib/compare.ts). */
  ours: {
    name: string;
    plan: string;
    cells: Omit<Record<CompareRow, string>, "storage" | "free" | "ownDomain">;
    storage: Template<"size">;
    /** Storage when the catalog cannot be read or sells nothing: the pricing page has the numbers. */
    storageUnknown: string;
    freeTrial: Template<"days">;
    freeNone: string;
    ownDomainYes: string;
    ownDomainNo: string;
  };
  rivals: Record<Rival, RivalCopy>;
  marks: Record<CompareMark, string>;
  /** Who it suits and who it does not, in a sentence each, before the table. */
  fit: { title: string; items: readonly string[] };
  notFit: {
    title: string;
    /** {size}: the storage the plans give. Left out while the catalog cannot be read. */
    storage: Template<"size">;
    items: readonly string[];
    /** {days}: the trial's length; without a trial, `freeNone` is said instead. */
    free: Template<"days">;
    freeNone: string;
  };
  tableTitle: string;
  tableCaption: string;
  /** How the columns were chosen and checked, and where to report a mistake. {email}: the support address. */
  method: { title: string; body: readonly string[]; report: Template<"email"> };
  sourcesTitle: string;
  trademarks: string;
}
