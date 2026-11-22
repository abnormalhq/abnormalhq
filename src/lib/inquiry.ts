import type { Contact, Lang } from "../data/site.ts";
import { createTranslator } from "use-intl/core";
import { inquiryMessages } from "./inquiry-messages.ts";

export interface Inquiry {
  product: string;
  duration: string;
  notes: string;
}

/** Inquiry copy: the email sent to us and the copied text use the language of the visitor's current page. */
function inquiryCopy(lang: Lang) {
  const t = createTranslator({ locale: lang, messages: inquiryMessages[lang], namespace: "inquiry" });
  const keys = Object.keys(inquiryMessages.en.inquiry) as (keyof typeof inquiryMessages.en.inquiry)[];
  return Object.fromEntries(keys.map((key) => [key, t(key)])) as Record<
    keyof typeof inquiryMessages.en.inquiry,
    string
  >;
}

export function formatInquiry({ product, duration, notes }: Inquiry, lang: Lang): string {
  const t = inquiryCopy(lang);
  return [
    t.greeting,
    `${t.product}${product}`,
    `${t.duration}${duration}`,
    ...(notes.trim() ? [`${t.notes}${notes.trim()}`] : []),
    t.closing,
  ].join("\n");
}

export function getTelegramUrl(value: string): string | undefined {
  try {
    const url = new URL(value.trim());
    if (url.protocol === "https:" && url.hostname === "t.me" && !url.username && !url.password && url.pathname !== "/")
      return url.href;
  } catch {
    /* Unconfigured or invalid links must not hide a valid email fallback. */
  }
  return undefined;
}

export function getContactLink(contact: Contact, inquiry: Inquiry, lang: Lang) {
  const t = inquiryCopy(lang);
  const telegram = getTelegramUrl(contact.telegram);
  if (telegram)
    return {
      type: "telegram",
      href: telegram,
      label: t.telegram,
    } as const;
  const email = contact.email.trim();
  if (email) {
    return {
      type: "email",
      href: `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`${t.subject}${inquiry.product}`)}&body=${encodeURIComponent(formatInquiry(inquiry, lang))}`,
      label: t.email,
    } as const;
  }
  return undefined;
}

/** Channels listed under "Contact us" on the legal pages. The HTML and Markdown versions both read them from here; unconfigured channels are not shown. */
export function contactChannels(
  contact: Contact,
  labels: { email: string; wechat: string; telegram: string },
): { label: string; value: string; href?: string }[] {
  const email = contact.email.trim();
  const wechat = contact.wechat.trim();
  const telegram = getTelegramUrl(contact.telegram);
  return [
    ...(email ? [{ label: labels.email, value: email, href: `mailto:${email}` }] : []),
    ...(wechat ? [{ label: labels.wechat, value: wechat }] : []),
    ...(telegram ? [{ label: labels.telegram, value: telegram, href: telegram }] : []),
  ];
}

export function describeContact(contact: Contact, lang: Lang): string {
  const t = inquiryCopy(lang);
  const telegram = getTelegramUrl(contact.telegram);
  const parts = [
    contact.wechat.trim() && `${t.wechatLabel}${contact.wechat.trim()}`,
    contact.email.trim() && `${t.emailLabel}${contact.email.trim()}`,
    telegram && `${t.telegramLabel}${telegram}`,
  ].filter(Boolean);
  return parts.length ? `${parts.join(t.separator)}${t.contactHint}` : t.noContact;
}
