import {
  createTranslationFacade,
  type DynamicMessageFormatters,
  type MessageTranslator,
} from "../i18n/translation-facade.ts";
import { withoutPeriod, type Copy, type Lang } from "./i18n.ts";
import { shopCopyArgumentNames, type ShopCopy } from "./lib/shop-copy.types.ts";

const onboardFormatters: DynamicMessageFormatters = {
  "steps.accounts.ordinal": (t, [n]) => t("steps.accounts.ordinal", { n: n as number }),
  "steps.accounts.usernameLabel": (t, [n]) => t("steps.accounts.usernameLabel", { n: n as number }),
  "steps.accounts.passwordLabel": (t, [n]) => t("steps.accounts.passwordLabel", { n: n as number }),
  "buttons.submit": (t, [count]) =>
    t("buttons.submit", { count: count as number, form: (count as number) > 1 ? "many" : "one" }),
  "msg.countHint": (t, [left, max]) =>
    t("msg.countHint", {
      left: left as number,
      limit: (left as number) > (max as number) ? "exceeded" : "within",
      max: max as number,
    }),
  "msg.rowsTrimmed": (t, [allowed, dropped]) =>
    t("msg.rowsTrimmed", {
      allowed: allowed as number,
      dropped: dropped as number,
      entryForm: dropped === 1 ? "one" : "other",
    }),
  "msg.usernameOk": (t, [email]) => t("msg.usernameOk", { email: email as string }),
  "msg.duplicateUsername": (t, [n]) => t("msg.duplicateUsername", { n: n as number }),
  "msg.partial": (t, [ok, failed]) => t("msg.partial", { ok: ok as number, failed: failed as number }),
  "msg.domainChanged": (t, [domain]) => t("msg.domainChanged", { domain: domain as string }),
  "result.title": (t, [count]) => t("result.title", { count: count as number }),
  "result.notified": (t, [to]) => t("result.notified", { to: to as string }),
  "result.notifyFailed": (t, [to, reason]) =>
    t("result.notifyFailed", {
      reason: typeof reason === "string" ? withoutPeriod(reason) : "",
      reasonForm: reason ? "withReason" : "withoutReason",
      to: to as string,
    }),
};

export function createOnboardCopyFacade(
  translator: MessageTranslator,
  source: Record<string, unknown>,
  locale: Lang,
): Copy {
  const formatters: DynamicMessageFormatters = {
    ...onboardFormatters,
    "msg.codeOk": (t, [domains, expires, left]) =>
      t("msg.codeOk", {
        domains: (domains as readonly string[]).map((domain) => `@${domain}`).join(locale === "en" ? " or " : "、"),
        expires: (expires as string | undefined) ?? "",
        expiry: expires ? "with" : "without",
        left: left as number,
      }),
    "msg.passwordMissing": (t, [labels]) =>
      t("msg.passwordMissing", { labels: (labels as readonly string[]).join(locale === "en" ? ", " : "、") }),
  };

  return createTranslationFacade<Copy>(translator, source, formatters);
}

type MessageValue = string | number | boolean;
type ExtraValues = Record<string, MessageValue>;
type Preprocessor = (args: readonly unknown[]) => ExtraValues;

