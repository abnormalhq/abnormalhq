/**
 * Server-side compatibility facade backed by next-intl messages. Client components receive only selected copy through props or the locale provider.
 */
import { createTranslator } from "use-intl/core";
import { linksFor, type Lang } from "../data/site.ts";
import { messagesFor } from "./messages.ts";
import { localePath, toLang } from "./paths.ts";
import {
  createTranslationFacade,
  type DynamicMessageFormatters,
  type MessageTranslator,
} from "./translation-facade.ts";
import type { Copy } from "./types.ts";

export { defaultLang, langs, localePath, stripLocale, switchPath, toLang } from "./paths.ts";
export type { Lang };

const formatters: DynamicMessageFormatters = {
  "services.consultAria": (t, [name]) => t("services.consultAria", { name: name as string }),
  "footer.emailAria": (t, [email]) => t("footer.emailAria", { email: email as string }),
  "legal.contactBody": (t, [title]) => t("legal.contactBody", { title: title as string }),
  "legal.seeAlso": (t, [label]) => t("legal.seeAlso", { label: label as string }),
};

const copyCache = new Map<Lang, Copy>();

function copyFor(lang: Lang): Copy {
  const cached = copyCache.get(lang);
  if (cached) return cached;

  const t = createTranslator({
    locale: lang,
    messages: messagesFor(lang),
    namespace: "marketing",
  });
  const copy = createTranslationFacade<Copy>(
    t as unknown as MessageTranslator,
    messagesFor(lang).marketing,
    formatters,
  );

  copyCache.set(lang, copy);
  return copy;
}

export const copies: Record<Lang, Copy> = { en: copyFor("en"), zh: copyFor("zh") };

export function getCopy(locale: string | undefined) {
  const lang = toLang(locale);
  return {
    lang,
    t: copyFor(lang),
    links: linksFor(lang),
    path: (path: string) => localePath(lang, path),
  };
}
