/**
 * The redeem form's state and every state change (pure functions, no DOM, no requests): OnboardForm drives it with useReducer,
 * the network and timers live in the component and hand results back as actions; every async result carries the redeem code or mailbox address it is for,
 * and is ignored on arrival if the input has changed since. Activation results are matched to the rows as submitted (submitted), not to the rows' current positions. tests/reducer.test.ts runs this directly, so no
 * TypeScript syntax Node cannot run directly (enum, parameter properties).
 */
import type { Copy } from "@/storefront/i18n";
import type { CdkInfo, ErrorField, RedeemNotification, RedeemResult, ServerEndpoint } from "@/storefront/lib/api";
import {
  REDEEM_MAX_MAILBOXES,
  emailAddress,
  formatCdk,
  isCdkComplete,
  normalizeCdk,
  normalizeEmail,
  normalizeUsername,
  notifyProblem,
  passwordMissing,
  passwordProblem,
  usernameProblem,
} from "@/storefront/lib/onboard";

export type MsgState = "" | "ok" | "error" | "busy";

/** One hint line below a field: the text and its tone (plain / success / error / pending). */
export interface Note {
  text: string;
  state: MsgState;
}

export const NO_NOTE: Note = { text: "", state: "" };

export function note(text: string, state: MsgState = ""): Note {
  return { text, state };
}

/** One row of the form: one mailbox's username and password, plus their hints and check states. */
export interface Row {
  id: number;
  username: string;
  password: string;
  showPassword: boolean;
  /** The full mailbox address most recently confirmed available; void after a domain or username change. */
  availableEmail: string;
  usernameNote: Note;
  passwordNote: Note;
  usernameInvalid: boolean;
  passwordInvalid: boolean;
}

/** Credentials of an activated mailbox stay in memory only and are written into the page only when shown. */
export interface Issued {
  email: string;
  password: string;
}

/** Server info returned by the latest activation; with several activations each overwrites the previous one. */
export interface Outcome {
  imap: ServerEndpoint | null;
  smtp: ServerEndpoint | null;
  webmail: string | null;
  notification: RedeemNotification | null;
}

/**
 * Where focus should go after the next render. submit is the submit button: when an error points at no field (network failure etc.) focus returns to it,
 * the reason has been read out by the notice at the bottom of the form, and one press retries; otherwise the control disabled during submit loses focus and focus lands on the page.
 */
export type FocusTarget =
  | { target: "code" | "domain" | "count" | "notify" | "result" | "submit" }
  | { target: "username" | "password"; id: number };

/** One row at submit time: its id and the submitted (normalised) username, in submit order; the index in results refers to this order. */
export interface SubmittedRow {
  id: number;
  username: string;
}

/** seq lets the same target be triggered repeatedly. */
export type Focus = FocusTarget & { seq: number };

export interface State {
  /** The domain shown after the username until the redeem code check completes. */
  defaultDomain: string;
  /** Display form in the input (XXXX-XXXX-...). */
  code: string;
  codeNote: Note;
  codeInvalid: boolean;
  /** The verified redeem code and its info; void as soon as the input changes. */
  cdk: CdkInfo | null;
  cdkCode: string;
  /** The domain the user picked in the dropdown; when not in the redeem code's allowed list the first in the list wins. */
  domain: string;
  domainInvalid: boolean;
  /** Server error pointing at the count; while present the count dropdown is forced visible. */
  countError: string | null;
  rows: Row[];
  nextRowId: number;
  notify: string;
  notifyNote: Note;
  notifyInvalid: boolean;
  busy: boolean;
  formNote: Note;
  issued: Issued[];
  outcome: Outcome | null;
  /** Once everything activated the form is taken down and only the result panel remains. */
  formHidden: boolean;
  focus: Focus | null;
}

