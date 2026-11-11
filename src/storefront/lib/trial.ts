import { isCount, isString, isStrings, record, request, ShopApiError } from "./catalog.ts";
import type { Lang } from "../i18n.ts";

export type TrialOffer =
  | { claimed: true; orderId: string }
  | { claimed: false; days: number; quotaMb: number; domains: string[]; productName: string };

export async function getTrial(signal: AbortSignal, lang: Lang): Promise<TrialOffer | null> {
  const body = await request("account/trial", undefined, signal, lang);
  if (!record(body)) throw new ShopApiError("");
  const value = body.trial;
  if (value === null) return null;
  if (!record(value)) throw new ShopApiError("");
  if (value.claimed === true && isString(value.orderId) && /^[a-z0-9]{15}$/.test(value.orderId))
    return { claimed: true, orderId: value.orderId };
  if (
    value.claimed === false &&
    isCount(value.days) &&
    value.days >= 1 &&
    value.days <= 30 &&
    isCount(value.quotaMb) &&
    isStrings(value.domains) &&
    isString(value.productName)
  )
    return {
      claimed: false,
      days: value.days,
      quotaMb: value.quotaMb,
      domains: value.domains,
      productName: value.productName,
    };
  throw new ShopApiError("");
}

export async function claimTrial(lang: Lang): Promise<string> {
  const body = await request("account/trial", {}, undefined, lang);
  if (!record(body) || !isString(body.orderId) || !/^[a-z0-9]{15}$/.test(body.orderId)) throw new ShopApiError("");
  return body.orderId;
}

export const trialCopy = {
  en: {
    choosePlan: "Plan after your trial",
    keepPlan: "Keep the single-mailbox plan",
    chooseTeam:
      "Or choose a Team plan and its mailbox count. Your current mailbox counts as one seat; its address, password and mail stay the same.",
    seats: "Total mailboxes (including your current mailbox)",
    planSummary: (mb: number, domains: number) =>
      `${mb} MB per mailbox · ${domains} own domain${domains === 1 ? "" : "s"}`,
    paidPeriod: "Paid period",
    upgradeTitle: "Upgrade your trial mailbox.",
    upgradeOrder: "Trial upgrade",
    upgradeConfirm: "Confirm your upgrade.",
    upgradeCheck:
      "Check the plan, mailbox count and first-period discount below. Your current mailbox and mail stay in place. This payment does not enable automatic renewal.",
    upgradePaid: "Your mailbox has been upgraded.",
    upgradePaidDescription:
      "Your address and mail are kept. Open My account to manage your mailboxes, add the remaining Team mailboxes or connect your domain.",
    regularRenewal: "Later renewals use the regular plan price shown below.",
    estimate: "Total before discount",
    teamUpgrade: "Upgrade to single mailbox or Team",
    unavailable: "This trial is past its retention period and can no longer be upgraded here.",
    title: "Free trial",
    start: "Start free trial",
    starting: "Starting…",
    claimed: "Your free trial has been claimed. Set up your mailbox below.",
    description: (days: number, mb: number) =>
      `Try 1 mailbox with ${mb} MB for ${days} days, starting when you claim. One trial per verified account. No card required and no automatic charge.`,
    expiry:
      "The mailbox is suspended when the trial ends, and mail is kept for 30 days. Choose a single-mailbox or Team plan to upgrade and keep the same address and mail.",
    upgrade: "Upgrade this mailbox",
    manual:
      "This is a one-time payment. It does not turn on automatic renewal. Paid service starts when payment is confirmed.",
    card: "Pay by card",
    credits: "Pay with Linux DO Credit",
    signin: "Sign in to start your free trial",
    couponLabel: "Discount code (optional)",
    couponHint:
      "Applies to the first paid period of your trial upgrade only. Other periods and later renewals keep the regular price. The discount is shown on the order confirmation page before payment.",
  },
  zh: {
    choosePlan: "试用后套餐",
    keepPlan: "继续使用单邮箱套餐",
    chooseTeam: "也可选择 Team 套餐及邮箱数量。现有邮箱计入 1 个席位，地址、密码和邮件保持不变。",
    seats: "邮箱总数（包含现有邮箱）",
    planSummary: (mb: number, domains: number) => `每个邮箱 ${mb} MB · 可接入 ${domains} 个自有域名`,
    paidPeriod: "付费周期",
    upgradeTitle: "升级你的试用邮箱。",
    upgradeOrder: "试用升级",
    upgradeConfirm: "确认升级订单。",
    upgradeCheck: "请核对下方套餐、邮箱数量及首期优惠。原邮箱和邮件保留，本次付款不会开启自动续费。",
    upgradePaid: "邮箱已升级成功。",
    upgradePaidDescription: "原地址和邮件已保留。前往「我的账户」管理邮箱、开通其余 Team 邮箱或接入自有域名。",
    regularRenewal: "后续续费按下方套餐原价收取。",
    estimate: "优惠前合计",
    teamUpgrade: "升级为单邮箱或 Team",
    unavailable: "此试用已超过邮件保留期，无法在这里升级。",
    title: "免费试用",
    start: "开始免费试用",
    starting: "正在开通…",
    claimed: "已领取免费试用，请在下方设置邮箱。",
    description: (days: number, mb: number) =>
      `免费试用 1 个 ${mb} MB 邮箱，共 ${days} 天，自领取时起算。每个已验证账户限领一次，无需绑卡，不会自动扣款。`,
    expiry: "试用到期后邮箱停用，邮件保留 30 天。选择单邮箱或 Team 套餐付费升级，保留原地址及邮件。",
    upgrade: "升级此邮箱",
    manual: "本次为单次付款，不会开启自动续费。付费服务期从确认付款时起算。",
    card: "银行卡付款",
    credits: "Linux DO Credit 付款",
    signin: "登录并开始免费试用",
    couponLabel: "优惠码（选填）",
    couponHint: "仅抵扣试用升级的首个付费周期，其余周期和后续续费恢复原价。优惠金额会在付款前的订单确认页显示。",
  },
};
