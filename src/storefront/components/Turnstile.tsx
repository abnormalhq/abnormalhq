"use client";

/**
 * Cloudflare Turnstile human verification: when the backend has verification on (the API returns a site key) this widget sits in the form and the token goes with the submit.
 * Uses the "interaction only" appearance: most visitors never see it, it only appears when Cloudflare asks for a click.
 * A token can be used once, so every submit must reset() to get a new one. If the script fails to load (blocked, offline) the submit is not held back; the backend decides.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { Lang } from "@/storefront/i18n";
import type { REDEEM_TURNSTILE_ACTION } from "@/storefront/lib/api";
import type { LOGIN_TURNSTILE_ACTION } from "@/storefront/lib/shop";

interface TurnstileApi {
  render(container: HTMLElement, options: Record<string, unknown>): string | undefined;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptLoading: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptLoading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile missing")));
    script.onerror = () => reject(new Error("turnstile script failed to load"));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    // Try again on the next mount (the network may be back).
    scriptLoading = null;
    throw error;
  });
  return scriptLoading;
}

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

/** With siteKey null (verification off, or not known yet) nothing is rendered and token() is always the empty string. */
export function useTurnstile(siteKey: string | null, action: TurnstileAction, lang: Lang): TurnstileHandle {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const token = useRef("");
  // The state remembers which site key it belongs to: a changed (or newly received) key naturally counts as "in progress" with no reset in an effect.
  const [status, setStatusFor] = useState<{ key: string | null; value: "pending" | "ready" | "failed" }>({
    key: null,
    value: "pending",
  });

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    const setStatus = (value: "pending" | "ready" | "failed") => setStatusFor({ key: siteKey, value });
    loadTurnstile().then(
      (api) => {
        if (cancelled || !container.current) return;
        widget.current =
          api.render(container.current, {
            sitekey: siteKey,
            action,
            appearance: "interaction-only",
            theme: "auto",
            language: lang === "zh" ? "zh-cn" : "en",
            // These forms submit JSON; no hidden field needed.
            "response-field": false,
            callback: (value: string) => {
              token.current = value;
              setStatus("ready");
            },
            "expired-callback": () => {
              token.current = "";
              setStatus("pending");
            },
            "timeout-callback": () => {
              token.current = "";
              setStatus("pending");
            },
            "error-callback": () => {
              token.current = "";
              setStatus("failed");
              // Returning true means handled; the widget retries by itself.
              return true;
            },
          }) ?? null;
      },
      () => {
        if (!cancelled) setStatus("failed");
      },
    );
    return () => {
      cancelled = true;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
      token.current = "";
    };
  }, [siteKey, action, lang]);

  const reset = useCallback(() => {
    token.current = "";
    if (!widget.current || !window.turnstile) return;
    setStatusFor((current) => ({ ...current, value: "pending" }));
    window.turnstile.reset(widget.current);
  }, []);
  const read = useCallback(() => token.current, []);

  return {
    widget: siteKey ? <div ref={container} /> : null,
    waiting: siteKey !== null && (status.key !== siteKey || status.value === "pending"),
    token: read,
    reset,
  };
}
