"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useTurnstile, type TurnstileOptions } from "@/components/ui/use-turnstile";

/**
 * Cloudflare Turnstile inside a form: the widget, which writes its token into a hidden field ("cf-turnstile-response"
 * unless `fieldName` says otherwise) that submits with the form. It shows by default, so a visitor sees the check
 * run, pass, or fail in Cloudflare's own words; `appearance="interaction-only"` keeps it out of sight until Cloudflare
 * asks for a click. It follows the page's theme, and its words are Cloudflare's, in `language`.
 * A token is good for one submission: change `resetKey` (to the state the server returned) for a fresh one.
 * `onStatusChange` tells the form whether a token is ready, so its button can wait; when the script cannot load it
 * reports "failed", and the form should submit anyway and leave the decision to the server. For a form that also
 * needs the token itself or a submit guard, use the useTurnstile hook (use-turnstile.ts) this is built on.
 * Without a site key it renders nothing.
 */
function Turnstile({
  siteKey,
  action,
  cData,
  appearance,
  size,
  language,
  theme,
  fieldName,
  nonce,
  onStatusChange,
  resetKey,
  className,
  ...props
}: TurnstileOptions &
  Omit<React.ComponentProps<"div">, "children" | "ref"> & {
    /** Change it to ask for a fresh token, such as after a submission. */
    resetKey?: unknown;
  }) {
  const { mount, reset } = useTurnstile({
    siteKey,
    action,
    cData,
    appearance,
    size,
    language,
    theme,
    fieldName,
    nonce,
    onStatusChange,
  });
  const previousKey = React.useRef(resetKey);
  React.useEffect(() => {
    if (Object.is(resetKey, previousKey.current)) return;
    previousKey.current = resetKey;
    reset();
  }, [resetKey, reset]);

  if (!siteKey) return null;
  return <div ref={mount} data-slot="turnstile" className={cn("max-w-full", className)} {...props} />;
}

export { Turnstile };
