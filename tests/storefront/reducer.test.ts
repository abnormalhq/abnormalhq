import { expect, test } from "vitest";
import { defaultDomain } from "@/storefront/config";
import { copy } from "@/storefront/i18n";
import type { RedeemResult } from "@/storefront/lib/api";
import {
  allowedCount,
  createReducer,
  currentDomain,
  initialState,
  type Action,
  type State,
} from "@/storefront/components/onboard/reducer";

const t = copy.zh;
const reduce = createReducer(t);
const CODE = "MULT23456789ABCD";

function run(state: State, ...actions: Action[]): State {
  return actions.reduce(reduce, state);
}

/** Redeem code typed and verified: two domains, three more can be activated. */
function resolved(usesLeft = 3): State {
  return run(
    initialState("abnormal.bid"),
    { type: "code/input", value: "mult-2345-6789-abcd" },
    {
      type: "code/resolved",
      code: CODE,
      info: {
        domains: ["abnormal.bid", "mail.abnormal.bid"],
        expiresAt: null,
        usesLeft,
      },
      expires: null,
    },
  );
}

test("the current default keeps previously issued codes on their original domain", () => {
  const initial = initialState(defaultDomain);
  expect(currentDomain(initial)).toBe("abnormalhq.com");
  const verified = run(
    initial,
    { type: "code/input", value: "mult-2345-6789-abcd" },
    {
      type: "code/resolved",
      code: CODE,
      info: { domains: ["abnormal.bid"], expiresAt: null, usesLeft: 1 },
      expires: null,
    },
  );
  expect(currentDomain(verified)).toBe("abnormal.bid");
});

test("redeem code: formatted as typed; the checking state shows only once complete; the check result is only accepted for the code currently typed", () => {
  const typing = run(initialState("abnormal.bid"), {
    type: "code/input",
    value: "abcd efgh",
  });
  expect(typing.code).toBe("ABCD-EFGH");
  expect(typing.codeNote.text).toBe("");

  const s = resolved();
  expect(s.code).toBe("MULT-2345-6789-ABCD");
  expect(s.cdk?.usesLeft).toBe(3);
  expect(s.codeNote.state).toBe("ok");
  expect(s.codeNote.text).toMatch(/@abnormal\.bid、@mail\.abnormal\.bid/);
  expect(allowedCount(s)).toBe(3);

  const stale = run(
    s,
    { type: "code/input", value: "MULT-2345-6789-ABC" },
    {
      type: "code/resolved",
      code: CODE,
      info: { domains: ["abnormal.bid"], expiresAt: null, usesLeft: 1 },
      expires: null,
    },
  );
  expect(stale.cdk, "a result arriving after the input changed is void").toBe(null);
  expect(stale.codeNote.text).toBe("");
});

test("voiding the redeem code forgets the check result but keeps the rows already filled in", () => {
  const s = run(resolved(), { type: "count/change", value: 3 });
  expect(s.rows.length).toBe(3);
  const reset = run(s, { type: "code/input", value: "MULT-2345-6789-ABC" });
  expect(reset.cdk).toBe(null);
  expect(reset.rows.length, "rows are not trimmed to the quota before verification").toBe(3);
  expect(currentDomain(reset)).toBe("abnormal.bid");
});

test("count and domain: rows grow and shrink with the quota; after verification the row count never exceeds it; a domain change re-checks availability", () => {
  let s = run(resolved(), { type: "count/change", value: 3 });
  expect(s.rows.length).toBe(3);
  const [a, b] = s.rows;
  s = run(
    s,
    { type: "row/username", id: a!.id, value: "Alice" },
    { type: "row/available", id: a!.id, email: "alice@abnormal.bid" },
  );
  expect(s.rows[0]!.username, "upper case is lower-cased as typed").toBe("alice");
  expect(s.rows[0]!.usernameNote.state).toBe("ok");

  s = run(s, { type: "domain/change", value: "mail.abnormal.bid" });
  expect(currentDomain(s)).toBe("mail.abnormal.bid");
  expect(s.rows[0]!.availableEmail).toBe("");
  expect(s.rows[0]!.usernameNote).toStrictEqual({
    text: "alice@mail.abnormal.bid",
    state: "",
  });
  expect(b!.username).toBe("");

  // Re-verified after two of the quota were used: the row count shrinks to what can still be activated.
  const fewer = run(
    s,
    { type: "code/input", value: CODE },
    {
      type: "code/resolved",
      code: CODE,
      info: { domains: ["abnormal.bid"], expiresAt: null, usesLeft: 1 },
      expires: null,
    },
  );
  expect(fewer.rows.length).toBe(1);
  expect(currentDomain(fewer), "a picked domain missing from the list falls back to the first").toBe("abnormal.bid");
});

