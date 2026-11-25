/**
 * The comparison's facts that do not depend on the language: each service's mark in each marked row, and the provider pages that
 * back them. Every cell of every other service comes from one of these pages, read on the date in `reviewed`; a cell no page
 * backs says so in its words ("not built in") rather than guessing. When a provider changes a plan, re-read its pages, change
 * the mark here and the words in en.ts and zh.ts together, and move `reviewed` in both languages.
 *
 * Abnormal Mail's column comes from abnormalhq/mail: docs/webmail-encryption.md, webmail-masked-addresses.md,
 * large-attachments.md, mail-import-export.md, ios/README.md and android/README.md (the phone apps are not in the stores yet),
 * and from the live catalog for storage, the trial and own domains (src/lib/compare.ts).
 */
import type { CompareMark, CompareSource, MarkedRow, Rival } from "./types.ts";

export const compareReviewed = "2026-11-25";

export const rivalMarks: Record<Rival, Record<MarkedRow, CompareMark>> = {
  gmail: {
    adFree: "no",
    ownDomain: "partial",
    masked: "no",
    e2e: "partial",
    imap: "yes",
    sync: "yes",
    phone: "yes",
    desktop: "no",
  },
  outlook: {
    adFree: "no",
    ownDomain: "partial",
    masked: "no",
    e2e: "no",
    imap: "yes",
    sync: "yes",
    phone: "yes",
    desktop: "yes",
  },
  icloud: {
    adFree: "yes",
    ownDomain: "partial",
    masked: "partial",
    e2e: "no",
    imap: "yes",
    sync: "yes",
    phone: "partial",
    desktop: "partial",
  },
  proton: {
    adFree: "yes",
    ownDomain: "partial",
    masked: "yes",
    e2e: "yes",
    imap: "partial",
    sync: "partial",
    phone: "yes",
    desktop: "partial",
  },
  fastmail: {
    adFree: "yes",
    ownDomain: "yes",
    masked: "yes",
    e2e: "no",
    imap: "yes",
    sync: "yes",
    phone: "yes",
    desktop: "yes",
  },
};

/** Abnormal Mail's marks, except own domains, which follow the catalog. */
export const ourMarks: Omit<Record<MarkedRow, CompareMark>, "ownDomain"> = {
  adFree: "yes",
  masked: "yes",
  e2e: "yes",
  imap: "yes",
  sync: "yes",
  phone: "partial",
  desktop: "yes",
};

export const rivalSources: Record<Rival, readonly CompareSource[]> = {
  gmail: [
    { url: "https://support.google.com/mail/answer/6558", rows: ["storage", "free"] },
    { url: "https://support.google.com/mail/answer/6603", rows: ["adFree"] },
    { url: "https://workspace.google.com/pricing", rows: ["ownDomain"] },
    { url: "https://support.google.com/mail/answer/13317990", rows: ["e2e"] },
    { url: "https://support.google.com/mail/answer/7126229", rows: ["imap"] },
    { url: "https://developers.google.com/workspace/calendar/caldav/v2/guide", rows: ["sync"] },
    { url: "https://developers.google.com/people/carddav", rows: ["sync"] },
    { url: "https://support.google.com/mail/answer/16604719", rows: ["phone"] },
    { url: "https://support.google.com/mail/answer/6584", rows: ["attachments"] },
  ],
  outlook: [
    {
      url: "https://support.microsoft.com/office/storage-limits-in-outlook-com-7ac99134-69e5-4619-ac0b-2d313bba5e9e",
      rows: ["storage", "free"],
    },
    { url: "https://support.microsoft.com/outlook/about-ads-in-outlook", rows: ["adFree", "phone", "desktop"] },
    {
      url: "https://support.microsoft.com/outlook/premium-features-in-outlook-com-for-microsoft-365-subscribers",
      rows: ["ownDomain", "e2e"],
    },
    {
      url: "https://support.microsoft.com/office/pop-imap-and-smtp-settings-for-outlook-com-d088b986-291d-42b8-9564-9c414e2aa040",
      rows: ["imap"],
    },
    {
      url: "https://support.microsoft.com/outlook/can-t-sync-calendar-and-contacts-with-my-phone-or-tablet",
      rows: ["sync"],
    },
    {
      url: "https://support.microsoft.com/office/send-large-files-with-outlook-8c698842-b462-4a4c-8d53-5c5dd04f77ef",
      rows: ["attachments"],
    },
  ],
  icloud: [
    { url: "https://www.apple.com/icloud/", rows: ["storage", "free", "ownDomain", "masked", "phone", "desktop"] },
    { url: "https://www.apple.com/legal/privacy/data/en/apple-advertising/", rows: ["adFree"] },
    { url: "https://support.apple.com/102651", rows: ["e2e"] },
    { url: "https://support.apple.com/102525", rows: ["imap"] },
    { url: "https://support.apple.com/102654", rows: ["sync"] },
    { url: "https://support.apple.com/102198", rows: ["attachments"] },
  ],
  proton: [
    {
      url: "https://proton.me/support/proton-plans",
      rows: ["storage", "free", "adFree", "ownDomain", "masked", "e2e", "imap"],
    },
    { url: "https://proton.me/support/share-calendar-via-link", rows: ["sync"] },
    { url: "https://proton.me/support/mail-desktop-app", rows: ["phone", "desktop"] },
    { url: "https://proton.me/support/attaching-multiple-documents-to-a-message", rows: ["attachments"] },
  ],
  fastmail: [
    { url: "https://www.fastmail.com/pricing/", rows: ["storage", "free", "ownDomain", "masked", "phone", "desktop"] },
    { url: "https://www.fastmail.com/", rows: ["adFree"] },
    { url: "https://www.fastmail.com/features/security/", rows: ["e2e"] },
    { url: "https://www.fastmail.help/hc/en-us/articles/1500000278342", rows: ["imap", "sync"] },
    { url: "https://www.fastmail.help/hc/en-us/articles/360060591253", rows: ["attachments"] },
  ],
};
