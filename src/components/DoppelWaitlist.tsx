"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Input } from "@/components/ui/input";
import { Eyebrow } from "@/components/ui/section-heading";
import { TextLink } from "@/components/ui/text-link";
import type { Lang } from "@/data/site";
import type { Copy } from "@/i18n/types";
import { localePath } from "@/i18n/paths";
import type { WaitlistMode } from "@/lib/waitlist";

/** A request for future access only: never signs in, grants a license or opens the private product. */
export function DoppelWaitlist({ lang, copy: w }: { lang: Lang; copy: Copy["waitlist"] }) {
  const [mode, setMode] = useState<WaitlistMode | "checking" | "unavailable">("checking");
  const [state, setState] = useState<"idle" | "pending" | "success" | "invalid" | "rateLimited" | "unavailable">(
    "idle",
  );
  // The checking line is only for a live request: without JavaScript the noscript copy below is the one that stays.
  const scripted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const submitting = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    async function availability() {
      try {
        const response = await fetch("/api/waitlist/", {
          cache: "no-store",
          signal: controller.signal,
        });
        const result: unknown = await response.json();
        if (!active) return;
        if (
          response.ok &&
          result &&
          typeof result === "object" &&
          "mode" in result &&
          (result.mode === "closed" || result.mode === "preview" || result.mode === "open")
        ) {
          setMode(result.mode);
        } else {
          setMode("unavailable");
        }
      } catch {
        if (active) setMode("unavailable");
      } finally {
        window.clearTimeout(timeout);
      }
    }
    void availability();
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || (mode !== "open" && mode !== "preview")) return;
    const form = event.currentTarget;
    const email = String(new FormData(form).get("email") ?? "").trim();
    submitting.current = true;
    setState("pending");
    try {
      const response = await fetch("/api/waitlist/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, lang }),
        signal: AbortSignal.timeout(15000),
      });
      const result: unknown = await response.json();
      if (result && typeof result === "object" && "mode" in result && result.mode === "closed") {
        form.reset();
        setMode("closed");
      } else if (
        response.ok &&
        typeof result === "object" &&
        result !== null &&
        "ok" in result &&
        result.ok === true &&
        "mode" in result &&
        result.mode === mode
      ) {
        setState("success");
        form.reset();
      } else {
        setState(response.status === 400 ? "invalid" : response.status === 429 ? "rateLimited" : "unavailable");
      }
    } catch {
      setState("unavailable");
    } finally {
      submitting.current = false;
    }
  }

  const error = state === "invalid" || state === "rateLimited" || state === "unavailable";
  // A mock response can never render the real-registration promise.
  const formCopy = mode === "preview" ? { ...w, ...w.preview } : w;
  const canRegister = mode === "open" || mode === "preview";
  return (
    <Container asChild>
      <section id="doppel-waitlist" aria-labelledby="waitlist-title" className="border-t border-border py-10 md:py-14">
        <div className="grid gap-7 md:grid-cols-2 md:gap-12">
          <div>
            <Eyebrow lang="en">{w.eyebrow}</Eyebrow>
            <h2 id="waitlist-title" className="mt-4 font-heading text-3xl/body font-semibold tracking-tight">
              {w.title}
            </h2>
            <p id="waitlist-description" className="mt-3 max-w-lg text-md/prose text-muted-foreground">
              {w.description}
            </p>
          </div>
          <div className="min-w-0 self-center">
            {mode === "checking" && scripted && (
              <p role="status" className="text-md/prose text-muted-foreground">
                {w.checking}
              </p>
            )}
            {mode === "checking" && (
              <noscript>
                <p role="status" className="text-md/prose text-muted-foreground">
                  {w.needJs}
                </p>
              </noscript>
            )}
            {mode === "closed" && (
              <div role="status">
                <h3 className="font-heading text-lg/body font-semibold">{w.closedTitle}</h3>
                <p className="mt-2 text-md/prose text-muted-foreground">{w.closedDescription}</p>
              </div>
            )}
            {mode === "unavailable" && (
              <p role="status" className="text-md/prose text-muted-foreground">
                {w.statusUnavailable}
              </p>
            )}
            {canRegister && (
              <form
                onSubmit={submit}
                aria-labelledby="waitlist-title"
                aria-describedby="waitlist-description"
                className="min-w-0 self-center"
              >
                <p className="mb-3 text-sm/prose text-muted-foreground">
                  {mode === "preview" ? w.preview.description : w.openDescription}
                </p>
                <label htmlFor="waitlist-email" className="mb-2 block text-sm/body font-medium">
                  {formCopy.email}
                </label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Input
                    id="waitlist-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    size="lg"
                    maxLength={254}
                    required
                    disabled={state === "pending"}
                    aria-invalid={state === "invalid"}
                    aria-describedby="waitlist-privacy waitlist-result"
                    onChange={() => {
                      if (state !== "pending") setState("idle");
                    }}
                  />
                  <Button type="submit" size="lg" loading={state === "pending"}>
                    {state === "pending" ? formCopy.submitting : formCopy.submit}
                  </Button>
                </div>
                <p id="waitlist-privacy" className="mt-3 text-sm/prose text-muted-foreground">
                  {formCopy.privacy}{" "}
                  <TextLink variant="inline" href={localePath(lang, "/privacy/")}>
                    {w.privacyLink}
                  </TextLink>
                </p>
                <p
                  id="waitlist-result"
                  role={error ? "alert" : "status"}
                  aria-live="polite"
                  className={`mt-3 text-sm/prose ${error ? "text-destructive" : "text-foreground"}`}
                >
                  {state === "success" ? formCopy.success : error ? formCopy[state] : ""}
                </p>
              </form>
            )}
          </div>
        </div>
      </section>
    </Container>
  );
}
