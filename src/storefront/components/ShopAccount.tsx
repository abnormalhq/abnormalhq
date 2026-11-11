"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LANG_PATHS, type Lang } from "@/storefront/i18n";
import {
  ACCOUNT_PASSWORD_MAX,
  ACCOUNT_PASSWORD_MIN,
  formatCredits,
  formatDateTime,
  finishGoogleLogin,
  formatMoney,
  getAccount,
  getShopCatalog,
  LOGIN_TURNSTILE_ACTION,
  logoutAccount,
  openBillingPortal,
  passwordLogin,
  peekLoginWithRetry,
  registerAccount,
  requestLogin,
  requestPasswordReset,
  resetPassword,
  setAccountPassword,
  ShopApiError,
  startGoogleLogin,
  unlinkGoogle,
  verifyLogin,
  type CustomerAccount,
} from "@/storefront/lib/shop";
import { shopCopy, shopError } from "@/storefront/lib/shop-copy";
import { cn } from "@/lib/utils";
import { withBase } from "@/storefront/site";
import {
  ShopActions,
  ShopAlert,
  ShopButton,
  ShopField,
  ShopHero,
  ShopMailboxes,
  ShopMeta,
  ShopMetaRow,
  ShopOrderCode,
  ShopPanel,
  ShopStatus,
  ShopTextLink,
  shopAccountItemClass,
  shopEmptyClass,
  shopHeadingClass,
  shopHeadingRowClass,
  shopInputClass,
  shopOrderPageClass,
  shopTextClass,
} from "./ShopParts";
import { ShopDomains } from "./ShopDomains";
import { ShopMailboxManager } from "./ShopMailboxManager";
import { useTurnstile } from "./Turnstile";

/** What stops a new password typed twice from being sent: its length (counted in characters), then the two entries differing; the empty string when nothing does. */
function newPasswordProblem(password: string, again: string, lang: Lang): string {
  const t = shopCopy[lang];
  const length = [...password].length;
  if (length < ACCOUNT_PASSWORD_MIN || length > ACCOUNT_PASSWORD_MAX)
    return t.passwordLength(ACCOUNT_PASSWORD_MIN, ACCOUNT_PASSWORD_MAX);
  return password === again ? "" : t.passwordMismatch;
}

/** The login link has been used or declined: drop the token from the address bar so a reload does not ask again. */
function forgetLoginToken() {
  window.history.replaceState(null, "", window.location.pathname);
}

/**
 * Shop account page: when logged out it is the login / register form (email + password; a forgotten password sends a reset email, or use the login link in the email);
 * when a reset link (?reset=...) is opened it first says which account it is for, then lets the buyer set a new password; when logged in it is the "My mailboxes" manager (activate, reset password, suspend, delete),
 * the login password, and the subscriptions (expiry, status, mailbox, renewal entry) and orders (paid orders carry their redeem code).
 * Opening a login link (?login=...) does not log in directly: it first asks mail which mailbox the link belongs to, asks "Log in as ...?", and only swaps the session once the buyer confirms.
 * Otherwise someone could send their own login link and this browser would be logged into their account on open, so later orders, redeem codes and renewal links would all be theirs.
 * "Sign in with Google" first goes to Google, which then sends the browser back to this page (?code=...&state=..., or ?error=... on cancel): the page hands that to mail to finish logging in.
 * That answer is only valid in the browser that started the login (mail checks it against this browser's state cookie), so such a link sent by someone else logs into nothing.
 */
