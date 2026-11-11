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
    title: "Free trial",
    start: "Start free trial",
    starting: "Starting…",
    claimed: "Your free trial has been claimed. Set up your mailbox below.",
    description: (days: number, mb: number) =>
      `Try 1 mailbox with ${mb} MB for ${days} days, starting when you claim. One trial per verified account. No card required and no automatic charge.`,
    expiry:
      "The mailbox is suspended when the trial ends, and mail is kept for 30 days. Pay to upgrade and keep the same address and mail.",
    upgrade: "Upgrade this mailbox",
    manual:
      "This is a one-time payment. It does not turn on automatic renewal. Paid service starts when payment is confirmed.",
    card: "Pay by card",
    credits: "Pay with Linux DO Credit",
    signin: "Sign in to start your free trial",
  },
  zh: {
    title: "免费试用",
    start: "开始免费试用",
    starting: "正在开通…",
    claimed: "已领取免费试用，请在下方设置邮箱。",
    description: (days: number, mb: number) =>
      `免费试用 1 个 ${mb} MB 邮箱，共 ${days} 天，自领取时起算。每个已验证账户限领一次，无需绑卡，不会自动扣款。`,
    expiry: "试用到期后邮箱停用，邮件保留 30 天。主动付费升级即可保留原地址及邮件。",
    upgrade: "升级此邮箱",
    manual: "本次为单次付款，不会开启自动续费。付费服务期从确认付款时起算。",
    card: "银行卡付款",
    credits: "Linux DO Credit 付款",
    signin: "登录并开始免费试用",
  },
};
