import { expect, test, vi } from "vitest";
import { copy } from "@/storefront/i18n";
import { ADDRESS_STORAGE_KEY } from "@/storefront/lib/address";
import { ApiError, type CdkInfo, type RedeemInput, type RedeemResult } from "@/storefront/lib/api";
import { normalizeCdk } from "@/storefront/lib/onboard";
import { createReducer, initialState, type Action, type State } from "@/storefront/components/onboard/reducer";
import { submitRedeem } from "@/storefront/components/onboard/submit";

const t = copy.zh;
const reduce = createReducer(t);
const CODE_A = "MULT23456789ABCD";
const CODE_B = "ABCDEFGHJKLMNPQR";

/**
 * Runs the submit flow with the real reducer: state in memory, lookup checks the cache first like OnboardForm, then verifies and hands back code/resolved,
 * redeem is supplied by the test. Every check and activation request is recorded.
 */
function harness(
  codes: Record<string, CdkInfo>,
  redeem: (input: RedeemInput) => RedeemResult | Error,
  /** The token the Turnstile widget currently gives; empty means verification is off (or not yet obtained). */
  token = "",
) {
  let state = initialState("abnormal.bid");
  const lookups: { code: string; force: boolean }[] = [];
  const redeemed: RedeemInput[] = [];
  const busy: boolean[] = [];
  // Every reset voids the current token and swaps in a new one (in the real widget, the one Turnstile gives after re-verifying).
  const challenge = { current: token, resets: 0 };
  const dispatch = (action: Action) => {
    if (action.type === "busy") busy.push(action.on);
    state = reduce(state, action);
  };
  const lookup = async (force = false) => {
    const code = normalizeCdk(state.code);
    if (!force && state.cdk && state.cdkCode === code) return state.cdk;
    lookups.push({ code, force });
    const info = codes[code];
    if (!info) {
      dispatch({ type: "code/failed", code, text: t.kind.invalid_code });
      return null;
    }
    dispatch({ type: "code/resolved", code, info, expires: null });
    return info;
  };
  const submit = () =>
    submitRedeem({
      t,
      lang: "zh",
      defaultDomain: "abnormal.bid",
      state: () => state,
      dispatch,
      lookup,
      redeem: async (input) => {
        redeemed.push(input);
        const result = redeem(input);
        if (result instanceof Error) throw result;
        return result;
      },
      challenge: {
        token: () => challenge.current,
        reset: () => {
          challenge.resets += 1;
          if (challenge.current) challenge.current = `${token}-${challenge.resets}`;
        },
      },
      describe: (error) => (error instanceof ApiError ? error.message : t.msg.unknownError),
    });
  return {
    get state() {
      return state;
    },
    dispatch,
    lookup,
    submit,
    lookups,
    redeemed,
    busy,
    challenge,
  };
}

function succeeded(input: RedeemInput, ok: (index: number) => boolean = () => true): RedeemResult {
  return {
    domain: input.domain,
    mailboxes: input.mailboxes.map(({ username, password }, index) =>
      ok(index)
        ? { ok: true, index, username, email: `${username}@${input.domain}`, password }
        : { ok: false, index, username, error: "占用", kind: "username_taken", field: "username" },
    ),
    imap: null,
    smtp: null,
    webmail: null,
    notification: null,
  };
}

/** Types and verifies the redeem code, then fills in n rows. */
async function filled(h: ReturnType<typeof harness>, code: string, names: string[]) {
  h.dispatch({ type: "code/input", value: code });
  await h.lookup();
  h.dispatch({ type: "count/change", value: names.length });
  for (const [index, name] of names.entries()) {
    const id = h.state.rows[index]!.id;
    h.dispatch({ type: "row/username", id, value: name });
    h.dispatch({ type: "row/password", id, value: `${name}-password` });
  }
}

const three: CdkInfo = { domains: ["abnormal.bid"], expiresAt: null, usesLeft: 3 };