export function ShopAccount({ lang }: { lang: Lang }) {
  const t = shopCopy[lang];
  const params = useSearchParams();
  const loginToken = params.get("login") ?? "";
  const resetToken = params.get("reset") ?? "";
  // The answer Google sent back: only counts when it carries state together with either code or error.
  const googleState = params.get("state") ?? "";
  const googleCode = params.get("code") ?? "";
  const googleError = params.get("error") ?? "";
  const googleReturn = Boolean(googleState && (googleCode || googleError));
  // undefined: still loading; null: logged out.
  const [account, setAccount] = useState<CustomerAccount | null | undefined>(undefined);
  // Bumped when one of the buyer's own domains goes live: "My mailboxes" then reads its list again and offers the domain.
  const [mailboxRefresh, setMailboxRefresh] = useState(0);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState("");
  // Form: log in with password (default), register, forgot password (sends a reset email), or send a login link.
  // "Create account" on the main site links to ?mode=register, which opens the register form directly.
  const [method, setMethod] = useState<"password" | "register" | "forgot" | "link">(() =>
    params.get("mode") === "register" ? "register" : "password",
  );
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [registeredTo, setRegisteredTo] = useState("");
  const [forgotTo, setForgotTo] = useState("");
  // Only the login form needs it: read the Turnstile site key from the catalog (null when verification is off).
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(null);

  // The form appears only when logged out and not confirming a login link or resetting a password.
  const showsLoginForm = account === null && !loginToken && !resetToken && !googleReturn;
  // The widget lives as long as the form: hiding the form (after logging in) removes it, and showing it again (after logging out) renders a new one into the new container.
  const check = useTurnstile(showsLoginForm ? turnstileSiteKey : null, LOGIN_TURNSTILE_ACTION, lang);
  useEffect(() => {
    if (!showsLoginForm) return;
    const controller = new AbortController();
    getShopCatalog(controller.signal, lang)
      .then((catalog) => setTurnstileSiteKey(catalog.turnstileSiteKey ?? null))
      // If the catalog cannot be read the Turnstile widget is not rendered; submit as usual and let the backend decide.
      .catch(() => undefined);
    return () => controller.abort();
  }, [showsLoginForm, lang]);

  useEffect(() => {
    const controller = new AbortController();
    getAccount(controller.signal, lang)
      .then((next) => {
        if (!controller.signal.aborted) setAccount(next);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(shopError(cause, lang));
        setAccount(null);
      });
    return () => controller.abort();
  }, [lang, reload]);

  /** Login confirmed: the token has been used, re-read the account. */
  const signedIn = useCallback(
    (claimed: number) => {
      setError("");
      setNotice(claimed > 0 ? t.claimedNotice(claimed) : "");
      setAccount(undefined);
      setReload((value) => value + 1);
    },
    [t],
  );

  async function sendLink() {
    if (sending) return;
    setSending(true);
    setError("");
    try {
      await requestLogin(email.trim(), lang, check.token());
      setSentTo(email.trim());
    } catch (cause) {
      setError(shopError(cause, lang));
    } finally {
      // The token can only be used once.
      check.reset();
      setSending(false);
    }
  }

  async function sendReset() {
    if (sending) return;
    setSending(true);
    setError("");
    try {
      await requestPasswordReset(email.trim(), lang, check.token());
      setForgotTo(email.trim());
    } catch (cause) {
      setError(shopError(cause, lang));
    } finally {
      check.reset();
      setSending(false);
    }
  }

  async function signInWithPassword() {
    if (sending) return;
    setSending(true);
    setError("");
    try {
      const result = await passwordLogin(email.trim(), password, lang, check.token());
      setPassword("");
      signedIn(result.claimed);
    } catch (cause) {
      setError(shopError(cause, lang));
    } finally {
      check.reset();
      setSending(false);
    }
  }

  async function register() {
    if (sending) return;
    const problem = newPasswordProblem(password, passwordAgain, lang);
    if (problem) return setError(problem);
    setSending(true);
    setError("");
    try {
      await registerAccount(email.trim(), password, lang, check.token());
      setPassword("");
      setPasswordAgain("");
      setRegisteredTo(email.trim());
    } catch (cause) {
      setError(shopError(cause, lang));
    } finally {
      check.reset();
      setSending(false);
    }
  }

  // After a login link or registration email has been sent, that mode shows only "sent"; switching to another mode shows the form as usual.
  const sentMessage =
    method === "link" && sentTo
      ? t.loginSent(sentTo)
      : method === "register" && registeredTo
        ? t.registerSent(registeredTo)
        : method === "forgot" && forgotTo
          ? t.forgotSent(forgotTo)
          : "";

  const [googleStarting, setGoogleStarting] = useState(false);

  /** "Sign in with Google": mail sets the state cookie and returns Google's consent page; do a full-page jump there, coming back as ?code=...&state=.... */
  async function signInWithGoogle() {
    if (googleStarting || sending) return;
    setGoogleStarting(true);
    setError("");
    try {
      window.location.assign(await startGoogleLogin(lang));
    } catch (cause) {
      setError(shopError(cause, lang));
      setGoogleStarting(false);
    }
  }

  function chooseMethod(next: "password" | "register" | "forgot" | "link") {
    setMethod(next);
    setError("");
  }

  const [opening, setOpening] = useState<string | null>(null);

  /** "Manage auto-renewal": open a Stripe customer portal session and jump there; the buyer changes card, cancels or resumes there. */
  async function managePortal(subscriptionId: string) {
    if (opening) return;
    setOpening(subscriptionId);
    setError("");
    try {
      window.location.assign(await openBillingPortal(subscriptionId, lang));
    } catch (cause) {
      setError(shopError(cause, lang));
      setOpening(null);
    }
  }

  async function signOut() {
    setError("");
    try {
      await logoutAccount(lang);
      setAccount(null);
      setNotice("");
    } catch (cause) {
      setError(shopError(cause, lang));
    }
  }

  const date = (value: string) => formatDateTime(value, lang);

  return (
    <div className={shopOrderPageClass}>
      <ShopTextLink href={`/${LANG_PATHS[lang]}shop/`}>← {t.backToShop}</ShopTextLink>
      <ShopHero eyebrow={t.accountEyebrow} title={t.accountTitle}>
        {t.accountDescription}
      </ShopHero>
      {error && <ShopAlert>{error}</ShopAlert>}
      {notice && <p role="status">{notice}</p>}
      {googleReturn ? (
        <ShopGoogleFinish
          lang={lang}
          code={googleCode}
          state={googleState}
          error={googleError}
          onSignedIn={(claimed, created, linked) => {
            signedIn(claimed);
            if (created) setNotice(t.googleCreated);
            else if (linked) setNotice(t.googleLinkDone);
          }}
          onRejected={setError}
        />
      ) : resetToken ? (
        <ShopPasswordReset
          key={resetToken}
          lang={lang}
          token={resetToken}
          onReset={(claimed) => {
            signedIn(claimed);
            setNotice(t.resetDone);
          }}
          onRejected={setError}
        />
      ) : loginToken ? (
        <ShopLoginConfirm
          key={loginToken}
          lang={lang}
          token={loginToken}
          current={account?.email ?? null}
          onSignedIn={signedIn}
          onRejected={setError}
        />
      ) : account === undefined ? (
        <Card asChild className={shopEmptyClass}>
          <p role="status">{t.loading}</p>
        </Card>
      ) : account === null ? (
        <ShopPanel>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t.loginMethods}>
            {(["password", "register"] as const).map((option) => (
              <ShopButton
                key={option}
                type="button"
                // Forgot password and the email link both belong to "log in".
                variant={
                  (option === "register" ? method === "register" : method !== "register") ? "default" : "outline"
                }
                aria-pressed={option === "register" ? method === "register" : method !== "register"}
                disabled={sending}
                onClick={() => chooseMethod(option)}
              >
                {option === "password" ? t.loginTab : t.registerTab}
              </ShopButton>
            ))}
          </div>
          <p className={shopTextClass}>
            {method === "link"
              ? t.loginHint
              : method === "register"
                ? t.registerHint
                : method === "forgot"
                  ? t.forgotHint
                  : t.passwordLoginHint}
          </p>
          {/* The form and the Turnstile widget stay mounted: switching modes or sending an email never re-renders the widget. */}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void (method === "link"
                ? sendLink()
                : method === "register"
                  ? register()
                  : method === "forgot"
                    ? sendReset()
                    : signInWithPassword());
            }}
          >
            {sentMessage ? (
              <p className={shopTextClass} role="status">
                {sentMessage}
              </p>
            ) : (
              <>
                <ShopField htmlFor="shop-login-email" label={t.loginEmail}>
                  <Input
                    className={cn(shopInputClass, "max-w-[420px]")}
                    id="shop-login-email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={sending}
                  />
                </ShopField>
                {(method === "password" || method === "register") && (
                  <ShopField
                    htmlFor="shop-login-password"
                    label={t.loginPassword}
                    hint={
                      method === "register" ? t.passwordLength(ACCOUNT_PASSWORD_MIN, ACCOUNT_PASSWORD_MAX) : undefined
                    }
                  >
                    <Input
                      className={cn(shopInputClass, "max-w-[420px]")}
                      id="shop-login-password"
                      type="password"
                      autoComplete={method === "register" ? "new-password" : "current-password"}
                      required
                      maxLength={ACCOUNT_PASSWORD_MAX * 2}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      disabled={sending}
                    />
                  </ShopField>
                )}
                {method === "register" && (
                  <ShopField htmlFor="shop-login-password-again" label={t.registerPasswordAgain}>
                    <Input
                      className={cn(shopInputClass, "max-w-[420px]")}
                      id="shop-login-password-again"
                      type="password"
                      autoComplete="new-password"
                      required
                      maxLength={ACCOUNT_PASSWORD_MAX * 2}
                      value={passwordAgain}
                      onChange={(event) => setPasswordAgain(event.target.value)}
                      disabled={sending}
                    />
                  </ShopField>
                )}
              </>
            )}
            {check.widget}
            {!sentMessage && (
              <ShopActions>
                <ShopButton type="submit" disabled={sending || check.waiting}>
                  {method === "link"
                    ? sending
                      ? t.loginSending
                      : t.loginButton
                    : method === "forgot"
                      ? sending
                        ? t.forgotSending
                        : t.forgotButton
                      : method === "register"
                        ? sending
                          ? t.registering
                          : t.registerButton
                        : sending
                          ? t.verifying
                          : t.passwordLoginButton}
                </ShopButton>
              </ShopActions>
            )}
            {method === "password" && (
              <p className={shopTextClass}>
                {t.passwordForgot}{" "}
                <button
                  type="button"
                  className="text-foreground underline underline-offset-4"
                  onClick={() => chooseMethod("forgot")}
                >
                  {t.forgotLink}
                </button>
                <span aria-hidden="true"> · </span>
                <button
                  type="button"
                  className="text-foreground underline underline-offset-4"
                  onClick={() => chooseMethod("link")}
                >
                  {t.passwordUseLink}
                </button>
              </p>
            )}
            {(method === "link" || method === "forgot") && (
              <p className={shopTextClass}>
                <button
                  type="button"
                  className="text-foreground underline underline-offset-4"
                  onClick={() => chooseMethod("password")}
                >
                  ← {t.linkBack}
                </button>
              </p>
            )}
          </form>
          {(method === "password" || method === "register") && !sentMessage && (
            <div className="mt-6 border-t border-border pt-5">
              <p className={cn(shopTextClass, "mt-0")}>{t.googleOr}</p>
              <ShopActions>
                <ShopButton
                  variant="outline"
                  type="button"
                  disabled={googleStarting || sending}
                  onClick={() => void signInWithGoogle()}
                >
                  <GoogleMark />
                  {googleStarting ? t.googleStarting : t.googleButton}
                </ShopButton>
              </ShopActions>
            </div>
          )}
        </ShopPanel>
      ) : (
        <>
          <ShopPanel>
            <div className={shopHeadingRowClass}>
              <h2 className={shopHeadingClass}>{t.signedInAs(account.email)}</h2>
              <ShopButton variant="outline" type="button" onClick={() => void signOut()}>
                {t.logout}
              </ShopButton>
            </div>
          </ShopPanel>
          <ShopMailboxManager lang={lang} refresh={mailboxRefresh} />
          {/* "Use my own domain": hidden by itself while the backend or the account's plans do not offer it. */}
          <ShopDomains lang={lang} onLive={() => setMailboxRefresh((value) => value + 1)} />
          {/* Old backends without password login do not return hasPassword; this block is hidden then. */}
          {account.hasPassword !== undefined && (
            <ShopPasswordPanel
              lang={lang}
              hasPassword={account.hasPassword}
              onSaved={() => {
                setError("");
                setNotice(t.passwordSaved);
                // Read the latest account: if the user logged out while saving (account became null) the old account must not be written back.
                setAccount((current) => (current ? { ...current, hasPassword: true } : current));
              }}
            />
          )}
          {/* Old backends without Google login do not return google; this block is hidden then. */}
          {account.google !== undefined && (
            <ShopGooglePanel
              lang={lang}
              google={account.google}
              onUnlinked={() => {
                setError("");
                setNotice(t.googleUnlinked);
                setAccount((current) => (current ? { ...current, google: null } : current));
              }}
              onError={setError}
            />
          )}
          <ShopPanel>
            <h2 className={shopHeadingClass}>{t.subscriptionsTitle}</h2>
            {account.subscriptions.length === 0 ? (
              <p className={shopTextClass}>{t.noSubscriptions}</p>
            ) : (
              account.subscriptions.map((subscription) => (
                <div key={subscription.id} className={shopAccountItemClass}>
                  <div className={shopHeadingRowClass}>
                    <h3 className="text-md/[1.2]">{subscription.productName}</h3>
                    <ShopStatus active={subscription.state === "active"}>
                      {t.subscriptionStates[subscription.state]}
                      {subscription.provider === "stripe" &&
                        ` · ${subscription.autoRenew ? t.autoRenewOn : t.autoRenewOff}`}
                    </ShopStatus>
                  </div>
                  <ShopMeta>
                    <ShopMetaRow label={t.subscriptionEnds}>{date(subscription.currentPeriodEnd)}</ShopMetaRow>
                    <ShopMetaRow label={t.period}>
                      {t.periodValue(subscription.periodDays)}
                      {subscription.provider !== "stripe" ? (
                        <>
                          <br />
                          {t.renewAt(formatCredits(subscription.renewPriceCents))}
                        </>
                      ) : (
                        // Without the amount or its currency there is no price to show: none rather than a guessed one.
                        subscription.fiatRenewMinor !== undefined &&
                        subscription.currency && (
                          <>
                            <br />
                            {t.cardPrice(
                              formatMoney(subscription.fiatRenewMinor, subscription.currency, lang),
                              subscription.periodDays,
                            )}
                          </>
                        )
                      )}
                    </ShopMetaRow>
                    <ShopMetaRow label={t.renewMailboxes}>
                      {subscription.mailboxes.length > 0 ? (
                        <ShopMailboxes mailboxes={subscription.mailboxes} />
                      ) : (
                        t.noMailboxes
                      )}
                    </ShopMetaRow>
                  </ShopMeta>
                  {subscription.provider === "stripe" && (
                    <ShopActions>
                      <ShopButton
                        variant="outline"
                        type="button"
                        disabled={opening !== null}
                        onClick={() => void managePortal(subscription.id)}
                      >
                        {opening === subscription.id ? t.portalOpening : t.manageAutoRenew}
                        <span aria-hidden="true">↗</span>
                      </ShopButton>
                    </ShopActions>
                  )}
                  {subscription.renewToken && (
                    <ShopActions>
                      <ShopButton asChild variant="outline">
                        <Link href={`/${LANG_PATHS[lang]}shop/renew/?t=${encodeURIComponent(subscription.renewToken)}`}>
                          {t.renewLink}
                          <span aria-hidden="true">↗</span>
                        </Link>
                      </ShopButton>
                    </ShopActions>
                  )}
                </div>
              ))
            )}
          </ShopPanel>
          <ShopPanel>
            <h2 className={shopHeadingClass}>{t.ordersTitle}</h2>
            {account.orders.length === 0 ? (
              <p className={shopTextClass}>{t.noOrders}</p>
            ) : (
              account.orders.map((order) => (
                <div key={order.id} className={shopAccountItemClass}>
                  <div className={shopHeadingRowClass}>
                    <h3 className="text-md/[1.2]">
                      {order.productName}
                      {order.kind === "renewal" && ` · ${t.renewalLabel}`}
                    </h3>
                    <ShopStatus active={order.status === "paid"}>
                      {order.status === "paid" ? t.paid : t.pending}
                    </ShopStatus>
                  </div>
                  <ShopMeta>
                    <ShopMetaRow label={t.orderId}>
                      <ShopOrderCode>{order.id}</ShopOrderCode>
                    </ShopMetaRow>
                    <ShopMetaRow label={t.createdAt}>
                      {date(order.created)}
                      {order.provider !== "stripe"
                        ? ` · ${formatCredits(order.priceCents)} LDC`
                        : order.currency && ` · ${formatMoney(order.priceCents, order.currency, lang)}`}
                    </ShopMetaRow>
                    {order.kind === "renewal" && (
                      <ShopMetaRow label={t.period}>{t.renewalPeriods(order.periods, order.periodDays)}</ShopMetaRow>
                    )}
                    {/* The order's discount code and what it took off the price above, as mail publishes them with the list. */}
                    {Boolean(order.couponDiscountCents) && (order.provider !== "stripe" || order.currency) && (
                      <ShopMetaRow label={t.orderCoupon("")}>
                        {order.couponCode && (
                          <>
                            <ShopOrderCode>{order.couponCode}</ShopOrderCode>
                            {" · "}
                          </>
                        )}
                        −
                        {order.provider !== "stripe"
                          ? `${formatCredits(order.couponDiscountCents ?? 0)} LDC`
                          : formatMoney(order.couponDiscountCents ?? 0, order.currency ?? "", lang)}
                      </ShopMetaRow>
                    )}
                    {order.code && (
                      <ShopMetaRow label={t.codeTitle}>
                        <ShopOrderCode>{order.code}</ShopOrderCode>
                        {order.codeStatus && ` · ${t.statuses[order.codeStatus]}`}
                      </ShopMetaRow>
                    )}
                  </ShopMeta>
                  <ShopActions>
                    <ShopButton asChild variant="outline">
                      <Link href={`/${LANG_PATHS[lang]}shop/orders/?id=${encodeURIComponent(order.id)}`}>
                        {t.viewOrder}
                        <span aria-hidden="true">↗</span>
                      </Link>
                    </ShopButton>
                  </ShopActions>
                </div>
              ))
            )}
          </ShopPanel>
        </>
      )}
    </div>
  );
}

