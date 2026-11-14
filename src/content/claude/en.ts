/**
 * The Claude connector page (/claude/), English: how an administrator connects Claude to the admin console's MCP server with
 * OAuth, what the consent page asks, what the tools can and cannot do, and how to disconnect. It states only what mail's
 * documentation and the OAuth design back up: docs/mcp.md (the tools, their annotations, the shared rate limit), docs/api.md
 * (the scopes, the operations, "Message bodies … are not provided", follow-up tasks, message trace, failure handling),
 * packages/core/src/lib/api/oauth.ts (token lifetimes, hashes, when a grant ends) and the privacy policy's section on
 * connected apps. When any of those changes, check every sentence here against it, in both languages, and update `reviewed`.
 */
import { site } from "../../data/site.ts";
import type { ConnectorContent } from "../help/types.ts";
import { claudeCodeAdd, claudeCodeRemove, connectorUrl } from "./commands.ts";

const support = `[${site.contact.email}](mailto:${site.contact.email})`;

export const claudeEn: ConnectorContent = {
  title: "Abnormal Mail connector for Claude",
  summary:
    "Let Claude look after your workspace in the Abnormal admin console: domains, mailboxes, forwarding, aliases, lists and more, by asking. What you need, how to connect, what Claude can and cannot do, and how to disconnect.",
  reviewed: "2026-11-12",
  sections: [
    {
      title: "What it is",
      blocks: [
        {
          p: "The connector links Claude to the management API of the Abnormal admin console through the Model Context Protocol (MCP). Once you approve it, Claude can look up and change what you manage in the console (domains, mailboxes, forwarding, aliases, distribution lists, legal holds, follow-up tasks, webhooks and the suppression list) and trace what happened to a message, within the access you grant.",
        },
        {
          ul: [
            `**Connector URL**: ${connectorUrl}`,
            "**Sign-in**: OAuth 2.0. You sign in to the admin console yourself and approve the access on its consent page; Claude never sees your console password.",
            "**Same rules as the API**: every tool call is one call to the management API, with the same permission checks, limits and activity log as a call made with an API key.",
          ],
        },
      ],
    },
    {
      title: "What you need",
      blocks: [
        {
          ul: [
            "An **administrator** account in the Abnormal admin console (console.abnormalhq.com). Operators and viewers can't authorize the connector.",
            `Buying a mailbox in the shop doesn't create an admin console account, and [My account](shop/account/) on this site is a separate sign-in that doesn't work in the console. If you run your organization's mail on Abnormal and have no console access, write to ${support}.`,
            "Claude on the web, in the desktop or mobile apps, or Claude Code. Which connectors you can add may depend on your Claude plan and, in an organization, on what its owners allow.",
          ],
        },
      ],
    },
    {
      title: "Connect in Claude",
      blocks: [
        {
          ol: [
            "In Claude on the web or in the desktop app, open **Settings → Connectors**.",
            `Find **Abnormal Mail** in the directory and choose **Connect**. If it isn't listed for you, choose **Add custom connector** and enter ${connectorUrl} as the URL.`,
            "The admin console opens. Sign in with your administrator account.",
            "Check the consent page (see below), choose the access for each resource and approve. You are taken back to Claude, where the connector now shows as connected.",
          ],
        },
        {
          p: "Once connected, the connector is available wherever you use Claude with the same account, the mobile apps included. In a chat, ask in plain words; Claude picks the tools it needs.",
        },
      ],
    },
    {
      title: "Connect in Claude Code",
      blocks: [
        { code: claudeCodeAdd, label: "In a terminal" },
        {
          ol: [
            "Run the command above to add the server under the name mailhq.",
            "Start Claude Code, type **/mcp**, choose **mailhq** and choose to authenticate. Your browser opens the admin console: sign in and approve as in Claude.",
            "Back in Claude Code, mailhq shows as connected and its tools are available.",
          ],
        },
        {
          p: "Other MCP clients that support OAuth connect to the same URL in the same way. A client that can't use OAuth can send an API key from **Settings → API keys** in the console as an Authorization: Bearer header instead.",
        },
      ],
    },
    {
      title: "What the consent page asks",
      blocks: [
        {
          p: "Before anything is shared, the console shows a consent page with the name of the app asking for access and the address it will send you back to. Approve only a connection you started yourself, going back to an address you expect: claude.ai for Claude, or localhost on your own computer for Claude Code.",
        },
        {
          ul: [
            "**Access per resource**: for each of domains, mailboxes, forwarders, aliases, distribution lists, legal holds, follow-up tasks, webhooks, the suppression list and message trace, you choose **No access**, **Read** or **Read & write**. Message trace stays off unless you choose it, because a trace shows who wrote to whom.",
            "**A recent sign-in**: approving needs you to have signed in, or re-entered your password, within the last 10 minutes.",
            "**One workspace**: the access applies to the workspace you are signed in to when you approve.",
            "**Your role still applies**: Claude can never do more than your administrator role allows. If you lose the admin role or leave the workspace, the connection ends.",
          ],
        },
      ],
    },
    {
      title: "What Claude can do",
      blocks: [
        {
          p: "The tools are the operations of the management API, grouped here by the resource you grant on the consent page. Read access lists and shows; read & write adds the changes.",
        },
        {
          ul: [
            "**Domains**: read the domain list and details, DNS and connection status, onboarding requests, alias domains, the catch-all and the available servers; write: start and verify a domain onboarding, import, enable or disable a domain, add or remove alias domains, set the catch-all, remove a domain's local record.",
            "**Mailboxes**: read the mailbox list and details, deleted mailboxes, daily sending limits and the reports (inactive mailboxes, storage, top senders); write: create, delete and restore mailboxes, change a password, status, quota, note or sending limit.",
            "**Forwarders**: read the forwarding rules of a domain; write: create and delete them.",
            "**Aliases**: read the plain aliases of a domain; write: create, change and delete them.",
            "**Distribution lists**: read lists and their members; write: create, rename and delete lists, add and remove members.",
            "**Legal holds**: read holds on mailboxes and domains; write: place and release them.",
            "**Follow-up tasks**: read tasks, their timelines, the conversations they follow and the emails waiting for approval; write: create a task, message it, hand it a conversation, change its limits, pause, resume or cancel it, and approve or reject an email.",
            "**Webhooks**: read webhooks and their delivery log; write: create, change, delete and test them, and send a delivery again.",
            "**Suppression list**: read the list and check one address; write: add and remove addresses.",
            "**Message trace**: read only, the delivery timeline of the workspace's messages by sender, recipient or Message-ID. Message trace must also be switched on for workspaces by the Abnormal team; until it is, the tool answers that it is not allowed.",
          ],
        },
        {
          p: "Claude can also run up to 25 mailbox, domain and alias changes as one batch; each change in it is checked against the access you granted.",
        },
        {
          p: "Reads run without asking. Every tool that changes something is marked as destructive, so Claude asks before it runs one: read what it is about to do before you allow it. Some changes can't be undone. Deleting a mailbox deletes it with its mail (by default it goes to Deleted mailboxes first and can be restored until it is purged; a permanent delete is final). Approving a follow-up email sends it at once, and a follow-up task sends email from its mailbox on its own unless it is created with a send mode that needs approval.",
        },
      ],
    },
    {
      title: "What Claude can't see",
      blocks: [
        {
          ul: [
            "**No mailbox contents**: there is no tool that reads, searches or deletes the mail in a mailbox, and none that sends an email of Claude's own. Mailbox passwords are never returned.",
            "**Except what follow-up tasks hold**: with read access to follow-up tasks, Claude sees what a task holds: its instructions, the subjects and senders of the conversations it follows, the start of each message it received (in its timeline) and the full text of the emails it wrote. If Claude should see no mail content at all, give follow-up tasks no access.",
            "**Message trace** shows who wrote to whom, when, and how delivery went; not what the messages say.",
            "**What you type is in the chat**: a password you ask Claude to set, like anything else you write, is part of your conversation with Claude.",
          ],
        },
      ],
    },
    {
      title: "Examples",
      blocks: [
        {
          ul: [
            "“Which mailboxes on example.com are disabled?”",
            "“Forward help@example.com to support@example.com.”",
            "“Create an alias sales@example.com for anna@example.com.”",
            "“Which mailboxes have had no sign-in and no mail for 90 days?”",
            "“Is bounce@example.net on our suppression list? If it is, remove it.”",
            "“Did yesterday's message from alice@example.com to bob@example.org get delivered?”",
            "“Put a legal hold on dana@example.com, reason: case 2026-114.”",
            "“Show me the follow-up emails waiting for approval.”",
          ],
        },
      ],
    },
    {
      title: "Disconnect and revoke",
      blocks: [
        {
          ul: [
            "**In Claude**: open **Settings → Connectors**, choose the connector and disconnect it.",
            "**In the admin console**: **Account settings → Connected apps** lists the apps connected to your account; revoke one to cut it off at its next request. Administrators also see the workspace's connections under **Settings → API keys → Connected apps** and can revoke any of them.",
            "**It also ends by itself** when you change your console password or sign-in email, when you lose the admin role or leave the workspace, and after 30 days without use.",
          ],
        },
        { code: claudeCodeRemove, label: "To remove it from Claude Code" },
      ],
    },
    {
      title: "Security and your data",
      blocks: [
        {
          ul: [
            "**Tokens**: Claude gets an access token that lasts one hour and a refresh token that lasts 30 days and is replaced every time it is used. The console stores only SHA-256 hashes of them.",
            "**What the console keeps**: the connection (the app's name, client ID and return address, the access you granted, the workspace, your account, and when it was created and last used). Every change Claude makes is recorded in the workspace's activity log, naming the connection, and every call is counted in the API call statistics (route, status and duration, no request content), as for API keys.",
            "**What the console receives**: only the arguments Claude sends with each tool call, never your conversation. How Anthropic handles your conversations is governed by [Anthropic's Privacy Policy](https://www.anthropic.com/legal/privacy).",
            "**No one else**: nothing is passed on beyond the service providers our [Privacy Policy](privacy/) already lists; its section on connected apps has the details, including how long records are kept.",
          ],
        },
      ],
    },
    {
      title: "Troubleshooting",
      blocks: [
        {
          ul: [
            "**Asked for your password again**: approving needs a sign-in or password entry within the last 10 minutes. Enter your password, then approve.",
            "**You can't approve**: only administrators can authorize the connector. Ask an administrator of the workspace to connect it, or to give you the admin role.",
            "**Claude sees the wrong workspace**: a connection belongs to the workspace you were signed in to when you approved. Disconnect it in Claude, switch to the right workspace from your user menu in the console, then connect again.",
            "**A tool answers that it is not allowed**: that resource wasn't granted, or was granted read only. Disconnect and connect again with the access you need. Message trace also needs the Abnormal team to switch it on.",
            "**Too many requests**: a connection may make 300 requests a minute, counted together with any management API calls made with the same connection. Requests over the limit are refused until the minute is up, and a refused request changed nothing: wait a moment and try again, or ask for one batch instead of many single changes.",
            "**A change may not have gone through**: after a timeout or an answer that the result is uncertain, ask Claude to check the current state before trying again, so nothing is created twice.",
            "**It stopped working**: the connection may have been revoked, ended by a password change, or expired after 30 days without use. Connect again.",
          ],
        },
      ],
    },
    {
      title: "Support",
      blocks: [
        {
          p: `For questions or problems with the connector, or a security concern, write to ${support} with your workspace, the time and what Claude answered. Never include passwords or tokens. For ongoing incidents, check the [service status page](https://status.abnormalhq.com).`,
        },
      ],
    },
  ],
};
