/** The redeem page's copy in Chinese (the type is Copy in i18n.ts). */
import { homepage, supportEmail, webmailUrl } from "./config.ts";
import { withoutPeriod, type Copy } from "./i18n.ts";

/** Static help copy uses the shared portal; activation results use the entry returned by the backend instead. */
const webmailLinkZh = `[Abnormal 网页邮箱](${webmailUrl})`;

const usernameRuleZh = "用户名只能是小写字母、数字和 . _ -，首尾必须是字母或数字，不能有连续的点，最多 64 位。";

export const zh: Copy = {
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
              "第一次注册还要验证手机号：填你自己的手机号，输入短信收到的 6 位数字验证码。只验这一次。",
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
