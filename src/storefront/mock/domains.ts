/**
 * Buyer-owned domains of the in-memory shop, for next dev only ("Buyer domains" in docs/storefront-api.md). Nothing is looked
 * up in DNS: what a domain does is decided by the first label of its name, so every state of the page can be seen on purpose.
 *
 * | Name starts with | What happens                                                                                         |
 * | ---------------- | ---------------------------------------------------------------------------------------------------- |
 * | (anything else)  | "Verify" succeeds; the records match after two checks; then it waits for approval, given two checks later |
 * | `pending-`       | The ownership TXT record is never found: "Verify" answers 409 with mail's reason                      |
 * | `expired-`       | The ownership value has expired: "Verify" answers 409 until a new value is requested                  |
 * | `busy-`          | "Verify" is rate limited: 429 with Retry-After of 5 minutes                                           |
 * | `down-`          | The mail server cannot be asked: "Verify" answers 503                                                 |
 * | `slow-`          | Stays "provisioning" for two checks after "Verify"                                                    |
 * | `review-`        | Is never approved                                                                                     |
 * | `suspended-`     | Is suspended by the provider once verified                                                            |
 * | `conflict-`      | The MX record stays in conflict with another host's                                                   |
 * | `error-`         | The SPF lookup keeps failing                                                                          |
 * | `grace-`         | The buyer's plan has lapsed into its grace period                                                     |
 * | `taken`          | Already in use on the mail service (409 when adding)                                                  |
 *
 * `co.uk`, `github.io` and other public suffixes, and the provider's own names (abnormalhq.com, abnormal.bid and anything above
 * or below them), are refused when adding, like mail refuses them.
 */
import { randomBytes } from "node:crypto";
import type { AccountDomain, DomainCheck, DomainRecord } from "@/storefront/lib/domains";

type Say = (zh: string, en: string) => string;

/** A reduced list, like mail's own (apps/console/src/lib/shop/public-suffix.ts). */
const PUBLIC_SUFFIXES = new Set([
  "com",
  "net",
  "org",
  "io",
  "dev",
  "co.uk",
  "org.uk",
  "com.cn",
  "github.io",
  "pages.dev",
]);
const PROVIDER_HOSTS = ["abnormalhq.com", "abnormal.bid"];
const DOMAIN_NAME = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const SEVEN_DAYS = 7 * 86_400_000;
const ID = /^[a-z0-9]{15}$/;

interface StoredDomain {
  id: string;
  name: string;
  owner: string;
  state: "pending" | "provisioning" | "review" | "live";
  suspended: boolean;
  token: string;
  expires: number;
  verifiedAt: number | null;
  created: number;
  /** Checks answered since ownership was verified: the records "spread" and the approval "arrives" as they add up. */
  checks: number;
}

