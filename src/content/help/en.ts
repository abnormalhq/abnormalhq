/**
 * Help center articles, English. Every statement here is taken from this repository (the storefront copy, docs/storefront-api.md,
 * the privacy policy) or from mail's documentation (docs/ in abnormalhq/mail: client-autoconfig, webmail-security,
 * mail-import-export, webmail-rules, webmail-user-settings, webmail-calendar, webmail-contacts, managed-webmail, shop).
 * Values that differ per deployment, above all the IMAP / SMTP / CalDAV / CardDAV server names, are never written here: the
 * articles say where the reader sees their own. When mail changes a limit named here, change it in both languages.
 */
import { site } from "../../data/site.ts";
import type { HelpContent } from "./types.ts";

const support = `[${site.contact.email}](mailto:${site.contact.email})`;
const webmail = "[webmail.abnormalhq.com](https://webmail.abnormalhq.com/)";
/** Where a reader finds the server settings of their own mailbox. */
const whereSettings =
  "Your server settings are shown in three places: on the page right after the mailbox is set up, under My mailboxes in [My account](shop/account/), and in webmail under Settings → Apps & sync";

export const helpEn: HelpContent = {
  categories: {
    start: "Getting started",
    apps: "Mail apps",
    security: "Sign-in and security",
    mail: "Working with mail",
    billing: "Plans and billing",
    privacy: "Privacy",
  },
  articles: [
    {
      slug: "getting-started",
      category: "start",
      title: "Get started: buy, set up, sign in",
      summary:
        "From no mailbox to your first message: create an account, buy a plan, choose the address and password, and sign in.",
      keywords: ["start", "first steps", "purchase", "redeem code", "activate", "register", "sign up", "order"],
      sections: [
        {
          title: "Buy, set up and sign in, in four steps",
          howTo: true,
          blocks: [
            {
              ol: [
                "Create an account in [My account](shop/account/?mode=register) with your email and a password, and open the link in the confirmation email. The link works for 15 minutes.",
                "Pick a plan in the [shop](shop/) and pay with Linux DO Credit, by card or with USDT (TRC-20). You review the order before paying.",
                "Once the payment is confirmed, open My mailboxes in [My account](shop/account/), choose a username and a password, and the mailbox is set up.",
                `Sign in to webmail at ${webmail} with the full address and that password.`,
              ],
            },
            {
              p: "You can also buy without an account. The order then belongs to the browser you ordered in, and joins your account when you sign in from that browser or with the contact email you gave at checkout.",
            },
          ],
        },
        {
          title: "Buying a plan",
          blocks: [
            {
              p: "The [pricing page](pricing/) lists the plans on sale with live prices: how many mailboxes a plan includes, the storage of each, whether it is a one-time purchase or a subscription, and what renewal costs. Have a discount code? See [Discount codes](help/discount-codes/).",
            },
            {
              p: "After payment the order page shows a redeem code. The code is what sets mailboxes up: you can use it yourself in My account, or give it to someone else to enter on the [redeem page](redeem/). A plan states how long after payment its code can be used; that deadline is about the code, not about how long the mailbox lasts.",
            },
          ],
        },
        {
          title: "Setting up the mailbox",
          blocks: [
            {
              ul: [
                "**Username**: up to 64 characters; lowercase letters, digits, dots, hyphens and underscores, starting and ending with a letter or digit, with no two dots in a row.",
                "**Password**: 8 to 128 characters, without spaces. On the redeem page you can also have one generated.",
                "**On the redeem page** you can set up several mailboxes at once (up to 20 per request, as many as the code still allows) and have the account details emailed to an address of your choice.",
              ],
            },
            {
              p: "The password is shown only once, right after the mailbox is set up. Copy it then. If you lose it, the buyer of the plan can set a new one under My mailboxes in My account.",
            },
          ],
        },
        {
          title: "Signing in and what comes next",
          blocks: [
            {
              p: `Webmail is at ${webmail}: sign in with the full address (yourname@abnormalhq.com, for example) and the mailbox password. Existing @abnormal.bid mailboxes keep signing in with their original address.`,
            },
            {
              ul: [
                "Add the mailbox to a mail app: [Apple Mail](help/apple-mail/), [Outlook](help/outlook/), [Thunderbird](help/thunderbird/), [Gmail and Android](help/gmail-android/), or [any other app](help/imap-smtp/).",
                "Bring your old mail along: [Move your mail in, and take it out](help/import-and-export/).",
                "Protect the sign-in: [Two-step verification and app passwords](help/two-step-verification/).",
              ],
            },
            {
              p: `If mail is not coming or going, check the [service status page](https://status.abnormalhq.com) first. For anything else write to ${support} with your mailbox address or order number. Never send passwords, verification codes or card details.`,
            },
          ],
        },
      ],
    },
    {
      slug: "apple-mail",
      category: "apps",
      title: "Set up Apple Mail on iPhone, iPad and Mac",
      summary:
        "Install the configuration profile from webmail to add mail, calendar and contacts in one go, or add the account by hand.",
      keywords: ["ios", "iphone", "ipad", "macos", "mac", "mobileconfig", "profile", "qr code", "apple", "icloud"],
      sections: [
        {
          title: "Set up with the configuration profile",
          howTo: true,
          blocks: [
            {
              ol: [
                `Sign in to webmail at ${webmail} and open Settings → Apps & sync → Automatic setup for mail apps.`,
                "On a Mac, choose Download profile. For an iPhone or iPad, scan the QR code shown there with the Camera app. Both lead to the same link, which works for 30 minutes.",
                "Install the downloaded profile: on iPhone and iPad in Settings, under Profile Downloaded; on a Mac in System Settings → Privacy & Security → Profiles. The device marks the profile as unsigned; that is expected.",
                "Enter the mailbox password when the device asks for it. It asks once for mail, and once each for calendar and contacts when the profile includes them.",
              ],
            },
            {
              p: "The profile never contains your password. It adds the mail account (IMAP and SMTP) and, when your mail server offers them, your calendars (CalDAV) and contacts (CardDAV). Installing it again replaces the accounts it added before.",
            },
            {
              p: "With two-step verification on, enter an [app password](help/two-step-verification/) instead of the mailbox password. If Settings → Apps & sync has no automatic setup section, your domain has no automatic settings; add the account by hand as below.",
            },
          ],
        },
        {
          title: "Add the account by hand",
          blocks: [
            {
              ol: [
                "On iPhone and iPad go to Settings → Mail → Accounts → Add Account → Other → Add Mail Account. On a Mac open Mail and choose Mail → Add Account → Other Mail Account.",
                "Enter your name, the full mailbox address and the password.",
                "Choose IMAP. For the incoming server (IMAP) and the outgoing server (SMTP), enter the host name shown for your mailbox; the username is the full address for both.",
                "Save, then send yourself a message to check both directions.",
              ],
            },
            {
              p: `${whereSettings}. See [IMAP, SMTP, CalDAV and CardDAV settings](help/imap-smtp/).`,
            },
          ],
        },
        {
          title: "Calendar and contacts without the profile",
          blocks: [
            {
              p: "In webmail, Settings → Apps & sync has a Calendar sync (CalDAV) card and an Address book sync (CardDAV) card. Each shows the server and the address to use, with a copy button, and the steps for iPhone, iPad and Mac: add a CalDAV or CardDAV account with that server, your full address as the username and the mailbox password (or an app password).",
            },
          ],
        },
      ],
    },
    {
      slug: "outlook",
      category: "apps",
      title: "Set up Outlook",
      summary: "Add the mailbox to Outlook as an IMAP account, with the settings shown for your mailbox.",
      keywords: ["microsoft", "office", "windows", "autodiscover", "365", "hotmail"],
      sections: [
        {
          title: "Add your mailbox to Outlook",
          howTo: true,
          blocks: [
            {
              ol: [
                "In Outlook, choose Add account and enter your full mailbox address.",
                "If Outlook finds the settings by itself, it offers an IMAP account: continue. If it does not, choose the advanced or manual setup and pick IMAP.",
                "For a manual setup, enter the incoming (IMAP) and outgoing (SMTP) server names, ports and encryption shown for your mailbox. The username is the full address for both, and the outgoing server requires authentication.",
                "Enter the mailbox password, finish, and send yourself a message to check both directions.",
              ],
            },
            {
              p: `${whereSettings}. Whether Outlook finds them by itself depends on what your mailbox's domain publishes; entering them by hand always works.`,
            },
          ],
        },
        {
          title: "Good to know",
          blocks: [
            {
              ul: [
                "With two-step verification on, Outlook needs an [app password](help/two-step-verification/); the mailbox password alone no longer signs in from mail apps. The scope Mail only (IMAP / SMTP) is enough.",
                "After you change the mailbox password, update it in Outlook too.",
                "An IMAP account in Outlook carries mail. Your calendar and address book are in webmail, and sync to phones and other apps over CalDAV and CardDAV: see [IMAP, SMTP, CalDAV and CardDAV settings](help/imap-smtp/).",
                "Moving mail out of an Outlook.com or Microsoft 365 mailbox is a separate matter: see [Move your mail in, and take it out](help/import-and-export/).",
              ],
            },
          ],
        },
      ],
    },
    {
      slug: "thunderbird",
      category: "apps",
      title: "Set up Thunderbird",
      summary:
        "Thunderbird can look the settings up from your address; if it finds nothing, enter the ones shown for your mailbox.",
      keywords: ["mozilla", "autoconfig", "auto-configuration", "linux", "automatic"],
      sections: [
        {
          title: "Add your mailbox to Thunderbird",
          howTo: true,
          blocks: [
            {
              ol: [
                "In Thunderbird, open Account Settings and choose Account Actions → Add Mail Account.",
                "Enter your name, the full mailbox address and the password, then continue.",
                "Thunderbird looks the configuration up. When it finds one, it shows an IMAP incoming server and an SMTP outgoing server: keep IMAP selected and finish.",
                "When it finds none, choose Configure manually and enter the incoming and outgoing server names, ports and encryption shown for your mailbox, with the full address as the username for both.",
              ],
            },
            {
              p: `The automatic lookup works when your mailbox's domain publishes its settings for mail apps; the manual way always works. ${whereSettings}.`,
            },
            {
              p: "With two-step verification on, use an [app password](help/two-step-verification/) instead of the mailbox password.",
            },
          ],
        },
        {
          title: "Calendar and address book",
          blocks: [
            {
              p: "Thunderbird also syncs calendars and contacts. In webmail, Settings → Apps & sync shows the CalDAV address on the Calendar sync card and the CardDAV address on the Address book sync card, each with the steps for Thunderbird: add a network calendar with the CalDAV address, and a CardDAV address book with the CardDAV address. The username is your full address and the password is the mailbox password (or an app password).",
            },
          ],
        },
      ],
    },
    {
      slug: "gmail-android",
      category: "apps",
      title: "Set up the Gmail app and Android",
      summary:
        "Add the mailbox to the Gmail app as an IMAP account, and sync calendar and contacts on Android with DAVx⁵.",
      keywords: ["android", "google", "gmail app", "davx5", "davx", "phone", "samsung", "pixel"],
      sections: [
        {
          title: "Add the mailbox to the Gmail app",
          howTo: true,
          blocks: [
            {
              ol: [
                "Open the Gmail app, tap your profile picture and choose Add another account, then Other.",
                "Enter your full mailbox address and choose Personal (IMAP).",
                "Enter the mailbox password.",
                "For the incoming server, enter the IMAP server name, port and security type shown for your mailbox; the username is the full address.",
                "For the outgoing server, enter the SMTP server name, port and security type, require sign-in, and use the same username and password.",
                "Finish, then send yourself a message to check both directions.",
              ],
            },
            {
              p: `${whereSettings}. Other Android mail apps ask for the same values: see [IMAP, SMTP, CalDAV and CardDAV settings](help/imap-smtp/).`,
            },
            {
              p: "This adds your mailbox to the Gmail app; it does not copy anything into a Gmail account. To bring mail over from a Gmail account, see [Move your mail in, and take it out](help/import-and-export/). With two-step verification on, use an [app password](help/two-step-verification/).",
            },
          ],
        },
        {
          title: "Calendar and contacts on Android",
          blocks: [
            {
              p: "Android syncs CalDAV calendars and CardDAV address books through the DAVx⁵ app. In webmail, Settings → Apps & sync shows the CalDAV and CardDAV addresses with a copy button and the steps for Android: add an account in DAVx⁵ with that address as the base URL, your full mailbox address as the username and the mailbox password (or an app password).",
            },
          ],
        },
      ],
    },
    {
      slug: "imap-smtp",
      category: "apps",
      title: "IMAP, SMTP, CalDAV and CardDAV settings",
      summary:
        "What any mail, calendar or contacts app needs to connect, and where to find the server settings of your own mailbox.",
      keywords: [
        "server",
        "host",
        "port",
        "manual",
        "settings",
        "incoming",
        "outgoing",
        "pop3",
        "ssl",
        "tls",
        "client",
      ],
      sections: [
        {
          title: "Where to find your settings",
          blocks: [
            {
              p: "The server names, ports and encryption depend on your mailbox's domain, so this page does not list them. Yours are shown:",
            },
            {
              ul: [
                "on the page right after the mailbox is set up, and in the account email if you asked for a copy;",
                "under My mailboxes in [My account](shop/account/), for the buyer of the plan;",
                `in webmail at ${webmail}, under Settings → Apps & sync, with a copy button. The copied text never includes your password.`,
              ],
            },
          ],
        },
        {
          title: "Mail: IMAP and SMTP",
          blocks: [
            {
              ul: [
                "**Username**: the full mailbox address, for incoming and outgoing alike.",
                "**Password**: the mailbox password. With two-step verification on, an [app password](help/two-step-verification/) instead.",
                "**Incoming server**: IMAP, with the host, port and encryption shown for your mailbox.",
                "**Outgoing server**: SMTP, with the host, port and encryption shown for your mailbox, and authentication turned on.",
              ],
            },
            {
              p: "We publish IMAP and SMTP settings only; choose IMAP when an app offers a choice of account type.",
            },
          ],
        },
        {
          title: "Calendars and contacts: CalDAV and CardDAV",
          blocks: [
            {
              p: "Webmail's Settings → Apps & sync has a Calendar sync (CalDAV) card and an Address book sync (CardDAV) card. Each shows the server, the account's address and a discovery address, with steps for iPhone and iPad, Mac, Android (DAVx⁵) and Thunderbird. The username is the full mailbox address and the password is the mailbox password, or an app password with the scope Calendars & contacts.",
            },
            {
              p: "Most apps find your calendars and address books from the server name alone; when one asks for a full address, paste the one shown on the card.",
            },
          ],
        },
        {
          title: "If an app won't connect",
          blocks: [
            {
              ul: [
                "Check the username: it is the full address, not just the part before the @.",
                "After a password change, every app needs the new password. With two-step verification on, apps need app passwords.",
                "Compare the port and the encryption with what is shown for your mailbox; a mismatch between the two is the usual cause.",
                `Check the [service status page](https://status.abnormalhq.com). If it still fails, write to ${support} with the address, the app and the error it shows, but not your password.`,
              ],
            },
          ],
        },
      ],
    },
    {
      slug: "two-step-verification",
      category: "security",
      title: "Two-step verification and app passwords",
      summary:
        "Add a code from an authenticator app to your sign-in, and give each mail app a password of its own that you can revoke.",
      keywords: ["2fa", "mfa", "totp", "authenticator", "otp", "recovery codes", "app password", "security", "code"],
      sections: [
        {
          title: "Turn on two-step verification",
          howTo: true,
          blocks: [
            {
              ol: [
                "In webmail, open Settings → Security → Two-step verification, and confirm your mailbox password.",
                "Scan the QR code with an authenticator app, or type the key shown next to it.",
                "Enter the six-digit code the app shows to confirm.",
                "Save the ten recovery codes somewhere safe. They are shown only this once.",
              ],
            },
            {
              p: "When turning it on you can sign out your other webmail sessions at the same time; the box is ticked by default.",
            },
          ],
        },
        {
          title: "What changes afterwards",
          blocks: [
            {
              ul: [
                "Webmail asks for your password, then for a code from the authenticator app.",
                "Mail apps no longer sign in with the mailbox password alone, over IMAP, SMTP, CalDAV or CardDAV. Give each app an app password (below). This is enforced by the mail server itself, so a leaked password is not enough anywhere.",
                "A recovery code can be used in place of a code on the webmail sign-in page, once each. After signing in with one, webmail asks you to set up a new authenticator.",
                "Replacing the authenticator needs a current code; turning two-step verification off needs your password and a code or a recovery code.",
                "After 20 wrong codes within a day, codes stop working for the mailbox until you sign in with a recovery code or we reset two-step verification for you.",
              ],
            },
          ],
        },
        {
          title: "App passwords",
          blocks: [
            {
              p: "An app password is a separate password for one mail app. Create them in webmail under Settings → Security → App passwords: give it a name, optionally an expiry date, and a scope.",
            },
            {
              ul: [
                "**Scopes**: All mail clients; Mail only (IMAP / SMTP); or Calendars & contacts.",
                "Creating one needs your mailbox password and, with two-step verification on, a current code.",
                "The password is shown once, with a copy button. If you lose it, revoke it and create another.",
                "Revoke an app password at any time, for example when a device goes missing; your mailbox password and your other apps are not affected.",
                "A mailbox can hold a limited number of app passwords; the card shows how many are in use.",
                "App passwords work with or without two-step verification, and never sign in to webmail.",
              ],
            },
          ],
        },
        {
          title: "Lost the authenticator and the recovery codes",
          blocks: [
            {
              p: `Write to ${support} and tell us the mailbox address and, if you bought the plan, the order number. Once we have verified that the mailbox is yours, we reset two-step verification so you can sign in with your password and turn it on again. Never send us your password or codes.`,
            },
          ],
        },
      ],
    },
    {
      slug: "import-and-export",
      category: "mail",
      title: "Move your mail in, and take it out",
      summary:
        "Import old mail from Gmail, QQ Mail, 163 or any IMAP mailbox with webmail's import, and export your folders as mbox files.",
      keywords: [
        "migrate",
        "migration",
        "gmail",
        "qq",
        "163",
        "126",
        "netease",
        "icloud",
        "yahoo",
        "imap import",
        "mbox",
        "backup",
        "transfer",
        "switch",
      ],
      sections: [
        {
          title: "Import from another mailbox",
          howTo: true,
          blocks: [
            {
              ol: [
                "In webmail, open Settings → Apps & sync and find Import and export.",
                "Pick your old provider, or Other (IMAP), and enter the server, port, encryption, username and password of the old mailbox.",
                "Test the sign-in. Webmail signs in to the old mailbox and lists its folders.",
                "Check the folder mapping. Every folder gets a suggested destination: Sent to Sent, Drafts to Drafts, Junk to Junk and so on, and other folders to a folder of the same name. You can change any destination, rename the new folder, or skip a folder.",
                "Optionally set a date range, to import only mail from after or before a date.",
                "Start the import. It runs in the background: you can close the page, and pause, resume or cancel it at any time. You get an email when it ends.",
              ],
            },
          ],
        },
        {
          title: "What each provider needs",
          blocks: [
            {
              ul: [
                "**Gmail**: an app password from your Google account, which requires Google's 2-Step Verification. Signing in with Google (OAuth) is not supported.",
                "**QQ Mail**: turn on IMAP in QQ Mail's settings and use the authorization code it gives you, not your QQ password.",
                "**163 and 126 Mail**: turn on IMAP / SMTP in the mailbox settings and use the client authorization code.",
                "**iCloud Mail**: an app-specific password. **Yahoo Mail**: an app password.",
                "**Outlook.com and Microsoft 365**: Microsoft has turned off password sign-in for IMAP, so the import usually cannot sign in there.",
                "**Any other IMAP mailbox**: its server name and port. The connection must be encrypted (SSL/TLS or STARTTLS); a server without encryption is refused.",
              ],
            },
            {
              p: "When the old provider rejects the sign-in, webmail shows the provider's own message, which often says what kind of password it wants.",
            },
          ],
        },
        {
          title: "Good to know about imports",
          blocks: [
            {
              ul: [
                "Nothing changes in the old mailbox: the import only reads it, and does not even mark messages as read there.",
                "Read, starred and answered marks come along with each message.",
                "You can resume a paused import or run the same import again: messages that were already imported are skipped. An import left paused for more than 7 days is ended.",
                "Messages over 25 MB are not imported; the report at the end lists what was left out and why.",
                "Gmail's All Mail, Starred and Important are not imported as folders, since their messages are in other folders already.",
                "The import stops when your new mailbox is full.",
                "One import runs at a time per mailbox, with up to 300 folders; you can start 5 imports a day and test a sign-in 10 times an hour.",
                "The old mailbox's password is kept encrypted while the import runs and deleted when it finishes, fails or is cancelled.",
              ],
            },
          ],
        },
        {
          title: "Export your mail as mbox",
          blocks: [
            {
              p: "The same Import and export card exports your mail: every folder, or the folders you choose. The export runs in the background and you get an email when it is ready.",
            },
            {
              ul: [
                "The result is a ZIP file with one mbox file per folder, a format most mail apps and archive tools can read.",
                "Download it from webmail's settings while signed in. The file stays available for 7 days after the export finishes.",
                "Read and starred marks are not written into the mbox files.",
                "You can start 5 exports a day, one at a time.",
                "For a single message, Download original in the message view gives you its .eml file.",
              ],
            },
            {
              p: "Any mail app connected over IMAP can also copy your mail to your computer.",
            },
          ],
        },
      ],
    },
    {
      slug: "labels-filters-forwarding",
      category: "mail",
      title: "Labels, filters, auto-reply and forwarding",
      summary:
        "Tag mail with labels, sort it with filter rules, answer automatically while you are away, forward copies elsewhere, and block or allow senders.",
      keywords: [
        "label",
        "tag",
        "filter",
        "rule",
        "vacation",
        "out of office",
        "autoresponder",
        "forward",
        "redirect",
        "block",
        "allow",
        "junk",
        "spam",
      ],
      sections: [
        {
          title: "Labels",
          blocks: [
            {
              p: "A label is a tag on top of folders: a message stays in its folder and can carry any number of labels. A mailbox can have up to 30 labels, each with a name and one of eight colours.",
            },
            {
              ul: [
                "Put labels on mail with Labels in a message's actions, in the list's right-click menu, or with the L key.",
                "The left column lists your labels under the folders. Choosing one shows every message carrying it, from all folders except Junk and Trash.",
                "In the search box, label: followed by the name finds the same messages.",
                "Other mail apps see labels as message flags, and a label stays on a message when it is moved.",
              ],
            },
          ],
        },
        {
          title: "Filter rules",
          blocks: [
            {
              p: "Filter rules act on new mail as it arrives. Manage them in webmail under Settings → Rules & forwarding. A mailbox can have up to 50 rules, applied in order.",
            },
            {
              ul: [
                "**Conditions** (all or any of up to 10): the sender; the To or Cc recipients; the subject; a named header; a size above a number of KB; or having an attachment.",
                "**Actions**: mark as read, star, apply a label, forward a copy (to at most 3 addresses), move to a folder, delete, or stop processing later rules.",
                "Rules can be disabled, reordered and edited. They do not touch mail that has already arrived.",
              ],
            },
          ],
        },
        {
          title: "Auto-reply",
          blocks: [
            {
              p: "The auto-reply answers incoming mail while you are away. In Settings → Rules & forwarding, turn it on, optionally set a start and an end, a subject and the reply text. The same sender is answered again only after a number of days you choose (1 to 30; 7 unless you change it). While it is on or scheduled, a bar above the inbox says so.",
            },
          ],
        },
        {
          title: "Forwarding",
          blocks: [
            {
              p: "Forwarding sends a copy of every new message to other addresses and keeps the original in your mailbox. In Settings → Rules & forwarding, enter one address per line, up to 10; the mail server may allow fewer, and webmail then says so. It applies to new mail only. To change the addresses, turn forwarding off and enter the complete list again.",
            },
          ],
        },
        {
          title: "Blocked and allowed senders",
          blocks: [
            {
              p: "Block an address or a whole domain and its new mail goes to Junk (or is deleted, if you choose so), with no forwarding, auto-reply or rules applied. Allow an address or a domain and its mail is never left in Junk. Each list holds up to 300 entries. Block sender and Always allow sender are also in a message's Sender menu and in the list's right-click menu, with Undo.",
            },
          ],
        },
      ],
    },
    {
      slug: "calendar",
      category: "mail",
      title: "Calendar: subscriptions, import and export",
      summary:
        "Use the calendar in webmail, subscribe to published calendars, move events in and out as .ics files, and sync with your phone.",
      keywords: [
        "ics",
        "icalendar",
        "webcal",
        "caldav",
        "events",
        "invitation",
        "holiday",
        "feed",
        "subscribe",
        "reminder",
      ],
      sections: [
        {
          title: "The calendar in webmail",
          blocks: [
            {
              p: "Calendar is at the top of webmail's left column. It has day, week, month, year and agenda views, and invitations you receive by mail can be answered right in the message. Under the list of calendars you can create a new calendar; a calendar's menu renames or deletes it, and its checkbox shows or hides it.",
            },
          ],
        },
        {
          title: "Subscribe to a published calendar",
          howTo: true,
          blocks: [
            {
              ol: [
                "Open the calendar and choose Subscribe to a calendar… under the list of calendars.",
                "Paste the address of the calendar feed (an .ics address starting with https:// or webcal://) and give it a name.",
                "The feed's events appear as a new, read-only calendar. Deleting that calendar ends the subscription.",
              ],
            },
            {
              ul: [
                "A subscribed calendar is read again when you open the calendar, at most once an hour, or when you choose Refresh now in its menu. It is not refreshed in the background.",
                "A mailbox can have up to 10 subscriptions.",
                "Feeds that need a sign-in cannot be subscribed to, and a feed's reminders and participants are not kept.",
              ],
            },
          ],
        },
        {
          title: "Import and export events",
          blocks: [
            {
              ul: [
                "**Import**: a calendar's menu has Import events…, which takes an .ics file of up to 2 MB and 1,000 events. Events that are already in one of your calendars are skipped, so importing a file twice adds nothing, and nobody is invited or notified.",
                "**Export**: Export (.ics) in the same menu downloads all events of that calendar as one file.",
              ],
            },
          ],
        },
        {
          title: "Sync and reminders",
          blocks: [
            {
              p: "Your calendars sync to phones and computers over CalDAV: see [Apple Mail](help/apple-mail/) for the one-step profile, or [IMAP, SMTP, CalDAV and CardDAV settings](help/imap-smtp/) for other apps. Reminders in webmail appear only while webmail is open in a tab; with it closed, reminders reach you through the calendar app on a device that syncs over CalDAV.",
            },
          ],
        },
      ],
    },
    {
      slug: "renewals",
      category: "billing",
      title: "Renewals, the grace period and retention",
      summary:
        "How subscriptions renew, what the 7-day grace period and the 30-day retention period mean, and how to get a suspended mailbox back.",
      keywords: [
        "renew",
        "expire",
        "expiry",
        "subscription",
        "grace",
        "suspended",
        "retention",
        "auto-renew",
        "cancel",
        "card",
        "stripe",
        "reminder",
      ],
      sections: [
        {
          title: "One-time plans and subscriptions",
          blocks: [
            {
              p: "A one-time plan is paid once and its mailboxes never expire. A subscription plan runs for a period of days stated on the plan, counted from the successful payment, and is renewed period by period. The [pricing page](pricing/) shows which kind each plan is and what renewal costs.",
            },
          ],
        },
        {
          title: "How to renew",
          blocks: [
            {
              ul: [
                "**Paid with Linux DO Credit**: renew on the renewal page. The link is on the order page, in [My account](shop/account/) and in the reminder emails, and works without signing in. Choose 1 to 12 periods and pay the renewal order like any order.",
                "**Subscriptions bought directly by card**: the subscription renews automatically each period. In My account you can change the card, or cancel and resume automatic renewal. A card subscription cannot be renewed by hand on the renewal page.",
                "**Paid with USDT**: renew on the renewal page like Linux DO Credit, with USDT only. The renewal order is paid on the order page: send the exact amount shown, on the TRON network (TRC-20), to the address shown for that order.",
              ],
            },
            {
              p: "For plans paid with Linux DO Credit, reminders before the expiry go to the contact email you gave at checkout, or to your account's email; without either they arrive in the mailbox itself. Discount codes do not apply to renewals of paid subscriptions; the first paid upgrade from a free trial can use an eligible first-period offer.",
            },
            {
              p: "A free-trial upgrade is an exception: whether paid with LDC or by card, it is a one-time payment and requires manual renewal on the renewal page afterward. It does not charge automatically. The trial itself is suspended at expiry with no 7-day grace period, and mail is kept for 30 days.",
            },
          ],
        },
        {
          title: "If a subscription is not renewed",
          blocks: [
            {
              ol: [
                "**Grace period, 7 days**: everything keeps working as usual. If you renew now, the new period continues from the original expiry date.",
                "**Suspended, 30 days**: the mailbox can no longer be signed in to, but it still receives mail, and its mail and data are kept. Renewing restores it within minutes, and the new period counts from the day you pay.",
                "**After the 30 days**: the mailbox may be deleted together with its mail.",
              ],
            },
            {
              p: "To keep a copy of your mail before then, see [Move your mail in, and take it out](help/import-and-export/). The details are in the [Terms of Service](terms/) and the [Privacy Policy](privacy/).",
            },
          ],
        },
      ],
    },
    {
      slug: "discount-codes",
      category: "billing",
      title: "Discount codes",
      summary: "Where to enter a discount code, what it applies to, and what to do when a code can't be used.",
      keywords: ["coupon", "promo", "promotion", "voucher", "code", "offer", "discount"],
      sections: [
        {
          title: "First-period discounts when upgrading a free trial",
          blocks: [
            {
              p: "A free trial can upgrade directly to a single-mailbox or Team plan. Enter WELCOME10 on the upgrade page before ordering for 10% off the first paid period when eligible. For Team, the discount covers the first-period total for all selected seats. Other prepaid periods and later renewals use the regular price. The code’s expiry, total usage limit and one use per account still apply.",
            },
          ],
        },
        {
          title: "Use a code",
          howTo: true,
          blocks: [
            {
              ol: [
                "In the [shop](shop/), choose I have a discount code above the plans.",
                "Enter the code and choose Apply. Each plan the code works for shows its price with the code.",
                "Buy the plan with Linux DO Credit or by card as usual. The code in the field goes with the order.",
                "On the order page, check the price before you pay: it shows the code and what it took off.",
              ],
            },
          ],
        },
        {
          title: "What a code applies to",
          blocks: [
            {
              ul: [
                "A code takes a percentage or a fixed amount off one order, after the plan's own discount.",
                "One code per order.",
                "For a subscription, a code lowers the first period only. Renewals are at the regular price.",
                "A code may be limited to certain plans, to one way of paying (Linux DO Credit or card), to a number of uses, or by an expiry date.",
                "A code never makes an order free.",
              ],
            },
          ],
        },
        {
          title: "When a code can't be used",
          blocks: [
            {
              p: "The shop says only that the code can't be used; it does not say why. Check that you typed it correctly, and whether it is meant for another plan or another way of paying. An order placed with a code that can't be used is refused rather than charged at the full price: remove the code to buy at the regular price.",
            },
            {
              ul: [
                "Enter the code before you order. It cannot be added on the order page.",
                "After several attempts in a row the shop asks you to wait; try again about ten minutes later.",
                "An unpaid order holds its code for 30 minutes, or for about a day once you have opened the payment page. If the code has run out by the time you come back, the order can no longer be paid at that price: place a new order.",
              ],
            },
          ],
        },
      ],
    },
    {
      slug: "team-mailboxes",
      category: "billing",
      title: "Buying mailboxes for a team",
      summary:
        "How plans sold per mailbox work: choosing how many, how the total is worked out, adding seats in the middle of a period, removing them at renewal, and what happens if the subscription lapses.",
      keywords: [
        "team",
        "seat",
        "seats",
        "per mailbox",
        "quantity",
        "company",
        "business",
        "colleague",
        "add mailbox",
        "remove",
        "prorated",
        "bulk",
      ],
      sections: [
        {
          title: "Upgrade a free trial to Team",
          blocks: [
            {
              p: "Each verified account can claim one free 7-day trial with one 1 GB mailbox. No card or automatic charge is required. The mailbox is suspended as soon as the trial ends, and mail is kept for 30 days. Complete your upgrade before retention ends.",
            },
            {
              p: "Find your trial mailbox in [My account](shop/account/), choose Upgrade to single mailbox or Team, then select the Team plan, total mailbox count and paid periods. Your existing mailbox counts as one seat: choosing 2 seats lets you open 1 more mailbox after payment. Your address, password and mail stay in place, with no migration.",
            },
            {
              p: "Team offers 2–50 seats, 1 GB per seat and 1 own domain. Each seat costs 15 LDC or $1.99 per 30 days, or 150 LDC or $12 per 365 days. See the [shop](shop/) for currently available plans. Paid service starts when payment succeeds.",
            },
            {
              p: "Enter WELCOME10 before placing the upgrade order for 10% off the first paid period when eligible. If you buy several periods together, only the first is discounted; later periods use the regular price. The code’s expiry and usage limits still apply. Both LDC and card upgrades are one-time payments and require manual renewal afterward; neither enables automatic renewal.",
            },
          ],
        },
        {
          title: "Plans sold per mailbox",
          blocks: [
            {
              p: "A plan is sold in one of two ways. A fixed plan includes a set number of mailboxes at one price. A plan sold per mailbox lets you choose how many mailboxes to pay for, between the fewest and the most the plan allows; each mailbox you pay for is a seat. Every price of such a plan is for one mailbox, and a mailbox costs the same however many you buy.",
            },
            {
              p: "Which plans are on sale changes with the shop. The [pricing page](pricing/) shows them with live prices and marks a plan sold per mailbox with a per-mailbox price and the range you can choose from. If no such plan is listed, the shop is not offering one right now.",
            },
          ],
        },
        {
          title: "Buy mailboxes for your team",
          howTo: true,
          blocks: [
            {
              ol: [
                "Sign in to [My account](shop/account/), or create an account first, so the order and its mailboxes belong to it.",
                "In the [shop](shop/), find the plan sold per mailbox and set the number of mailboxes with the − and + buttons or by typing it.",
                "Check the total shown under the number: it is the shop's price for that many mailboxes, and the order page confirms what you pay.",
                "Buy with Linux DO Credit or by card, and pay the order.",
                "Back in My account, under My mailboxes, set up a mailbox for each person: pick a username and a password. The seats line shows how many are used.",
              ],
            },
            {
              p: "You do not have to set up every mailbox at once. A seat you have paid for stays free until you fill it, and the order's redeem code can also be handed to a colleague to set up their own mailbox on the [redeem page](redeem/).",
            },
          ],
        },
        {
          title: "How the total is worked out",
          blocks: [
            {
              ul: [
                "**Linux DO Credit**: the number of mailboxes times the price of one, then the plan's discount taken off the whole order and rounded once. Because of that single rounding the total can differ by a hundredth from the discounted per-mailbox price times the number.",
                "**Card**: the number of mailboxes times the card price of one, charged every period for a subscription.",
                "**Renewal**: each period costs the number of seats times the renewal price of one seat, which is fixed when you buy.",
                "**Discount codes** work as for any plan: the code is taken off the order's total, for the first period only. See [Discount codes](help/discount-codes/).",
              ],
            },
          ],
        },
        {
          title: "Add seats",
          blocks: [
            {
              p: "Under My mailboxes, choose Add seats on the subscription, set how many, and choose See the price. The added seats are charged for the rest of the current period only, and the price is shown before you confirm.",
            },
            {
              ul: [
                "**Paid with Linux DO Credit**: confirming creates an order for that amount. Pay it on the order page; the seats are added once it is paid. If the subscription is renewed before you pay, the price no longer applies and the order can't be paid: add the seats again.",
                "**Paid by card**: the amount shown is an estimate, Stripe works out the final amount and charges the card on the subscription. If your bank asks you to confirm the payment, nothing is added yet: finish on Stripe's invoice page, and the seats are added once Stripe confirms.",
                "Seats cannot be added after the period has ended (renew first), while a removal is scheduled (cancel it first), or beyond the most the plan allows.",
              ],
            },
          ],
        },
        {
          title: "Remove seats",
          blocks: [
            {
              p: "Choose Remove seats at renewal, set how many, and pick the mailboxes that go with them: enough for the remaining mailboxes to fit the seats you keep. You cannot go below the fewest seats the plan allows.",
            },
            {
              ul: [
                "The removal takes effect at the next renewal, never before. Nothing is refunded for the current period, and until then every seat and mailbox keeps working.",
                "At that renewal the chosen mailboxes are deleted together with their mail. Save what you need first: see [Move your mail in, and take it out](help/import-and-export/).",
                "The next period is charged for the lower number of seats.",
                "Until the renewal you can cancel the removal in the same place, and all seats stay.",
              ],
            },
          ],
        },
        {
          title: "If the subscription is not renewed",
          blocks: [
            {
              p: "Seats share one subscription and one expiry date, so they lapse together, the same way a single mailbox does.",
            },
            {
              ol: [
                "**Grace period, 7 days**: every mailbox keeps working, and you can still set up mailboxes on free seats. Seats cannot be added until you renew.",
                "**Suspended, 30 days**: the mailboxes can no longer be signed in to and cannot send, but they still receive mail, and their mail is kept. Nothing can be changed in My mailboxes until you renew; renewing restores them.",
                "**After the 30 days**: the mailboxes may be deleted together with their mail.",
              ],
            },
            {
              p: "A one-time plan sold per mailbox never expires, and its number of mailboxes cannot be changed afterwards. More about renewing is in [Renewals, the grace period and retention](help/renewals/).",
            },
          ],
        },
      ],
    },
    {
      slug: "own-domain",
      category: "start",
      title: "Using your own domain",
      summary:
        "Connect a domain you own from My account: prove it is yours, publish the DNS records, wait for the review, and set up mailboxes on it. With what each DNS record does, in plain language.",
      keywords: [
        "custom domain",
        "own domain",
        "dns",
        "mx",
        "spf",
        "dkim",
        "dmarc",
        "txt",
        "verify",
        "verification",
        "srv",
        "company address",
        "branded",
      ],
      sections: [
        {
          title: "What you need",
          blocks: [
            {
              ul: [
                "**A plan that includes your own domain.** The [pricing page](pricing/) says so on the plans that do, and how many domains each allows. Not every plan includes it, and the shop may not offer one at the moment.",
                "**An account** that the paid order belongs to: sign in to [My account](shop/account/) before or after buying.",
                "**Access to the domain's DNS settings**, at the registrar or DNS host where the domain is managed. You add the records yourself; we never change your DNS.",
              ],
            },
          ],
        },
        {
          title: "Connect your domain",
          howTo: true,
          blocks: [
            {
              ol: [
                "In [My account](shop/account/), find Use my own domain, enter the domain and choose Connect domain.",
                "Add the ownership record shown there, a TXT record, at your DNS host. Copy the name and the value exactly; if your DNS host adds the domain by itself, use the shorter name shown beside it.",
                "Choose Verify. If the record is not visible yet, the page says so: wait a little and try again.",
                "Add the DNS records listed next. Each one shows whether it is in place, and the page checks again by itself for a few minutes; after that, choose Check again.",
                "Wait for the review. When the domain shows Live, set up mailboxes on it under My mailboxes by choosing it in the domain list.",
              ],
            },
          ],
        },
        {
          title: "What each DNS record does",
          blocks: [
            {
              p: "DNS is the public directory that tells the rest of the internet where a domain's services are. Mail needs a few entries in it. The exact names and values for your domain are on the account page; this is what they are for.",
            },
            {
              ul: [
                "**Ownership (TXT)**: a value only you were given. Publishing it proves the domain is yours. It is only needed until the domain is verified.",
                "**MX**: where mail for your domain is delivered. Until it points here, mail sent to your addresses does not arrive in these mailboxes.",
                "**SPF (TXT)**: which servers may send mail for your domain, so other providers do not treat your messages as forged.",
                "**DKIM (TXT)**: a public key. Outgoing mail is signed, and receivers use the key to check that a message really came from your domain and was not changed on the way.",
                "**DMARC (TXT)**: what receivers should do with mail that fails those checks. It is a suggestion and optional.",
                "**Auto-configuration and discovery (CNAME, SRV)**: optional records that let mail apps find the server settings from the address alone.",
              ],
            },
            {
              p: "A record marked Conflict means something else is already published under that name, often left over from a previous mail provider; the page shows what it found. A domain can have only one SPF record, so merge the value into the existing one rather than adding a second.",
            },
          ],
        },
        {
          title: "How long it takes",
          blocks: [
            {
              ul: [
                "**The ownership value** works for 7 days. If you have not verified by then, choose Get a new value and replace the record in your DNS.",
                "**DNS changes** are not instant: a new record usually shows within minutes, but it can take hours, depending on your DNS host.",
                "**Verify and Check again** can only be used a limited number of times in a row. If the page asks you to wait, it says for how long.",
                "**Setting the domain up** on the mail service after verification usually takes a moment.",
                "**The review**: we normally review a newly connected domain before mailboxes can be set up on it. There is no fixed time for it. You can publish the remaining records while you wait.",
              ],
            },
          ],
        },
        {
          title: "Mailboxes on your domain",
          blocks: [
            {
              ul: [
                "Only your own orders whose plan includes your own domain can set up mailboxes on it, for as long as the domain is live.",
                "Mailboxes on your domain use the seats or mailboxes of the plan you bought, like mailboxes on our domains.",
                "Whoever you give such an order's redeem code to can set up a mailbox on your domain with it. Share the code only with people you want on the domain.",
                "A new mailbox on your own domain starts with a cautious daily sending limit. If you need more, write to " +
                  support +
                  ".",
                "You can give a domain up in My account until its ownership is verified. After that, write to us to have it removed. We may suspend a domain that is misused: its mailboxes then cannot sign in or send, though mail is still received.",
              ],
            },
          ],
        },
        {
          title: "When your plan ends",
          blocks: [
            {
              p: "Your domain follows your plans that include it. While one of them is running the domain is active; a one-time plan never ends. Once the last has lapsed, the domain goes through the same stages as a subscription's mailboxes.",
            },
            {
              ol: [
                "**Grace period, 7 days**: everything works as usual, including setting up new mailboxes.",
                "**Suspended, the next 30 days**: no new mailboxes, and the existing ones cannot be signed in to or send. Mail is still received and kept, and everything comes back when you renew.",
                "**After those 30 days**: the mailboxes stay disabled. Nothing is deleted automatically, but the mailboxes and then the domain may be removed, after which mail to them is refused.",
              ],
            },
            {
              p: "The DNS records are yours and are never changed from our side. If you are leaving, point the domain's MX record to your new provider before the plan ends, so no mail is delivered to mailboxes you can no longer open. See also [Renewals, the grace period and retention](help/renewals/).",
            },
          ],
        },
      ],
    },
    {
      slug: "delete-mailbox",
      category: "billing",
      title: "Delete a mailbox",
      summary:
        "How the buyer of a plan deletes a mailbox in My account, what to do first, and how to ask us to delete your data.",
      keywords: ["remove", "close", "cancel", "erase", "deletion", "disable", "account", "data"],
      sections: [
        {
          title: "Delete a mailbox in My account",
          howTo: true,
          blocks: [
            {
              ol: [
                "Sign in to [My account](shop/account/) and open My mailboxes.",
                "Find the mailbox and choose Delete.",
                "Type the mailbox's address to confirm.",
              ],
            },
            {
              p: "The mailbox is gone at once: it disappears from My mailboxes, can no longer sign in and rejects new mail. Its place goes back to the order's redeem code, so you can set up another mailbox instead.",
            },
          ],
        },
        {
          title: "Before you delete",
          blocks: [
            {
              ul: [
                "Deleting a mailbox deletes its mail. Export what you want to keep first: see [Move your mail in, and take it out](help/import-and-export/).",
                "If you only want to stop the mailbox for now, disable it in My mailboxes instead; you can enable it again later.",
                "Deleting a mailbox does not cancel a subscription. To stop a card subscription from renewing, cancel automatic renewal in My account.",
              ],
            },
          ],
        },
        {
          title: "Who can delete a mailbox",
          blocks: [
            {
              p: "A mailbox is managed by the account that bought the plan it was set up with, including a mailbox someone else set up with a code that buyer passed on. If you use a mailbox that someone else paid for, ask them. While a subscription is suspended, its mailboxes cannot be changed in My account until it is renewed.",
            },
          ],
        },
        {
          title: "Deleted the wrong mailbox, or want us to delete your data",
          blocks: [
            {
              p: `If you deleted the wrong mailbox, write to ${support} right away with the address and the order number. We cannot promise that it can still be restored.`,
            },
            {
              p: `You can also ask us to delete a mailbox, your orders or your account information. Write to ${support} from the mailbox concerned or with the order number, so we can verify that the request is yours. The [Privacy Policy](privacy/) describes what we keep and for how long.`,
            },
          ],
        },
      ],
    },
    {
      slug: "ai-features",
      category: "privacy",
      title: "What the AI features send, and where",
      summary:
        "Which webmail features use a language model, what content each one sends to it, and who receives that content.",
      keywords: ["ai", "llm", "language model", "deepseek", "summary", "privacy", "data", "assistant", "writing"],
      sections: [
        {
          title: "Who receives the content",
          blocks: [
            {
              p: "The features below send the relevant content through Cloudflare AI Gateway to a third-party large language model provider, currently DeepSeek, to generate a result. Apart from these cases, your mail is not sent to a language model provider. This page repeats what the [Privacy Policy](privacy/) says; the policy is the authoritative text.",
            },
          ],
        },
        {
          title: "What each feature sends",
          blocks: [
            {
              ul: [
                "**AI writing** (drafting, rewriting, polishing, translating): what you wrote or selected, your instructions, the subject, the recipients, and the original message quoted in a reply or forward.",
                "**Conversation summaries and suggested replies**: when you ask for them, the senders, recipients, times, subjects and bodies of the messages in that conversation.",
                "**Natural-language search**: only the sentence you typed and today's date, no mail content.",
                "**Follow-up tasks**: the task description, and the mail in this mailbox that the task searches and reads while it runs. Once created, a task runs by itself on a schedule or when related mail arrives, until it finishes or is cancelled, and may send mail automatically depending on the chosen send mode. When a task needs the web, its search terms and the addresses of pages to read are sent to Tavily.",
                "**Ticket AI assistant**: when it is on, it handles the tickets you submit first, and receives the ticket text plus the mailbox address, status, creation date, storage use and message counts, and the few passages of our help material most relevant to your question.",
              ],
            },
          ],
        },
        {
          title: "Finding help material by meaning",
          blocks: [
            {
              p: "To pick the relevant help material for the ticket AI assistant, the ticket subject and your latest message are sent to Cloudflare Workers AI and turned into a set of numbers for comparison; they are not kept.",
            },
          ],
        },
        {
          title: "When an admin uses these features",
          blocks: [
            {
              p: "When handling your mailbox in the management system, an admin with permission to send mail can also use AI writing, conversation summaries, suggested replies and natural-language search, or create follow-up tasks for the mailbox. The relevant content is sent to the language model provider in the same way. Admins access a mailbox only in the situations the Privacy Policy lists.",
            },
          ],
        },
      ],
    },
  ],
};