/**
 * Confirmation after opening a login link: says which mailbox the link is for, and the link is only spent for a session when the buyer clicks "Log in". If the question fails temporarily it is asked again after a moment;
 * if the mailbox still cannot be named (an old backend without peek, a persistent failure) confirming still works, only without showing the mailbox; an invalid or expired link goes straight back to the login form with the reason.
 */
function ShopLoginConfirm({
  lang,
  token,
  current,
  onSignedIn,
  onRejected,
}: {
  lang: Lang;
  token: string;
  /** The account currently logged in; null when logged out. */
  current: string | null;
  onSignedIn: (claimed: number) => void;
  onRejected: (message: string) => void;
}) {
  const t = shopCopy[lang];
  // undefined: still asking; null: the backend cannot say which mailbox.
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  // Registration confirmation link: the copy says "complete registration" rather than "log in".
  const [registers, setRegisters] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    peekLoginWithRetry(token, controller.signal, lang)
      .then((next) => {
        if (controller.signal.aborted) return;
        setEmail(next.email);
        setRegisters(next.register);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        if (cause instanceof ShopApiError && cause.status === 400) {
          forgetLoginToken();
          onRejected(shopError(cause, lang));
        } else {
          setEmail(null);
        }
      });
    return () => controller.abort();
  }, [token, lang, onRejected]);

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await verifyLogin(token, lang);
      forgetLoginToken();
      onSignedIn(result.claimed);
    } catch (cause) {
      setBusy(false);
      if (cause instanceof ShopApiError && cause.status === 400) {
        forgetLoginToken();
        onRejected(shopError(cause, lang));
      } else {
        // Temporary failure: the link has not been spent, keep it and try again.
        setError(shopError(cause, lang));
      }
    }
  }

  return (
    <ShopPanel>
      <h2 className={shopHeadingClass}>{registers ? t.confirmRegisterTitle : t.confirmLoginTitle}</h2>
      {email === undefined ? (
        <p className={shopTextClass} role="status">
          {t.checkingLink}
        </p>
      ) : (
        <>
          <p className="mt-2.5 text-md/[1.6] wrap-anywhere">
            {email ? (registers ? t.confirmRegisterAs(email) : t.confirmLoginAs(email)) : t.confirmLoginUnknown}
          </p>
          <p className={shopTextClass}>{registers ? t.confirmRegisterHint : t.confirmLoginHint}</p>
          {current && current !== email && <p className={shopTextClass}>{t.confirmLoginSwitch(current)}</p>}
          {error && <ShopAlert>{error}</ShopAlert>}
          <ShopActions>
            <ShopButton type="button" disabled={busy} onClick={() => void confirm()}>
              {busy ? t.verifying : registers ? t.confirmRegisterButton : t.confirmLoginButton}
            </ShopButton>
            <ShopButton variant="outline" type="button" disabled={busy} onClick={forgetLoginToken}>
              {t.confirmLoginCancel}
            </ShopButton>
          </ShopActions>
        </>
      )}
    </ShopPanel>
  );
}

