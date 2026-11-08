/**
 * 两种语言的片中文字。取自官网文案（src/i18n/zh.ts、en.ts）里首屏、流程与收尾的句子，
 * 官网文案改了这里要跟着改：视频不从 src/i18n 直接引用，是为了让这个工程不依赖官网的模块。
 */
export type Lang = "zh" | "en";

export interface VideoCopy {
  /** <html lang>，影响 Noto Sans SC 等字形的选择。 */
  htmlLang: string;
  dot: string;
  tagline: string;
  eyebrow: string;
  titleLines: readonly [string, string];
  description: string;
  mock: {
    overline: string;
    heading: string;
    inbox: string;
    starred: string;
    mails: readonly { title: string; body: string; time: string }[];
    domainNote: string;
  };
  stepsTitle: string;
  steps: readonly { title: string; description: string }[];
  valueLead: string;
  valueStrong: string;
  promises: readonly string[];
  closingLines: readonly [string, string];
  buy: string;
}

export const copies: Record<Lang, VideoCopy> = {
  zh: {
    htmlLang: "zh-CN",
    dot: "。",
    tagline: "Abnormally good.",
    eyebrow: "Email, made personal",
    titleLines: ["好用的邮箱，", "沟通更简单"],
    description: "注册账户，在线选购 @abnormal.bid 邮箱，在账户里直接开通和管理。",
    mock: {
      overline: "A LITTLE MORE CONNECTED",
      heading: "每一封，都有归处",
      inbox: "收件箱",
      starred: "星标邮件",
      mails: [
        { title: "新的连接，新的可能。", body: "让每一次沟通，都成为美好的开始。", time: "09:41" },
        { title: "关于我们的下一个计划", body: "灵感、想法，还有期待已久的好消息。", time: "昨天" },
        { title: "一切就绪，开始吧。", body: "你的日常，从一个顺手的邮箱开始。", time: "昨天" },
      ],
      domainNote: "你的名字，就是你的地址",
    },
    stepsTitle: "四步，开始使用你的邮箱",
    steps: [
      { title: "注册账户", description: "用邮箱和密码注册，订单与邮箱都在这里。" },
      { title: "选购套餐", description: "选邮箱数量与容量，在线付款。" },
      { title: "开通邮箱", description: "取用户名、设密码，直接开通。" },
      { title: "登录收发", description: "网页邮箱或邮件客户端，随时收发。" },
    ],
    valueLead: "少一点配置的麻烦。",
    valueStrong: "多一点沟通的从容。",
    promises: ["订单与邮箱一个账户管理", "付款后在账户里直接开通", "用户名自己取"],
    closingLines: ["下一封邮件，", "从这里开始"],
    buy: "购买邮箱",
  },
  en: {
    htmlLang: "en",
    dot: ".",
    tagline: "Abnormally good.",
    eyebrow: "Email, made personal",
    titleLines: ["Good email,", "simple conversations"],
    description: "Create an account, buy @abnormal.bid mailboxes online, and set them up from your account.",
    mock: {
      overline: "A LITTLE MORE CONNECTED",
      heading: "Every email has a home",
      inbox: "Inbox",
      starred: "Starred",
      mails: [
        { title: "New connections, new possibilities.", body: "Make every conversation a good start.", time: "09:41" },
        { title: "About our next plan", body: "Ideas, plans and the news we've waited for.", time: "Yesterday" },
        { title: "All set. Let's begin.", body: "Your day starts with a mailbox that just works.", time: "Yesterday" },
      ],
      domainNote: "Your name, your address",
    },
    stepsTitle: "Four steps to your mailbox",
    steps: [
      { title: "Create an account", description: "Sign up with an email and a password." },
      { title: "Choose a plan", description: "Pick how many mailboxes, and pay online." },
      { title: "Set up mailboxes", description: "Choose a username, set a password, done." },
      { title: "Sign in and send", description: "Webmail or the mail app you already use." },
    ],
    valueLead: "Less setup hassle.",
    valueStrong: "More time to talk.",
    promises: ["Orders and mailboxes in one account", "Set up in your account once paid", "Pick your own username"],
    closingLines: ["Your next email", "starts here"],
    buy: "Buy a mailbox",
  },
};
