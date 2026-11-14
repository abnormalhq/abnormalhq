/**
 * The security and privacy overview (/security/), English. It states only what this repository and mail's documentation
 * back up: the privacy policy (src/content/legal/), and in abnormalhq/mail docs/security.md, secrets.md,
 * mail-transport-security.md, dane-dnssec.md, mail-safety.md, antivirus.md, webmail-security.md and webmail-user-settings.md.
 * It makes no compliance or certification claim, and says plainly what is not offered. When any of those sources changes,
 * check every sentence here against it, in both languages, and update `reviewed`.
 */
import { site } from "../../data/site.ts";
import type { SecurityContent } from "../help/types.ts";

/** The report address with the subject the paragraph asks for already filled in. */
const supportReport = `[${site.contact.email}](mailto:${site.contact.email}?subject=Security)`;

export const securityEn: SecurityContent = {
  title: "Security and privacy, plainly",
  summary:
    "What protects your mailbox, what we can and cannot see, where your data is processed, and how to report a problem. This page is an overview; the Privacy Policy is the authoritative text.",
  reviewed: "2026-11-10",
  sections: [
    {
      title: "Encryption in transit",
      blocks: [
        {
          ul: [
            "**Our sites**: this website, the shop, webmail and the status page use HTTPS throughout.",
            "**Mail apps**: the IMAP and SMTP settings we publish for your mailbox use TLS, and calendars and contacts sync over HTTPS (CalDAV and CardDAV).",
            "**Between mail servers**: our mail servers accept mail over TLS, publish an MTA-STS policy in enforce mode, and publish DANE (TLSA) records signed with DNSSEC. A sending server that checks either delivers to us only over an encrypted connection to a verified server.",
          ],
        },
        {
          p: "Encryption in transit protects a message on its way between your device, our servers and other mail servers. It is not end-to-end encryption (see “What we don't offer” below), and how a message is protected once it reaches another provider is up to that provider. No transmission over the internet is entirely without risk.",
        },
      ],
    },
    {
      title: "Protecting your sign-in",
      blocks: [
        {
          ul: [
            "**Two-step verification**: you can add a code from an authenticator app to your mailbox sign-in, with recovery codes for a lost device. The mail server itself enforces it, so with it on, the mailbox password alone signs in nowhere: not in webmail, and not over IMAP, SMTP, CalDAV or CardDAV.",
            "**App passwords**: each mail app gets a password of its own, limited if you like to mail only or to calendars and contacts, which you can revoke without changing your mailbox password.",
            "**Limits on guessing**: sign-in, redeem and payment endpoints are rate-limited, shop account password attempts are also limited per account, and suspicious guessing of redeem codes is locked out. Sign-in pages may run a Cloudflare Turnstile check to tell people from automated programs.",
            "**Shop account**: your account password is kept only as a one-way hash, so we never see it. Sign-in, registration and password reset links work for 15 minutes, and changing the account password signs out every other browser.",
          ],
        },
        {
          p: "How to turn these on is in [Two-step verification and app passwords](help/two-step-verification/). We will never ask for your password, verification codes or card details by email, chat or any other channel.",
        },
      ],
    },
    {
      title: "Phishing warnings and virus scanning",
      blocks: [
        {
          ul: [
            "**Warnings above a message**: webmail warns when a message imitates someone, comes from a lookalike domain, failed sender authentication (SPF, DKIM, DMARC) or wants replies sent somewhere else, and notes a sender who writes to you for the first time.",
            "**Remote images**: images in a message load through our image proxy, so a sender never sees your IP address; messages in Junk do not load them automatically, and you can turn automatic loading off altogether.",
            "**Virus scanning**: incoming attachments are scanned for viruses. Webmail shows the scanner's verdict on a message, and does not open, preview or forward the attachments of a message flagged as infected.",
          ],
        },
        {
          p: "No filter catches everything. Treat unexpected links and attachments with care, whatever a banner says or does not say.",
        },
      ],
    },
    {
      title: "How your data is stored",
      blocks: [
        {
          ul: [
            "**Mail**: your messages, folders and flags are stored on our own Stalwart mail servers. We don't analyse mail content for advertising and never sell it.",
            "**Passwords**: mailbox passwords are stored encrypted in our management system, rather than hashed, because webmail and mailbox management sign in to the mail server with them. Shop account passwords are stored only as a one-way hash.",
            "**Secrets**: payment credentials, merchant keys and other sensitive settings are stored encrypted. While an import from another provider runs, that mailbox's password is kept encrypted and is deleted when the import ends.",
            "**Sessions**: for the purchase session and the shop account session, our database stores only a digest of the token in your browser.",
            "**Payments**: card payments are handled by Stripe and Credit payments by Linux DO Credit. We never see or store card numbers.",
          ],
        },
      ],
    },
    {
      title: "What we don't offer",
      blocks: [
        {
          ul: [
            "**No end-to-end encryption.** Mail is stored on our mail servers in a form the service can read. That is what lets webmail show, search and filter it, and it means the content of your mail is not hidden from the service.",
            "**No zero-access encryption.** Our management system can technically show mailbox contents. We access a mailbox only to troubleshoot problems with it or with the system, to handle a request you made yourself, to deal with abuse reports or security incidents, or to cooperate with competent authorities as the law requires. Viewing, moving and deleting mail and sending from a mailbox are recorded in the management system's activity log.",
            "**AI features send content to a third party.** When they are used, the relevant mail or ticket content goes to a language model provider: see [What the AI features send, and where](help/ai-features/).",
          ],
        },
        {
          p: "If you need content that only you and the recipient can read, encrypt it yourself before you send it.",
        },
      ],
    },
    {
      title: "Where data is processed",
      blocks: [
        {
          ul: [
            "**Cloudflare** hosts this website and runs the shop, the redeem page, webmail and the management system.",
            "**A database provider** (currently PlanetScale) stores accounts, orders, redeem codes, ticket text and settings.",
            "**A cloud host** runs our own mail servers and the mail stored on them.",
            "**Stripe** and **Linux DO Credit** process the payment method you choose; a USDT payment goes from your own wallet over the TRON network, and TronGrid tells us what arrived at the order's address.",
            "**A large language model provider** (currently DeepSeek) receives content only when the AI features are used.",
          ],
        },
        {
          p: "These providers may be located outside mainland China, so information the service needs may be transferred to and stored in other countries. The [Privacy Policy](privacy/) lists every provider, what each receives, how long we keep information and what your rights are.",
        },
      ],
    },
    {
      title: "Report a security problem",
      blocks: [
        {
          p: `If you believe you have found a security vulnerability in this website, the shop, webmail or the mail service, write to ${supportReport} with “Security” in the subject. Tell us what you found and how to reproduce it.`,
        },
        {
          ul: [
            "Please don't access, change or delete data that isn't yours, and don't disrupt the service for others while testing.",
            "Don't include passwords, verification codes or other people's personal data in the report.",
            "If you think your own mailbox or account has been taken over, change its password right away and write to us; check the [service status page](https://console.abnormalhq.com/status) for ongoing incidents.",
          ],
        },
      ],
    },
  ],
};
