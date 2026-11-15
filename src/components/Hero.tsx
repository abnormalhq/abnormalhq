import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Marker } from "@/components/ui/marker";
import { Eyebrow, HeadingMark } from "@/components/ui/section-heading";
import { TextLink } from "@/components/ui/text-link";
import type { Lang } from "@/data/site";
import { useCopy } from "@/i18n";
import { cn } from "@/lib/utils";
import { AddressCheck } from "./AddressCheck";
import { Icon } from "./Icon";
import { ServiceStatus } from "./ServiceStatus";

const avatars = [
  { className: "text-brand", icon: "spark" },
  { className: "", icon: "chat" },
  { className: "", icon: "check" },
] as const;

export function Hero({ lang }: { lang: Lang }) {
  const { t, links } = useCopy(lang);
  const h = t.hero;

  return (
    <Container asChild>
      {/*
       * First viewport: brand signals, one headline, one short line, the CTA pair, and the showcase.
       * Address check, login links, promises and status sit in a secondary band under the grid so they
       * do not compete with that composition.
       */}
      <section
        className="pt-20 pb-10 max-hero:pt-[3.75rem] max-md:pt-[2.8rem] max-md:pb-8 max-phone:pt-[2.3rem] wide:pt-[5.5rem]"
        aria-labelledby="hero-title"
      >
        {/*
         * Own the first viewport on desktop: the primary grid fills the space under the header so the secondary
         * band (address check, login, promises) starts below the fold instead of stacking into the composition.
         */}
        <div className="grid grid-cols-2 items-center gap-8 max-hero:gap-4 max-md:grid-cols-1 max-md:gap-12 max-phone:gap-10 md:min-h-[calc(100svh-5.75rem)] wide:gap-16">
          <div className="relative z-1 max-md:text-center">
            <Eyebrow className="inline-flex animate-rise" lang="en">
              {h.eyebrow}
            </Eyebrow>
            <h1
              className="my-[1.4rem] animate-rise font-heading text-[clamp(2.5rem,4.4vw,3.5rem)] leading-[1.25] font-semibold tracking-[-0.02em] max-hero:text-[2.5rem] max-md:my-6 max-md:text-[clamp(2.35rem,8.2vw,3.6rem)] [animation-delay:70ms]"
              id="hero-title"
            >
              {h.titleLines[0]}
              <br />
              <span className="text-muted-foreground">
                {h.titleLines[1]}
                {/*
                 * The page's one Marker: highlighter band draws across the word after the title rises.
                 * Resting size is full so reduced-motion (animation: none) still shows the finished mark.
                 */}
                <Marker className="animate-mark bg-left bg-no-repeat [background-size:100%_100%] [animation-delay:420ms]">
                  {h.titleLines[2]}
                </Marker>
                <HeadingMark className="-ml-[0.12em]">{t.dot}</HeadingMark>
              </span>
            </h1>
            <p className="max-w-[500px] animate-rise text-md/prose text-muted-foreground max-hero:text-base/prose max-md:mx-auto [animation-delay:140ms]">
              {h.description[0]}
              <br />
              {h.description[1]}
            </p>
            <div className="mt-8 flex animate-rise flex-wrap items-center gap-3 max-md:justify-center [animation-delay:210ms]">
              <Button asChild size="lg">
                <a href={links.shop}>
                  {h.buy} <Icon name="arrow" className="size-4" />
                </a>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href={links.register}>
                  {h.register} <Icon name="up-right" className="size-4" />
                </a>
              </Button>
            </div>
          </div>

          {/*
           * Overflow stays visible on purpose: the highlighter wash extends past this box. Do not put isolate or a
           * transform animation on this same element with a negative-z wash — compositing then clips the glow to the
           * border box (the hard cut at the bottom of the halo).
           */}
          <div
            className="group/visual relative h-[475px] min-w-0 max-hero:h-[450px] max-md:mx-auto max-md:h-[445px] max-md:w-[min(100%,470px)] max-phone:h-[425px]"
            role="img"
            aria-label={h.visualLabel}
          >
            {/*
             * Soft highlighter wash, kept inside the showcase box. The ellipse is smaller than the box and ends at
             * full transparency, so a grid/compositing clip on this column cannot leave a straight edge.
             */}
            <div
              className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_50%_44%_at_64%_42%,color-mix(in_oklab,var(--highlight)_40%,transparent)_0%,transparent_80%)] opacity-90 dark:opacity-50"
              aria-hidden="true"
            />
            {/* Rise animation lives on an inner layer so it does not create a clipping compositing root for the wash. */}
            <div className="absolute inset-0 z-1 animate-rise [animation-delay:180ms]" aria-hidden="true">
              <div className="absolute inset-x-[4%] inset-y-[2%] rounded-full border border-border/70" />
              {/* The yellow block and the address card float slowly, out of step with each other; the inbox between them stays put. */}
              {/* Brand tile first: the highlighter-yellow "a" is the showcase's loudest signal. */}
              <div className="absolute -top-1 right-0 z-2 h-[158px] w-[138px] rotate-10 animate-drift rounded-mark bg-highlight p-[1.15rem] text-highlight-foreground shadow-[3px_3px_0_0_var(--highlight-foreground)] max-hero:right-[1%] max-hero:h-[138px] max-hero:w-[120px] max-md:-top-3 max-md:h-[140px] max-md:w-[122px] max-phone:h-[122px] max-phone:w-[106px] max-phone:p-[0.85rem] [animation-delay:-2s]">
                <span className="mb-[0.55rem] flex items-start justify-between font-heading text-[2.15rem] leading-none font-semibold tracking-[-0.04em]">
                  a<Icon name="up-right" className="mt-1 size-[0.95rem]" />
                </span>
                <span className="text-[0.65rem] leading-[1.6] font-medium tracking-[0.08em] max-phone:text-[0.55rem]">
                  GOOD MAIL.
                  <br />
                  GOOD DAYS.
                </span>
                <span className="absolute right-[0.7rem] bottom-[0.6rem] text-[1.3rem]">✳</span>
              </div>
              <div className="absolute top-[20%] left-[1%] w-[91%] rotate-[-3deg] overflow-hidden rounded-mark border border-border bg-card transition-transform duration-400 group-hover/visual:-translate-y-1 group-hover/visual:rotate-[-1deg] max-hero:top-[19%] max-hero:w-[98%] max-md:top-[14%] max-md:left-0 max-md:w-[94%]">
                <div className="flex items-center justify-between border-b border-border px-4 py-3 text-[0.45rem] tracking-[0.13em] text-muted-foreground">
                  <span className="flex gap-1">
                    <i className="size-[5px] rounded-full bg-signal"></i>
                    <i className="size-[5px] rounded-full bg-input"></i>
                    <i className="size-[5px] rounded-full bg-input"></i>
                  </span>
                  <span>YOUR EVERYDAY INBOX</span>
                  <Icon name="shield" className="size-3.5" />
                </div>
                <div className="px-[1.4rem] pt-[1.4rem] pb-2 max-hero:px-4 max-hero:pt-4 max-hero:pb-[0.3rem] max-md:px-[1.4rem] max-md:pt-[1.4rem] max-md:pb-2 max-phone:px-[0.85rem] max-phone:pt-4 max-phone:pb-[0.3rem]">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <span className="text-[0.45rem] tracking-[0.12em] text-muted-foreground">{h.mock.overline}</span>
                      <p className="mt-[0.35rem] text-[1.15rem] font-semibold tracking-[-0.02em] max-hero:text-[1rem] max-md:text-[1.15rem] max-phone:text-[1rem]">
                        {h.mock.heading}
                        <span className="text-signal">{t.dot}</span>
                      </p>
                    </div>
                    <span className="grid size-[2.35rem] place-items-center rounded-full bg-foreground text-[1.3rem] font-bold tracking-[-0.06em] text-background">
                      a.
                    </span>
                  </div>
                  <div className="mt-[1.4rem] flex items-center gap-[1.35rem] border-b border-border text-[0.65rem] text-muted-foreground">
                    <span className="border-b-2 border-foreground pb-[0.7rem] text-foreground">
                      {h.mock.inbox} {/* The unread count is the "new" marker: ink on yellow. */}
                      <b className="ml-1 rounded-chip bg-highlight px-1 py-[0.15rem] text-[0.5rem] text-highlight-foreground">
                        03
                      </b>
                    </span>
                    <span className="pb-[0.7rem]">{h.mock.starred}</span>
                    <Icon name="plus" className="mb-[0.7rem] ml-auto size-4" />
                  </div>
                  {h.mock.mails.map((mail, index) => (
                    <div
                      className="flex items-center gap-[0.65rem] border-b border-border py-[0.85rem] last:border-b-0"
                      key={mail.title}
                    >
                      <span
                        className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-chip bg-surface text-muted-foreground",
                          avatars[index]?.className,
                        )}
                      >
                        <Icon name={avatars[index]?.icon ?? "spark"} className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <strong className="block text-[0.65rem] font-medium">{mail.title}</strong>
                        <span className="mt-[3px] block text-[0.5rem] text-muted-foreground max-hero:max-w-[155px] max-hero:truncate max-md:max-w-none max-md:overflow-visible max-md:whitespace-normal max-phone:max-w-[145px] max-phone:truncate">
                          {mail.body}
                        </span>
                      </div>
                      <span className="ml-auto flex flex-col items-end gap-[0.4rem] self-start pt-[0.2rem] text-[0.45rem] text-muted-foreground">
                        {mail.time}
                        {index === 0 && <span className="size-1 rounded-full bg-signal" />}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute bottom-1 left-[7%] z-3 flex rotate-2 animate-drift items-center gap-[0.8rem] rounded-mark border border-border bg-card px-4 py-[0.85rem] [animation-duration:9s] max-hero:left-0 max-hero:gap-2 max-hero:p-[0.7rem] max-md:bottom-0 max-md:left-[5%] max-md:gap-[0.8rem] max-md:px-4 max-md:py-[0.85rem] max-phone:left-0 max-phone:gap-[0.55rem] max-phone:p-[0.7rem]">
                <span className="grid size-[2.6rem] place-items-center rounded-full bg-surface text-[1.4rem] text-foreground">
                  @
                </span>
                <div>
                  <span className="text-[0.55rem] text-muted-foreground">{h.mock.domainNote}</span>
                  <strong className="mt-px block text-[0.95rem] font-medium tracking-[-0.02em] max-hero:text-[0.85rem] max-md:text-[0.95rem] max-phone:text-[0.85rem]">
                    hello@<span className="text-muted-foreground">yourname</span>.com
                  </strong>
                </div>
                <span className="ml-1 grid size-[1.3rem] place-items-center rounded-full bg-foreground text-background max-phone:ml-0">
                  <Icon name="check" className="size-3.5" />
                </span>
              </div>
            </div>
            <p
              className="absolute -bottom-8 left-1/2 z-1 flex -translate-x-1/2 items-center gap-2 text-[0.5rem] tracking-[0.14em] whitespace-nowrap text-muted-foreground"
              aria-hidden="true"
            >
              <span className="size-1 rounded-full bg-signal"></span> YOUR INBOX. YOUR IDENTITY.{" "}
              <span className="border-l border-border pl-2 tracking-[0.05em]">{h.mock.demoLabel}</span>
            </p>
          </div>
        </div>

        {/*
         * Secondary band: useful, but not the first-viewport story. Compact so it reads as one strip under the
         * composition rather than another column of competing blocks.
         */}
        <div className="mt-14 animate-rise border-t border-border pt-7 max-md:mt-12 max-md:pt-6 [animation-delay:280ms]">
          <AddressCheck className="max-w-[440px] max-md:mx-auto" lang={lang} copy={t.pricing.check} shop={links.shop} />
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 text-base/body text-muted-foreground max-md:justify-center max-md:gap-x-4">
            <p className="flex flex-wrap items-center gap-2 max-md:justify-center">
              {h.loginPrompt}
              <TextLink href={links.account}>
                {h.loginLink} <Icon name="up-right" className="size-3.5" />
              </TextLink>
              <span aria-hidden="true">·</span>
              <TextLink href={links.webmail}>
                {h.webmailLink} <Icon name="up-right" className="size-3.5" />
              </TextLink>
            </p>
            <span className="hidden h-3 w-px bg-border sm:block" aria-hidden="true" />
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs/body max-md:justify-center max-phone:gap-x-4">
              {h.promises.map((promise) => (
                <span className="inline-flex items-center gap-1.5" key={promise}>
                  <Icon name="check" className="size-3.5 text-foreground" />
                  {promise}
                </span>
              ))}
            </div>
          </div>
          {/* The line keeps its height while the status is unknown, so the strip does not jump when it arrives. */}
          <div className="mt-4 flex min-h-6 text-xs/body max-md:justify-center">
            <ServiceStatus copy={t.serviceStatus} href={links.status} />
          </div>
        </div>
      </section>
    </Container>
  );
}
