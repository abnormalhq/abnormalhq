import type { Copy } from "./types.ts";

export const en: Copy = {
  htmlLang: "en",
  ogLocale: "en_US",
  dot: ".",
  space: " ",
  meta: {
    title: "Abnormal — Email service",
    description:
      "Abnormal email service: buy an @abnormalhq.com mailbox online, set it up yourself with a redeem code, and read and send from webmail or any mail app. Plans for a team are sold per mailbox, plans that include it let you connect your own domain yourself, and setup help is available on request.",
    socialTitle: "Abnormal — Good email, simple conversations.",
    socialDescription:
      "Buy and set up an @abnormalhq.com mailbox yourself, then read and send from webmail or your mail app.",
    socialImageAlt:
      "Abnormal email service: good email, simple conversations. Buy and set up an @abnormalhq.com mailbox online.",
  },
  skipLink: "Skip to main content",
  brandLabel: "Abnormal home",
  langToggle: { label: "中", aria: "切换到中文" },
  header: {
    navLabel: "Main navigation",
    mobileNavLabel: "Mobile navigation",
    nav: [
      { anchor: "features", wide: "card", label: "Features" },
      { path: "/pricing/", label: "Pricing" },
      { anchor: "start", label: "Get started" },
      { anchor: "services", label: "Services" },
      { anchor: "how-it-works", wide: "bar", label: "How it works" },
      { path: "/help/", label: "Help" },
    ],
    openMenu: "Open menu",
    closeMenu: "Close menu",
    login: "Log in",
    account: "My account",
    buy: "Buy a mailbox",
    haveCode: "I have a code",
    loginWebmail: "Log in to webmail",
  },
  theme: {
    ariaTemplate: "Change theme, currently {label}",
    titleTemplate: "Theme: {label}",
    options: { system: "System", light: "Light", dark: "Dark" },
  },
  hero: {
    eyebrow: "Email, made personal",
    titleLines: ["Good email,", "simple conversations"],
    description: [
      "Create an account, buy @abnormalhq.com mailboxes online, and set them up and manage them from your account.",
      "Read and send from webmail or the mail app you already use.",
    ],
    buy: "Buy a mailbox",
    register: "Create an account",
    loginPrompt: "Have an account?",
    loginLink: "Manage your mailboxes",
    webmailLink: "Log in to webmail",
    promises: ["Orders and mailboxes in one account", "Set up in your account once paid", "Pick your own username"],
    visualLabel: "Concept illustration of the email service: a tidy inbox and an address on your own domain.",
    mock: {
      overline: "A LITTLE MORE CONNECTED",
      heading: "Every email has a home",
      inbox: "Inbox",
      starred: "Starred",
      mails: [
        {
          title: "New connections, new possibilities.",
          body: "Make every conversation a good start.",
          time: "09:41",
        },
        {
          title: "About our next plan",
          body: "Ideas, plans and the news we've waited for.",
          time: "Yesterday",
        },
        {
          title: "All set. Let's begin.",
          body: "Your day starts with a mailbox that just works.",
          time: "Yesterday",
        },
      ],
      domainNote: "Your name, your address",
      demoLabel: "Concept",
    },
  },
  valueStrip: {
    lead: "Less setup hassle.",
    strong: "More time to talk.",
    labels: ["Your account", "Buy online", "Self-service setup", "Webmail"],
  },
  video: {
    eyebrow: "See it in action",
    title: "Watch a short video",
    description:
      "A short film about the Abnormal email service: a mailbox that just works, for everyday life and for work.",
    label: "Abnormal email service promo video",
    fallback: "Your browser can't play this video.",
    download: "Download the video",
    play: "Play",
    pause: "Pause",
    replay: "Play again",
    mute: "Mute",
    unmute: "Unmute",
    fullscreen: "Full screen",
    exitFullscreen: "Exit full screen",
    seek: "Seek",
    seekTemplate: "{current} of {duration}",
    volume: "Volume",
  },
  features: {
    eyebrow: "What's inside",
    title: "Everything a mailbox should do",
    intro: ["Sorting, calendars, safety and moving in:", "all there in webmail the day you activate."],
    items: [
      {
        icon: "inbox",
        title: "Split inbox",
        description:
          "Primary mail, newsletters and notifications sort themselves, each with its own unread count; add splits of your own by sender or keyword.",
      },
      {
        icon: "undo",
        title: "Undo and schedule sends",
        description:
          "Take a message back for a few seconds after sending, or have it go out tomorrow morning. The mail server holds it, so closing the tab changes nothing.",
      },
      {
        icon: "calendar",
        title: "Calendar and contacts",
        description:
          "Webmail has a calendar and an address book built in, with invitations answered right in the message; CalDAV and CardDAV sync them to your phone and computer.",
      },
      {
        icon: "search",
        title: "Fast search",
        description:
          "Searches every folder by default and highlights the matches; narrow it in one go with from:, subject:, has:attachment and more.",
      },
      {
        icon: "alert",
        title: "Phishing warnings",
        description:
          "Impersonated senders, lookalike domains and failed sender checks get a warning above the message; incoming attachments are scanned for viruses first.",
      },
      {
        icon: "key",
        title: "Two-step verification",
        description:
          "A code on top of your password; mail apps get app passwords of their own, which you can revoke if a device goes missing without changing your main password.",
      },
      {
        icon: "import",
        title: "Move in, take it with you",
        description:
          "Import old mail from Gmail, QQ Mail, 163 or any IMAP mailbox, paused and resumed as you like; export folders as mbox whenever you want.",
      },
      {
        icon: "filter",
        title: "Rules and auto-reply",
        description:
          "File, flag or forward mail by sender, subject, attachments and more; turn on an auto-reply for time off, and block senders you never want to hear from.",
      },
      {
        icon: "install",
        title: "Install it as an app",
        description:
          "Add webmail to your desktop or home screen and open it like an app; mail it has saved stays readable offline.",
      },
    ],
    platformsTitle: "Use it anywhere",
    platforms: [
      {
        icon: "globe",
        name: "Webmail",
        description: "Nothing to install. Sign in to several mailboxes at once and switch between them in one click.",
        action: "Log in to webmail",
        link: "webmail",
      },
      {
        icon: "laptop",
        name: "Desktop app",
        description: "Native apps for macOS and Windows, with folders, read state and stars in sync with webmail.",
        action: "Download the app",
        path: "/download/",
      },
      {
        icon: "phone",
        name: "Phones and other apps",
        description: "Your phone's built-in Mail, Calendar and Contacts, or any mail app that speaks IMAP and SMTP.",
        action: "See the setup guide",
        link: "guide",
      },
    ],
  },
  start: {
    eyebrow: "Start here",
    title: "Start here",
    intro: ["Sign up, buy, set up and start sending,", "all from this page."],
    entries: [
      {
        icon: "cart",
        eyebrow: "No mailbox yet",
        title: "Buy a mailbox",
        description:
          "Pick a plan and pay with Linux DO Credit or card. Once payment is confirmed, the order and its redeem code join your account.",
        link: "shop",
        action: "Go to the shop",
        primary: true,
      },
      {
        icon: "user",
        eyebrow: "Sign up / sign in",
        title: "My account",
        description:
          "Sign up and sign in with your email and a password. Under My mailboxes, set up, reset, disable or delete mailboxes; orders and renewals are there too.",
        link: "account",
        action: "Sign up or sign in",
      },
      {
        icon: "ticket",
        eyebrow: "Got a code",
        title: "Redeem",
        description:
          "Someone gave you a code? Enter it on the redeem page, pick a username and password, and the mailbox works right away.",
        link: "redeem",
        action: "Redeem now",
      },
      {
        icon: "mail",
        eyebrow: "Already set up",
        title: "Webmail",
        description:
          "Read and send in the browser. Sign in with your full address and password, with several mailboxes at once.",
        link: "webmail",
        action: "Log in",
      },
    ],
    secondary: [
      { link: "guide", label: "Guide: mail app settings and changing passwords" },
      { link: "status", label: "Service status" },
    ],
    support: "Support",
  },
  pricing: {
    questions: { title: "Questions about plans and billing", all: "All help articles" },
    metaTitle: "Pricing — Abnormal",
    metaDescription:
      "Abnormal mailbox plans with live prices: mailboxes included, storage per mailbox, domains, billing period and renewal price, plus what every mailbox gets.",
    eyebrow: "Plain pricing",
    title: "Plans and prices",
    intro: ["Read live from the shop:", "what you see here is what you pay."],
    pageIntro:
      "Every plan on sale, with its price, mailboxes, storage and renewal terms. The numbers are read from the shop as this page loads, so they are the ones you pay at checkout.",
    compareLink: "Compare plans in detail",
    loading: "Loading plans…",
    closedTitle: "No plans on sale right now",
    closedBody:
      "The shop isn't selling at the moment, so there are no prices to show. Codes you already have still work on the redeem page.",
    errorTitle: "Couldn't load the plans",
    errorBody: "Prices are read live from the shop, and it didn't answer. Try again, or open the shop directly.",
    retry: "Try again",
    shopLink: "Open the shop",
    priceNote:
      "Prices are in LDC (Linux DO Credit); plans that take cards show the card price too. You review the order before paying, and nothing is charged until you do.",
    plan: {
      oneDay: "day",
      days: "{days} days",
      unitOnce: "LDC / purchase",
      unitPeriod: "LDC / {period}",
      cardUnitOnce: "by card / purchase",
      cardUnitPeriod: "by card / {period}",
      discount: "{percent}% off",
      originalPrice: "Original price",
      cardOnce: "or {price} by card",
      cardPeriod: "or {price} every {period} by card, renewing automatically",
      cardRowPeriod: "{price} every {period}, renewing automatically",
      mailboxOne: "1 mailbox",
      mailboxes: "{count} mailboxes",
      storage: "{size} per mailbox",
      storageDefault: "Server default storage",
      storageUnavailable: "No per-mailbox quota",
      storageMixed: "Storage follows the domain you pick",
      billingOnce: "One-time purchase; mailboxes never expire",
      billingPeriod: "Subscription, every {period}",
      renewAt: "{price} LDC every {period}",
      codeDays: "Set up within {days} days of paying",
      codeNoExpiry: "Set up whenever you like",
      choose: "Choose this plan",
      chooseAria: "Choose this plan: {name}",
      seatUnitOnce: "LDC / mailbox",
      seatUnitPeriod: "LDC / mailbox / {period}",
      cardSeatUnitOnce: "by card / mailbox",
      cardSeatUnitPeriod: "by card / mailbox / {period}",
      seatCardOnce: "or {price} per mailbox by card",
      seatCardPeriod: "or {price} per mailbox every {period} by card, renewing automatically",
      seatCardRowOnce: "{price} per mailbox",
      seatCardRowPeriod: "{price} per mailbox every {period}, renewing automatically",
      seatRenewAt: "{price} LDC per mailbox every {period}",
      seatMailboxes: "{min} to {max}, you choose",
      seatNote: "Priced per mailbox: you choose how many in the shop, and the order total is confirmed at checkout.",
      seatDiscountNote: "The {percent}% discount is taken off the order total and rounded once.",
      seatUnitName: "mailbox",
      ownDomains: "Up to {count} of your own domains",
      ownDomainOne: "1 domain of your own",
      ownDomainsNone: "Not included",
    },
    compare: {
      title: "Compare plans",
      intro: "The same numbers, side by side.",
      feature: "What you get",
      rows: {
        price: "Price",
        card: "By card",
        billing: "Billing",
        renewal: "Renewal",
        mailboxes: "Mailboxes",
        storage: "Storage",
        domains: "Domains",
        ownDomains: "Your own domain",
        code: "Redeem code",
      },
      none: "Not offered",
      noRenewal: "Nothing to renew",
    },
    included: {
      title: "What every mailbox gets",
      intro:
        "The plan sets the price, the number of mailboxes and the storage. Everything below is the same for every mailbox.",
      items: [
        {
          icon: "inbox",
          title: "Storage of its own",
          description:
            "Each mailbox gets the storage its plan states as its own quota. It is not pooled with your other mailboxes.",
        },
        {
          icon: "user",
          title: "A name you choose",
          description:
            "Any free username of up to 64 characters: lowercase letters, digits, dots, hyphens and underscores, starting and ending with a letter or digit.",
        },
        {
          icon: "calendar",
          title: "Clear expiry rules",
          description:
            "One-time plans never expire. A subscription that isn't renewed keeps working through a 7-day grace period, is then suspended (it still receives mail) and kept for 30 days before it may be deleted.",
        },
        {
          icon: "globe",
          title: "Open protocols",
          description:
            "IMAP and SMTP over TLS for any mail app, CalDAV and CardDAV for calendars and contacts. Import old mail over IMAP and export folders as mbox.",
        },
        {
          icon: "laptop",
          title: "Apps everywhere",
          description:
            "Webmail in the browser, installable as an app; desktop apps for macOS and Windows; and the mail, calendar and contacts apps already on your phone.",
        },
        {
          icon: "mail",
          title: "Attachments in webmail",
          description:
            "A message written in webmail carries up to 10 attachments, 3 MB in all. Larger files can be shared as download links.",
        },
      ],
    },
    check: {
      title: "Check your address",
      hint: "See whether the name you want is free before you buy.",
      usernameLabel: "Username",
      domainLabel: "Domain",
      placeholder: "yourname",
      invalid:
        "Use lowercase letters, digits and . _ - only, starting and ending with a letter or digit, with no two dots in a row and at most 64 characters.",
      checking: "Checking…",
      available: "{email} is available.",
      taken: "{email} is taken. Try another one.",
      rateLimited: "Too many checks. Try again in a moment.",
      failed: "Couldn't check right now. You can still pick the name when you set the mailbox up.",
      proceed: "Get this address",
      note: "The address is yours once the mailbox is set up; until then someone else can still take it.",
    },
  },
  services: {
    eyebrow: "Find your email",
    titleLines: ["A mailbox", "for every day"],
    intro: [
      "Mailboxes are bought and set up online, for one person, a team or your own domain.",
      "For setup help, let's talk first.",
    ],
    products: [
      {
        icon: "mail",
        name: "Personal mailbox",
        category: "Everyday mail",
        description:
          "An @abnormalhq.com mailbox you buy and set up online, for everyday mail and signing up for the services you use.",
        tags: ["Buy online", "Self-service"],
        price: "Buy online",
        priceNote: "Live prices under Plans and prices",
        link: "shop",
        actionLabel: "Buy in the shop",
        featured: true,
      },
      {
        icon: "domain",
        name: "Domain mailbox",
        category: "Your address",
        description:
          "Addresses on a domain you own, so every message carries your name. On plans that include it, you connect the domain yourself in My account.",
        tags: ["Connect it yourself", "You publish the DNS records"],
        price: "Buy online",
        priceNote: "On plans that include your own domain",
        link: "pricing",
        actionLabel: "See which plans include it",
      },
      {
        icon: "team",
        name: "Team mailbox",
        category: "Work",
        description:
          "Mailboxes for everyone on the team: on plans sold per mailbox you choose how many, add more any time and remove some at renewal.",
        tags: ["Priced per mailbox", "Add or remove seats"],
        price: "Buy online",
        priceNote: "On plans sold per mailbox",
        link: "pricing",
        actionLabel: "See team plans",
      },
      {
        icon: "setup",
        name: "Mailbox setup",
        category: "Support",
        description: "Help with sending and receiving settings and mail apps, so email fits into your day.",
        tags: ["Setup help", "How-to guidance"],
        price: "",
        priceNote: "Quoted by scope",
      },
    ],
    priceFallback: "On request",
    consult: "Ask about this",
    consultAria: (name) => `Ask about this: ${name}`,
    noteQuestion: "Need a hand setting things up, or something else?",
    noteAction: "Talk to us",
    noteFine:
      "Plans, prices and limits, including plans sold per mailbox and plans that include your own domain, are listed under Plans and prices as the shop offers them. Setup help is quoted once we've talked.",
  },
  process: {
    eyebrow: "A simple way to get started",
    title: "Four steps to your mailbox",
    intro: ["From sign-up to your first email,", "every step is self-service."],
    steps: [
      {
        icon: "user",
        title: "Create an account",
        description:
          "Sign up with your email and a password, then open the link in the confirmation email. Your orders, codes and mailboxes all live in this account.",
        link: "register",
        action: "Create an account",
      },
      {
        icon: "cart",
        title: "Choose a plan",
        description:
          "Pick the number of mailboxes and storage in the shop, and pay with Linux DO Credit or card. Once payment is confirmed, the redeem code joins your account.",
        link: "shop",
        action: "Go to the shop",
      },
      {
        icon: "ticket",
        title: "Set up mailboxes",
        description:
          "Under My account, My mailboxes, pick a username and password to set one up right away. You can also give the code to someone to redeem themselves.",
        link: "account",
        action: "Go to My account",
      },
      {
        icon: "mail",
        title: "Sign in and send",
        description:
          "Log in to webmail with your full address, or follow the guide to add it to a mail app over IMAP / SMTP.",
        link: "webmail",
        action: "Log in to webmail",
      },
    ],
  },
  faq: {
    eyebrow: "Good questions",
    title: "Questions, answered",
    description: "What's worth knowing before you start.",
    contact: "Something else? Ask us",
    help: "More answers in the help center",
    items: [
      {
        question: "What does Abnormal offer?",
        answer:
          "We offer @abnormalhq.com mailboxes: create an account, buy in the shop, set mailboxes up and manage them from your account, and read and send from webmail or the mail app you already use. Plans sold per mailbox cover a whole team, and plans that include it let you use your own domain; for setup help, ask us.",
      },
      {
        question: "How do I buy and set up a mailbox?",
        answer:
          "Create an account with your email and a password and confirm it from the email we send. Then pick a plan in the shop and pay with Linux DO Credit or card. Once payment is confirmed, the order and its code join your account: under My account, My mailboxes, pick a username and password to set one up. You can also give the code to someone to enter on the redeem page. Previously issued codes keep their original available domains.",
      },
      {
        question: "Where do I sign in afterwards?",
        answer:
          "Webmail is at webmail.abnormalhq.com. Sign in with your full email address and the password you set when redeeming. Existing @abnormal.bid mailboxes continue to use their original address to sign in. You can also add the account to a mail app on your phone or computer; the server settings are in your redeem result and the guide.",
      },
      {
        question: "Where do I manage mailboxes, orders and renewals?",
        answer:
          "All in My account: set up new mailboxes, reset their passwords, disable or delete them, see orders and codes, and renew. Card subscriptions are managed there too, including changing the card or cancelling automatic renewal. Forgot your account password? Choose “Forgot your password? Reset it” on the sign-in page and set a new one from the emailed link. Once a Google account is linked on the account page (a Gmail or Google Workspace address matching the account's email links automatically), you can also sign in with “Continue with Google”.",
      },
      {
        question: "Can I use my own domain or set up mailboxes for a team?",
        answer:
          "Yes, in the shop, when a plan on sale offers it. A plan sold per mailbox lets you choose how many mailboxes to buy, add seats later and remove them at renewal. A plan that includes your own domain lets you connect it under My account: you prove the domain is yours with a DNS record, publish the mail records we list, and new domains are normally reviewed by us before they go live. The pricing page shows which plans include what, and the help center explains both step by step. If you would like a hand with the setup, ask us; never send passwords, verification codes, recovery codes or payment details in your message.",
      },
      {
        question: "What if something goes wrong?",
        answer:
          "If mail isn't coming or going, check the service status page first for outages or maintenance. For anything else, write to support and include your email address or order number so we can help faster.",
      },
    ],
  },
  help: {
    metaTitle: "Help center — Abnormal",
    metaDescription:
      "Help for Abnormal mailboxes: getting started, setting up Apple Mail, Outlook, Thunderbird and Android, two-step verification, importing mail, labels and filters, the calendar, renewals, discount codes and deleting a mailbox.",
    navLabel: "Help center",
    eyebrow: "Help center",
    title: "Find your answer",
    intro:
      "Step-by-step answers for setting up, using and managing your mailbox. Search by what you want to do, or browse by topic.",
    search: {
      label: "Search the help articles",
      placeholder: "Search: Outlook, import, two-step…",
      resultsOne: "1 article",
      results: "{count} articles",
      empty: "No article matches that. Try another word, or write to support.",
      clear: "Clear search",
    },
    breadcrumbLabel: "Breadcrumb",
    home: "Home",
    articleEyebrow: "Help article",
    tocLabel: "On this page",
    ask: {
      title: "Can't find it here?",
      body: "Write to us and we'll help directly. Include your mailbox address or order number, never a password.",
    },
    wrong: {
      title: "Not the article you were looking for?",
      body: "Go back to the help center and search again, or write to us and we'll help directly. Include your mailbox address or order number, never a password.",
      index: "Browse all help articles",
      contact: "Email support",
    },
    related: "More in {topic}",
  },
  security: {
    metaTitle: "Security and privacy — Abnormal",
    metaDescription:
      "How Abnormal protects mailboxes: encryption in transit, two-step verification and app passwords, phishing warnings and virus scanning, what is stored encrypted, what is not offered (no end-to-end or zero-access encryption), where data is processed, and how to report a vulnerability.",
    navLabel: "Security and privacy",
    eyebrow: "Security overview",
    reviewedLabel: "Last reviewed",
    policyLink: "Read the Privacy Policy",
    helpLink: "Go to the help center",
  },
  closing: {
    eyebrow: "Make every connection count",
    titleLines: ["Your next email", "starts here"],
    body: "Create an account, pick a plan, set mailboxes up in your account once paid and start sending right away. Buying for a team or using your own domain works the same way on plans that include it. Want help setting up? Let's talk.",
    buy: "Buy a mailbox",
    custom: "Ask for setup help",
  },
  serviceStatus: {
    states: { up: "All systems operational", down: "Partial outage", maintenance: "Under maintenance" },
    uptime: "{percent}% uptime over the last {days} days",
    label: "Service status",
  },
  footer: {
    tagline: "Abnormally good.",
    productLabel: "Product",
    supportLabel: "Support",
    contactLabel: "Contact",
    productLinks: [
      { link: "shop", label: "Buy a mailbox" },
      { link: "pricing", label: "Pricing" },
      { link: "redeem", label: "Redeem" },
      { link: "webmail", label: "Webmail" },
      { link: "guide", label: "Guide" },
    ],
    supportLinks: [
      { link: "help", label: "Help center" },
      { link: "account", label: "My account" },
      { link: "register", label: "Create an account" },
      { link: "status", label: "Service status" },
      { link: "security", label: "Security and privacy" },
    ],
    faq: "FAQ",
    emailAria: (email) => `Support email: ${email}`,
    copyright: "© {year} Abnormal. Mail made simple.",
    buyOnline: "Buy a mailbox online",
    legalLabel: "Legal",
  },
  legalPages: [
    { path: "/privacy/", label: "Privacy Policy" },
    { path: "/terms/", label: "Terms of Service" },
  ],
  download: {
    metaTitle: "Download the desktop app — Abnormal",
    metaDescription:
      "The Abnormal Mail desktop app for macOS and Windows: read, search, reply and send, in sync with webmail.",
    navLabel: "Desktop app",
    eyebrow: "Desktop app",
    title: "Your mail on the desktop",
    intro:
      "A native app for macOS and Windows. Sign in with your mailbox address and password; folders, read state and stars stay in sync with webmail.",
    introWithLinux:
      "A native app for macOS, Windows and Linux. Sign in with your mailbox address and password; folders, read state and stars stay in sync with webmail.",
    macos: {
      name: "macOS",
      requirement: "macOS 11 or later, for Apple silicon and Intel.",
      download: "Download .dmg",
      brewLabel: "Or install with Homebrew:",
      firstLaunch:
        "The app is not signed yet. The first time you open it, go to System Settings › Privacy & Security and click Open Anyway.",
    },
    windows: {
      name: "Windows",
      requirement:
        "Windows 10 or 11 (64-bit, x64 or Arm). Installs for the current user, no administrator rights needed.",
      download: "Download the installer",
      armDownload: "On an Arm PC (such as a Snapdragon laptop)? Get the Arm version",
      firstLaunch: "The installer is not signed yet. If SmartScreen appears, click More info, then Run anyway.",
    },
    linux: {
      name: "Linux",
      requirement: "Debian, Ubuntu and their relatives (64-bit, x64 or Arm).",
      download: "Download .deb",
      armDownload: "On an Arm machine? Get the Arm version",
      installLabel: "Install it with apt, from the folder you downloaded it to:",
      note: "The package brings in WebKitGTK and the other libraries it needs. On other distributions, you can build the app from source.",
    },
    signInTitle: "Sign in",
    signInSteps: [
      "Server: the same server address mail clients use, shown when your mailbox is set up and in the guide.",
      "Email address: your full mailbox address.",
      "Password: the mailbox's own password, the same one IMAP / SMTP clients use.",
    ],
    checksums: "Version and SHA-256 checksums",
    currentLabel: "Current version",
    releasedLabel: "Released",
    historyTitle: "Previous versions",
    historyIntro: "Earlier releases stay available, in case you need to go back to one.",
    historyEmpty: "No previous versions yet: this is the first release.",
    historyChecksums: "SHA-256",
    copyCommand: "Copy",
    copiedCommand: "Copied",
    copyFailed: "Your browser didn't allow copying. Select the command and copy it yourself.",
    forThisComputer: "For this computer",
    phone: {
      title: "On a phone or tablet?",
      body: "The desktop app runs on computers. On this device, read your mail in webmail, or add the mailbox to the mail app you already have.",
      webmail: "Open webmail",
      apps: "Set up a mail app",
    },
    historyMore: "Show {count} earlier versions",
    webmailNote: "Rather not install anything?",
    webmailLink: "Use webmail in your browser",
  },
  inquiry: {
    kicker: "Let's get you started",
    close: "Close",
    title: "Start with what you need",
    description: [
      "Pick a service, describe what you need, then get in touch.",
      "Plans, pricing and setup are confirmed before you pay.",
    ],
    productLabel: "Service",
    durationLabel: "Term",
    durations: ["1 month", "3 months", "6 months", "12 months", "Not sure yet"],
    otherProduct: "Something else",
    undecidedProduct: "Not sure yet",
    undecidedLabel: "Not sure yet, I'd like to ask first",
    notesLabel: "Number of mailboxes, domain or mail app needs",
    optional: "Optional",
    notesPlaceholder:
      "For example: 3 mailboxes, I already own a domain, and I want mail on my phone and laptop. Never include passwords or codes.",
    previewLabel: "Your message",
    copy: "Copy message",
    note: "This dialog only helps you write your request. It doesn't place an order or charge you.",
    legal: "Requests and services are covered by the {terms} and {privacy}.",
    newWindow: " (opens in a new window)",
    copied: "Copied. Paste it into a message to us.",
    copyFailed: "Couldn't copy automatically. Select the text above and copy it.",
    copyFieldLabel: "Message to copy",
  },
  legal: {
    effective: "Effective",
    updated: "Last updated",
    dateLocale: "en-US",
    tocLabel: "Contents",
    tocHint: "On this page",
    tocKicker: "Contents",
    highlights: "At a glance",
    highlightsNote: "This summary is for convenience; the full text below governs.",
    contactTitle: "Contact us",
    contactBody: (title) =>
      `If you have questions about this ${title}, or want to access, correct or delete your information, contact us below. Tell us what you need and include any order details; never send passwords, verification codes or card details.`,
    contactPending: "Contact channels are coming soon and will be listed here.",
    contactLabels: { email: "Email", wechat: "WeChat", telegram: "Telegram" },
    colon: ": ",
    relatedLabel: "Related pages",
    seeAlso: (label) => `See also: ${label}`,
    backHome: "Back to home",
  },
};
