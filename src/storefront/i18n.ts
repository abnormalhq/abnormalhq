/**
 * All copy in both languages: pages (build time) and client components (runtime) share this one copy.
 * Tone follows the design system's content guidelines: short sentences ending in full stops, no exclamation marks or emoji; full-width punctuation in Chinese; product names are not translated.
 */
import { homepage, supportEmail, webmailUrl } from "./config.ts";

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

/** Static help copy uses the shared portal; activation results use the entry returned by the backend instead. */
const webmailLinkZh = `[Abnormal 网页邮箱](${webmailUrl})`;
const webmailLinkEn = `[Abnormal webmail](${webmailUrl})`;

/** The server's reason ends in a full stop; drop it when embedding mid-sentence, so two punctuation marks do not touch. */
function withoutPeriod(reason: string): string {
  return reason.replace(/[。.]\s*$/, "");
}

const usernameRuleZh = "用户名只能是小写字母、数字和 . _ -，首尾必须是字母或数字，不能有连续的点，最多 64 位。";
const usernameRuleEn =
  "Usernames use lowercase letters, digits and . _ -, start and end with a letter or digit, have no two dots in a row, and are at most 64 characters.";

const zh: Copy = {
  title: "兑换邮箱 · Abnormal",
  description:
    "使用 Linux DO Credit 购买 @abnormalhq.com 邮箱套餐，或凭已有兑换码在其允许的域名下开通邮箱。自己取用户名、设密码，开通即用。",
  eyebrow: "邮箱开通",
  titleLines: ["一个兑换码。", "一个新邮箱"],
  titleDot: "。",
  tagline: "输入兑换码，取一个用户名，设一个密码。还没有兑换码？可以先选购邮箱套餐。",
  ui: {
    formTitle: "开启你的新邮箱",
    formDescription: "从一个兑换码开始，接下来交给我们。",
    formBadge: "即刻开通",
    optional: "选填",
    username: "用户名",
    password: "密码",
    passwordPlaceholder: "设置你的邮箱密码",
    features: ["自定义邮箱名", "支持邮件客户端", "开通即可使用"],
    guideTitle: "新邮箱，下一步。",
    guideDescription: "从第一封邮件开始。了解如何登录、配置客户端，以及接收登录验证码。",
    guideLink: "阅读使用教程",
    reminderTitle: "记得保存你的密码",
    reminderDescription: "密码只在开通后显示一次。也可以填写接收邮箱，给自己留一份账号信息。",
    supportTitle: "需要一点帮助？",
    supportDescription: "兑换遇到问题，随时联系我们。",
  },
  steps: {
    code: {
      label: "兑换码",
      hint: "由 Abnormal 管理员发放，16 位字母和数字，不分大小写。",
      placeholder: "XXXX-XXXX-XXXX-XXXX",
    },
    options: {
      label: "域名与数量",
      hint: "兑换码允许哪些域名、还能开通几个邮箱，核对后在这里选。",
      domain: "域名",
      count: "开通几个",
    },
    accounts: {
      label: "账号",
      hint: "每个邮箱一行。用户名是小写字母、数字和 . _ -，首尾必须是字母或数字，最多 64 位；密码为 8–128 个字符，不能包含空白，也可以随机生成。",
      placeholder: "yourname",
      ordinal: (n) => `第 ${n} 个邮箱`,
      usernameLabel: (n) => `第 ${n} 个邮箱的用户名`,
      passwordLabel: (n) => `第 ${n} 个邮箱的密码`,
      noQuota: "此域名暂未提供单邮箱配额，容量以服务器设置为准。",
    },
    notify: {
      label: "接收邮箱",
      hint: "可选。填一个你现在能收信的邮箱，开通后把新邮箱的地址、密码与服务器地址发到那里一份。",
      placeholder: "you@example.com",
    },
  },
  rules: {
    length: "至少 8 位",
  },
  buttons: {
    show: "显示",
    hide: "隐藏",
    generate: "随机生成",
    submit: (count) => (count > 1 ? `开通 ${count} 个邮箱` : "开通邮箱"),
    submitting: "开通中…",
    copy: "复制",
    copied: "已复制",
    copyAll: "复制全部",
    openWebmail: "打开网页邮箱",
  },
  submitNote: "开通后密码只显示一次，请立即保存。",
  noscript: "这个页面需要启用 JavaScript 才能兑换。",
  msg: {
    codeChecking: "正在核对兑换码…",
    codeIncomplete: "兑换码是 16 位字母和数字，请检查是否输完整。",
    codeRequired: "请先输入兑换码。",
    codeOk: (domains, expires, left) =>
      `可以使用，可开通 ${domains.map((d) => `@${d}`).join("、")} 邮箱，还能开通 ${left} 个${expires ? `，${expires} 前有效` : ""}。`,
    countHint: (left, max) =>
      left > max ? `这个兑换码还能开通 ${left} 个邮箱，一次最多 ${max} 个。` : `这个兑换码还能开通 ${left} 个邮箱。`,
    rowsTrimmed: (allowed, dropped) =>
      `这个兑换码只能再开通 ${allowed} 个邮箱，已去掉多填的 ${dropped} 个；核对后再提交。`,
    usernameChecking: "正在检查是否可用…",
    usernameOk: (email) => `${email} 可以用。`,
    duplicateUsername: (n) => `与第 ${n} 个邮箱的用户名重复。`,
    passwordMissing: (labels) => `还需要：${labels.join("、")}。`,
    passwordOk: "密码符合要求。",
    passwordGenerated: "已生成一个随机密码，记得保存。",
    partial: (ok, failed) => `已开通 ${ok} 个；还有 ${failed} 个没成功，改好后再提交。`,
    challengePending: "开通前要先完成人机验证，正在验证；完成后再提交一次。",
    domainChanged: (domain) => `这个兑换码开通的是 @${domain} 邮箱，地址已更新；核对后再提交一次。`,
    networkError: "连不上服务器，请稍后再试。",
    unknownError: "出了点问题，请稍后再试。",
  },
  problem: {
    username: { required: "请输入用户名。", invalid: usernameRuleZh },
    password: {
      required: "请设置密码。",
      too_long: "密码最多 128 个字符。",
      whitespace: "密码不能包含空白字符。",
      weak: "密码至少 8 个字符。",
    },
    notify: {
      invalid: "请填写完整的邮箱地址，例如 you@example.com。",
      too_long: "邮箱地址最多 254 个字符。",
    },
  },
  kind: {
    invalid_code: "这个兑换码不存在，请检查后重试。",
    code_used: "这个兑换码已经用完了。",
    code_expired: "这个兑换码已过期。",
    code_disabled: "这个兑换码已停用。",
    count_exceeded: "超过了这个兑换码还能开通的邮箱数量。",
    domain_invalid: "这个兑换码不能开通该域名的邮箱。",
    username_invalid: usernameRuleZh,
    username_taken: "这个用户名已被占用，换一个试试。",
    password_invalid: "密码为 8–128 个字符，不能包含空白字符。",
    notify_invalid: "接收邮箱的地址不正确，请检查后重试。",
    rate_limited: "试得太频繁了，请稍后再试。",
    challenge_failed: "人机验证没有通过，请等验证完成后再提交；一直失败请刷新页面。",
    unavailable: "邮件服务暂时不可用，请稍后再试。",
  },
  result: {
    eyebrow: "已开通",
    title: (count) => `已开通 ${count} 个邮箱`,
    login: "登录名",
    loginNote: "邮件客户端里的用户名就是完整邮箱地址",
    imap: "IMAP 收信",
    smtp: "SMTP 发信",
    port: "端口",
    security: { tls: "SSL/TLS", starttls: "STARTTLS", none: "不加密" },
    notified: (to) => `账号信息已发送到 ${to}，请查收。`,
    notifyFailed: (to, reason) =>
      `没能把账号信息发送到 ${to}${reason ? `：${withoutPeriod(reason)}` : ""}。请在这里保存好。`,
    note: ["密码只在这里显示一次，请保存好。之后可在网页邮箱的「设置」中修改；忘记密码请写信到 ", "。"],
    next: "开通之后怎么登录邮箱、怎么用它登录 Claude 与 ChatGPT，看[教程](guide/)。",
    again: "再兑换",
  },
  help: {
    eyebrow: "常见问题",
    title: "关于兑换。",
    items: [
      {
        q: "兑换码从哪里来？",
        a: "可以[选购邮箱套餐](shop/)，使用 Linux DO Credit 支付后领取；也可以使用管理员发放的兑换码。输入后会显示还能开通几个邮箱；用完、过期或停用的兑换码，输入时就会提示。",
      },
      {
        q: "一个兑换码能开通几个邮箱？",
        a: "以购买套餐或管理员发放时的设置为准。允许多个时，核对后可以选择数量，每个邮箱各自填用户名与密码，一次开通；也可以分几次开通，每次用同一个兑换码。",
      },
      {
        q: "用户名有什么要求？",
        a: "小写字母、数字和 . _ -，首尾必须是字母或数字，最多 64 位。已被占用的用户名会在输入时提示，换一个即可。",
      },
      {
        q: "密码有什么要求？",
        a: "8–128 个字符，不能包含空白字符。点「随机生成」可以得到一个 16 位的随机密码，记得保存。",
      },
      {
        q: "开通后怎么收发邮件？",
        a: `可以登录 ${webmailLinkZh}，也可以使用支持 IMAP / SMTP 的邮件客户端。登录名是完整的邮箱地址，服务器地址、端口与加密方式以开通结果为准。详细步骤在[教程](guide/)。`,
      },
      {
        q: "能用它注册 Claude 或 ChatGPT 吗？",
        a: "可以，它就是一个普通邮箱：注册时填这个地址，验证码或登录链接会发到这里，到网页邮箱或邮件客户端里收。步骤在[教程](guide/)。",
      },
      {
        q: "能把账号信息发到我的邮箱吗？",
        a: "可以。开通前在「接收邮箱」里填一个你现在能收信的地址，开通后新邮箱的地址、密码与服务器地址会发到那里一份；没填就只在页面上显示。",
      },
      {
        q: "忘记密码怎么办？",
        a: "密码只在开通时显示一次。忘记了请写信告知邮箱地址与兑换码，由管理员重置。",
      },
    ],
    contact: ["其他问题，写信到 ", "。"],
  },
  footer: {
    links: [
      { label: "官网", href: homepage.zh },
      { label: "网页邮箱", href: webmailUrl },
      { label: supportEmail, href: `mailto:${supportEmail}` },
    ],
  },
  guide: {
    title: "开通之后 · Abnormal",
    description:
      "邮箱开通之后怎么用：登录网页邮箱、在手机或电脑的邮件客户端里收发，以及用它注册并登录 Claude 与 ChatGPT。",
    back: "返回兑换页",
    eyebrow: "邮箱使用指南",
    heading: "开通之后。",
    contents: "本页目录",
    backToTop: "回到顶部",
    lede: "邮箱已经在手里了。这一页说三件事：怎么登录邮箱，怎么在常用的邮件客户端里收发，怎么用它注册并登录 Claude 与 ChatGPT。",
    sections: [
      {
        title: "登录名与密码",
        blocks: [
          {
            p: "在任何地方登录这个邮箱，**登录名都是完整的邮箱地址**（例如 yourname@abnormalhq.com），密码是开通时设的那一个。既有 @abnormal.bid 邮箱继续使用原地址登录。",
          },
          {
            p: `密码只在开通时显示一次。忘了就写信到 [${supportEmail}](mailto:${supportEmail})，告知邮箱地址与当时用的兑换码，由管理员重置。`,
          },
          {
            p: "记得当前密码时，可在网页邮箱右上角的「设置」中修改密码。修改成功后需要重新登录，并更新邮件客户端里保存的密码。",
          },
          {
            p: "IMAP 与 SMTP 服务器地址在开通成功的页面上列着；开通时填过接收邮箱的话，账号信息邮件里也有同一份。",
          },
        ],
      },
      {
        title: "网页邮箱",
        blocks: [
          {
            p: `点击开通结果中的「打开网页邮箱」，或直接访问 ${webmailLinkZh}。登录名是完整邮箱地址，密码是开通时设置的邮箱密码。邮件由自建 Stalwart 服务器收发与存储，网页邮箱与邮件客户端使用同一个邮箱。`,
          },
          {
            p: "手机浏览器里也能用；要经常在手机上收信，还是按下一节配一次邮件客户端。",
          },
        ],
      },
      {
        title: "邮件客户端",
        blocks: [
          {
            p: "iPhone 与 Mac 自带的「邮件」、Gmail、Outlook、Thunderbird 都可以，走的是同一套 IMAP / SMTP 设置。各家的入口叫法不同，都在「添加账户」里选「其他」或「手动设置」，然后照开通页列出的地址填：",
          },
          {
            ol: [
              "邮箱地址与密码：完整地址，开通时设的密码。",
              "收信服务器（IMAP）：按开通结果填写主机名、端口和加密方式；用户名同样是完整地址。",
              "发信服务器（SMTP）：按开通结果填写主机名、端口和加密方式；勾上「需要认证」，用户名与密码与收信相同。",
              "保存后发一封信给自己，收到即配好。",
            ],
          },
          {
            p: "iPhone / iPad 的路径是：设置 → 邮件 → 账户 → 添加账户 → 其他 → 添加邮件账户；填完地址与密码后选 IMAP，再填两台服务器。",
          },
          {
            p: "各个客户端的分步说明在[帮助中心](help/)：[Apple 邮件](help/apple-mail/)（可用描述文件一步配好）、[Outlook](help/outlook/)、[Thunderbird](help/thunderbird/)、[Gmail 与 Android](help/gmail-android/)，以及[两步验证与应用专用密码](help/two-step-verification/)。",
          },
        ],
      },
      {
        title: "用它登录 Claude",
        blocks: [
          { p: "Claude 用邮件登录，没有密码；这个邮箱就是钥匙。" },
          {
            ol: [
              "打开 [claude.ai](https://claude.ai/)，选「Continue with email」，填入新邮箱地址。",
              "到邮箱里收一封主题为「Secure link to log in to Claude.ai」的邮件，点里面的「Sign in with Claude.ai」。在同一台设备上点开会直接登录；在别的设备上点开会显示一个验证码，回到原来的设备填上。",
              "第一次注册还要验证手机号：填一个能收短信的普通手机号，输入收到的 6 位数字验证码。只验这一次；网络电话与固话不行，一个号码最多绑 3 个账号，绑定后不能改。",
              "之后每次登录重复前两步即可。",
            ],
          },
        ],
      },
      {
        title: "用它登录 ChatGPT",
        blocks: [
          {
            ol: [
              "打开 [chatgpt.com](https://chatgpt.com/)，点「Sign up」，填入新邮箱地址，继续。已经注册过就点「Log in」。",
              "按提示设一个密码（至少 12 位）。",
              "到邮箱里取 6 位数字的验证码填回去。邮件来自 noreply@tm.openai.com 或 otp@tm1.openai.com，验证码很快过期，用最新的一封。",
              "填名字与生日，就可以用了。之后在新设备或新地点登录时它可能再发一次验证码到这个邮箱，同样处理。",
            ],
          },
        ],
      },
      {
        title: "收不到验证码？",
        blocks: [
          {
            ul: [
              "等一两分钟，刷新收件箱；再看一眼垃圾邮件。",
              "确认在对方那里填的是完整地址，没有拼错。",
              "点「重新发送」，只用最新的那一封；旧的验证码已经失效。",
              `还是没有，写信到 [${supportEmail}](mailto:${supportEmail})，说明邮箱地址与时间。`,
            ],
          },
          {
            p: "Claude 与 ChatGPT 都只在它们列出的地区提供服务，页面打不开或提示所在地区不支持时，先看 [Anthropic 的支持地区](https://www.anthropic.com/supported-countries) 与 [OpenAI 的支持地区](https://help.openai.com/en/articles/7947663-chatgpt-supported-countries)。",
          },
        ],
      },
    ],
  },
};

