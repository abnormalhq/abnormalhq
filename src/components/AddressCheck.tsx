"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldMessage } from "@/components/ui/field-message";
import { InputGroup, InputGroupInput, InputGroupSuffix } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { Lang } from "@/data/site";
import type { Copy } from "@/i18n/types";
import { fillText } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { rememberAddress, shopHref, type ChosenAddress } from "@/storefront/lib/address";
import { catalogDomains, checkAddress, ShopApiError, type ShopCatalog } from "@/storefront/lib/catalog";
import { sharedCatalog, subscribeCatalog } from "@/storefront/lib/catalog-shared";
import { normalizeUsername, usernameProblem } from "@/storefront/lib/onboard";
import { Icon } from "./Icon";

/** The pause after typing before the server is asked, the same as the redeem form's username check. */
const CHECK_DELAY_MS = 500;

type Result =
  | { state: "idle" }
  | { state: "invalid" }
  | { state: "checking" }
  | { state: "available"; address: ChosenAddress }
  | { state: "taken"; email: string }
  | { state: "failed"; text: string };

/**
 * "Check your address": type a username, pick one of the domains the plans on sale offer, and see whether it is free, before buying.
 * The username follows the redeem form's rules (src/storefront/lib/onboard.ts) and is checked the same way: validated as typed,
 * then asked of the server half a second after typing stops, with an earlier request dropped when a newer one starts.
 * A free address leads to the shop with the address carried along (src/storefront/lib/address.ts).
 *
 * The check exists only when the backend says so: the catalog carries `addressCheck` (POST /api/shop/address, described in
 * docs/storefront-api.md). Without the flag this renders nothing, and if the endpoint still answers 404 the form goes away.
 * `domains` comes from the server on the pricing page, which has already read the catalog; in the home page's hero it is left out
 * and the catalog is read here.
 */