test("submit: once local validation passes everything is activated, results map back to the rows, the form is taken down, the busy state ends", async () => {
  const h = harness({ [CODE_A]: three }, (input) => succeeded(input));
  await filled(h, CODE_A, ["alice", "bob"]);
  await h.submit();
  expect(h.redeemed).toStrictEqual([
    {
      code: CODE_A,
      domain: "abnormal.bid",
      mailboxes: [
        { username: "alice", password: "alice-password" },
        { username: "bob", password: "bob-password" },
      ],
    },
  ]);
  expect(h.lookups, "an already verified redeem code is not verified again").toHaveLength(1);
  expect(h.state.formHidden).toBe(true);
  expect(h.state.issued.map((item) => item.email)).toStrictEqual(["alice@abnormal.bid", "bob@abnormal.bid"]);
  expect(h.busy).toStrictEqual([true, false]);
  expect(h.state.busy).toBe(false);
});

test("submit: when local validation fails no request is sent and the error goes on that row", async () => {
  const h = harness({ [CODE_A]: three }, (input) => succeeded(input));
  await filled(h, CODE_A, ["alice", "alice"]);
  await h.submit();
  expect(h.redeemed).toHaveLength(0);
  expect(h.state.rows[1]!.usernameNote.text).toBe(t.msg.duplicateUsername(1));
  expect(h.state.focus).toMatchObject({ target: "username", id: h.state.rows[1]!.id });
  expect(h.busy).toStrictEqual([]);
});

test("submit: when a just-pasted, unverified redeem code has a smaller quota, the old batch is not submitted and the dropped rows are explained", async () => {
  const h = harness(
    { [CODE_A]: three, [CODE_B]: { domains: ["abnormal.bid"], expiresAt: null, usesLeft: 1 } },
    (input) => succeeded(input),
  );
  await filled(h, CODE_A, ["alice", "bob", "carol"]);
  // Enter pressed before the 350ms pause: the new redeem code is not verified yet.
  h.dispatch({ type: "code/input", value: CODE_B });
  await h.submit();
  expect(h.redeemed, "no activation request is sent").toHaveLength(0);
  expect(h.state.rows.map((row) => row.username)).toStrictEqual(["alice"]);
  expect(h.state.countError).toBe(t.msg.rowsTrimmed(1, 2));
  expect(h.state.focus).toMatchObject({ target: "count" });
  expect(h.state.busy).toBe(false);
  // Submitting after verification activates the remaining row under the new quota.
  await h.submit();
  expect(h.redeemed.map((input) => input.mailboxes.map((item) => item.username))).toStrictEqual([["alice"]]);
});

test("submit: when a just-pasted, unverified redeem code activates on another domain than the rows showed, nothing is sent until the user has seen the new addresses", async () => {
  const elsewhere: CdkInfo = { domains: ["mail.abnormal.bid", "abnormal.example"], expiresAt: null, usesLeft: 1 };
  const h = harness({ [CODE_A]: three, [CODE_B]: elsewhere }, (input) => succeeded(input));
  await filled(h, CODE_A, ["alice"]);
  // Enter pressed before the 350ms pause: the rows still show the previous domain.
  h.dispatch({ type: "code/input", value: CODE_B });
  await h.submit();
  expect(h.redeemed, "no activation request is sent").toHaveLength(0);
  expect(h.state.formNote).toStrictEqual({ text: t.msg.domainChanged("mail.abnormal.bid"), state: "error" });
  expect(h.state.focus).toMatchObject({ target: "submit" });
  expect(h.state.busy).toBe(false);
  expect(h.challenge.resets).toBe(0);
  // Submitting again, now that the rows show the new domain, activates there.
  await h.submit();
  expect(h.redeemed.map((input) => input.domain)).toStrictEqual(["mail.abnormal.bid"]);

  // A code verified at submit time that offers the domain the rows showed goes straight through.
  const same = harness({ [CODE_A]: { ...elsewhere, domains: ["abnormal.example", "abnormal.bid"] } }, (input) =>
    succeeded(input),
  );
  same.dispatch({ type: "code/input", value: CODE_A });
  const id = same.state.rows[0]!.id;
  same.dispatch({ type: "row/username", id, value: "alice" });
  same.dispatch({ type: "row/password", id, value: "alice-password" });
  await same.submit();
  expect(same.redeemed.map((input) => input.domain)).toStrictEqual(["abnormal.bid"]);
});

