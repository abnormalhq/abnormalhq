import type { Contact, Lang } from "../data/site.ts";

export interface Inquiry {
  product: string;
  duration: string;
  notes: string;
}

/** Inquiry copy: the email sent to us and the copied text use the language of the visitor's current page. */
const text = {
  zh: {
    greeting: "你好，我想咨询邮箱服务。",
    product: "服务类型：",
    duration: "使用时长：",
    notes: "需求：",
    closing: "请帮我确认邮箱方案、总费用、开通时间与支持范围。",
    subject: "邮箱服务咨询 · ",
    telegram: "在 Telegram 咨询",
    email: "通过邮件咨询",
    wechatLabel: "微信：",
    emailLabel: "邮箱：",
    telegramLabel: "Telegram：",
    separator: " · ",
    contactHint: "。复制下方咨询内容后联系我们。",
    noContact: "咨询渠道即将公布。你可以先复制需求，稍后再来联系我们。",
  },
  en: {
    greeting: "Hi, I'd like to ask about your email service.",
    product: "Service: ",
    duration: "Term: ",
    notes: "Details: ",
    closing: "Please let me know the plan, total cost, setup time and what support is included.",
    subject: "Email service inquiry · ",
    telegram: "Ask on Telegram",
    email: "Ask by email",
    wechatLabel: "WeChat: ",
    emailLabel: "Email: ",
    telegramLabel: "Telegram: ",
    separator: " · ",
    contactHint: ". Copy the message below and send it to us.",
    noContact: "Contact channels are coming soon. You can copy your request now and get in touch later.",
  },
} satisfies Record<Lang, Record<string, string>>;

export function formatInquiry({ product, duration, notes }: Inquiry, lang: Lang): string {
  const t = text[lang];
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
  const t = text[lang];
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
  const t = text[lang];
  const telegram = getTelegramUrl(contact.telegram);
  const parts = [
    contact.wechat.trim() && `${t.wechatLabel}${contact.wechat.trim()}`,
    contact.email.trim() && `${t.emailLabel}${contact.email.trim()}`,
    telegram && `${t.telegramLabel}${telegram}`,
  ].filter(Boolean);
  return parts.length ? `${parts.join(t.separator)}${t.contactHint}` : t.noContact;
}