export function AddressCheck({
  lang,
  copy,
  shop,
  domains: given,
  className,
}: {
  lang: Lang;
  copy: Copy["pricing"]["check"];
  /** The shop page in this language. */
  shop: string;
  domains?: readonly string[];
  className?: string;
}) {
  const id = useId();
  const [loaded, setLoaded] = useState<readonly string[] | null>(null);
  const [hidden, setHidden] = useState(false);
  const [username, setUsername] = useState("");
  const [chosenDomain, setChosenDomain] = useState("");
  const [result, setResult] = useState<Result>({ state: "idle" });
  const timer = useRef(0);
  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    if (given) return;
    let current = true;
    const show = (catalog: ShopCatalog) =>
      current && setLoaded(catalog.available && catalog.addressCheck ? catalogDomains(catalog) : []);
    // No catalog, no domains to offer: the check stays out of the page, and the pricing section says what went wrong.
    sharedCatalog(lang).then(show, () => current && setLoaded([]));
    // The pricing section's "Try again" reads the catalog anew; its answer brings the check back.
    const unsubscribe = subscribeCatalog(lang, show);
    return () => {
      current = false;
      unsubscribe();
    };
  }, [given, lang]);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      request.current?.abort();
    },
    [],
  );

  const domains = given ?? loaded ?? [];
  const domain = domains.includes(chosenDomain) ? chosenDomain : (domains[0] ?? "");
  if (hidden || domains.length === 0) return null;

  function cancel(): void {
    window.clearTimeout(timer.current);
    request.current?.abort();
    request.current = null;
  }

  async function check(name: string, on: string): Promise<void> {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setResult({ state: "checking" });
    try {
      const answer = await checkAddress(on, name, controller.signal, lang);
      if (controller.signal.aborted) return;
      if (answer.available) {
        const address = { username: name, domain: on };
        // Kept for this tab right away, so the address also follows a plan card's link to the shop.
        rememberAddress(address);
        setResult({ state: "available", address });
      } else {
        setResult({ state: "taken", email: answer.email });
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      const status = error instanceof ShopApiError ? error.status : 0;
      // A backend without the endpoint: there is no check to offer.
      if (status === 404) setHidden(true);
      else if (status === 400) setResult({ state: "invalid" });
      else setResult({ state: "failed", text: status === 429 ? copy.rateLimited : copy.failed });
    } finally {
      if (request.current === controller) request.current = null;
    }
  }

  /** Validates what is typed at once and asks the server after the pause, or straight away when the form is submitted. */
  function schedule(raw: string, on: string, delay = CHECK_DELAY_MS): void {
    cancel();
    const name = normalizeUsername(raw);
    const problem = usernameProblem(name);
    if (problem) {
      setResult(problem === "required" ? { state: "idle" } : { state: "invalid" });
      return;
    }
    setResult({ state: "idle" });
    timer.current = window.setTimeout(() => void check(name, on), delay);
  }

  const message =
    result.state === "invalid"
      ? copy.invalid
      : result.state === "checking"
        ? copy.checking
        : result.state === "available"
          ? fillText(copy.available, { email: `${result.address.username}@${result.address.domain}` })
          : result.state === "taken"
            ? fillText(copy.taken, { email: result.email })
            : result.state === "failed"
              ? result.text
              : "";
  const tone =
    result.state === "available"
      ? "ok"
      : result.state === "checking"
        ? "busy"
        : result.state === "idle"
          ? "default"
          : "error";
  const invalid = result.state === "invalid" || result.state === "taken";

  return (
    <form
      className={cn("text-left", className)}
      aria-labelledby={`${id}-title`}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        schedule(username, domain, 0);
      }}
    >
      <p className="text-sm/body font-medium" id={`${id}-title`}>
        {copy.title}
      </p>
      <p className="mt-1 text-sm/[1.6] text-muted-foreground" id={`${id}-hint`}>
        {copy.hint}
      </p>
      <Label className="sr-only" htmlFor={`${id}-username`}>
        {copy.usernameLabel}
      </Label>
      <div className="mt-3 flex gap-2 max-phone:flex-col">
        <InputGroup size="lg" className="min-w-0 flex-1">
          <InputGroupInput
            id={`${id}-username`}
            type="text"
            // Not a sign-in: no autofill of saved usernames into a name search.
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            placeholder={copy.placeholder}
            maxLength={64}
            aria-describedby={`${id}-hint ${id}-result`}
            aria-invalid={invalid || undefined}
            value={username}
            onChange={(event) => {
              // Upper-case letters are lower-cased as typed with the caret kept in place, as on the redeem form.
              const input = event.currentTarget;
              const lowered = input.value.toLowerCase();
              if (lowered !== input.value) {
                const caret = input.selectionStart;
                input.value = lowered;
                if (caret !== null) input.setSelectionRange(caret, caret);
              }
              setUsername(lowered);
              schedule(lowered, domain);
            }}
            onBlur={() => {
              // A pasted full address loses its @ and what follows once the field is left, not while it is being typed.
              const name = normalizeUsername(username);
              if (name !== username) setUsername(name);
            }}
          />
          {domains.length === 1 && <InputGroupSuffix>@{domain}</InputGroupSuffix>}
        </InputGroup>
        {domains.length > 1 && (
          <NativeSelect
            size="lg"
            className="w-auto max-w-[55%] cursor-pointer max-phone:max-w-none"
            aria-label={copy.domainLabel}
            value={domain}
            onChange={(event) => {
              setChosenDomain(event.currentTarget.value);
              schedule(username, event.currentTarget.value);
            }}
          >
            {domains.map((value) => (
              <option key={value} value={value}>
                @{value}
              </option>
            ))}
          </NativeSelect>
        )}
      </div>
      <FieldMessage tone={tone} id={`${id}-result`}>
        {message || null}
      </FieldMessage>
      {result.state === "available" && (
        <div className="mt-3">
          <Button asChild size="lg">
            <a href={shopHref(shop, { address: result.address })}>
              {copy.proceed} <Icon name="arrow" className="size-4" />
            </a>
          </Button>
          <p className="mt-2.5 text-xs/[1.65] text-muted-foreground">{copy.note}</p>
        </div>
      )}
    </form>
  );
}
