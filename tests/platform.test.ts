import { test } from "node:test";
import assert from "node:assert/strict";
import { detectDevice } from "../src/lib/platform.ts";

const ua = {
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  windows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
  linux: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
  android:
    "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36",
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  chromeos:
    "Mozilla/5.0 (X11; CrOS x86_64 15000.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
};

test("each desktop system is recognised from its user agent", () => {
  assert.equal(detectDevice({ userAgent: ua.mac }), "macos");
  assert.equal(detectDevice({ userAgent: ua.windows }), "windows");
  assert.equal(detectDevice({ userAgent: ua.linux }), "linux");
});

test("phones and tablets get the phone note, including an iPad that reports a Mac", () => {
  assert.equal(detectDevice({ userAgent: ua.android }), "phone", "Android says Linux too, and must not get the .deb");
  assert.equal(detectDevice({ userAgent: ua.iphone }), "phone", "iOS says Mac OS X too");
  assert.equal(detectDevice({ userAgent: ua.mac, maxTouchPoints: 5 }), "phone");
  assert.equal(detectDevice({ userAgent: ua.windows, userAgentData: { platform: "Windows", mobile: true } }), "phone");
});

test("client hints win over the user agent, and an unknown or unsupported system recommends nothing", () => {
  assert.equal(detectDevice({ userAgent: "", userAgentData: { platform: "macOS" } }), "macos");
  assert.equal(detectDevice({ userAgent: ua.chromeos }), null);
  assert.equal(detectDevice({ userAgent: "" }), null);
});
