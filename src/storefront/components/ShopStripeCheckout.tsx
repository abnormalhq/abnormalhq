"use client";

/**
 * A card order paid on the order page itself: mail's pay/stripe hands out the Checkout Session's client secret (ui_mode elements)
 * and the publishable key, and this component embeds Stripe Elements with Stripe.js (an email field when the order has no contact
 * email, then the payment method field); the "Pay" button calls confirm. The card number only passes through Stripe's iframe, never
 * this site. A card confirmed in place tells the parent to reconcile the order; a payment method that authenticates on a bank or
 * wallet page is sent back to the order page by Stripe (the return_url mail set), where polling goes on as usual.
 * Without a publishable key in the backend, with a backend or Worker too old, or when Stripe.js cannot load, the "Pay with Stripe"
 * form (rendered by the parent) takes over.
 */
import type { Appearance, StripeCheckoutLoadActionsSuccess, StripeCheckoutElementsSdk } from "@stripe/stripe-js";
import { loadStripe } from "@stripe/stripe-js/pure";
import { useEffect, useRef, useState } from "react";
import type { Lang } from "@/storefront/i18n";
import { startStripePayment } from "@/storefront/lib/shop";
import { shopCopy, shopError } from "@/storefront/lib/shop-copy";
import { cn } from "@/lib/utils";
import { ShopActions, ShopAlert, ShopButton, ShopSkeleton, shopArriveClass, shopTextClass } from "./ShopParts";
import { Spinner } from "@/components/ui/spinner";
import { useDocumentTheme } from "./useDocumentTheme";

/**
 * The Elements appearance follows the site theme (the tokens in src/styles/global.css): ink primary, off-white or charcoal
 * background, the same corner radius. The font is the system stack: Inter is self-hosted through next/font and the iframe cannot load it.
 */
function appearanceFor(dark: boolean): Appearance {
  return {
    theme: dark ? "night" : "stripe",
    variables: {
      colorPrimary: dark ? "#f0f0ea" : "#141412",
      colorBackground: dark ? "#141412" : "#f7f7f4",
      colorText: dark ? "#f0f0ea" : "#141412",
      colorTextSecondary: dark ? "#a6a69c" : "#5c5c55",
      colorTextPlaceholder: dark ? "#6f6f66" : "#8a8a80",
      colorDanger: dark ? "#ff8a96" : "#9f1a2c",
      colorSuccess: dark ? "#a8c48f" : "#335c24",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
      fontSizeBase: "15px",
      borderRadius: "6px",
      focusBoxShadow: `0 0 0 1px ${dark ? "#6f6f66" : "#8a8a80"}`,
    },
    rules: {
      ".Input": { borderColor: dark ? "#f0f0ea1f" : "#14141222", boxShadow: "none" },
      ".Input:focus": { borderColor: dark ? "#6f6f66" : "#8a8a80" },
      ".Tab, .Block": { borderColor: dark ? "#2e2e29" : "#e3e3dc", boxShadow: "none" },
    },
  };
}

type Phase =
  /** Asking mail for the session, loading Stripe.js, mounting the form. */
  | "loading"
  /** The form is usable, waiting for the buyer to fill in the card. */
  | "ready"
  /** confirm is in progress. */
  | "paying"
  /** Confirmed in place; the parent is reconciling the order. */
  | "paid"
  /** The buyer already paid and the bank debit is on its way: nothing to pay. */
  | "processing"
  /** The form cannot load: the parent may use the hosted page instead. */
  | "unavailable";

