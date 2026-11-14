"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LANG_PATHS, type Lang } from "@/storefront/i18n";
import {
  addSeats,
  formatAmount,
  formatCredits,
  formatDateTime,
  formatMoney,
  formatUsdt,
  keepSeats,
  quoteSeats,
  removeSeats,
  type AccountMailbox,
  type AccountSeats,
  type SeatQuote,
} from "@/storefront/lib/shop";
import { shopCopy, shopError } from "@/storefront/lib/shop-copy";
import { ShopActions, ShopAlert, ShopButton, ShopField, ShopMeta, ShopMetaRow, shopTextClass } from "./ShopParts";
import { ShopSeatStepper } from "./ShopSeatStepper";

/**
 * The seats of one seat subscription, inside its group of "My mailboxes": how many are used, adding seats for the rest of the
 * period and removing seats at the next renewal ("Seat plans" in docs/storefront-api.md). Every rule is mail's: this shows its
 * quote before anything is paid, sends the change and asks the manager to read the list again.
 * - Adding to an LDC or USDT subscription creates an order for the prorated amount, paid on the order page; the seats rise
 *   when it is paid.
 * - Adding to a card subscription charges the card at once. When the bank wants the buyer, nothing changes until Stripe confirms
 *   the payment made on its invoice page: the notice stays up with the link and a "Refresh seats" button.
 * - Removing never happens mid-period: the buyer picks the count and which mailboxes go, and can take it back until the renewal.
 */
