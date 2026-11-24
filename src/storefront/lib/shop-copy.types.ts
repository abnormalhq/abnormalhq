import type { en } from "./shop-copy.en.ts";

export type ShopCopyMessages = typeof en;

type TrialCopyMethods = {
  planSummary: (mb: number, domains: number) => string;
  paidPeriods: (count: number, days: number) => string;
  description: (days: number, mb: number) => string;
};

type ShopCopyMethods = {
  quantity: (n: number) => string;
  days: (n: number) => string;
  discount: (percent: number) => string;
  carriedAddress: (email: string) => string;
  planWithoutDomain: (domain: string) => string;
  couponApplied: (code: string) => string;
  couponWith: (code: string, price: string) => string;
  couponPriceLdc: (price: string) => string;
  couponPriceCard: (price: string) => string;
  orderCoupon: (code: string) => string;
  periodValue: (days: number) => string;
  renewAt: (price: string) => string;
  perPeriod: (days: number) => string;
  renewalPeriods: (periods: number, days: number) => string;
  periodsOption: (periods: number, days: number) => string;
  loginSent: (email: string) => string;
  signedInAs: (email: string) => string;
  confirmLoginAs: (email: string) => string;
  confirmLoginSwitch: (email: string) => string;
  claimedNotice: (n: number) => string;
  passwordRule: (min: number, max: number) => string;
  passwordLength: (min: number, max: number) => string;
  registerSent: (email: string) => string;
  forgotSent: (email: string) => string;
  resetFor: (email: string) => string;
  googleLinked: (email: string) => string;
  confirmRegisterAs: (email: string) => string;
  mailboxesUsed: (n: number, max: number) => string;
  mailboxesLeftValue: (n: number) => string;
  mailboxActions: (email: string) => string;
  mailboxPasswordSaved: (email: string) => string;
  mailboxEnabled: (email: string) => string;
  mailboxDisabled: (email: string) => string;
  mailboxDeleteWarning: (email: string) => string;
  mailboxDeleteConfirm: (email: string) => string;
  mailboxDeleted: (email: string) => string;
  mailboxCreated: (email: string) => string;
  mailServerLine: (kind: string, host: string, port: number, security: string) => string;
  cardPrice: (price: string, days: number) => string;
  cardPay: (amount: string) => string;
  usdtPrice: (price: string, days: number) => string;
  seatUsdtEach: (price: string, days: number) => string;
  seatTotalUsdt: (price: string, days: number) => string;
  couponPriceUsdt: (price: string) => string;
  usdtNetwork: (name: string, standard: string) => string;
  usdtChainOption: (name: string, standard: string) => string;
  usdtQr: (address: string) => string;
  usdtWarning: (amount: string, network: string) => string;
  usdtPartial: (received: string, amount: string, remaining: string) => string;
  usdtRenewAt: (price: string) => string;
  seatsQuoteUsdt: (n: number, price: string, date: string) => string;
  rateLimitedWait: (seconds: number) => string;
  seatUnit: (days: number) => string;
  seatCardEach: (price: string, days: number) => string;
  seatRenewAt: (price: string) => string;
  seatRange: (min: number, max: number) => string;
  seatTotalLdc: (price: string, days: number) => string;
  seatTotalCard: (price: string, days: number) => string;
  seatRenewsAt: (price: string, days: number) => string;
  couponSeatRange: (min: number, max: number) => string;
  couponSeatTotal: (amount: string) => string;
  seatDiscountNote: (percent: number) => string;
  seatCountValue: (min: number, max: number) => string;
  ownDomainsValue: (n: number) => string;
  seatsUsed: (used: number, total: number) => string;
  seatsPriceValue: (price: string, days?: number) => string;
  seatsAddRoom: (n: number) => string;
  seatsAtMax: (max: number) => string;
  seatsQuoteLdc: (n: number, price: string, date: string) => string;
  seatsQuoteCard: (n: number, price: string, date: string) => string;
  seatsQuoteAfter: (total: number, renew: string, days?: number) => string;
  seatsApplied: (n: number) => string;
  seatsRemoveRoom: (n: number) => string;
  seatsAtMin: (min: number) => string;
  seatsRemoveHint: (date: string) => string;
  seatsRemoveChoose: (n: number) => string;
  seatsRemoveChooseMore: (n: number) => string;
  seatsRemoveChooseFewer: (n: number) => string;
  seatsRemovalScheduled: (next: number, date: string) => string;
  seatsPending: (next: number, date: string) => string;
  domainsCount: (n: number, limit: number) => string;
  domainAdded: (name: string) => string;
  domainCopyName: (what: string) => string;
  domainOwnershipExpires: (date: string) => string;
  domainRemoved: (name: string) => string;
  domainCheckedAt: (date: string) => string;
  addressAdded: (address: string) => string;
  addressRemoved: (address: string) => string;
  groupSaved: (address: string) => string;
};