/**
 * Login password: set or change. Within 10 minutes of logging in through a login link the current password can be left out (first-time setup and resets after a forgotten password rely on this);
 * otherwise mail requires the current password and answers 403 with what to do when it is wrong. After saving, mail logs this account out in every other browser.
 */
function ShopPasswordPanel({ lang, hasPassword, onSaved }: { lang: Lang; hasPassword: boolean; onSaved: () => void }) {
  const t = shopCopy[lang];
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // If the user logs out before the save returns, this block unmounts: the late result is not reported (no "saved", no account change).
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function close() {
    setEditing(false);
    setCurrent("");
    setNext("");
    setAgain("");
    setError("");
  }

  async function save() {
    if (busy) return;
    const problem = newPasswordProblem(next, again, lang);
    if (problem) return setError(problem);
    setBusy(true);
    setError("");
    try {
      await setAccountPassword(next, current, lang);
      if (!mounted.current) return;
      close();
      onSaved();
    } catch (cause) {
      if (mounted.current) setError(shopError(cause, lang));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <ShopPanel>
      <div className={shopHeadingRowClass}>
        <h2 className={shopHeadingClass}>{t.passwordTitle}</h2>
        {!editing && (
          <ShopButton variant="outline" type="button" onClick={() => setEditing(true)}>
            {hasPassword ? t.passwordChangeButton : t.passwordSetButton}
          </ShopButton>
        )}
      </div>
      <p className={shopTextClass}>{hasPassword ? t.passwordSet : t.passwordNone}</p>
      {editing && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          {hasPassword && (
            <ShopField
              htmlFor="shop-password-current"
              label={t.passwordCurrent}
              hint={t.passwordCurrentHint}
              hintId="shop-password-current-hint"
            >
              <Input
                className={cn(shopInputClass, "max-w-[420px]")}
                id="shop-password-current"
                type="password"
                autoComplete="current-password"
                aria-describedby="shop-password-current-hint"
                maxLength={ACCOUNT_PASSWORD_MAX * 2}
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
                disabled={busy}
              />
            </ShopField>
          )}
          <ShopField
            htmlFor="shop-password-new"
            label={t.passwordNew}
            hint={t.passwordRule(ACCOUNT_PASSWORD_MIN, ACCOUNT_PASSWORD_MAX)}
            hintId="shop-password-new-hint"
          >
            <Input
              className={cn(shopInputClass, "max-w-[420px]")}
              id="shop-password-new"
              type="password"
              autoComplete="new-password"
              aria-describedby="shop-password-new-hint"
              required
              maxLength={ACCOUNT_PASSWORD_MAX * 2}
              value={next}
              onChange={(event) => setNext(event.target.value)}
              disabled={busy}
            />
          </ShopField>
          <ShopField htmlFor="shop-password-again" label={t.passwordConfirm}>
            <Input
              className={cn(shopInputClass, "max-w-[420px]")}
              id="shop-password-again"
              type="password"
              autoComplete="new-password"
              required
              maxLength={ACCOUNT_PASSWORD_MAX * 2}
              value={again}
              onChange={(event) => setAgain(event.target.value)}
              disabled={busy}
            />
          </ShopField>
          {error && <ShopAlert>{error}</ShopAlert>}
          <ShopActions>
            <ShopButton type="submit" disabled={busy}>
              {busy ? t.passwordSaving : t.passwordSave}
            </ShopButton>
            <ShopButton variant="outline" type="button" disabled={busy} onClick={close}>
              {t.passwordCancel}
            </ShopButton>
          </ShopActions>
        </form>
      )}
    </ShopPanel>
  );
}

