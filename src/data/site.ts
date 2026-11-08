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