export type ShopCopy = Omit<ShopCopyMessages, keyof ShopCopyMethods | "trial"> &
  ShopCopyMethods & {
    trial: Omit<ShopCopyMessages["trial"], keyof TrialCopyMethods> & TrialCopyMethods;
  };

export const shopCopyArgumentNames = {
  "trial.planSummary": ["mb", "domains"],
  "trial.paidPeriods": ["count", "days"],
  "trial.description": ["days", "mb"],
  quantity: ["n"],
  days: ["n"],
  discount: ["percent"],
  carriedAddress: ["email"],
  planWithoutDomain: ["domain"],
  couponApplied: ["code"],
  couponWith: ["code", "price"],
  couponPriceLdc: ["price"],
  couponPriceCard: ["price"],
  orderCoupon: ["code"],
  periodValue: ["days"],
  renewAt: ["price"],
  perPeriod: ["days"],
  renewalPeriods: ["periods", "days"],
  periodsOption: ["periods", "days"],
  loginSent: ["email"],
  signedInAs: ["email"],
  confirmLoginAs: ["email"],
  confirmLoginSwitch: ["email"],
  claimedNotice: ["n"],
  passwordRule: ["min", "max"],
  passwordLength: ["min", "max"],
  registerSent: ["email"],
  forgotSent: ["email"],
  resetFor: ["email"],
  googleLinked: ["email"],
  confirmRegisterAs: ["email"],
  mailboxesUsed: ["n", "max"],
  mailboxesLeftValue: ["n"],
  mailboxActions: ["email"],
  mailboxPasswordSaved: ["email"],
  mailboxEnabled: ["email"],
  mailboxDisabled: ["email"],
  mailboxDeleteWarning: ["email"],
  mailboxDeleteConfirm: ["email"],
  mailboxDeleted: ["email"],
  mailboxCreated: ["email"],
  mailServerLine: ["kind", "host", "port", "security"],
  cardPrice: ["price", "days"],
  cardPay: ["amount"],
  usdtPrice: ["price", "days"],
  seatUsdtEach: ["price", "days"],
  seatTotalUsdt: ["price", "days"],
  couponPriceUsdt: ["price"],
  usdtNetwork: ["name", "standard"],
  usdtChainOption: ["name", "standard"],
  usdtQr: ["address"],
  usdtWarning: ["amount", "network"],
  usdtPartial: ["received", "amount", "remaining"],
  usdtRenewAt: ["price"],
  seatsQuoteUsdt: ["n", "price", "date"],
  rateLimitedWait: ["seconds"],
  seatUnit: ["days"],
  seatCardEach: ["price", "days"],
  seatRenewAt: ["price"],
  seatRange: ["min", "max"],
  seatTotalLdc: ["price", "days"],
  seatTotalCard: ["price", "days"],
  seatRenewsAt: ["price", "days"],
  couponSeatRange: ["min", "max"],
  couponSeatTotal: ["amount"],
  seatDiscountNote: ["percent"],
  seatCountValue: ["min", "max"],
  ownDomainsValue: ["n"],
  seatsUsed: ["used", "total"],
  seatsPriceValue: ["price", "days"],
  seatsAddRoom: ["n"],
  seatsAtMax: ["max"],
  seatsQuoteLdc: ["n", "price", "date"],
  seatsQuoteCard: ["n", "price", "date"],
  seatsQuoteAfter: ["total", "renew", "days"],
  seatsApplied: ["n"],
  seatsRemoveRoom: ["n"],
  seatsAtMin: ["min"],
  seatsRemoveHint: ["date"],
  seatsRemoveChoose: ["n"],
  seatsRemoveChooseMore: ["n"],
  seatsRemoveChooseFewer: ["n"],
  seatsRemovalScheduled: ["next", "date"],
  seatsPending: ["next", "date"],
  domainsCount: ["n", "limit"],
  domainAdded: ["name"],
  domainCopyName: ["what"],
  domainOwnershipExpires: ["date"],
  domainRemoved: ["name"],
  domainCheckedAt: ["date"],
  addressAdded: ["address"],
  addressRemoved: ["address"],
  groupSaved: ["address"],
} as const;
