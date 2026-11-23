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
    if (!seat) {
      const renewal =
        product.periodDays && catalog.payment.ldc ? fillText(c.renewal, { price: view.rows.renewal }) : undefined;
      options.push({
        id: product.id,
        name: product.name,
        amount: view.amount,
        unit: view.unit,
        ...(view.discount ? { original: view.discount.original } : {}),
        ...(view.card ? { card: view.card } : {}),
        ...(renewal ? { renewal } : {}),
        facts,
        href: view.href,
      });
      continue;
    }
    const currency = catalog.payment.stripe?.currency;
    const offered = { ldc: catalog.payment.ldc, card: Boolean(currency && seat.unitFiatPriceMinor) };
    const totals = seatTotals(seat, count, offered);
    const days = seat.periodDays ?? 0;
    const length = period(seat, t);
    const card = totals.card !== null && currency ? formatMoney(totals.card, currency, lang) : null;
    let amount: string;
    let unit: string;
    if (totals.ldc) {
      amount = formatCredits(totals.ldc.priceCents);
      unit = days > 0 ? fillText(t.unitPeriod, { period: length }) : t.unitOnce;
    } else if (card) {
      amount = card;
      unit = days > 0 ? fillText(t.cardUnitPeriod, { period: length }) : t.cardUnitOnce;
    } else {
      // Too many for every way of paying: one order cannot take it.
      continue;
    }
    const renewEach = seat.unitRenewPriceCents || seat.unitPriceCents;
    options.push({
      id: seat.id,
      name: seat.name,
      amount,
      unit,
      ...(totals.ldc && totals.ldc.originalPriceCents > totals.ldc.priceCents
        ? { original: `${formatCredits(totals.ldc.originalPriceCents)} LDC` }
        : {}),
      ...(totals.ldc && card
        ? { card: fillText(days > 0 ? t.cardPeriod : t.cardOnce, { price: card, period: length }) }
        : {}),
      ...(days > 0 && totals.ldc
        ? {
            renewal: fillText(c.renewal, {
              price: fillText(t.renewAt, { price: formatCredits(renewEach * count), period: length }),
            }),
          }
        : {}),
      facts,
      href: shopHref(shop, { plan: seat.id, seats: count }),
    });
  }
  return options;
}

function period(product: ShopProduct, t: PricingCopy["plan"]): string {
  const days = product.periodDays ?? 0;
  return days === 1 ? t.oneDay : fillText(t.days, { days });
}
