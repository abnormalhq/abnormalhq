"use client";

/**
 * The redeem page's interaction: the redeem code is verified as typed (showing the domains it can activate and how many are left), after picking a count each mailbox gets a row for username and password
 * (the username is checked for availability live, the password against the rules live), an optional notification address, and one submit activates them all; successes are listed in the result
 * (saying whether the account details were sent when a notification address was given), failures stay in the form to be fixed.
 * All state changes live in reducer.ts and the submit flow in submit.ts; this file only handles input events, timers, network requests and focus.
 * While a request is in flight the whole form is frozen (fieldset disabled) and nothing can change until the result arrives.
 */
import { useEffect, useMemo, useReducer, useRef, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldMessage } from "@/components/ui/field-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { copy, formatDate, type Lang } from "@/storefront/i18n";
import { ApiError, NetworkError, REDEEM_TURNSTILE_ACTION, createApi, type CdkInfo } from "@/storefront/lib/api";
import {
  REDEEM_MAX_MAILBOXES,
  formatCdk,
  generatePassword,
  isCdkComplete,
  normalizeCdk,
  normalizeUsername,
  usernameProblem,
} from "@/storefront/lib/onboard";
import { cn } from "@/lib/utils";
import { useTurnstile } from "../Turnstile";
import { AccountRow, fieldLabelClass, type RowInputs } from "./AccountRow";
import { celebrate } from "./celebrate";
import { Msg } from "./Msg";
import { ResultPanel, panelClass } from "./ResultPanel";
import { submitRedeem } from "./submit";
import {
  NO_NOTE,
  allowedCount,
  createReducer,
  currentDomain,
  domainsOf,
  duplicateOf,
  initialState,
  note,
  rowEmail,
  type Focus,
} from "./reducer";

/** One step of the form: a numbered square on the left; the step being filled in is "current" and its number turns ink-on-highlight-yellow. */
const stepClass =
  "relative grid grid-cols-[28px_minmax(0,1fr)] items-start gap-x-3.5 gap-y-4 border-b border-border py-[25px] [counter-increment:step] before:grid before:size-7 before:place-items-center before:rounded-chip before:border before:border-border before:bg-background before:text-xs/body before:text-muted-foreground before:transition-colors before:duration-150 before:content-[counter(step,decimal-leading-zero)] focus-within:before:border-highlight-foreground focus-within:before:bg-highlight focus-within:before:font-semibold focus-within:before:text-highlight-foreground max-narrow:grid-cols-[24px_minmax(0,1fr)] max-narrow:gap-x-2.5 max-narrow:gap-y-3.5 max-narrow:py-[22px] max-narrow:before:size-6 max-narrow:before:rounded-[7px]";
const stepLabelClass =
  "flex min-h-7 flex-wrap items-center gap-2 text-md/[1.4] font-semibold tracking-[-0.01em] max-narrow:min-h-6";
const stepHintClass = "mt-1 text-sm/[1.6] text-pretty text-muted-foreground";
const stepControlClass = "col-start-2 min-w-0 max-narrow:col-span-full max-narrow:col-start-1";
const inputClass =
  "block h-auto min-h-10 py-2 hover:border-[color-mix(in_oklab,var(--input),var(--text)_15%)] aria-invalid:focus-visible:border-destructive";

const LOOKUP_DELAY_MS = 350;
const USERNAME_DELAY_MS = 500;

interface Props {
  lang: Lang;
  /** mailhq's address (no trailing slash); in local development it is this site's mock API. */
  apiBase: string;
  defaultDomain: string;
  supportEmail: string;
  /** This page's path, which the "Redeem again" link points back to. */
  homePath: string;
}

