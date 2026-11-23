/**
 * The price calculator on the home page and the pricing page: how many mailboxes, and what each plan that sells that many costs
 * in total. A plan sold per mailbox fits any count in its range; a fixed plan fits its own count. The totals are worked out
 * the way the shop works out its fallback (seatTotals: the plan's discount on the whole order, rounded once), so they are
 * shown as an estimate: the shop asks mail for the order's price before checkout, and mail's is the one charged.
 * Like pricing.ts, this takes the copy as an argument and must not use TypeScript syntax Node cannot run directly.
 */
import type { Lang } from "../data/site.ts";
import type { Copy } from "../i18n/types.ts";
import {
  catalogPlans,
  formatCredits,
  formatMoney,
  isSeatProduct,
  seatTotals,
  type ShopCatalog,
  type ShopProduct,
  type SeatProduct,
  shopHref,
} from "../storefront/index.ts";
import { fillText, planView } from "./pricing.ts";

type PricingCopy = Pick<Copy["pricing"], "plan" | "compare" | "calculator">;

export interface CalculatorOption {
  id: string;
  name: string;
  /** The total for the count, and what it is in: "5.99" + "LDC / 30 days". */
  amount: string;
  unit: string;
  /** The total before the plan's discount, struck through beside it: "6.66 LDC". */
  original?: string;
  /** The card total beside an LDC total. */
  card?: string;
  /** The USDT total beside an LDC or card total. */
  usdt?: string;
  /** What each later period costs, for a subscription. */
  renewal?: string;
  /** What the plan comes with, from its card: billing, storage, domains of one's own. */
  facts: string[];
  /** The shop with this plan and count chosen. */
  href: string;
}

/** The counts the calculator steps through: from the smallest plan to the largest; null when nothing is on sale. */
export function calculatorRange(catalog: ShopCatalog): { min: number; max: number } | null {
  if (!catalog.available) return null;
  const plans = catalogPlans(catalog);
  if (plans.length === 0) return null;
  const low = (product: ShopProduct | SeatProduct) =>
    isSeatProduct(product) ? product.minQuantity : product.mailboxCount;
  const high = (product: ShopProduct | SeatProduct) =>
    isSeatProduct(product) ? product.maxQuantity : product.mailboxCount;
  return { min: Math.min(...plans.map(low)), max: Math.max(...plans.map(high)) };
}

/** Every plan that sells exactly `count` mailboxes, in the catalog's order, with its total for them. */
export function calculatorOptions(
  catalog: ShopCatalog,
  count: number,
  lang: Lang,
  copy: PricingCopy,
  shop: string,
): CalculatorOption[] {
  if (!catalog.available) return [];
  const { plan: t, calculator: c } = copy;
  const options: CalculatorOption[] = [];
  for (const product of catalogPlans(catalog)) {
    const seat = isSeatProduct(product) ? product : null;
    if (seat ? count < seat.minQuantity || count > seat.maxQuantity : product.mailboxCount !== count) continue;
    const view = planView(product, catalog.payment, lang, copy, shop);
    const facts = [view.rows.billing, view.rows.storage, `${copy.compare.rows.domains} ${view.rows.domains}`];
    if (view.customDomains > 0) facts.push(view.rows.ownDomains);
    const { payment } = catalog;
    const currency = payment.stripe?.currency;
    // Each way of paying the shop offers for this plan, as the shop judges it: LDC when the shop takes it, a card or USDT only
    // for a plan with a price of its own in them. A seat plan's totals come from the shop's fallback, each way on its own.
    let ldc: { originalPriceCents: number; priceCents: number } | null;
    let cardMinor: number | null;
    let usdtCents: number | null;
    let renewLdcCents: number;
    if (seat) {
      const totals = seatTotals(seat, count, {
        ldc: payment.ldc,
        card: Boolean(currency && seat.unitFiatPriceMinor),
        usdt: Boolean(payment.usdt && seat.unitUsdtPriceMinor),
      });
      ({ ldc } = totals);
      cardMinor = totals.card;
      usdtCents = totals.usdt;
      renewLdcCents = (seat.unitRenewPriceCents || seat.unitPriceCents) * count;
    } else {
      ldc = payment.ldc ? { originalPriceCents: product.originalPriceCents, priceCents: product.priceCents } : null;
      cardMinor = currency && product.fiatPriceMinor ? product.fiatPriceMinor : null;
      usdtCents = payment.usdt && product.usdtPriceMinor ? product.usdtPriceMinor : null;
      renewLdcCents = product.renewPriceCents || product.priceCents;
    }
    const days = product.periodDays ?? 0;
    const length = period(product, t);
    const card = cardMinor !== null && currency ? formatMoney(cardMinor, currency, lang) : null;
    const usdt = usdtCents !== null ? formatCredits(usdtCents) : null;
    // The headline is in the first way the plan can be paid: LDC, then a card, then USDT. With none, nothing can buy it.
    let amount: string;
    let unit: string;
    if (ldc) {
      amount = formatCredits(ldc.priceCents);
      unit = days > 0 ? fillText(t.unitPeriod, { period: length }) : t.unitOnce;
    } else if (card) {
      amount = card;
      unit = days > 0 ? fillText(t.cardUnitPeriod, { period: length }) : t.cardUnitOnce;
    } else if (usdt) {
      amount = usdt;
      unit = days > 0 ? fillText(c.usdtUnitPeriod, { period: length }) : c.usdtUnitOnce;
    } else {
      continue;
    }
    // What each later period costs, in the headline's way of paying: LDC renews by hand at the renewal price, a card renews
    // by itself at its card price. USDT renewals are priced by the shop at the time, so the calculator says nothing of them.
    const renewal =
      days === 0
        ? null
        : ldc
          ? fillText(t.renewAt, { price: formatCredits(renewLdcCents), period: length })
          : card
            ? fillText(t.cardRowPeriod, { price: card, period: length })
            : null;
    options.push({
      id: product.id,
      name: product.name,
      amount,
      unit,
      ...(ldc && ldc.originalPriceCents > ldc.priceCents
        ? { original: `${formatCredits(ldc.originalPriceCents)} LDC` }
        : {}),
      ...(ldc && card ? { card: fillText(days > 0 ? t.cardPeriod : t.cardOnce, { price: card, period: length }) } : {}),
      ...((ldc || card) && usdt
        ? { usdt: fillText(days > 0 ? c.usdtPeriod : c.usdtOnce, { price: usdt, period: length }) }
        : {}),
      ...(renewal ? { renewal: fillText(c.renewal, { price: renewal }) } : {}),
      facts,
      href: seat ? shopHref(shop, { plan: seat.id, seats: count }) : view.href,
    });
  }
  return options;
}

function period(product: ShopProduct, t: PricingCopy["plan"]): string {
  const days = product.periodDays ?? 0;
  return days === 1 ? t.oneDay : fillText(t.days, { days });
}