test("username: a row repeating an earlier row's name gets the error; typing in this row does not wipe other rows' server results", () => {
  let s = run(resolved(), { type: "count/change", value: 2 });
  const [a, b] = s.rows;
  s = run(
    s,
    { type: "row/username", id: a!.id, value: "admin" },
    {
      type: "row/check-failed",
      id: a!.id,
      email: "admin@abnormal.bid",
      text: t.kind.username_taken,
    },
    { type: "row/username", id: b!.id, value: "admin" },
  );
  expect(s.rows[0]!.usernameNote.text).toBe(t.kind.username_taken);
  expect(s.rows[0]!.usernameInvalid).toBe(true);
  expect(s.rows[1]!.usernameNote.text).toBe(t.msg.duplicateUsername(1));

  s = run(s, { type: "row/username", id: b!.id, value: "bob" });
  expect(s.rows[1]!.usernameNote.text).toBe("bob@abnormal.bid");
  expect(s.rows[0]!.usernameNote.text, "the other row's result is kept").toBe(t.kind.username_taken);

  const stale = run(s, {
    type: "row/available",
    id: b!.id,
    email: "bobby@abnormal.bid",
  });
  expect(stale.rows[1]!.availableEmail, "an address that differs from the current input is ignored").toBe("");
});

test("password: lists the missing rules live; after random generation the password is shown and focused", () => {
  let s = resolved();
  const id = s.rows[0]!.id;
  s = run(s, { type: "row/password", id, value: "abc" });
  expect(s.rows[0]!.passwordNote.text).toBe(t.msg.passwordMissing([t.rules.length]));
  s = run(s, { type: "row/password", id, value: "abcdefgh" });
  expect(s.rows[0]!.passwordNote.text).toBe(t.msg.passwordOk);
  expect(s.rows[0]!.passwordNote.state).toBe("ok");
  s = run(s, { type: "row/generated", id, password: "Aa1aaaaaaaaaaaaa" });
  expect(s.rows[0]!.showPassword).toBe(true);
  expect(s.rows[0]!.passwordNote.state).toBe("ok");
  expect(s.focus).toStrictEqual({ target: "password", id, seq: 1 });
});

test("a server error pointing at a field lands in the right place: the count dropdown is forced visible, a redeem code error also voids the check result", () => {
  const count = run(resolved(1), {
    type: "field/error",
    field: "count",
    index: null,
    text: t.kind.count_exceeded,
  });
  expect(count.countError).toBe(t.kind.count_exceeded);
  expect(count.focus?.target).toBe("count");

  const code = run(resolved(), {
    type: "field/error",
    field: "code",
    index: null,
    text: t.kind.code_used,
  });
  expect(code.cdk).toBe(null);
  expect(code.codeNote).toStrictEqual({ text: t.kind.code_used, state: "error" });
  expect(code.codeInvalid).toBe(true);

  let s = run(resolved(), { type: "count/change", value: 2 });
  s = run(s, {
    type: "field/error",
    field: "password",
    index: 1,
    text: t.kind.password_invalid,
  });
  expect(s.rows[1]!.passwordInvalid).toBe(true);
  expect(s.focus).toStrictEqual({ target: "password", id: s.rows[1]!.id, seq: 1 });
});

test("username and notification address are normalised before submitting", () => {
  let s = resolved();
  const id = s.rows[0]!.id;
  s = run(
    s,
    { type: "row/username", id, value: " kim@abnormal.bid " },
    { type: "notify/input", value: " Me@Example.com " },
    { type: "submit/start" },
  );
  expect(s.rows[0]!.username).toBe("kim");
  expect(s.rows[0]!.usernameNote.text).toBe("kim@abnormal.bid");
  expect(s.notify).toBe("me@example.com");
  expect(s.notifyNote.text).toBe("");
});

