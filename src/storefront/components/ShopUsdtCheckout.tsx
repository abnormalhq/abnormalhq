"use client";

/**
 * A USDT order paid on the order page itself: mail's pay/usdt gives the TRON address that belongs to this order alone and the exact
 * amount to send (USDT, TRC-20), and every call has mail look at the chain. This component shows both with copy buttons and a QR
 * code of the address (wallets scan an address; amounts in payment URIs are not the same across wallets), warns about the network,
 * and asks pay/usdt again every POLL_MS while the tab is visible, for up to POLL_LIMIT_MS; then it stops and offers "Check again".
 * When mail answers `paid` it tells the parent, which reads the order again and shows the code as for any other way of paying.
 * Nothing here holds a key or signs anything: the buyer pays from their own wallet.
 */
import { CheckIcon, CopyIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { encode } from "uqr";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import type { Lang } from "@/storefront/i18n";
import { ShopApiError, startUsdtPayment, usdtDecimal, usdtUnits, type UsdtPaymentStart } from "@/storefront/lib/shop";
import { shopCopy, shopError } from "@/storefront/lib/shop-copy";
import { copyText } from "./onboard/clipboard";
import {
  ShopActions,
  ShopAlert,
  ShopButton,
  ShopSkeleton,
  ShopTestnetBadge,
  shopArriveClass,
  shopTextClass,
} from "./ShopParts";

/** How often pay/usdt is asked while the page is visible: mail expects about this and throttles its own look at the chain. */
export const USDT_POLL_MS = 5_000;
/** How long the page keeps asking by itself before it stops and offers "Check again". */
export const USDT_POLL_LIMIT_MS = 2 * 60 * 60 * 1000;

type Open = Extract<UsdtPaymentStart, { status: "open" }>;

type Phase =
  /** Asking mail for the address the first time. */
  | "loading"
  /** The address and amount are shown; waiting for the transfer. */
  | "open"
  /** mail says paid: the parent is reading the order again. */
  | "paid"
  /** mail answered that this order cannot be paid with USDT here (not offered, switched off, gone stale) or could not be reached. */
  | "unavailable";

export function ShopUsdtCheckout({
  orderId,
  lang,
  onPaid,
  onWatching,
}: {
  orderId: string;
  lang: Lang;
  /** mail answered `paid`: read the order again (the code appears as for any other way of paying). */
  onPaid: () => void | Promise<void>;
  /** Whether the page is asking mail by itself right now: the order's status badge beats while it is. */
  onWatching?: (watching: boolean) => void;
}) {
  const t = shopCopy[lang];
  const [phase, setPhase] = useState<Phase>("loading");
  const [payment, setPayment] = useState<Open | null>(null);
  const [error, setError] = useState("");
  // Each press of "Check again" starts a new round of polling, with a new two-hour allowance.
  const [round, setRound] = useState(0);
  // The round that ran out of time without a payment (or stopped on an answer that asking again will not change).
  const [stopped, setStopped] = useState(-1);
  const [copyNotice, setCopyNotice] = useState("");
  const callbacks = useRef({ onPaid, onWatching });
  useEffect(() => {
    callbacks.current = { onPaid, onWatching };
  });
  const polling = phase !== "paid" && stopped !== round;
  useEffect(() => {
    callbacks.current.onWatching?.(polling);
  }, [polling]);
  useEffect(() => () => callbacks.current.onWatching?.(false), []);

  useEffect(() => {
    const controller = new AbortController();
    const started = Date.now();
    let timer = 0;
    // Whether the address has been shown in this round: a passing failure after that leaves it on screen and asks again.
    let shown = false;

    const stop = () => {
      if (!controller.signal.aborted) setStopped(round);
    };

    async function check() {
      if (controller.signal.aborted) return;
      if (Date.now() - started >= USDT_POLL_LIMIT_MS) return stop();
      let wait = USDT_POLL_MS;
      // A hidden tab asks nothing; it picks up again when the buyer comes back (the wallet is often in another tab or on the phone).
      if (document.visibilityState === "visible") {
        try {
          const answer = await startUsdtPayment(orderId, lang, controller.signal);
          if (controller.signal.aborted) return;
          if (answer.status === "paid") {
            setPhase("paid");
            setError("");
            await callbacks.current.onPaid();
            return;
          }
          shown = true;
          setPayment(answer);
          setPhase("open");
          setError("");
        } catch (cause) {
          if (controller.signal.aborted) return;
          if (cause instanceof ShopApiError && cause.status === 429) {
            // mail's own limit: wait as long as it says, then go on.
            wait = Math.max(USDT_POLL_MS, (cause.retryAfter ?? 0) * 1000);
          } else if (
            cause instanceof ShopApiError &&
            (cause.status === 404 || cause.status === 409 || (cause.status === 503 && cause.answered && !shown))
          ) {
            // Not a USDT order of this buyer, USDT switched off or not configured, a backend without USDT, or an order that
            // can no longer be paid: asking again by itself changes nothing. "Check again" asks once more. An address shown
            // before is taken away unless mail is only out of reach (503): nothing should be sent to an order that cannot be paid.
            if (cause.status !== 503) setPayment(null);
            setPhase("unavailable");
            setError(cause.status === 404 && !cause.message.trim() ? t.usdtUnavailable : shopError(cause, lang));
            return stop();
          } else if (!shown) {
            // Nothing to show yet and the request failed (offline, an outage, an answer that does not parse).
            setPhase("unavailable");
            setError(
              cause instanceof ShopApiError && cause.message.trim() ? shopError(cause, lang) : t.usdtUnavailable,
            );
          }
          // Once the address is on screen a passing failure is not worth an alert: the next round asks again.
        }
      }
      timer = window.setTimeout(() => void check(), wait);
    }

    void check();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [orderId, lang, round, t]);

  function checkAgain() {
    setError("");
    if (!payment) setPhase("loading");
    setRound((value) => value + 1);
  }

  async function copy(value: string, done: string): Promise<boolean> {
    const copied = await copyText(value);
    setCopyNotice(copied ? done : t.usdtCopyFailed);
    return copied;
  }

  if (phase === "loading") {
    return (
      <div className="mt-6" role="status" aria-busy="true">
        <span className="sr-only">{t.usdtLoading}</span>
        <div className="flex flex-wrap gap-6">
          <ShopSkeleton className="size-[176px]" />
          <div className="min-w-[220px] flex-1">
            <ShopSkeleton className="h-4 w-1/3" />
            <ShopSkeleton className="mt-2 h-8 w-1/2" />
            <ShopSkeleton className="mt-6 h-4 w-1/3" />
            <ShopSkeleton className="mt-2 h-6 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!payment) {
    return (
      <>
        <ShopAlert className={shopArriveClass}>{error || t.usdtUnavailable}</ShopAlert>
        <ShopActions>
          <ShopButton variant="outline" type="button" onClick={checkAgain}>
            {t.usdtCheckAgain}
          </ShopButton>
        </ShopActions>
      </>
    );
  }

  const amount = usdtUnits(payment.amount) ?? 0;
  const received = usdtUnits(payment.received) ?? 0;
  const confirming = usdtUnits(payment.confirming) ?? 0;
  const amountText = `${payment.amount} USDT`;
  // What is on its way counts too: an amount still confirming is never asked for a second time.
  const counted = received + confirming;
  const partial = counted > 0 && counted < amount;

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="h-auto w-auto py-[3px] text-xs/body">{t.usdtNetwork}</Badge>
        {payment.network === "nile" && <ShopTestnetBadge>{t.usdtTestnet}</ShopTestnetBadge>}
      </div>
      <div className="mt-5 flex flex-wrap items-start gap-x-7 gap-y-5">
        <figure className="shrink-0">
          <UsdtQr address={payment.address} label={t.usdtQr(payment.address)} />
          <figcaption className="mt-2 max-w-[176px] text-xs/[1.6] text-muted-foreground">{t.usdtQrHint}</figcaption>
        </figure>
        <dl className="grid min-w-0 flex-1 basis-[260px] gap-5">
          <CopyRow
            label={t.usdtAmount}
            copyLabel={t.usdtCopyAmount}
            copiedLabel={t.copiedShort}
            onCopy={() => copy(payment.amount, t.usdtAmountCopied)}
          >
            <span className="text-[28px] leading-[1.2] font-semibold tracking-[-0.02em] tabular-nums">
              {payment.amount}
            </span>{" "}
            <span className="text-xs/body text-muted-foreground">USDT</span>
          </CopyRow>
          <CopyRow
            label={t.usdtAddress}
            copyLabel={t.usdtCopyAddress}
            copiedLabel={t.copiedShort}
            onCopy={() => copy(payment.address, t.usdtAddressCopied)}
          >
            <code className="font-mono text-sm/[1.6] break-all select-all">{payment.address}</code>
          </CopyRow>
        </dl>
      </div>
      {/* Read in its place, not announced: it is there from the start and does not change. */}
      <Alert role="note" className="my-5 px-[18px]">
        <TriangleAlertIcon />
        <AlertDescription className="text-sm/[1.7] text-foreground">{t.usdtWarning(amountText)}</AlertDescription>
      </Alert>
      <div className="text-sm/[1.7]" role="status" aria-label={t.usdtStatus}>
        {phase === "paid" ? (
          <p className="flex items-center gap-2 text-success">
            <CheckIcon className="size-4 animate-pop" aria-hidden="true" />
            {t.usdtPaid}
          </p>
        ) : (
          <>
            {partial && (
              <p className="font-semibold">
                {t.usdtPartial(usdtDecimal(counted), payment.amount, usdtDecimal(amount - counted))}
              </p>
            )}
            {confirming > 0 ? (
              <p className="flex items-center gap-2">
                <Spinner className="size-3" />
                {t.usdtConfirming}
              </p>
            ) : polling ? (
              !partial && (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Spinner className="size-3" />
                  {t.usdtWaiting}
                </p>
              )
            ) : (
              <p className="text-muted-foreground">{t.usdtStopped}</p>
            )}
          </>
        )}
      </div>
      {error && <ShopAlert className={shopArriveClass}>{error}</ShopAlert>}
      {!polling && phase !== "paid" && (
        <ShopActions>
          <ShopButton variant="outline" type="button" onClick={checkAgain}>
            {t.usdtCheckAgain}
          </ShopButton>
        </ShopActions>
      )}
      <p className={shopTextClass} role="status">
        {copyNotice}
      </p>
    </div>
  );
}

/** One fact to copy: its label, the value, and a button that says "Copied" for a moment. */
function CopyRow({
  label,
  copyLabel,
  copiedLabel,
  onCopy,
  children,
}: {
  label: string;
  copyLabel: string;
  copiedLabel: string;
  onCopy: () => Promise<boolean>;
  children: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const id = useId();
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);
  return (
    <div className="grid gap-1.5">
      <dt className="text-xs/body text-muted-foreground" id={id}>
        {label}
      </dt>
      <dd className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="min-w-0">{children}</span>
        <ShopButton
          variant="outline"
          size="sm"
          type="button"
          className="min-h-9"
          aria-describedby={id}
          onClick={async () => setCopied(await onCopy())}
        >
          {copied ? (
            <CheckIcon className="animate-pop text-success" aria-hidden="true" />
          ) : (
            <CopyIcon aria-hidden="true" />
          )}
          {copied ? copiedLabel : copyLabel}
        </ShopButton>
      </dd>
    </div>
  );
}

/**
 * The address as a QR code, drawn as inline SVG from uqr's module matrix: dark modules on white with the four-module quiet zone
 * scanners need, on white in the dark theme too (a light-on-dark code is not read by every wallet).
 */
function UsdtQr({ address, label }: { address: string; label: string }) {
  const { size, path } = useMemo(() => {
    const qr = encode(address, { ecc: "M", border: 4 });
    let d = "";
    qr.data.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (dark) d += `M${x} ${y}h1v1h-1z`;
      }),
    );
    return { size: qr.size, path: d };
  }, [address]);
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="block size-[176px] rounded-control border border-border"
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  );
}
