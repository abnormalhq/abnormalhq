"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Input } from "@/components/ui/input";
import { Eyebrow } from "@/components/ui/section-heading";
import { TextLink } from "@/components/ui/text-link";
import type { Lang } from "@/data/site";
import type { Copy } from "@/i18n/types";
import { localePath } from "@/i18n/paths";

/** A request for future access only: never signs in, grants a license or opens the private product. */
export function DoppelWaitlist({ lang, copy: w }: { lang: Lang; copy: Copy["waitlist"] }) {
  const [state, setState] = useState<"idle" | "pending" | "success" | "invalid" | "rateLimited" | "unavailable">(
    "idle",
  );
  const submitting = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
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
      if (response.ok && typeof result === "object" && result !== null && "ok" in result && result.ok === true) {
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
          <form
            onSubmit={submit}
            aria-labelledby="waitlist-title"
            aria-describedby="waitlist-description"
            className="min-w-0 self-center"
          >
            {process.env.NODE_ENV === "development" && (
              <p className="mb-3 text-sm/prose text-muted-foreground">{w.preview}</p>
            )}
            <label htmlFor="waitlist-email" className="mb-2 block text-sm/body font-medium">
              {w.email}
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
                {state === "pending" ? w.submitting : w.submit}
              </Button>
            </div>
            <p id="waitlist-privacy" className="mt-3 text-sm/prose text-muted-foreground">
              {w.privacy}{" "}
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
              {state === "success" ? w.success : error ? w[state] : ""}
            </p>
          </form>
        </div>
      </section>
    </Container>
  );
}
