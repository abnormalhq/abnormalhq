import { readFileSync } from "node:fs";
import { expect, test, vi } from "vitest";
import {
  ApiError,
  ERROR_FIELDS,
  ERROR_KINDS,
  REDEEM_TURNSTILE_ACTION,
  createApi,
  readApiError,
} from "@/storefront/lib/api";
import {
  CDK_ALPHABET,
  CDK_GROUP,
  CDK_LENGTH,
  LOCAL_PART_PATTERN,
  MAX_LOCAL_PART_LENGTH,
  NOTIFY_EMAIL_MAX,
  NOTIFY_EMAIL_PATTERN,
  PASSWORD_FIELD_MAX,
  PASSWORD_MIN_LENGTH,
  REDEEM_MAX_MAILBOXES,
} from "@/storefront/lib/onboard";
import {
  CODE_STATUSES,
  getShopCatalog,
  getShopOrder,
  LOGIN_TURNSTILE_ACTION,
  PAYMENT_PROVIDERS,
  passwordLogin,
  registerAccount,
  requestLogin,
  requestPasswordReset,
  ShopApiError,
  SUBSCRIPTION_STATES,
} from "@/storefront/lib/shop";
import { KIND_STATUS, sampleCodes } from "@/storefront/mock/api";
import { RENEW_MAX_PERIODS } from "@/storefront/mock/shop";
import { catalogResponse, orderResponse } from "./fixtures/shop-contract";

/**
 * docs/onboard-contract.json is byte-for-byte identical to the file of the same name in the mail repo; mail tests its own constants against it, here the hand-copied values of this repo are tested.
 * When either side changes a value, one side's tests fail until the code on both sides and both files agree. The Worker part is in tests/worker.test.ts
 * (all four route lists of the shop). What contract version 3 added is checked where its client is tested: plan kinds, the quote's and a seat plan's
 * fields, the seat limits and the refusal codes in quote.test.ts, an account's seats in seats.test.ts, and the buyer-domain routes, fields and enums
 * in domains.test.ts.
 */
interface Contract {
  redeem: {
    routes: string[];
    errorKinds: Record<string, { status: number; field: string | null }>;
    fields: string[];
    maxMailboxes: number;
    code: { length: number; group: number; alphabet: string; statuses: string[]; maxUses: number };
    username: { maxLength: number; pattern: string };
    password: { minLength: number; maxLength: number };
    notify: { maxLength: number; pattern: string };
  };
  shop: {
    routes: Record<string, ("GET" | "POST")[]>;
    providers: string[];
    subscriptionStates: string[];
    renewMaxPeriods: number;
    publicOrderFields: string[];
  };
  turnstile: {
    siteKeyField: string;
    siteKeyRoutes: string[];
    tokenField: string;
    actions: Record<string, string>;
  };
}

const contract = JSON.parse(readFileSync("docs/onboard-contract.json", "utf8")) as Contract;

test("contract: redeem error kinds and fields, and the status code the mock API gives each kind", () => {
  expect([...ERROR_KINDS]).toEqual(Object.keys(contract.redeem.errorKinds));
  expect([...ERROR_FIELDS]).toEqual(contract.redeem.fields);
  expect(KIND_STATUS).toEqual(
    Object.fromEntries(Object.entries(contract.redeem.errorKinds).map(([kind, { status }]) => [kind, status])),
  );
  // The client reads the kind and field mail gives as they are.
  for (const [kind, { status, field }] of Object.entries(contract.redeem.errorKinds)) {
    const error = readApiError(status, { error: "x", kind, ...(field ? { field } : {}) });
    expect([error.kind, error.field], kind).toEqual([kind, field]);
  }
});

test("contract: rules for redeem codes, usernames, passwords and notification addresses", () => {
  const { code, username, password, notify } = contract.redeem;
  expect({ length: CDK_LENGTH, group: CDK_GROUP, alphabet: CDK_ALPHABET, statuses: [...CODE_STATUSES] }).toEqual({
    length: code.length,
    group: code.group,
    alphabet: code.alphabet,
    statuses: code.statuses,
  });
  expect(REDEEM_MAX_MAILBOXES).toBe(contract.redeem.maxMailboxes);
  expect({ maxLength: MAX_LOCAL_PART_LENGTH, pattern: LOCAL_PART_PATTERN.source }).toEqual(username);
  expect({ minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_FIELD_MAX }).toEqual(password);
  expect({ maxLength: NOTIFY_EMAIL_MAX, pattern: NOTIFY_EMAIL_PATTERN.source }).toEqual(notify);
  // The mock API's redeem codes also respect mail's count cap: no "unlimited", and TEAM sits exactly at the cap (the README table says so too).
  const codes = sampleCodes();
  for (const [key, { usesLeft }] of Object.entries(codes)) {
    expect(Number.isSafeInteger(usesLeft) && usesLeft >= 0 && usesLeft <= code.maxUses, key).toBe(true);
  }
  expect(codes.TEAMTEAMTEAMTEAM.usesLeft).toBe(code.maxUses);
  const readme = readFileSync("README.md", "utf8");
  expect(readme).toMatch(new RegExp(`^\\| \`TEAM-TEAM-TEAM-TEAM\` \\| Usable ${code.maxUses} times`, "m"));
});

