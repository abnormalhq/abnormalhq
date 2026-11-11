import { beforeEach, expect, test, vi } from "vitest";
import { markAwaiting, ORDER_AWAITING_KEY, orderSteps, takeAwaiting } from "@/storefront/lib/order-progress";
import { shopCopy } from "@/storefront/lib/shop-copy";

function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
    clear: () => items.clear(),
    key: () => null,
    get length() {
      return items.size;
    },
  };
}

beforeEach(() => {
  vi.stubGlobal("sessionStorage", memoryStorage());
});

test("an unpaid order is at the payment step", () => {
  expect(orderSteps({ status: "pending", kind: "purchase" })).toEqual([
    { key: "placed", status: "complete" },
    { key: "pay", status: "current" },
    { key: "code", status: "upcoming" },
  ]);
});

test("a paid purchase leaves the code to collect; a paid renewal is complete", () => {
  expect(orderSteps({ status: "paid" }).map((step) => step.status)).toEqual(["complete", "complete", "current"]);
  expect(orderSteps({ status: "paid", kind: "renewal" })).toEqual([
    { key: "placed", status: "complete" },
    { key: "pay", status: "complete" },
    { key: "done", status: "complete" },
  ]);
});

test("every step has a title in both languages", () => {
  for (const lang of ["en", "zh"] as const) {
    for (const kind of ["purchase", "renewal"] as const) {
      for (const step of orderSteps({ status: "pending", kind }))
        expect(shopCopy[lang].progress[step.key]).toBeTruthy();
    }
  }
});

test("an order seen waiting for payment is celebrated once", () => {
  expect(takeAwaiting("aaaaaaaaaaaaaaa")).toBe(false);
  markAwaiting("aaaaaaaaaaaaaaa");
  markAwaiting("aaaaaaaaaaaaaaa");
  markAwaiting("bbbbbbbbbbbbbbb");
  expect(takeAwaiting("aaaaaaaaaaaaaaa")).toBe(true);
  expect(takeAwaiting("aaaaaaaaaaaaaaa")).toBe(false);
  expect(takeAwaiting("bbbbbbbbbbbbbbb")).toBe(true);
});

test("only the latest few orders are remembered, and broken or blocked storage is survived", () => {
  for (let index = 0; index < 12; index++) markAwaiting(`order${String(index).padStart(10, "0")}`);
  expect(takeAwaiting("order0000000000")).toBe(false);
  expect(takeAwaiting("order0000000011")).toBe(true);

  sessionStorage.setItem(ORDER_AWAITING_KEY, "{not json");
  expect(takeAwaiting("order0000000010")).toBe(false);

  vi.stubGlobal("sessionStorage", {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
  });
  expect(() => markAwaiting("aaaaaaaaaaaaaaa")).not.toThrow();
  expect(takeAwaiting("aaaaaaaaaaaaaaa")).toBe(false);
});