test("activation result: successes go to the result panel, failures stay in the form; the form is taken down when all succeed", () => {
  let s = run(resolved(), { type: "count/change", value: 3 });
  const [a, b, c] = s.rows;
  s = run(
    s,
    { type: "row/username", id: a!.id, value: "a" },
    { type: "row/username", id: b!.id, value: "admin" },
    { type: "row/username", id: c!.id, value: "c" },
  );
  const partial: RedeemResult = {
    domain: "abnormal.bid",
    mailboxes: [
      {
        ok: true,
        index: 0,
        username: "a",
        email: "a@abnormal.bid",
        password: "Aa1aaaaa",
      },
      {
        ok: false,
        index: 1,
        username: "admin",
        error: "占用",
        kind: "username_taken",
        field: "username",
      },
      {
        ok: true,
        index: 2,
        username: "c",
        email: "c@abnormal.bid",
        password: "Cc3ccccc",
      },
    ],
    imap: { host: "imap.abnormal.bid", port: 993, security: "tls" },
    smtp: null,
    webmail: "https://webmail.abnormalhq.com/",
    notification: { to: "me@example.com", sent: true, error: null },
  };
  const submitted = [
    { id: a!.id, username: "a" },
    { id: b!.id, username: "admin" },
    { id: c!.id, username: "c" },
  ];
  s = run(s, { type: "outcome", result: partial, submitted });
  expect(s.issued.map((item) => item.email)).toStrictEqual(["a@abnormal.bid", "c@abnormal.bid"]);
  expect(s.rows.length).toBe(1);
  expect(s.rows[0]!.id, "the row left is the failed one").toBe(b!.id);
  expect(s.rows[0]!.usernameNote.text).toBe(t.kind.username_taken);
  expect(s.formNote.text).toBe(t.msg.partial(2, 1));
  expect(s.formHidden).toBe(false);
  expect(s.cdk, "the quota changed, so the redeem code must be re-verified").toBe(null);
  expect(s.outcome?.imap?.port).toBe(993);
  expect(s.outcome?.notification?.sent).toBe(true);
  expect(s.focus).toStrictEqual({ target: "username", id: b!.id, seq: 1 });
  // When the same redeem code comes back re-verified the failure reason stays until that row is re-checked, instead of flashing to a plain address line first.
  const rechecked = run(s, {
    type: "code/resolved",
    code: CODE,
    info: { domains: ["abnormal.bid", "mail.abnormal.bid"], expiresAt: null, usesLeft: 1 },
    expires: null,
  });
  expect(rechecked.rows[0]!.usernameNote).toStrictEqual({ text: t.kind.username_taken, state: "error" });
  // A different redeem code is another matter: recomputed for the new code.
  const other = run(
    s,
    { type: "code/input", value: "ABCD-EFGH-JKLM-NPQR" },
    {
      type: "code/resolved",
      code: "ABCDEFGHJKLMNPQR",
      info: { domains: ["abnormal.bid"], expiresAt: null, usesLeft: 1 },
      expires: null,
    },
  );
  expect(other.rows[0]!.usernameNote).toStrictEqual({ text: "admin@abnormal.bid", state: "" });

  const done = run(
    s,
    { type: "row/username", id: b!.id, value: "bob" },
    {
      type: "outcome",
      submitted: [{ id: b!.id, username: "bob" }],
      result: {
        ...partial,
        mailboxes: [
          {
            ok: true,
            index: 0,
            username: "bob",
            email: "bob@abnormal.bid",
            password: "Bb2bbbbb",
          },
        ],
        notification: null,
      },
    },
  );
  expect(done.issued.length, "results accumulate across several activations").toBe(3);
  expect(done.rows.length).toBe(0);
  expect(done.formHidden).toBe(true);
  expect(done.outcome?.notification, "each submit's notification result overwrites the previous one").toBe(null);
  expect(done.focus?.target).toBe("result");
});

/** The result of one activation: successes given by index, the rest fail (username taken). */
function outcome(usernames: string[], ok: boolean[]): RedeemResult {
  return {
    domain: "abnormal.bid",
    mailboxes: usernames.map((username, index) =>
      ok[index]
        ? { ok: true, index, username, email: `${username}@abnormal.bid`, password: "Aa1aaaaa" }
        : { ok: false, index, username, error: "占用", kind: "username_taken", field: "username" },
    ),
    imap: null,
    smtp: null,
    webmail: null,
    notification: null,
  };
}