/**
 * After opening a password reset link: first ask mail which account the link is for (read-only), say "set a new password for ...", and only spend the link once the buyer has typed the new password twice.
 * On success mail logs this account out in every browser and logs the current browser in; an invalid, expired or non-reset link goes back to the login form with the reason.
 */
function ShopPasswordReset({
  lang,
  token,
  onReset,
  onRejected,
}: {
  lang: Lang;
  token: string;
  onReset: (claimed: number) => void;
  onRejected: (message: string) => void;
}) {
  const t = shopCopy[lang];
  // undefined: still asking; null: could not ask (temporary failure), submitting still works.
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    peekLoginWithRetry(token, controller.signal, lang)
      .then((next) => {
        if (controller.signal.aborted) return;
        if (!next.reset) {
          forgetLoginToken();
          onRejected(t.resetNotReset);
          return;
        }
        setEmail(next.email);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        if (cause instanceof ShopApiError && cause.status === 400) {
          forgetLoginToken();
          onRejected(shopError(cause, lang));
        } else {
          setEmail(null);
        }
      });
    return () => controller.abort();
  }, [token, lang, onRejected, t]);

  async function submit() {
    if (busy) return;
    const problem = newPasswordProblem(password, again, lang);
    if (problem) return setError(problem);
    setBusy(true);
    setError("");
    try {
      const result = await resetPassword(token, password, lang);
      forgetLoginToken();
      onReset(result.claimed);
    } catch (cause) {
      setBusy(false);
      // The form already checks the password, so a 400 means the link is used up, expired or not a reset link.
      if (cause instanceof ShopApiError && cause.status === 400) {
        forgetLoginToken();
        onRejected(shopError(cause, lang));
      } else {
        setError(shopError(cause, lang));
      }
    }
  }

  return (
    <ShopPanel>
      <h2 className={shopHeadingClass}>{t.resetTitle}</h2>
      {email === undefined ? (
        <p className={shopTextClass} role="status">
          {t.checkingLink}
        </p>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <p className="mt-2.5 text-md/[1.6] wrap-anywhere">{email ? t.resetFor(email) : t.resetForUnknown}</p>
          <p className={shopTextClass}>{t.resetHint}</p>
          <ShopField
            htmlFor="shop-reset-password"
            label={t.passwordNew}
            hint={t.passwordLength(ACCOUNT_PASSWORD_MIN, ACCOUNT_PASSWORD_MAX)}
          >
            <Input
              className={cn(shopInputClass, "max-w-[420px]")}
              id="shop-reset-password"
              type="password"
              autoComplete="new-password"
              required
              maxLength={ACCOUNT_PASSWORD_MAX * 2}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={busy}
            />
          </ShopField>
          <ShopField htmlFor="shop-reset-password-again" label={t.passwordConfirm}>
            <Input
              className={cn(shopInputClass, "max-w-[420px]")}
              id="shop-reset-password-again"
              type="password"
              autoComplete="new-password"
              required
              maxLength={ACCOUNT_PASSWORD_MAX * 2}
              value={again}
              onChange={(event) => setAgain(event.target.value)}
              disabled={busy}
            />
          </ShopField>
          {error && <ShopAlert>{error}</ShopAlert>}
          <ShopActions>
            <ShopButton type="submit" disabled={busy}>
              {busy ? t.passwordSaving : t.resetButton}
            </ShopButton>
            <ShopButton variant="outline" type="button" disabled={busy} onClick={forgetLoginToken}>
              {t.passwordCancel}
            </ShopButton>
          </ShopActions>
        </form>
      )}
    </ShopPanel>
  );
}

