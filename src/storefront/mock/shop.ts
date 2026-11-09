/**
 * In-memory shop for next dev only; no provider credentials or network calls. It follows mail's rules where the pages
 * can tell the difference: orders are reachable through the purchase cookie or the signed-in account, orders placed while
 * signed in belong to the account, a sign-in link only claims this browser's orders when this browser asked for it,
 * a password can be set without the current one only within 10 minutes of signing in by link and signs other browsers out,
 * registering mails (logs) a confirmation link that sets the password, the mailbox manager only touches the account's own orders' mailboxes,
 * paying returns to the order page in the form's language, and errors come in the request's language.
 */
import { createHash, randomBytes } from "node:crypto";
import { passwordProblem, usernameProblem } from "@/storefront/lib/onboard";
import type {
  AccountMailbox,
  AccountMailboxes,
  CustomerAccount,
  PublicShopOrder,
  RenewalSummary,
  ShopCatalog,
  ShopProduct,
} from "@/storefront/lib/shop";

const COOKIE = "mailhq_shop";
const TOKEN = /^[a-f0-9]{64}$/;
const ORDER_ID = /^[a-z0-9]{15}$/;
/** The most periods one renewal can add (mail's RENEW_MAX_PERIODS; docs/onboard-contract.json). */
export const RENEW_MAX_PERIODS = 12;
const HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "same-origin",
};
const DEMO_CODE = "ABCD-EFGH-JKLM-NPQR";
const PRODUCT: ShopProduct = {
  id: "demoproduct0001",
  name: "演示套餐 · 单人邮箱",
  description: "仅供本地开发演示，支付按钮会模拟付款，不会扣除真实 Credit。",
  originalPriceCents: 1000,
  discountPercent: 25,
  priceCents: 750,
  mailboxCount: 1,
  quotaMb: 1024,
  quotaSupportedByDomain: { "abnormal.bid": true },
  codeExpiresDays: 30,
  domains: ["abnormal.bid"],
  periodDays: 0,
  renewPriceCents: 0,
};
const SUBSCRIPTION_PRODUCT: ShopProduct = {
  id: "demoproduct0002",
  name: "演示套餐 · 月付邮箱",
  description: "仅供本地开发演示：每 30 天续费一次，到期前会收到提醒。",
  originalPriceCents: 500,
  discountPercent: 0,
  priceCents: 500,
  mailboxCount: 1,
  quotaMb: 2048,
  quotaSupportedByDomain: { "abnormal.bid": true },
  codeExpiresDays: 30,
  domains: ["abnormal.bid"],
  periodDays: 30,
  renewPriceCents: 400,
  fiatPriceMinor: 299,
};
const PRODUCTS = [PRODUCT, SUBSCRIPTION_PRODUCT];
/** Token of the demo renewal link; the local subscription id is the purchase order number. */
const RENEW_TOKEN = /^demo-([a-z0-9]{15})$/;
const CUSTOMER_COOKIE = "mailhq_customer";
const CUSTOMER_TOKEN = /^[A-Za-z0-9_-]{43}$/;
// State cookie during Google login (mail's src/lib/shop/google.ts); the mock does not talk to Google and uses a fake token of the same shape.
const GOOGLE_COOKIE = "mailhq_shop_google";
const GOOGLE_TOKEN = /^[A-Za-z0-9_-]{1,512}\.[A-Za-z0-9_-]{1,1024}\.[A-Za-z0-9_-]{43}$/;
const GOOGLE_COOKIE_PATH = "/api/shop/account/google";
/** Local "Sign in with Google" is always this Google account (a Gmail address: mail only auto-links or opens accounts for Google-managed mailboxes). */
export const MOCK_GOOGLE_EMAIL = "google.buyer@gmail.com";

interface StoredOrder {
  buyerHash: string;
  /** Contact email given at order time (when ordering while logged in without one, the account email, like mail): logging in with this email attaches the order to the account. */
  contactEmail: string;
  /** Request language at order time; when the payment form carries no lang, payment returns to the order page in this language (same as mail's payment return address). */
  locale: "zh" | "en";
  order: PublicShopOrder["order"];
}

interface StoredLogin {
  email: string;
  /** Purchase session of the browser that requested the login link; like mail, its orders are attached only when the same browser uses the link. */
  buyerHash: string | null;
  /** A registration confirmation link carries the password set at registration: it takes effect only when the link is used. */
  password?: string;
  /** Password reset link after a forgotten password: can only set a new password (account/reset), not log in directly. */
  reset?: boolean;
  /** Like mail, links expire after 15 minutes (millisecond timestamp on the shop's clock). */
  expires: number;
}

/** Lifetime of login, registration and reset links, 15 minutes like mail's LOGIN_TOKEN_MINUTES. */
const LINK_MS = 15 * 60_000;

/** Usernames already taken in the demo (same as the redeem page's mock API). */
const TAKEN_USERNAMES = new Set(["admin", "support", "postmaster", "abuse", "noreply", "hello", "kunish"]);