test("activation result: matched back by the row id at submit time, rows added after submitting stay and the form does not hide them", () => {
  let s = run(resolved(), { type: "count/change", value: 2 });
  const [a, b] = s.rows;
  s = run(s, { type: "row/username", id: a!.id, value: "alice" }, { type: "row/username", id: b!.id, value: "bob" });
  const submitted = [
    { id: a!.id, username: "alice" },
    { id: b!.id, username: "bob" },
  ];
  // A row was added while the request was in flight.
  s = run(s, { type: "count/change", value: 3 });
  const added = s.rows[2]!;
  s = run(s, { type: "outcome", result: outcome(["alice", "bob"], [true, true]), submitted });
  expect(s.issued.map((item) => item.email)).toStrictEqual(["alice@abnormal.bid", "bob@abnormal.bid"]);
  expect(s.rows.map((row) => row.id)).toStrictEqual([added.id]);
  expect(s.formHidden, "rows not yet submitted remain, so the form cannot be taken down").toBe(false);
  expect(s.focus).toMatchObject({ target: "username", id: added.id });
});

test("activation result: a successful row whose username has changed is kept; the failure reason goes on the row as submitted", () => {
  let s = run(resolved(), { type: "count/change", value: 2 });
  const [a, b] = s.rows;
  s = run(s, { type: "row/username", id: a!.id, value: "alice" }, { type: "row/username", id: b!.id, value: "admin" });
  const submitted = [
    { id: a!.id, username: "alice" },
    { id: b!.id, username: "admin" },
  ];
  // The first row's username changed while the request was in flight.
  s = run(s, { type: "row/username", id: a!.id, value: "alicia" });
  s = run(s, { type: "outcome", result: outcome(["alice", "admin"], [true, false]), submitted });
  expect(s.issued.map((item) => item.email)).toStrictEqual(["alice@abnormal.bid"]);
  expect(s.rows.map((row) => row.username)).toStrictEqual(["alicia", "admin"]);
  expect(s.rows[1]!.usernameNote.text).toBe(t.kind.username_taken);
  expect(s.rows[0]!.usernameNote.state).not.toBe("error");
});

test("field errors: with submitted rows the row is found by id, so a removed earlier row does not misplace it", () => {
  let s = run(resolved(), { type: "count/change", value: 2 });
  const [a, b] = s.rows;
  s = run(s, { type: "row/username", id: a!.id, value: "alice" }, { type: "row/username", id: b!.id, value: "bob" });
  const submitted = [
    { id: a!.id, username: "alice" },
    { id: b!.id, username: "bob" },
  ];
  s = run(s, {
    type: "field/error",
    field: "username",
    index: 1,
    submitted,
    text: t.kind.username_taken,
  });
  expect(s.rows[1]!.usernameNote.text).toBe(t.kind.username_taken);
  expect(s.rows[0]!.usernameInvalid).toBe(false);
  expect(s.focus).toMatchObject({ target: "username", id: b!.id });
});

test("field errors: when the row is gone or no field is pointed at, it goes to the bottom of the form and focus returns to the submit button", () => {
  let s = run(resolved(), { type: "count/change", value: 2 });
  const [a, b] = s.rows;
  const submitted = [
    { id: a!.id, username: "alice" },
    { id: b!.id, username: "bob" },
  ];
  s = run(s, { type: "count/change", value: 1 });
  s = run(s, { type: "field/error", field: "username", index: 1, submitted, text: t.kind.username_taken });
  expect(s.formNote).toStrictEqual({ text: t.kind.username_taken, state: "error" });
  expect(s.focus).toMatchObject({ target: "submit" });
  const seq = s.focus!.seq;
  s = run(s, { type: "form/error", text: t.msg.unknownError });
  expect(s.formNote).toStrictEqual({ text: t.msg.unknownError, state: "error" });
  expect(s.focus, "the same target must be moved to again").toMatchObject({ target: "submit", seq: seq + 1 });
});

test("redeem code: when the quota shrinks the extra rows are dropped; if any had content, the count says so", () => {
  let s = run(resolved(3), { type: "count/change", value: 3 });
  const [, , c] = s.rows;
  const lower = (state: State, usesLeft: number) =>
    run(
      state,
      { type: "code/input", value: CODE },
      {
        type: "code/resolved",
        code: CODE,
        info: { domains: ["abnormal.bid"], expiresAt: null, usesLeft },
        expires: null,
      },
    );
  const quiet = lower(s, 2);
  expect(quiet.rows.length).toBe(2);
  expect(quiet.countError, "only empty rows were dropped, nothing to say").toBe(null);
  s = run(s, { type: "row/username", id: c!.id, value: "carol" });
  const trimmed = lower(s, 1);
  expect(trimmed.rows.length).toBe(1);
  expect(trimmed.countError).toBe(t.msg.rowsTrimmed(1, 1));
});
