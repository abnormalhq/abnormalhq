"use client";

/**
 * Cloudflare Turnstile human verification: when the backend has verification on (the API returns a site key) this widget sits in the form and the token goes with the submit.
 * Uses the "interaction only" appearance: most visitors never see it, it only appears when Cloudflare asks for a click.
 * A token can be used once, so every submit must reset() to get a new one. If the script fails to load (blocked, offline) the submit is not held back; the backend decides.
 */
import type { ReactNode } from "react";
import { useTurnstile as useRegistryTurnstile } from "@/components/ui/use-turnstile";
import type { Lang } from "@/storefront/i18n";
import type { REDEEM_TURNSTILE_ACTION } from "@/storefront/lib/api";
import type { LOGIN_TURNSTILE_ACTION } from "@/storefront/lib/shop";

/** Each form has its own action; mail only accepts tokens issued for the same form. */
export type TurnstileAction = typeof REDEEM_TURNSTILE_ACTION | typeof LOGIN_TURNSTILE_ACTION;

export interface TurnstileHandle {
  /** Goes inside the form; null when verification is not needed. */
  widget: ReactNode;
  /** Verification still in progress: the submit button waits. false when verification failed or the script did not load, so the visitor can still submit. */
  waiting: boolean;
  /** Current token; empty string when there is none. */
  token: () => string;
  /** Call after a submit: invalidates the old token and fetches a new one. */
  reset: () => void;
}

/**
 * The registry's useTurnstile (script, widget, status and token), set up as these forms need it: interaction only, the system's
 * theme, the page's language, and no hidden field, since the forms submit JSON with token().
 * With siteKey null (verification off, or not known yet) nothing is rendered and token() is always the empty string.
 */
export function useTurnstile(siteKey: string | null, action: TurnstileAction, lang: Lang): TurnstileHandle {
  const { mount, waiting, token, reset } = useRegistryTurnstile({
    siteKey,
    action,
    appearance: "interaction-only",
    theme: "auto",
    language: lang === "zh" ? "zh-cn" : "en",
    fieldName: false,
  });
  return { widget: siteKey ? <div ref={mount} /> : null, waiting, token, reset };
}