export function ShopSeats({
  lang,
  orderId,
  seats,
  mailboxes,
  locked,
  disabled,
  onChanged,
}: {
  lang: Lang;
  /** The subscription's purchase order: what the seat routes take. */
  orderId: string;
  seats: AccountSeats;
  mailboxes: readonly AccountMailbox[];
  /** The subscription is suspended or awaiting removal: nothing can be changed until it is renewed. */
  locked: boolean;
  /** Another change is running in the manager. */
  disabled: boolean;
  /** The seats changed (or may have): read the list again. */
  onChanged: () => void;
}) {
  const t = shopCopy[lang];
  const router = useRouter();
  const [mode, setMode] = useState<"add" | "remove" | null>(null);
  const [count, setCount] = useState(1);
  const [quote, setQuote] = useState<SeatQuote | null>(null);
  const [chosen, setChosen] = useState<readonly string[]>([]);
  const [busy, setBusy] = useState<"quote" | "add" | "remove" | "keep" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // The card needs the buyer at the bank: kept on screen until the seats have risen. `null` link: Stripe gave no invoice page.
  const [awaiting, setAwaiting] = useState<{ invoiceUrl: string | null; seats: number } | null>(null);
  const quoteRequest = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      quoteRequest.current?.abort();
    };
  }, []);

  const id = `seats-${orderId}`;
  const card = seats.provider === "stripe";
  const money = (cents: number) => formatAmount(cents, seats.provider, seats.currency, lang);
  const periodEnd = formatDateTime(seats.periodEnd, lang);
  // Read once when the panel appears: mail decides for real when the change is sent.
  const [shownAt] = useState(() => Date.now());
  const ended = Date.parse(seats.periodEnd) <= shownAt;
  const room = seats.max - seats.seats;
  const removable = seats.seats - seats.min;
  const pending = seats.seatsNext !== null;
  // Once the count the bank was asked about is there, the notice has done its job.
  const stillAwaiting = awaiting !== null && seats.seats <= awaiting.seats;
  const leaving = mailboxes.filter((mailbox) => seats.removing.includes(mailbox.id));

  function open(next: "add" | "remove" | null) {
    quoteRequest.current?.abort();
    setMode(next);
    setCount(1);
    setQuote(null);
    setChosen([]);
    setError("");
    setNotice("");
  }

  async function run(kind: "add" | "remove" | "keep", work: () => Promise<string | void>) {
    if (busy) return;
    setBusy(kind);
    setError("");
    setNotice("");
    try {
      const message = await work();
      if (!mounted.current) return;
      setMode(null);
      setQuote(null);
      if (message) setNotice(message);
      onChanged();
    } catch (cause) {
      if (mounted.current) setError(shopError(cause, lang));
    } finally {
      if (mounted.current) setBusy(null);
    }
  }

  async function askQuote() {
    if (busy) return;
    quoteRequest.current?.abort();
    const controller = new AbortController();
    quoteRequest.current = controller;
    setBusy("quote");
    setError("");
    try {
      const next = await quoteSeats(orderId, count, controller.signal, lang);
      if (!controller.signal.aborted) setQuote(next);
    } catch (cause) {
      if (!controller.signal.aborted) setError(shopError(cause, lang));
    } finally {
      if (mounted.current && quoteRequest.current === controller) setBusy(null);
    }
  }

  // How many mailboxes have to go for the rest to fit the seats that stay.
  const need = Math.max(0, mailboxes.length - (seats.seats - count));
  const picked = need === 0 ? [] : chosen;
  const removeProblem =
    picked.length < need
      ? t.seatsRemoveChooseMore(need - chosen.length)
      : picked.length > count
        ? t.seatsRemoveChooseFewer(count)
        : "";

  return (
    <div className="mt-5 rounded-md border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h4 className="text-sm/[1.5] font-semibold">{t.seatsTitle}</h4>
        <p className="text-sm/[1.5]">{t.seatsUsed(mailboxes.length, seats.seats)}</p>
      </div>
      <ShopMeta>
        {/* The length of the period comes from mail (`seats.periodDays`); a mail before the field says "per period". */}
        <ShopMetaRow label={t.seatsPriceLabel}>
          {t.seatsPriceValue(money(seats.seatPriceCents), seats.periodDays)}
        </ShopMetaRow>
        <ShopMetaRow label={t.seatsPeriodEnd}>{periodEnd}</ShopMetaRow>
        {pending && (
          <>
            <ShopMetaRow label={t.seatsRemove}>{t.seatsPending(seats.seatsNext!, periodEnd)}</ShopMetaRow>
            <ShopMetaRow label={t.seatsPendingMailboxes}>
              {leaving.length > 0 ? (
                <ul className="grid gap-0.5 text-right">
                  {leaving.map((mailbox) => (
                    <li className="font-mono wrap-anywhere" key={mailbox.id}>
                      {mailbox.email}
                    </li>
                  ))}
                </ul>
              ) : (
                t.seatsPendingNoMailboxes
              )}
            </ShopMetaRow>
          </>
        )}
      </ShopMeta>
      {error && <ShopAlert className="mt-4 mb-0">{error}</ShopAlert>}
      {notice && (
        <p className="mt-4 text-sm/[1.7]" role="status">
          {notice}
        </p>
      )}
      {stillAwaiting && (
        <div className="mt-4 rounded-md bg-highlight-muted p-4" role="status">
          <p className="text-sm/[1.7]">{awaiting.invoiceUrl ? t.seatsPaymentRequired : t.seatsPaymentRequiredNoLink}</p>
          <ShopActions>
            {awaiting.invoiceUrl && (
              <ShopButton asChild>
                <a href={awaiting.invoiceUrl} target="_blank" rel="noreferrer">
                  {t.seatsOpenInvoice}
                  <span aria-hidden="true">↗</span>
                </a>
              </ShopButton>
            )}
            <ShopButton variant="outline" type="button" disabled={disabled} onClick={onChanged}>
              {t.seatsRefresh}
            </ShopButton>
          </ShopActions>
        </div>
      )}

      {mode === "add" && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!quote) return void askQuote();
            void run("add", async () => {
              const result = await addSeats(orderId, quote.add, lang);
              if (result.kind === "order") {
                // An order to pay, like a renewal order: the seats rise when it is paid.
                router.push(`/${LANG_PATHS[lang]}shop/orders/?id=${encodeURIComponent(result.orderId)}`);
                return;
              }
              if (result.kind === "payment_required") {
                setAwaiting({ invoiceUrl: result.invoiceUrl, seats: result.seats });
                return;
              }
              setAwaiting(null);
              return t.seatsApplied(result.seats);
            });
          }}
        >
          <ShopField
            htmlFor={`${id}-add`}
            label={t.seatsAddCount}
            hint={t.seatsAddRoom(room)}
            hintId={`${id}-add-hint`}
          >
            <ShopSeatStepper
              id={`${id}-add`}
              value={count}
              min={1}
              max={room}
              disabled={busy !== null}
              fewerLabel={t.seatFewer}
              moreLabel={t.seatMore}
              describedBy={`${id}-add-hint`}
              onChange={(value) => {
                // The price shown was for the count before.
                quoteRequest.current?.abort();
                setCount(value);
                setQuote(null);
              }}
            />
          </ShopField>
          {quote && (
            <div className="rounded-md bg-highlight-muted p-4 text-sm/[1.7]" role="status">
              <p>
                {quote.provider === "usdt"
                  ? t.seatsQuoteUsdt(quote.add, formatUsdt(quote.priceCents), formatDateTime(quote.periodEnd, lang))
                  : quote.exact
                    ? t.seatsQuoteLdc(quote.add, formatCredits(quote.priceCents), formatDateTime(quote.periodEnd, lang))
                    : t.seatsQuoteCard(
                        quote.add,
                        formatMoney(quote.priceCents, quote.currency, lang),
                        formatDateTime(quote.periodEnd, lang),
                      )}
              </p>
              <p className="mt-1 text-muted-foreground">
                {t.seatsQuoteAfter(quote.seats, money(seats.seatPriceCents * quote.seats), seats.periodDays)}
              </p>
            </div>
          )}
          <ShopActions>
            <ShopButton type="submit" variant={quote ? "default" : "outline"} disabled={busy !== null || disabled}>
              {busy === "quote"
                ? t.seatsQuoting
                : busy === "add"
                  ? t.seatsAdding
                  : !quote
                    ? t.seatsQuote
                    : card
                      ? t.seatsConfirmCard
                      : t.seatsConfirmLdc}
            </ShopButton>
            <ShopButton variant="outline" type="button" disabled={busy === "add"} onClick={() => open(null)}>
              {t.passwordCancel}
            </ShopButton>
          </ShopActions>
        </form>
      )}

      {mode === "remove" && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (removeProblem) return setError(removeProblem);
            void run("remove", async () => {
              const result = await removeSeats(orderId, count, picked, lang);
              return t.seatsRemovalScheduled(
                result.seatsNext ?? seats.seats - count,
                formatDateTime(result.effective, lang),
              );
            });
          }}
        >
          <ShopField
            htmlFor={`${id}-remove`}
            label={t.seatsRemoveCount}
            hint={t.seatsRemoveRoom(removable)}
            hintId={`${id}-remove-hint`}
          >
            <ShopSeatStepper
              id={`${id}-remove`}
              value={count}
              min={1}
              max={removable}
              disabled={busy !== null}
              fewerLabel={t.seatFewer}
              moreLabel={t.seatMore}
              describedBy={`${id}-remove-hint`}
              onChange={(value) => {
                setCount(value);
                setError("");
              }}
            />
          </ShopField>
          <p className="text-sm/[1.7] text-muted-foreground">{t.seatsRemoveHint(periodEnd)}</p>
          {need === 0 ? (
            <p className="mt-3 text-sm/[1.7]">{t.seatsRemoveChooseNone}</p>
          ) : (
            <fieldset className="mt-4" aria-describedby={`${id}-remove-warning`}>
              <legend className="text-sm/body">{t.seatsRemoveChoose(need)}</legend>
              <ul className="mt-2 grid gap-1.5">
                {mailboxes.map((mailbox) => (
                  <li key={mailbox.id}>
                    <label className="flex min-h-9 cursor-pointer items-center gap-2.5 text-sm/[1.5]">
                      <input
                        type="checkbox"
                        className="size-4 shrink-0 accent-foreground"
                        checked={chosen.includes(mailbox.id)}
                        disabled={busy !== null}
                        onChange={(event) => {
                          setError("");
                          setChosen((current) =>
                            event.target.checked
                              ? [...current, mailbox.id]
                              : current.filter((item) => item !== mailbox.id),
                          );
                        }}
                      />
                      <span className="font-mono wrap-anywhere">{mailbox.email}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs/[1.6] text-destructive" id={`${id}-remove-warning`}>
                {t.seatsRemoveWarning}
              </p>
            </fieldset>
          )}
          <ShopActions>
            <ShopButton type="submit" variant="destructive" disabled={busy !== null || disabled}>
              {busy === "remove" ? t.seatsRemoving : t.seatsRemoveSubmit}
            </ShopButton>
            <ShopButton variant="outline" type="button" disabled={busy !== null} onClick={() => open(null)}>
              {t.passwordCancel}
            </ShopButton>
          </ShopActions>
        </form>
      )}

      {mode === null && !locked && (
        <>
          <ShopActions>
            {pending ? (
              <ShopButton
                variant="outline"
                type="button"
                disabled={busy !== null || disabled}
                onClick={() =>
                  void run("keep", async () => {
                    await keepSeats(orderId, lang);
                    return t.seatsKept;
                  })
                }
              >
                {busy === "keep" ? t.seatsKeeping : t.seatsKeep}
              </ShopButton>
            ) : (
              <>
                {!ended && room > 0 && (
                  <ShopButton variant="outline" type="button" disabled={disabled} onClick={() => open("add")}>
                    {t.seatsAdd}
                  </ShopButton>
                )}
                {removable > 0 && (
                  <ShopButton variant="outline" type="button" disabled={disabled} onClick={() => open("remove")}>
                    {t.seatsRemove}
                  </ShopButton>
                )}
              </>
            )}
          </ShopActions>
          {!pending && (ended || room <= 0 || removable <= 0) && (
            <p className={shopTextClass}>
              {[
                ended ? t.seatsEnded : room <= 0 ? t.seatsAtMax(seats.max) : "",
                removable <= 0 ? t.seatsAtMin(seats.min) : "",
              ]
                .filter(Boolean)
                .join(" ")}
            </p>
          )}
        </>
      )}
    </div>
  );
}
