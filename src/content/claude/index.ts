import type { Lang } from "../../data/site.ts";
import type { ConnectorContent } from "../help/types.ts";
import { claudeEn } from "./en.ts";
import { claudeZh } from "./zh.ts";

export { claudeCodeAdd, claudeCodeRemove, connectorUrl } from "./commands.ts";
export const claudeContent: Record<Lang, ConnectorContent> = { en: claudeEn, zh: claudeZh };
