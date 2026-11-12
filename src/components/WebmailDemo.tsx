"use client";

import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  InboxIcon,
  MailIcon,
  PaperclipIcon,
  PencilIcon,
  ReplyIcon,
  SearchIcon,
  SendIcon,
  StarIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { Copy, DemoLabelId, DemoMail } from "@/i18n/types";
import { cn } from "@/lib/utils";

export type WebmailDemoCopy = Pick<Copy["demo"], "label" | "ui" | "labels" | "mails" | "events">;

type Folder = "inbox" | "starred" | "sent" | "calendar";
type Category = "all" | DemoMail["category"];

interface Mail extends Omit<DemoMail, "labels" | "body"> {
  labels: readonly DemoLabelId[];
  body: readonly string[];
  /** Messages written in the demo: listed under Sent, addressed to `address`. */
  outgoing?: boolean;
}

/** Label colours, written out so Tailwind keeps the classes. */
const labelTone = {
  blue: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  green: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  orange: "bg-orange-500/12 text-orange-700 dark:text-orange-300",
} as const;
const labelDot = { blue: "bg-sky-500", green: "bg-emerald-500", orange: "bg-orange-500" } as const;

const CATEGORIES: readonly Category[] = ["all", "primary", "newsletters", "notifications"];
const categoryCopy = {
  all: "categoryAll",
  primary: "categoryPrimary",
  newsletters: "categoryNewsletters",
  notifications: "categoryNotifications",
} as const satisfies Record<Category, string>;
const DAYS: readonly DemoMail["day"][] = ["today", "yesterday", "earlier"];
/** The calendar shows 08:00 to 21:00, one row per hour; "today" is Thursday. */
const FIRST_HOUR = 8;
const LAST_HOUR = 21;
const HOUR_PX = 36;
const TODAY = 3;

/**
 * A small WebMail that runs in the visitor's browser with the sample content of the copy: folders, categories, labels, search, starring,
 * reading, replying and composing, and the week's calendar. Its state lives in this component only; nothing is stored or sent, and
 * "Send" files the message under Sent. On a phone the folders become a row of tabs and an open message takes the list's place.
 */
