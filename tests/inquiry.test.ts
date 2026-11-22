import { test } from "node:test";
import assert from "node:assert/strict";
import { describeContact, formatInquiry, getContactLink, getTelegramUrl } from "../src/lib/inquiry.ts";

const emptyContact = { wechat: "", email: "", telegram: "" };
const inquiry = {
  product: "域名邮箱",
  duration: "3 个月",
  notes: "  日常通信 & 工作往来\n需要 3 个邮箱  ",
};

test("consultation text keeps the selected product, duration and trimmed notes", () => {
  assert.equal(
    formatInquiry(inquiry, "zh"),
    "你好，我想咨询 Abnormal 产品。\n服务类型：域名邮箱\n使用时长：3 个月\n需求：日常通信 & 工作往来\n需要 3 个邮箱\n请帮我确认适合的方案、总费用、使用方式与支持范围。",
  );
  assert.ok(!formatInquiry({ ...inquiry, notes: "  " }, "zh").includes("需求："));
  assert.equal(
    formatInquiry({ product: "mail", duration: "1 month", notes: "  " }, "en"),
    "Hi, I'd like to ask about an Abnormal product.\nService: mail\nTerm: 1 month\nPlease let me know the plan, total cost, setup time and what support is included.",
  );
});

test("missing contact information cannot produce a fake consultation link", () => {
  assert.equal(getContactLink(emptyContact, inquiry, "zh"), undefined);
  assert.match(describeContact(emptyContact, "zh"), /咨询渠道即将公布/);
  assert.equal(
    describeContact(emptyContact, "en"),
    "Contact channels are coming soon. You can copy your request now and get in touch later.",
  );
});

test("Telegram permits HTTPS t.me links only, without embedded credentials", () => {
  assert.equal(getTelegramUrl(" https://t.me/example "), "https://t.me/example");
  for (const value of [
    "",
    "example",
    "javascript:alert(1)",
    "http://t.me/example",
    "https://t.me.evil.example/name",
    "https://user:password@t.me/example",
    "https://t.me/",
  ]) {
    assert.equal(getTelegramUrl(value), undefined, value);
  }
});

test("invalid Telegram falls back to the configured email and escapes inquiry text", () => {
  const link = getContactLink(
    {
      ...emptyContact,
      telegram: "not-a-link",
      email: "hello+mail@example.com",
    },
    inquiry,
    "zh",
  );
  assert.equal(link?.type, "email");
  assert.ok(link);
  const url = new URL(link.href);
  assert.equal(decodeURIComponent(url.pathname), "hello+mail@example.com");
  assert.equal(url.searchParams.get("subject"), "Abnormal 产品咨询 · 域名邮箱");
  assert.equal(url.searchParams.get("body"), formatInquiry(inquiry, "zh"));
});

test("English email links retain their translated labels, subjects and message bodies", () => {
  const link = getContactLink(
    { ...emptyContact, email: "hello@example.com" },
    { product: "mail", duration: "1 month", notes: "" },
    "en",
  );
  assert.ok(link);
  assert.equal(link.type, "email");
  assert.equal(link.label, "Ask by email");
  const url = new URL(link.href);
  assert.equal(url.searchParams.get("subject"), "Abnormal product inquiry · mail");
  assert.equal(
    url.searchParams.get("body"),
    "Hi, I'd like to ask about an Abnormal product.\nService: mail\nTerm: 1 month\nPlease let me know the plan, total cost, setup time and what support is included.",
  );
});

test("valid Telegram takes precedence and WeChat remains available in contact details", () => {
  const contact = {
    wechat: "example-wechat",
    email: "hello@example.com",
    telegram: "https://t.me/example",
  };
  assert.equal(getContactLink(contact, inquiry, "zh")?.type, "telegram");
  assert.equal(
    describeContact(contact, "zh"),
    "微信：example-wechat · 邮箱：hello@example.com · Telegram：https://t.me/example。复制下方咨询内容后联系我们。",
  );
  assert.equal(
    describeContact(contact, "en"),
    "WeChat: example-wechat · Email: hello@example.com · Telegram: https://t.me/example. Copy the message below and send it to us.",
  );
});