export type Action =
  | { type: "code/input"; value: string }
  | { type: "code/blur" }
  | { type: "code/checking" }
  | {
      type: "code/resolved";
      code: string;
      info: CdkInfo;
      /** Expiry date formatted for the page language; null when it never expires. */
      expires: string | null;
    }
  | { type: "code/failed"; code: string; text: string }
  | { type: "domain/change"; value: string }
  | { type: "count/change"; value: number }
  | { type: "row/username"; id: number; value: string }
  | { type: "row/password"; id: number; value: string }
  | { type: "row/toggle-password"; id: number }
  | { type: "row/generated"; id: number; password: string }
  | { type: "row/checking"; id: number; email: string }
  | { type: "row/available"; id: number; email: string }
  | { type: "row/check-failed"; id: number; email: string; text: string }
  | { type: "notify/input"; value: string }
  | { type: "notify/blur" }
  | { type: "submit/start" }
  | { type: "busy"; on: boolean }
  | { type: "focus"; target: "code" | "count" }
  | { type: "form/error"; text: string }
  | {
      type: "field/error";
      field: ErrorField | null;
      /** Position in the batch (0-based); with submitted it maps back to the row as submitted, otherwise to the current position. */
      index: number | null;
      submitted?: readonly SubmittedRow[];
      text: string;
    }
  | { type: "outcome"; result: RedeemResult; submitted: readonly SubmittedRow[] };

function newRow(id: number): Row {
  return {
    id,
    username: "",
    password: "",
    showPassword: false,
    availableEmail: "",
    usernameNote: NO_NOTE,
    passwordNote: NO_NOTE,
    usernameInvalid: false,
    passwordInvalid: false,
  };
}

export function initialState(defaultDomain: string): State {
  return {
    defaultDomain,
    code: "",
    codeNote: NO_NOTE,
    codeInvalid: false,
    cdk: null,
    cdkCode: "",
    domain: defaultDomain,
    domainInvalid: false,
    countError: null,
    rows: [newRow(1)],
    nextRowId: 2,
    notify: "",
    notifyNote: NO_NOTE,
    notifyInvalid: false,
    busy: false,
    formNote: NO_NOTE,
    issued: [],
    outcome: null,
    formHidden: false,
    focus: null,
  };
}

/* ---- Values derived from state ---- */

/** Which domains this redeem code can activate mailboxes on; only the default domain before verification. */
export function domainsOf(state: State): string[] {
  return state.cdk ? state.cdk.domains : [state.defaultDomain];
}

export function currentDomain(state: State): string {
  const domains = domainsOf(state);
  return domains.includes(state.domain) ? state.domain : (domains[0] ?? state.defaultDomain);
}

/** How many this redeem code can activate at once: a single row before verification. */
export function allowedCount(state: State): number {
  if (!state.cdk) return 1;
  return Math.max(1, Math.min(state.cdk.usesLeft, REDEEM_MAX_MAILBOXES));
}

/** Which earlier row has the same name (returns that row's 1-based ordinal); 0 when none. */
export function duplicateOf(rows: readonly Row[], row: Row): number {
  const username = normalizeUsername(row.username);
  if (!username) return 0;
  for (const [index, other] of rows.entries()) {
    if (other === row) break;
    if (normalizeUsername(other.username) === username) return index + 1;
  }
  return 0;
}

/** This row has something entered (username or password). */
export function rowFilled(row: Row): boolean {
  return row.username.trim() !== "" || row.password !== "";
}

/** A row's current full address (normalised); empty string when the username is empty. */
export function rowEmail(state: State, row: Row): string {
  const username = normalizeUsername(row.username);
  return username ? emailAddress(username, currentDomain(state)) : "";
}