test("submit: on partial failure the failed rows stay and the redeem code is re-verified; a server error pointing at a row goes on the row as submitted", async () => {
  const h = harness({ [CODE_A]: three }, (input) => succeeded(input, (index) => index !== 1));
  await filled(h, CODE_A, ["alice", "admin", "carol"]);
  const admin = h.state.rows[1]!.id;
  await h.submit();
  // The failed row stays in the form (after re-verification the component re-checks its username).
  expect(h.state.rows.map((row) => row.id)).toStrictEqual([admin]);
  expect(h.state.formNote.text).toBe(t.msg.partial(2, 1));
  expect(h.lookups.at(-1), "quota changed, re-verification forced").toStrictEqual({ code: CODE_A, force: true });

  const rejected = harness({ [CODE_A]: three }, () => new ApiError("已被占用", 409, "username_taken", "username", 1));
  await filled(rejected, CODE_A, ["alice", "admin"]);
  await rejected.submit();
  expect(rejected.state.rows[1]!.usernameNote.text).toBe("已被占用");
  expect(rejected.state.rows[0]!.usernameNote.state).not.toBe("error");
  expect(rejected.state.focus).toMatchObject({ target: "username", id: rejected.state.rows[1]!.id });
  expect(rejected.state.busy).toBe(false);
});

test("submit: the address carried from the address check is forgotten once a redemption creates it, also in a batch that partly failed", async () => {
  const items = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  });

  // The same name on another domain is another address: it stays for the form that can create it.
  items.set(ADDRESS_STORAGE_KEY, "alice@abnormalhq.com");
  const other = harness({ [CODE_A]: three }, (input) => succeeded(input));
  await filled(other, CODE_A, ["alice"]);
  await other.submit();
  expect(items.get(ADDRESS_STORAGE_KEY)).toBe("alice@abnormalhq.com");

  // The row with the carried address failed: it is still wanted.
  items.set(ADDRESS_STORAGE_KEY, "admin@abnormal.bid");
  const failed = harness({ [CODE_A]: three }, (input) => succeeded(input, (index) => index !== 1));
  await filled(failed, CODE_A, ["alice", "admin", "carol"]);
  await failed.submit();
  expect(items.get(ADDRESS_STORAGE_KEY)).toBe("admin@abnormal.bid");

  items.set(ADDRESS_STORAGE_KEY, "alice@abnormal.bid");
  const partial = harness({ [CODE_A]: three }, (input) => succeeded(input, (index) => index !== 1));
  await filled(partial, CODE_A, ["alice", "admin", "carol"]);
  await partial.submit();
  expect(partial.state.formNote.text).toBe(t.msg.partial(2, 1));
  expect(items.has(ADDRESS_STORAGE_KEY)).toBe(false);
});

test("submit: an invalid redeem code puts focus back on the redeem code, a network failure goes to the bottom of the form", async () => {
  const h = harness({}, (input) => succeeded(input));
  h.dispatch({ type: "code/input", value: CODE_A });
  const id = h.state.rows[0]!.id;
  h.dispatch({ type: "row/username", id, value: "alice" });
  h.dispatch({ type: "row/password", id, value: "alice-password" });
  await h.submit();
  expect(h.redeemed).toHaveLength(0);
  expect(h.state.focus).toMatchObject({ target: "code" });

  const offline = harness({ [CODE_A]: three }, () => new TypeError("Failed to fetch"));
  await filled(offline, CODE_A, ["alice"]);
  await offline.submit();
  expect(offline.state.formNote).toStrictEqual({ text: t.msg.unknownError, state: "error" });
  expect(offline.state.rows).toHaveLength(1);
  expect((offline.state as State).busy).toBe(false);
  // The control disabled during submit lost focus: when the error points at no field, focus returns to the submit button for an easy retry.
  expect(offline.state.focus).toMatchObject({ target: "submit" });
  // The same when a server error points at no field.
  const refused = harness({ [CODE_A]: three }, () => new ApiError("服务暂时不可用", 503, "unavailable"));
  await filled(refused, CODE_A, ["alice"]);
  await refused.submit();
  expect(refused.state.formNote).toStrictEqual({ text: "服务暂时不可用", state: "error" });
  expect(refused.state.focus).toMatchObject({ target: "submit" });
});

