/**
 * The developer documentation (/developers/), English. It states only what abnormalhq/mail documents for its management API:
 * docs/api.md (keys, scopes, responses, rate limits, webhooks), docs/mcp.md, docs/multi-tenancy.md (how a workspace is
 * applied for) and docs/api-versioning.md. Limits that are deployment settings are named as defaults and pointed at
 * GET /capabilities, which reports the values in force. When any of those sources changes, check every sentence here
 * against it, in both languages, and update `reviewed`. The endpoint list below the text comes from ./reference.ts.
 */
import { developerApi, site } from "../../data/site.ts";
import type { DevelopersContent } from "../help/types.ts";

const support = `[${site.contact.email}](mailto:${site.contact.email})`;

export const developersEn: DevelopersContent = {
  title: "Build on Abnormal",
  summary:
    "The management API and MCP server of an Abnormal workspace: manage domains, mailboxes, aliases, lists and webhooks from your own code or from an AI agent, with scoped keys and signed events.",
  reviewed: "2026-11-12",
  sections: [
    {
      title: "What the API does",
      blocks: [
        {
          p: "The API manages a workspace's mail service. Everything it does, an admin can also do in the admin console; the API lets a script, an integration or an agent do it instead.",
        },
        {
          ul: [
            "**Domains**: verify ownership, connect a domain, check its DNS, set a catch-all, add alias domains.",
            "**Mailboxes**: create, delete and restore them, and change passwords, status, quotas, notes and daily sending limits.",
            "**Addresses**: forwarding rules, plain aliases and distribution lists.",
            "**Compliance and reports**: legal holds, inactive mailboxes, storage per domain and top senders.",
            "**Events**: signed webhooks for mailbox, domain, order, bulk job and security events.",
            "**Sending and receiving**: send from your domains, follow each message's delivery, and receive mail as webhooks (after approval).",
            "**Agent mailboxes**: a mailbox for an AI agent in one call, with its inbox, threaded replies and a key for that mailbox alone.",
            "**Mail apps**: let your mailbox users authorize your app, with OAuth, to read their mail and send as them.",
            "**Delivery**: the suppression list and message trace.",
            "**Batches**: many changes in one ordered, idempotent request.",
          ],
        },
      ],
    },
    {
      title: "Get a workspace and a key",
      blocks: [
        {
          ol: [
            `**Get a workspace.** The API belongs to a workspace in the admin console. [Apply for a workspace](${developerApi.signup}); a person reviews each application, and you are invited as its admin once it is approved.`,
            "**Create a key.** In the admin console open **Settings → API keys**, create a key and choose only the scopes your code needs. Only admins can create keys.",
            "**Save it at once.** The full key is shown only when it is created. Keep it in a secret store or an environment variable, never in a repository, a URL or a log.",
          ],
        },
        {
          p: "A key never does more than its owner's current role allows in the console, and a revoked key stops working at its next request. Every admin of the workspace can see and revoke the keys of the other accounts.",
        },
      ],
    },
    {
      title: "Your first request",
      blocks: [
        {
          p: `Every request goes to \`${developerApi.base}\` and carries the key as a bearer token. \`GET /capabilities\` is a good first call: it returns the scopes, the features and the limits in force.`,
        },
        {
          language: "sh",
          code: `API_BASE='${developerApi.base}'
printf 'API key: '; stty -echo; IFS= read -r API_KEY; stty echo; printf '\\n'

curl --fail-with-body "$API_BASE/capabilities" \\
  -H "Authorization: Bearer $API_KEY"`,
        },
        {
          p: "Reading the key with hidden input keeps it out of your shell history. Run `unset API_KEY` when you are done.",
        },
      ],
    },
    {
      title: "Scopes",
      blocks: [
        {
          p: "Each operation needs one scope, listed next to it in the reference below. A write scope does not include the matching read scope. Two operations differ: `POST /batch` checks the scope of every operation it carries, and `GET /batch/{requestId}` answers only the key that submitted the batch.",
        },
        {
          ul: [
            "`domains:read`, `domains:write`: domains, onboarding, DNS and connection status, catch-all, alias domains.",
            "`mailboxes:read`, `mailboxes:write`: mailboxes, the recycle bin, sending limits and the usage reports.",
            "`forwarders:*`, `aliases:*`, `lists:*`: forwarding rules, plain aliases and distribution lists.",
            "`holds:*`, `webhooks:*`, `suppressions:*`, `trace:read`: legal holds, webhooks, the suppression list and message trace.",
            "`agent_tasks:*`: follow-up tasks, the agent that answers mail as a mailbox.",
            "`emails:*`, `inbound:*`: sending through the API and inbound routing (choose them: a new key does not start with them).",
            "`agent_mailboxes:*`, `mail_apps:*`: agent mailboxes, and the apps your mailbox users can authorize (also chosen, not preset).",
          ],
        },
        {
          p: "Domains, forwarding, aliases, lists, holds and webhooks need the admin role even to read; mailbox and follow-up task scopes also work for operators, and their read scopes for viewers.",
        },
      ],
    },
    {
      title: "Requests, responses and errors",
      blocks: [
        {
          ul: [
            "Request bodies are JSON (`Content-Type: application/json`) and at most 16 KiB.",
            'A result is `{ "data": … }`, and lists add `pagination`. A create answers `201`.',
            "`{id}` in a path is the record ID the API returned, not an address or a domain name.",
            "`POST /batch` runs 1 to 25 operations in order and needs an `Idempotency-Key`: sending the same batch again with the same key returns the saved result instead of running it twice.",
          ],
        },
        {
          p: "Every error has the same shape. Branch on `code`, never on `message`, which is for people and may change:",
        },
        {
          language: "json",
          code: `{
  "error": {
    "code": "rate_limited",
    "message": "Too many requests. Try again in 42 seconds.",
    "details": { "retryAfter": 42, "limit": 300 }
  }
}`,
        },
        {
          p: "After a timeout, a dropped connection or a `502`, read the current state before you repeat a write. A `409` with `provisioning_uncertain` means a mailbox may or may not exist yet: look it up with `details.mailboxId` instead of creating it again.",
        },
      ],
    },
    {
      title: "Rate limits",
      blocks: [
        {
          ul: [
            "Requests are counted per key, REST and MCP together. The default is 300 a minute; `GET /capabilities` reports the limit in force as `limits.requestsPerMinute`.",
            "Every answer carries `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` and `RateLimit-Policy`.",
            "Over the limit the answer is `429` with `Retry-After` in seconds. A refused request did nothing, so it is safe to repeat after that wait.",
            "Too many invalid keys from one address block that address for a while, valid keys included. Fix the client that sends the wrong key.",
          ],
        },
      ],
    },
    {
      title: "Webhooks",
      blocks: [
        {
          p: "A webhook is an `https` address the workspace POSTs to when something happens, so you do not have to poll. Create one with `POST /webhooks`; the response includes the signing secret (`whsec_…`) once and never again. A workspace can have up to 10.",
        },
        {
          p: "Each delivery is signed in the `X-Mailhq-Signature` header as `t=<milliseconds>,v1=<hex HMAC-SHA256>` over the timestamp, a dot and the raw body. Check it before you trust the body:",
        },
        {
          language: "js",
          code: `import { createHmac, timingSafeEqual } from "node:crypto";

/** rawBody: the body exactly as received; header: the X-Mailhq-Signature value. */
export function verifyMailhqWebhook(secret, rawBody, header, toleranceMs = 5 * 60_000) {
  const match = /^t=(\\d+),v1=([0-9a-f]{64})$/.exec(header ?? "");
  if (!match) return false;
  const timestamp = Number(match[1]);
  if (Math.abs(Date.now() - timestamp) > toleranceMs) return false;
  const expected = createHmac("sha256", secret).update(\`\${timestamp}.\`).update(rawBody).digest();
  const given = Buffer.from(match[2], "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}`,
        },
        {
          ul: [
            "Answer `2xx` within 10 seconds and do the work afterwards.",
            "Delivery is at least once and not ordered: drop repeats by the event `id`.",
            "A failed delivery is retried with growing pauses for about 17 hours. A webhook that has failed for 3 days is switched off until you switch it on again.",
            "`POST /webhooks/{id}/test` sends a test event to check your receiver.",
          ],
        },
      ],
    },
    {
      title: "Sending and receiving mail",
      blocks: [
        {
          p: "Send mail from your own domains through their own mail server, follow each message's delivery, and receive what chosen mailboxes get as webhooks. Sending is off until we approve your workspace with a daily limit; write to us to ask. Test keys can send to the sandbox right away.",
        },
        {
          ul: [
            "`PUT /domains/{id}/sending` creates the domain's sending account: mail goes out signed with the domain's DKIM key, its bounces return to that account, and From can be any address on the domain.",
            "`POST /emails` sends one message (`POST /emails/batch` up to 50); an `Idempotency-Key` makes a retry safe. Recipients on the suppression list are skipped.",
            "`GET /emails/{id}` shows each recipient's outcome: sent, delivered, delivery delayed or bounced. The same changes arrive as `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced` and `email.failed` events.",
            "`PUT /mailboxes/{id}/inbound` turns on inbound routing: each message the mailbox receives is POSTed as `message.received`, with its plain text; read the whole message and its attachments with `GET /mailboxes/{id}/messages/{emailId}`. Aliases or a catch-all bring many addresses into one routed mailbox.",
            "If your plan bills sending by volume, subscribe under **Settings → Developers → Billing** first: until then live keys get `402 billing_required`. Each message handed to the mail server counts once, whatever its number of recipients.",
            "**Settings → Developers** in the admin console shows the day's sending allowance, the latest API calls with their error codes, each message sent and every recipient's outcome.",
          ],
        },
      ],
    },
    {
      title: "Agent mailboxes",
      blocks: [
        {
          p: "An agent mailbox is a real mailbox on your domain, made for an AI agent in one call, with inbound routing and sending already on.",
        },
        {
          ul: [
            "`POST /agent-mailboxes` with a `domain` and a `name` makes one; `GET /agent-mailboxes/{id}/messages` reads its inbox, `POST …/send` sends a new message and `POST …/messages/{emailId}/reply` replies in the thread.",
            "`POST /agent-mailboxes/{id}/keys` returns a key that works for that one mailbox only: give it to the agent, and it cannot touch anything else in the workspace.",
            "What the agent receives also arrives as `message.received` events, so it need not poll.",
          ],
        },
      ],
    },
    {
      title: "Apps your mailbox users authorize",
      blocks: [
        {
          p: "Your application can read a mailbox's mail and send as it with that user's consent, without ever seeing their password: OAuth 2.0's authorization code flow with PKCE, on Abnormal's webmail.",
        },
        {
          ul: [
            "Register the app with `POST /mail-apps`: a name, its redirect URIs, and the scopes it may ask for, `mail.read` and `mail.send`. Every app is a public client: there is no client secret, and PKCE (`S256`) is required.",
            "Send the user to the webmail's `/oauth/authorize`; they sign in, see your app's name and what it asks for, and approve. Trade the code at `/api/oauth/token` for an access token (one hour) and a refresh token that rotates on every use.",
            "Call the Mail API with the token: `GET /api/mail/v1/messages` and `/messages/{id}` read and search the mailbox, `POST /api/mail/v1/send` sends as it, with a copy in Sent.",
            "The user can revoke your app in webmail settings at any time, and changing the mailbox's password ends every authorization; `DELETE /mail-apps/{id}` ends all of your app's at once.",
          ],
        },
      ],
    },
    {
      title: "MCP for AI agents",
      blocks: [
        {
          p: `The same operations are tools on an MCP server at \`${developerApi.mcp}\` (Streamable HTTP), with the same keys, scopes and rate limit. Give an agent a key with only the scopes it needs. In Claude Code, for example:`,
        },
        {
          language: "sh",
          code: `claude mcp add --transport http abnormal ${developerApi.mcp} \\
  --header "Authorization: Bearer $ABNORMAL_API_KEY"`,
        },
        {
          p: "The server has no OAuth sign-in yet, so it works with clients that let you set a header. (OAuth for your mailbox users is separate: see below.)",
        },
      ],
    },
    {
      title: "Versions and changes",
      blocks: [
        {
          ul: [
            "The version is in the path: `/api/v1`. Within it, changes only add things: new endpoints, new optional fields, new response fields, new enum values and new event types. Your code should accept fields and values it does not know.",
            "Removing or changing something in `v1` is announced first, marked deprecated in the specification and signalled with `Deprecation` and `Sunset` headers on every response: at least 6 months ahead for anything your code sends, 3 months for a field or value it only reads.",
            `The OpenAPI 3.1 specification behind the reference below can be [downloaded as JSON](${developerApi.openapi}) for code generators and API tools.`,
            `The [status page](${developerApi.status}) shows the management API's availability over the last 30 days, checked every minute, with outages and maintenance. Your own monitors can poll \`GET ${developerApi.health}\`, which needs no key.`,
          ],
        },
      ],
    },
    {
      title: "Test mode",
      blocks: [
        {
          p: "Create a key with **Test key** turned on to build an integration without touching your real domains and mailboxes. Its token starts with `mhq_test_`, and every call it makes happens in your workspace's sandbox, whose mail server is simulated: nothing is delivered and no DNS is looked up.",
        },
        {
          ul: [
            "Domains must end with your workspace's zone, `<slug>.test` (for example `shop.acme.test`); `GET /capabilities` reports it as `sandbox.domainZone`. Their ownership check passes without DNS.",
            "Mailboxes, aliases, lists, forwarding, legal holds, batches and the suppression list work as in your workspace, and webhooks are delivered for real.",
            "Sending works without approval: every recipient is delivered at once except a local part starting with `bounce`, which bounces, and mail to a routed sandbox mailbox arrives as `message.received`.",
            "Message trace, follow-up tasks, transport security, reading received messages (an agent mailbox's included) and mail apps need real mail, so a test key gets `403 test_mode_unsupported` for them.",
            "A sandbox holds at most 5 domains and 100 mailboxes.",
          ],
        },
      ],
    },
    {
      title: "Not offered yet",
      blocks: [
        {
          ul: [
            "Deleting mail content, and reading a mailbox without its user's consent unless it is routed.",
            "Open and click tracking, and complaint (feedback loop) events.",
            "Official SDKs and a command-line tool.",
          ],
        },
        {
          p: `Mailboxes still send and receive their own mail over webmail, IMAP and SMTP. Questions about the API go to ${support}.`,
        },
      ],
    },
    {
      title: "Error codes",
      slot: "errors",
      blocks: [
        {
          p: "Every error has a stable `code`. The table lists them all, with the statuses they come with, what they mean, what to do and whether sending the same request again can succeed. Codes may be added within `v1`, so handle one you do not know by its HTTP status.",
        },
        {
          ul: [
            "**No**: the same request fails the same way until you change it.",
            "**Later**: nothing happened; it may succeed after a wait. Honour `Retry-After` when there is one.",
            "**After checking**: the outcome is unknown or the state moved. Read the current state first, because a blind repeat could do the work twice.",
          ],
        },
      ],
    },
    {
      title: "API reference",
      slot: "reference",
      blocks: [
        {
          p: "Every operation of `v1`, grouped by area, with the scope it needs. Paths are relative to the API base; the request and response schemas are in the specification.",
        },
      ],
    },
  ],
};
