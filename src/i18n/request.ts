import { getRequestConfig } from "next-intl/server";
import { defaultLang, toLang } from "./paths.ts";
import { messagesFor } from "./messages.ts";

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = toLang((await requestLocale) ?? defaultLang);

  return {
    locale,
    messages: messagesFor(locale),
  };
});
