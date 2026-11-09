import { expect, test } from "vitest";
import {
  CDK_ALPHABET,
  CDK_LENGTH,
  PASSWORD_ALPHABET,
  formatCdk,
  generateCdk,
  generatePassword,
  isCdkComplete,
  normalizeCdk,
  normalizeEmail,
  normalizeUsername,
  notifyProblem,
  passwordChecks,
  passwordMissing,
  passwordProblem,
  usernameProblem,
} from "@/storefront/lib/onboard";

test("redeem code: strips separators and case differences, displayed in groups of 4", () => {
  expect(normalizeCdk(" abcd-efgh jklm_npqr ")).toBe("ABCDEFGHJKLMNPQR");
  expect(formatCdk("abcdefghjklmnpqr")).toBe("ABCD-EFGH-JKLM-NPQR");
  expect(formatCdk("abcde")).toBe("ABCD-E");
  expect(formatCdk("")).toBe("");
  expect(normalizeCdk("ABCDEFGHJKLMNPQRSTUV"), "the excess is cut off").toBe("ABCDEFGHJKLMNPQR");
  expect(isCdkComplete("abcd-efgh-jklm-npqr")).toBe(true);
  expect(isCdkComplete("abcd-efgh-jklm-npq")).toBe(false);
});

test("the redeem code generator uses only the alphabet without confusable characters", () => {
  for (let i = 0; i < 100; i++) {
    const code = generateCdk();
    expect(code.length).toBe(CDK_LENGTH);
    expect(
      [...code].every((c) => CDK_ALPHABET.includes(c)),
      code,
    ).toBe(true);
    expect(code).not.toMatch(/[01IO]/);
  }
});

test("username: trims whitespace, lower-cases, drops the part after @", () => {
  expect(normalizeUsername("  Kunish@abnormal.bid ")).toBe("kunish");
  expect(normalizeUsername("a.b_c-d")).toBe("a.b_c-d");
  expect(normalizeUsername("@abnormal.bid")).toBe("");
});

test("username rules match mailhq: lower-case letters, digits and . _ -, letter or digit at both ends, no two dots in a row, at most 64 characters", () => {
  expect(usernameProblem("")).toBe("required");
  for (const ok of ["a", "kunish", "a.b", "a.b.c", "a_b-c9", "a._b", "x".repeat(64)]) {
    expect(usernameProblem(ok), ok).toBe(null);
  }
  for (const bad of [".a", "a.", "-a", "a-", "a..b", "a...b", "Kunish", "a b", "中文", "a@b", "x".repeat(65)]) {
    expect(usernameProblem(bad), bad).toBe("invalid");
  }
});

test("password rules match the Stalwart backend: 8 to 128 characters, no whitespace, no required character mix", () => {
  expect(passwordProblem("")).toBe("required");
  expect(passwordProblem("Aa1".padEnd(129, "x"))).toBe("too_long");
  expect(passwordProblem("Aa1 aaaaa")).toBe("whitespace");
  expect(passwordProblem("Aa1aaaa"), "7 characters").toBe("weak");
  for (const password of [
    "aa1aaaaa",
    "AA1AAAAA",
    "AaAaAaAa",
    "abcdefgh",
    "12345678",
    "!@#$%^&*",
    "abcdefgh".repeat(16),
  ]) {
    expect(passwordProblem(password), password).toBe(null);
  }
  for (const whitespace of [" ", "\t", "\n", "\r", "\u00a0", "\u3000"]) {
    expect(passwordProblem(`abcdefgh${whitespace}`)).toBe("whitespace");
  }
  expect(passwordChecks("Ab3")).toStrictEqual({
    length: false,
  });
});

test("random password: 16 characters by default, meets every rule, uses only unambiguous characters", () => {
  for (let i = 0; i < 200; i++) {
    const password = generatePassword();
    expect(password.length).toBe(16);
    expect(passwordProblem(password), password).toBe(null);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[2-9]/);
    expect(
      [...password].every((c) => PASSWORD_ALPHABET.includes(c)),
      password,
    ).toBe(true);
  }
  expect(generatePassword(3).length, "shorter than the minimum generates the minimum").toBe(8);
  expect(generatePassword(24).length).toBe(24);
});

test("missing password requirements are listed in a fixed order", () => {
  expect(passwordMissing("")).toStrictEqual(["length"]);
  expect(passwordMissing("abcdefgh")).toStrictEqual([]);
  expect(passwordMissing("Aa1aaaaa")).toStrictEqual([]);
});

test("notification address: trims whitespace and lower-cases; checks only the basic shape and length limit", () => {
  expect(normalizeEmail("  You@Example.COM ")).toBe("you@example.com");
  for (const ok of ["a@b.co", "first.last+tag@sub.example.org", "x@y.z"]) expect(notifyProblem(ok), ok).toBe(null);
  for (const bad of ["", "you", "you@", "@example.com", "you@example", "a b@c.d", "a@b@c.d"])
    expect(notifyProblem(bad), bad).toBe("invalid");
  expect(notifyProblem(`${"a".repeat(250)}@b.co`)).toBe("too_long");
});