test("submit: with human verification on the activation request carries the token and swaps it after sending whether it succeeded or not; no request leaves it alone", async () => {
  const h = harness({ [CODE_A]: three }, () => new ApiError("人机验证没有通过", 403, "challenge_failed"), "token");
  await filled(h, CODE_A, ["alice", "alice"]);
  await h.submit();
  expect(h.redeemed, "local validation failed, no request is sent").toHaveLength(0);
  expect(h.challenge.resets, "the token was not spent and is kept").toBe(0);

  h.dispatch({ type: "row/username", id: h.state.rows[1]!.id, value: "bob" });
  await h.submit();
  expect(h.redeemed[0]).toMatchObject({ turnstileToken: "token" });
  expect(h.challenge.resets).toBe(1);
  // A failed verification points at no field: it goes to the bottom of the form, focus returns to the submit button, and the next submit uses the new token.
  expect(h.state.formNote).toStrictEqual({ text: "人机验证没有通过", state: "error" });
  expect(h.state.focus).toMatchObject({ target: "submit" });
  expect(h.state.rows.map((row) => row.username)).toStrictEqual(["alice", "bob"]);
  await h.submit();
  expect(h.redeemed[1]).toMatchObject({ turnstileToken: "token-1" });
  expect(h.challenge.resets).toBe(2);

  const succeeding = harness({ [CODE_A]: three }, (input) => succeeded(input), "token");
  await filled(succeeding, CODE_A, ["alice"]);
  await succeeding.submit();
  expect(succeeding.redeemed[0]).toMatchObject({ turnstileToken: "token" });
  expect(succeeding.challenge.resets).toBe(1);
  expect(succeeding.state.formHidden).toBe(true);

  // No token when verification is off (or the script did not load): the field is omitted from the request and the backend decides.
  const off = harness({ [CODE_A]: three }, (input) => succeeded(input));
  await filled(off, CODE_A, ["alice"]);
  await off.submit();
  expect(off.redeemed[0]).not.toHaveProperty("turnstileToken");
});

test("submit: when this check is the first to require human verification no request is sent until the widget gives a token", async () => {
  const guarded: CdkInfo = { ...three, turnstileSiteKey: "0x4AAAsite" };
  const h = harness({ [CODE_A]: guarded }, (input) => succeeded(input));
  // Enter pressed before the 350ms pause: the redeem code is not verified yet and the widget has not appeared either.
  h.dispatch({ type: "code/input", value: CODE_A });
  const id = h.state.rows[0]!.id;
  h.dispatch({ type: "row/username", id, value: "alice" });
  h.dispatch({ type: "row/password", id, value: "alice-password" });
  await h.submit();
  expect(h.redeemed, "a tokenless request would only be rejected and waste a rate-limit slot").toHaveLength(0);
  expect(h.state.formNote).toStrictEqual({ text: t.msg.challengePending, state: "error" });
  expect(h.state.focus).toMatchObject({ target: "submit" });
  expect(h.state.busy).toBe(false);
  expect(h.challenge.resets).toBe(0);

  // The widget finished and gave a token: activate as usual.
  h.challenge.current = "token";
  await h.submit();
  expect(h.redeemed).toHaveLength(1);
  expect(h.redeemed[0]).toMatchObject({ turnstileToken: "token" });
  expect(h.state.formHidden).toBe(true);

  // Verification was known to be required before submitting but the widget gave no token (script blocked, verification error): submit anyway and let the backend explain.
  const blocked = harness({ [CODE_A]: guarded }, () => new ApiError("人机验证没有通过", 403, "challenge_failed"));
  await filled(blocked, CODE_A, ["alice"]);
  await blocked.submit();
  expect(blocked.redeemed).toHaveLength(1);
  expect(blocked.redeemed[0]).not.toHaveProperty("turnstileToken");
  expect(blocked.state.formNote).toStrictEqual({ text: "人机验证没有通过", state: "error" });
});