interface StoredSubscription {
  productName: string;
  end: number;
  /** The demo card subscription always has auto-renewal on. */
  stripe: boolean;
}

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(body, {
    status,
    headers: { ...Object.fromEntries(new Headers(headers)), ...HEADERS },
  });
}

function failure(status: number, error: string): Response {
  return json({ error }, status);
}

function buyerToken(request: Request): string | null {
  const values = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${COOKIE}=`))
    .map((part) => part.slice(COOKIE.length + 1));
  return values.length === 1 && TOKEN.test(values[0]) ? values[0] : null;
}

function cookieValue(request: Request, name: string, pattern: RegExp): string | null {
  const values = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`))
    .map((part) => part.slice(name.length + 1));
  return values.length === 1 && pattern.test(values[0]) ? values[0] : null;
}

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Next dev can normalize request.url to localhost for a 127.0.0.1 visit. */
function requestOrigin(request: Request): string | null {
  const url = new URL(request.url);
  const host = request.headers.get("host");
  if (!host) return url.origin;
  if (!/^(?:[a-z0-9.-]+|\[[a-f0-9:]+\])(?::\d{1,5})?$/i.test(host)) return null;
  try {
    return new URL(`${url.protocol}//${host}`).origin;
  } catch {
    return null;
  }
}

function isRecord(body: unknown): body is Record<string, unknown> {
  return typeof body === "object" && body !== null && !Array.isArray(body);
}

