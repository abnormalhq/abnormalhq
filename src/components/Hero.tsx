import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/section-heading";
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
      <section
        className="grid grid-cols-2 items-center gap-8 pt-20 pb-[4.5rem] max-hero:gap-4 max-hero:py-[3.75rem] max-md:grid-cols-1 max-md:gap-12 max-md:pt-[2.8rem] max-md:pb-14 max-phone:gap-10 max-phone:pt-[2.3rem] wide:gap-16 wide:pt-[5.5rem] wide:pb-20"
        aria-labelledby="hero-title"
      >
        <div className="relative z-1 max-md:text-center">
          <Eyebrow className="inline-flex" lang="en">
            {h.eyebrow}
          </Eyebrow>
          <h1
            className="my-[1.4rem] text-[clamp(2.5rem,4.4vw,3.5rem)] leading-[1.25] font-semibold tracking-[-0.02em] max-hero:text-[2.5rem] max-md:my-6 max-md:text-[clamp(2.35rem,8.2vw,3.6rem)]"
            id="hero-title"
          >
            {h.titleLines[0]}
            <br />
            <span className="text-muted-foreground">
              {h.titleLines[1]}
              <span className="-ml-[0.12em] text-signal">{t.dot}</span>
            </span>
          </h1>
          <p className="max-w-[500px] text-md/prose text-muted-foreground max-hero:text-base/prose max-md:mx-auto">
            {h.description[0]}
            <br />
            {h.description[1]}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3 max-md:justify-center">
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
          {/* Shown only when the backend offers the address check; it renders nothing otherwise (see AddressCheck). */}
          <AddressCheck
            className="mt-7 max-w-[440px] max-md:mx-auto"
            lang={lang}
            copy={t.pricing.check}
            shop={links.shop}
          />
          <p className="mt-5 flex flex-wrap items-center gap-2 text-base/body text-muted-foreground max-md:justify-center">
            {h.loginPrompt}
            <TextLink href={links.account}>
              {h.loginLink} <Icon name="up-right" className="size-3.5" />
            </TextLink>
            <span aria-hidden="true">·</span>
            <TextLink href={links.webmail}>
              {h.webmailLink} <Icon name="up-right" className="size-3.5" />
            </TextLink>
          </p>
          <div className="mt-6 flex flex-wrap gap-x-[22px] gap-y-2.5 text-xs/body text-muted-foreground max-md:justify-center max-md:gap-[0.8rem] max-phone:gap-x-4 max-phone:gap-y-2">
            {h.promises.map((promise) => (
              <span className="inline-flex items-center gap-1.5" key={promise}>
                <Icon name="check" className="size-3.5 text-foreground" />
                {promise}
              </span>
            ))}
          </div>
          {/* The line keeps its height while the status is unknown, so the hero does not move when it arrives. */}
          <div className="mt-4 flex min-h-6 text-xs/body max-md:justify-center">
            <ServiceStatus copy={t.serviceStatus} href={links.status} />
          </div>
        </div>

        <div
          className="group/visual relative isolate h-[475px] min-w-0 max-hero:h-[450px] max-md:mx-auto max-md:h-[445px] max-md:w-[min(100%,470px)] max-phone:h-[425px]"
          role="img"
          aria-label={h.visualLabel}
        >
          <div
            className="absolute inset-x-[4%] inset-y-[2%] rounded-full border border-border"
            aria-hidden="true"
          ></div>
          <span
            className="absolute top-[6%] left-[13%] text-[1.4rem] font-light text-muted-foreground"
            aria-hidden="true"
          >
            +
          </span>
          <span
            className="absolute right-[5%] bottom-[1%] text-[1.4rem] font-light text-muted-foreground"
            aria-hidden="true"
          >
            +
          </span>
          {/* The hero showcase: a big highlight-yellow block with ink on top throughout. */}
          <div
            className="absolute top-0 right-[1%] z-2 h-[143px] w-[125px] rotate-10 rounded-mark bg-highlight p-4 text-highlight-foreground max-hero:right-[2%] max-hero:h-[125px] max-hero:w-[108px] max-md:-top-2 max-md:h-[127px] max-md:w-[110px] max-phone:h-[112px] max-phone:w-[96px] max-phone:p-[0.8rem]"
            aria-hidden="true"
          >
            <span className="mb-[0.55rem] flex items-start justify-between text-[2rem] leading-none font-semibold">
              a<Icon name="up-right" className="size-[0.9rem]" />
            </span>
            <span className="text-[0.65rem] leading-[1.6] font-medium tracking-[0.08em] max-phone:text-[0.55rem]">
              GOOD MAIL.
              <br />
              GOOD DAYS.
            </span>
            <span className="absolute right-[0.7rem] bottom-[0.6rem] text-[1.3rem]">✳</span>
          </div>
          <div
            className="absolute top-[20%] left-[1%] w-[91%] rotate-[-3deg] overflow-hidden rounded-mark border border-border bg-card transition-transform duration-400 group-hover/visual:-translate-y-1 group-hover/visual:rotate-[-1deg] max-hero:top-[19%] max-hero:w-[98%] max-md:top-[14%] max-md:left-0 max-md:w-[94%]"
            aria-hidden="true"
          >
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
          <div
            className="absolute bottom-1 left-[7%] z-3 flex rotate-2 items-center gap-[0.8rem] rounded-mark border border-border bg-card px-4 py-[0.85rem] max-hero:left-0 max-hero:gap-2 max-hero:p-[0.7rem] max-md:bottom-0 max-md:left-[5%] max-md:gap-[0.8rem] max-md:px-4 max-md:py-[0.85rem] max-phone:left-0 max-phone:gap-[0.55rem] max-phone:p-[0.7rem]"
            aria-hidden="true"
          >
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
          <p
            className="absolute -bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-2 text-[0.5rem] tracking-[0.14em] whitespace-nowrap text-muted-foreground"
            aria-hidden="true"
          >
            <span className="size-1 rounded-full bg-signal"></span> YOUR INBOX. YOUR IDENTITY.{" "}
            <span className="border-l border-border pl-2 tracking-[0.05em]">{h.mock.demoLabel}</span>
          </p>
        </div>
      </section>
    </Container>
  );
}
