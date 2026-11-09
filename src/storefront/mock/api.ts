/**
 * The mock API for local development: same shape as docs/api.md, so the page can go through the whole flow without mailhq (including partial activation failure and domains without quota support),
 * with error messages in the request language (Accept-Language: zh / en), like mail.
 * MockStore is pure logic (tests/mock.test.ts tests it directly); the endpoint src/app/api/onboard/[route]/route.dev.ts, which exists only under next dev,
 * hands requests to it, and production builds leave it out. Data lives in memory only and resets on restart.
 */
import { webmailUrl } from "@/storefront/config";
import type { ErrorKind } from "@/storefront/lib/api";
import {
  CDK_LENGTH,
  REDEEM_MAX_MAILBOXES,
  emailAddress,
  normalizeCdk,
  normalizeEmail,
  normalizeUsername,
  notifyProblem,
  passwordProblem,
  usernameProblem,
} from "@/storefront/lib/onboard";

export interface MockCode {
  domains: string[];
  /** How many mailboxes can still be activated; always finite, like mail. */
  usesLeft: number;
  /** ISO 8601; null means it never expires. */
  expiresAt: string | null;
  disabled: boolean;
  /** Simulated server-side activation failure: the 2nd, 4th, 6th... mailbox in a batch fails (quota refunded), to try the partial-success UI. */
  partial?: boolean;
}

export type MockLang = "zh" | "en";

