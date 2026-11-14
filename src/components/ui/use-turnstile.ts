import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";

/*
 * Cloudflare Turnstile, the human check in front of a form, as a hook: the script, the widget's life and its token.
 * It lives in a file without "use client", so a form of the page's own can call it; Turnstile (turnstile.tsx) is the
 * same hook as a component.
 */

/** The part of window.turnstile this hook uses. */
type TurnstileApi = {
  render(container: HTMLElement, options: Record<string, unknown>): string | undefined;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/**
 * "off" without a site key; "pending" while the check runs or after its token expired; "ready" with a token;
 * "failed" when the script could not load or the check errored, so the form can still submit and the server decide.
 */
type TurnstileStatus = "off" | "pending" | "ready" | "failed";

type TurnstileOptions = {
  /** The site key, or null while the check is off or the key is not known yet: nothing renders then. */
  siteKey: string | null;
  /** The action the server checks the token against, one per form. */
  action?: string;
  /** Data the server gets back with the token. */
  cData?: string;
  /** "always" shows the widget (the default), "interaction-only" only when Cloudflare asks for a click. */
  appearance?: "always" | "execute" | "interaction-only";
  size?: "normal" | "flexible" | "compact";
  /** The widget's language, such as "zh-cn"; Turnstile's own choice ("auto") unless given. */
  language?: string;
  /** The widget's colors; the theme the page is painted in unless given. */
  theme?: "light" | "dark" | "auto";
  /**
   * The hidden field Turnstile writes the token into, which submits with the form: "cf-turnstile-response" unless
   * given. `false` for a form that sends `token()` itself.
   */
  fieldName?: string | false;
  /** The nonce of the page's Content Security Policy, for the script element. */
  nonce?: string;
  onStatusChange?: (status: TurnstileStatus) => void;
};

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<TurnstileApi> | null = null;

/** Loads the Turnstile script once per page, however many widgets ask; a failed load lets the next one try again. */
function loadTurnstile(nonce?: string): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    if (nonce) script.nonce = nonce;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile missing")));
    script.onerror = () => reject(new Error("Turnstile did not load"));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}

/** The theme the page is painted in, by the rule abnormal.css follows: data-theme on <html>, else the system. */
function pageTheme(): "light" | "dark" {
  const forced = document.documentElement.dataset.theme;
  if (forced === "light" || forced === "dark") return forced;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribeToTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", onChange);
  };
}

/**
 * A Turnstile widget for a form. Pass `mount` as the ref of an empty element inside the form, where the widget should show; the
 * hook loads the script once, renders the widget there in the page's theme, and removes it when the element goes.
 * `status` says how the check stands, and `waiting` is true while a form should hold its submit button. `guard` goes
 * on the form's onSubmit: it stops a submission that comes before the token, such as a password manager calling
 * requestSubmit(), which a disabled button does not. A token is good for one submission: call `reset()` after each,
 * accepted or not, for a fresh one. `token()` reads the current token, empty while there is none, for a form that
 * sends JSON. A changed theme, key or action renders the widget again, which asks for a new token.
 * Destructure the result (`const { mount, waiting, guard } = useTurnstile(…)`): React's lint treats an object one of
 * whose fields is used as a ref as a ref itself, and then reports reading its other fields during render.
 */
function useTurnstile({
  siteKey,
  action,
  cData,
  appearance = "always",
  size,
  language,
  theme: themeOption,
  fieldName,
  nonce,
  onStatusChange,
}: TurnstileOptions) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const shown = useSyncExternalStore(subscribeToTheme, pageTheme, () => "light" as const);
  const theme = themeOption ?? shown;
  const widget = useRef<string | null>(null);
  const token = useRef("");
  // The status belongs to one widget: a widget with other options starts out pending without an effect having to say
  // so, and removing a widget forgets its status.
  const [state, setState] = useState<{ widget: string | null; status: TurnstileStatus }>({
    widget: null,
    status: "pending",
  });
  const report = useRef(onStatusChange);
  useEffect(() => {
    report.current = onStatusChange;
  });
  // What the widget was rendered with: the status of a widget rendered with anything else is not this one's.
  const identity = [siteKey, action, cData, appearance, size, language, theme, fieldName].join("|");

  useEffect(() => {
    if (!siteKey || !container) return;
    let cancelled = false;
    const key = identity;
    const set = (status: TurnstileStatus) => {
      if (cancelled) return;
      setState({ widget: key, status });
      report.current?.(status);
    };
    report.current?.("pending");
    loadTurnstile(nonce).then(
      (api) => {
        if (cancelled) return;
        widget.current =
          api.render(container, {
            sitekey: siteKey,
            action,
            cData,
            appearance,
            size,
            language,
            theme,
            ...(fieldName === false
              ? { "response-field": false }
              : fieldName
                ? { "response-field-name": fieldName }
                : {}),
            callback: (value: string) => {
              token.current = value;
              set("ready");
            },
            "expired-callback": () => {
              token.current = "";
              set("pending");
            },
            "timeout-callback": () => {
              token.current = "";
              set("pending");
            },
            "error-callback": () => {
              token.current = "";
              set("failed");
              // Handled: Turnstile retries on its own instead of throwing.
              return true;
            },
          }) ?? null;
      },
      () => set("failed"),
    );
    return () => {
      cancelled = true;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
      token.current = "";
      // The status went with the widget: one rendered again, even with the same options (the mount element shown
      // again, the key turned off and back on), waits for a token of its own.
      setState({ widget: null, status: "pending" });
    };
    // identity stands for the options it is made of.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, container, nonce]);

  const reset = useCallback(() => {
    token.current = "";
    if (!widget.current || !window.turnstile) return;
    window.turnstile.reset(widget.current);
    setState((current) => ({ ...current, status: "pending" }));
    report.current?.("pending");
  }, []);
  const read = useCallback(() => token.current, []);

  const status: TurnstileStatus = !siteKey ? "off" : state.widget === identity ? state.status : "pending";
  const waiting = status === "pending";
  const guard = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      if (waiting) event.preventDefault();
    },
    [waiting],
  );

  return { mount: setContainer, status, waiting, token: read, reset, guard };
}

export { useTurnstile, loadTurnstile, type TurnstileOptions, type TurnstileStatus };
