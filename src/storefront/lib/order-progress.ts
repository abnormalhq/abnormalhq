/**
 * Where an order is on its way from checkout to a mailbox, for the progress line on the order page, and the memory of
 * which orders this tab has seen waiting for payment.
 *
 * The celebration on the order page is for a payment the buyer just made, not for every visit to a paid order: the page
 * notes an order it showed as pending (sessionStorage, so it survives the trip to the payment provider and back in the
 * same tab) and celebrates once when that order turns up paid.
 */

export const ORDER_AWAITING_KEY = "abnormal-order-awaiting";
/** A tab rarely has more than one order open; a few are kept so a second purchase does not forget the first. */
const REMEMBERED_ORDERS = 8;

export type OrderStepStatus = "complete" | "current" | "upcoming";
export type OrderStep = { key: "placed" | "pay" | "code" | "done"; status: OrderStepStatus };

/**
 * Three steps: the order exists, it is paid, and what the payment gives. A purchase ends with collecting the code, which is
 * the buyer's to do, so it is the current step once paid; a renewal or an upgrade has nothing left to do and is complete.
 */
export function orderSteps(order: { status: string; kind?: "purchase" | "renewal" }): OrderStep[] {
  const paid = order.status === "paid";
  const purchase = order.kind !== "renewal";
  return [
    { key: "placed", status: "complete" },
    { key: "pay", status: paid ? "complete" : "current" },
    { key: purchase ? "code" : "done", status: !paid ? "upcoming" : purchase ? "current" : "complete" },
  ];
}

/** Storage can be blocked (private modes, embedded contexts): the order page then shows a paid order without the celebration. */
function storage(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function readAwaiting(): string[] {
  try {
    const parsed: unknown = JSON.parse(storage()?.getItem(ORDER_AWAITING_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeAwaiting(ids: string[]): void {
  try {
    storage()?.setItem(ORDER_AWAITING_KEY, JSON.stringify(ids.slice(-REMEMBERED_ORDERS)));
  } catch {
    // A full or blocked storage only costs the celebration.
  }
}

/** The order page showed this order as waiting for payment. */
export function markAwaiting(orderId: string): void {
  const ids = readAwaiting();
  if (!ids.includes(orderId)) writeAwaiting([...ids, orderId]);
}

/** Whether this tab saw the order waiting for payment; asking forgets it, so a paid order is celebrated once. */
export function takeAwaiting(orderId: string): boolean {
  const ids = readAwaiting();
  if (!ids.includes(orderId)) return false;
  writeAwaiting(ids.filter((id) => id !== orderId));
  return true;
}
