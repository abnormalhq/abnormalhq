import type { LinkKey } from "../data/site.ts";
import type { Template } from "../lib/template.ts";

/** Icon 组件支持的图标名；文案里的入口与流程图标从这里选。 */
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

/** 服务卡片的图标，ProductCard 按这个键画；与卡片在列表里的位置无关。 */
export type ProductIcon = "mail" | "domain" | "team" | "setup";

export interface Product {
  icon: ProductIcon;
  name: string;
  category: string;
  description: string;
  tags: readonly string[];
  /** 价格；留空时显示 services.priceFallback（「咨询报价」）。 */
  price: string;
  priceNote: string;
  /** 站外入口：有值时卡片按钮直接前往（如商店），否则打开咨询弹窗。 */
  link?: LinkKey;
  actionLabel?: string;
  featured?: boolean;
}

export interface LinkItem {
  link: LinkKey;
  label: string;
}

/**
 * 一种语言的全部文案。站外地址只写成 LinkKey，由 linksFor(lang) 换成对应语言的页面。
 * eyebrow、kicker、tagline 与 tocKicker 是装饰性的英文小标：两种语言都写英文，组件渲染时带 lang="en"，
 * 读屏软件才会用英文读；tests/i18n.test.ts 检查它们不含中文。
 */
export interface Copy {
  /** <html lang> 与 hreflang。 */
  htmlLang: string;
  ogLocale: string;
  /** 中文标题末尾的句号是全角「。」，英文是「.」。 */
  dot: string;
  /** 只在部分宽度换行的标题里，两行之间的分隔：中文不需要空格，英文要一个。 */
  space: string;
  meta: {
    title: string;
    description: string;
    socialTitle: string;
    socialDescription: string;
    /** 分享卡片图片（public/og/）的替代文字。 */
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
    /** 买家账户（onboard 的 /shop/account/）：注册、登录、管理邮箱与订单。 */
    account: string;
    buy: string;
    haveCode: string;
    loginWebmail: string;
  };
  theme: {
    /** {label} 换成当前选项。 */
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
    /** 登录买家账户（管理邮箱与订单）。 */
    loginLink: string;
    /** 登录网页邮箱（收发邮件）。 */
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
  /** 宣传视频区块（src/components/PromoVideo.tsx），视频地址在 src/data/site.ts 的 promoVideo；未配置时不渲染。 */
  video: {
    eyebrow: string;
    title: string;
    description: string;
    /** <video> 的无障碍名称，也是结构化数据与 Markdown 里视频链接的文字。 */
    label: string;
    /** 浏览器不能播放 <video> 时显示，后面跟着 download 链接。 */
    fallback: string;
    download: string;
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
    /** 品牌标记下的一句话。 */
    tagline: string;
    productLabel: string;
    supportLabel: string;
    contactLabel: string;
    productLinks: readonly LinkItem[];
    supportLinks: readonly LinkItem[];
    faq: string;
    emailAria: (email: string) => string;
    /** {year} 换成当前年份。 */
    copyright: Template<"year">;
    buyOnline: string;
    legalLabel: string;
  };
  legalPages: readonly { path: string; label: string }[];
  /** 桌面客户端下载页（/download/）。下载地址在 src/data/site.ts 的 desktopDownloads。 */
  download: {
    metaTitle: string;
    metaDescription: string;
    /** 页脚产品栏里的入口。 */
    navLabel: string;
    eyebrow: string;
    title: string;
    intro: string;
    macos: { name: string; requirement: string; download: string; brewLabel: string; firstLaunch: string };
    windows: {
      name: string;
      requirement: string;
      download: string;
      /** 下载按钮下方给 Windows on Arm 设备的链接。 */
      armDownload: string;
      firstLaunch: string;
    };
    signInTitle: string;
    signInSteps: readonly string[];
    checksums: string;
    /** 首屏下方的「当前版本 0.1.0 · 发布于 2026-11-07」。版本数据来自 src/lib/releases.ts。 */
    currentLabel: string;
    releasedLabel: string;
    historyTitle: string;
    historyIntro: string;
    /** 只有一个版本时，历史版本一节显示这句。 */
    historyEmpty: string;
    /** 历史版本每一行末尾，链到那一版的 latest.json。 */
    historyChecksums: string;
    webmailNote: string;
    webmailLink: string;
  };
  inquiry: {
    /** 弹窗标题上方的小标。 */
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
    /** 「咨询与服务适用{terms}与{privacy}。」：{terms}、{privacy} 换成服务条款与隐私政策的链接，链接两侧的空格写在文案里。 */
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
    /** 目录标题旁的英文小标。 */
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
