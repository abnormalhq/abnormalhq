/**
 * Language-independent site configuration: public contact details and the addresses of the linked sites. Copy for both languages is in src/i18n/.
 * Only public business contact details belong here; never put secrets or other sensitive information in it.
 */

export interface Contact {
  wechat: string;
  email: string;
  telegram: string;
}

export const site = {
  /** Brand name: og:site_name and the organization and website names in the structured data. */
  name: "Abnormal",
  /**
   * Other names the brand goes by, for the organization in the structured data. "Abnormal" alone is shared with an unrelated
   * email security company, so search engines and AI answers get the names that are this service's only: the desktop app's
   * and the domain's.
   */
  alternateNames: ["Abnormal Mail", "abnormalhq"],
  url: "https://abnormalhq.com",
  /** The brand's own profiles elsewhere (schema.org sameAs): the GitHub organization the website, mail and the desktop app are built in. */
  sameAs: ["https://github.com/abnormalhq"],
  /** Only redirects to the main domain; see the redirects in next.config.ts. */
  wwwHost: "www.abnormalhq.com",
  contact: {
    wechat: "",
    email: "support@abnormalhq.com",
    telegram: "",
  } satisfies Contact,
};

export type Lang = "zh" | "en";

/**
 * Where the buyer journey happens. The storefront (shop, redeem, buyer account, guide) is part of this site since the standalone onboard site was
 * retired (src/storefront/); webmail and the status page are mail's (abnormalhq/mail), switching with the browser language rather than by path.
 * The header, hero, entry cards, process and footer all take their addresses from here.
 */
export function linksFor(lang: Lang) {
  const root = lang === "en" ? "/" : `/${lang}/`;
  return {
    shop: `${root}shop/`,
    /** Plans and prices from the live catalog (src/components/Pricing.tsx). */
    pricing: `${root}pricing/`,
    redeem: `${root}redeem/`,
    account: `${root}shop/account/`,
    /** Opens the sign-up form on the account page directly. */
    register: `${root}shop/account/?mode=register`,
    guide: `${root}guide/`,
    /** The help center's index (src/components/HelpCenter.tsx); its articles are /help/<slug>/. */
    help: `${root}help/`,
    /** The security and privacy overview (src/content/security/). */
    security: `${root}security/`,
    /** How to connect Claude to the admin console's MCP server (src/content/claude/). */
    claude: `${root}claude/`,
    /** The developer documentation: the management API and MCP server (src/content/developers/). */
    developers: `${root}developers/`,
    webmail: "https://webmail.abnormalhq.com/",
    status: "https://console.abnormalhq.com/status",
  } as const;
}

export type LinkKey = keyof ReturnType<typeof linksFor>;

/**
 * The management API of mail's admin console (abnormalhq/mail docs/api.md and mcp.md), as the developer documentation names it.
 * `openapi` is this site's copy of mail's docs/openapi.json, served from public/ as a static file.
 */
export const developerApi = {
  base: "https://console.abnormalhq.com/api/v1",
  mcp: "https://console.abnormalhq.com/api/mcp",
  /** Applying for a workspace (mail's docs/multi-tenancy.md, "Workspace applications"); a platform admin reviews each one. */
  signup: "https://console.abnormalhq.com/signup",
  openapi: `${site.url}/developers/openapi.json`,
  /** The public status page, where the management API is a service of its own (mail's docs/admin-console.md). */
  status: "https://console.abnormalhq.com/status",
  /** Database reachability, no sign-in (mail's docs/deployment.md): for a developer's own uptime monitor. */
  health: "https://console.abnormalhq.com/api/health",
} as const;

/**
 * The home page's promo video (the "Watch a short video" section under the hero), one per language, rendered by the video/ directory of
 * this repository (a Remotion project) into public/video/, deployed with the site and served from the same origin; see the README's
 * "Promo video" section for re-rendering. With an empty src the home page does not show the section, and the Markdown version and the
 * structured data do not mention it either; once set, the poster and the upload date must be set with it.
 */
export interface PromoVideo {
  /** Address of an MP4 (H.264 + AAC) or WebM file: a site path (starting with /) or a full URL. */
  src: string;
  /** Poster image: 16:9, the same frame as the video (remotion still). */
  poster: string;
  /** Upload date, YYYY-MM-DD, written into the structured data (uploadDate of the schema.org VideoObject); update it after re-rendering. */
  uploadDate: string;
}

export const promoVideos: Record<Lang, PromoVideo> = {
  en: { src: "/video/abnormal-en.mp4", poster: "/video/abnormal-en.jpg", uploadDate: "2026-11-09" },
  zh: { src: "/video/abnormal-zh.mp4", poster: "/video/abnormal-zh.jpg", uploadDate: "2026-11-09" },
};

/**
 * The configured promo video of a language; null when src is empty, and the home page, Markdown and structured data then treat it as no video.
 * null rather than undefined means "no video": passing undefined would fall through to the functions' default parameters and read this configuration again.
 */
export function configuredVideo(lang: Lang, videos: Record<Lang, PromoVideo> = promoVideos): PromoVideo | null {
  const video = videos[lang];
  return video.src.trim() ? video : null;
}

/** Prefixes a site path with the site address, for structured data and Markdown; a full URL is returned as is. */
export function absoluteUrl(path: string): string {
  return path.startsWith("/") ? `${site.url}${path}` : path;
}

/** <source type>: MP4 and WebM are told apart by extension; other extensions get no type and are left to the browser. */
export function videoMimeType(src: string): string | undefined {
  const extension = /\.(mp4|m4v|webm|mov)(?:[?#]|$)/i.exec(src)?.[1]?.toLowerCase();
  if (!extension) return undefined;
  return { mp4: "video/mp4", m4v: "video/mp4", webm: "video/webm", mov: "video/mp4" }[extension];
}

/**
 * Download addresses for the desktop client (desktop/ in abnormalhq/mail). On release the installers are uploaded to a public R2 bucket;
 * desktop/latest/ holds the latest version under fixed file names, linked directly here; latest.json lists the version number, SHA-256 and sizes.
 * releases.json lists every version; the download page's current and past releases are generated from it (see src/lib/releases.ts).
 */
const downloadsOrigin = "https://downloads.abnormalhq.com";

/** Name of the desktop client, as its installers and Homebrew cask call it; the download page's structured data names the app with it. */
export const desktopAppName = "Abnormal Mail";

export const desktopDownloads = {
  macos: `${downloadsOrigin}/desktop/latest/Abnormal-Mail-macos-universal.dmg`,
  windows: `${downloadsOrigin}/desktop/latest/Abnormal-Mail-windows-x64-setup.exe`,
  windowsArm: `${downloadsOrigin}/desktop/latest/Abnormal-Mail-windows-arm64-setup.exe`,
  manifest: `${downloadsOrigin}/desktop/latest.json`,
  releases: `${downloadsOrigin}/desktop/releases.json`,
  brew: "brew install --cask abnormalhq/tap/abnormal-mail",
} as const;
