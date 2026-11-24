import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import type { ComponentType, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { copies, getCopy, langs, localePath, type Lang } from "../src/i18n/index.ts";
import { messagesFor } from "../src/i18n/messages.ts";
import { homeMarkdown } from "../src/lib/markdown.ts";
import { pageMetadata } from "../src/lib/metadata.ts";
import { fillTemplate } from "../src/lib/template.ts";
import { copy as redeemCopy } from "../src/storefront/copy.ts";
import { shopCopy } from "../src/storefront/lib/shop-copy.ts";

const baselineCases = [
  {
    group: "marketing",
    path: "footer.emailAria",
    args: ["help@example.test"],
    en: "Support email: help@example.test",
    zh: "客服邮箱：help@example.test",
  },
  {
    group: "marketing",
    path: "legal.contactBody",
    args: ["Terms {kind}"],
    en: "If you have questions about this Terms {kind}, or want to access, correct or delete your information, contact us below. Tell us what you need and include any order details; never send passwords, verification codes or card details.",
    zh: "如对本Terms {kind}有任何疑问，或需要查询、更正、删除你的信息，请通过以下方式联系我们。为便于处理，请说明你的诉求及相关订单信息；请勿在消息中发送密码、验证码或支付卡信息。",
  },
  {
    group: "marketing",
    path: "legal.seeAlso",
    args: ["Privacy"],
    en: "See also: Privacy",
    zh: "另见 Privacy",
  },
  {
    group: "marketing",
    path: "services.consultAria",
    args: ["Plan {name} <em>"],
    en: "Ask about this: Plan {name} <em>",
    zh: "咨询这项服务：Plan {name} <em>",
  },
  {
    group: "redeem",
    path: "buttons.submit",
    args: [0],
    en: "Create mailbox",
    zh: "开通邮箱",
  },
  {
    group: "redeem",
    path: "buttons.submit",
    args: [1],
    en: "Create mailbox",
    zh: "开通邮箱",
  },
  {
    group: "redeem",
    path: "buttons.submit",
    args: [2],
    en: "Create 2 mailboxes",
    zh: "开通 2 个邮箱",
  },
  {
    group: "redeem",
    path: "msg.codeOk",
    args: [["alpha.test", "beta.test"], "2030-01-02", 3],
    en: "Valid. It creates mailboxes at @alpha.test or @beta.test, 3 left, until 2030-01-02.",
    zh: "可以使用，可开通 @alpha.test、@beta.test 邮箱，还能开通 3 个，2030-01-02 前有效。",
  },
  {
    group: "redeem",
    path: "msg.codeOk",
    args: [["alpha.test", "beta.test"], null, 0],
    en: "Valid. It creates mailboxes at @alpha.test or @beta.test, 0 left.",
    zh: "可以使用，可开通 @alpha.test、@beta.test 邮箱，还能开通 0 个。",
  },
  {
    group: "redeem",
    path: "msg.countHint",
    args: [0, 3],
    en: "This code can create 0 more.",
    zh: "这个兑换码还能开通 0 个邮箱。",
  },
  {
    group: "redeem",
    path: "msg.countHint",
    args: [1, 3],
    en: "This code can create 1 more.",
    zh: "这个兑换码还能开通 1 个邮箱。",
  },
  {
    group: "redeem",
    path: "msg.countHint",
    args: [4, 3],
    en: "This code can create 4 more, up to 3 at a time.",
    zh: "这个兑换码还能开通 4 个邮箱，一次最多 3 个。",
  },
  {
    group: "redeem",
    path: "msg.domainChanged",
    args: ["alpha.test"],
    en: "This code creates mailboxes at @alpha.test, and the addresses now show it. Check them, then submit again.",
    zh: "这个兑换码开通的是 @alpha.test 邮箱，地址已更新；核对后再提交一次。",
  },
  {
    group: "redeem",
    path: "msg.duplicateUsername",
    args: [2],
    en: "Same username as mailbox 2.",
    zh: "与第 2 个邮箱的用户名重复。",
  },
  {
    group: "redeem",
    path: "msg.partial",
    args: [2, 1],
    en: "2 created. 1 did not go through; fix them and submit again.",
    zh: "已开通 2 个；还有 1 个没成功，改好后再提交。",
  },
  {
    group: "redeem",
    path: "msg.passwordMissing",
    args: [["username", "password"]],
    en: "Still needs username, password.",
    zh: "还需要：username、password。",
  },
  {
    group: "redeem",
    path: "msg.rowsTrimmed",
    args: [1, 1],
    en: "This code can create only 1 more, so 1 filled entry was removed. Check the form, then submit.",
    zh: "这个兑换码只能再开通 1 个邮箱，已去掉多填的 1 个；核对后再提交。",
  },
  {
    group: "redeem",
    path: "msg.rowsTrimmed",
    args: [2, 3],
    en: "This code can create only 2 more, so 3 filled entries were removed. Check the form, then submit.",
    zh: "这个兑换码只能再开通 2 个邮箱，已去掉多填的 3 个；核对后再提交。",
  },
  {
    group: "redeem",
    path: "msg.usernameOk",
    args: ["user{tag}@example.test"],
    en: "user{tag}@example.test is available.",
    zh: "user{tag}@example.test 可以用。",
  },
  {
    group: "redeem",
    path: "result.notified",
    args: ["user@example.test"],
    en: "The account details were sent to user@example.test.",
    zh: "账号信息已发送到 user@example.test，请查收。",
  },
  {
    group: "redeem",
    path: "result.notifyFailed",
    args: ["user@example.test", "Reason."],
    en: "Could not send the account details to user@example.test (Reason). Save them from this page instead.",
    zh: "没能把账号信息发送到 user@example.test：Reason。请在这里保存好。",
  },
  {
    group: "redeem",
    path: "result.notifyFailed",
    args: ["user@example.test", "原因。"],
    en: "Could not send the account details to user@example.test (原因). Save them from this page instead.",
    zh: "没能把账号信息发送到 user@example.test：原因。请在这里保存好。",
  },
  {
    group: "redeem",
    path: "result.notifyFailed",
    args: ["user@example.test", null],
    en: "Could not send the account details to user@example.test. Save them from this page instead.",
    zh: "没能把账号信息发送到 user@example.test。请在这里保存好。",
  },
  {
    group: "redeem",
    path: "result.title",
    args: [0],
    en: "0 mailboxes created",
    zh: "已开通 0 个邮箱",
  },
  {
    group: "redeem",
    path: "result.title",
    args: [1],
    en: "1 mailboxes created",
    zh: "已开通 1 个邮箱",
  },
  {
    group: "redeem",
    path: "result.title",
    args: [3],
    en: "3 mailboxes created",
    zh: "已开通 3 个邮箱",
  },
  {
    group: "redeem",
    path: "steps.accounts.ordinal",
    args: [2],
    en: "Mailbox 2",
    zh: "第 2 个邮箱",
  },
  {
    group: "redeem",
    path: "steps.accounts.passwordLabel",
    args: [2],
    en: "Password for mailbox 2",
    zh: "第 2 个邮箱的密码",
  },
  {
    group: "redeem",
    path: "steps.accounts.usernameLabel",
    args: [2],
    en: "Username for mailbox 2",
    zh: "第 2 个邮箱的用户名",
  },
  {
    group: "shop",
    path: "cardPay",
    args: ["12.50"],
    en: "Pay 12.50",
    zh: "支付 12.50",
  },
  {
    group: "shop",
    path: "cardPrice",
    args: ["$12", 0],
    en: "Card $12",
    zh: "银行卡 $12",
  },
  {
    group: "shop",
    path: "cardPrice",
    args: ["$12", 1],
    en: "Card $12 every 1 day, auto-renews",
    zh: "银行卡 $12 / 1 天，自动续费",
  },
  {
    group: "shop",
    path: "cardPrice",
    args: ["$12", 30],
    en: "Card $12 every 30 days, auto-renews",
    zh: "银行卡 $12 / 30 天，自动续费",
  },
  {
    group: "shop",
    path: "carriedAddress",
    args: ["user@example.test"],
    en: "Your address: user@example.test. It will be filled in when you set the mailbox up after paying; it is checked again then.",
    zh: "你选好的地址：user@example.test。付款后开通邮箱时会自动填好，届时仍以实际可用为准。",
  },
  {
    group: "shop",
    path: "claimedNotice",
    args: [0],
    en: "Added 0 orders to your account.",
    zh: "已把 0 个订单归到你的账户。",
  },
  {
    group: "shop",
    path: "claimedNotice",
    args: [1],
    en: "Added 1 order to your account.",
    zh: "已把 1 个订单归到你的账户。",
  },
  {
    group: "shop",
    path: "claimedNotice",
    args: [3],
    en: "Added 3 orders to your account.",
    zh: "已把 3 个订单归到你的账户。",
  },
  {
    group: "shop",
    path: "confirmLoginAs",
    args: ["user@example.test"],
    en: "Sign in to the shop as user@example.test?",
    zh: "用 user@example.test 登录商店？",
  },
  {
    group: "shop",
    path: "confirmLoginSwitch",
    args: ["user@example.test"],
    en: "You're signed in as user@example.test. Continuing switches to the account above.",
    zh: "你现在登录的是 user@example.test，继续会换成上面的账户。",
  },
  {
    group: "shop",
    path: "confirmRegisterAs",
    args: ["user@example.test"],
    en: "Finish creating the account for user@example.test and sign in?",
    zh: "用 user@example.test 完成注册并登录？",
  },
  {
    group: "shop",
    path: "couponApplied",
    args: ["<b>{code}</b>"],
    en: "Code <b>{code}</b> applies. The plans below show the price with it.",
    zh: "优惠码 <b>{code}</b> 可以使用，优惠后的价格见下方套餐。",
  },
  {
    group: "shop",
    path: "couponPriceCard",
    args: ["$12"],
    en: "$12 by card",
    zh: "银行卡 $12",
  },
  {
    group: "shop",
    path: "couponPriceLdc",
    args: ["$12"],
    en: "$12 LDC",
    zh: "$12 LDC",
  },
  {
    group: "shop",
    path: "couponPriceUsdt",
    args: ["$12"],
    en: "$12",
    zh: "$12",
  },
  {
    group: "shop",
    path: "couponSeatRange",
    args: [1, 1],
    en: "This plan sells exactly 1 mailbox. Adjust the quantity, then apply the code again.",
    zh: "这个套餐固定为 1 个邮箱，请调整数量后再使用优惠码。",
  },
  {
    group: "shop",
    path: "couponSeatRange",
    args: [2, 2],
    en: "This plan sells exactly 2 mailboxes. Adjust the quantity, then apply the code again.",
    zh: "这个套餐固定为 2 个邮箱，请调整数量后再使用优惠码。",
  },
  {
    group: "shop",
    path: "couponSeatRange",
    args: [2, 4],
    en: "This plan sells 2 to 4 mailboxes. Adjust the quantity, then apply the code again.",
    zh: "这个套餐可选 2 ～ 4 个邮箱，请调整数量后再使用优惠码。",
  },
  {
    group: "shop",
    path: "couponSeatTotal",
    args: ["12.50"],
    en: "That many mailboxes cost more than one order can charge (12.50 at most). Choose fewer, then apply the code again.",
    zh: "所选数量超出了单笔订单的金额上限（12.50），请减少邮箱数量后再使用优惠码。",
  },
  {
    group: "shop",
    path: "couponWith",
    args: ["SAVE20", "$12"],
    en: "With SAVE20: $12",
    zh: "使用 SAVE20：$12",
  },
  {
    group: "shop",
    path: "days",
    args: [2],
    en: "2 days after payment",
    zh: "付款后 2 天内",
  },
  {
    group: "shop",
    path: "discount",
    args: [20],
    en: "20% off",
    zh: "优惠 20%",
  },
  {
    group: "shop",
    path: "domainAdded",
    args: ["alpha.test"],
    en: "alpha.test is reserved for you. Add the ownership record shown below.",
    zh: "alpha.test 已登记。请按下面的说明添加所有权验证记录。",
  },
  {
    group: "shop",
    path: "domainCheckedAt",
    args: ["2030-01-02"],
    en: "Last checked: 2030-01-02",
    zh: "上次检查：2030-01-02",
  },
  {
    group: "shop",
    path: "domainCopyName",
    args: ["TXT record"],
    en: "Copy the TXT record",
    zh: "复制TXT record",
  },
  {
    group: "shop",
    path: "domainOwnershipExpires",
    args: ["2030-01-02"],
    en: "This value works until 2030-01-02. DNS changes can take from a few minutes to a few hours to show.",
    zh: "这个验证值在 2030-01-02 前有效。DNS 记录生效可能需要几分钟到几小时。",
  },
  {
    group: "shop",
    path: "domainRemoved",
    args: ["alpha.test"],
    en: "alpha.test was given up. You can connect another domain in its place.",
    zh: "已放弃 alpha.test，这个名额可以接入别的域名。",
  },
  {
    group: "shop",
    path: "domainsCount",
    args: [0, 1],
    en: "0 of 1 domain connected",
    zh: "已接入 0 / 1 个域名",
  },
  {
    group: "shop",
    path: "domainsCount",
    args: [1, 2],
    en: "1 of 2 domains connected",
    zh: "已接入 1 / 2 个域名",
  },
  {
    group: "shop",
    path: "domainsCount",
    args: [3, 1],
    en: "3 of 1 domain connected",
    zh: "已接入 3 / 1 个域名",
  },
  {
    group: "shop",
    path: "domainsCount",
    args: [3, 3],
    en: "3 of 3 domains connected",
    zh: "已接入 3 / 3 个域名",
  },
  {
    group: "shop",
    path: "forgotSent",
    args: ["user@example.test"],
    en: "If user@example.test has an account, we've sent a password reset email. It works for 15 minutes; check your spam folder if it doesn't arrive.",
    zh: "如果 user@example.test 注册过账户，重设密码的邮件已经发出，15 分钟内有效。没收到请看看垃圾邮件。",
  },
  {
    group: "shop",
    path: "googleLinked",
    args: ["user@example.test"],
    en: "Linked to the Google account user@example.test. You can sign in with “Continue with Google” on the sign-in page.",
    zh: "已关联 Google 账户 user@example.test，可以在登录页点「使用 Google 登录」直接登录。",
  },
  {
    group: "shop",
    path: "loginSent",
    args: ["user@example.test"],
    en: "We sent a sign-in link to user@example.test. It works for 15 minutes; check your spam folder if it doesn't arrive.",
    zh: "登录链接已发到 user@example.test，15 分钟内有效。没收到请看看垃圾邮件。",
  },
  {
    group: "shop",
    path: "mailboxActions",
    args: ["user@example.test"],
    en: "Manage user@example.test",
    zh: "管理 user@example.test",
  },
  {
    group: "shop",
    path: "mailboxCreated",
    args: ["user@example.test"],
    en: "user@example.test is ready to use. Its password:",
    zh: "user@example.test 已开通，可以登录了。密码如下：",
  },
  {
    group: "shop",
    path: "mailboxDeleteConfirm",
    args: ["user@example.test"],
    en: "Type user@example.test to confirm",
    zh: "请输入 user@example.test 确认删除",
  },
  {
    group: "shop",
    path: "mailboxDeleted",
    args: ["user@example.test"],
    en: "user@example.test has been deleted.",
    zh: "user@example.test 已删除。",
  },
  {
    group: "shop",
    path: "mailboxDeleteWarning",
    args: ["user@example.test"],
    en: "Deleting user@example.test erases it and all its mail for good. Its slot goes back to the order, so you can set up another one.",
    zh: "删除后 user@example.test 和里面的全部邮件都会被永久清除，无法恢复。名额会还给这笔订单，可以再开一个。",
  },
  {
    group: "shop",
    path: "mailboxDisabled",
    args: ["user@example.test"],
    en: "user@example.test is disabled: it can't sign in or send mail.",
    zh: "user@example.test 已停用：不能登录，也不能发信。",
  },
  {
    group: "shop",
    path: "mailboxEnabled",
    args: ["user@example.test"],
    en: "user@example.test is enabled.",
    zh: "user@example.test 已启用。",
  },
  {
    group: "shop",
    path: "mailboxesLeftValue",
    args: [0],
    en: "0 mailboxes",
    zh: "0 个",
  },
  {
    group: "shop",
    path: "mailboxesLeftValue",
    args: [1],
    en: "1 mailbox",
    zh: "1 个",
  },
  {
    group: "shop",
    path: "mailboxesLeftValue",
    args: [3],
    en: "3 mailboxes",
    zh: "3 个",
  },
  {
    group: "shop",
    path: "mailboxesUsed",
    args: [2, 4],
    en: "2 of 4 set up",
    zh: "已开通 2 / 4",
  },
  {
    group: "shop",
    path: "mailboxPasswordSaved",
    args: ["user@example.test"],
    en: "The password of user@example.test has been changed.",
    zh: "user@example.test 的密码已更新。",
  },
  {
    group: "shop",
    path: "mailServerLine",
    args: ["IMAP", "mail.example.test", 993, "TLS"],
    en: "IMAP: mail.example.test, port 993, TLS",
    zh: "IMAP：mail.example.test，端口 993，TLS",
  },
  {
    group: "shop",
    path: "orderCoupon",
    args: [""],
    en: "Discount code",
    zh: "优惠码",
  },
  {
    group: "shop",
    path: "orderCoupon",
    args: ["0"],
    en: "Discount code 0",
    zh: "优惠码 0",
  },
  {
    group: "shop",
    path: "orderCoupon",
    args: ["SAVE20"],
    en: "Discount code SAVE20",
    zh: "优惠码 SAVE20",
  },
  {
    group: "shop",
    path: "ownDomainsValue",
    args: [2],
    en: "Up to 2",
    zh: "可接入 2 个",
  },
  {
    group: "shop",
    path: "passwordLength",
    args: [2, 4],
    en: "The password must be 2 to 4 characters.",
    zh: "密码需为 2–4 个字符。",
  },
  {
    group: "shop",
    path: "passwordRule",
    args: [2, 4],
    en: "2 to 4 characters. Saving signs you out in other browsers.",
    zh: "2–4 个字符。保存后，其它浏览器上的登录会退出。",
  },
  {
    group: "shop",
    path: "periodsOption",
    args: [1, 1],
    en: "1 period (1 days)",
    zh: "1 个周期（1 天）",
  },
  {
    group: "shop",
    path: "periodsOption",
    args: [3, 7],
    en: "3 periods (21 days)",
    zh: "3 个周期（21 天）",
  },
  {
    group: "shop",
    path: "periodValue",
    args: [1],
    en: "Subscription · every 1 day",
    zh: "订阅 · 每 1 天",
  },
  {
    group: "shop",
    path: "periodValue",
    args: [7],
    en: "Subscription · every 7 days",
    zh: "订阅 · 每 7 天",
  },
  {
    group: "shop",
    path: "perPeriod",
    args: [1],
    en: "LDC / 1 day",
    zh: "LDC / 1 天",
  },
  {
    group: "shop",
    path: "perPeriod",
    args: [7],
    en: "LDC / 7 days",
    zh: "LDC / 7 天",
  },
  {
    group: "shop",
    path: "planWithoutDomain",
    args: ["alpha.test"],
    en: "This plan doesn't include @alpha.test",
    zh: "这个套餐不含 @alpha.test",
  },
  {
    group: "shop",
    path: "quantity",
    args: [2],
    en: "2",
    zh: "2 个",
  },
  {
    group: "shop",
    path: "rateLimitedWait",
    args: [0],
    en: "Too many requests. Try again in 0 seconds.",
    zh: "操作过于频繁，请在 0 秒后重试。",
  },
  {
    group: "shop",
    path: "rateLimitedWait",
    args: [1],
    en: "Too many requests. Try again in 1 second.",
    zh: "操作过于频繁，请在 1 秒后重试。",
  },
  {
    group: "shop",
    path: "rateLimitedWait",
    args: [3600],
    en: "Too many requests. Try again in 1 hour.",
    zh: "操作过于频繁，请在 1 小时后重试。",
  },
  {
    group: "shop",
    path: "rateLimitedWait",
    args: [59],
    en: "Too many requests. Try again in 59 seconds.",
    zh: "操作过于频繁，请在 59 秒后重试。",
  },
  {
    group: "shop",
    path: "rateLimitedWait",
    args: [60],
    en: "Too many requests. Try again in 1 minute.",
    zh: "操作过于频繁，请在 1 分钟后重试。",
  },
  {
    group: "shop",
    path: "registerSent",
    args: ["user@example.test"],
    en: "We sent a confirmation email to user@example.test. Open its link within 15 minutes to finish and sign in; check your spam folder if it doesn't arrive.",
    zh: "确认邮件已发到 user@example.test，15 分钟内有效。点开里面的链接即可完成注册并登录；没收到请看看垃圾邮件。",
  },
  {
    group: "shop",
    path: "renewalPeriods",
    args: [1, 1],
    en: "1 period, 1 days in total",
    zh: "续 1 个周期，共 1 天",
  },
  {
    group: "shop",
    path: "renewalPeriods",
    args: [3, 7],
    en: "3 periods, 21 days in total",
    zh: "续 3 个周期，共 21 天",
  },
  {
    group: "shop",
    path: "renewAt",
    args: ["$12"],
    en: "Renews at $12 LDC per period",
    zh: "续费 $12 LDC / 周期",
  },
  {
    group: "shop",
    path: "resetFor",
    args: ["user@example.test"],
    en: "Set a new password for user@example.test",
    zh: "为 user@example.test 设置新密码",
  },
  {
    group: "shop",
    path: "seatCardEach",
    args: ["$12", 0],
    en: "$12 per mailbox by card",
    zh: "银行卡 $12 / 邮箱",
  },
  {
    group: "shop",
    path: "seatCardEach",
    args: ["$12", 1],
    en: "$12 per mailbox every 1 days by card, renewing automatically",
    zh: "银行卡 $12 / 邮箱 / 1 天，自动续费",
  },
  {
    group: "shop",
    path: "seatCardEach",
    args: ["$12", 30],
    en: "$12 per mailbox every 30 days by card, renewing automatically",
    zh: "银行卡 $12 / 邮箱 / 30 天，自动续费",
  },
  {
    group: "shop",
    path: "seatCountValue",
    args: [2, 4],
    en: "2 to 4, you choose",
    zh: "2 ～ 4 个，数量自选",
  },
  {
    group: "shop",
    path: "seatDiscountNote",
    args: [20],
    en: "The 20% discount is taken off the whole order and rounded once.",
    zh: "20% 的优惠按整笔订单计算，只取整一次。",
  },
  {
    group: "shop",
    path: "seatRange",
    args: [1, 1],
    en: "1 exactly",
    zh: "固定 1 个",
  },
  {
    group: "shop",
    path: "seatRange",
    args: [1, 4],
    en: "1 to 4",
    zh: "可选 1 ～ 4 个",
  },
  {
    group: "shop",
    path: "seatRange",
    args: [2, 2],
    en: "2 exactly",
    zh: "固定 2 个",
  },
  {
    group: "shop",
    path: "seatRenewAt",
    args: ["$12"],
    en: "Renews at $12 LDC per mailbox per period",
    zh: "续费每个邮箱 $12 LDC / 周期",
  },
  {
    group: "shop",
    path: "seatRenewsAt",
    args: ["$12", 1],
    en: "Then $12 every 1 day",
    zh: "之后每 1 天续费 $12",
  },
  {
    group: "shop",
    path: "seatRenewsAt",
    args: ["$12", 2],
    en: "Then $12 every 2 days",
    zh: "之后每 2 天续费 $12",
  },
  {
    group: "shop",
    path: "seatsAddRoom",
    args: [2],
    en: "This plan has room for 2 more.",
    zh: "这个套餐最多还能加 2 个。",
  },
  {
    group: "shop",
    path: "seatsApplied",
    args: [2],
    en: "Seats added. You now have 2.",
    zh: "席位已增加，现在共 2 个。",
  },
  {
    group: "shop",
    path: "seatsAtMax",
    args: [4],
    en: "This plan's limit of 4 seats is reached.",
    zh: "已达这个套餐的上限（4 个席位）。",
  },
  {
    group: "shop",
    path: "seatsAtMin",
    args: [0],
    en: "This plan's minimum of 0 seats is reached.",
    zh: "已是这个套餐的下限（0 个席位）。",
  },
  {
    group: "shop",
    path: "seatsAtMin",
    args: [1],
    en: "This plan's minimum of 1 seat is reached.",
    zh: "已是这个套餐的下限（1 个席位）。",
  },
  {
    group: "shop",
    path: "seatsAtMin",
    args: [2],
    en: "This plan's minimum of 2 seats is reached.",
    zh: "已是这个套餐的下限（2 个席位）。",
  },
  {
    group: "shop",
    path: "seatsPending",
    args: [1, "2030-01-02"],
    en: "Down to 1 seat from the next renewal (2030-01-02)",
    zh: "下次续费（2030-01-02）起减为 1 个席位",
  },
  {
    group: "shop",
    path: "seatsPending",
    args: [2, "2030-01-02"],
    en: "Down to 2 seats from the next renewal (2030-01-02)",
    zh: "下次续费（2030-01-02）起减为 2 个席位",
  },
  {
    group: "shop",
    path: "seatsPriceValue",
    args: ["$12", 0],
    en: "$12 per period",
    zh: "$12 / 周期",
  },
  {
    group: "shop",
    path: "seatsPriceValue",
    args: ["$12", 1],
    en: "$12 every 1 day",
    zh: "$12 / 1 天",
  },
  {
    group: "shop",
    path: "seatsPriceValue",
    args: ["$12", 7],
    en: "$12 every 7 days",
    zh: "$12 / 7 天",
  },
  {
    group: "shop",
    path: "seatsPriceValue",
    args: ["$12"],
    en: "$12 per period",
    zh: "$12 / 周期",
  },
  {
    group: "shop",
    path: "seatsQuoteAfter",
    args: [4, "$12", undefined],
    en: "You will then have 4 seats, renewing at $12 per period.",
    zh: "增加后共 4 个席位，之后每期续费 $12。",
  },
  {
    group: "shop",
    path: "seatsQuoteAfter",
    args: [4, "$12", 0],
    en: "You will then have 4 seats, renewing at $12 per period.",
    zh: "增加后共 4 个席位，之后每期续费 $12。",
  },
  {
    group: "shop",
    path: "seatsQuoteAfter",
    args: [4, "$12", 1],
    en: "You will then have 4 seats, renewing at $12 every 1 day.",
    zh: "增加后共 4 个席位，之后每 1 天续费 $12。",
  },
  {
    group: "shop",
    path: "seatsQuoteAfter",
    args: [4, "$12", 7],
    en: "You will then have 4 seats, renewing at $12 every 7 days.",
    zh: "增加后共 4 个席位，之后每 7 天续费 $12。",
  },
  {
    group: "shop",
    path: "seatsQuoteCard",
    args: [0, "$12", "2030-01-02"],
    en: "0 more seats for the rest of this period (until 2030-01-02): about $12. This is an estimate; Stripe works out the final amount and charges the card on the subscription.",
    zh: "增加 0 个席位，按本期剩余时间（到 2030-01-02）计费：约 $12。这是预估金额，最终金额由 Stripe 计算，并从订阅绑定的银行卡扣款。",
  },
  {
    group: "shop",
    path: "seatsQuoteCard",
    args: [1, "$12", "2030-01-02"],
    en: "1 more seat for the rest of this period (until 2030-01-02): about $12. This is an estimate; Stripe works out the final amount and charges the card on the subscription.",
    zh: "增加 1 个席位，按本期剩余时间（到 2030-01-02）计费：约 $12。这是预估金额，最终金额由 Stripe 计算，并从订阅绑定的银行卡扣款。",
  },
  {
    group: "shop",
    path: "seatsQuoteCard",
    args: [3, "$12", "2030-01-02"],
    en: "3 more seats for the rest of this period (until 2030-01-02): about $12. This is an estimate; Stripe works out the final amount and charges the card on the subscription.",
    zh: "增加 3 个席位，按本期剩余时间（到 2030-01-02）计费：约 $12。这是预估金额，最终金额由 Stripe 计算，并从订阅绑定的银行卡扣款。",
  },
  {
    group: "shop",
    path: "seatsQuoteLdc",
    args: [0, "$12", "2030-01-02"],
    en: "0 more seats for the rest of this period (until 2030-01-02): $12 LDC. That is the price if you order now; it falls as the period runs down.",
    zh: "增加 0 个席位，按本期剩余时间（到 2030-01-02）计费：$12 LDC。现在下单就是这个价格，时间越晚越少。",
  },
  {
    group: "shop",
    path: "seatsQuoteLdc",
    args: [1, "$12", "2030-01-02"],
    en: "1 more seat for the rest of this period (until 2030-01-02): $12 LDC. That is the price if you order now; it falls as the period runs down.",
    zh: "增加 1 个席位，按本期剩余时间（到 2030-01-02）计费：$12 LDC。现在下单就是这个价格，时间越晚越少。",
  },
  {
    group: "shop",
    path: "seatsQuoteLdc",
    args: [3, "$12", "2030-01-02"],
    en: "3 more seats for the rest of this period (until 2030-01-02): $12 LDC. That is the price if you order now; it falls as the period runs down.",
    zh: "增加 3 个席位，按本期剩余时间（到 2030-01-02）计费：$12 LDC。现在下单就是这个价格，时间越晚越少。",
  },
  {
    group: "shop",
    path: "seatsQuoteUsdt",
    args: [0, "$12", "2030-01-02"],
    en: "0 more seats for the rest of this period (until 2030-01-02): $12. That is the price if you order now; it falls as the period runs down.",
    zh: "增加 0 个席位，按本期剩余时间（到 2030-01-02）计费：$12。现在下单就是这个价格，时间越晚越少。",
  },
  {
    group: "shop",
    path: "seatsQuoteUsdt",
    args: [1, "$12", "2030-01-02"],
    en: "1 more seat for the rest of this period (until 2030-01-02): $12. That is the price if you order now; it falls as the period runs down.",
    zh: "增加 1 个席位，按本期剩余时间（到 2030-01-02）计费：$12。现在下单就是这个价格，时间越晚越少。",
  },
  {
    group: "shop",
    path: "seatsQuoteUsdt",
    args: [3, "$12", "2030-01-02"],
    en: "3 more seats for the rest of this period (until 2030-01-02): $12. That is the price if you order now; it falls as the period runs down.",
    zh: "增加 3 个席位，按本期剩余时间（到 2030-01-02）计费：$12。现在下单就是这个价格，时间越晚越少。",
  },
  {
    group: "shop",
    path: "seatsRemovalScheduled",
    args: [1, "2030-01-02"],
    en: "Scheduled: 1 seat from the next renewal (2030-01-02).",
    zh: "已安排：从下次续费（2030-01-02）起减为 1 个席位。",
  },
  {
    group: "shop",
    path: "seatsRemovalScheduled",
    args: [2, "2030-01-02"],
    en: "Scheduled: 2 seats from the next renewal (2030-01-02).",
    zh: "已安排：从下次续费（2030-01-02）起减为 2 个席位。",
  },
  {
    group: "shop",
    path: "seatsRemoveChoose",
    args: [2],
    en: "Choose the mailboxes that go with the seats (at least 2)",
    zh: "选择随席位一起移除的邮箱（至少 2 个）",
  },
  {
    group: "shop",
    path: "seatsRemoveChooseFewer",
    args: [1],
    en: "You can't choose more mailboxes than the 1 seat you remove.",
    zh: "选中的邮箱不能多于减少的席位数（1 个）。",
  },
  {
    group: "shop",
    path: "seatsRemoveChooseFewer",
    args: [2],
    en: "You can't choose more mailboxes than the 2 seats you remove.",
    zh: "选中的邮箱不能多于减少的席位数（2 个）。",
  },
  {
    group: "shop",
    path: "seatsRemoveChooseMore",
    args: [0],
    en: "Choose 0 more mailboxes.",
    zh: "还需再选 0 个邮箱。",
  },
  {
    group: "shop",
    path: "seatsRemoveChooseMore",
    args: [1],
    en: "Choose 1 more mailbox.",
    zh: "还需再选 1 个邮箱。",
  },
  {
    group: "shop",
    path: "seatsRemoveChooseMore",
    args: [2],
    en: "Choose 2 more mailboxes.",
    zh: "还需再选 2 个邮箱。",
  },
  {
    group: "shop",
    path: "seatsRemoveHint",
    args: ["2030-01-02"],
    en: "The removal takes effect at the next renewal (2030-01-02). Nothing is refunded for this period, and until then the seats and mailboxes keep working.",
    zh: "减少从下次续费（2030-01-02）起生效，本期不退款；在那之前，席位和邮箱都照常使用。",
  },
  {
    group: "shop",
    path: "seatsRemoveRoom",
    args: [2],
    en: "You can remove up to 2.",
    zh: "最多可减少 2 个。",
  },
  {
    group: "shop",
    path: "seatsUsed",
    args: [2, 4],
    en: "2 of 4 seats used",
    zh: "已用 2 / 4 个席位",
  },
  {
    group: "shop",
    path: "seatTotalCard",
    args: ["$12", 0],
    en: "$12 by card",
    zh: "银行卡 $12",
  },
  {
    group: "shop",
    path: "seatTotalCard",
    args: ["$12", 1],
    en: "$12 every 1 days by card",
    zh: "银行卡 $12 / 1 天",
  },
  {
    group: "shop",
    path: "seatTotalCard",
    args: ["$12", 30],
    en: "$12 every 30 days by card",
    zh: "银行卡 $12 / 30 天",
  },
  {
    group: "shop",
    path: "seatTotalLdc",
    args: ["12 LDC", 0],
    en: "12 LDC LDC",
    zh: "12 LDC LDC",
  },
  {
    group: "shop",
    path: "seatTotalLdc",
    args: ["12 LDC", 1],
    en: "12 LDC LDC every 1 days",
    zh: "12 LDC LDC / 1 天",
  },
  {
    group: "shop",
    path: "seatTotalLdc",
    args: ["12 LDC", 30],
    en: "12 LDC LDC every 30 days",
    zh: "12 LDC LDC / 30 天",
  },
  {
    group: "shop",
    path: "seatTotalUsdt",
    args: ["12 USDT", 0],
    en: "12 USDT",
    zh: "12 USDT",
  },
  {
    group: "shop",
    path: "seatTotalUsdt",
    args: ["12 USDT", 1],
    en: "12 USDT every 1 days",
    zh: "12 USDT / 1 天",
  },
  {
    group: "shop",
    path: "seatTotalUsdt",
    args: ["12 USDT", 30],
    en: "12 USDT every 30 days",
    zh: "12 USDT / 30 天",
  },
  {
    group: "shop",
    path: "seatUnit",
    args: [0],
    en: "LDC / mailbox",
    zh: "LDC / 邮箱",
  },
  {
    group: "shop",
    path: "seatUnit",
    args: [1],
    en: "LDC / mailbox / 1 days",
    zh: "LDC / 邮箱 / 1 天",
  },
  {
    group: "shop",
    path: "seatUnit",
    args: [30],
    en: "LDC / mailbox / 30 days",
    zh: "LDC / 邮箱 / 30 天",
  },
  {
    group: "shop",
    path: "seatUsdtEach",
    args: ["12 USDT", 0],
    en: "12 USDT per mailbox",
    zh: "12 USDT / 邮箱",
  },
  {
    group: "shop",
    path: "seatUsdtEach",
    args: ["12 USDT", 1],
    en: "12 USDT per mailbox every 1 days",
    zh: "12 USDT / 邮箱 / 1 天",
  },
  {
    group: "shop",
    path: "seatUsdtEach",
    args: ["12 USDT", 30],
    en: "12 USDT per mailbox every 30 days",
    zh: "12 USDT / 邮箱 / 30 天",
  },
  {
    group: "shop",
    path: "signedInAs",
    args: ["user@example.test"],
    en: "Signed in as user@example.test",
    zh: "已登录：user@example.test",
  },
  {
    group: "shop",
    path: "usdtChainOption",
    args: ["alpha.test", "TRC20"],
    en: "alpha.test (TRC20)",
    zh: "alpha.test（TRC20）",
  },
  {
    group: "shop",
    path: "usdtNetwork",
    args: ["alpha.test", "TRC20"],
    en: "alpha.test · TRC20",
    zh: "alpha.test · TRC20",
  },
  {
    group: "shop",
    path: "usdtPartial",
    args: ["4", "12.50", "8"],
    en: "Received 4 of 12.50 USDT. Send the remaining 8 USDT.",
    zh: "已收到 4 / 12.50 USDT，请再转入剩余的 8 USDT。",
  },
  {
    group: "shop",
    path: "usdtPrice",
    args: ["12 USDT", 0],
    en: "12 USDT",
    zh: "12 USDT",
  },
  {
    group: "shop",
    path: "usdtPrice",
    args: ["12 USDT", 1],
    en: "12 USDT every 1 day",
    zh: "12 USDT / 1 天",
  },
  {
    group: "shop",
    path: "usdtPrice",
    args: ["12 USDT", 30],
    en: "12 USDT every 30 days",
    zh: "12 USDT / 30 天",
  },
  {
    group: "shop",
    path: "usdtQr",
    args: ["T-ADDRESS"],
    en: "QR code of the address T-ADDRESS",
    zh: "收款地址 T-ADDRESS 的二维码",
  },
  {
    group: "shop",
    path: "usdtRenewAt",
    args: ["$12"],
    en: "Renews at $12 per period",
    zh: "续费 $12 / 周期",
  },
  {
    group: "shop",
    path: "usdtWarning",
    args: ["12.50", "TRC20"],
    en: "Send USDT on the TRC20 network only. Other tokens or networks are lost. Exchanges that deduct a withdrawal fee from the amount: make sure the amount that arrives is at least 12.50.",
    zh: "只能通过 TRC20 网络发送 USDT。其他代币或其他网络的转账会丢失，无法找回。从交易所提币时，如果手续费从金额中扣除，请确保到账金额不少于 12.50。",
  },
  {
    group: "shop",
    path: "trial.planSummary",
    args: [50, 0],
    en: "50 MB per mailbox · 0 own domains",
    zh: "每个邮箱 50 MB · 可接入 0 个自有域名",
  },
  {
    group: "shop",
    path: "trial.planSummary",
    args: [50, 1],
    en: "50 MB per mailbox · 1 own domain",
    zh: "每个邮箱 50 MB · 可接入 1 个自有域名",
  },
  {
    group: "shop",
    path: "trial.planSummary",
    args: [50, 2],
    en: "50 MB per mailbox · 2 own domains",
    zh: "每个邮箱 50 MB · 可接入 2 个自有域名",
  },
  {
    group: "shop",
    path: "trial.paidPeriods",
    args: [0, 30],
    en: "0 paid periods, 0 days in total",
    zh: "0 个付费周期，共 0 天",
  },
  {
    group: "shop",
    path: "trial.paidPeriods",
    args: [1, 30],
    en: "1 paid period, 30 days in total",
    zh: "1 个付费周期，共 30 天",
  },
  {
    group: "shop",
    path: "trial.paidPeriods",
    args: [3, 30],
    en: "3 paid periods, 90 days in total",
    zh: "3 个付费周期，共 90 天",
  },
  {
    group: "shop",
    path: "trial.description",
    args: [1, 25],
    en: "Try 1 mailbox with 25 MB for 1 days, starting when you claim. One trial per verified account. No card required and no automatic charge.",
    zh: "免费试用 1 个 25 MB 邮箱，共 1 天，自领取时起算。每个已验证账户限领一次，无需绑卡，不会自动扣款。",
  },
  {
    group: "shop",
    path: "trial.description",
    args: [30, 100],
    en: "Try 1 mailbox with 100 MB for 30 days, starting when you claim. One trial per verified account. No card required and no automatic charge.",
    zh: "免费试用 1 个 100 MB 邮箱，共 30 天，自领取时起算。每个已验证账户限领一次，无需绑卡，不会自动扣款。",
  },
] as const;

function facadeFor(group: string, locale: Lang): unknown {
  if (group === "marketing") return copies[locale];
  if (group === "redeem") return redeemCopy[locale];
  return shopCopy[locale];
}

function valueAt(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => (value as Record<string, unknown>)[key], source);
}

