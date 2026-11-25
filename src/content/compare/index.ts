import type { Lang } from "../../data/site.ts";
import { compareEn } from "./en.ts";
import type { CompareContent } from "./types.ts";
import { compareZh } from "./zh.ts";

export { compareReviewed, ourMarks, rivalMarks, rivalSources } from "./data.ts";
export * from "./types.ts";

export const compareContent: Record<Lang, CompareContent> = { en: compareEn, zh: compareZh };
