/**
 * Browser client for the same-origin redeem API. The Worker calls mailhq internally; the contract is in docs/api.md: three POSTs with JSON bodies and responses,
 * no cookies; the redeem code itself is the credential. Error responses look like { error, kind, field?, index? }, where index says which mailbox in a batch failed.
 */

export const ERROR_KINDS = [
  "invalid_code",
  "code_used",
  "code_expired",
  "code_disabled",
  "count_exceeded",
  "domain_invalid",
  "username_invalid",
  "username_taken",
  "password_invalid",
  "notify_invalid",
  "rate_limited",
  "challenge_failed",
  "unavailable",
  "other",
] as const;
export type ErrorKind = (typeof ERROR_KINDS)[number];

export const ERROR_FIELDS = ["code", "domain", "count", "username", "password", "notify"] as const;
export type ErrorField = (typeof ERROR_FIELDS)[number];

export function isErrorKind(value: unknown): value is ErrorKind {
  return typeof value === "string" && (ERROR_KINDS as readonly string[]).includes(value);
}

function isErrorField(value: unknown): value is ErrorField {
  return typeof value === "string" && (ERROR_FIELDS as readonly string[]).includes(value);
}

/**
 * The server rejected the request: message is the server's explanation (in Chinese), kind picks the local copy, field says which field to show it beside,
 * index which mailbox in a batch (0-based).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly kind: ErrorKind;
  readonly field: ErrorField | null;
  readonly index: number | null;

  constructor(
    message: string,
    status: number,
    kind: ErrorKind,
    field: ErrorField | null = null,
    index: number | null = null,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.kind = kind;
    this.field = field;
    this.index = index;
  }
}

/** The request never arrived (offline, CORS not allowed, service down) or the response is not JSON we recognise. */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

export interface CdkInfo {
  /** Whether the provider can enforce the per-mailbox hard quota on this domain. Absent on old backends, for compatibility. */
  quotaSupportedByDomain?: Record<string, boolean>;
  /** Which domains this redeem code can activate mailboxes on, at least one; the first is the default. */
  domains: string[];
  /** ISO 8601; null means it never expires. */
  expiresAt: string | null;
  /** How many mailboxes can still be activated: every redeem code has a finite count (mail caps it at 1000), there is no "unlimited". */
  usesLeft: number;
  /** Site key given by the backend when activation requires Cloudflare Turnstile first; absent means no verification. */
  turnstileSiteKey?: string;
}

export type Security = "tls" | "starttls" | "none";

export interface ServerEndpoint {
  host: string;
  port: number;
  security: Security;
}

export interface RedeemMailboxInput {
  username: string;
  password: string;
}

/** Language of the notification email, the same as the page language. */
export type NotifyLang = "zh" | "en";

/** Turnstile action of the activation form: mail only accepts tokens issued for this form (turnstile.actions in docs/onboard-contract.json). */
export const REDEEM_TURNSTILE_ACTION = "onboard-redeem";

export interface RedeemInput {
  code: string;
  domain: string;
  /** The mailboxes to activate in this batch, within the redeem code's quota. */
  mailboxes: RedeemMailboxInput[];
  /** Address that receives the account details (normalised); no notification is sent when omitted. */
  notify?: string;
  /** Language of the notification email; only meaningful with notify, defaults to zh. */
  lang?: NotifyLang;
  /** One-time token from the Turnstile widget (action REDEEM_TURNSTILE_ACTION); required when the backend has human verification on. */
  turnstileToken?: string;
}

export interface UsernameInput {
  code: string;
  domain: string;
  username: string;
}

/** Result for one mailbox in a batch: credentials on success, a reason on failure. */
export type RedeemItem =
  | {
      ok: true;
      index: number;
      username: string;
      email: string;
      password: string;
    }
  | {
      ok: false;
      index: number;
      username: string;
      error: string;
      kind: ErrorKind;
      field: ErrorField | null;
    };

/** Whether the account details were sent to the notification address in the request; the whole field is null when none was given. Delivery failure does not affect the activation result. */
export interface RedeemNotification {
  to: string;
  sent: boolean;
  /** Why it was not sent (the server's Chinese text); null when sent. */
  error: string | null;
}

export interface RedeemResult {
  domain: string;
  mailboxes: RedeemItem[];
  imap: ServerEndpoint | null;
  smtp: ServerEndpoint | null;
  /** Webmail address; null when there is none. */
  webmail: string | null;
  notification: RedeemNotification | null;
}