export function OnboardForm({ lang, apiBase, defaultDomain, supportEmail, homePath }: Props) {
  const t = copy[lang];
  const api = useMemo(() => createApi(apiBase, undefined, lang), [apiBase, lang]);
  const reducer = useMemo(() => createReducer(t), [t]);
  const [state, dispatch] = useReducer(reducer, defaultDomain, initialState);
  // The redeem code check came back with a site key, so activation requires Turnstile first.
  const check = useTurnstile(state.cdk?.turnstileSiteKey ?? null, REDEEM_TURNSTILE_ACTION, lang);

  // Timer and request callbacks need the latest state, so a ref follows every render.
  const stateRef = useRef(state);
  stateRef.current = state;

  const lookupTimer = useRef(0);
  const lookupAbort = useRef<AbortController | null>(null);
  const rowTimers = useRef(new Map<number, number>());
  const rowAborts = useRef(new Map<number, AbortController>());

  const codeInput = useRef<HTMLInputElement>(null);
  const domainSelect = useRef<HTMLSelectElement>(null);
  const countSelect = useRef<HTMLSelectElement>(null);
  const notifyInput = useRef<HTMLInputElement>(null);
  const submitButton = useRef<HTMLButtonElement>(null);
  const resultTitle = useRef<HTMLHeadingElement>(null);
  const rowInputs = useRef(new Map<number, RowInputs>());

  function describe(error: unknown): string {
    if (error instanceof ApiError)
      return error.kind === "other" ? error.message || t.msg.unknownError : t.kind[error.kind];
    if (error instanceof NetworkError) return t.msg.networkError;
    return t.msg.unknownError;
  }

  /* ---- Redeem code ---- */

  function cancelLookup(): void {
    window.clearTimeout(lookupTimer.current);
    lookupAbort.current?.abort();
    lookupAbort.current = null;
  }

  /** Verify the redeem code. Returns at once if the same one was already verified (force re-verifies); on failure the reason goes below the field and null is returned. */
  async function lookup(force = false): Promise<CdkInfo | null> {
    const current = stateRef.current;
    const code = normalizeCdk(current.code);
    if (!isCdkComplete(code)) return null;
    if (!force && current.cdk && current.cdkCode === code) return current.cdk;
    lookupAbort.current?.abort();
    const controller = new AbortController();
    lookupAbort.current = controller;
    dispatch({ type: "code/checking" });
    try {
      const info = await api.lookup(code, controller.signal);
      if (controller.signal.aborted) return null;
      dispatch({
        type: "code/resolved",
        code,
        info,
        expires: info.expiresAt ? formatDate(info.expiresAt, lang) : null,
      });
      // Usernames already entered are re-checked for availability under the new redeem code (and domain).
      for (const row of stateRef.current.rows) if (row.username) scheduleCheck(row.id);
      return info;
    } catch (error) {
      if (controller.signal.aborted) return null;
      dispatch({ type: "code/failed", code, text: describe(error) });
      return null;
    } finally {
      if (lookupAbort.current === controller) lookupAbort.current = null;
    }
  }

  function onCodeInput(input: HTMLInputElement): void {
    cancelLookup();
    dispatch({ type: "code/input", value: input.value });
    if (isCdkComplete(formatCdk(input.value))) {
      lookupTimer.current = window.setTimeout(() => void lookup(), LOOKUP_DELAY_MS);
    }
  }

  /* ---- Account rows ---- */

  function cancelCheck(id: number): void {
    window.clearTimeout(rowTimers.current.get(id));
    rowTimers.current.delete(id);
    rowAborts.current.get(id)?.abort();
    rowAborts.current.delete(id);
  }

  /** After a half-second pause ask the server whether this row is available; re-check the conditions when the time comes. */
  function scheduleCheck(id: number): void {
    cancelCheck(id);
    rowTimers.current.set(
      id,
      window.setTimeout(() => {
        rowTimers.current.delete(id);
        void checkUsername(id);
      }, USERNAME_DELAY_MS),
    );
  }

  async function checkUsername(id: number): Promise<void> {
    const current = stateRef.current;
    const row = current.rows.find((r) => r.id === id);
    if (!row || !current.cdk) return;
    const username = normalizeUsername(row.username);
    if (!username || usernameProblem(username) || duplicateOf(current.rows, row)) return;
    const email = rowEmail(current, row);
    if (row.availableEmail === email) return;
    rowAborts.current.get(id)?.abort();
    const controller = new AbortController();
    rowAborts.current.set(id, controller);
    dispatch({ type: "row/checking", id, email });
    try {
      await api.checkUsername({ code: current.cdkCode, domain: currentDomain(current), username }, controller.signal);
      if (controller.signal.aborted) return;
      dispatch({ type: "row/available", id, email });
    } catch (error) {
      if (controller.signal.aborted) return;
      dispatch({ type: "row/check-failed", id, email, text: describe(error) });
    } finally {
      if (rowAborts.current.get(id) === controller) rowAborts.current.delete(id);
    }
  }

  function changeUsername(id: number, value: string): void {
    // Rows that repeated an earlier username may be free of it after this edit: they are checked too (the check itself skips a row that is still a duplicate).
    const before = stateRef.current.rows;
    dispatch({ type: "row/username", id, value });
    scheduleCheck(id);
    for (const row of before) if (row.id !== id && duplicateOf(before, row)) scheduleCheck(row.id);
  }

  function onUsernameInput(id: number, input: HTMLInputElement): void {
    // Upper-case letters are lower-cased as typed with the caret kept in place; @ and what follows are removed on blur, so a half-typed entry is not cut off.
    const lowered = input.value.toLowerCase();
    if (lowered !== input.value) {
      const caret = input.selectionStart;
      input.value = lowered;
      if (caret !== null) input.setSelectionRange(caret, caret);
    }
    changeUsername(id, lowered);
  }

  function onUsernameBlur(id: number, input: HTMLInputElement): void {
    const normalized = normalizeUsername(input.value);
    if (normalized === input.value) return;
    changeUsername(id, normalized);
  }

  function onDomainChange(value: string): void {
    dispatch({ type: "domain/change", value });
    for (const row of stateRef.current.rows) if (row.username) scheduleCheck(row.id);
  }

  function registerRowInput(id: number, field: keyof RowInputs, input: HTMLInputElement | null) {
    const inputs = rowInputs.current.get(id) ?? {
      username: null,
      password: null,
    };
    inputs[field] = input;
    if (!inputs.username && !inputs.password) rowInputs.current.delete(id);
    else rowInputs.current.set(id, inputs);
  }

  // Once a row is removed, its pending timer and request are void with it.
  const rowIds = state.rows.map((row) => row.id).join(",");
  useEffect(() => {
    const alive = new Set(rowIds.split(",").map(Number));
    for (const id of [...rowTimers.current.keys(), ...rowAborts.current.keys()]) if (!alive.has(id)) cancelCheck(id);
  }, [rowIds]);

  useEffect(
    () => () => {
      cancelLookup();
      for (const id of [...rowTimers.current.keys(), ...rowAborts.current.keys()]) cancelCheck(id);
    },
    [],
  );

  /* ---- Focus ---- */

  function focusElement(focus: Focus): HTMLElement | null | undefined {
    switch (focus.target) {
      case "code":
        return codeInput.current;
      case "domain":
        return domainSelect.current;
      case "count":
        return countSelect.current;
      case "notify":
        return notifyInput.current;
      case "result":
        return resultTitle.current;
      case "submit":
        return submitButton.current;
      case "username":
      case "password":
        return rowInputs.current.get(focus.id)?.[focus.target];
    }
  }

  // The form is disabled while submitting and a disabled input cannot take focus: wait for the request to finish, and move each focus only once.
  // The submit button is also disabled while Turnstile fetches a new token: when focus should return to it, wait until it can be pressed; if the visitor clicked elsewhere meanwhile
  // (an input, the Turnstile box that needs a click), do not steal focus.
  const submitWaiting = check.waiting;
  const focusedSeq = useRef(0);
  const deferredSeq = useRef(0);
  useEffect(() => {
    if (!state.focus || state.busy || focusedSeq.current === state.focus.seq) return;
    if (state.focus.target === "submit") {
      if (submitWaiting) {
        deferredSeq.current = state.focus.seq;
        return;
      }
      const active = document.activeElement;
      const movedOn = active !== null && active !== document.body && !active.matches(":disabled");
      if (deferredSeq.current === state.focus.seq && movedOn) {
        focusedSeq.current = state.focus.seq;
        return;
      }
    }
    focusedSeq.current = state.focus.seq;
    const element = focusElement(state.focus);
    if (state.focus.target === "result") {
      // Settle the success heading's position first so the confetti does not fire from off-screen during smooth scrolling.
      element?.focus({ preventScroll: true });
      element?.scrollIntoView({ behavior: "instant", block: "center" });
    } else {
      element?.focus();
    }
  }, [state.focus, state.busy, submitWaiting]);

  // Celebrate when everything activated; the focus effect already scrolled the heading into view, and leaving the page stops the confetti.
  useEffect(() => {
    if (!state.formHidden) return;
    const controller = new AbortController();
    void celebrate(resultTitle.current, controller.signal);
    return () => controller.abort();
  }, [state.formHidden]);

  /* ---- Submit ---- */

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (stateRef.current.busy) return;
    void submit();
  }

  async function submit(): Promise<void> {
    await submitRedeem({
      t,
      lang,
      defaultDomain,
      state: () => stateRef.current,
      dispatch,
      lookup: (force) => {
        window.clearTimeout(lookupTimer.current);
        return lookup(force);
      },
      redeem: (input) => api.redeem(input),
      challenge: check,
      describe,
    });
  }

  /* ---- Render ---- */

  const domains = domainsOf(state);
  const domain = currentDomain(state);
  const allowed = allowedCount(state);
  const showDomain = domains.length > 1;
  const showCount = allowed > 1 || state.countError !== null;
  const countNote =
    state.countError !== null
      ? note(state.countError, "error")
      : state.cdk && allowed > 1
        ? note(t.msg.countHint(state.cdk.usesLeft, REDEEM_MAX_MAILBOXES))
        : NO_NOTE;
  const multiple = state.rows.length > 1;

  return (
    <>
      <div hidden={state.formHidden}>
        <Card asChild className={panelClass}>
          <form noValidate aria-busy={state.busy || undefined} onSubmit={onSubmit}>
            <div className="flex items-start justify-between gap-[18px] border-b border-border pb-[26px] max-desk:flex-wrap max-desk:gap-2.5 max-narrow:pb-5">
              <div>
                <h2 className="text-xl max-narrow:text-[18px] max-narrow:leading-[1.4]">{t.ui.formTitle}</h2>
                <p className="mt-[7px] text-sm/body text-muted-foreground">{t.ui.formDescription}</p>
              </div>
              <Badge className="gap-1.5 border-0 bg-highlight-muted text-xs/body text-foreground">
                <span className="size-[5px] rounded-full bg-success" aria-hidden="true" />
                {t.ui.formBadge}
              </Badge>
            </div>
            {/* The whole form is frozen while the request is in flight: results are matched to the rows as submitted, so edits made after submitting are never taken as activated. */}
            <fieldset disabled={state.busy} className="m-0 min-w-0 border-0 p-0">
              <ol className="[counter-reset:step]">
                <li className={stepClass}>
                  <div>
                    <Label className={stepLabelClass} htmlFor="code">
                      {t.steps.code.label}
                    </Label>
                    <p className={stepHintClass}>{t.steps.code.hint}</p>
                  </div>
                  <div className={stepControlClass}>
                    <Input
                      className={cn(inputClass, "font-mono tracking-[0.1em] uppercase max-narrow:tracking-[0.02em]")}
                      id="code"
                      name="code"
                      type="text"
                      inputMode="text"
                      autoComplete="one-time-code"
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder={t.steps.code.placeholder}
                      aria-describedby="code-msg"
                      aria-invalid={state.codeInvalid || undefined}
                      value={state.code}
                      onChange={(event) => onCodeInput(event.currentTarget)}
                      onBlur={() => dispatch({ type: "code/blur" })}
                      ref={codeInput}
                    />
                    <Msg id="code-msg" note={state.codeNote} />
                  </div>
                </li>
                <li className={stepClass} hidden={!showDomain && !showCount}>
                  <div>
                    <span className={stepLabelClass}>{t.steps.options.label}</span>
                    <p className={stepHintClass}>{t.steps.options.hint}</p>
                  </div>
                  <div className={cn(stepControlClass, "grid grid-cols-2 gap-4 max-narrow:grid-cols-[1fr]")}>
                    <div className="min-w-0" hidden={!showDomain}>
                      <Label className={fieldLabelClass} htmlFor="domain">
                        {t.steps.options.domain}
                      </Label>
                      <NativeSelect
                        className={cn(inputClass, "cursor-pointer [&_option]:bg-transparent")}
                        id="domain"
                        name="domain"
                        aria-invalid={state.domainInvalid || undefined}
                        value={domain}
                        onChange={(event) => onDomainChange(event.currentTarget.value)}
                        ref={domainSelect}
                      >
                        {domains.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                    <div className="min-w-0" hidden={!showCount}>
                      <Label className={fieldLabelClass} htmlFor="count">
                        {t.steps.options.count}
                      </Label>
                      <NativeSelect
                        className={cn(inputClass, "cursor-pointer [&_option]:bg-transparent")}
                        id="count"
                        name="count"
                        aria-describedby="count-msg"
                        aria-invalid={state.countError !== null || undefined}
                        value={String(Math.min(state.rows.length, allowed))}
                        onChange={(event) =>
                          dispatch({
                            type: "count/change",
                            value: Number(event.currentTarget.value) || 1,
                          })
                        }
                        ref={countSelect}
                      >
                        {Array.from({ length: allowed }, (_, i) => String(i + 1)).map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </NativeSelect>
                      <Msg id="count-msg" note={countNote} />
                    </div>
                  </div>
                </li>
                <li className={stepClass}>
                  <div>
                    <span className={stepLabelClass}>{t.steps.accounts.label}</span>
                    <p className={stepHintClass}>{t.steps.accounts.hint}</p>
                    {state.cdk?.quotaSupportedByDomain?.[domain] === false && (
                      <p className={stepHintClass}>{t.steps.accounts.noQuota}</p>
                    )}
                  </div>
                  <div className={stepControlClass}>
                    <div className="grid gap-5 [&>*+*]:border-t [&>*+*]:border-dashed [&>*+*]:border-border [&>*+*]:pt-5">
                      {state.rows.map((row, index) => (
                        <AccountRow
                          key={row.id}
                          t={t}
                          row={row}
                          ordinal={index + 1}
                          multiple={multiple}
                          domain={domain}
                          onUsernameInput={onUsernameInput}
                          onUsernameBlur={onUsernameBlur}
                          onPasswordInput={(id, value) => dispatch({ type: "row/password", id, value })}
                          onTogglePassword={(id) => dispatch({ type: "row/toggle-password", id })}
                          onGeneratePassword={(id) =>
                            dispatch({
                              type: "row/generated",
                              id,
                              password: generatePassword(),
                            })
                          }
                          register={registerRowInput}
                        />
                      ))}
                    </div>
                  </div>
                </li>
                <li className={stepClass}>
                  <div>
                    <Label className={stepLabelClass} htmlFor="notify">
                      {t.steps.notify.label}
                      <Badge className="h-auto rounded-control border-0 px-1.5 py-px text-xs/[1.4] tracking-normal">
                        {t.ui.optional}
                      </Badge>
                    </Label>
                    <p className={stepHintClass}>{t.steps.notify.hint}</p>
                  </div>
                  <div className={stepControlClass}>
                    <Input
                      className={inputClass}
                      id="notify"
                      name="notify"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder={t.steps.notify.placeholder}
                      maxLength={254}
                      aria-describedby="notify-msg"
                      aria-invalid={state.notifyInvalid || undefined}
                      value={state.notify}
                      onChange={(event) =>
                        dispatch({
                          type: "notify/input",
                          value: event.currentTarget.value,
                        })
                      }
                      onBlur={() => dispatch({ type: "notify/blur" })}
                      ref={notifyInput}
                    />
                    <Msg id="notify-msg" note={state.notifyNote} />
                  </div>
                </li>
              </ol>
            </fieldset>
            <div className="mt-[26px] flex flex-col items-stretch gap-3 pl-[42px] max-narrow:mt-[22px] max-narrow:pl-0">
              {check.widget}
              <Button
                ref={submitButton}
                type="submit"
                size="lg"
                className="h-auto min-h-10 gap-2.5 py-2 whitespace-normal disabled:cursor-progress"
                disabled={state.busy || check.waiting}
              >
                {state.busy ? t.buttons.submitting : t.buttons.submit(state.rows.length)}
                {state.busy ? (
                  <Spinner />
                ) : (
                  <span className="text-lg/none font-normal" aria-hidden="true">
                    ↗
                  </span>
                )}
              </Button>
              <p className="text-center text-xs/[1.7] text-muted-foreground">{t.submitNote}</p>
            </div>
            <Msg
              className="not-empty:mt-[18px] not-empty:rounded-control not-empty:bg-destructive/8 not-empty:px-3 not-empty:py-2.5"
              live="assertive"
              note={state.formNote}
            />
            <noscript>
              <FieldMessage tone="error">{t.noscript}</FieldMessage>
            </noscript>
          </form>
        </Card>
      </div>
      <ResultPanel
        t={t}
        issued={state.issued}
        outcome={state.outcome}
        supportEmail={supportEmail}
        homePath={homePath}
        titleRef={resultTitle}
      />
    </>
  );
}
