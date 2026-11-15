import type { Lang } from "../../data/site.ts";
import { screens, screenSrc, screenSrcSet, type ScreenKey } from "../../lib/screens.ts";
import type { DocImage } from "./types.ts";

export interface Illustration {
  title: string;
  alt: string;
  caption: string;
  steps: readonly (readonly [title: string, detail: string])[];
}

/** Source for the committed SVGs. Regenerate with `node scripts/help-illustrations.ts` after editing either language. */
export const illustrations = {
  en: {
    "apple-profile": {
      title: "Set up your Apple devices",
      alt: "Apple setup: open Apps & sync, download or scan the profile, install it, then enter the mailbox password or an app password.",
      caption: "Setup overview. The profile supplies the settings; you enter the password on your device.",
      steps: [
        ["Open Apps & sync", "In webmail: Settings → Apps & sync"],
        ["Get the profile", "Download on Mac; scan on iPhone or iPad"],
        ["Install and enter your password", "With two-step verification: use an app password"],
      ],
    },
    "mail-client": {
      title: "One mailbox, two connections",
      alt: "Mail app settings: use the full email address as the username, IMAP to receive and SMTP with authentication to send. Copy server names, ports and encryption from your own mailbox settings.",
      caption:
        "Connection diagram. Copy your own server, port and encryption values from Settings → Apps & sync. With two-step verification, use an app password.",
      steps: [
        ["Your identity", "Username = your full email address"],
        ["Receive with IMAP", "Copy the incoming server, port and encryption"],
        ["Send with SMTP", "Copy outgoing settings; enable authentication"],
      ],
    },
    security: {
      title: "Choose the right sign-in method",
      alt: "With two-step verification enabled: webmail uses the mailbox password and authenticator code; mail apps use individual app passwords; recovery codes are saved separately.",
      caption:
        "Sign-in methods after enabling two-step verification. Save recovery codes somewhere safe; each can be used once.",
      steps: [
        ["Webmail", "Mailbox password + authenticator code"],
        ["Mail, calendar and contacts apps", "Create a separate app password for each app"],
        ["Lost your authenticator?", "Sign in with a saved, single-use recovery code"],
      ],
    },
    migration: {
      title: "Bring your mail with you",
      alt: "Import flow: connect the old mailbox over encrypted IMAP, review folder mapping and date range, then copy into Abnormal in the background. The old mailbox stays unchanged.",
      caption:
        "Import copies mail into your new mailbox. Review the folder destinations before starting; the original mail stays where it is.",
      steps: [
        ["Connect the old mailbox", "Encrypted IMAP + its password or app password"],
        ["Choose what to bring", "Review folder mapping and the date range"],
        ["Copy into Abnormal", "Runs in the background; originals stay unchanged"],
      ],
    },
    renewal: {
      title: "When a paid subscription expires",
      alt: "Paid subscription expiry: 7 days of grace with normal use, then 30 days suspended with data retained and incoming mail accepted, after which the mailbox may be deleted. Free trials have no grace period.",
      caption:
        "Paid subscription timeline. Free trials have no 7-day grace period: they stop at expiry and retain mail for 30 days.",
      steps: [
        ["Grace period · 7 days", "Keep using the mailbox normally"],
        ["Suspended · 30 days", "No sign-in; incoming mail and data are retained"],
        ["After the retention period", "The mailbox and its mail may be deleted"],
      ],
    },
    discount: {
      title: "Apply a discount before paying",
      alt: "Discount flow: enter a code in the shop, choose an eligible plan, then check the discount and final price on the order before paying.",
      caption:
        "Apply the code in the shop, then confirm the final discount on the order page. Eligibility depends on the code and plan.",
      steps: [
        ["Enter your code in the shop", "Choose “I have a discount code” and apply it"],
        ["Pick an eligible plan", "Eligible plans show their discounted prices"],
        ["Review the order, then pay", "Check the code, discount and final amount"],
      ],
    },
    team: {
      title: "From seats to team mailboxes",
      alt: "Team setup: sign in as the buyer, choose and pay for the seat quantity, then create mailboxes under My account. Purchased seats can stay unused until needed.",
      caption:
        "A seat is room for one mailbox. You can create mailboxes as needed rather than opening all of them at purchase.",
      steps: [
        ["Sign in as the buyer", "The account manages the order and mailboxes"],
        ["Choose seats and pay", "Review the total for your chosen quantity"],
        ["Create the team's mailboxes", "My account → My mailboxes; unused seats wait"],
      ],
    },
    domain: {
      title: "Connect your own domain",
      alt: "Domain setup: add the domain in My account, publish and verify the ownership TXT record, add the listed mail DNS records, then wait for approval before creating mailboxes.",
      caption:
        "Domain setup overview. Copy the exact DNS names and values from your account; create mailboxes after the domain is active.",
      steps: [
        ["Add your domain", "My account → Use my own domain"],
        ["Prove ownership", "Publish the supplied TXT record, then verify"],
        ["Configure mail DNS", "Copy the records and check their status"],
        ["Wait for approval", "Once active, create mailboxes on your domain"],
      ],
    },
    deletion: {
      title: "Before removing a mailbox",
      alt: "Mailbox deletion flow: export mail to keep, select Delete under My mailboxes, and confirm the full address. Deletion does not cancel a subscription.",
      caption:
        "Deleting a mailbox removes its mail and stops delivery. To stop automatic card renewals, cancel the subscription separately in My account.",
      steps: [
        ["Save the mail you need", "Export it from webmail before deleting"],
        ["Open My mailboxes", "Find the mailbox and choose Delete"],
        ["Confirm the full address", "The mailbox is removed; its slot is freed"],
      ],
    },
    ai: {
      title: "Where AI requests go",
      alt: "AI generation flow: the content needed by the chosen feature goes through Cloudflare AI Gateway to the model provider, currently DeepSeek. The sections below describe separate help search and web lookup processing.",
      caption:
        "Generation request path. The content depends on the feature; help retrieval and task web lookups use the additional services described below.",
      steps: [
        ["Content needed by the feature", "See the feature-by-feature list below"],
        ["Cloudflare AI Gateway", "Routes the generation request"],
        ["Model provider · currently DeepSeek", "Processes the request and generates a result"],
      ],
    },
  },
  zh: {
    "apple-profile": {
      title: "在 Apple 设备上完成设置",
      alt: "Apple 设置流程：在应用与同步中下载或扫描描述文件，安装后输入邮箱密码；开启两步验证时使用应用专用密码。",
      caption: "设置流程示意。描述文件提供服务器设置，密码由你在自己的设备上输入。",
      steps: [
        ["打开「应用与同步」", "网页邮箱 → 设置 → 应用与同步"],
        ["获取描述文件", "Mac 下载；iPhone 或 iPad 扫描二维码"],
        ["安装并输入密码", "开启两步验证时，使用应用专用密码"],
      ],
    },
    "mail-client": {
      title: "一个邮箱，两条连接",
      alt: "邮件客户端连接示意：用户名使用完整邮箱地址，IMAP 负责收信，SMTP 开启身份验证后负责发信。服务器、端口和加密方式从自己的邮箱设置中复制。",
      caption:
        "连接示意。服务器、端口和加密方式请复制「设置 → 应用与同步」里的实际值；开启两步验证后使用应用专用密码。",
      steps: [
        ["确认登录身份", "用户名 = 完整的邮箱地址"],
        ["通过 IMAP 收信", "复制收件服务器、端口和加密方式"],
        ["通过 SMTP 发信", "复制发件设置，并开启身份验证"],
      ],
    },
    security: {
      title: "为不同入口选择登录方式",
      alt: "开启两步验证后：网页邮箱使用邮箱密码和验证器验证码，邮件客户端分别使用应用专用密码，恢复码单独妥善保存。",
      caption: "开启两步验证后的登录方式。请妥善保存恢复码，每个恢复码只能使用一次。",
      steps: [
        ["登录网页邮箱", "邮箱密码 + 身份验证器里的验证码"],
        ["连接邮件、日历与通讯录应用", "为每个应用单独创建应用专用密码"],
        ["验证器丢失时", "使用妥善保存的一次性恢复码登录"],
      ],
    },
    migration: {
      title: "把旧邮件带到新邮箱",
      alt: "邮件导入流程：通过加密 IMAP 连接旧邮箱，核对文件夹对应关系与日期范围，再在后台复制到 Abnormal；旧邮箱保持不变。",
      caption: "导入会把邮件复制到新邮箱。开始前核对每个文件夹的去向，原来的邮件仍留在旧邮箱里。",
      steps: [
        ["连接旧邮箱", "加密 IMAP + 原邮箱密码或授权码"],
        ["选择要带走的邮件", "核对文件夹对应关系与日期范围"],
        ["复制到 Abnormal", "后台进行，旧邮箱里的内容保持不变"],
      ],
    },
    renewal: {
      title: "付费订阅到期后的时间线",
      alt: "付费订阅到期后先有 7 天宽限期，可正常使用；随后停用 30 天，保留数据并继续收信；之后邮箱可能被删除。免费试用没有宽限期。",
      caption: "付费订阅时间线。免费试用没有 7 天宽限期，到期即停用，邮件保留 30 天。",
      steps: [
        ["宽限期 · 7 天", "邮箱照常使用"],
        ["停用期 · 30 天", "无法登录；继续收信并保留邮件与数据"],
        ["保留期结束之后", "邮箱及其中的邮件可能被删除"],
      ],
    },
    discount: {
      title: "付款之前使用优惠码",
      alt: "优惠码使用流程：在商店输入优惠码，选择适用套餐，付款前在订单页核对优惠金额和最终价格。",
      caption: "先在商店使用优惠码，再到订单页确认最终优惠。是否适用取决于优惠码和套餐。",
      steps: [
        ["在商店输入优惠码", "选择「我有优惠码」，输入后点「使用」"],
        ["选择适用的套餐", "适用套餐会显示优惠后的价格"],
        ["核对订单，再付款", "确认优惠码、优惠金额和最终实付金额"],
      ],
    },
    team: {
      title: "从购买席位到开通团队邮箱",
      alt: "团队开通流程：购买者登录账户，选择席位数量并付款，然后在我的账户中开通邮箱。已购席位可以留待需要时使用。",
      caption: "一个席位对应一个邮箱名额。可以按需开通，不必在购买时一次用完所有席位。",
      steps: [
        ["购买者先登录账户", "这个账户管理订单和团队邮箱"],
        ["选择席位数量并付款", "核对所选数量对应的合计金额"],
        ["为团队开通邮箱", "我的账户 → 我的邮箱；空闲席位可稍后使用"],
      ],
    },
    domain: {
      title: "接入自己的域名",
      alt: "域名接入流程：在我的账户添加域名，发布并验证所有权 TXT 记录，配置邮件 DNS 记录，等待审核开通后创建邮箱。",
      caption: "域名接入流程示意。DNS 名称与记录值请原样复制账户页提供的内容，域名开通后再创建邮箱。",
      steps: [
        ["添加域名", "我的账户 → 使用自己的域名"],
        ["验证所有权", "发布页面提供的 TXT 记录，再点「验证」"],
        ["配置邮件 DNS", "复制页面列出的记录，并检查生效状态"],
        ["等待审核开通", "显示「已开通」后，即可选择此域名创建邮箱"],
      ],
    },
    deletion: {
      title: "删除邮箱前后的操作",
      alt: "邮箱删除流程：先导出要保留的邮件，在我的邮箱中选择删除，再输入完整地址确认。删除邮箱不会取消订阅。",
      caption: "删除会移除邮件并停止收信。要停止银行卡自动续费，请另外在「我的账户」里取消订阅。",
      steps: [
        ["保存需要的邮件", "删除前，先在网页邮箱里导出"],
        ["打开「我的邮箱」", "找到对应邮箱，选择「删除」"],
        ["输入完整地址确认", "邮箱被移除，占用的名额归还兑换码"],
      ],
    },
    ai: {
      title: "AI 生成请求会发到哪里",
      alt: "AI 生成请求路径：相关功能需要的内容经 Cloudflare AI Gateway 发送给大模型服务商，目前为 DeepSeek；帮助检索与联网查询另见下文说明。",
      caption: "生成请求的路径示意。各项功能发送的内容不同；帮助检索与任务联网还涉及下文列出的其他服务。",
      steps: [
        ["功能需要的相关内容", "具体内容请看下方各项功能的说明"],
        ["Cloudflare AI Gateway", "转发生成请求"],
        ["大模型服务商 · 目前为 DeepSeek", "处理请求并生成结果"],
      ],
    },
  },
} as const satisfies Record<Lang, Record<string, Illustration>>;

export type IllustrationKey = keyof typeof illustrations.en;
export const illustrationHeight = (steps: number) => 148 + steps * 132;

export function helpIllustration(lang: Lang, key: IllustrationKey): { image: DocImage } {
  const { alt, caption, steps } = illustrations[lang][key];
  return {
    image: {
      src: `/help/images/${lang}-${key}.svg`,
      width: 720,
      height: illustrationHeight(steps.length),
      alt,
      caption,
    },
  };
}

/** Reuse the real, localized sample mailbox screenshots rather than drawing an imitation of the interface. */
export function helpScreenshot(lang: Lang, key: ScreenKey, alt: string, caption: string): { image: DocImage } {
  const screen = screens.find((screen) => screen.key === key)!;
  return {
    image: {
      src: screenSrc(lang, key, screen.width) as `/screens/${string}.webp`,
      srcSet: screenSrcSet(lang, screen),
      width: screen.width,
      height: screen.height,
      alt,
      caption,
    },
  };
}