/** Google's "G" logo (official colours), placed inside the "Sign in with Google" button. */
function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="size-4 shrink-0">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

/**
 * After Google sends the browser back to the account page: hand code and state to mail to finish logging in (only once: mail spends this browser's state cookie),
 * then drop them from the address bar. If the login started on the English page, return to the English account page afterwards. If the buyer cancels on Google's side, Google returns error and mail need not be asked.
 */
function ShopGoogleFinish({
  lang,
  code,
  state,
  error,
  onSignedIn,
  onRejected,
}: {
  lang: Lang;
  code: string;
  state: string;
  error: string;
  onSignedIn: (claimed: number, created: boolean, linked: boolean) => void;
  onRejected: (message: string) => void;
}) {
  const t = shopCopy[lang];
  // In development the effect runs twice; the answer can only be handed over once, so the second run does nothing.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (error || !code) {
      forgetLoginToken();
      onRejected(error === "access_denied" ? t.googleCancelled : t.googleFailed);
      return;
    }
    finishGoogleLogin(code, state, lang)
      .then((result) => {
        if (result.lang !== lang) {
          window.location.replace(withBase(`${LANG_PATHS[result.lang]}shop/account/`));
          return;
        }
        forgetLoginToken();
        onSignedIn(result.claimed, result.created, result.linked);
      })
      .catch((cause: unknown) => {
        forgetLoginToken();
        onRejected(shopError(cause, lang));
      });
  }, [code, state, error, lang, onSignedIn, onRejected, t]);

  return (
    <Card asChild className={shopEmptyClass}>
      <p role="status">{t.googleFinishing}</p>
    </Card>
  );
}

