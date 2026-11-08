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
  url: "https://abnormalhq.com",
  /** Only redirects to the main domain; see the redirects in next.config.ts. */
  wwwHost: "www.abnormalhq.com",
  contact: {
    wechat: "",
    email: "support@abnormal.bid",
    telegram: "",
  } satisfies Contact,
};

export type Lang = "zh" | "en";

/**
 * The other sites linked from the marketing site. The site is a landing page: buying, activation, sign-in and guides all happen on these sites,
 * and the header, hero, entry cards, process and footer all take their addresses from here, so a domain change touches one place.
 * - onboard (abnormalhq/onboard): redeem/activation page, mailbox shop, buyer account (sign-up, sign-in, mailbox management) and guides; English pages are under /en/.
 * - webmail / status (abnormalhq/mail): webmail and the public status page, switching with the browser language rather than by path.
 */
const onboardOrigin = "https://onboard.abnormalhq.com";

export function linksFor(lang: Lang) {
  const onboard = `${onboardOrigin}/${lang === "en" ? "en/" : ""}`;
  return {
    shop: `${onboard}shop/`,
    redeem: onboard,
    account: `${onboard}shop/account/`,
    /** Opens the sign-up form on the account page directly. */
    register: `${onboard}shop/account/?mode=register`,
    guide: `${onboard}guide/`,
    webmail: "https://webmail.abnormalhq.com/",
    status: "https://console.abnormalhq.com/status",
  } as const;
}

export type LinkKey = keyof ReturnType<typeof linksFor>;

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
  en: { src: "/video/abnormal-en.mp4", poster: "/video/abnormal-en.jpg", uploadDate: "2026-11-08" },
  zh: { src: "/video/abnormal-zh.mp4", poster: "/video/abnormal-zh.jpg", uploadDate: "2026-11-08" },
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

export const desktopDownloads = {
  macos: `${downloadsOrigin}/desktop/latest/Abnormal-Mail-macos-universal.dmg`,
  windows: `${downloadsOrigin}/desktop/latest/Abnormal-Mail-windows-x64-setup.exe`,
  windowsArm: `${downloadsOrigin}/desktop/latest/Abnormal-Mail-windows-arm64-setup.exe`,
  manifest: `${downloadsOrigin}/desktop/latest.json`,
  releases: `${downloadsOrigin}/desktop/releases.json`,
  brew: "brew install --cask abnormalhq/tap/abnormal-mail",
} as const;