export function createReducer(t: Copy) {
  /** Once the local rules pass, the full address goes below the field first; one confirmed available says "available". */
  function usernameNoteFor(rows: readonly Row[], row: Row, domain: string): Note {
    const username = normalizeUsername(row.username);
    if (!username) return NO_NOTE;
    const problem = usernameProblem(username);
    if (problem) return note(t.problem.username[problem], "error");
    const duplicate = duplicateOf(rows, row);
    if (duplicate) return note(t.msg.duplicateUsername(duplicate), "error");
    const email = emailAddress(username, domain);
    if (row.availableEmail === email) return note(t.msg.usernameOk(email), "ok");
    return note(email);
  }

  /**
   * Recompute every row's username hint. With keepChecks the other rows (besides except) are recomputed only for duplicates: their pending or failed server check results are kept.
   * Used when only one row is being edited (so typing in this row does not wipe that row's "taken"), and when the same redeem code is re-verified (after a partial activation failure,
   * the failure reasons stay until that row is re-checked). before is the rows as they were before the edit: a row that was a duplicate then and no longer is holds no check result,
   * only the "same username" error that stopped applying, so it is recomputed (the component then checks its availability).
   */
  function refreshUsernames(
    rows: Row[],
    domain: string,
    keepChecks?: { except?: number; before?: readonly Row[] },
  ): Row[] {
    return rows.map((row) => {
      const next = usernameNoteFor(rows, row, domain);
      const kept =
        keepChecks !== undefined &&
        row.id !== keepChecks.except &&
        next.state === "" &&
        next.text !== "" &&
        row.usernameNote.state !== "";
      if (kept && keepChecks.before && duplicateOf(keepChecks.before, row)) {
        return { ...row, usernameNote: next, usernameInvalid: false };
      }
      return kept || sameNote(next, row.usernameNote) ? row : { ...row, usernameNote: next };
    });
  }

  /** Password checked live against the rules: which ones are still missing, or already met. */
  function passwordNoteFor(password: string): Note {
    if (!password) return NO_NOTE;
    const problem = passwordProblem(password);
    if (problem === "too_long" || problem === "whitespace") return note(t.problem.password[problem], "error");
    const missing = passwordMissing(password);
    if (missing.length > 0) return note(t.msg.passwordMissing(missing.map((rule) => t.rules[rule])));
    return note(t.msg.passwordOk, "ok");
  }

  /** An empty notification address says nothing; once filled it is checked for shape and only problems are shown. */
  function notifyNoteFor(raw: string): Note {
    const email = normalizeEmail(raw);
    const problem = email ? notifyProblem(email) : null;
    return problem ? note(t.problem.notify[problem], "error") : NO_NOTE;
  }

  function resizeRows(state: State, count: number): State {
    const target = Math.max(1, Math.min(count, REDEEM_MAX_MAILBOXES));
    let rows = state.rows;
    let nextRowId = state.nextRowId;
    if (rows.length > target) rows = rows.slice(0, target);
    while (rows.length < target) rows = [...rows, newRow(nextRowId++)];
    return rows === state.rows ? state : { ...state, rows, nextRowId };
  }

  /** Redeem code voided: forget the check result, rows return to the default domain and availability is re-checked. */
  function resetCode(state: State): State {
    const next: State = {
      ...state,
      cdk: null,
      cdkCode: "",
      countError: null,
      rows: state.rows.map((row) => ({ ...row, availableEmail: "" })),
    };
    return { ...next, rows: refreshUsernames(next.rows, currentDomain(next)) };
  }

  function updateRow(state: State, id: number, patch: (row: Row) => Row): State {
    return {
      ...state,
      rows: state.rows.map((row) => (row.id === id ? patch(row) : row)),
    };
  }

  function focusOn(state: State, focus: FocusTarget): State {
    return { ...state, focus: { ...focus, seq: (state.focus?.seq ?? 0) + 1 } };
  }

  function rowError(state: State, row: Row, field: "username" | "password", text: string): State {
    const next = updateRow(state, row.id, (r) =>
      field === "username"
        ? {
            ...r,
            availableEmail: "",
            usernameNote: note(text, "error"),
            usernameInvalid: true,
          }
        : { ...r, passwordNote: note(text, "error"), passwordInvalid: true },
    );
    return focusOn(next, { target: field, id: row.id });
  }

  /** The row for index in a batch: by the row id as submitted; without a submit record, by current position. */
  function rowAt(rows: readonly Row[], index: number, submitted?: readonly SubmittedRow[]): Row | undefined {
    if (!submitted) return rows[index];
    const id = submitted[index]?.id;
    return id === undefined ? undefined : rows.find((row) => row.id === id);
  }

  /** A server error pointing at a field (and maybe a row): attach it in the right place and move focus there. */
  function fieldError(
    state: State,
    field: ErrorField | null,
    index: number | null,
    text: string,
    submitted?: readonly SubmittedRow[],
  ): State {
    const row =
      index !== null ? rowAt(state.rows, index, submitted) : state.rows.length === 1 ? state.rows[0] : undefined;
    if ((field === "username" || field === "password") && row) return rowError(state, row, field, text);
    if (field === "code") {
      return focusOn(
        {
          ...resetCode(state),
          codeNote: note(text, "error"),
          codeInvalid: true,
        },
        { target: "code" },
      );
    }
    if (field === "count") return focusOn({ ...state, countError: text }, { target: "count" });
    if (field === "domain") {
      // When the domain dropdown is not shown (single domain) the error hangs on the redeem code.
      if (domainsOf(state).length <= 1)
        return focusOn({ ...state, codeNote: note(text, "error"), codeInvalid: true }, { target: "code" });
      return focusOn({ ...state, formNote: note(text, "error"), domainInvalid: true }, { target: "domain" });
    }
    if (field === "notify") {
      return focusOn({ ...state, notifyNote: note(text, "error"), notifyInvalid: true }, { target: "notify" });
    }
    return focusOn({ ...state, formNote: note(text, "error") }, { target: "submit" });
  }

  function describeItem(item: RedeemResult["mailboxes"][number] | undefined): string {
    if (!item || item.ok) return t.msg.unknownError;
    return item.kind === "other" ? item.error || t.msg.unknownError : t.kind[item.kind];
  }

  /**
   * Successes go to the result panel, failures stay in the form to be fixed; the form is taken down when no row is left. Results map back by the row id as submitted: rows added or removed after submitting
   * never take out other rows, and a successful row whose username is no longer the activated one is kept too.
   */
  function applyOutcome(state: State, result: RedeemResult, submitted: readonly SubmittedRow[]): State {
    const succeeded = result.mailboxes.filter((item) => item.ok);
    const failed = result.mailboxes.filter((item) => !item.ok);
    const issued = [...state.issued];
    for (const item of succeeded) if (item.ok) issued.push({ email: item.email, password: item.password });

    // Attach the failure reasons to their original rows first, then take out the successful rows.
    let rows = state.rows;
    for (const item of failed) {
      if (item.ok) continue;
      const row = rowAt(rows, item.index, submitted);
      if (!row) continue;
      const text = describeItem(item);
      rows = rows.map((r) =>
        r !== row
          ? r
          : item.field === "password"
            ? { ...r, passwordNote: note(text, "error") }
            : { ...r, availableEmail: "", usernameNote: note(text, "error") },
      );
    }
    const done = new Set(
      succeeded.flatMap((item) => {
        const row = rowAt(rows, item.index, submitted);
        return row && normalizeUsername(row.username) === submitted[item.index]?.username ? [row.id] : [];
      }),
    );
    rows = rows.filter((row) => !done.has(row.id));

    const next: State = {
      ...state,
      rows,
      issued,
      outcome: {
        imap: result.imap,
        smtp: result.smtp,
        webmail: result.webmail,
        notification: result.notification,
      },
    };
    if (rows.length === 0) return focusOn({ ...next, formHidden: true }, { target: "result" });
    // All succeeded but rows remain in the form (added after submitting): keep the form and focus the first remaining row.
    if (failed.length === 0) return focusOn(next, { target: "username", id: rows[0]!.id });
    // Failed rows stay; the quota changed, so the redeem code must be re-verified (the component sends the request).
    const withNote: State = {
      ...next,
      cdk: null,
      formNote: note(
        succeeded.length > 0 ? t.msg.partial(succeeded.length, failed.length) : describeItem(failed[0]),
        "error",
      ),
    };
    const first = withNote.rows[0];
    return first ? focusOn(withNote, { target: "username", id: first.id }) : withNote;
  }

  return function reduce(state: State, action: Action): State {
    switch (action.type) {
      case "code/input": {
        const code = formatCdk(action.value);
        const complete = isCdkComplete(code);
        return resetCode({
          ...state,
          code,
          codeInvalid: false,
          codeNote: complete ? note(t.msg.codeChecking, "busy") : NO_NOTE,
        });
      }
      case "code/blur": {
        if (!state.code || isCdkComplete(state.code)) return state;
        return {
          ...state,
          codeNote: note(t.msg.codeIncomplete, "error"),
          codeInvalid: true,
        };
      }
      case "code/checking":
        return { ...state, codeNote: note(t.msg.codeChecking, "busy") };
      case "code/resolved": {
        if (normalizeCdk(state.code) !== action.code) return state;
        const { info } = action;
        let next: State = {
          ...state,
          cdk: info,
          cdkCode: action.code,
          codeInvalid: false,
          countError: null,
          codeNote: note(t.msg.codeOk(info.domains, action.expires, info.usesLeft), "ok"),
        };
        // Rows only grow or shrink with the quota once verified; before that keep what was entered, so one typo does not wipe the whole form.
        // When the quota shrinks drop the extra rows at the end; if any of them had content, say so at the count instead of deleting silently.
        const allowed = allowedCount(next);
        const dropped = next.rows.slice(allowed).filter(rowFilled).length;
        next = resizeRows(next, Math.min(next.rows.length, allowed));
        if (dropped > 0) next = { ...next, countError: t.msg.rowsTrimmed(allowed, dropped) };
        return {
          ...next,
          // Same redeem code re-verified (after a partial activation failure): the rows' check results stay, the component re-checks afterwards.
          rows: refreshUsernames(next.rows, currentDomain(next), state.cdkCode === action.code ? {} : undefined),
        };
      }
      case "code/failed":
        if (normalizeCdk(state.code) !== action.code) return state;
        return {
          ...state,
          codeNote: note(action.text, "error"),
          codeInvalid: true,
        };
      case "domain/change": {
        const next: State = {
          ...state,
          domain: action.value,
          domainInvalid: false,
          rows: state.rows.map((row) => ({ ...row, availableEmail: "" })),
        };
        return {
          ...next,
          rows: refreshUsernames(next.rows, currentDomain(next)),
        };
      }
      case "count/change":
        return resizeRows({ ...state, countError: null }, action.value);
      case "row/username": {
        const next = updateRow(state, action.id, (row) => ({
          ...row,
          username: action.value.toLowerCase(),
          availableEmail: "",
          usernameInvalid: false,
        }));
        return {
          ...next,
          rows: refreshUsernames(next.rows, currentDomain(next), { except: action.id, before: state.rows }),
        };
      }
      case "row/password":
        return updateRow(state, action.id, (row) => ({
          ...row,
          password: action.value,
          passwordInvalid: false,
          passwordNote: passwordNoteFor(action.value),
        }));
      case "row/toggle-password":
        return updateRow(state, action.id, (row) => ({
          ...row,
          showPassword: !row.showPassword,
        }));
      case "row/generated":
        return focusOn(
          updateRow(state, action.id, (row) => ({
            ...row,
            password: action.password,
            showPassword: true,
            passwordInvalid: false,
            passwordNote: note(t.msg.passwordGenerated, "ok"),
          })),
          { target: "password", id: action.id },
        );
      case "row/checking":
      case "row/available":
      case "row/check-failed": {
        const row = state.rows.find((r) => r.id === action.id);
        // By the time it came back this row changed its username or domain: the result is void.
        if (!row || rowEmail(state, row) !== action.email) return state;
        if (action.type === "row/checking")
          return updateRow(state, row.id, (r) => ({
            ...r,
            usernameNote: note(t.msg.usernameChecking, "busy"),
          }));
        if (action.type === "row/available")
          return updateRow(state, row.id, (r) => ({
            ...r,
            availableEmail: action.email,
            usernameNote: note(t.msg.usernameOk(action.email), "ok"),
            usernameInvalid: false,
          }));
        return updateRow(state, row.id, (r) => ({
          ...r,
          usernameNote: note(action.text, "error"),
          usernameInvalid: true,
        }));
      }
      case "notify/input":
        return {
          ...state,
          notify: action.value,
          notifyInvalid: false,
          notifyNote: notifyNoteFor(action.value),
        };
      case "notify/blur": {
        const notify = normalizeEmail(state.notify);
        return { ...state, notify, notifyNote: notifyNoteFor(notify) };
      }
      case "submit/start": {
        // Before submitting write every row's username and the notification address in normalised form; hints are recomputed only for rows that changed.
        const changed = new Set<number>();
        const rows = state.rows.map((row) => {
          const username = normalizeUsername(row.username);
          if (username === row.username) return row;
          changed.add(row.id);
          return { ...row, username };
        });
        const notify = normalizeEmail(state.notify);
        const next: State = { ...state, rows, notify, formNote: NO_NOTE };
        const domain = currentDomain(next);
        return {
          ...next,
          rows: next.rows.map((row) =>
            changed.has(row.id) ? { ...row, usernameNote: usernameNoteFor(rows, row, domain) } : row,
          ),
          notifyNote: notify === state.notify ? state.notifyNote : notifyNoteFor(notify),
        };
      }
      case "busy":
        return state.busy === action.on ? state : { ...state, busy: action.on };
      case "focus":
        return focusOn(state, { target: action.target });
      case "form/error":
        return focusOn({ ...state, formNote: note(action.text, "error") }, { target: "submit" });
      case "field/error":
        return fieldError(state, action.field, action.index, action.text, action.submitted);
      case "outcome":
        return applyOutcome(state, action.result, action.submitted);
    }
  };
}

function sameNote(a: Note, b: Note): boolean {
  return a.text === b.text && a.state === b.state;
}