test("ICU adapters preserve the pre-migration outputs of every dynamic copy entry", () => {
  assert.equal(new Set(baselineCases.map(({ group, path }) => group + ":" + path)).size, 108);
  for (const row of baselineCases) {
    for (const locale of langs) {
      const value = valueAt(facadeFor(row.group, locale), row.path);
      assert.equal(typeof value, "function", row.group + "." + row.path + " is not adapted");
      const actual = (value as (...args: unknown[]) => string)(...row.args);
      assert.equal(
        actual,
        row[locale],
        row.group + "." + row.path + " (" + locale + ", " + JSON.stringify(row.args) + ")",
      );
    }
  }
});

test("structured raw messages stay enumerable, serializable and template-compatible", () => {
  const legalCopy = {
    en: "Requests and services are covered by the <terms> and <privacy>.",
    zh: "咨询与服务适用<terms>与<privacy>。",
  };
  for (const locale of langs) {
    const { t } = getCopy(locale);
    const source = messagesFor(locale).marketing;
    assert.ok(Object.keys(t).length > 0);
    assert.deepEqual({ ...t.header }, source.header);
    assert.deepEqual(JSON.parse(JSON.stringify(t.header)), source.header);
    assert.deepEqual(JSON.parse(JSON.stringify(t.services.products)), source.services.products);
    assert.deepEqual(JSON.parse(JSON.stringify(t.inquiry)), source.inquiry);
    assert.equal(fillTemplate(t.inquiry.legal, { terms: "<terms>", privacy: "<privacy>" }).join(""), legalCopy[locale]);

    const shopProviderMessages = { storefront: { shop: messagesFor(locale).storefront.shop } };
    const redeemProviderMessages = { storefront: { redeem: messagesFor(locale).storefront.redeem } };
    assert.deepEqual(Object.keys(shopProviderMessages.storefront), ["shop"]);
    assert.deepEqual(Object.keys(redeemProviderMessages.storefront), ["redeem"]);
    assert.deepEqual(JSON.parse(JSON.stringify(shopProviderMessages)), shopProviderMessages);
    assert.deepEqual(JSON.parse(JSON.stringify(redeemProviderMessages)), redeemProviderMessages);
    assert.equal(Object.hasOwn(shopProviderMessages.storefront, "redeem"), false);
    assert.equal(Object.hasOwn(redeemProviderMessages.storefront, "shop"), false);
    assert.equal(Object.hasOwn(shopProviderMessages.storefront, "en"), false);
    assert.equal(Object.hasOwn(redeemProviderMessages.storefront, "zh"), false);
  }
});