const shopPreprocessors: Record<string, Preprocessor> = {
  "trial.planSummary": ([, domains]) => ({ domainForm: domains === 1 ? "one" : "other" }),
  "trial.paidPeriods": ([count, days]) => ({
    periodForm: count === 1 ? "one" : "other",
    totalDays: (count as number) * (days as number),
  }),
  orderCoupon: ([code]) => ({ codeForm: code ? "withCode" : "withoutCode" }),
  periodValue: ([days]) => ({ dayForm: days === 1 ? "one" : "other" }),
  perPeriod: ([days]) => ({ dayForm: days === 1 ? "one" : "other" }),
  renewalPeriods: ([periods, days]) => ({
    periodForm: periods === 1 ? "one" : "other",
    totalDays: (periods as number) * (days as number),
  }),
  periodsOption: ([periods, days]) => ({
    periodForm: periods === 1 ? "one" : "other",
    totalDays: (periods as number) * (days as number),
  }),
  claimedNotice: ([n]) => ({ orderForm: n === 1 ? "one" : "other" }),
  mailboxesLeftValue: ([n]) => ({ mailboxForm: n === 1 ? "one" : "other" }),
  cardPrice: ([, days]) => ({
    daysForm: (days as number) > 0 ? "active" : "inactive",
    dayForm: days === 1 ? "one" : "other",
  }),
  usdtPrice: ([, days]) => ({
    daysForm: (days as number) > 0 ? "active" : "inactive",
    dayForm: days === 1 ? "one" : "other",
  }),
  seatUsdtEach: ([, days]) => ({ daysForm: (days as number) > 0 ? "active" : "inactive" }),
  seatTotalUsdt: ([, days]) => ({ daysForm: (days as number) > 0 ? "active" : "inactive" }),
  seatsQuoteUsdt: ([n]) => ({ seatForm: n === 1 ? "one" : "other" }),
  rateLimitedWait: ([seconds]) => {
    const value = seconds as number;
    const unit = value < 60 ? "seconds" : value < 3600 ? "minutes" : "hours";
    const wait = unit === "seconds" ? value : unit === "minutes" ? Math.ceil(value / 60) : Math.ceil(value / 3600);
    return { unit, unitForm: wait === 1 ? unit.slice(0, -1) : unit, wait };
  },
  seatUnit: ([days]) => ({ daysForm: (days as number) > 0 ? "active" : "inactive" }),
  seatCardEach: ([, days]) => ({ daysForm: (days as number) > 0 ? "active" : "inactive" }),
  seatRange: ([min, max]) => ({ rangeForm: min === max ? "exact" : "range" }),
  seatTotalLdc: ([, days]) => ({ daysForm: (days as number) > 0 ? "active" : "inactive" }),
  seatTotalCard: ([, days]) => ({ daysForm: (days as number) > 0 ? "active" : "inactive" }),
  seatRenewsAt: ([, days]) => ({ dayForm: days === 1 ? "one" : "other" }),
  couponSeatRange: ([min, max]) => ({
    mailboxForm: min === 1 ? "one" : "other",
    rangeForm: min === max ? "exact" : "range",
  }),
  seatsPriceValue: ([, days]) => ({ daysForm: days ? "active" : "inactive", dayForm: days === 1 ? "one" : "other" }),
  seatsQuoteLdc: ([n]) => ({ seatForm: n === 1 ? "one" : "other" }),
  seatsQuoteCard: ([n]) => ({ seatForm: n === 1 ? "one" : "other" }),
  seatsQuoteAfter: ([, , days]) => ({ daysForm: days ? "active" : "inactive", dayForm: days === 1 ? "one" : "other" }),
  seatsAtMin: ([min]) => ({ seatForm: min === 1 ? "one" : "other" }),
  seatsRemoveChooseMore: ([n]) => ({ mailboxForm: n === 1 ? "one" : "other" }),
  seatsRemoveChooseFewer: ([n]) => ({ seatForm: n === 1 ? "one" : "other" }),
  seatsRemovalScheduled: ([next]) => ({ seatForm: next === 1 ? "one" : "other" }),
  seatsPending: ([next]) => ({ seatForm: next === 1 ? "one" : "other" }),
  domainsCount: ([, limit]) => ({ domainForm: limit === 1 ? "one" : "other" }),
};

const shopFormatters: DynamicMessageFormatters = Object.fromEntries(
  Object.entries(shopCopyArgumentNames).map(([key, names]): [string, DynamicMessageFormatters[string]] => [
    key,
    (translator: MessageTranslator, args: readonly unknown[]) => {
      const values: ExtraValues = {};
      names.forEach((name, index) => {
        const value = args[index];
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
          values[name] = value;
        }
      });
      Object.assign(values, shopPreprocessors[key]?.(args));
      return translator(key, values);
    },
  ]),
);

export function createShopCopyFacade(translator: MessageTranslator, source: Record<string, unknown>): ShopCopy {
  return createTranslationFacade<ShopCopy>(translator, source, shopFormatters);
}