export class MockShopStore {
  private readonly orders = new Map<string, StoredOrder>();
  private readonly subscriptions = new Map<string, StoredSubscription>();
  /** Demo login: login token -> email and the browser that requested it, session -> email, email -> the order numbers it owns. */
  private readonly logins = new Map<string, StoredLogin>();
  private readonly sessions = new Map<string, string>();
  /** How and when a session logged in: decides whether a new password can be set without the current one. */
  private readonly sessionInfo = new Map<string, { method: "link" | "password" | "google"; created: number }>();
  /** Google logins started but not yet returned: state -> expiry and the page language at start. */
  private readonly googleFlows = new Map<string, { expires: number; lang: "zh" | "en"; link: string | null }>();
  /** Accounts linked to Google -> the email on Google's side. */
  private readonly googleLinks = new Map<string, string>();
  /** Mailbox management: purchase order number -> the demo mailboxes activated with its redeem code. */
  private readonly mailboxes = new Map<string, AccountMailbox[]>();
  /** Login passwords of demo accounts (in memory only, for development). */
  private readonly passwords = new Map<string, string>();
  private readonly owned = new Map<string, Set<string>>();
  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  async fetch(route: string, request: Request): Promise<Response> {
    const english = /^en(?:-|;|,|$)/i.test(request.headers.get("accept-language")?.trim() ?? "");
    const say = (zh: string, en: string) => (english ? en : zh);
    const notFound = say("未找到订单，请使用下单时的浏览器。", "Order not found. Use the browser you ordered in.");
    const badFormat = say("请求格式无效。", "The request format is invalid.");
    const badOrderId = say("订单编号无效。", "The order number is invalid.");
    const loginInvalid = say(
      "登录链接无效、已过期或已经用过，请重新获取。",
      "This sign-in link is invalid, expired or already used. Request a new one.",
    );
    const renewalInvalid = say("续费链接无效或已过期。", "This renewal link is invalid or has expired.");
    const notSignedIn = say("请先登录。", "Please sign in first.");
    const unavailableProduct = say("该演示套餐暂不可购买。", "This demo plan cannot be bought right now.");
    if (
      ![
        "catalog",
        "orders",
        "checkout",
        "pay",
        "pay/stripe",
        "reconcile",
        "renewal",
        "renew",
        "account",
        "account/login",
        "account/peek",
        "account/verify",
        "account/logout",
        "account/portal",
        "account/password-login",
        "account/password",
        "account/register",
        "account/forgot",
        "account/reset",
        "account/google/start",
        "account/google",
        "account/google/unlink",
        "account/mailboxes",
        "account/mailboxes/create",
        "account/mailboxes/password",
        "account/mailboxes/status",
        "account/mailboxes/delete",
      ].includes(route)
    ) {
      return failure(404, say("接口不存在。", "Endpoint not found."));
    }
    const method = ["catalog", "orders", "account", "account/mailboxes"].includes(route) ? "GET" : "POST";
    if (request.method !== method) {
      return json({ error: say(`只接受 ${method}。`, `Only ${method} is accepted.`) }, 405, { Allow: method });
    }
    const origin = requestOrigin(request);
    if (!origin) return failure(403, say("请求地址无效。", "The request address is invalid."));
    const url = new URL(request.url);
    // Support the same optional base path as the development route.
    const apiIndex = url.pathname.lastIndexOf("/api/shop/");
    const base = apiIndex > 0 ? url.pathname.slice(0, apiIndex) : "";
    const onboardUrl = `${origin}${base}/`;
    if (route === "catalog") {
      const catalog: ShopCatalog = {
        available: true,
        payment: { ldc: true, stripe: { currency: "usd" } },
        products: structuredClone(PRODUCTS),
        onboardUrl,
      };
      return json(catalog);
    }
    const token = buyerToken(request);
    const session = cookieValue(request, CUSTOMER_COOKIE, CUSTOMER_TOKEN);
    const customer = session ? (this.sessions.get(session) ?? null) : null;
    if (route === "account/mailboxes") {
      if (!customer) return failure(401, notSignedIn);
      return json(this.mailboxList(customer));
    }
    if (route === "account") {
      if (!customer) return failure(401, notSignedIn);
      return json(this.account(customer));
    }
    if (route === "orders") {
      if (url.searchParams.getAll("id").length !== 1) {
        return failure(400, badOrderId);
      }
      const stored = this.findOrder(url.searchParams.get("id"), token, customer);
      if (!stored) return failure(404, notFound);
      return json(this.publicOrder(stored, onboardUrl));
    }
    if (request.headers.get("origin") !== origin) {
      return failure(
        403,
        say("请求来源无效，请刷新页面后重试。", "The request origin is invalid. Reload the page and try again."),
      );
    }
    const form = route === "pay";
    const type = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (type !== (form ? "application/x-www-form-urlencoded" : "application/json")) {
      return failure(415, badFormat);
    }
    let body: Record<string, unknown>;
    try {
      const text = await request.text();
      if (new TextEncoder().encode(text).length > 4096)
        return failure(413, say("请求内容过长。", "The request is too large."));
      if (form) {
        const params = new URLSearchParams(text);
        if (params.getAll("orderId").length !== 1) return failure(400, badOrderId);
        body = { orderId: params.get("orderId"), lang: params.get("lang") };
      } else {
        const value: unknown = JSON.parse(text);
        if (!isRecord(value)) return failure(400, badFormat);
        body = value;
      }
    } catch {
      return failure(400, badFormat);
    }
    const secure = origin.startsWith("https:") ? "; Secure" : "";
    if (route === "account/login") {
      if (typeof body.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()))
        return failure(400, say("联系邮箱格式不正确。", "The email address is not valid."));
      const login = randomBytes(32).toString("base64url");
      this.logins.set(login, {
        email: body.email.trim().toLowerCase(),
        buyerHash: token ? hash(token) : null,
        expires: this.now() + LINK_MS,
      });
      // No real mail is sent locally: the login link is printed in the dev server log.
      console.info(`[mock shop] 登录链接：${onboardUrl}shop/account/?login=${login}`);
      return json({ sent: true });
    }
    if (route === "account/peek") {
      // Read-only like mail: say which mailbox the link is for without spending it or setting a cookie.
      const login = this.link(body.token);
      if (!login) return failure(400, loginInvalid);
      return json({ email: login.email, register: login.password !== undefined, reset: login.reset === true });
    }
    if (route === "account/verify") {
      const login = this.link(body.token);
      // Like mail: a reset link cannot be used as a login link.
      if (!login || login.reset) return failure(400, loginInvalid);
      this.logins.delete(body.token as string);
      const { email } = login;
      // Registration confirmation link: set the password from registration and, as with a password change, log this account out in every other browser.
      if (login.password !== undefined) {
        this.passwords.set(email, login.password);
        this.signOutOthers(email, null);
      }
      // This browser's orders are attached only when it requested the link itself.
      const browser = token && login.buyerHash === hash(token) ? login.buyerHash : null;
      const { sessionToken, claimed } = this.signIn(email, browser, "link");
      return json({ email, claimed }, 200, {
        "Set-Cookie": `${CUSTOMER_COOKIE}=${sessionToken}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax${secure}`,
      });
    }
    if (route === "account/forgot") {
      if (typeof body.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()))
        return failure(400, say("请输入有效的邮箱地址。", "Enter a valid email address."));
      const email = body.email.trim().toLowerCase();
      // Like mail: no mail is sent when the account does not exist, but the answer is the same.
      const known = this.passwords.has(email) || [...this.sessions.values()].includes(email) || this.owned.has(email);
      if (known) {
        const login = randomBytes(32).toString("base64url");
        this.logins.set(login, {
          email,
          buyerHash: token ? hash(token) : null,
          reset: true,
          expires: this.now() + LINK_MS,
        });
        console.info(`[mock shop] 重设密码链接：${onboardUrl}shop/account/?reset=${login}`);
      }
      return json({ sent: true });
    }
    if (route === "account/reset") {
      const login = this.link(body.token);
      const password = typeof body.password === "string" ? body.password : "";
      if ([...password].length < 8 || [...password].length > 128)
        return failure(400, say("密码需为 8–128 个字符。", "The password must be 8 to 128 characters."));
      if (!login?.reset)
        return failure(
          400,
          say(
            "重设密码的链接无效、已过期或已经用过，请重新申请。",
            "This password reset link is invalid, expired or already used. Ask for a new one.",
          ),
        );
      this.logins.delete(body.token as string);
      this.passwords.set(login.email, password);
      this.signOutOthers(login.email, null);
      const browser = token && login.buyerHash === hash(token) ? login.buyerHash : null;
      const { sessionToken, claimed } = this.signIn(login.email, browser, "link");
      return json({ email: login.email, claimed }, 200, {
        "Set-Cookie": `${CUSTOMER_COOKIE}=${sessionToken}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax${secure}`,
      });
    }
    if (route === "account/google/start") {
      // Linking from the account page: must be logged in; on return the Google account is linked to this account.
      if (body.link === true && !customer) return failure(401, notSignedIn);
      const state = randomBytes(32).toString("base64url");
      const lang = body.lang === "en" ? "en" : "zh";
      this.googleFlows.set(state, {
        expires: this.now() + 10 * 60_000,
        lang,
        link: body.link === true ? customer : null,
      });
      // No Google locally: like Google, return to the callback address without trailing / with a fake authorization code, and the site forwards to the Chinese account page (the language is kept in the state).
      return json({ url: `${onboardUrl}shop/account?code=mock-google&state=${state}` }, 200, {
        "Set-Cookie": `${GOOGLE_COOKIE}=mock.${state}.${randomBytes(32).toString("base64url")}; Path=${base}${GOOGLE_COOKIE_PATH}; Max-Age=600; HttpOnly; SameSite=Lax${secure}`,
      });
    }
    if (route === "account/google") {
      const headers = new Headers(HEADERS);
      headers.append(
        "Set-Cookie",
        `${GOOGLE_COOKIE}=; Path=${base}${GOOGLE_COOKIE_PATH}; Max-Age=0; HttpOnly; SameSite=Lax${secure}`,
      );
      const answer = (status: number, payload: unknown) => Response.json(payload, { status, headers });
      // Like mail: the answer is accepted only from the browser that started the login (the state in the cookie must match what Google brought back), and only once.
      const cookie = cookieValue(request, GOOGLE_COOKIE, GOOGLE_TOKEN);
      const state = cookie?.split(".")[1] ?? "";
      const flow = this.googleFlows.get(state);
      this.googleFlows.delete(state);
      if (!flow || flow.expires <= this.now() || body.state !== state || body.code !== "mock-google")
        return answer(400, {
          error: say(
            "Google 登录没有完成，请重新点「使用 Google 登录」。",
            "Google sign-in didn't finish. Choose “Continue with Google” again.",
          ),
        });
      const holder = [...this.googleLinks].find(([, google]) => google === MOCK_GOOGLE_EMAIL)?.[0] ?? null;
      if (flow.link) {
        if (customer !== flow.link) return answer(401, { error: notSignedIn });
        if (holder && holder !== customer)
          return answer(409, {
            error: say(
              "这个 Google 账户已经关联了另一个商店账户，请先在那个账户里解除关联。",
              "This Google account is already linked to another shop account. Unlink it there first.",
            ),
          });
        this.googleLinks.set(customer, MOCK_GOOGLE_EMAIL);
        return answer(200, { email: customer, claimed: 0, created: false, linked: true, lang: flow.lang });
      }
      // The linked account; otherwise the account with the same Gmail address (auto-link); otherwise open a new account.
      const email = holder ?? MOCK_GOOGLE_EMAIL;
      const created = !this.owned.has(email);
      const linked = !holder && !created;
      this.googleLinks.set(email, MOCK_GOOGLE_EMAIL);
      const { sessionToken, claimed } = this.signIn(email, token ? hash(token) : null, "google");
      headers.append(
        "Set-Cookie",
        `${CUSTOMER_COOKIE}=${sessionToken}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax${secure}`,
      );
      return answer(200, { email, claimed, created, linked, lang: flow.lang });
    }
    if (route === "account/google/unlink") {
      if (!customer) return failure(401, notSignedIn);
      if (!this.googleLinks.delete(customer))
        return failure(404, say("这个账户没有关联 Google。", "This account isn't linked to Google."));
      return json({ ok: true });
    }
    if (route === "account/register") {
      if (typeof body.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()))
        return failure(400, say("请输入有效的邮箱地址。", "Enter a valid email address."));
      const password = typeof body.password === "string" ? body.password : "";
      if ([...password].length < 8 || [...password].length > 128)
        return failure(400, say("密码需为 8–128 个字符。", "The password must be 8 to 128 characters."));
      const login = randomBytes(32).toString("base64url");
      this.logins.set(login, {
        email: body.email.trim().toLowerCase(),
        buyerHash: token ? hash(token) : null,
        password,
        expires: this.now() + LINK_MS,
      });
      // No real mail is sent locally: the registration confirmation link is printed in the dev server log.
      console.info(`[mock shop] 注册确认链接：${onboardUrl}shop/account/?login=${login}`);
      return json({ sent: true });
    }
    if (route.startsWith("account/mailboxes/")) {
      if (!customer) return failure(401, notSignedIn);
      return this.mailboxWrite(route.slice("account/mailboxes/".length), customer, body, say);
    }
    if (route === "account/password-login") {
      if (typeof body.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()))
        return failure(400, say("请输入有效的邮箱地址。", "Enter a valid email address."));
      if (typeof body.password !== "string" || !body.password)
        return failure(400, say("请输入密码。", "Enter your password."));
      const email = body.email.trim().toLowerCase();
      // Like mail: no account, no password set and wrong password all get the same answer.
      if (this.passwords.get(email) !== body.password)
        return failure(
          401,
          say(
            "邮箱或密码不正确。还没设置过密码的话，请改用邮件链接登录。",
            "The email or password is incorrect. If you haven't set a password, sign in with an email link instead.",
          ),
        );
      // Whoever typed the password is in this browser, so its orders are attached.
      const { sessionToken, claimed } = this.signIn(email, token ? hash(token) : null, "password");
      return json({ email, claimed }, 200, {
        "Set-Cookie": `${CUSTOMER_COOKIE}=${sessionToken}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax${secure}`,
      });
    }
    if (route === "account/password") {
      if (!customer || !session) return failure(401, notSignedIn);
      const password = typeof body.password === "string" ? body.password : "";
      const length = [...password].length;
      if (length < 8 || length > 128)
        return failure(400, say("密码需为 8–128 个字符。", "The password must be 8 to 128 characters."));
      const info = this.sessionInfo.get(session);
      const fresh = (info?.method === "link" || info?.method === "google") && this.now() - info.created < 10 * 60_000;
      const current = this.passwords.get(customer);
      if (!fresh && (!current || body.currentPassword !== current))
        return failure(
          403,
          say(
            "请正确输入当前密码。忘记了的话，用邮件链接重新登录，10 分钟内即可直接设置新密码。",
            "Enter your current password correctly. If you've forgotten it, sign in again with an email link, then set a new one within 10 minutes.",
          ),
        );
      this.passwords.set(customer, password);
      // Logins in other browsers are all ended; this one is kept.
      this.signOutOthers(customer, session);
      return json({ ok: true });
    }
    if (route === "account/portal") {
      if (!customer) return failure(401, notSignedIn);
      // Demo: no Stripe, so a fixed portal address is returned.
      return json({ url: "https://billing.stripe.com/p/session/demo" });
    }
    if (route === "account/logout") {
      if (session) {
        this.sessions.delete(session);
        this.sessionInfo.delete(session);
      }
      return json({ ok: true }, 200, {
        "Set-Cookie": `${CUSTOMER_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`,
      });
    }
    if (route === "renewal") {
      const summary = this.renewalSummary(body.token);
      if (!summary) return failure(404, renewalInvalid);
      return json(summary);
    }
    if (route === "checkout" || route === "renew") {
      const renewal = route === "renew" ? this.renewalSummary(body.token) : null;
      const product = PRODUCTS.find((item) => item.id === body.productId);
      if (route === "renew" && !renewal) return failure(404, renewalInvalid);
      // Like mail: Stripe charges its subscriptions itself, so they cannot be renewed by hand here.
      if (renewal?.provider === "stripe")
        return failure(
          409,
          say(
            "这个订阅由 Stripe 按期自动扣款，不能在这里手动续费；请登录账户页管理自动续费或更新银行卡。",
            "This subscription renews automatically through Stripe and can't be renewed here. Sign in to your account to manage auto-renewal or update your card.",
          ),
        );
      if (route === "checkout" && !product) return failure(409, unavailableProduct);
      if (route === "checkout" && body.provider === "stripe" && !product?.fiatPriceMinor)
        return failure(409, unavailableProduct);
      const periods = renewal ? body.periods : 1;
      if (typeof periods !== "number" || !Number.isSafeInteger(periods) || periods < 1 || periods > RENEW_MAX_PERIODS)
        return failure(
          400,
          say(`请选择 1 ～ ${RENEW_MAX_PERIODS} 个周期。`, `Choose between 1 and ${RENEW_MAX_PERIODS} periods.`),
        );
      const buyer = token ?? randomBytes(32).toString("hex");
      let id: string;
      do {
        id = randomBytes(8).toString("hex").slice(0, 15);
      } while (this.orders.has(id));
      const price = renewal ? renewal.renewPriceCents * periods : 0;
      // Orders placed while logged in belong to this account from the start (like mail's customer_id).
      if (customer) {
        const owned = this.owned.get(customer) ?? new Set<string>();
        owned.add(id);
        this.owned.set(customer, owned);
      }
      const contactEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      this.orders.set(id, {
        buyerHash: hash(buyer),
        // mail's order creation records the account email when no contact email was given; renewal orders record only one that was given.
        contactEmail: contactEmail || (route === "checkout" ? (customer ?? "") : ""),
        locale: english ? "en" : "zh",
        order: renewal
          ? {
              id,
              productName: renewal.productName,
              originalPriceCents: price,
              discountPercent: 0,
              priceCents: price,
              mailboxCount: renewal.mailboxCount,
              quotaMb: 0,
              codeExpiresDays: 0,
              domains: [],
              kind: "renewal",
              periods,
              periodDays: renewal.periodDays,
              subscriptionId: renewal.subscriptionId,
              status: "pending",
              created: new Date(this.now()).toISOString(),
              paidAt: null,
            }
          : {
              id,
              productName: product!.name,
              originalPriceCents: product!.originalPriceCents,
              discountPercent: product!.discountPercent,
              priceCents: product!.priceCents,
              mailboxCount: product!.mailboxCount,
              quotaMb: product!.quotaMb,
              quotaSupportedByDomain: { ...product!.quotaSupportedByDomain },
              codeExpiresDays: product!.codeExpiresDays,
              domains: [...product!.domains],
              kind: "purchase",
              periods: 1,
              periodDays: product!.periodDays,
              renewPriceCents: product!.renewPriceCents,
              ...(body.provider === "stripe"
                ? {
                    provider: "stripe" as const,
                    currency: "usd",
                    priceCents: product!.fiatPriceMinor ?? 0,
                    originalPriceCents: product!.fiatPriceMinor ?? 0,
                    discountPercent: 0,
                    // Same as the backend: Stripe subscriptions charge the fiat price from purchase time each period.
                    renewPriceCents: product!.fiatPriceMinor ?? 0,
                  }
                : { provider: "ldc" as const }),
              status: "pending",
              created: new Date(this.now()).toISOString(),
              paidAt: null,
            },
      });
      return json({ orderId: id }, 201, {
        "Set-Cookie": `${COOKIE}=${buyer}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${origin.startsWith("https:") ? "; Secure" : ""}`,
      });
    }
    const stored = this.findOrder(body.orderId, token, customer);
    if (!stored) return failure(404, notFound);
    if (route === "pay/stripe") {
      // The demo does not talk to Stripe and so has no publishable key: like mail without one, the page falls back to the "Pay" form (pressing it locally counts as paid).
      if (stored.order.provider !== "stripe")
        return failure(409, say("该订单暂时无法支付。", "This order cannot be paid right now."));
      return json({ status: stored.order.status === "paid" ? "paid" : "hosted" });
    }
    if (route === "pay") {
      // A local button press simulates provider confirmation; no money is sent.
      if (stored.order.status !== "paid") {
        stored.order.status = "paid";
        stored.order.paidAt = new Date(this.now()).toISOString();
        this.startOrExtend(stored);
      }
      // Locally, pressing "Pay" counts as paid, as if the payment provider sent the buyer back to the order page: like mail's payment return address, use the form's lang,
      // and when an old page does not send it, the language at order time.
      const lang = body.lang === "en" || body.lang === "zh" ? body.lang : stored.locale;
      // The site's layout: English at the root, Chinese under /zh/.
      const prefix = lang === "zh" ? "/zh" : "";
      return new Response(null, {
        status: 303,
        headers: {
          ...HEADERS,
          Location: `${base}${prefix}/shop/orders/?id=${stored.order.id}`,
        },
      });
    }
    return json(this.publicOrder(stored, onboardUrl));
  }

  /** A link that is still usable (login, registration or reset): exists and has not expired. */
  private link(token: unknown): StoredLogin | undefined {
    const login = typeof token === "string" ? this.logins.get(token) : undefined;
    return login && login.expires > this.now() ? login : undefined;
  }

  /** Ends every session of this account except keep. */
  private signOutOthers(email: string, keep: string | null): void {
    for (const [other, owner] of this.sessions) {
      if (owner === email && other !== keep) {
        this.sessions.delete(other);
        this.sessionInfo.delete(other);
      }
    }
  }

  /** The account's paid purchase orders: mailbox management covers only the mailboxes activated with their redeem codes (like mail). */
  private paidPurchases(email: string): PublicShopOrder["order"][] {
    return [...(this.owned.get(email) ?? [])]
      .map((id) => this.orders.get(id)?.order)
      .filter((order): order is PublicShopOrder["order"] => Boolean(order))
      .filter((order) => order.status === "paid" && (order.kind ?? "purchase") === "purchase");
  }

  private mailboxList(email: string): AccountMailboxes {
    const groups = this.paidPurchases(email).map((order) => {
      const mailboxes = this.mailboxes.get(order.id) ?? [];
      const limit = order.mailboxCount;
      return {
        orderId: order.id,
        productName: order.productName,
        code: DEMO_CODE,
        codeStatus: mailboxes.length >= limit ? ("used" as const) : ("available" as const),
        usesLeft: Math.max(0, limit - mailboxes.length),
        mailboxLimit: limit,
        codeExpires: null,
        domains: mailboxes.length >= limit ? [] : [...order.domains],
        locked: false,
        mailboxes: structuredClone(mailboxes),
      };
    });
    const server = {
      imap: { host: "mail.abnormal.bid", port: 993, security: "tls" },
      smtp: { host: "mail.abnormal.bid", port: 465, security: "tls" },
    };
    const domains = new Set(
      groups.flatMap((group) => [...group.domains, ...group.mailboxes.map((m) => m.email.split("@")[1]!)]),
    );
    return {
      groups,
      servers: Object.fromEntries([...domains].map((domain) => [domain, structuredClone(server)])),
      webmail: "https://webmail.abnormalhq.com/",
    };
  }

  /** The four write operations of mailbox management: only mailboxes of the account's own orders count, anyone else's are reported as not found (like mail, not revealing whether they exist). */
  private mailboxWrite(
    action: string,
    email: string,
    body: Record<string, unknown>,
    say: (zh: string, en: string) => string,
  ): Response {
    const notFound = failure(
      404,
      say("找不到这个邮箱，或者它不在你的账户名下。", "This mailbox doesn't exist or doesn't belong to your account."),
    );
    const orders = this.paidPurchases(email);
    if (action === "create") {
      const order = orders.find((item) => item.id === body.orderId);
      if (!order) return failure(404, say("未找到订单。", "Order not found."));
      const list = this.mailboxes.get(order.id) ?? [];
      if (list.length >= order.mailboxCount)
        return failure(409, say("这个兑换码已经用完了。", "This code has been used up."));
      if (typeof body.domain !== "string" || !order.domains.includes(body.domain))
        return failure(400, say("请选择可用的域名。", "Choose an available domain."));
      const username = typeof body.username === "string" ? body.username : "";
      if (usernameProblem(username)) return failure(400, say("用户名格式不对。", "The username is not valid."));
      const password = typeof body.password === "string" ? body.password : "";
      if (passwordProblem(password))
        return failure(
          400,
          say("密码需为 8–128 个字符，不能有空格。", "The password must be 8 to 128 characters with no spaces."),
        );
      const address = `${username}@${body.domain}`;
      const exists = [...this.mailboxes.values()].some((items) => items.some((item) => item.email === address));
      if (TAKEN_USERNAMES.has(username) || exists)
        return failure(409, say("这个用户名已被占用。", "This username is taken."));
      list.push({
        id: randomBytes(8).toString("hex").slice(0, 15),
        email: address,
        status: "active",
        quotaMb: order.quotaMb,
        usageMb: 0,
        created: new Date(this.now()).toISOString(),
      });
      this.mailboxes.set(order.id, list);
      const servers = this.mailboxList(email).servers[body.domain]!;
      return json({ email: address, ...servers, webmail: "https://webmail.abnormalhq.com/" }, 201);
    }
    let found: { list: AccountMailbox[]; index: number } | null = null;
    for (const order of orders) {
      const list = this.mailboxes.get(order.id) ?? [];
      const index = list.findIndex((item) => item.id === body.mailboxId);
      if (index !== -1) found = { list, index };
    }
    if (!found) return notFound;
    const mailbox = found.list[found.index]!;
    if (action === "password") {
      if (typeof body.password !== "string" || passwordProblem(body.password))
        return failure(
          400,
          say("密码需为 8–128 个字符，不能有空格。", "The password must be 8 to 128 characters with no spaces."),
        );
      return json({ email: mailbox.email });
    }
    if (action === "status") {
      if (body.status !== "active" && body.status !== "disabled")
        return failure(400, say("邮箱状态只能是启用或停用。", "A mailbox can only be enabled or disabled."));
      mailbox.status = body.status;
      return json({ status: body.status });
    }
    if (typeof body.confirm !== "string" || body.confirm.trim().toLowerCase() !== mailbox.email)
      return failure(
        400,
        say("请完整输入邮箱地址，确认删除。", "Type the full mailbox address to confirm the deletion."),
      );
    found.list.splice(found.index, 1);
    return json({ ok: true });
  }

  /** Opens a session and attaches to the account the orders whose contact email is this one and the orders of the browser purchase session (orders already owned by someone else stay). */
  private signIn(
    email: string,
    browser: string | null,
    method: "link" | "password" | "google",
  ): { sessionToken: string; claimed: number } {
    const sessionToken = randomBytes(32).toString("base64url");
    this.sessions.set(sessionToken, email);
    this.sessionInfo.set(sessionToken, { method, created: this.now() });
    const owned = this.owned.get(email) ?? new Set<string>();
    let claimed = 0;
    for (const [id, stored] of this.orders) {
      if (this.ownerOf(id) !== null) continue;
      if ((browser && stored.buyerHash === browser) || stored.contactEmail === email) {
        owned.add(id);
        claimed++;
      }
    }
    this.owned.set(email, owned);
    return { sessionToken, claimed };
  }

  private account(email: string): CustomerAccount {
    const orders = [...(this.owned.get(email) ?? [])]
      .map((id) => this.orders.get(id))
      .filter((stored): stored is StoredOrder => Boolean(stored))
      .map(({ order }) => order);
    return {
      email,
      hasPassword: this.passwords.has(email),
      google: this.googleLinks.has(email) ? { email: this.googleLinks.get(email)! } : null,
      subscriptions: orders
        .filter((order) => order.kind !== "renewal" && order.status === "paid" && this.subscriptions.has(order.id))
        .map((order) => {
          const summary = this.renewalSummary(`demo-${order.id}`)!;
          return {
            id: order.id,
            productName: summary.productName,
            state: summary.state,
            currentPeriodEnd: summary.currentPeriodEnd,
            periodDays: summary.periodDays,
            renewPriceCents: summary.renewPriceCents,
            mailboxCount: summary.mailboxCount,
            mailboxes: summary.mailboxes,
            renewToken: summary.provider === "stripe" ? null : `demo-${order.id}`,
            provider: summary.provider,
            autoRenew: summary.autoRenew,
            currency: "usd",
            fiatRenewMinor: SUBSCRIPTION_PRODUCT.fiatPriceMinor,
          };
        }),
      orders: orders.map((order) => ({
        id: order.id,
        kind: order.kind ?? "purchase",
        productName: order.productName,
        priceCents: order.priceCents,
        periods: order.periods ?? 1,
        periodDays: order.periodDays ?? 0,
        status: order.status,
        provider: order.provider ?? "ldc",
        currency: order.currency ?? "",
        created: order.created,
        paidAt: order.paidAt,
        code: order.status === "paid" && order.kind !== "renewal" ? DEMO_CODE : null,
        // Consistent with mailbox management: once the quota is filled the redeem code is used up.
        codeStatus:
          order.status === "paid" && order.kind !== "renewal"
            ? (this.mailboxes.get(order.id)?.length ?? 0) >= order.mailboxCount
              ? "used"
              : "available"
            : null,
      })),
    };
  }

  /** Like mail's findAccessibleOrder: the purchase session or the logged-in account, either owning the order makes it visible. */
  private findOrder(id: unknown, token: string | null, customer: string | null): StoredOrder | null {
    if (typeof id !== "string" || !ORDER_ID.test(id)) return null;
    const stored = this.orders.get(id);
    if (!stored) return null;
    if (token && stored.buyerHash === hash(token)) return stored;
    return customer && this.owned.get(customer)?.has(id) ? stored : null;
  }

  /** Which account an order belongs to; null when it belongs to none. */
  private ownerOf(id: string): string | null {
    for (const [email, owned] of this.owned) if (owned.has(id)) return email;
    return null;
  }

  /** On payment: a subscription plan starts its clock, a renewal order extends from the original expiry (or now). */
  private startOrExtend(stored: StoredOrder) {
    const order = stored.order;
    const days = (order.periodDays ?? 0) * (order.periods ?? 1);
    if (!days) return;
    const id = order.kind === "renewal" ? order.subscriptionId! : order.id;
    const current = this.subscriptions.get(id);
    const base = Math.max(current?.end ?? 0, this.now());
    this.subscriptions.set(id, {
      productName: order.productName,
      end: base + days * 86_400_000,
      stripe: current?.stripe ?? order.provider === "stripe",
    });
  }

  private renewalSummary(token: unknown): RenewalSummary | null {
    const id = typeof token === "string" ? RENEW_TOKEN.exec(token)?.[1] : null;
    const subscription = id ? this.subscriptions.get(id) : null;
    if (!id || !subscription) return null;
    return {
      subscriptionId: id,
      productName: subscription.productName,
      mailboxCount: SUBSCRIPTION_PRODUCT.mailboxCount,
      periodDays: SUBSCRIPTION_PRODUCT.periodDays!,
      renewPriceCents: SUBSCRIPTION_PRODUCT.renewPriceCents!,
      currentPeriodEnd: new Date(subscription.end).toISOString(),
      state: subscription.end > this.now() ? "active" : "grace",
      mailboxes: ["demo@abnormal.bid"],
      maxPeriods: subscription.stripe ? 0 : RENEW_MAX_PERIODS,
      hasContactEmail: false,
      provider: subscription.stripe ? "stripe" : "ldc",
      autoRenew: subscription.stripe,
    };
  }

  private publicOrder(stored: StoredOrder, onboardUrl: string): PublicShopOrder {
    const paid = stored.order.status === "paid";
    const renewal = stored.order.kind === "renewal";
    const order = stored.order;
    const subscriptionId = renewal ? order.subscriptionId : order.id;
    const subscription = paid && subscriptionId ? this.subscriptions.get(subscriptionId) : null;
    return {
      order: structuredClone(stored.order),
      code: paid && !renewal ? DEMO_CODE : null,
      codeStatus: paid && !renewal ? "available" : null,
      onboardUrl,
      subscription: subscription
        ? {
            currentPeriodEnd: new Date(subscription.end).toISOString(),
            state: subscription.end > this.now() ? "active" : "grace",
            renewToken: `demo-${subscriptionId}`,
            provider: subscription.stripe ? ("stripe" as const) : ("ldc" as const),
            autoRenew: subscription.stripe,
          }
        : null,
    };
  }
}