function ShopProviderProbe() {
  const t = useTranslations("storefront.shop");
  return createElement("span", null, t("title"));
}

function RedeemProviderProbe() {
  const t = useTranslations("storefront.redeem");
  return createElement("span", null, t("title"));
}

const TestIntlProvider = NextIntlClientProvider as unknown as ComponentType<{
  locale: string;
  messages: Record<string, unknown>;
  timeZone: string;
  children?: ReactNode;
}>;

test("scoped next-intl providers render their messages through client hooks in SSR", () => {
  for (const locale of langs) {
    const shopMessages = { storefront: { shop: messagesFor(locale).storefront.shop } };
    const redeemMessages = { storefront: { redeem: messagesFor(locale).storefront.redeem } };
    const shopMarkup = renderToStaticMarkup(
      createElement(
        TestIntlProvider,
        { locale, messages: shopMessages, timeZone: "UTC" },
        createElement(ShopProviderProbe),
      ),
    );
    const redeemMarkup = renderToStaticMarkup(
      createElement(
        TestIntlProvider,
        { locale, messages: redeemMessages, timeZone: "UTC" },
        createElement(RedeemProviderProbe),
      ),
    );
    assert.equal(shopMarkup, `<span>${messagesFor(locale).storefront.shop.title}</span>`);
    assert.equal(redeemMarkup, `<span>${messagesFor(locale).storefront.redeem.title}</span>`);
  }
});

test("metadata, Markdown headings and public paths retain both locale outputs", () => {
  const expected = {
    en: {
      canonical: "/",
      socialTitle: "Abnormal — Useful tools, simpler days.",
      markdownTitle: "# Abnormal — Useful tools, simpler days",
      paths: ["/", "/pricing/", "/shop/", "/redeem/"],
    },
    zh: {
      canonical: "/zh/",
      socialTitle: "Abnormal — 好用的工具，让日常更简单。",
      markdownTitle: "# Abnormal — 好用的工具，让日常更简单",
      paths: ["/zh/", "/zh/pricing/", "/zh/shop/", "/zh/redeem/"],
    },
  } as const;
  for (const locale of langs) {
    const metadata = pageMetadata({ lang: locale, path: "/" });
    assert.equal(metadata.alternates?.canonical, expected[locale].canonical);
    assert.equal(metadata.openGraph?.title, expected[locale].socialTitle);
    assert.ok(homeMarkdown(locale).startsWith(expected[locale].markdownTitle + "\n"));
    assert.deepEqual(
      ["/", "/pricing/", "/shop/", "/redeem/"].map((path) => localePath(locale, path)),
      expected[locale].paths,
    );
  }
});
