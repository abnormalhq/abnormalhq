/**
 * The redeem form's submit flow (no DOM, no direct requests): local validation -> verify redeem code -> check the count and the domain -> activate -> re-verify the redeem code if anything failed.
 * OnboardForm passes in the latest state, dispatch and the network requests; tests/submit.test.ts runs it directly with the reducer and a fake API.
 * The rows' ids and usernames are recorded at submit time (submitted); results and errors are matched to that, not to the rows' current positions.
 * When the backend has human verification on, the activation request carries the Turnstile token; a token can be used once, so a new one is fetched after the request whether it succeeded or not.
 */
import type { Copy, Lang } from "@/storefront/i18n";
import { forgetCreatedAddress } from "@/storefront/lib/address";
import { ApiError, type CdkInfo, type RedeemInput, type RedeemResult } from "@/storefront/lib/api";
import {
  REDEEM_MAX_MAILBOXES,
  isCdkComplete,
  normalizeCdk,
  normalizeEmail,
  normalizeUsername,
  notifyProblem,
  passwordProblem,
  usernameProblem,
} from "@/storefront/lib/onboard";
import { currentDomain, duplicateOf, type Action, type State, type SubmittedRow } from "./reducer";

export interface SubmitDeps {
  t: Copy;
  lang: Lang;
  defaultDomain: string;
  /** The latest form state. */
  state: () => State;
  dispatch: (action: Action) => void;
  /** Verify the redeem code: returns at once if the same one was already verified (force re-verifies); on failure the reason is already below the field and null is returned. */
  lookup: (force?: boolean) => Promise<CdkInfo | null>;
  redeem: (input: RedeemInput) => Promise<RedeemResult>;
  /** Human verification (useTurnstile from Turnstile.tsx): token() is the current token, empty when verification is off or not yet obtained; reset() invalidates it and fetches a new one. */
  challenge: { token: () => string; reset: () => void };
  /** Turns a request failure into a human-readable sentence. */
  describe: (error: unknown) => string;
}

export async function submitRedeem(deps: SubmitDeps): Promise<void> {
  const { t, dispatch } = deps;
  const current = deps.state();
  dispatch({ type: "submit/start" });
  if (!isCdkComplete(current.code)) {
    dispatch({
      type: "field/error",
      field: "code",
      index: null,
      text: current.code ? t.msg.codeIncomplete : t.msg.codeRequired,
    });
    return;
  }
  const rows = current.rows.map((row) => ({ ...row, username: normalizeUsername(row.username) }));
  const submitted: SubmittedRow[] = rows.map((row) => ({ id: row.id, username: row.username }));
  const mailboxes: { username: string; password: string }[] = [];
  for (const [index, row] of rows.entries()) {
    const fail = (field: "username" | "password", text: string) =>
      dispatch({ type: "field/error", field, index, submitted, text });
    const usernameIssue = usernameProblem(row.username);
    if (usernameIssue) return fail("username", t.problem.username[usernameIssue]);
    const duplicate = duplicateOf(rows, row);
    if (duplicate) return fail("username", t.msg.duplicateUsername(duplicate));
    const passwordIssue = passwordProblem(row.password);
    if (passwordIssue) return fail("password", t.problem.password[passwordIssue]);
    mailboxes.push({ username: row.username, password: row.password });
  }
  const notify = normalizeEmail(current.notify);
  const notifyIssue = notify ? notifyProblem(notify) : null;
  if (notifyIssue) {
    dispatch({ type: "field/error", field: "notify", index: null, text: t.problem.notify[notifyIssue] });
    return;
  }

  const code = normalizeCdk(current.code);
  // The redeem code has not been verified before submitting (just pasted, still waiting for the pause): the verified quota may be smaller than the rows filled in.
  const checked = current.cdk !== null && current.cdkCode === code;
  // Human verification was known to be required before submitting: the widget is already running (the site key comes with the check result, and the widget is removed when the redeem code changes).
  const challengeShown = Boolean(current.cdk?.turnstileSiteKey);
  dispatch({ type: "busy", on: true });
  try {
    const info = await deps.lookup();
    if (!info) {
      dispatch({ type: "focus", target: "code" });
      return;
    }
    const allowed = Math.max(1, Math.min(info.usesLeft, REDEEM_MAX_MAILBOXES));
    if (!checked && mailboxes.length > allowed) {
      // Extra filled rows were just dropped and the count says why: let the user check first rather than submitting the old batch.
      dispatch({ type: "focus", target: "count" });
      return;
    }
    if (mailboxes.length > info.usesLeft) {
      dispatch({ type: "field/error", field: "count", index: null, text: t.kind.count_exceeded });
      return;
    }
    if (info.turnstileSiteKey && !challengeShown && !deps.challenge.token()) {
      // This check is the first to say human verification is needed and the widget has not started yet: sending now would only be rejected and waste one activation rate-limit slot.
      // Say so first; the submit button is disabled until verification completes, then focus returns to it.
      dispatch({ type: "form/error", text: t.msg.challengePending });
      return;
    }
    const chosen = deps.state().domain;
    const domain = info.domains.includes(chosen) ? chosen : (info.domains[0] ?? deps.defaultDomain);
    if (!checked && domain !== currentDomain(current)) {
      // The rows showed another domain while they were filled in, and the addresses only just changed: say so and let the user check them rather than activating on a domain never seen.
      dispatch({ type: "form/error", text: t.msg.domainChanged(domain) });
      return;
    }
    const turnstileToken = deps.challenge.token();
    let outcome: RedeemResult;
    try {
      outcome = await deps.redeem({
        code,
        domain,
        mailboxes,
        ...(notify ? { notify, lang: deps.lang } : {}),
        ...(turnstileToken ? { turnstileToken } : {}),
      });
    } finally {
      // A token can be used once: fetch a new one whether this succeeded or not, so the next submit can pass.
      deps.challenge.reset();
    }
    dispatch({ type: "outcome", result: outcome, submitted });
    // The address picked in the address check started the first row; if it now exists, also in a batch that partly failed, it is done.
    forgetCreatedAddress(outcome.mailboxes.flatMap((item) => (item.ok ? [item.email] : [])));
    // Something failed: the quota changed, so verify the redeem code once more.
    if (outcome.mailboxes.some((item) => !item.ok)) await deps.lookup(true);
  } catch (error) {
    if (error instanceof ApiError && (error.field || error.index !== null)) {
      dispatch({ type: "field/error", field: error.field, index: error.index, submitted, text: deps.describe(error) });
    } else {
      dispatch({ type: "form/error", text: deps.describe(error) });
    }
  } finally {
    dispatch({ type: "busy", on: false });
  }
}
