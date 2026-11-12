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
  | "user"
  | "inbox"
  | "undo"
  | "calendar"
  | "search"
  | "alert"
  | "key"
  | "import"
  | "filter"
  | "install"
  | "globe"
  | "laptop"
  | "phone";

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
/** One screenshot of the screenshots section: its caption and the picture's text alternative. */
export interface ScreenCopy {
  title: string;
  description: string;
  /** What the picture shows, for screen readers and when it does not load. */
  alt: string;
}

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
    /**
     * Each entry is either a section of the home page (anchor) or a page of its own (path, without the language prefix).
     * wide: shown in the desktop bar only where there is room for it, "card" from the card breakpoint up (1100px) and "bar" from the
     * bar breakpoint up (1200px); always in the mobile menu.
     */
    nav: readonly { anchor?: string; path?: string; label: string; wide?: "card" | "bar" }[];
    openMenu: string;
    closeMenu: string;
    login: string;
    /** Buyer account (the storefront's /shop/account/): sign up, sign in, manage mailboxes and orders. */
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
  /** The promo video section (src/components/PromoVideo.tsx); the video address is promoVideo in src/data/site.ts, and the section is not rendered without one. */
  video: {
    eyebrow: string;
    title: string;
    description: string;
    /** Accessible name of the <video>, also the text of the video link in the structured data and Markdown. */
    label: string;
    /** Shown when the browser cannot play <video> or the file fails to load, followed by the download link. */
    fallback: string;
    download: string;
    /** The player's controls (src/components/VideoPlayer.tsx): accessible names and tooltips of its buttons and sliders. */
    play: string;
    pause: string;
    replay: string;
    mute: string;
    unmute: string;
    fullscreen: string;
    exitFullscreen: string;
    /** Name of the seek slider. */
    seek: string;
    /** What a screen reader says for the seek slider's position, such as "0:12 of 0:35". */
    seekTemplate: Template<"current" | "duration">;
    volume: string;
  };
  /**
   * The screenshots section (src/components/Screens.tsx): WebMail as it really looks, one picture per entry, each in the page's
   * language. The files are in public/screens/ (see the README's "Screenshots" section).
   */
  screens: {
    eyebrow: string;
    title: string;
    description: string;
    /** Says the mail and events in the pictures are samples. */
    note: string;
    inbox: ScreenCopy;
    calendar: ScreenCopy;
    phone: ScreenCopy;
  };
  /** The "What's inside" section (src/components/Features.tsx): what a mailbox can do, and where it can be used. */
  features: {
    eyebrow: string;
    title: string;
    intro: readonly [string, string];
    items: readonly { icon: IconName; title: string; description: string }[];
    platformsTitle: string;
    /** Each platform links either to a linked site (link) or to a page of this site (path, without the language prefix). */
    platforms: readonly {
      icon: IconName;
      name: string;
      description: string;
      action: string;
      link?: LinkKey;
      path?: string;
    }[];
  };
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
  /**
   * Plans and prices: the home page's pricing section, the pricing page (/pricing/), the address check and the "what every mailbox gets"
   * block. The plans themselves come from the live catalog (GET /api/shop/catalog); this is only the wording around them. The home
   * page's section and the address check are client components and get this through props, so every sentence with a number in it is a
   * template rather than a function.
   */
  pricing: {
    /** At the foot of the pricing page: the help center's plans and billing articles, then a link on to all of them. */
    questions: { title: string; all: string };
    metaTitle: string;
    metaDescription: string;
    eyebrow: string;
    title: string;
    intro: readonly [string, string];
    /** Lead of the pricing page, under its h1. */
    pageIntro: string;
    /** Home section: link to the pricing page. */
    compareLink: string;
    loading: string;
    /** The shop is not selling right now (catalog `available: false`, or no plans). */
    closedTitle: string;
    closedBody: string;
    /** The catalog could not be read. */
    errorTitle: string;
    errorBody: string;
    retry: string;
    shopLink: string;
    /** Under the plans: which currency the prices are in and when the buyer pays. */
    priceNote: string;
    plan: {
      /** A period of one day, and of several: the {period} of the templates below. */
      oneDay: string;
      days: Template<"days">;
      /** After the amount in LDC. */
      unitOnce: string;
      unitPeriod: Template<"period">;
      /** After the amount when a plan can only be bought by card. */
      cardUnitOnce: string;
      cardUnitPeriod: Template<"period">;
      discount: Template<"percent">;
      /** Read out before the struck-through original price. */
      originalPrice: string;
      /** The card price next to an LDC price. */
      cardOnce: Template<"price">;
      cardPeriod: Template<"price" | "period">;
      /** The card price of a subscription in the comparison table's "By card" row. */
      cardRowPeriod: Template<"price" | "period">;
      mailboxOne: string;
      mailboxes: Template<"count">;
      storage: Template<"size">;
      /** quotaMb 0: the mail server's default quota applies. */
      storageDefault: string;
      /** No domain of the plan can enforce a per-mailbox quota; and only some can. */
      storageUnavailable: string;
      storageMixed: string;
      billingOnce: string;
      billingPeriod: Template<"period">;
      renewAt: Template<"price" | "period">;
      codeDays: Template<"days">;
      codeNoExpiry: string;
      choose: string;
      chooseAria: Template<"name">;
      /**
       * Plans sold per mailbox (the catalog's `seatProducts`): every amount is for one mailbox and the buyer chooses how many.
       * After the amount, in LDC and in a card-only shop.
       */
      seatUnitOnce: string;
      seatUnitPeriod: Template<"period">;
      cardSeatUnitOnce: string;
      cardSeatUnitPeriod: Template<"period">;
      /** The card price per mailbox next to an LDC price, and in the comparison table's "By card" row. */
      seatCardOnce: Template<"price">;
      seatCardPeriod: Template<"price" | "period">;
      seatCardRowOnce: Template<"price">;
      seatCardRowPeriod: Template<"price" | "period">;
      seatRenewAt: Template<"price" | "period">;
      /** How many mailboxes a seat plan can be bought with. */
      seatMailboxes: Template<"min" | "max">;
      /** Under a seat plan's price: the amount is per mailbox and the total is set at checkout. */
      seatNote: string;
      /** Added to it for a discounted plan: mail takes the discount off the order total and rounds once. */
      seatDiscountNote: Template<"percent">;
      /** The unit of a per-mailbox price in the structured data (schema.org unitText). */
      seatUnitName: string;
      /** "Use my own domain": how many domains of their own a buyer of the plan may connect, and a plan without it. */
      ownDomains: Template<"count">;
      ownDomainOne: string;
      ownDomainsNone: string;
    };
    compare: {
      title: string;
      intro: string;
      /** Header of the first column, above the row names. */
      feature: string;
      rows: {
        price: string;
        card: string;
        billing: string;
        renewal: string;
        mailboxes: string;
        storage: string;
        domains: string;
        /** Shown only when a plan on sale includes it. */
        ownDomains: string;
        code: string;
      };
      /** A cell with nothing to say, such as the card price of a plan that cannot be bought by card. */
      none: string;
      /** The renewal of a one-time plan. */
      noRenewal: string;
    };
    /** What every mailbox gets, whatever the plan: limits known from mail's rules, not from the catalog. */
    included: {
      title: string;
      intro: string;
      items: readonly { icon: IconName; title: string; description: string }[];
    };
    /** "Check your address" in the hero and on the pricing page (src/components/AddressCheck.tsx). */
    check: {
      title: string;
      hint: string;
      usernameLabel: string;
      domainLabel: string;
      placeholder: string;
      /** The username rule, shown when what was typed breaks it. */
      invalid: string;
      checking: string;
      available: Template<"email">;
      taken: Template<"email">;
      rateLimited: string;
      failed: string;
      /** Goes to the shop with the address carried along. */
      proceed: string;
      note: string;
    };
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
    /** Under the questions: on to the help center. */
    help: string;
    items: readonly { question: string; answer: string }[];
  };
  /**
   * The help center (/help/ and /help/<slug>/): the wording around the articles. The articles themselves are in
   * src/content/help/, one file per language. The index's search is a client component and gets `search` through props.
   */
  help: {
    metaTitle: string;
    metaDescription: string;
    /** The entry in the footer and the breadcrumb. */
    navLabel: string;
    eyebrow: string;
    title: string;
    intro: string;
    search: {
      label: string;
      placeholder: string;
      /** Announced as the list narrows: one match, and several. */
      resultsOne: string;
      results: Template<"count">;
      empty: string;
      clear: string;
    };
    /** Name of the breadcrumb landmark, and its first entry (the home page). */
    breadcrumbLabel: string;
    home: string;
    /** English label above an article's title. */
    articleEyebrow: string;
    tocLabel: string;
    /** At the foot of the index: on to support. */
    ask: { title: string; body: string };
    /** At the foot of every article: back to the index, or on to support. */
    wrong: { title: string; body: string; index: string; contact: string };
    /** Above that, the other articles of the same topic, named by the topic. */
    related: Template<"topic">;
  };
  /** The security and privacy overview (/security/): the wording around it. The text itself is in src/content/security/. */
  security: {
    metaTitle: string;
    metaDescription: string;
    /** The entry in the footer and the breadcrumb's own name of the page. */
    navLabel: string;
    eyebrow: string;
    /** Before the date the statements were last checked. */
    reviewedLabel: string;
    /** At the foot of the page: on to the full policy and to the help center. */
    policyLink: string;
    helpLink: string;
  };
  closing: {
    eyebrow: string;
    titleLines: readonly [string, string];
    body: string;
    buy: string;
    custom: string;
  };
  /**
   * The live service status in the footer and under the hero (src/components/ServiceStatus.tsx): the state, then the availability
   * figure when there is one. It links to the status page.
   */
  serviceStatus: {
    states: { up: string; down: string; maintenance: string };
    /** {percent} is the figure without its sign, {days} how many days it covers. */
    uptime: Template<"percent" | "days">;
    /** What the link is, for assistive technology, before the state. */
    label: string;
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
    /** Used in place of intro when the current release has Linux packages (see linuxDownload in src/lib/releases.ts). */
    introWithLinux: string;
    macos: { name: string; requirement: string; download: string; brewLabel: string; firstLaunch: string };
    windows: {
      name: string;
      requirement: string;
      download: string;
      /** Link under the download button for Windows on Arm devices. */
      armDownload: string;
      firstLaunch: string;
    };
    /** Shown only when the current release has Linux packages; the links are that release's own .deb files. */
    linux: {
      name: string;
      requirement: string;
      download: string;
      /** Link under the download button for Arm machines. */
      armDownload: string;
      /** Above the apt command that installs the downloaded package. */
      installLabel: string;
      /** At the foot of the card: what the package brings along, and what to do on other distributions. */
      note: string;
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
    /** The button beside an install command (Homebrew, apt), and what it says for a moment after copying. */
    copyCommand: string;
    copiedCommand: string;
    copyFailed: string;
    /** Badge on the card that fits the visitor's computer, which the browser works out after the page loads. */
    forThisComputer: string;
    /** Shown instead, above the cards, to a visitor on a phone or tablet: the desktop app does not run there. */
    phone: { title: string; body: string; webmail: string; apps: string };
    /** Under the latest few previous versions: opens the rest. */
    historyMore: Template<"count">;
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
