/**
 * The storefront's languages, paths and copy types. The copy itself is one module per language (i18n.zh.ts, i18n.en.ts), so a client component
 * that only needs a path or a type never pulls in the text of both; copy.ts holds both for server code and tests, and client components take
 * their page's language from the provider the page renders (src/storefront/components/copy/).
 * Tone follows the design system's content guidelines: short sentences ending in full stops, no exclamation marks or emoji; full-width punctuation in Chinese; product names are not translated.
 */

export type Lang = "zh" | "en";
export const LANGS: readonly Lang[] = ["en", "zh"];

export function isLang(value: unknown): value is Lang {
  return value === "zh" || value === "en";
}

/**
 * Language root of each language's pages, relative to the site root, as the rest of the site: English (the default) at the root, Chinese under /zh/.
 * Copy links such as [guide](guide/) are relative to it.
 */
export const LANG_PATHS: Record<Lang, string> = { zh: "zh/", en: "" };

/** The redeem page, relative to the language root: the standalone onboard site had it at the language root itself. */
export const REDEEM_PATH = "redeem/";

/** Absolute path of a storefront page in a language: storePath("zh", "shop/") -> /zh/shop/, storePath("en") -> /redeem/. */
export function storePath(lang: Lang, page: string = REDEEM_PATH): string {
  return `/${LANG_PATHS[lang]}${page}`;
}

/** One block of guide body: a paragraph, an ordered or an unordered list. Text may contain [text](link) and **bold**, rendered by RichText; links may be paths relative to the language root. */
export type GuideBlock = { p: string } | { ol: readonly string[] } | { ul: readonly string[] };

export interface GuideCopy {
  title: string;
  description: string;
  back: string;
  /** Label above the heading. */
  eyebrow: string;
  heading: string;
  lede: string;
  /** Name of the table of contents. */
  contents: string;
  backToTop: string;
  sections: readonly { title: string; blocks: readonly GuideBlock[] }[];
}

export interface Copy {
  title: string;
  description: string;
  eyebrow: string;
  titleLines: readonly [string, string];
  titleDot: string;
  tagline: string;
  ui: {
    formTitle: string;
    formDescription: string;
    formBadge: string;
    optional: string;
    username: string;
    password: string;
    passwordPlaceholder: string;
    features: readonly string[];
    guideTitle: string;
    guideDescription: string;
    guideLink: string;
    reminderTitle: string;
    reminderDescription: string;
    supportTitle: string;
    supportDescription: string;
  };
  steps: {
    code: { label: string; hint: string; placeholder: string };
    options: { label: string; hint: string; domain: string; count: string };
    accounts: {
      label: string;
      hint: string;
      placeholder: string;
      ordinal: (n: number) => string;
      usernameLabel: (n: number) => string;
      passwordLabel: (n: number) => string;
      /** Shown when the chosen domain cannot enforce a per-mailbox quota. */
      noQuota: string;
    };
    notify: { label: string; hint: string; placeholder: string };
  };
  rules: Record<"length", string>;
  buttons: {
    show: string;
    hide: string;
    generate: string;
    submit: (count: number) => string;
    submitting: string;
    copy: string;
    copied: string;
    copyAll: string;
    openWebmail: string;
  };
  submitNote: string;
  noscript: string;
  msg: {
    codeChecking: string;
    codeIncomplete: string;
    codeRequired: string;
    codeOk: (domains: readonly string[], expires: string | null, left: number) => string;
    countHint: (left: number, max: number) => string;
    /** Explanation shown when a new redeem code has a smaller quota and extra filled-in rows were removed. */
    rowsTrimmed: (allowed: number, dropped: number) => string;
    usernameChecking: string;
    usernameOk: (email: string) => string;
    duplicateUsername: (n: number) => string;
    passwordMissing: (labels: readonly string[]) => string;
    passwordOk: string;
    passwordGenerated: string;
    partial: (ok: number, failed: number) => string;
    /** Human verification turned out to be required at submit time and is not finished yet: no request was sent this time. */
    challengePending: string;
    /** The redeem code was first verified at submit time and activates on another domain than the rows showed: nothing was sent this time. */
    domainChanged: (domain: string) => string;
    networkError: string;
    unknownError: string;
  };
  problem: {
    username: Record<"required" | "invalid", string>;
    password: Record<"required" | "too_long" | "whitespace" | "weak", string>;
    notify: Record<"invalid" | "too_long", string>;
  };
  kind: Record<
    | "invalid_code"
    | "code_used"
    | "code_expired"
    | "code_disabled"
    | "count_exceeded"
    | "domain_invalid"
    | "username_invalid"
    | "username_taken"
    | "password_invalid"
    | "notify_invalid"
    | "rate_limited"
    | "challenge_failed"
    | "unavailable",
    string
  >;
  result: {
    eyebrow: string;
    title: (count: number) => string;
    login: string;
    loginNote: string;
    imap: string;
    smtp: string;
    port: string;
    security: Record<"tls" | "starttls" | "none", string>;
    /** The account details were sent to the notification address. */
    notified: (to: string) => string;
    /** Not sent: the reason is the server's Chinese text, and may be missing. */
    notifyFailed: (to: string, reason: string | null) => string;
    note: readonly [string, string];
    /** Read the guide next: one sentence with a [text](guide/) link. */
    next: string;
    again: string;
  };
  guide: GuideCopy;
  help: {
    eyebrow: string;
    title: string;
    items: readonly { q: string; a: string }[];
    contact: readonly [string, string];
  };
  /** Related links listed at the end of the redeem page's Markdown version. */
  footer: {
    links: readonly { label: string; href: string }[];
  };
}

/** The server's reason ends in a full stop; drop it when embedding mid-sentence, so two punctuation marks do not touch. */
export function withoutPeriod(reason: string): string {
  return reason.replace(/[。.]\s*$/, "");
}

/** Display of a redeem code's expiry: written as a full date in the page language. */
export function formatDate(iso: string, lang: Lang): string | null {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return null;
  return new Date(time).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
