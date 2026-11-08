import type { LinkKey } from "../data/site.ts";
import type { Template } from "../lib/template.ts";

/** Icon names the Icon component supports; the entry and process icons in the copy are chosen from these. */
export type IconName =
  | "arrow"
  | "up-right"
  | "check"
  | "plus"
  | "close"
  | "menu"
  | "shield"
  | "chat"
  | "spark"
  | "copy"
  | "sun"
  | "moon"
  | "monitor"
  | "cart"
  | "ticket"
  | "mail"
  | "book"
  | "user";

/** Icon of a service card, drawn by ProductCard from this key; independent of the card's position in the list. */
export type ProductIcon = "mail" | "domain" | "team" | "setup";

export interface Product {
  icon: ProductIcon;
  name: string;
  category: string;
  description: string;
  tags: readonly string[];
  /** Price; when empty, services.priceFallback ("On request") is shown. */
  price: string;
  priceNote: string;
  /** External entry: when set, the card button goes straight there (e.g. the shop); otherwise it opens the inquiry dialog. */
  link?: LinkKey;
  actionLabel?: string;
  featured?: boolean;
}

export interface LinkItem {
  link: LinkKey;
  label: string;
}

/**
 * All copy for one language. External addresses are written only as LinkKey; linksFor(lang) turns them into that language's pages.
 * eyebrow, kicker, tagline and tocKicker are decorative English labels: both languages write them in English and components render them with lang="en",
 * so screen readers read them as English; tests/i18n.test.ts checks they contain no Chinese.
 */
export interface Copy {
  /** <html lang> and hreflang. */
  htmlLang: string;
  ogLocale: string;
  /** The full stop at the end of Chinese headings is the full-width ideographic full stop (U+3002), in English ".". */
  dot: string;
  /** Separator between the two lines of a heading that wraps only at some widths: Chinese needs no space, English needs one. */
  space: string;
  meta: {
    title: string;
    description: string;
    socialTitle: string;
    socialDescription: string;
    /** Alt text for the social card image (public/og/). */
    socialImageAlt: string;
  };
  skipLink: string;
  brandLabel: string;
  langToggle: { label: string; aria: string };
  header: {
    navLabel: string;
    mobileNavLabel: string;
    nav: readonly { anchor: string; label: string }[];
    openMenu: string;
    closeMenu: string;
    login: string;
    /** Buyer account (onboard's /shop/account/): sign up, sign in, manage mailboxes and orders. */
    account: string;
    buy: string;
    haveCode: string;
    loginWebmail: string;
  };
  theme: {
    /** {label} is replaced with the current option. */
    ariaTemplate: Template<"label">;
    titleTemplate: Template<"label">;
    options: { system: string; light: string; dark: string };
  };
  hero: {
    eyebrow: string;
    titleLines: readonly [string, string];
    description: readonly [string, string];
    buy: string;
    register: string;
    loginPrompt: string;
    /** Sign in to the buyer account (manage mailboxes and orders). */
    loginLink: string;
    /** Sign in to webmail (read and send mail). */
    webmailLink: string;
    promises: readonly string[];
    visualLabel: string;
    mock: {
      overline: string;
      heading: string;
      inbox: string;
      starred: string;
      mails: readonly { title: string; body: string; time: string }[];
      domainNote: string;
      demoLabel: string;
    };
  };
  valueStrip: { lead: string; strong: string; labels: readonly string[] };
  start: {
    eyebrow: string;
    title: string;
    intro: readonly [string, string];
    entries: readonly {
      icon: IconName;
      eyebrow: string;
      title: string;
      description: string;
      link: LinkKey;
      action: string;
      primary?: boolean;
    }[];
    secondary: readonly LinkItem[];
    support: string;
  };
  services: {
    eyebrow: string;
    titleLines: readonly [string, string];
    intro: readonly [string, string];
    products: readonly Product[];
    priceFallback: string;
    consult: string;
    consultAria: (name: string) => string;
    noteQuestion: string;
    noteAction: string;
    noteFine: string;
  };
  process: {
    eyebrow: string;
    title: string;
    intro: readonly [string, string];
    steps: readonly {
      icon: IconName;
      title: string;
      description: string;
      link: LinkKey;
      action: string;
    }[];
  };
  faq: {
    eyebrow: string;
    title: string;
    description: string;
    contact: string;
    items: readonly { question: string; answer: string }[];
  };
  closing: {
    eyebrow: string;
    titleLines: readonly [string, string];
    body: string;
    buy: string;
    custom: string;
  };
  footer: {
    /** The one-liner under the brand mark. */
    tagline: string;
    productLabel: string;
    supportLabel: string;
    contactLabel: string;
    productLinks: readonly LinkItem[];
    supportLinks: readonly LinkItem[];
    faq: string;
    emailAria: (email: string) => string;
    /** {year} is replaced with the current year. */
    copyright: Template<"year">;
    buyOnline: string;
    legalLabel: string;
  };
  legalPages: readonly { path: string; label: string }[];
  /** Desktop client download page (/download/). Download addresses are in desktopDownloads in src/data/site.ts. */
  download: {
    metaTitle: string;
    metaDescription: string;
    /** Entry in the footer's product column. */
    navLabel: string;
    eyebrow: string;
    title: string;
    intro: string;
    macos: { name: string; requirement: string; download: string; brewLabel: string; firstLaunch: string };
    windows: {
      name: string;
      requirement: string;
      download: string;
      /** Link under the download button for Windows on Arm devices. */
      armDownload: string;
      firstLaunch: string;
    };
    signInTitle: string;
    signInSteps: readonly string[];
    checksums: string;
    /** The "Current version 0.1.0 · Released 2026-11-07" line under the hero. Version data comes from src/lib/releases.ts. */
    currentLabel: string;
    releasedLabel: string;
    historyTitle: string;
    historyIntro: string;
    /** Shown in the past releases section when there is only one version. */
    historyEmpty: string;
    /** At the end of each past release row, linking to that version's latest.json. */
    historyChecksums: string;
    webmailNote: string;
    webmailLink: string;
  };
  inquiry: {
    /** Small label above the dialog title. */
    kicker: string;
    close: string;
    title: string;
    description: readonly [string, string];
    productLabel: string;
    durationLabel: string;
    durations: readonly string[];
    otherProduct: string;
    undecidedProduct: string;
    undecidedLabel: string;
    notesLabel: string;
    optional: string;
    notesPlaceholder: string;
    previewLabel: string;
    copy: string;
    note: string;
    /** "Requests and services are covered by the {terms} and {privacy}.": {terms} and {privacy} are replaced with links to the terms and privacy policy; the spaces around the links are written in the copy. */
    legal: Template<"terms" | "privacy">;
    newWindow: string;
    copied: string;
    copyFailed: string;
    copyFieldLabel: string;
  };
  legal: {
    effective: string;
    updated: string;
    dateLocale: string;
    tocLabel: string;
    tocHint: string;
    /** English label next to the table of contents heading. */
    tocKicker: string;
    highlights: string;
    highlightsNote: string;
    contactTitle: string;
    contactBody: (title: string) => string;
    contactPending: string;
    contactLabels: { email: string; wechat: string; telegram: string };
    colon: string;
    relatedLabel: string;
    seeAlso: (label: string) => string;
    backHome: string;
  };
}
