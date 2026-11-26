import type { ReactNode } from "react";
import { BrandArrow } from "@/components/ui/brand-mark";
import { Container } from "@/components/ui/container";
import { Eyebrow, SectionTitle, sectionSpaceClassName } from "@/components/ui/section-heading";
import { TextLink } from "@/components/ui/text-link";
import type { Lang } from "@/data/site";
import { getCopy } from "@/i18n";
import type { Copy, IconName } from "@/i18n/types";
import { reveal } from "@/lib/reveal";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";
import { MaskedAddressSample } from "./MaskedAddressSample";

type Samples = Copy["features"]["samples"];

/** The working hours the calendar sample shows; its evening events fall outside and are left out. */
const firstHour = 9;
const lastHour = 18;

/** Supporting-palette tint per day column so the week view reads as curated rather than monochrome gray. */
const DAY_EVENT_TONES = [
  "border-l-2 border-sage bg-sage-soft text-sage-ink",
  "border-l-2 border-indigo bg-indigo-soft text-indigo-ink",
  "border-l-2 border-foreground/40 bg-surface text-foreground",
  "border-l-2 border-clay bg-clay-soft text-clay-ink",
  "border-l-2 border-foreground/40 bg-surface text-foreground",
] as const;

/**
 * The calendar card's visual: a working week drawn cleanly in markup with supporting hues for ordinary events and
 * one highlighter event tied to the invitation answered below it.
 */
