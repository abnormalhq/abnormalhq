/**
 * What the pricing section, the pricing page, its Markdown version and its structured data say about a plan, built once from the live
 * catalog (GET /api/shop/catalog) and the wording in the copy, so the four never disagree. Amounts are the backend's: nothing is
 * recalculated here, only formatted.
 * The plan cards also render in the browser (the home page's section), so this file takes the copy as an argument instead of
 * importing it, and must not use TypeScript syntax Node cannot run directly; tests run it as is.
 */
import type { Lang } from "../data/site.ts";
import type { Copy } from "../i18n/types.ts";
import {
  catalogPlans,
  formatCredits,
  formatMoney,
  isSeatProduct,
  type SeatProduct,
  type ShopCatalog,
  type ShopProduct,
} from "../storefront/lib/catalog.ts";
import { shopHref } from "../storefront/lib/address.ts";
import { fillTemplate, type Template } from "./template.ts";

type PlanCopy = Copy["pricing"]["plan"];
type CompareCopy = Copy["pricing"]["compare"];

/** A copy template filled with plain text. */
export function fillText<Slot extends string>(template: Template<Slot>, slots: Record<Slot, string | number>): string {
  return fillTemplate(template, slots).join("");
}

export type PlanRow = keyof CompareCopy["rows"];

export interface PlanView {
  id: string;
  name: string;
  description: string;
  /** The headline amount and what it is in: "7.50" + "LDC / purchase", or "$4.99" + "by card / 30 days" in a card-only shop. */
  amount: string;
  unit: string;
  /** Only for a discounted LDC price. */
  discount?: { label: string; original: string };
  /** The card price beside an LDC price: "or $2.99 every 30 days by card, renewing automatically". */
  card?: string;
  /** One value per row of the comparison table; the cards list the same values. */
  rows: Record<PlanRow, string>;
  domains: string[];
  /** The shop with this plan pointed out. */
  href: string;
  chooseLabel: string;
  /**
   * The card price as schema.org wants it (a decimal string and an ISO 4217 code); absent for a plan sold in LDC only. For a plan
   * sold per mailbox the price is for one, and `seats` says so: the unit's name and how many can be bought.
   */
  offer?: { price: string; currency: string; seats?: { unit: string; min: number; max: number } };
  /** A plan sold per mailbox: what the amount is for and how the total comes about. Shown under the price. */
  note?: string;
  /** How many domains of their own the plan's buyer may connect; 0 for a plan without "Use my own domain". */
  customDomains: number;
}

function storage(product: ShopProduct, t: PlanCopy): string {
  const without = product.domains.filter((domain) => product.quotaSupportedByDomain?.[domain] === false);
  if (without.length > 0) return without.length === product.domains.length ? t.storageUnavailable : t.storageMixed;
  if (product.quotaMb === 0) return t.storageDefault;
  const size = product.quotaMb >= 1024 ? `${Number((product.quotaMb / 1024).toFixed(2))} GB` : `${product.quotaMb} MB`;
  return fillText(t.storage, { size });
}

/** A card amount as a plain decimal in the currency's own number of decimals (2 for USD, 0 for JPY); null for an unknown currency. */
export function decimalAmount(minor: number, currency: string): string | null {
  try {
    const digits =
      new Intl.NumberFormat("en", { style: "currency", currency: currency.toUpperCase() }).resolvedOptions()
        .maximumFractionDigits ?? 2;
    return (minor / 10 ** digits).toFixed(digits);
  } catch {
    return null;
  }
}

