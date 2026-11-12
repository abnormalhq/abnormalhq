/**
 * Takes the WebMail screenshots of the home page's "Take a look" section (src/components/Screens.tsx) and writes them to
 * public/screens/ as WebP at each width src/lib/screens.ts lists. The pictures are of the real WebMail, run by the mail repository's
 * browser-test stack with its stand-in mail server, filled with the sample mail and events below in each language.
 *
 *   # in a checkout of abnormalhq/mail, with Postgres up (docs/development.md, "Browser tests"):
 *   pnpm --filter @mailhq/webmail-e2e e2e:serve
 *   # then here:
 *   MAIL_DIR=../mail node scripts/screenshots.mjs
 *
 * Playwright comes from that checkout (this repository does not depend on it); E2E_CHROMIUM names another Chromium. sharp comes with
 * next. The stack's test domain is shown as abnormalhq.com, and its default calendar's name is put in Chinese for the Chinese pictures.
 */
import { mkdirSync, mkdtempSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

const mailDir = path.resolve(process.env.MAIL_DIR ?? "../mail");
const { chromium } = createRequire(path.join(mailDir, "apps/webmail/e2e/package.json"))("playwright");
const sharp = createRequire(createRequire(import.meta.url).resolve("next/package.json"))("sharp");

const OUT = new URL("../public/screens/", import.meta.url).pathname;
const SHOTS = mkdtempSync(path.join(tmpdir(), "abnormal-screens-"));
const WEB = `http://localhost:${process.env.E2E_WEBMAIL_PORT ?? 3101}`;
const BACK = `http://127.0.0.1:${process.env.E2E_BACKEND_PORT ?? 3102}`;
const ALICE = { id: "e2emailbox00001", email: "alice@e2e.example", password: "Alice-e2e-Passphrase-1" };
/** The language being taken, and its sample content. */
let lang = "en";
let C;

/** The widths written for each picture, as src/lib/screens.ts lists them. */
const WIDTHS = { inbox: [1440, 2880], calendar: [1440, 2880], phone: [390, 780] };

async function control(path, body) {
  const r = await fetch(`${BACK}/__e2e/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
  return r.json();
}
// Mail is dated back from 10:15 UTC today (yesterday if it is earlier), so the list reads like a working morning.
const ANCHOR = (() => {
  const d = new Date();
  d.setUTCHours(10, 15, 0, 0);
  if (d.getTime() > Date.now()) d.setUTCDate(d.getUTCDate() - 1);
  return d.getTime();
})();
const ago = (m) => new Date(ANCHOR - m * 60_000).toISOString();
const raw = (from, subject, id, html) =>
  [
    `From: ${from}`,
    `To: Alice <${ALICE.email}>`,
    `Subject: ${subject}`,
    `Message-ID: <${id}@demo.example>`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
    "",
    html,
    "",
  ].join("\r\n");

const COPY = {
  en: {
    locale: "en-US",
    labels: ["Work", "Travel", "Family"],
    mails: [
      {
        id: "m-plan",
        from: ["Maya Chen", "maya@northwind.example"],
        subject: "Launch plan for next week",
        minutes: 8,
        labels: [0],
        unread: false,
        html: `<p>Hi Alice,</p><p>Here's where we landed on the launch. Everything is on track for Tuesday:</p><ul><li><b>Monday</b> — final review of the landing page and the pricing copy</li><li><b>Tuesday 10:00</b> — go live, announcement email to the waiting list</li><li><b>Wednesday</b> — first look at sign-ups and replies</li></ul><p>I've put the review on our calendar and attached the checklist. Shout if anything should move.</p><p>Thanks,<br>Maya</p>`,
        attach: true,
      },
      {
        id: "m-trip",
        from: ["Lisbon Stays", "bookings@lisbonstays.example"],
        subject: "Your booking is confirmed: 3 nights in Lisbon",
        minutes: 52,
        labels: [1],
        unread: true,
        text: "Check-in from 15:00 on Friday. Your host will send directions the day before.",
      },
      {
        id: "m-mom",
        from: ["Mom", "rose.liu@family.example"],
        subject: "Photos from Sunday 🌿",
        minutes: 140,
        labels: [2],
        unread: true,
        text: "The garden finally bloomed! I picked the best ones for you, the rest are in the shared album.",
      },
      {
        id: "m-news",
        from: ["Design Weekly", "hello@designweekly.example"],
        subject: "Issue 128: Quiet interfaces",
        minutes: 300,
        labels: [],
        unread: false,
        text: "This week: why calm software wins, five type pairings for 2027, and a reader's tiny-studio tour.",
      },
      {
        id: "m-invoice",
        from: ["Ledger Books", "billing@ledger.example"],
        subject: "Invoice 1042 is paid — thank you",
        minutes: 60 * 22,
        labels: [0],
        unread: false,
        text: "We received your payment of 240.00. A receipt is attached for your records.",
      },
      {
        id: "m-team",
        from: ["Jonas Weber", "jonas@northwind.example"],
        subject: "Re: Offsite in December",
        minutes: 60 * 26,
        labels: [0],
        unread: false,
        text: "Second week of December works for everyone. I'll book the venue by Friday.",
      },
      {
        id: "m-book",
        from: ["Priya Raman", "priya@studio.example"],
        subject: "Book club: next pick?",
        minutes: 60 * 49,
        labels: [],
        unread: false,
        text: "Three votes for the short story collection, two for the novel. Tie-breaker?",
      },
    ],
    events: [
      ["Weekly sync", -3, 9, 10, ""],
      ["Design critique", -2, 14, 16, ""],
      ["Yoga", -2, 19, 20, ""],
      ["Launch review", -1, 10, 11, "Room 4"],
      ["Lunch with Maya", 0, 12, 13, ""],
      ["Launch day 🚀", 0, 9, 10, ""],
      ["Customer call", 0, 15, 16, ""],
      ["Quarterly planning", 1, 13, 15, ""],
      ["Flight to Lisbon", 1, 18, 21, ""],
      ["Coffee with Jonas", -3, 16, 17, ""],
      ["Book club", -1, 19, 21, ""],
      ["Dentist", -4, 11, 12, ""],
    ],
  },
  zh: {
    locale: "zh-CN",
    labels: ["工作", "旅行", "家人"],
    mails: [
      {
        id: "m-plan",
        from: ["陈晓雨", "xiaoyu@northwind.example"],
        subject: "下周上线安排",
        minutes: 8,
        labels: [0],
        unread: false,
        html: `<p>Alice 你好，</p><p>上线的安排定下来了，周二上线一切按计划进行：</p><ul><li><b>周一</b>：最后过一遍落地页和价格文案</li><li><b>周二 10:00</b>：正式上线，给预约名单发通知邮件</li><li><b>周三</b>：看一下注册和回复的情况</li></ul><p>评审会已经加到我们的日历里，检查清单在附件。有需要调整的随时说。</p><p>谢谢，<br>晓雨</p>`,
        attach: true,
      },
      {
        id: "m-trip",
        from: ["里斯本民宿", "bookings@lisbonstays.example"],
        subject: "预订成功：里斯本 3 晚",
        minutes: 52,
        labels: [1],
        unread: true,
        text: "周五 15:00 后可入住，房东会在前一天发来路线说明。",
      },
      {
        id: "m-mom",
        from: ["妈妈", "rose.liu@family.example"],
        subject: "周日拍的照片 🌿",
        minutes: 140,
        labels: [2],
        unread: true,
        text: "院子里的花终于开了！挑了几张好看的给你，其余的在共享相册里。",
      },
      {
        id: "m-news",
        from: ["设计周刊", "hello@designweekly.example"],
        subject: "第 128 期：安静的界面",
        minutes: 300,
        labels: [],
        unread: false,
        text: "本期：为什么克制的软件更耐用，五组字体搭配，以及一位读者的小工作室。",
      },
      {
        id: "m-invoice",
        from: ["账本记账", "billing@ledger.example"],
        subject: "发票 1042 已付款，谢谢",
        minutes: 60 * 22,
        labels: [0],
        unread: false,
        text: "我们已收到你支付的 240.00，收据附在邮件中，方便你留存。",
      },
      {
        id: "m-team",
        from: ["周子航", "zihang@northwind.example"],
        subject: "回复：十二月团建",
        minutes: 60 * 26,
        labels: [0],
        unread: false,
        text: "十二月第二周大家都可以，我周五前把场地订好。",
      },
      {
        id: "m-book",
        from: ["林可", "linke@studio.example"],
        subject: "读书会：下一本读什么？",
        minutes: 60 * 49,
        labels: [],
        unread: false,
        text: "短篇集三票，长篇两票，谁来投关键一票？",
      },
    ],
    events: [
      ["周会", -3, 9, 10, ""],
      ["设计评审", -2, 14, 16, ""],
      ["瑜伽", -2, 19, 20, ""],
      ["上线评审", -1, 10, 11, "4 号会议室"],
      ["和晓雨吃午饭", 0, 12, 13, ""],
      ["正式上线 🚀", 0, 9, 10, ""],
      ["客户电话会", 0, 15, 16, ""],
      ["季度规划", 1, 13, 15, ""],
      ["飞往里斯本", 1, 18, 21, ""],
      ["和子航喝咖啡", -3, 16, 17, ""],
      ["读书会", -1, 19, 21, ""],
      ["看牙医", -4, 11, 12, ""],
    ],
  },
};

async function newPage(width, height, scale = 2, mobile = false) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    locale: C.locale,
    timezoneId: "UTC",
    colorScheme: "light",
    hasTouch: mobile,
    isMobile: mobile,
  });
  const page = await ctx.newPage();
  return { ctx, page };
}

async function signIn(page) {
  await page.goto(`${WEB}/login`);
  await page.waitForFunction(() => {
    const c = [...document.querySelectorAll("button, input:not([type=hidden])")];
    return c.length > 0 && c.every((x) => Object.keys(x).some((k) => k.startsWith("__reactProps$")));
  });
  await page.locator("input[type=email], input[name=email], input[autocomplete=username]").first().fill(ALICE.email);
  await page.locator("input[type=password]").first().fill(ALICE.password);
  await page.locator("form button[type=submit]").first().click();
  await page.waitForURL((u) => u.pathname === "/", { timeout: 120000 });
  await page.locator("[data-mail-grid]").waitFor({ timeout: 120000 });
}

/** A request to WebMail's API as the signed-in mailbox; a refusal stops the run, so no picture is saved with sample content missing. */
async function api(page, pathname, body) {
  const r = await page.evaluate(
    async ({ pathname, body, mailbox }) => {
      const r = await fetch(pathname, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Webmail-Mailbox": mailbox },
        body: JSON.stringify(body),
      });
      return { status: r.status, body: await r.text() };
    },
    { pathname, body, mailbox: ALICE.id },
  );
  if (r.status < 200 || r.status >= 300) throw new Error(`${pathname}: ${r.status} ${r.body.slice(0, 200)}`);
  return JSON.parse(r.body);
}

async function seed(page) {
  await control("reset", {});
  const state = await control(`state?account=${encodeURIComponent(ALICE.email)}`);
  for (const e of state.emails ?? [])
    await control("emails/update", {
      account: ALICE.email,
      id: e.id,
      patch: { mailboxIds: { b: true }, "keywords/$seen": true },
    });
  // One id per label, at that label's index in C.labels (which the mails' `labels` refer to).
  const colors = ["blue", "green", "orange"];
  const labelIds = [];
  for (const [i, name] of C.labels.entries())
    labelIds[i] = (await api(page, "/api/webmail/labels", { name, color: colors[i] })).label.id;
  const all = [...C.mails].reverse();
  for (const m of all) {
    const keywords = { ...(m.unread ? {} : { $seen: true }) };
    for (const l of m.labels) keywords[`mailhq_label_${labelIds[l]}`] = true;
    const email = {
      id: m.id,
      subject: m.subject,
      from: [{ name: m.from[0], email: m.from[1] }],
      receivedAt: ago(m.minutes),
      keywords,
      hasAttachment: Boolean(m.attach),
      text: m.text ?? m.html.replace(/<[^>]+>/g, " "),
    };
    if (m.html) {
      email.textType = "text/html";
      email.raw = raw(`${m.from[0]} <${m.from[1]}>`, m.subject, m.id, m.html);
    }
    await control("emails", { account: ALICE.email, email });
  }
}

async function seedEvents(page) {
  // Days counted from today (UTC), kept inside this Sunday-to-Saturday week.
  const now = new Date(ANCHOR);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = today.getUTCDay();
  const at = (d, h) => {
    const offset = Math.min(6 - dow, Math.max(-dow, d));
    const x = new Date(today.getTime() + offset * 86400_000);
    return `${x.toISOString().slice(0, 10)}T${String(h).padStart(2, "0")}:00`;
  };
  for (const [title, d, s, e, location] of C.events) {
    await api(page, "/api/webmail/calendar/events", {
      calendarId: "cal1",
      title,
      description: "",
      location,
      allDay: false,
      start: at(d, s),
      end: at(d, e),
      timeZone: "UTC",
      recurrence: null,
      alerts: [],
      participants: [],
    });
  }
}

async function polish(page) {
  // The stack's default calendar is called "Personal"; a Chinese user would have named it in Chinese.
  if (lang === "zh")
    await page.evaluate(() => {
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walk.nextNode()) if (walk.currentNode.nodeValue === "Personal") walk.currentNode.nodeValue = "个人";
    });
  await page.addStyleTag({
    content:
      "nextjs-portal{display:none!important} [data-sonner-toaster]{display:none!important} *{caret-color:transparent!important}",
  });
  // Show the production domain instead of the test stack's.
  await page.evaluate(() => {
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walk.nextNode()) {
      const n = walk.currentNode;
      if (n.nodeValue.includes("e2e.example")) n.nodeValue = n.nodeValue.replaceAll("e2e.example", "abnormalhq.com");
    }
  });
  await page.evaluate(() =>
    Promise.race([
      Promise.allSettled(document.getAnimations().map((a) => a.finished)),
      new Promise((r) => setTimeout(r, 1500)),
    ]),
  );
  await page.mouse.move(0, 0);
  await page.waitForTimeout(400);
}

const browser = await chromium.launch(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {});
mkdirSync(OUT, { recursive: true });
for (lang of /** @type {const} */ (["en", "zh"])) {
  C = COPY[lang];
  const { ctx, page } = await newPage(1440, 900);
  await signIn(page);
  await seed(page);

  await page.goto(`${WEB}/?account=${ALICE.id}`);
  const row = page.getByRole("listitem").filter({ hasText: C.mails[0].subject }).getByRole("button").last();
  await row.waitFor({ timeout: 120000 });
  await row.click();
  await page.locator("iframe").first().waitFor();
  await page.waitForTimeout(2500);
  await polish(page);
  await page.screenshot({ path: `${SHOTS}/${lang}-inbox.png` });

  await seedEvents(page);
  await page.goto(`${WEB}/?account=${ALICE.id}&calendar=week`);
  await page.getByText(C.events[0][0]).first().waitFor({ timeout: 120000 });
  await page.waitForTimeout(1500);
  await polish(page);
  await page.screenshot({ path: `${SHOTS}/${lang}-calendar.png` });
  await ctx.close();

  // A phone: 390 CSS pixels wide, taken at three times the density and scaled down.
  const phone = await newPage(390, 844, 3, true);
  await signIn(phone.page);
  await phone.page.goto(`${WEB}/?account=${ALICE.id}`);
  await phone.page.getByRole("listitem").filter({ hasText: C.mails[1].subject }).first().waitFor({ timeout: 120000 });
  await phone.page.waitForTimeout(2000);
  await polish(phone.page);
  await phone.page.screenshot({ path: `${SHOTS}/${lang}-phone.png` });
  await phone.ctx.close();

  for (const [key, widths] of Object.entries(WIDTHS))
    for (const width of widths)
      await sharp(`${SHOTS}/${lang}-${key}.png`)
        .resize({ width })
        .webp({ quality: 82, effort: 6 })
        .toFile(`${OUT}${lang}-${key}-${width}.webp`);
  console.log(`${lang}: done`);
}
await browser.close();