const en: Copy = {
  title: "Redeem a mailbox · Abnormal",
  description:
    "Buy an @abnormalhq.com mailbox plan with Linux DO Credit, or redeem an existing code for a mailbox on one of its allowed domains. Pick your username and password, then start using your mail.",
  eyebrow: "New mailbox",
  titleLines: ["One code.", "One new mailbox"],
  titleDot: ".",
  tagline: "Enter your code, pick a username, set a password. Need a code? Choose a mailbox plan first.",
  ui: {
    formTitle: "Make room for your new mail",
    formDescription: "Start with your code. We’ll take it from here.",
    formBadge: "Ready right away",
    optional: "Optional",
    username: "Username",
    password: "Password",
    passwordPlaceholder: "Create your mailbox password",
    features: ["Your own username", "Works with mail apps", "Ready right away"],
    guideTitle: "New mailbox. What’s next?",
    guideDescription:
      "Start with your first email. Learn to sign in, set up a mail app, and receive verification codes.",
    guideLink: "Read the getting-started guide",
    reminderTitle: "Keep your password safe",
    reminderDescription:
      "Your password is shown once after creation. Add an email address to send yourself a copy of the account details.",
    supportTitle: "Need a hand?",
    supportDescription: "If you get stuck, we’re an email away.",
  },
  steps: {
    code: {
      label: "Code",
      hint: "Issued by an Abnormal admin. 16 letters and digits, case does not matter.",
      placeholder: "XXXX-XXXX-XXXX-XXXX",
    },
    options: {
      label: "Domain and count",
      hint: "Which domains the code allows and how many mailboxes it has left. Choose here once it is checked.",
      domain: "Domain",
      count: "How many",
    },
    accounts: {
      label: "Accounts",
      hint: "One line per mailbox. Usernames use lowercase letters, digits and . _ -, start and end with a letter or digit, at most 64 characters. Passwords need 8–128 characters with no whitespace, or let us generate one.",
      placeholder: "yourname",
      ordinal: (n) => `Mailbox ${n}`,
      usernameLabel: (n) => `Username for mailbox ${n}`,
      passwordLabel: (n) => `Password for mailbox ${n}`,
      noQuota: "Per-mailbox quota is unavailable for this domain; storage follows the server settings.",
    },
    notify: {
      label: "Email a copy",
      hint: "Optional. An address you can read right now. Once the mailboxes are created, their addresses, passwords and server settings are sent there.",
      placeholder: "you@example.com",
    },
  },
  rules: {
    length: "8+ characters",
  },
  buttons: {
    show: "Show",
    hide: "Hide",
    generate: "Generate",
    submit: (count) => (count > 1 ? `Create ${count} mailboxes` : "Create mailbox"),
    submitting: "Creating…",
    copy: "Copy",
    copied: "Copied",
    copyAll: "Copy all",
    openWebmail: "Open webmail",
  },
  submitNote: "Passwords are shown once, right after creation. Save them then.",
  noscript: "This page needs JavaScript to redeem a code.",
  msg: {
    codeChecking: "Checking the code…",
    codeIncomplete: "A code is 16 letters and digits. Check that it is complete.",
    codeRequired: "Enter your code first.",
    codeOk: (domains, expires, left) =>
      `Valid. It creates mailboxes at ${domains.map((d) => `@${d}`).join(" or ")}, ${left} left${expires ? `, until ${expires}` : ""}.`,
    countHint: (left, max) =>
      left > max ? `This code can create ${left} more, up to ${max} at a time.` : `This code can create ${left} more.`,
    rowsTrimmed: (allowed, dropped) =>
      `This code can create only ${allowed} more, so ${dropped} filled ${dropped === 1 ? "entry was" : "entries were"} removed. Check the form, then submit.`,
    usernameChecking: "Checking availability…",
    usernameOk: (email) => `${email} is available.`,
    duplicateUsername: (n) => `Same username as mailbox ${n}.`,
    passwordMissing: (labels) => `Still needs ${labels.join(", ")}.`,
    passwordOk: "The password meets the requirements.",
    passwordGenerated: "A random password was generated. Remember to save it.",
    partial: (ok, failed) => `${ok} created. ${failed} did not go through; fix them and submit again.`,
    challengePending: "A quick human check has to finish first. It is running now; submit again once it is done.",
    domainChanged: (domain) =>
      `This code creates mailboxes at @${domain}, and the addresses now show it. Check them, then submit again.`,
    networkError: "Could not reach the server. Try again in a moment.",
    unknownError: "Something went wrong. Try again in a moment.",
  },
  problem: {
    username: { required: "Enter a username.", invalid: usernameRuleEn },
    password: {
      required: "Set a password.",
      too_long: "Passwords are at most 128 characters.",
      whitespace: "Passwords cannot contain whitespace.",
      weak: "Use at least 8 characters.",
    },
    notify: {
      invalid: "Enter a full email address, like you@example.com.",
      too_long: "Email addresses are at most 254 characters.",
    },
  },
  kind: {
    invalid_code: "This code does not exist. Check it and try again.",
    code_used: "This code has been used up.",
    code_expired: "This code has expired.",
    code_disabled: "This code has been disabled.",
    count_exceeded: "That is more mailboxes than this code has left.",
    domain_invalid: "This code cannot create a mailbox at that domain.",
    username_invalid: usernameRuleEn,
    username_taken: "This username is taken. Try another one.",
    password_invalid: "Use 8–128 characters with no whitespace.",
    notify_invalid: "That email address does not look right. Check it and try again.",
    rate_limited: "Too many attempts. Try again in a moment.",
    challenge_failed: "The human check did not pass. Wait for it to finish and submit again, or reload the page.",
    unavailable: "The mail service is temporarily unavailable. Try again in a moment.",
  },
  result: {
    eyebrow: "Ready",
    title: (count) => `${count} mailboxes created`,
    login: "Login",
    loginNote: "In mail apps the username is the full address",
    imap: "IMAP (incoming)",
    smtp: "SMTP (outgoing)",
    port: "port",
    security: { tls: "SSL/TLS", starttls: "STARTTLS", none: "no encryption" },
    notified: (to) => `The account details were sent to ${to}.`,
    notifyFailed: (to, reason) =>
      `Could not send the account details to ${to}${reason ? ` (${withoutPeriod(reason)})` : ""}. Save them from this page instead.`,
    note: [
      "Passwords are shown only here, only once. Change yours in webmail Settings; if you forget it, write to ",
      ".",
    ],
    next: "For what comes next, from logging in to the mailbox to using it for Claude and ChatGPT, see the [guide](guide/).",
    again: "Redeem again",
  },
  help: {
    eyebrow: "Questions",
    title: "About redeeming.",
    items: [
      {
        q: "Where do codes come from?",
        a: "[Choose a mailbox plan](shop/) and pay with Linux DO Credit to collect a code, or use a code from an admin. The page shows how many mailboxes remain once you enter it. A used, expired or disabled code is flagged right away.",
      },
      {
        q: "How many mailboxes does a code create?",
        a: "Your purchased plan or the admin’s settings determine the count. When a code allows several, pick the count after the check and fill in a username and password for each. You can also come back later and use the same code again.",
      },
      {
        q: "What can a username be?",
        a: "Lowercase letters, digits and . _ -, starting and ending with a letter or digit, up to 64 characters. Taken usernames are flagged as you type.",
      },
      {
        q: "What does the password need?",
        a: "8–128 characters with no whitespace. Generate gives you a random 16-character one. Save it.",
      },
      {
        q: "How do I read and send mail?",
        a: `Sign in to ${webmailLinkEn}, or use a mail app that supports IMAP and SMTP. The login is your full email address. Use the server addresses, ports and security settings shown after creation. Step by step in the [guide](guide/).`,
      },
      {
        q: "Can I use it to sign up for Claude or ChatGPT?",
        a: "Yes. It is an ordinary mailbox: enter this address when signing up, and the code or login link lands here, in webmail or your mail app. The steps are in the [guide](guide/).",
      },
      {
        q: "Can I get the details by email?",
        a: "Yes. Before you submit, fill in Email a copy with an address you can read now. Once the mailboxes are created, their addresses, passwords and server settings are sent there. Leave it empty and they are shown only on this page.",
      },
      {
        q: "I forgot the password.",
        a: "It is shown only once, at creation. Write to us with the address and the code you used, and an admin resets it.",
      },
    ],
    contact: ["Anything else, write to ", "."],
  },
  footer: {
    links: [
      { label: "Website", href: homepage.en },
      { label: "Webmail", href: webmailUrl },
      { label: supportEmail, href: `mailto:${supportEmail}` },
    ],
  },
  guide: {
    title: "After you redeem · Abnormal",
    description:
      "What to do with the new mailbox: log in to webmail, set it up in a mail app on your phone or computer, and use it to sign up for and log in to Claude and ChatGPT.",
    back: "Back to redeem",
    eyebrow: "The mailbox guide",
    heading: "After you redeem.",
    contents: "On this page",
    backToTop: "Back to top",
    lede: "The mailbox is yours. This page covers three things: how to log in to it, how to read and send from the usual mail apps, and how to use it to sign up for and log in to Claude and ChatGPT.",
    sections: [
      {
        title: "Login and password",
        blocks: [
          {
            p: "Wherever you log in to this mailbox, **the login is the full address** (yourname@abnormalhq.com, for example) and the password is the one you set when redeeming. Existing @abnormal.bid mailboxes continue to use their original address to sign in.",
          },
          {
            p: `The password is shown only once, at creation. If you lose it, write to [${supportEmail}](mailto:${supportEmail}) with the address and the code you used, and an admin resets it.`,
          },
          {
            p: "If you know your current password, change it in Settings at the top right of webmail. After a successful change, sign in again and update the saved password in your mail apps.",
          },
          {
            p: "The IMAP and SMTP servers are listed on the page right after creation; if you filled in Email a copy, the account email has the same details.",
          },
        ],
      },
      {
        title: "Webmail",
        blocks: [
          {
            p: `Use Open webmail in your creation result, or visit ${webmailLinkEn}. Sign in with your full email address and the password you set. Our self-hosted Stalwart server sends, receives and stores your mail; webmail and mail apps access the same mailbox.`,
          },
          {
            p: "It works in a phone browser as well; if you read mail on your phone often, set up a mail app once, as in the next section.",
          },
        ],
      },
      {
        title: "Mail apps",
        blocks: [
          {
            p: "Apple Mail on iPhone and Mac, Gmail, Outlook and Thunderbird all work, with the same IMAP and SMTP settings. The entry point differs by app, but it is always Add account, then Other or Manual setup. Then fill in what the page after creation listed:",
          },
          {
            ol: [
              "Address and password: the full address, and the password you set.",
              "Incoming server (IMAP): use the host, port and security settings shown after creation; the username is the full address again.",
              "Outgoing server (SMTP): use the host, port and security settings shown after creation; turn on authentication, same username and password as incoming.",
              "Save, then send yourself a message. When it arrives, you are done.",
            ],
          },
          {
            p: "On iPhone and iPad the path is Settings → Mail → Accounts → Add Account → Other → Add Mail Account; after the address and password, choose IMAP and fill in the two servers.",
          },
          {
            p: "Step-by-step instructions for each app are in the [help center](help/): [Apple Mail](help/apple-mail/) (with a one-step configuration profile), [Outlook](help/outlook/), [Thunderbird](help/thunderbird/), [Gmail and Android](help/gmail-android/), and [two-step verification and app passwords](help/two-step-verification/).",
          },
        ],
      },
      {
        title: "Logging in to Claude",
        blocks: [
          {
            p: "Claude logs you in by email; there is no password. This mailbox is the key.",
          },
          {
            ol: [
              "Open [claude.ai](https://claude.ai/), choose Continue with email and enter the new address.",
              "In the mailbox, open the message titled Secure link to log in to Claude.ai and click Sign in with Claude.ai. On the same device it logs you straight in; on another device it shows a code to type on the device you started from.",
              "The first time, Claude also verifies a phone number: enter a regular mobile number that receives texts and type the six-digit code it sends. This happens once. VoIP and landline numbers do not work, a number can verify at most three accounts, and it cannot be changed afterwards.",
              "Every later login is just the first two steps.",
            ],
          },
        ],
      },
      {
        title: "Logging in to ChatGPT",
        blocks: [
          {
            ol: [
              "Open [chatgpt.com](https://chatgpt.com/), click Sign up, enter the new address and continue. If you already have an account, click Log in.",
              "Set a password when asked (at least 12 characters).",
              "Fetch the six-digit code from the mailbox and type it in. The email comes from noreply@tm.openai.com or otp@tm1.openai.com; codes expire quickly, so use the latest one.",
              "Enter your name and birthday, and you are in. When you later log in from a new device or place, it may send another code to this mailbox; handle it the same way.",
            ],
          },
        ],
      },
      {
        title: "No code arriving?",
        blocks: [
          {
            ul: [
              "Wait a minute or two and refresh the inbox; check the spam folder too.",
              "Make sure you typed the full address on their side, with no typos.",
              "Click Resend and use only the newest message; older codes are already void.",
              `Still nothing? Write to [${supportEmail}](mailto:${supportEmail}) with the address and the time.`,
            ],
          },
          {
            p: "Claude and ChatGPT are offered only in the regions they list. If the page does not open or says your region is not supported, check [Anthropic's supported regions](https://www.anthropic.com/supported-countries) and [OpenAI's supported countries](https://help.openai.com/en/articles/7947663-chatgpt-supported-countries).",
          },
        ],
      },
    ],
  },
};

export const copy: Record<Lang, Copy> = { zh, en };

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