export function WebmailDemo({ copy }: { copy: WebmailDemoCopy }) {
  const t = copy.ui;
  const [mails, setMails] = useState<Mail[]>(() => copy.mails.map((mail) => ({ ...mail })));
  const [folder, setFolder] = useState<Folder>("inbox");
  const [label, setLabel] = useState<DemoLabelId | null>(null);
  const [category, setCategory] = useState<Category>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ to: string; subject: string; body: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [eventIndex, setEventIndex] = useState<number | null>(null);
  const searchId = useId();
  const toRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  /** Which field takes the focus once a draft opens: the recipient for a new message, the message for a reply. */
  const focusField = useRef<"to" | "body">("to");
  const draftOpen = draft !== null;

  useEffect(() => {
    if (draftOpen) (focusField.current === "to" ? toRef : bodyRef).current?.focus();
  }, [draftOpen]);

  // The notice after "Send" goes by itself; one that asks for a recipient stays while the draft is open.
  useEffect(() => {
    if (!notice || draft) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice, draft]);

  const labelsById = useMemo(() => new Map(copy.labels.map((entry) => [entry.id, entry])), [copy.labels]);
  const received = mails.filter((mail) => !mail.outgoing);
  const unreadIn = (list: Mail[]) => list.filter((mail) => mail.unread).length;

  const visible = useMemo(() => {
    const words = query.trim().toLowerCase();
    return mails.filter((mail) => {
      if (folder === "sent" ? !mail.outgoing : mail.outgoing) return false;
      if (folder === "starred" && !mail.starred) return false;
      if (label && !mail.labels.includes(label)) return false;
      if (folder === "inbox" && !label && category !== "all" && mail.category !== category) return false;
      if (!words) return true;
      return [mail.from, mail.address, mail.subject, ...mail.body].some((text) => text.toLowerCase().includes(words));
    });
  }, [mails, folder, label, category, query]);

  const open = mails.find((mail) => mail.id === openId) ?? null;
  const update = (id: string, change: Partial<Mail>) =>
    setMails((current) => current.map((mail) => (mail.id === id ? { ...mail, ...change } : mail)));

  const go = (next: Folder, nextLabel: DemoLabelId | null = null) => {
    setFolder(next);
    setLabel(nextLabel);
    setOpenId(null);
    setEventIndex(null);
  };
  const read = (mail: Mail) => {
    setOpenId(mail.id);
    if (mail.unread) update(mail.id, { unread: false });
  };
  const edit = (change: Partial<NonNullable<typeof draft>>) => {
    if (draft) setDraft({ ...draft, ...change });
    setNotice(null);
  };
  const send = (event: FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    if (!draft.to.trim()) {
      setNotice(t.needRecipient);
      return;
    }
    const mail: Mail = {
      id: `sent-${mails.length}`,
      from: t.me,
      address: draft.to.trim(),
      subject: draft.subject.trim() || "—",
      body: draft.body.split(/\n+/).filter(Boolean),
      time: t.now,
      day: "today",
      category: "primary",
      labels: [],
      unread: false,
      starred: false,
      attachment: "",
      outgoing: true,
    };
    setMails((current) => [mail, ...current]);
    setDraft(null);
    setNotice(t.sentNotice);
    go("sent");
  };

  const nav: { id: Folder; name: string; icon: ReactNode; count?: number }[] = [
    { id: "inbox", name: t.inbox, icon: <InboxIcon className="size-4" />, count: unreadIn(received) },
    { id: "starred", name: t.starred, icon: <StarIcon className="size-4" /> },
    { id: "sent", name: t.sent, icon: <SendIcon className="size-4" /> },
    { id: "calendar", name: t.calendar, icon: <CalendarDaysIcon className="size-4" /> },
  ];
  const title =
    folder === "calendar"
      ? t.calendar
      : label
        ? (labelsById.get(label)?.name ?? "")
        : nav.find((entry) => entry.id === folder)!.name;

  return (
    <div
      role="region"
      aria-label={copy.label}
      className="relative flex h-[640px] overflow-hidden rounded-panel border border-border bg-card text-sm max-md:h-[600px] max-md:flex-col"
    >
      {/* Folders: a column on wide screens, a row of tabs on a phone. */}
      <div
        className="flex w-52 shrink-0 flex-col gap-1 border-r border-border bg-surface p-3 max-md:w-auto max-md:flex-row max-md:items-center max-md:gap-1 max-md:overflow-x-auto max-md:border-r-0 max-md:border-b max-md:p-2"
        role="group"
        aria-label={t.inbox}
      >
        <button
          type="button"
          onClick={() => {
            setDraft({ to: "", subject: "", body: "" });
            focusField.current = "to";
            setNotice(null);
          }}
          className="mb-2 flex items-center justify-center gap-2 rounded-control bg-foreground px-3 py-2 font-medium text-background transition-opacity hover:opacity-90 max-md:mb-0 max-md:shrink-0"
        >
          <PencilIcon className="size-4" />
          {t.compose}
        </button>
        {nav.map((entry) => (
          <button
            type="button"
            key={entry.id}
            aria-current={folder === entry.id && !label ? "page" : undefined}
            onClick={() => go(entry.id)}
            className={cn(
              "flex items-center gap-2.5 rounded-control px-3 py-2 text-left transition-colors max-md:shrink-0",
              folder === entry.id && !label
                ? "bg-highlight font-medium text-highlight-foreground"
                : "text-muted-foreground hover:bg-background hover:text-foreground",
            )}
          >
            {entry.icon}
            <span className="flex-1">{entry.name}</span>
            {entry.count ? <span className="text-xs tabular-nums">{entry.count}</span> : null}
          </button>
        ))}
        <p className="mt-4 px-3 text-xs text-muted-foreground max-md:hidden">{t.labels}</p>
        {copy.labels.map((entry) => (
          <button
            type="button"
            key={entry.id}
            aria-current={label === entry.id ? "page" : undefined}
            onClick={() => go("inbox", entry.id)}
            className={cn(
              "flex items-center gap-2.5 rounded-control px-3 py-1.5 text-left transition-colors max-md:shrink-0",
              label === entry.id
                ? "bg-highlight font-medium text-highlight-foreground"
                : "text-muted-foreground hover:bg-background hover:text-foreground",
            )}
          >
            <span className={cn("size-2 rounded-full", labelDot[entry.color])} aria-hidden="true" />
            {entry.name}
          </button>
        ))}
      </div>

      {folder === "calendar" ? (
        <Calendar copy={copy} selected={eventIndex} onSelect={setEventIndex} />
      ) : (
        <>
          {/* The list. On a phone it gives way to an open message. */}
          <section
            className={cn(
              "flex w-[340px] shrink-0 flex-col border-r border-border max-lg:w-[300px] max-md:w-auto max-md:flex-1 max-md:border-r-0",
              open && "max-md:hidden",
            )}
            aria-label={title}
          >
            <div className="border-b border-border p-4 pb-3">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-heading text-xl font-semibold tracking-[-0.02em]">{title}</h3>
                {folder !== "sent" && (
                  <span className="text-xs text-muted-foreground">
                    {unreadIn(visible)} {t.unread}
                  </span>
                )}
              </div>
              <label htmlFor={searchId} className="sr-only">
                {t.search}
              </label>
              <div className="mt-3 flex items-center gap-2 rounded-control bg-surface px-3 py-2">
                <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <input
                  id={searchId}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t.search}
                  className="w-full min-w-0 bg-transparent outline-none placeholder:text-muted-foreground"
                />
              </div>
              {folder === "inbox" && !label && (
                <div className="mt-3 flex gap-1.5 overflow-x-auto" role="group" aria-label={t.inbox}>
                  {CATEGORIES.map((entry) => {
                    const count = entry === "all" ? 0 : unreadIn(received.filter((mail) => mail.category === entry));
                    return (
                      <button
                        type="button"
                        key={entry}
                        aria-pressed={category === entry}
                        onClick={() => setCategory(entry)}
                        className={cn(
                          "shrink-0 rounded-full border px-3 py-1 text-xs transition-colors",
                          category === entry
                            ? "border-foreground bg-foreground text-background"
                            : "border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {t[categoryCopy[entry]]}
                        {count ? <span className="ml-1.5 tabular-nums">{count}</span> : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {visible.length === 0 ? (
                <p className="p-6 text-center text-muted-foreground">
                  {folder === "sent" && !query ? t.emptySent : t.empty}
                </p>
              ) : (
                DAYS.map((day) => {
                  const group = visible.filter((mail) => mail.day === day);
                  if (group.length === 0) return null;
                  return (
                    <div key={day}>
                      <p className="px-4 pt-3 pb-1 text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
                        {t[day]}
                      </p>
                      <ul>
                        {group.map((mail) => (
                          <li key={mail.id} className="relative">
                            <button
                              type="button"
                              onClick={() => read(mail)}
                              aria-current={openId === mail.id ? "true" : undefined}
                              className={cn(
                                "flex w-full flex-col gap-0.5 border-l-2 px-4 py-2.5 pr-10 text-left transition-colors",
                                openId === mail.id
                                  ? "border-highlight bg-highlight/25"
                                  : mail.unread
                                    ? "border-highlight hover:bg-surface"
                                    : "border-transparent hover:bg-surface",
                              )}
                            >
                              <span className="flex items-center gap-2">
                                <span className={cn("truncate", mail.unread ? "font-semibold" : "font-medium")}>
                                  {mail.outgoing ? `${t.to} ${mail.address}` : mail.from}
                                </span>
                                {mail.labels.map((id) => {
                                  const entry = labelsById.get(id);
                                  return entry ? (
                                    <span
                                      key={id}
                                      className={cn("shrink-0 rounded-chip px-1.5 text-[11px]", labelTone[entry.color])}
                                    >
                                      {entry.name}
                                    </span>
                                  ) : null;
                                })}
                                <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
                                  {mail.time}
                                </span>
                              </span>
                              <span
                                className={cn("truncate", mail.unread ? "text-foreground" : "text-muted-foreground")}
                              >
                                {mail.subject}
                                {mail.attachment && (
                                  <PaperclipIcon
                                    className="ml-1 inline size-3.5 align-[-2px]"
                                    aria-label={t.attachment}
                                  />
                                )}
                              </span>
                              <span className="truncate text-xs text-muted-foreground">{mail.body.join(" ")}</span>
                            </button>
                            {!mail.outgoing && (
                              <StarButton
                                starred={mail.starred}
                                copy={t}
                                className="absolute top-2 right-2"
                                onClick={() => update(mail.id, { starred: !mail.starred })}
                              />
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* The reading pane. */}
          <section
            className={cn("flex min-w-0 flex-1 flex-col", !open && "max-md:hidden")}
            aria-label={open?.subject ?? t.pick}
          >
            {open ? (
              <>
                <div className="flex items-center gap-1 border-b border-border px-3 py-2">
                  <IconButton label={t.back} onClick={() => setOpenId(null)} className="md:hidden">
                    <ArrowLeftIcon className="size-4" />
                  </IconButton>
                  {!open.outgoing && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setDraft({
                            to: open.address,
                            subject: open.subject.startsWith(t.replyPrefix)
                              ? open.subject
                              : `${t.replyPrefix}${open.subject}`,
                            body: "",
                          });
                          focusField.current = "body";
                          setNotice(null);
                        }}
                        className="flex items-center gap-1.5 rounded-control bg-foreground px-3 py-1.5 font-medium text-background hover:opacity-90"
                      >
                        <ReplyIcon className="size-4" />
                        {t.reply}
                      </button>
                      <StarButton
                        starred={open.starred}
                        copy={t}
                        onClick={() => update(open.id, { starred: !open.starred })}
                      />
                      <IconButton
                        label={t.markUnread}
                        onClick={() => {
                          update(open.id, { unread: true });
                          setOpenId(null);
                        }}
                      >
                        <MailIcon className="size-4" />
                      </IconButton>
                    </>
                  )}
                  <IconButton label={t.close} onClick={() => setOpenId(null)} className="ml-auto max-md:hidden">
                    <XIcon className="size-4" />
                  </IconButton>
                </div>
                <article className="flex-1 overflow-y-auto p-6 max-md:p-4">
                  <h3 className="font-heading text-2xl/[1.3] font-semibold tracking-[-0.02em]">{open.subject}</h3>
                  {open.labels.length > 0 && (
                    <div className="mt-2 flex gap-1.5">
                      {open.labels.map((id) => {
                        const entry = labelsById.get(id);
                        return entry ? (
                          <span key={id} className={cn("rounded-chip px-1.5 text-xs", labelTone[entry.color])}>
                            {entry.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                  <p className="mt-4 flex flex-wrap items-baseline gap-x-2 text-muted-foreground">
                    <span className="font-medium text-foreground">{open.outgoing ? t.me : open.from}</span>
                    <span>{open.outgoing ? `${t.to} ${open.address}` : open.address}</span>
                    <span className="ml-auto tabular-nums">{open.time}</span>
                  </p>
                  <div className="mt-5 space-y-3 rounded-panel border border-border bg-background p-5 text-[15px]/[1.7]">
                    {open.body.length ? open.body.map((paragraph, index) => <p key={index}>{paragraph}</p>) : <p>—</p>}
                  </div>
                  {open.attachment && (
                    <p className="mt-4 inline-flex items-center gap-2 rounded-control border border-border px-3 py-2 text-muted-foreground">
                      <PaperclipIcon className="size-4" aria-hidden="true" />
                      <span className="sr-only">{t.attachment}: </span>
                      {open.attachment}
                    </p>
                  )}
                </article>
              </>
            ) : (
              <div className="m-auto flex max-w-60 flex-col items-center gap-3 p-6 text-center text-muted-foreground">
                <MailIcon className="size-6" aria-hidden="true" />
                {t.pick}
              </div>
            )}
          </section>
        </>
      )}

      {draft && (
        <form
          onSubmit={send}
          aria-label={t.compose}
          className="absolute right-4 bottom-4 z-10 flex w-[min(440px,calc(100%-2rem))] flex-col overflow-hidden rounded-panel border border-border bg-card shadow-lg max-md:inset-x-2 max-md:bottom-2 max-md:w-auto"
        >
          <div className="flex items-center justify-between bg-foreground px-4 py-2 text-background">
            <span className="font-medium">{draft.subject || t.compose}</span>
            <button
              type="button"
              aria-label={t.close}
              onClick={() => setDraft(null)}
              className="rounded-control p-1 hover:opacity-80"
            >
              <XIcon className="size-4" />
            </button>
          </div>
          <DraftField label={t.to}>
            <input
              ref={toRef}
              type="email"
              autoComplete="off"
              value={draft.to}
              onChange={(event) => edit({ to: event.target.value })}
              className="w-full bg-transparent outline-none"
            />
          </DraftField>
          <DraftField label={t.subject}>
            <input
              value={draft.subject}
              onChange={(event) => edit({ subject: event.target.value })}
              className="w-full bg-transparent outline-none"
            />
          </DraftField>
          <label className="block px-4 py-2">
            <span className="sr-only">{t.body}</span>
            <textarea
              ref={bodyRef}
              rows={5}
              value={draft.body}
              onChange={(event) => edit({ body: event.target.value })}
              className="w-full resize-none bg-transparent outline-none"
            />
          </label>
          <div className="flex items-center gap-3 border-t border-border px-4 py-2">
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-control bg-foreground px-3 py-1.5 font-medium text-background hover:opacity-90"
            >
              <SendIcon className="size-4" />
              {t.send}
            </button>
            {notice && (
              <span className="text-xs text-muted-foreground" role="status">
                {notice}
              </span>
            )}
          </div>
        </form>
      )}
      {!draft && notice && (
        <p
          role="status"
          className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-control bg-foreground px-4 py-2 text-background shadow-lg max-md:w-[calc(100%-1rem)] max-md:text-center"
        >
          {notice}
          <button type="button" aria-label={t.close} onClick={() => setNotice(null)} className="ml-3 align-middle">
            <XIcon className="inline size-3.5" />
          </button>
        </p>
      )}
    </div>
  );
}

function DraftField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center gap-3 border-b border-border px-4 py-2">
      <span className="w-14 shrink-0 text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function IconButton({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "grid size-8 place-items-center rounded-control text-muted-foreground hover:bg-surface hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

function StarButton({
  starred,
  copy,
  onClick,
  className,
}: {
  starred: boolean;
  copy: WebmailDemoCopy["ui"];
  onClick: () => void;
  className?: string;
}) {
  return (
    <IconButton label={starred ? copy.unstar : copy.star} onClick={onClick} className={className}>
      <StarIcon className={cn("size-4", starred && "fill-highlight text-amber-500")} />
    </IconButton>
  );
}

/** The week's calendar: one column per day, an hour per row; choosing an event shows its details above the grid. */
function Calendar({
  copy,
  selected,
  onSelect,
}: {
  copy: WebmailDemoCopy;
  selected: number | null;
  onSelect: (index: number | null) => void;
}) {
  const t = copy.ui;
  const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, index) => FIRST_HOUR + index);
  const chosen = selected === null ? null : copy.events[selected];
  const clock = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

  return (
    <section className="flex min-w-0 flex-1 flex-col" aria-label={t.calendar}>
      <div className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-4 py-2">
        <h3 className="font-heading text-xl font-semibold tracking-[-0.02em]">{t.thisWeek}</h3>
        {chosen && (
          <p className="text-muted-foreground" role="status">
            <span className="font-medium text-foreground">{chosen.title}</span> · {t.weekdays[chosen.day]}{" "}
            {clock(chosen.start)}–{clock(chosen.end)}
            {chosen.location && ` · ${chosen.location}`}
          </p>
        )}
      </div>
      <div className="flex-1 overflow-auto">
        <div className="grid min-w-[560px] grid-cols-[3rem_repeat(7,minmax(0,1fr))]">
          <div className="sticky top-0 z-1 bg-card" />
          {t.weekdays.map((day, index) => (
            <div
              key={day}
              className="sticky top-0 z-1 border-b border-l border-border bg-card py-2 text-center text-xs text-muted-foreground"
            >
              <span
                className={cn(
                  "inline-block rounded-full px-2 py-0.5",
                  index === TODAY && "bg-highlight font-medium text-highlight-foreground",
                )}
              >
                {day}
              </span>
            </div>
          ))}
          <div>
            {hours.map((hour) => (
              <div key={hour} className="pr-1 text-right text-[11px] text-muted-foreground" style={{ height: HOUR_PX }}>
                {clock(hour)}
              </div>
            ))}
          </div>
          {t.weekdays.map((day, dayIndex) => (
            <div key={day} className="relative border-l border-border">
              {hours.map((hour) => (
                <div key={hour} className="border-b border-border/60" style={{ height: HOUR_PX }} />
              ))}
              {copy.events.map((event, index) =>
                event.day === dayIndex ? (
                  <button
                    type="button"
                    key={index}
                    aria-pressed={selected === index}
                    onClick={() => onSelect(selected === index ? null : index)}
                    className={cn(
                      "absolute inset-x-1 overflow-hidden rounded-chip border-l-2 border-sky-500 px-1.5 py-1 text-left text-[11px]/[1.3] transition-colors",
                      selected === index ? "bg-sky-500/30" : "bg-sky-500/12 hover:bg-sky-500/20",
                    )}
                    style={{
                      top: (event.start - FIRST_HOUR) * HOUR_PX + 1,
                      height: (event.end - event.start) * HOUR_PX - 2,
                    }}
                  >
                    <span className="block truncate font-medium">{event.title}</span>
                    <span className="block text-muted-foreground tabular-nums">{clock(event.start)}</span>
                  </button>
                ) : null,
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
