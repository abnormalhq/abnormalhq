import type { Lang } from "../../data/site.ts";
import type { DevelopersContent } from "../help/types.ts";
import { developersEn } from "./en.ts";
import { developersZh } from "./zh.ts";

export const developersContent: Record<Lang, DevelopersContent> = { en: developersEn, zh: developersZh };
export { apiReference } from "./reference.ts";
