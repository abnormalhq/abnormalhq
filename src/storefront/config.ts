/** Page-level constants: brand, contact, default domain and webmail. Copy lives in i18n.ts, site and backend addresses in site.ts. */

export const siteName = "Abnormal";

/**
 * The main site (abnormalhq/abnormalhq): Abnormal's landing page; the "Website" link in the header and the footer point to it.
 * The main site defaults to English at the root with Chinese under /zh/, so each page language gets its own address.
 */
export const homepage = { zh: "https://abnormalhq.com/zh/", en: "https://abnormalhq.com/" } as const;

/** Support email: the same as mailhq's default service address. */
export const supportEmail = "support@abnormalhq.com";

/** Shown after the username until the redeem code check completes; afterwards the redeem code's allowed domains win. */
export const defaultDomain = "abnormalhq.com";

/**
 * The MailHQ webmail entry used by the guide and demo data.
 * Real activation results use only the webmail returned by the backend; this constant is not a fallback when none is configured.
 */
export const webmailUrl = "https://webmail.abnormalhq.com";