/**
 * When logged in: the Google account linked to this account, which can be unlinked (password and email links still log in afterwards); when none is linked, link one from here: jump to Google to pick an account,
 * and on return mail links it to the account currently logged in (the Google account's email need not match the account email).
 */
function ShopGooglePanel({
  lang,
  google,
  onUnlinked,
  onError,
}: {
  lang: Lang;
  google: { email: string } | null;
  onUnlinked: () => void;
  onError: (message: string) => void;
}) {
  const t = shopCopy[lang];
  const [busy, setBusy] = useState(false);

  async function link() {
    if (busy) return;
    setBusy(true);
    try {
      window.location.assign(await startGoogleLogin(lang, true));
    } catch (cause) {
      onError(shopError(cause, lang));
      setBusy(false);
    }
  }

  async function unlink() {
    if (busy) return;
    setBusy(true);
    try {
      await unlinkGoogle(lang);
      onUnlinked();
    } catch (cause) {
      onError(shopError(cause, lang));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ShopPanel>
      <h2 className={shopHeadingClass}>{t.googleTitle}</h2>
      <p className={cn(shopTextClass, "wrap-anywhere")}>{google ? t.googleLinked(google.email) : t.googleNotLinked}</p>
      <ShopActions>
        {google ? (
          <ShopButton variant="outline" type="button" disabled={busy} onClick={() => void unlink()}>
            {busy ? t.googleUnlinking : t.googleUnlink}
          </ShopButton>
        ) : (
          <ShopButton variant="outline" type="button" disabled={busy} onClick={() => void link()}>
            <GoogleMark />
            {busy ? t.googleStarting : t.googleLink}
          </ShopButton>
        )}
      </ShopActions>
    </ShopPanel>
  );
}