export interface DomainAnswer {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

const error = (status: number, message: string, headers?: Record<string, string>): DomainAnswer => ({
  status,
  body: { error: message },
  headers,
});

/**
 * A refusal with a stable code, as mail answers them since contract version 3 (`shop.refusalCodes` in
 * docs/onboard-contract.json): `error` in the request's language, the code, and the buyer-facing text in both languages.
 * The wording is mail's (packages/i18n/src/messages/{zh,en}/shop.ts). A demo backend before version 3 (`coded` off)
 * answers `{ error }` only, like every refusal did then.
 */
function refusal(
  coded: boolean,
  say: Say,
  status: number,
  code: string,
  zh: string,
  en: string,
  headers?: Record<string, string>,
): DomainAnswer {
  return {
    status,
    body: coded ? { error: say(zh, en), code, messages: { zh, en } } : { error: say(zh, en) },
    headers,
  };
}

function related(a: string, b: string): boolean {
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

export class MockDomains {
  private readonly domains = new Map<string, StoredDomain>();
  private readonly now: () => number;
  /** Whether a verified domain waits for the provider's approval (mail's default) or goes live at once. */
  private readonly approval: boolean;
  /** Whether refusals of verify, check and refresh carry a code and both texts (mail since contract version 3). */
  private readonly coded: boolean;

  constructor(now: () => number, approval = process.env.MOCK_DOMAIN_APPROVAL !== "off", coded = true) {
    this.now = now;
    this.approval = approval;
    this.coded = coded;
  }

  private label(domain: StoredDomain): string {
    return domain.name.split("-")[0]!;
  }

  private publish(domain: StoredDomain): AccountDomain {
    const pending = domain.state === "pending";
    return {
      id: domain.id,
      name: domain.name,
      status: domain.suspended ? "suspended" : domain.state,
      phase: this.label(domain) === "grace" ? "grace" : "active",
      ownership: pending
        ? {
            type: "TXT",
            name: `_mailhq-verification.${domain.name}`,
            value: `mailhq-verification=${domain.token}`,
            expiresAt: new Date(domain.expires).toISOString(),
          }
        : null,
      verifiedAt: domain.verifiedAt ? new Date(domain.verifiedAt).toISOString() : null,
      created: new Date(domain.created).toISOString(),
    };
  }

  /** The records to publish, and what "public DNS" says after this many checks. */
  private records(domain: StoredDomain): DomainRecord[] {
    const { name, checks } = domain;
    const label = this.label(domain);
    const after = (count: number) => (checks >= count ? ("matched" as const) : ("missing" as const));
    const row = (
      type: DomainRecord["type"],
      host: string,
      value: string,
      purpose: string,
      required: boolean,
      status: DomainRecord["status"],
      extra: Partial<DomainRecord> = {},
    ): DomainRecord => ({ type, name: host, value, purpose, required, status, observed: [], ...extra });
    return [
      label === "conflict"
        ? row("MX", name, "mail.abnormalhq.com", "mx", true, "conflict", {
            priority: 10,
            observed: ["10 mx.other-host.example."],
          })
        : row("MX", name, "mail.abnormalhq.com", "mx", true, after(1), { priority: 10 }),
      row("TXT", name, "v=spf1 include:spf.abnormalhq.com ~all", "spf", true, label === "error" ? "error" : after(1)),
      row(
        "TXT",
        `mail._domainkey.${name}`,
        "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAdemoDemoDemoDemoDemoDemoDemoDemoDemoDemoQIDAQAB",
        "dkim",
        true,
        after(2),
      ),
      row("TXT", `_dmarc.${name}`, `v=DMARC1; p=none; rua=mailto:dmarc@${name}`, "dmarc", false, after(2)),
      row("CNAME", `autoconfig.${name}`, "autoconfig.abnormalhq.com", "autoconfig-host", false, "missing"),
      row("SRV", `_imaps._tcp.${name}`, "0 1 993 mail.abnormalhq.com", "client-discovery", false, "missing"),
      row("SRV", `_submissions._tcp.${name}`, "0 1 465 mail.abnormalhq.com", "client-discovery", false, "missing"),
    ];
  }

  private check(domain: StoredDomain): DomainCheck {
    const records = domain.state === "pending" || domain.state === "provisioning" ? [] : this.records(domain);
    return {
      domain: this.publish(domain),
      records,
      ready: records.length > 0 && records.every((item) => !item.required || item.status === "matched"),
      checkedAt: new Date(this.now()).toISOString(),
    };
  }

  /** Once the mail service has set the domain up it waits for approval, or goes live at once when none is required. */
  private provisioned(domain: StoredDomain): void {
    domain.state = this.approval ? "review" : "live";
    domain.verifiedAt = this.now();
    domain.checks = 0;
    if (this.label(domain) === "suspended") domain.suspended = true;
  }

  list(owner: string, limit: number): { limit: number; domains: AccountDomain[] } {
    return {
      limit,
      domains: [...this.domains.values()].filter((item) => item.owner === owner).map((item) => this.publish(item)),
    };
  }

  /** The domains new mailboxes of the owner's orders can go on: live, not suspended, and the plan not lapsed past grace. */
  usable(owner: string): string[] {
    return [...this.domains.values()]
      .filter((item) => item.owner === owner && item.state === "live" && !item.suspended)
      .map((item) => item.name);
  }

  write(action: string, owner: string, body: Record<string, unknown>, say: Say, limit: number): DomainAnswer {
    const refuse = (status: number, code: string, zh: string, en: string) =>
      refusal(this.coded, say, status, code, zh, en);
    if (action === "add") {
      const name = typeof body.domain === "string" && body.domain.length <= 255 ? body.domain.trim().toLowerCase() : "";
      if (!DOMAIN_NAME.test(name))
        return error(400, say("请填写域名，例如 example.com。", "Enter a domain name, for example example.com."));
      if (PUBLIC_SUFFIXES.has(name))
        return error(
          400,
          say(
            "这是公共后缀，不是你自己的域名。请填写在它之下注册的域名。",
            "That is a public suffix, not a domain of your own. Enter the domain you registered under it.",
          ),
        );
      if (limit < 1)
        return error(403, say("你的套餐不包含使用自己的域名。", "Your plan doesn't include using your own domain."));
      if (PROVIDER_HOSTS.some((host) => related(name, host)))
        return error(
          409,
          say(
            "这个域名属于本邮件服务，请填写你自己的域名。",
            "That domain belongs to this mail service. Enter a domain of your own.",
          ),
        );
      // One answer for "managed", "reserved by someone else" and "being set up": who has it is nobody's business.
      if (name.startsWith("taken") || [...this.domains.values()].some((item) => item.name === name))
        return error(409, say("这个域名已在本邮件服务中使用。", "That domain is already in use on this mail service."));
      if ([...this.domains.values()].filter((item) => item.owner === owner).length >= limit)
        return error(
          409,
          say(
            `你的套餐可接入 ${limit} 个自有域名，已达上限。`,
            `Your plan allows ${limit} ${limit === 1 ? "domain" : "domains"} of your own, and you have that many.`,
          ),
        );
      const domain: StoredDomain = {
        id: randomBytes(8).toString("hex").slice(0, 15),
        name,
        owner,
        state: "pending",
        suspended: false,
        token: randomBytes(16).toString("hex"),
        // An `expired-` name starts with a value that has already run out, to see "Get a new value".
        expires: this.now() + (name.startsWith("expired-") ? -1 : SEVEN_DAYS),
        verifiedAt: null,
        created: this.now(),
        checks: 0,
      };
      this.domains.set(domain.id, domain);
      return { status: 201, body: { domain: this.publish(domain) } };
    }
    const domain = typeof body.id === "string" && ID.test(body.id) ? this.domains.get(body.id) : undefined;
    // The same answer whether or not the domain exists.
    if (!domain || domain.owner !== owner) return refuse(404, "domain_not_found", "域名不存在。", "Domain not found.");
    const label = this.label(domain);
    if (action === "verify") {
      if (label === "busy")
        return error(429, say("操作过于频繁，请稍后重试。", "Too many requests. Please try again later."), {
          "Retry-After": "300",
        });
      if (label === "down")
        return refuse(
          503,
          "domain_unavailable",
          "暂时无法接入域名，请稍后再试。",
          "Domains can't be set up right now. Please try again later.",
        );
      if (domain.state === "pending") {
        if (domain.expires <= this.now())
          return refuse(
            409,
            "domain_ownership_expired",
            "验证值已过期。请获取新的验证值并更新 TXT 记录，然后重新验证。",
            "The verification value has expired. Get a new one, update the TXT record, then verify again.",
          );
        if (label === "pending")
          return refuse(
            409,
            "domain_ownership_not_found",
            "暂时查不到验证用的 TXT 记录。请在 DNS 服务商处核对记录的名称和值，等待解析生效后再验证。",
            "The verification TXT record isn't visible yet. Check its name and value at your DNS host, wait for the change to spread, then verify again.",
          );
        // Ownership is verified: the mail service sets the domain up, at once or (`slow-`) over the next two checks.
        if (label === "slow") {
          domain.state = "provisioning";
          domain.checks = 0;
        } else this.provisioned(domain);
      }
      return { status: 200, body: this.check(domain) };
    }
    if (action === "check") {
      if (domain.state !== "pending") domain.checks += 1;
      if (domain.state === "provisioning" && domain.checks >= 2) this.provisioned(domain);
      // The provider approves a little after the records are in place; `review-` is never approved.
      else if (domain.state === "review" && domain.checks >= 4 && label !== "review") domain.state = "live";
      return { status: 200, body: this.check(domain) };
    }
    if (action === "refresh") {
      if (domain.state !== "pending")
        return refuse(
          409,
          "domain_already_verified",
          "这个域名的所有权已经验证，不需要新的验证值。",
          "This domain's ownership is already verified, so it needs no new verification value.",
        );
      domain.token = randomBytes(16).toString("hex");
      domain.expires = this.now() + SEVEN_DAYS;
      return { status: 200, body: { domain: this.publish(domain) } };
    }
    // remove: only before ownership is verified; afterwards the domain exists on the mail service and removing it is the provider's.
    if (domain.state !== "pending")
      return error(
        409,
        say(
          "这个域名已在邮件服务上开通，如需移除请联系客服。",
          "This domain is already set up on the mail service. Contact support to remove it.",
        ),
      );
    this.domains.delete(domain.id);
    return { status: 200, body: { ok: true } };
  }
}
