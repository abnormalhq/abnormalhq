/**
 * 与语言无关的站点配置：公开联系方式与联动站点的地址。两种语言的文案在 src/i18n/。
 * 这里只填写公开的业务联系方式，不要放入密钥或其他敏感信息。
 */

export interface Contact {
  wechat: string;
  email: string;
  telegram: string;
}

export const site = {
  /** 品牌名：og:site_name、结构化数据里的组织与网站名称。 */
  name: "Abnormal",
  url: "https://abnormalhq.com",
  /** 只负责跳到主域名，见 next.config.ts 的 redirects。 */
  wwwHost: "www.abnormalhq.com",
  contact: {
    wechat: "",
    email: "support@abnormal.bid",
    telegram: "",
  } satisfies Contact,
};

export type Lang = "zh" | "en";

/**
 * 与官网联动的其他站点。官网是落地页：购买、开通、登录与教程都在这些站点完成，
 * 页头、首屏、入口卡片、流程、页脚统一从这里取地址，换域名时只改这一处。
 * - onboard（abnormalhq/onboard）：兑换开通页、邮箱商店、买家账户（注册、登录、邮箱管理）与教程；英文页在 /en/ 下。
 * - webmail / status（abnormalhq/mail）：网页邮箱与公开状态页，按浏览器语言自动切换，不分路径。
 */
const onboardOrigin = "https://onboard.abnormalhq.com";

export function linksFor(lang: Lang) {
  const onboard = `${onboardOrigin}/${lang === "en" ? "en/" : ""}`;
  return {
    shop: `${onboard}shop/`,
    redeem: onboard,
    account: `${onboard}shop/account/`,
    /** 账户页直接打开注册表单。 */
    register: `${onboard}shop/account/?mode=register`,
    guide: `${onboard}guide/`,
    webmail: "https://webmail.abnormalhq.com/",
    status: "https://console.abnormalhq.com/status",
  } as const;
}

export type LinkKey = keyof ReturnType<typeof linksFor>;

/**
 * 首页的宣传视频（首屏下方的「先看一段视频」区块）。视频与封面和安装包放在同一个 R2 公开桶
 * （downloads.abnormalhq.com，桶名 abnormal-downloads）的 video/ 下，用 aws s3 cp 或 Cloudflare 后台上传，
 * 加 `--cache-control "public, max-age=31536000, immutable"`，换新片时改文件名。
 * src 留空时首页不显示这一区块，Markdown 版本与结构化数据也不提它；填了就要同时填封面与发布日期。
 * 两种语言放同一段视频；字幕（WebVTT）按语言各一份，留空则不挂字幕。
 */
export interface PromoVideo {
  /** MP4（H.264 + AAC）或 WebM 的完整地址。 */
  src: string;
  /** 封面图：16:9，建议 1280×720 以上的 JPG 或 PNG。 */
  poster: string;
  /** 发布日期 YYYY-MM-DD，写进结构化数据（schema.org VideoObject 的 uploadDate）。 */
  uploadDate: string;
  /** 各语言的字幕文件（.vtt）地址，留空不挂。 */
  captions: Record<Lang, string>;
}

export const promoVideo: PromoVideo = {
  src: "",
  poster: "",
  uploadDate: "",
  captions: { zh: "", en: "" },
};

/**
 * 配好了的宣传视频；src 为空时是 null，首页、Markdown 与结构化数据都按没有视频处理。
 * 用 null 而不是 undefined 表示「没有视频」：传 undefined 会落到各函数的默认参数，又读回这里的配置。
 */
export function configuredVideo(video: PromoVideo = promoVideo): PromoVideo | null {
  return video.src.trim() ? video : null;
}

/** <source type>：按扩展名区分 MP4 与 WebM，其他扩展名不写 type，交给浏览器判断。 */
export function videoMimeType(src: string): string | undefined {
  const extension = /\.(mp4|m4v|webm|mov)(?:[?#]|$)/i.exec(src)?.[1]?.toLowerCase();
  if (!extension) return undefined;
  return { mp4: "video/mp4", m4v: "video/mp4", webm: "video/webm", mov: "video/mp4" }[extension];
}

/**
 * 桌面客户端（abnormalhq/mail 的 desktop/）的下载地址。发布时安装包上传到 R2 公开桶，
 * desktop/latest/ 下是固定文件名的最新版本，这里直接链接；latest.json 列出版本号、SHA-256 与大小。
 * releases.json 列出全部版本，下载页的当前版本与历史版本由它生成（见 src/lib/releases.ts）。
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