export interface MockReply {
  status: number;
  body: Record<string, unknown>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Redeem codes that can be tried directly on the page (keys without hyphens). */
export function sampleCodes(now = Date.now()): Record<string, MockCode> {
  return {
    // ABCD-EFGH-JKLM-NPQR: one mailbox, valid for 30 days.
    ABCDEFGHJKLMNPQR: {
      domains: ["abnormal.bid"],
      usesLeft: 1,
      expiresAt: new Date(now + 30 * DAY_MS).toISOString(),
      disabled: false,
    },
    // MULT-2345-6789-ABCD: three mailboxes, two domains to choose from, never expires.
    MULT23456789ABCD: {
      domains: ["abnormal.bid", "mail.abnormal.bid"],
      usesLeft: 3,
      expiresAt: null,
      disabled: false,
    },
    // TEAM-TEAM-TEAM-TEAM: mail's maximum count (1000), more than the 20 one request can activate.
    TEAMTEAMTEAMTEAM: {
      domains: ["abnormal.bid"],
      usesLeft: 1000,
      expiresAt: null,
      disabled: false,
    },
    // USED-USED-USED-USED: used up.
    USEDUSEDUSEDUSED: {
      domains: ["abnormal.bid"],
      usesLeft: 0,
      expiresAt: null,
      disabled: false,
    },
    // EXPD-EXPD-EXPD-EXPD: expired yesterday.
    EXPDEXPDEXPDEXPD: {
      domains: ["abnormal.bid"],
      usesLeft: 1,
      expiresAt: new Date(now - DAY_MS).toISOString(),
      disabled: false,
    },
    // GONE-GONE-GONE-GONE: disabled by an administrator.
    GONEGONEGONEGONE: {
      domains: ["abnormal.bid"],
      usesLeft: 1,
      expiresAt: null,
      disabled: true,
    },
    // PART-PART-PART-PART: three mailboxes; the 2nd, 4th... in a batch fail with a simulated server error.
    PARTPARTPARTPART: {
      domains: ["abnormal.bid"],
      usesLeft: 3,
      expiresAt: null,
      disabled: false,
      partial: true,
    },
    // BARE-BARE-BARE-BARE: two domains, of which legacy.abnormal.bid does not support the per-mailbox quota.
    BAREBAREBAREBARE: {
      domains: ["abnormal.bid", MOCK_NO_QUOTA_DOMAIN],
      usesLeft: 2,
      expiresAt: null,
      disabled: false,
    },
  };
}

export const TAKEN_USERNAMES = ["admin", "support", "postmaster", "abuse", "noreply", "hello", "kunish"] as const;

export const MOCK_SERVERS = {
  imap: { host: "mail.abnormal.bid", port: 993, security: "tls" },
  smtp: { host: "mail.abnormal.bid", port: 465, security: "tls" },
  webmail: webmailUrl,
} as const;

/** A notification address on this domain simulates a delivery failure, to see the "not sent" notice; every other address counts as sent. */
export const MOCK_BOUNCE_DOMAIN = "bounce.example";

/** This domain simulates not being bound to a single Stalwart connection: quotaSupportedByDomain is false. */
export const MOCK_NO_QUOTA_DOMAIN = "legacy.abnormal.bid";

/** Error messages in both languages (worded like mail); for kinds other than other the redeem page uses its own copy, so these mostly serve other and the notification result. */
const MESSAGES = {
  zh: {
    invalidCode: "这个兑换码不存在，请检查后重试。",
    codeDisabled: "这个兑换码已停用。",
    codeExpired: "这个兑换码已过期。",
    codeUsed: "这个兑换码已经用完了。",
    domainInvalid: "这个兑换码不能开通该域名的邮箱。",
    usernameRequired: "请输入用户名。",
    usernameRule: "用户名只能是小写字母、数字和 . _ -，首尾必须是字母或数字，最多 64 位。",
    passwordRequired: "请设置密码。",
    passwordRule: "密码至少 8 个字符。",
    prefix: (n: number) => `第 ${n} 个邮箱：`,
    taken: (email: string) => `${email} 已被占用，换一个试试。`,
    takenHere: "这个用户名已被占用，换一个试试。",
    notifyInvalid: "接收邮箱的地址不正确，请检查后重试。",
    notifyTooLong: "接收邮箱的地址最多 254 个字符。",
    emptyBatch: "请至少填一个邮箱。",
    batchTooLarge: (max: number) => `一次最多开通 ${max} 个邮箱。`,
    duplicate: (n: number, other: number) => `第 ${n} 个邮箱的用户名与第 ${other} 个重复。`,
    countExceeded: (left: number) => `这个兑换码只能再开通 ${left} 个邮箱。`,
    unavailable: "邮件服务暂时不可用，请稍后再试。",
    bounced: (to: string) => `邮件服务器拒绝了收件人 ${to}，请确认这个邮箱地址存在。`,
  },
  en: {
    invalidCode: "This code does not exist. Check it and try again.",
    codeDisabled: "This code has been disabled.",
    codeExpired: "This code has expired.",
    codeUsed: "This code has been used up.",
    domainInvalid: "This code cannot create mailboxes on that domain.",
    usernameRequired: "Enter a username.",
    usernameRule:
      "Usernames may contain lowercase letters, digits and . _ -, must start and end with a letter or digit, and be at most 64 characters.",
    passwordRequired: "Set a password.",
    passwordRule: "Passwords need at least 8 characters.",
    prefix: (n: number) => `Mailbox ${n}: `,
    taken: (email: string) => `${email} is taken. Try another one.`,
    takenHere: "This username is taken. Try another one.",
    notifyInvalid: "The address for the account details is not valid. Check it and try again.",
    notifyTooLong: "The address for the account details can have at most 254 characters.",
    emptyBatch: "Fill in at least one mailbox.",
    batchTooLarge: (max: number) => `At most ${max} mailboxes at a time.`,
    duplicate: (n: number, other: number) => `Mailbox ${n} has the same username as mailbox ${other}.`,
    countExceeded: (left: number) => `This code can create only ${left} more.`,
    unavailable: "The mail service is temporarily unavailable. Please try again shortly.",
    bounced: (to: string) => `The mail server rejected ${to}. Make sure this address exists.`,
  },
} satisfies Record<MockLang, unknown>;

/** Request language: the redeem page sends zh or en explicitly; anything else counts as Chinese, like the Worker. */
export function mockLang(acceptLanguage: string | null): MockLang {
  return /^en(?:-|;|,|$)/i.test(acceptLanguage?.trim() ?? "") ? "en" : "zh";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** The HTTP status mail answers each kind with (src/lib/onboard/input.ts in mail; docs/onboard-contract.json). */
export const KIND_STATUS: Record<ErrorKind, number> = {
  invalid_code: 404,
  code_used: 409,
  code_expired: 410,
  code_disabled: 403,
  count_exceeded: 409,
  domain_invalid: 400,
  username_invalid: 400,
  username_taken: 409,
  password_invalid: 400,
  notify_invalid: 400,
  rate_limited: 429,
  challenge_failed: 403,
  unavailable: 503,
  other: 400,
};

function fail(kind: ErrorKind, error: string, field?: string, index?: number | null): MockReply {
  const body: Record<string, unknown> = { error, kind };
  if (field) body.field = field;
  if (index !== undefined && index !== null) body.index = index;
  return { status: KIND_STATUS[kind], body };
}

interface ParsedMailbox {
  username: string;
  password: string;
}

/** Whether the account details were sent to the notification address on success (matches notification in docs/api.md). */
export interface MockNotification {
  to: string;
  sent: boolean;
  error: string | null;
}

export class MockStore {
  readonly codes: Map<string, MockCode>;
  readonly taken: Set<string>;
  private readonly now: () => number;

  constructor(
    codes: Record<string, MockCode> = sampleCodes(),
    taken: readonly string[] = [],
    now: () => number = Date.now,
  ) {
    this.codes = new Map(Object.entries(codes));
    this.taken = new Set(
      taken.length > 0 ? taken : TAKEN_USERNAMES.map((username) => emailAddress(username, "abnormal.bid")),
    );
    this.now = now;
  }

  /** Find a usable redeem code, or produce the error that should be returned. */
  private resolveCode(input: unknown, lang: MockLang): { code: string; entry: MockCode } | MockReply {
    const m = MESSAGES[lang];
    const code = normalizeCdk(text(isRecord(input) ? input.code : ""));
    const entry = code.length === CDK_LENGTH ? this.codes.get(code) : undefined;
    if (!entry) return fail("invalid_code", m.invalidCode, "code");
    if (entry.disabled) return fail("code_disabled", m.codeDisabled, "code");
    if (entry.expiresAt && Date.parse(entry.expiresAt) <= this.now()) {
      return fail("code_expired", m.codeExpired, "code");
    }
    if (entry.usesLeft <= 0) return fail("code_used", m.codeUsed, "code");
    return { code, entry };
  }

  lookup(input: unknown, lang: MockLang = "zh"): MockReply {
    const resolved = this.resolveCode(input, lang);
    if ("status" in resolved) return resolved;
    const { entry } = resolved;
    return {
      status: 200,
      body: {
        domains: entry.domains,
        quotaSupportedByDomain: Object.fromEntries(
          entry.domains.map((domain) => [domain, domain !== MOCK_NO_QUOTA_DOMAIN]),
        ),
        expiresAt: entry.expiresAt,
        usesLeft: entry.usesLeft,
      },
    };
  }

  private resolveDomain(input: unknown, entry: MockCode, lang: MockLang): string | MockReply {
    const domain = text(isRecord(input) ? input.domain : "")
      .trim()
      .toLowerCase();
    if (!entry.domains.includes(domain)) return fail("domain_invalid", MESSAGES[lang].domainInvalid, "domain");
    return domain;
  }

  private parseUsername(raw: unknown, index: number | null, lang: MockLang): string | MockReply {
    const m = MESSAGES[lang];
    const prefix = index === null ? "" : m.prefix(index + 1);
    const username = normalizeUsername(text(raw));
    const problem = usernameProblem(username);
    if (problem === "required") return fail("username_invalid", `${prefix}${m.usernameRequired}`, "username", index);
    if (problem === "invalid") return fail("username_invalid", `${prefix}${m.usernameRule}`, "username", index);
    return username;
  }

  private parsePassword(raw: unknown, index: number | null, lang: MockLang): string | MockReply {
    const m = MESSAGES[lang];
    const prefix = index === null ? "" : m.prefix(index + 1);
    const password = text(raw);
    const problem = passwordProblem(password);
    if (problem === "required") return fail("password_invalid", `${prefix}${m.passwordRequired}`, "password", index);
    if (problem) return fail("password_invalid", `${prefix}${m.passwordRule}`, "password", index);
    return password;
  }

  checkUsername(input: unknown, lang: MockLang = "zh"): MockReply {
    const resolved = this.resolveCode(input, lang);
    if ("status" in resolved) return resolved;
    const domain = this.resolveDomain(input, resolved.entry, lang);
    if (typeof domain !== "string") return domain;
    const username = this.parseUsername(isRecord(input) ? input.username : "", null, lang);
    if (typeof username !== "string") return username;
    const email = emailAddress(username, domain);
    if (this.taken.has(email)) return fail("username_taken", MESSAGES[lang].taken(email), "username");
    return { status: 200, body: { available: true, email } };
  }

  /** The notification address is optional: null when empty; otherwise normalised and checked for shape. */
  private parseNotify(raw: unknown, lang: MockLang): string | null | MockReply {
    const m = MESSAGES[lang];
    if (raw === undefined || raw === null) return null;
    if (typeof raw !== "string") return fail("notify_invalid", m.notifyInvalid, "notify");
    const email = normalizeEmail(raw);
    if (!email) return null;
    const problem = notifyProblem(email);
    if (problem === "too_long") return fail("notify_invalid", m.notifyTooLong, "notify");
    if (problem) return fail("notify_invalid", m.notifyInvalid, "notify");
    return email;
  }

  /** Activate a batch: check the whole batch first (count, taken usernames, notification address), then activate one by one and return each result. */
  redeem(input: unknown, lang: MockLang = "zh"): MockReply {
    const m = MESSAGES[lang];
    const resolved = this.resolveCode(input, lang);
    if ("status" in resolved) return resolved;
    const { entry } = resolved;
    const domain = this.resolveDomain(input, entry, lang);
    if (typeof domain !== "string") return domain;

    const raw = isRecord(input) ? input.mailboxes : undefined;
    const single = !Array.isArray(raw);
    if (Array.isArray(raw) && raw.length === 0) return fail("username_invalid", m.emptyBatch, "username", 0);
    if (Array.isArray(raw) && raw.length > REDEEM_MAX_MAILBOXES) {
      return fail("count_exceeded", m.batchTooLarge(REDEEM_MAX_MAILBOXES), "count");
    }
    const items: ParsedMailbox[] = [];
    const sources: unknown[] = single ? [input] : (raw as unknown[]);
    for (const [i, source] of sources.entries()) {
      const index = single ? null : i;
      const username = this.parseUsername(isRecord(source) ? source.username : "", index, lang);
      if (typeof username !== "string") return username;
      const password = this.parsePassword(isRecord(source) ? source.password : "", index, lang);
      if (typeof password !== "string") return password;
      const duplicate = items.findIndex((item) => item.username === username);
      if (duplicate !== -1) {
        return fail("username_invalid", m.duplicate(i + 1, duplicate + 1), "username", i);
      }
      items.push({ username, password });
    }
    const notify = this.parseNotify(isRecord(input) ? input.notify : undefined, lang);
    if (notify !== null && typeof notify !== "string") return notify;
    if (items.length > entry.usesLeft) {
      return fail("count_exceeded", m.countExceeded(entry.usesLeft), "count");
    }
    const conflict = items.findIndex((item) => this.taken.has(emailAddress(item.username, domain)));
    if (conflict !== -1) {
      const index = single ? null : conflict;
      return fail("username_taken", `${index === null ? "" : m.prefix(index + 1)}${m.takenHere}`, "username", index);
    }

    const results = items.map((item, index) => {
      if (entry.usesLeft <= 0) {
        return { ok: false, index, username: item.username, error: m.codeUsed, kind: "code_used", field: "code" };
      }
      // Simulated server-side activation failure: neither the quota nor the username is consumed, refunded like a failed push in mail.
      if (entry.partial && index % 2 === 1) {
        return { ok: false, index, username: item.username, error: m.unavailable, kind: "unavailable", field: null };
      }
      entry.usesLeft -= 1;
      const email = emailAddress(item.username, domain);
      this.taken.add(email);
      return {
        ok: true,
        index,
        username: item.username,
        email,
        password: item.password,
      };
    });
    // No mail server is available: once at least one activated it counts as sent, and addresses under bounce.example simulate a rejection.
    let notification: MockNotification | null = null;
    if (notify && results.some((item) => item.ok)) {
      const bounced = notify.endsWith(`@${MOCK_BOUNCE_DOMAIN}`);
      notification = {
        to: notify,
        sent: !bounced,
        error: bounced ? m.bounced(notify) : null,
      };
    }
    return {
      status: 201,
      body: {
        domain,
        mailboxes: results,
        imap: MOCK_SERVERS.imap,
        smtp: MOCK_SERVERS.smtp,
        webmail: MOCK_SERVERS.webmail,
        notification,
      },
    };
  }
}

export const MOCK_ROUTES = new Set(["cdk", "username", "redeem"]);

/** Simulates a little network latency, so the "checking" and "activating" states can be seen. */
export function mockDelayMs(route: string): number {
  return route === "redeem" ? 900 : 500;
}
