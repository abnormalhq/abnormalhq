import type { ReactNode } from "react";
import { Bento, BentoDescription, BentoTile, BentoTitle, BentoVisual } from "@/components/ui/bento";
import { Container } from "@/components/ui/container";
import { IconTile } from "@/components/ui/icon-tile";
import { Eyebrow, HeadingMark, SectionTitle, sectionSpaceClassName } from "@/components/ui/section-heading";
import { TextLink } from "@/components/ui/text-link";
import type { Lang } from "@/data/site";
import { getCopy } from "@/i18n";
import type { Copy, IconName } from "@/i18n/types";
import { reveal } from "@/lib/reveal";
import { AddressCheck } from "./AddressCheck";
import { Icon } from "./Icon";
import { ServiceStatus } from "./ServiceStatus";

type Samples = Copy["features"]["samples"];

/** The working hours the calendar sample shows; its evening events fall outside and are left out. */
const firstHour = 9;
const lastHour = 18;

/**
 * The calendar tile's picture: a working week drawn as a small week view, with one event standing out as the
 * invitation answered below it. It is drawn rather than a screenshot, so it stays legible at tile size and follows the theme.
 */
function weekSample(s: Samples): ReactNode {
  const span = lastHour - firstHour;
  const [invite, accept, decline] = s.invite;
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-5 gap-1.5">
        {s.weekdays.slice(0, 5).map((weekday, day) => (
          <div className="min-w-0" key={weekday}>
            <p className="mb-1.5 text-center text-xs text-muted-foreground">{weekday}</p>
            <div className="relative h-52 rounded-mark border border-border bg-background/40 max-sm:h-44">
              {s.events
                .filter((event) => event.day === day && event.end <= lastHour)
                .map((event) => (
                  <span
                    key={event.title}
                    className={
                      event.location
                        ? "absolute inset-x-1 overflow-hidden rounded-chip bg-highlight px-1.5 py-px text-2xs/[1.35] text-highlight-foreground"
                        : "absolute inset-x-1 overflow-hidden rounded-chip border-l-2 border-foreground/40 bg-muted px-1.5 py-px text-2xs/[1.35] text-foreground"
                    }
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
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-mark border border-border px-3 py-2 text-sm">
        <span className="min-w-0">{invite}</span>
        <span className="flex gap-1.5">
          <span className="rounded-control bg-foreground px-2.5 py-1 text-xs text-background">{accept}</span>
          <span className="rounded-control border border-border px-2.5 py-1 text-xs text-muted-foreground">
            {decline}
          </span>
        </span>
      </div>
    </div>
  );
}

/**
 * The small picture of the product at the foot of each feature tile, drawn in markup in the page's language. Each one
 * only illustrates its tile's description, so the caller hides it from assistive technology.
 */
function sample(icon: IconName, s: Samples): ReactNode {
  switch (icon) {
    case "inbox":
      return (
        <div className="flex flex-wrap gap-1.5">
          {s.inboxTabs.map((tab, index) => (
            <span
              key={tab}
              className={
                index === 0
                  ? "inline-flex items-center gap-2 rounded-control bg-foreground px-3 py-1.5 text-sm text-background"
                  : "inline-flex items-center gap-2 rounded-control border border-border px-3 py-1.5 text-sm text-muted-foreground"
              }
            >
              {tab}
              <span className="font-mono text-xs">{[3, 12, 5][index]}</span>
            </span>
          ))}
        </div>
      );
    case "undo":
      return (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <span className="inline-flex items-center gap-5 rounded-mark bg-foreground px-4 py-2.5 text-sm text-background">
            {s.sent}
            <span className="font-semibold underline underline-offset-4">{s.undo}</span>
          </span>
          <span className="font-mono text-sm text-muted-foreground">{s.scheduled}</span>
        </div>
      );
    case "search":
      return (
        <code className="block rounded-mark border border-input px-3 py-2.5 font-mono text-sm" lang="en">
          from:<span className="text-signal">alice</span> has:attachment
        </code>
      );
    case "alert":
      return (
        <p className="flex gap-2.5 rounded-mark border border-border bg-highlight-muted px-3.5 py-3 text-sm/prose text-foreground">
          <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
          {s.suspicious}
        </p>
      );
    case "import":
      return (
        <div className="grid gap-2 font-mono text-xs text-muted-foreground" lang="en">
          <span className="flex justify-between gap-4">
            <span>imap.gmail.com</span>
            <span>12,480 / 18,200</span>
          </span>
          <span className="block h-1.5 rounded-full bg-border">
            <span className="block h-1.5 w-[68%] rounded-full bg-signal" />
          </span>
        </div>
      );
    case "key":
      return <span className="font-mono text-3xl tracking-[0.2em]">482 913</span>;
    case "filter":
      return <p className="rounded-mark border border-border px-3 py-2.5 text-sm text-muted-foreground">{s.rule}</p>;
    case "lock":
      return (
        <span className="inline-flex items-center gap-2.5 rounded-mark border border-border px-3 py-2 text-sm">
          <Icon name="lock" className="size-4" />
          {s.encrypted}
        </span>
      );
    case "mask":
      return (
        <div className="flex items-center justify-between gap-3 rounded-mark border border-border px-3 py-2.5 text-sm">
          <code className="min-w-0 truncate font-mono text-xs" lang="en">
            {s.masked[0]}
          </code>
          <span className="shrink-0 text-muted-foreground underline underline-offset-4">{s.masked[1]}</span>
        </div>
      );
    case "spark":
      return (
        <div className="flex flex-wrap gap-1.5">
          {s.ai.map((action) => (
            <span
              key={action}
              className="inline-flex items-center gap-1.5 rounded-control border border-border px-3 py-1.5 text-sm text-muted-foreground"
            >
              <Icon name="spark" className="size-3.5 text-foreground" />
              {action}
            </span>
          ))}
        </div>
      );
    case "install":
      return (
        <span className="inline-flex items-center gap-3 rounded-mark border border-border px-3 py-2 text-sm">
          <Icon name="install" className="size-4" />
          {s.install}
        </span>
      );
    default:
      return null;
  }
}

/**
 * "What's inside" Mail, as a wall of tiles: the address check leads, each feature carries a small picture of itself,
 * and the calendar tile draws a small week. The places Mail runs follow as a row of links.
 * On a phone the tiles stack; every description stays visible, since each tile is short.
 */
export function Features({ lang }: { lang: Lang }) {
  const { t, links, path } = getCopy(lang);
  const f = t.features;
  const tile = (icon: IconName) => f.items.find((item) => item.icon === icon)!;
  // Fifteen cells on three columns: two wide tiles (the address check and the calendar) and eleven narrow ones. Privacy and AI,
  // which most mail services do not offer, come right after the inbox.
  const order: readonly (IconName | "address")[] = [
    "address",
    "inbox",
    "lock",
    "mask",
    "spark",
    "calendar",
    "search",
    "undo",
    "alert",
    "key",
    "import",
    "filter",
    "install",
  ];

  return (
    <section className="border-t border-border" id="mail" aria-labelledby="features-title">
      {/* "features" is the wall's old address, kept so saved and shared links still land here. */}
      <Container className={sectionSpaceClassName} id="features">
        <div
          className="mb-10 flex items-end justify-between gap-8 max-lg:gap-4 max-md:mb-7 max-md:flex-col max-md:items-start"
          {...reveal()}
        >
          <div>
            <Eyebrow lang="en">{f.eyebrow}</Eyebrow>
            <SectionTitle id="features-title">
              {f.title}
              <HeadingMark>{t.dot}</HeadingMark>
            </SectionTitle>
          </div>
          <p className="max-w-120 pb-0.75 text-md/prose text-muted-foreground md:text-right">
            {f.intro[0]}
            {t.space}
            <br className="hidden md:block" />
            {f.intro[1]}
          </p>
        </div>

        <Bento asChild {...reveal(1)}>
          <ul role="list">
            {order.map((key) => {
              if (key === "address") {
                return (
                  <BentoTile asChild wide key={key}>
                    <li>
                      <AddressCheck
                        className="w-full min-w-0"
                        lang={lang}
                        copy={t.pricing.check}
                        shop={links.shop}
                        pricing={links.pricing}
                      />
                      <BentoVisual className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-4 text-xs/body text-muted-foreground">
                        {t.hero.promises.map((promise) => (
                          <span className="inline-flex items-center gap-1.5" key={promise}>
                            <Icon name="check" className="size-3.5 text-foreground" />
                            {promise}
                          </span>
                        ))}
                        <ServiceStatus copy={t.serviceStatus} href={links.status} />
                      </BentoVisual>
                    </li>
                  </BentoTile>
                );
              }
              const item = tile(key);
              if (key === "calendar") {
                return (
                  <BentoTile asChild wide key={key}>
                    <li className="sm:flex-row sm:flex-wrap sm:items-center">
                      <div className="min-w-0 sm:flex-[1_1_14rem]">
                        <BentoTitle>{item.title}</BentoTitle>
                        <BentoDescription>{item.description}</BentoDescription>
                      </div>
                      <BentoVisual className="sm:mt-0 sm:flex-[2_1_20rem]" aria-hidden="true">
                        {weekSample(f.samples)}
                      </BentoVisual>
                    </li>
                  </BentoTile>
                );
              }
              return (
                <BentoTile asChild key={key}>
                  <li>
                    <div>
                      <BentoTitle>{item.title}</BentoTitle>
                      <BentoDescription>{item.description}</BentoDescription>
                    </div>
                    <BentoVisual aria-hidden="true">{sample(key, f.samples)}</BentoVisual>
                  </li>
                </BentoTile>
              );
            })}
          </ul>
        </Bento>

        <div className="mt-14 max-md:mt-11" {...reveal()}>
          <h3
            className="flex items-center gap-4 text-sm/body font-medium text-muted-foreground"
            id="features-more-title"
          >
            {f.more.title}
            <span className="h-px flex-1 bg-border" aria-hidden="true"></span>
          </h3>
          <ul role="list" className="mt-6 flex flex-wrap gap-2.5" aria-labelledby="features-more-title">
            {f.more.items.map((item) => (
              <li
                className="inline-flex items-center gap-2 rounded-control border border-border px-3.5 py-2 text-sm/body"
                key={item}
              >
                <Icon name="check" className="size-3.5 text-muted-foreground" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-14 max-md:mt-11">
          <h3 className="flex items-center gap-4 text-sm/body font-medium text-muted-foreground" {...reveal()}>
            {f.platformsTitle}
            <span className="h-px flex-1 bg-border" aria-hidden="true"></span>
          </h3>
          <ul className="mt-7 grid gap-8 md:grid-cols-3 md:gap-10">
            {f.platforms.map((platform, index) => (
              <li className="flex items-start gap-4" key={platform.name} {...reveal(index)}>
                <IconTile variant="default" aria-hidden="true">
                  <Icon name={platform.icon} />
                </IconTile>
                <div className="min-w-0">
                  <p className="text-lg leading-[1.4] font-semibold tracking-title">{platform.name}</p>
                  <p className="mt-1.5 text-base/prose text-muted-foreground">{platform.description}</p>
                  <TextLink className="mt-3" href={platform.link ? links[platform.link] : path(platform.path ?? "/")}>
                    {platform.action} <Icon name="up-right" className="size-3.5" />
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