export interface OnboardApi {
  lookup(code: string, signal?: AbortSignal): Promise<CdkInfo>;
  checkUsername(input: UsernameInput, signal?: AbortSignal): Promise<void>;
  redeem(input: RedeemInput, signal?: AbortSignal): Promise<RedeemResult>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSecurity(value: unknown): value is Security {
  return value === "tls" || value === "starttls" || value === "none";
}

function readEndpoint(value: unknown): ServerEndpoint | null {
  if (!isRecord(value)) return null;
  const host = typeof value.host === "string" ? value.host.trim() : "";
  const port = typeof value.port === "number" ? value.port : Number.parseInt(String(value.port ?? ""), 10);
  if (!host || !Number.isInteger(port) || port <= 0 || port > 65535) return null;
  return {
    host,
    port,
    security: isSecurity(value.security) ? value.security : "tls",
  };
}

export function readCdkInfo(body: unknown): CdkInfo {
  if (!isRecord(body) || !Array.isArray(body.domains)) throw new NetworkError("响应格式无效。");
  const domains = body.domains
    .filter((d): d is string => typeof d === "string" && d.trim() !== "")
    .map((d) => d.trim().toLowerCase());
  if (domains.length === 0) throw new NetworkError("响应格式无效。");
  // The count decides how many rows can be filled in; anything but a non-negative integer is unusable and fails like any other malformed response.
  if (typeof body.usesLeft !== "number" || !Number.isSafeInteger(body.usesLeft) || body.usesLeft < 0) {
    throw new NetworkError("响应格式无效。");
  }
  const rawQuotaSupport = body.quotaSupportedByDomain;
  const quotaSupportedByDomain = isRecord(rawQuotaSupport)
    ? Object.fromEntries(
        domains.flatMap((domain) =>
          typeof rawQuotaSupport[domain] === "boolean" ? [[domain, rawQuotaSupport[domain]]] : [],
        ),
      )
    : undefined;
  return {
    domains,
    ...(quotaSupportedByDomain ? { quotaSupportedByDomain } : {}),
    expiresAt: typeof body.expiresAt === "string" && body.expiresAt ? body.expiresAt : null,
    usesLeft: body.usesLeft,
    ...(typeof body.turnstileSiteKey === "string" && body.turnstileSiteKey.trim()
      ? { turnstileSiteKey: body.turnstileSiteKey.trim() }
      : {}),
  };
}

function readRedeemItem(value: unknown, position: number): RedeemItem {
  if (!isRecord(value)) throw new NetworkError("响应格式无效。");
  const index = typeof value.index === "number" && Number.isInteger(value.index) ? value.index : position;
  const username = typeof value.username === "string" ? value.username : "";
  if (value.ok === true) {
    const email = typeof value.email === "string" ? value.email : "";
    const password = typeof value.password === "string" ? value.password : "";
    if (!email || !password) throw new NetworkError("响应格式无效。");
    return { ok: true, index, username, email, password };
  }
  const error = typeof value.error === "string" && value.error.trim() ? value.error.trim() : "开通失败。";
  return {
    ok: false,
    index,
    username,
    error,
    kind: isErrorKind(value.kind) ? value.kind : "other",
    field: isErrorField(value.field) ? value.field : null,
  };
}

function readNotification(value: unknown): RedeemNotification | null {
  if (!isRecord(value)) return null;
  const to = typeof value.to === "string" ? value.to.trim() : "";
  if (!to) return null;
  const error = typeof value.error === "string" && value.error.trim() ? value.error.trim() : null;
  return { to, sent: value.sent === true, error };
}

export function readRedeemResult(body: unknown): RedeemResult {
  if (!isRecord(body) || !Array.isArray(body.mailboxes) || body.mailboxes.length === 0) {
    throw new NetworkError("响应格式无效。");
  }
  const domain = typeof body.domain === "string" ? body.domain : "";
  if (!domain) throw new NetworkError("响应格式无效。");
  const webmail = typeof body.webmail === "string" && /^https:\/\//i.test(body.webmail) ? body.webmail : null;
  return {
    domain,
    mailboxes: body.mailboxes.map(readRedeemItem),
    imap: readEndpoint(body.imap),
    smtp: readEndpoint(body.smtp),
    webmail,
    notification: readNotification(body.notification),
  };
}

/** Turns a non-2xx response into an ApiError; a body of an unknown shape is treated as other. */
export function readApiError(status: number, body: unknown): ApiError {
  const record = isRecord(body) ? body : {};
  const message = typeof record.error === "string" && record.error.trim() ? record.error.trim() : `HTTP ${status}`;
  const kind = isErrorKind(record.kind) ? record.kind : status === 429 ? "rate_limited" : "other";
  const index =
    typeof record.index === "number" && Number.isInteger(record.index) && record.index >= 0 ? record.index : null;
  return new ApiError(message, status, kind, isErrorField(record.field) ? record.field : null, index);
}

export function createApi(
  base: string,
  fetchImpl: typeof fetch = (...args) => fetch(...args),
  lang?: NotifyLang,
): OnboardApi {
  const root = base.replace(/\/+$/, "");

  async function post(path: string, payload: unknown, signal?: AbortSignal): Promise<unknown> {
    let response: Response;
    try {
      response = await fetchImpl(`${root}/api/onboard/${path}`, {
        method: "POST",
        mode: "same-origin",
        credentials: "omit",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(lang ? { "Accept-Language": lang } : {}),
        },
        body: JSON.stringify(payload),
        signal,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new NetworkError("连不上服务器。");
    }
    let body: unknown = null;
    const text = await response.text();
    if (text.trim()) {
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
    }
    if (!response.ok) throw readApiError(response.status, body);
    return body;
  }

  return {
    async lookup(code, signal) {
      return readCdkInfo(await post("cdk", { code }, signal));
    },
    async checkUsername(input, signal) {
      await post("username", input, signal);
    },
    async redeem(input, signal) {
      return readRedeemResult(await post("redeem", input, signal));
    },
  };
}