export function planView(
  product: ShopProduct | SeatProduct,
  payment: ShopCatalog["payment"],
  lang: Lang,
  copy: { plan: PlanCopy; compare: CompareCopy },
  shop: string,
): PlanView {
  const { plan: t, compare } = copy;
  const days = product.periodDays ?? 0;
  const period = days === 1 ? t.oneDay : fillText(t.days, { days });
  const currency = payment.stripe?.currency;
  const fiat = currency && product.fiatPriceMinor ? formatMoney(product.fiatPriceMinor, currency, lang) : null;
  // A plan sold per mailbox: the catalog's amounts are for one mailbox, and every line says so.
  const seat = isSeatProduct(product) ? product : null;
  const cardLine =
    fiat &&
    (days > 0
      ? fillText(seat ? t.seatCardPeriod : t.cardPeriod, { price: fiat, period })
      : fillText(seat ? t.seatCardOnce : t.cardOnce, { price: fiat }));
  const cardRow =
    fiat &&
    (days > 0
      ? fillText(seat ? t.seatCardRowPeriod : t.cardRowPeriod, { price: fiat, period })
      : seat
        ? fillText(t.seatCardRowOnce, { price: fiat })
        : fiat);
  const cardUnit = seat
    ? days > 0
      ? fillText(t.cardSeatUnitPeriod, { period })
      : t.cardSeatUnitOnce
    : days > 0
      ? fillText(t.cardUnitPeriod, { period })
      : t.cardUnitOnce;
  const ldcUnit = seat
    ? days > 0
      ? fillText(t.seatUnitPeriod, { period })
      : t.seatUnitOnce
    : days > 0
      ? fillText(t.unitPeriod, { period })
      : t.unitOnce;
  const ldcPrice = `${formatCredits(product.priceCents)} ${ldcUnit}`;
  // A card subscription renews at its card price by itself; the LDC renewal price is what a manual renewal costs.
  const renewal = fillText(seat ? t.seatRenewAt : t.renewAt, {
    price: formatCredits(product.renewPriceCents || product.priceCents),
    period,
  });
  const decimal = currency && product.fiatPriceMinor ? decimalAmount(product.fiatPriceMinor, currency) : null;
  const customDomains = product.customDomains ?? 0;
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    ...(payment.ldc || !fiat
      ? { amount: formatCredits(product.priceCents), unit: ldcUnit, ...(cardLine ? { card: cardLine } : {}) }
      : { amount: fiat, unit: cardUnit }),
    ...(payment.ldc && product.discountPercent > 0
      ? {
          discount: {
            label: fillText(t.discount, { percent: product.discountPercent }),
            original: `${formatCredits(product.originalPriceCents)} LDC`,
          },
        }
      : {}),
    rows: {
      price: payment.ldc ? ldcPrice : compare.none,
      card: cardRow ?? compare.none,
      billing: days > 0 ? fillText(t.billingPeriod, { period }) : t.billingOnce,
      renewal: days > 0 ? (payment.ldc || !cardRow ? renewal : cardRow) : compare.noRenewal,
      mailboxes:
        seat && seat.seatMax > seat.seatMin
          ? fillText(t.seatMailboxes, { min: seat.seatMin, max: seat.seatMax })
          : product.mailboxCount === 1
            ? t.mailboxOne
            : fillText(t.mailboxes, { count: product.mailboxCount }),
      storage: storage(product, t),
      domains: product.domains.map((domain) => `@${domain}`).join(", "),
      ownDomains:
        customDomains === 0
          ? t.ownDomainsNone
          : customDomains === 1
            ? t.ownDomainOne
            : fillText(t.ownDomains, { count: customDomains }),
      code: product.codeExpiresDays > 0 ? fillText(t.codeDays, { days: product.codeExpiresDays }) : t.codeNoExpiry,
    },
    domains: product.domains,
    href: shopHref(shop, { plan: product.id }),
    chooseLabel: fillText(t.chooseAria, { name: product.name }),
    ...(decimal && currency
      ? {
          offer: {
            price: decimal,
            currency: currency.toUpperCase(),
            ...(seat ? { seats: { unit: t.seatUnitName, min: seat.seatMin, max: seat.seatMax } } : {}),
          },
        }
      : {}),
    ...(seat
      ? {
          note:
            payment.ldc && product.discountPercent > 0
              ? `${t.seatNote} ${fillText(t.seatDiscountNote, { percent: product.discountPercent })}`
              : t.seatNote,
        }
      : {}),
    customDomains,
  };
}

/** The plans on sale as the pages show them; empty while the shop is closed. */
export function planViews(
  catalog: ShopCatalog,
  lang: Lang,
  copy: { plan: PlanCopy; compare: CompareCopy },
  shop: string,
): PlanView[] {
  if (!catalog.available) return [];
  // Fixed plans first, then the plans sold per mailbox (`seatProducts`, absent on a backend without them).
  return catalogPlans(catalog).map((product) => planView(product, catalog.payment, lang, copy, shop));
}

/** The order the comparison table lists its rows in. */
export const planRows: readonly PlanRow[] = [
  "price",
  "card",
  "billing",
  "renewal",
  "mailboxes",
  "storage",
  "domains",
  "ownDomains",
  "code",
];

/**
 * The rows a set of plans is compared by: "Your own domain" only when one of them includes it, so a shop without the feature (and a
 * backend before it) shows no row of "Not included".
 */
export function planRowsFor(plans: readonly Pick<PlanView, "customDomains">[]): readonly PlanRow[] {
  return plans.some((plan) => plan.customDomains > 0) ? planRows : planRows.filter((row) => row !== "ownDomains");
}