test("contract: payment methods, subscription statuses, renewal period cap and public order fields", async () => {
  expect([...PAYMENT_PROVIDERS]).toEqual(contract.shop.providers);
  expect([...SUBSCRIPTION_STATES]).toEqual(contract.shop.subscriptionStates);
  expect(RENEW_MAX_PERIODS).toBe(contract.shop.renewMaxPeriods);
  // The order sample used in tests is mail's public projection, and the client reads exactly these fields.
  expect(Object.keys(orderResponse.order).toSorted()).toEqual(contract.shop.publicOrderFields.toSorted());
  vi.stubGlobal("fetch", async () => Response.json(orderResponse));
  const { order } = await getShopOrder(orderResponse.order.id);
  expect(Object.keys(order).toSorted()).toEqual(contract.shop.publicOrderFields.toSorted());
});

/** Records the address and body of every request and answers the same response. */
function respond(body: unknown, status = 200) {
  const calls: { url: string; body: Record<string, unknown> | undefined }[] = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body === undefined ? undefined : JSON.parse(String(init.body)) });
    return Response.json(body, { status });
  });
  return calls;
}

test("contract: which two endpoints the Turnstile site key comes from, which two the token goes to, and which action each uses", async () => {
  const { siteKeyField, siteKeyRoutes, tokenField, actions } = contract.turnstile;
  const proxied = [
    ...contract.redeem.routes.map((route) => `onboard/${route}`),
    ...Object.keys(contract.shop.routes).map((route) => `shop/${route}`),
  ];
  for (const route of [...siteKeyRoutes, ...Object.keys(actions)]) expect(proxied, route).toContain(route);

  // The redeem code check and catalog responses carry the site key, and the client reads it as is.
  const readers: Record<string, { sample: object; read: () => Promise<{ turnstileSiteKey?: string }> }> = {
    "onboard/cdk": {
      sample: { domains: ["abnormal.bid"], expiresAt: null, usesLeft: 1 },
      read: () => createApi("").lookup("ABCD-EFGH-JKLM-NPQR"),
    },
    "shop/catalog": { sample: catalogResponse, read: () => getShopCatalog() },
  };
  expect(Object.keys(readers)).toEqual(siteKeyRoutes);
  for (const [route, { sample, read }] of Object.entries(readers)) {
    const calls = respond({ ...sample, [siteKeyField]: "0x4AAAsite" });
    expect((await read()).turnstileSiteKey, route).toBe("0x4AAAsite");
    expect(calls[0]!.url).toMatch(new RegExp(`/api/${route}$`));
  }

  // The token goes in the body field of the same name. Each form has its own action and mail only accepts tokens issued for the same form; on rejection the redeem endpoint answers
  // challenge_failed and the shop endpoints a plain { error }, and the pages show the backend's explanation either way.
  const challenge = contract.redeem.errorKinds.challenge_failed!;
  const senders: Record<
    string,
    {
      action: string;
      send: () => Promise<unknown>;
      refusal: object;
      type: new (...args: never[]) => Error;
      error: object;
    }
  > = {
    "onboard/redeem": {
      action: REDEEM_TURNSTILE_ACTION,
      send: () =>
        createApi("").redeem({
          code: "ABCD-EFGH-JKLM-NPQR",
          domain: "abnormal.bid",
          mailboxes: [{ username: "alice", password: "Correct-horse-9" }],
          turnstileToken: "token",
        }),
      refusal: { error: "人机验证没有通过", kind: "challenge_failed" },
      type: ApiError,
      error: { kind: "challenge_failed", field: challenge.field, status: challenge.status },
    },
    "shop/account/login": {
      action: LOGIN_TURNSTILE_ACTION,
      send: () => requestLogin("buyer@example.com", "zh", "token"),
      refusal: { error: "人机验证没有通过" },
      type: ShopApiError,
      error: { status: challenge.status, message: "人机验证没有通过" },
    },
    // Registration, password login and sending a login link share one form, so one Turnstile widget and one action.
    "shop/account/forgot": {
      action: LOGIN_TURNSTILE_ACTION,
      send: () => requestPasswordReset("buyer@example.com", "zh", "token"),
      refusal: { error: "人机验证没有通过" },
      type: ShopApiError,
      error: { status: challenge.status, message: "人机验证没有通过" },
    },
    "shop/account/register": {
      action: LOGIN_TURNSTILE_ACTION,
      send: () => registerAccount("buyer@example.com", "a long password", "zh", "token"),
      refusal: { error: "人机验证没有通过" },
      type: ShopApiError,
      error: { status: challenge.status, message: "人机验证没有通过" },
    },
    "shop/account/password-login": {
      action: LOGIN_TURNSTILE_ACTION,
      send: () => passwordLogin("buyer@example.com", "a long password", "zh", "token"),
      refusal: { error: "人机验证没有通过" },
      type: ShopApiError,
      error: { status: challenge.status, message: "人机验证没有通过" },
    },
  };
  expect(Object.fromEntries(Object.entries(senders).map(([route, { action }]) => [route, action]))).toEqual(actions);
  for (const [route, { send, refusal, type, error }] of Object.entries(senders)) {
    const calls = respond(refusal, challenge.status);
    const rejected: unknown = await send().then(
      () => expect.unreachable(route),
      (cause: unknown) => cause,
    );
    expect(rejected, route).toBeInstanceOf(type);
    expect(rejected, route).toMatchObject(error);
    expect(calls[0]!.url).toMatch(new RegExp(`/api/${route}$`));
    expect(calls[0]!.body?.[tokenField], route).toBe("token");
  }
});
