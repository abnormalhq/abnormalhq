/**
 * The security and privacy overview (/security/), English. It states only what this repository and mail's documentation
 * back up: the privacy policy (src/content/legal/), and in abnormalhq/mail docs/security.md, secrets.md,
 * mail-transport-security.md, dane-dnssec.md, mail-safety.md, antivirus.md, webmail-security.md, webmail-user-settings.md,
 * webmail-encryption.md, webmail-masked-addresses.md and webmail-read-receipts.md.
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
  reviewed: "2026-11-24",
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
          p: "Encryption in transit protects a message on its way between your device, our servers and other mail servers. It is not end-to-end encryption by itself (see “End-to-end encryption (OpenPGP)” below), and how a message is protected once it reaches another provider is up to that provider. No transmission over the internet is entirely without risk.",
        },
      ],
    },
    {
      title: "Protecting your sign-in",
      blocks: [
        {
          ul: [
            "**Passkeys**: you can add a passkey under Settings, Security in webmail and then sign in to webmail with it, with no address, password or code to type. A passkey only proves it is you: it neither stores nor replaces your mailbox password, and mail apps still use the password or an app password.",
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
      title: "End-to-end encryption (OpenPGP)",
      blocks: [
        {
          ul: [
            "**Encrypted in your browser**: once you generate or import a key under Settings, Security, Encryption (OpenPGP) in webmail, the composer offers Encrypt and Sign. The body, the attachments and the subject (encrypted too by default) are encrypted in your browser before the message leaves, and the server only stores and passes on ciphertext.",
            "**The private key stays with you**: it is locked with a passphrase you choose and kept in your browser, never sent to the server. You can download a backup that GnuPG, Thunderbird and other clients import. Forget the passphrase without a backup and encrypted mail can never be read again; we cannot recover it either.",
            "**Standard OpenPGP**: messages use OpenPGP (PGP/MIME), so you can exchange encrypted mail with people on GnuPG, Thunderbird and the like, and decrypt and verify the encrypted and signed mail you receive. A correspondent's public key can be found through the Web Key Directory, imported from a message or pasted in, and is used only after you check its fingerprint and confirm it.",
            "**Per message, never quietly downgraded**: only the messages you choose to encrypt are protected. With Encrypt on, a recipient without a confirmed key stops the send and is named; the message is never sent in the clear instead.",
          ],
        },
        {
          p: "End-to-end encryption does not hide metadata: the sender, the recipients, the time, the size, and the subject when subject encryption is off are still visible to the server. Encrypted mail cannot be searched by its content and has no AI summaries, translation or offline reading. Webmail's encryption code is served by the server each time, so it protects against someone who obtains the server's data (a leaked database or backup), not against someone who can change the code webmail serves; to protect yourself from the mail provider itself, use the exported key in a mail client you install.",
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
      title: "Masked addresses, no tracking",
      blocks: [
        {
          ul: [
            "**Masked addresses**: you can create random masked addresses to give to websites or strangers. Mail to one lands in your own inbox, a reply goes out from that address by default, and the other side never sees your real one. Turn it off when you no longer want the mail, and mail to it is bounced from then on.",
            "**No tracking**: webmail adds no tracking pixels to the mail you send and never rewrites links to count clicks. A read receipt is sent only when you choose to send one.",
          ],
        },
      ],
    },
    {
      title: "How your data is stored",
      blocks: [
        {
          ul: [
            "**Mail**: your messages, folders and flags are stored on our own mail servers. We don't analyse mail content for advertising and never sell it.",
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
            "**No end-to-end encryption by default.** Only the messages you encrypt with OpenPGP are ciphertext on the server; all other mail is stored on our mail servers in a form the service can read. That is what lets webmail show, search and filter it, and it means the content of that mail is not hidden from the service.",
            "**No zero-access encryption.** Our management system can technically show mailbox contents (for mail encrypted with OpenPGP, only the ciphertext). We access a mailbox only to troubleshoot problems with it or with the system, to handle a request you made yourself, to deal with abuse reports or security incidents, or to cooperate with competent authorities as the law requires. Viewing, moving and deleting mail and sending from a mailbox are recorded in the management system's activity log.",
            "**AI features send content to a third party.** When they are used, the relevant mail or ticket content goes to a language model provider: see [What the AI features send, and where](help/ai-features/).",
          ],
        },
        {
          p: "If you need content that only you and the recipient can read, use the OpenPGP end-to-end encryption above, or encrypt it in a mail client you install before you send it.",
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
            "**Stripe** and **Linux DO Credit** process the payment method you choose; a USDT payment goes from your own wallet over the network you chose (TRON, BNB Smart Chain, Ethereum or Solana), and Tatum tells us what arrived at the order's address.",
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
            "If you think your own mailbox or account has been taken over, change its password right away and write to us; check the [service status page](https://status.abnormalhq.com) for ongoing incidents.",
          ],
        },
      ],
    },
  ],
};
