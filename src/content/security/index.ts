import type { Lang } from "../../data/site.ts";
import type { SecurityContent } from "../help/types.ts";
import { securityEn } from "./en.ts";
import { securityZh } from "./zh.ts";

export const securityContent: Record<Lang, SecurityContent> = { en: securityEn, zh: securityZh };