function weekSample(s: Samples): ReactNode {
  const span = lastHour - firstHour;
  const [invite, accept, decline] = s.invite;
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-5 gap-2">
        {s.weekdays.slice(0, 5).map((weekday, day) => (
          <div className="min-w-0" key={weekday}>
            <p
              className={cn(
                "mb-2 text-center text-xs",
                day === 2 ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
            >
              {weekday}
            </p>
            <div
              className={cn(
                "relative h-56 rounded-mark border bg-background/60 max-sm:h-44",
                day === 2 ? "border-border-strong" : "border-border",
              )}
            >
              {s.events
                .filter((event) => event.day === day && event.end <= lastHour)
                .map((event) => (
                  <span
                    key={event.title}
                    className={cn(
                      "absolute inset-x-1 overflow-hidden rounded-chip px-1.5 py-0.5 text-2xs/[1.35]",
                      event.location
                        ? "bg-highlight font-medium text-highlight-foreground"
                        : (DAY_EVENT_TONES[day] ?? DAY_EVENT_TONES[0]),
                    )}
                    style={{
                      top: `${((event.start - firstHour) / span) * 100}%`,
                      height: `calc(${((event.end - event.start) / span) * 100}% - 2px)`,
                    }}
                  >
                    <span className="block truncate">{event.title}</span>
                  </span>
                ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border pt-4 text-sm">
        <span className="min-w-0 text-foreground">{invite}</span>
        <span className="flex gap-1.5">
          <span className="rounded-control bg-foreground px-3 py-1 text-xs font-medium text-background">{accept}</span>
          <span className="rounded-control border border-border-strong px-3 py-1 text-xs text-muted-foreground">
            {decline}
          </span>
        </span>
      </div>
    </div>
  );
}

/** Micro-UI specimens for the everyday workflow items on warm paper. */
function workflowSample(icon: IconName, s: Samples): ReactNode {
  switch (icon) {
    case "inbox":
      return (
        <div className="flex flex-wrap gap-1.5">
          {s.inboxTabs.map((tab, index) => (
            <span
              key={tab}
              className={
                index === 0
                  ? "inline-flex items-center gap-2 rounded-control bg-foreground px-3 py-1.5 text-xs font-medium text-background"
                  : "inline-flex items-center gap-2 rounded-control border border-border-strong px-3 py-1.5 text-xs text-muted-foreground"
              }
            >
              {tab}
              <span className="font-mono text-2xs tabular-nums">{[3, 12, 5][index]}</span>
            </span>
          ))}
        </div>
      );
    case "undo":
      return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="ink inline-flex items-center gap-4 rounded-mark bg-ink px-3.5 py-2 text-xs text-foreground">
            {s.sent}
            <span className="font-semibold text-highlight underline underline-offset-4">{s.undo}</span>
          </span>
          <span className="font-mono text-xs text-muted-foreground">{s.scheduled}</span>
        </div>
      );
    case "search":
      return (
        <div className="flex items-center justify-between gap-3 rounded-mark border border-border-strong bg-popover px-3 py-2 text-xs">
          <code className="min-w-0 truncate font-mono text-foreground" lang="en">
            from:<span className="font-semibold">alice</span> has:attachment
          </code>
          <span className="shrink-0 rounded-chip bg-indigo-soft px-2 py-0.5 font-mono text-2xs text-indigo-ink">
            {s.searchHits}
          </span>
        </div>
      );
    case "import":
      return (
        <div className="grid gap-2 font-mono text-xs text-muted-foreground" lang="en">
          <span className="flex justify-between gap-4">
            <span>imap.gmail.com</span>
            <span className="tabular-nums">12,480 / 18,200</span>
          </span>
          <span className="block h-1.5 rounded-full bg-surface">
            <span className="block h-1.5 w-[68%] rounded-full bg-sage" />
          </span>
        </div>
      );
    case "filter":
      return (
        <p className="rounded-mark border border-border bg-popover px-3 py-2 text-xs text-muted-foreground">{s.rule}</p>
      );
    case "spark":
      return (
        <div className="flex flex-wrap gap-1.5">
          {s.ai.map((action) => (
            <span
              key={action}
              className="inline-flex items-center gap-1.5 rounded-control border border-border bg-popover px-2.5 py-1.5 text-xs text-foreground"
            >
              <Icon name="spark" className="size-3 text-indigo" />
              {action}
            </span>
          ))}
        </div>
      );
    case "install":
      return (
        <span className="inline-flex items-center gap-2.5 rounded-mark border border-border bg-popover px-3 py-2 text-xs text-foreground">
          <Icon name="install" className="size-3.5 text-muted-foreground" />
          {s.install}
        </span>
      );
    default:
      return null;
  }
}

/** Specimens inside the permanent deep-ink privacy chapter. */
function privacySample(icon: IconName, s: Samples): ReactNode {
  switch (icon) {
    case "lock":
      return (
        <div className="flex items-center justify-between gap-3 rounded-mark border border-border bg-background px-3 py-2.5 text-xs">
          <span className="inline-flex items-center gap-2 text-sage">
            <Icon name="lock" className="size-3.5 shrink-0" />
            {s.encrypted}
          </span>
          <span className="shrink-0 font-mono text-2xs text-muted-foreground" lang="en">
            {s.encryptionSpec}
          </span>
        </div>
      );
    case "mask":
      return <MaskedAddressSample address={s.masked[0]} turnOff={s.masked[1]} restore={s.maskedRestore} />;
    case "key":
      return (
        <div className="flex items-center justify-between gap-3 rounded-mark border border-border bg-background px-3 py-2">
          <span className="font-mono text-xl tracking-[0.18em] text-foreground tabular-nums" aria-hidden="true">
            482 913
          </span>
          <span className="shrink-0 rounded-chip bg-indigo-soft px-2 py-0.5 text-2xs font-medium text-indigo-ink">
            {s.passkeyReady}
          </span>
        </div>
      );
    case "alert":
      return (
        <p className="flex gap-2.5 rounded-mark border border-border bg-background px-3 py-2.5 text-xs/prose text-foreground">
          <Icon name="alert" className="mt-0.5 size-3.5 shrink-0 text-warning" />
          {s.suspicious}
        </p>
      );
    default:
      return null;
  }
}

/**
 * "What's inside" Mail, paced as two contrasting magazine chapters instead of one monotonous wall of tiles:
 * Chapter 01 on warm paper pairs core workflow (split inbox, undo/schedule, search) beside a spacious calendar
 * specimen, followed by an even four-column utility row. Chapter 02 switches to the permanent ink band (.ink) for
 * privacy & security (OpenPGP, interactive masked addresses, passkeys, phishing warnings), then returns to paper for
 * the magazine index and platforms.
 */
export function Features({ lang }: { lang: Lang }) {
  const { t, links, path } = getCopy(lang);
  const f = t.features;
  const tile = (icon: IconName) => f.items.find((item) => item.icon === icon)!;

  const coreLeft: readonly IconName[] = ["inbox", "undo", "search"];
  const calendarItem = tile("calendar");
  const utilityRow: readonly IconName[] = ["spark", "import", "filter", "install"];
  const privacyCards: readonly { icon: IconName; kicker: string; accent: string }[] = [
    { icon: "lock", kicker: "OPENPGP", accent: "text-sage" },
    { icon: "mask", kicker: "MASKED ALIASES", accent: "text-clay" },
    { icon: "key", kicker: "PASSKEYS & 2FA", accent: "text-indigo" },
    { icon: "alert", kicker: "PHISHING GUARD", accent: "text-warning" },
  ];

  return (
    <section className="border-t border-border" id="mail" aria-labelledby="features-title">
      {/* Chapter 01: Warm paper — calm everyday mail workflow. "features" keeps legacy anchor links working. */}
      <Container className={sectionSpaceClassName} id="features">
        <div
          className="mb-10 flex items-end justify-between gap-8 max-lg:gap-4 max-md:mb-7 max-md:flex-col max-md:items-start"
          {...reveal()}
        >
          <div>
            <Eyebrow lang="en" className="text-clay">
              {f.eyebrow}
            </Eyebrow>
            <SectionTitle id="features-title">{f.title}</SectionTitle>
          </div>
          <p className="max-w-120 pb-0.75 text-md/prose text-muted-foreground md:text-right">
            {f.intro[0]}
            {t.space}
            <br className="hidden md:block" />
            {f.intro[1]}
          </p>
        </div>

        {/* Asymmetric 5:7 editorial spread — eliminates hollow vertical gaps next to the calendar view. */}
        <div className="grid items-stretch gap-8 lg:grid-cols-12 lg:gap-10" {...reveal(1)}>
          <ul role="list" className="flex flex-col justify-between gap-7 lg:col-span-5">
            {coreLeft.map((key, index) => {
              const item = tile(key);
              return (
                <li key={key} className="flex flex-col gap-3.5 border-t border-border pt-4">
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="text-lg/[1.4] font-semibold tracking-title text-foreground">{item.title}</h3>
                    <span className="font-mono text-xs text-muted-foreground" aria-hidden="true">
                      0{index + 1}
                    </span>
                  </div>
                  <p className="text-base/prose text-muted-foreground">{item.description}</p>
                  <div aria-hidden="true">{workflowSample(key, f.samples)}</div>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-col justify-between gap-6 rounded-panel border border-border-strong bg-popover p-6 shadow-sheet lg:col-span-7">
            <div>
              <span
                className="inline-block rounded-chip bg-sage-soft px-2 py-0.5 font-mono text-2xs font-medium text-sage-ink"
                lang="en"
              >
                CalDAV / CardDAV
              </span>
              <h3 className="mt-3 text-xl/[1.35] font-semibold tracking-title text-foreground">{calendarItem.title}</h3>
              <p className="mt-1.5 max-w-xl text-base/prose text-muted-foreground">{calendarItem.description}</p>
            </div>
            <div aria-hidden="true">{weekSample(f.samples)}</div>
          </div>
        </div>

        {/* Even four-column utility row */}
        <ul role="list" className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4" {...reveal(2)}>
          {utilityRow.map((key) => {
            const item = tile(key);
            return (
              <li key={key} className="flex min-w-0 flex-col gap-4 border-t border-border pt-5">
                <div>
                  <h3 className="text-lg/[1.4] font-semibold tracking-title text-foreground">{item.title}</h3>
                  <p className="mt-1.5 text-base/prose text-muted-foreground">{item.description}</p>
                </div>
                <div className="mt-auto" aria-hidden="true">
                  {workflowSample(key, f.samples)}
                </div>
              </li>
            );
          })}
        </ul>
      </Container>

      {/* Chapter 02: Intentional deep-ink editorial band for privacy & security — breaks up long-page monotony. */}
      <div className="ink border-y border-border bg-background text-foreground" id="privacy-chapter">
        <Container className={sectionSpaceClassName}>
          <div
            className="mb-10 flex items-end justify-between gap-8 max-lg:gap-4 max-md:mb-7 max-md:flex-col max-md:items-start"
            {...reveal()}
          >
            <div>
              <Eyebrow lang="en" className="text-sage">
                {f.privacy.eyebrow}
              </Eyebrow>
              <SectionTitle>{f.privacy.title}</SectionTitle>
            </div>
            <p className="max-w-120 pb-0.75 text-md/prose text-muted-foreground md:text-right">{f.privacy.intro}</p>
          </div>

          <ul role="list" className="grid gap-5 md:grid-cols-2 lg:grid-cols-4" {...reveal(1)}>
            {privacyCards.map(({ icon, kicker, accent }) => {
              const item = tile(icon);
              return (
                <li
                  key={icon}
                  className="flex min-w-0 flex-col justify-between gap-5 rounded-panel border border-border bg-surface/45 p-5"
                >
                  <div>
                    <span className={cn("font-mono text-2xs tracking-caps uppercase", accent)} lang="en">
                      {kicker}
                    </span>
                    <h3 className="mt-2.5 text-lg/[1.4] font-semibold tracking-title text-foreground">{item.title}</h3>
                    <p className="mt-2 text-sm/prose text-muted-foreground">{item.description}</p>
                  </div>
                  <div className="mt-auto">{privacySample(icon, f.samples)}</div>
                </li>
              );
            })}
          </ul>
        </Container>
      </div>

      {/* Back to warm paper: magazine index + platforms */}
      <Container className="py-14 md:py-16">
        <div {...reveal()}>
          <h3
            className="flex items-center gap-4 text-sm/body font-medium text-muted-foreground"
            id="features-more-title"
          >
            {f.more.title}
            <span className="h-px flex-1 bg-border" aria-hidden="true"></span>
          </h3>
          {/* A plain list set in columns, each line on a hairline like the index of a magazine: no chips, no ticks. */}
          <ul
            role="list"
            className="mt-6 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-4"
            aria-labelledby="features-more-title"
          >
            {f.more.items.map((item) => (
              <li className="border-b border-border py-3 text-base/body" key={item}>
                {item}
              </li>
            ))}
          </ul>
          <TextLink className="mt-6" href={path("/compare/")}>
            {f.compareLink} <Icon name="arrow" className="size-3.5" />
          </TextLink>
        </div>

        <div className="mt-14 max-md:mt-11">
          <h3 className="flex items-center gap-4 text-sm/body font-medium text-muted-foreground" {...reveal()}>
            {f.platformsTitle}
            <span className="h-px flex-1 bg-border" aria-hidden="true"></span>
          </h3>
          <ul className="mt-7 grid gap-8 md:grid-cols-3 md:gap-10">
            {f.platforms.map((platform, index) => (
              <li className="border-t border-border pt-5" key={platform.name} {...reveal(index)}>
                <div className="min-w-0">
                  <p className="text-lg leading-[1.4] font-semibold tracking-title">{platform.name}</p>
                  <p className="mt-1.5 text-base/prose text-muted-foreground">{platform.description}</p>
                  <TextLink className="mt-3" href={platform.link ? links[platform.link] : path(platform.path ?? "/")}>
                    {platform.action}{" "}
                    {platform.link === "webmail" ? (
                      <BrandArrow className="size-3" />
                    ) : (
                      <Icon name="arrow" className="size-3.5" />
                    )}
                  </TextLink>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
