/** The redeem page's copy in English (the type is Copy in i18n.ts). */
import { homepage, supportEmail, webmailUrl } from "./config.ts";
import { withoutPeriod, type Copy } from "./i18n.ts";

/** Static help copy uses the shared portal; activation results use the entry returned by the backend instead. */
const webmailLinkEn = `[Abnormal webmail](${webmailUrl})`;

const usernameRuleEn =
  "Usernames use lowercase letters, digits and . _ -, start and end with a letter or digit, have no two dots in a row, and are at most 64 characters.";

export const en: Copy = {
  title: "Redeem a mailbox · Abnormal",
  description:
    "Buy an @abnormalhq.com mailbox plan with Linux DO Credit, or redeem an existing code for a mailbox on one of its allowed domains. Pick your username and password, then start using your mail.",
  eyebrow: "New mailbox",
  titleLines: ["One code.", "One new mailbox"],
  titleDot: ".",
  tagline: "Enter your code, pick a username, set a password. Need a code? Choose a mailbox plan first.",
  ui: {
    formTitle: "Make room for your new mail",
    formDescription: "Start with your code. We’ll take it from here.",
    formBadge: "Ready right away",
    optional: "Optional",
    username: "Username",
    password: "Password",
    passwordPlaceholder: "Create your mailbox password",
    features: ["Your own username", "Works with mail apps", "Ready right away"],
    guideTitle: "New mailbox. What’s next?",
    guideDescription:
      "Start with your first email. Learn to sign in, set up a mail app, and receive verification codes.",
    guideLink: "Read the getting-started guide",
    reminderTitle: "Keep your password safe",
    reminderDescription:
      "Your password is shown once after creation. Add an email address to send yourself a copy of the account details.",
    supportTitle: "Need a hand?",
    supportDescription: "If you get stuck, we’re an email away.",
  },
  steps: {
    code: {
      label: "Code",
      hint: "Issued by an Abnormal admin. 16 letters and digits, case does not matter.",
      placeholder: "XXXX-XXXX-XXXX-XXXX",
    },
    options: {
      label: "Domain and count",
      hint: "Which domains the code allows and how many mailboxes it has left. Choose here once it is checked.",
      domain: "Domain",
      count: "How many",
    },
    accounts: {
      label: "Accounts",
      hint: "One line per mailbox. Usernames use lowercase letters, digits and . _ -, start and end with a letter or digit, at most 64 characters. Passwords need 8–128 characters with no whitespace, or let us generate one.",
      placeholder: "yourname",
      ordinal: (n) => `Mailbox ${n}`,
      usernameLabel: (n) => `Username for mailbox ${n}`,
      passwordLabel: (n) => `Password for mailbox ${n}`,
      noQuota: "Per-mailbox quota is unavailable for this domain; storage follows the server settings.",
    },
    notify: {
      label: "Email a copy",
      hint: "Optional. An address you can read right now. Once the mailboxes are created, their addresses, passwords and server settings are sent there.",
      placeholder: "you@example.com",
    },
  },
  rules: {
    length: "8+ characters",
  },
  buttons: {
    show: "Show",
    hide: "Hide",
    generate: "Generate",
    submit: (count) => (count > 1 ? `Create ${count} mailboxes` : "Create mailbox"),
    submitting: "Creating…",
    copy: "Copy",
    copied: "Copied",
    copyAll: "Copy all",
    openWebmail: "Open webmail",
  },
  submitNote: "Passwords are shown once, right after creation. Save them then.",
  noscript: "This page needs JavaScript to redeem a code.",
  msg: {
    codeChecking: "Checking the code…",
    codeIncomplete: "A code is 16 letters and digits. Check that it is complete.",
    codeRequired: "Enter your code first.",
    codeOk: (domains, expires, left) =>
      `Valid. It creates mailboxes at ${domains.map((d) => `@${d}`).join(" or ")}, ${left} left${expires ? `, until ${expires}` : ""}.`,
    countHint: (left, max) =>
      left > max ? `This code can create ${left} more, up to ${max} at a time.` : `This code can create ${left} more.`,
    rowsTrimmed: (allowed, dropped) =>
      `This code can create only ${allowed} more, so ${dropped} filled ${dropped === 1 ? "entry was" : "entries were"} removed. Check the form, then submit.`,
    usernameChecking: "Checking availability…",
    usernameOk: (email) => `${email} is available.`,
    duplicateUsername: (n) => `Same username as mailbox ${n}.`,
    passwordMissing: (labels) => `Still needs ${labels.join(", ")}.`,
    passwordOk: "The password meets the requirements.",
    passwordGenerated: "A random password was generated. Remember to save it.",
    partial: (ok, failed) => `${ok} created. ${failed} did not go through; fix them and submit again.`,
    challengePending: "A quick human check has to finish first. It is running now; submit again once it is done.",
    domainChanged: (domain) =>
      `This code creates mailboxes at @${domain}, and the addresses now show it. Check them, then submit again.`,
    networkError: "Could not reach the server. Try again in a moment.",
    unknownError: "Something went wrong. Try again in a moment.",
  },
  problem: {
    username: { required: "Enter a username.", invalid: usernameRuleEn },
    password: {
      required: "Set a password.",
      too_long: "Passwords are at most 128 characters.",
      whitespace: "Passwords cannot contain whitespace.",
      weak: "Use at least 8 characters.",
    },
    notify: {
      invalid: "Enter a full email address, like you@example.com.",
      too_long: "Email addresses are at most 254 characters.",
    },
  },
  kind: {
    invalid_code: "This code does not exist. Check it and try again.",
    code_used: "This code has been used up.",
    code_expired: "This code has expired.",
    code_disabled: "This code has been disabled.",
    count_exceeded: "That is more mailboxes than this code has left.",
    domain_invalid: "This code cannot create a mailbox at that domain.",
    username_invalid: usernameRuleEn,
    username_taken: "This username is taken. Try another one.",
    password_invalid: "Use 8–128 characters with no whitespace.",
    notify_invalid: "That email address does not look right. Check it and try again.",
    rate_limited: "Too many attempts. Try again in a moment.",
    challenge_failed: "The human check did not pass. Wait for it to finish and submit again, or reload the page.",
    unavailable: "The mail service is temporarily unavailable. Try again in a moment.",
  },
  result: {
    eyebrow: "Ready",
    title: (count) => `${count} mailboxes created`,
    login: "Login",
    loginNote: "In mail apps the username is the full address",
    imap: "IMAP (incoming)",
    smtp: "SMTP (outgoing)",
    port: "port",
    security: { tls: "SSL/TLS", starttls: "STARTTLS", none: "no encryption" },
    notified: (to) => `The account details were sent to ${to}.`,
    notifyFailed: (to, reason) =>
      `Could not send the account details to ${to}${reason ? ` (${withoutPeriod(reason)})` : ""}. Save them from this page instead.`,
    note: [
      "Passwords are shown only here, only once. Change yours in webmail Settings; if you forget it, write to ",
      ".",
    ],
    next: "For what comes next, from logging in to the mailbox to using it for Claude and ChatGPT, see the [guide](guide/).",
    again: "Redeem again",
  },
  help: {
    eyebrow: "Questions",
    title: "About redeeming.",
    items: [
      {
        q: "Where do codes come from?",
        a: "[Choose a mailbox plan](shop/) and pay with Linux DO Credit to collect a code, or use a code from an admin. The page shows how many mailboxes remain once you enter it. A used, expired or disabled code is flagged right away.",
      },
      {
        q: "How many mailboxes does a code create?",
        a: "Your purchased plan or the admin’s settings determine the count. When a code allows several, pick the count after the check and fill in a username and password for each. You can also come back later and use the same code again.",
      },
      {
        q: "What can a username be?",
        a: "Lowercase letters, digits and . _ -, starting and ending with a letter or digit, up to 64 characters. Taken usernames are flagged as you type.",
      },
      {
        q: "What does the password need?",
        a: "8–128 characters with no whitespace. Generate gives you a random 16-character one. Save it.",
      },
      {
        q: "How do I read and send mail?",
        a: `Sign in to ${webmailLinkEn}, or use a mail app that supports IMAP and SMTP. The login is your full email address. Use the server addresses, ports and security settings shown after creation. Step by step in the [guide](guide/).`,
      },
      {
        q: "Can I use it to sign up for Claude or ChatGPT?",
        a: "Yes. It is an ordinary mailbox: enter this address when signing up, and the code or login link lands here, in webmail or your mail app. The steps are in the [guide](guide/).",
      },
      {
        q: "Can I get the details by email?",
        a: "Yes. Before you submit, fill in Email a copy with an address you can read now. Once the mailboxes are created, their addresses, passwords and server settings are sent there. Leave it empty and they are shown only on this page.",
      },
      {
        q: "I forgot the password.",
        a: "It is shown only once, at creation. Write to us with the address and the code you used, and an admin resets it.",
      },
    ],
    contact: ["Anything else, write to ", "."],
  },
  footer: {
    links: [
      { label: "Website", href: homepage.en },
      { label: "Webmail", href: webmailUrl },
      { label: supportEmail, href: `mailto:${supportEmail}` },
    ],
  },
  guide: {
    title: "After you redeem · Abnormal",
    description:
      "What to do with the new mailbox: log in to webmail, set it up in a mail app on your phone or computer, and use it to sign up for and log in to Claude and ChatGPT.",
    back: "Back to redeem",
    eyebrow: "The mailbox guide",
    heading: "After you redeem.",
    contents: "On this page",
    backToTop: "Back to top",
    lede: "The mailbox is yours. This page covers three things: how to log in to it, how to read and send from the usual mail apps, and how to use it to sign up for and log in to Claude and ChatGPT.",
    sections: [
      {
        title: "Login and password",
        blocks: [
          {
            p: "Wherever you log in to this mailbox, **the login is the full address** (yourname@abnormalhq.com, for example) and the password is the one you set when redeeming. Existing @abnormal.bid mailboxes continue to use their original address to sign in.",
          },
          {
            p: `The password is shown only once, at creation. If you lose it, write to [${supportEmail}](mailto:${supportEmail}) with the address and the code you used, and an admin resets it.`,
          },
          {
            p: "If you know your current password, change it in Settings at the top right of webmail. After a successful change, sign in again and update the saved password in your mail apps.",
          },
          {
            p: "The IMAP and SMTP servers are listed on the page right after creation; if you filled in Email a copy, the account email has the same details.",
          },
        ],
      },
      {
        title: "Webmail",
        blocks: [
          {
            p: `Use Open webmail in your creation result, or visit ${webmailLinkEn}. Sign in with your full email address and the password you set. Our self-hosted Stalwart server sends, receives and stores your mail; webmail and mail apps access the same mailbox.`,
          },
          {
            p: "It works in a phone browser as well; if you read mail on your phone often, set up a mail app once, as in the next section.",
          },
        ],
      },
      {
        title: "Mail apps",
        blocks: [
          {
            p: "Apple Mail on iPhone and Mac, Gmail, Outlook and Thunderbird all work, with the same IMAP and SMTP settings. The entry point differs by app, but it is always Add account, then Other or Manual setup. Then fill in what the page after creation listed:",
          },
          {
            ol: [
              "Address and password: the full address, and the password you set.",
              "Incoming server (IMAP): use the host, port and security settings shown after creation; the username is the full address again.",
              "Outgoing server (SMTP): use the host, port and security settings shown after creation; turn on authentication, same username and password as incoming.",
              "Save, then send yourself a message. When it arrives, you are done.",
            ],
          },
          {
            p: "On iPhone and iPad the path is Settings → Mail → Accounts → Add Account → Other → Add Mail Account; after the address and password, choose IMAP and fill in the two servers.",
          },
          {
            p: "Step-by-step instructions for each app are in the [help center](help/): [Apple Mail](help/apple-mail/) (with a one-step configuration profile), [Outlook](help/outlook/), [Thunderbird](help/thunderbird/), [Gmail and Android](help/gmail-android/), and [two-step verification and app passwords](help/two-step-verification/).",
          },
        ],
      },
      {
        title: "Logging in to Claude",
        blocks: [
          {
            p: "Claude logs you in by email; there is no password. This mailbox is the key.",
          },
          {
            ol: [
              "Open [claude.ai](https://claude.ai/), choose Continue with email and enter the new address.",
              "In the mailbox, open the message titled Secure link to log in to Claude.ai and click Sign in with Claude.ai. On the same device it logs you straight in; on another device it shows a code to type on the device you started from.",
              "The first time, Claude also verifies a phone number: enter your own mobile number and type the six-digit code it texts you. This happens once.",
              "Every later login is just the first two steps.",
            ],
          },
        ],
      },
      {
        title: "Logging in to ChatGPT",
        blocks: [
          {
            ol: [
              "Open [chatgpt.com](https://chatgpt.com/), click Sign up, enter the new address and continue. If you already have an account, click Log in.",
              "Set a password when asked (at least 12 characters).",
              "Fetch the six-digit code from the mailbox and type it in. The email comes from noreply@tm.openai.com or otp@tm1.openai.com; codes expire quickly, so use the latest one.",
              "Enter your name and birthday, and you are in. When you later log in from a new device or place, it may send another code to this mailbox; handle it the same way.",
            ],
          },
        ],
      },
      {
        title: "No code arriving?",
        blocks: [
          {
            ul: [
              "Wait a minute or two and refresh the inbox; check the spam folder too.",
              "Make sure you typed the full address on their side, with no typos.",
              "Click Resend and use only the newest message; older codes are already void.",
              `Still nothing? Write to [${supportEmail}](mailto:${supportEmail}) with the address and the time.`,
            ],
          },
          {
            p: "Claude and ChatGPT are offered only in the regions they list. If the page does not open or says your region is not supported, check [Anthropic's supported regions](https://www.anthropic.com/supported-countries) and [OpenAI's supported countries](https://help.openai.com/en/articles/7947663-chatgpt-supported-countries).",
          },
        ],
      },
    ],
  },
};