export function ShopStripeCheckout({
  orderId,
  lang,
  onPaid,
  onHosted,
}: {
  orderId: string;
  lang: Lang;
  /** The card was confirmed in place: reconcile the order (the code comes from the webhook or the active check). */
  onPaid: () => void | Promise<void>;
  /** This order goes to Stripe's hosted page (no publishable key, or an endpoint too old): the parent renders the "Pay" form instead. */
  onHosted: () => void;
}) {
  const t = shopCopy[lang];
  const resolvedTheme = useDocumentTheme();
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");
  const [total, setTotal] = useState("");
  const [canConfirm, setCanConfirm] = useState(false);
  const contactRef = useRef<HTMLDivElement>(null);
  const paymentRef = useRef<HTMLDivElement>(null);
  const checkoutRef = useRef<StripeCheckoutElementsSdk | null>(null);
  const actionsRef = useRef<StripeCheckoutLoadActionsSuccess | null>(null);
  // Callbacks and theme live in refs: the effect that mounts Stripe reruns only with the order and the language (the parent keys
  // by order id, so in practice once on mount), never rebuilding the form because the parent rerendered or the theme changed.
  const callbacks = useRef({ onPaid, onHosted });
  useEffect(() => {
    callbacks.current = { onPaid, onHosted };
  });
  const dark = useRef(false);
  useEffect(() => {
    dark.current = resolvedTheme === "dark";
    checkoutRef.current?.changeAppearance(appearanceFor(dark.current));
  }, [resolvedTheme]);

  useEffect(() => {
    let cancelled = false;
    const destroy: (() => void)[] = [];
    (async () => {
      const start = await startStripePayment(orderId, lang);
      if (cancelled) return;
      if (start.status !== "open") {
        if (start.status === "hosted") callbacks.current.onHosted();
        else if (start.status === "paid") await callbacks.current.onPaid();
        else setPhase("processing");
        return;
      }
      // The page language sets the language of Stripe's form; locale zh gives Simplified Chinese.
      const stripe = await loadStripe(start.publishableKey, { locale: lang === "zh" ? "zh" : "en" });
      if (cancelled) return;
      if (!stripe) throw new Error("Stripe.js did not load");
      const checkout = stripe.initCheckoutElementsSdk({
        clientSecret: start.clientSecret,
        elementsOptions: { appearance: appearanceFor(dark.current) },
      });
      checkoutRef.current = checkout;
      checkout.on("change", (session) => {
        if (cancelled) return;
        setCanConfirm(session.canConfirm);
        setTotal(session.total.total.amount);
      });
      const loaded = await checkout.loadActions();
      if (cancelled) return;
      if (loaded.type === "error") throw new Error(loaded.error.message);
      actionsRef.current = loaded.actions;
      const session = loaded.actions.getSession();
      setTotal(session.total.total.amount);
      setCanConfirm(session.canConfirm);
      if (!contactRef.current || !paymentRef.current) throw new Error("The payment form has no place to mount");
      // An order placed with a contact email has it on the session already (not editable); otherwise it is collected here, and Stripe recognizes Link accounts along the way.
      if (!session.email) {
        const contact = checkout.createContactDetailsElement();
        destroy.push(() => contact.destroy());
        contact.mount(contactRef.current);
      }
      const payment = checkout.createPaymentElement({ layout: "tabs" });
      destroy.push(() => payment.destroy());
      payment.on("ready", () => {
        if (!cancelled) setPhase("ready");
      });
      payment.on("loaderror", () => {
        if (!cancelled) setPhase("unavailable");
      });
      payment.mount(paymentRef.current);
    })().catch((cause: unknown) => {
      if (cancelled) return;
      // Backend answers such as "order not found" or a rate limit are shown as they are; when Stripe.js cannot load, only that the form cannot open.
      setError(cause instanceof Error && cause.name === "ShopApiError" ? shopError(cause, lang) : "");
      setPhase("unavailable");
    });
    return () => {
      cancelled = true;
      for (const dispose of destroy) dispose();
      checkoutRef.current = null;
      actionsRef.current = null;
    };
  }, [orderId, lang]);

  async function pay() {
    const actions = actionsRef.current;
    if (!actions || phase !== "ready") return;
    setPhase("paying");
    setError("");
    try {
      // Payment methods with an immediate result (cards) do not redirect; those that authenticate on a bank or wallet page are sent back to the order page by Stripe.
      const result = await actions.confirm({ redirect: "if_required" });
      if (result.type === "error") {
        setError(result.error.message || t.cardFailed);
        setPhase("ready");
        return;
      }
      setPhase("paid");
      await callbacks.current.onPaid();
    } catch {
      setError(t.cardFailed);
      setPhase("ready");
    }
  }

  if (phase === "processing") {
    return (
      <p className={shopTextClass} role="status">
        {t.cardProcessing}
      </p>
    );
  }
  if (phase === "unavailable") {
    return (
      <>
        <ShopAlert>{error || t.cardUnavailable}</ShopAlert>
        <ShopActions>
          <ShopButton variant="outline" type="button" onClick={() => callbacks.current.onHosted()}>
            {t.payStripe}
            <span aria-hidden="true">↗</span>
          </ShopButton>
        </ShopActions>
      </>
    );
  }
  return (
    <div className="mt-6">
      {phase === "loading" && (
        // The outline of the card form while Stripe loads; the form itself mounts below, unseen until it is ready.
        <div role="status" aria-busy="true">
          <span className="sr-only">{t.cardLoading}</span>
          <ShopSkeleton className="h-11 w-full" />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <ShopSkeleton className="h-11" />
            <ShopSkeleton className="h-11" />
          </div>
          <ShopSkeleton className="mt-6 h-10 w-36" />
        </div>
      )}
      {/* Hidden by visibility, not display: Stripe measures the place it mounts in, and it must have its width. */}
      <div className={cn(phase === "loading" ? "invisible h-0 overflow-hidden" : "animate-fade-in")}>
        <div ref={contactRef} className="mb-4 empty:mb-0" />
        <div ref={paymentRef} className="min-h-10" />
      </div>
      {error && <ShopAlert className={shopArriveClass}>{error}</ShopAlert>}
      {phase !== "loading" && (
        <ShopActions>
          <ShopButton type="button" onClick={() => void pay()} disabled={phase !== "ready" || !canConfirm}>
            {(phase === "paying" || phase === "paid") && <Spinner />}
            {phase === "paying" ? t.cardPaying : phase === "paid" ? t.cardPaid : t.cardPay(total)}
          </ShopButton>
        </ShopActions>
      )}
    </div>
  );
}
