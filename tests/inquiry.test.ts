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
});

test("missing contact information cannot produce a fake consultation link", () => {
  assert.equal(getContactLink(emptyContact, inquiry, "zh"), undefined);
  assert.match(describeContact(emptyContact, "zh"), /咨询渠道即将公布/);
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

test("valid Telegram takes precedence and WeChat remains available in contact details", () => {
  const contact = {
    wechat: "example-wechat",
    email: "hello@example.com",
    telegram: "https://t.me/example",
  };
  assert.equal(getContactLink(contact, inquiry, "zh")?.type, "telegram");
  assert.match(describeContact(contact, "zh"), /微信：example-wechat/);
  assert.match(describeContact(contact, "zh"), /邮箱：hello@example.com/);
  assert.match(describeContact(contact, "zh"), /Telegram：https:\/\/t.me\/example/);
});
