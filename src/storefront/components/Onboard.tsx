import { BookOpenIcon, CheckIcon, LockIcon } from "lucide-react";
import Link from "next/link";
import { TextLink } from "@/components/ui/text-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Disclosure, DisclosureContent, DisclosureList, DisclosureTrigger } from "@/components/ui/disclosure";
import { IconTile } from "@/components/ui/icon-tile";
import { Eyebrow, PageTitle } from "@/components/ui/section-heading";
import { defaultDomain, supportEmail } from "@/storefront/config";
import { copy } from "@/storefront/copy";
import { LANG_PATHS, type Lang } from "@/storefront/i18n";
import { cn } from "@/lib/utils";
import { shopCopy } from "@/storefront/lib/shop-copy";
import { apiBase, withBase } from "@/storefront/site";
import { OnboardForm } from "./onboard/OnboardForm";
import { RichText } from "@/components/RichText";

/** Sidebar subheading: heading font, but body size and tracking. */
const asideTitleClass = "text-sm font-medium tracking-normal";
const asideTextClass = "text-sm/[1.7] text-muted-foreground";

export function Onboard({ lang }: { lang: Lang }) {
  const t = copy[lang];
  const homePath = withBase(LANG_PATHS[lang]);
  return (
    <div>
      <section
        className="grid grid-cols-[minmax(0,1fr)_350px] items-center gap-12 pt-13.5 pb-12 max-desk:grid-cols-[minmax(0,1fr)_290px] max-desk:gap-6 max-tablet:grid-cols-[minmax(0,1fr)_225px] max-tablet:gap-4 max-tablet:py-10 max-narrow:block max-narrow:pt-8.5 max-narrow:pb-7.5"
        aria-labelledby="onboard-title"
      >
        <div>
          <Eyebrow>
            {t.eyebrow}
            <span className="h-3 w-px bg-border" />
            ABNORMAL MAIL
          </Eyebrow>
          <PageTitle className="[&:lang(zh)]:leading-tight" id="onboard-title">
            <span className="block">{t.titleLines[0]}</span>
            <span className="block text-muted-foreground">
              {t.titleLines[1]}
              {t.titleDot}
            </span>
          </PageTitle>
          <p className="mt-5.5 max-w-125 text-md/prose text-pretty text-muted-foreground max-narrow:mt-4 max-narrow:max-w-[40ch] max-narrow:text-sm/[1.85]">
            {t.tagline}
          </p>
          <ul className="mt-5.5 flex flex-wrap gap-x-5.5 gap-y-2.5 max-narrow:mt-4.5 max-narrow:gap-x-3.25 max-narrow:gap-y-2">
            {t.ui.features.map((feature) => (
              <li
                className="inline-flex items-center gap-1.5 text-xs/body text-muted-foreground max-narrow:gap-1"
                key={feature}
              >
                <CheckIcon
                  className="size-3.75 shrink-0 text-foreground max-narrow:size-3"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                {feature}
              </li>
            ))}
          </ul>
        </div>
        <MailArtwork />
      </section>

      <section
        className="mb-7 flex flex-wrap items-center justify-between gap-5 rounded-mark border border-border bg-surface px-6 py-5"
        aria-labelledby="shop-entry-title"
      >
        <div>
          <h2 className="text-lg" id="shop-entry-title">
            {shopCopy[lang].entryTitle}
          </h2>
          <p className={cn("mt-1", asideTextClass)}>{shopCopy[lang].entryDescription}</p>
        </div>
        <Button asChild size="lg" className="h-auto min-h-10 gap-3 py-2 whitespace-normal">
          <Link href={`/${LANG_PATHS[lang]}shop/`}>
            {shopCopy[lang].entryButton}
            <span aria-hidden="true">↗</span>
          </Link>
        </Button>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)_280px] items-start gap-7 max-desk:grid-cols-[minmax(0,1fr)_240px] max-desk:gap-5.5 max-tablet:grid-cols-[minmax(0,1fr)]">
        <div className="min-w-0">
          <OnboardForm
            lang={lang}
            apiBase={apiBase}
            defaultDomain={defaultDomain}
            supportEmail={supportEmail}
            homePath={homePath}
          />
        </div>
        <aside
          className="grid gap-4.5 max-tablet:grid-cols-[1fr_1fr] max-narrow:mt-1 max-narrow:grid-cols-[1fr] max-narrow:gap-4"
          aria-label={t.ui.supportTitle}
        >
          <Card
            asChild
            className="block bg-surface px-5.5 pt-6 pb-5 max-desk:px-5 max-desk:py-5.75 max-tablet:row-span-2 max-narrow:relative max-narrow:row-auto max-narrow:p-5.5"
          >
            <div>
              <IconTile
                variant="outline"
                className="mb-5 size-10 max-narrow:mb-4.5 max-narrow:size-9.5"
                aria-hidden="true"
              >
                <BookOpenIcon className="size-6.25" strokeWidth={1.5} />
              </IconTile>
              <h2 className="text-xl/[1.35]">{t.ui.guideTitle}</h2>
              <p className={cn("mt-2.5 max-narrow:max-w-[44ch]", asideTextClass)}>{t.ui.guideDescription}</p>
              <Link
                href={`/${LANG_PATHS[lang]}guide/`}
                className="group mt-5.75 flex min-h-11 items-center justify-between gap-3 border-t border-border pt-3.75 text-sm/body font-medium max-narrow:mt-4.5"
              >
                {t.ui.guideLink}
                <IconTile
                  variant="highlight"
                  className="size-6.5 rounded-chip text-md transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  aria-hidden="true"
                >
                  ↗
                </IconTile>
              </Link>
            </div>
          </Card>
          <div className="grid grid-cols-[20px_minmax(0,1fr)] gap-x-2.5 gap-y-2 rounded-mark border border-border p-5">
            <span className="text-muted-foreground" aria-hidden="true">
              <LockIcon className="size-5" strokeWidth={1.5} />
            </span>
            <h3 className={cn("self-center", asideTitleClass)}>{t.ui.reminderTitle}</h3>
            <p className={cn("col-start-2", asideTextClass)}>{t.ui.reminderDescription}</p>
          </div>
          <div className="px-2 pt-2 max-tablet:px-2.5 max-tablet:pt-0 max-narrow:p-1.5">
            <h3 className={asideTitleClass}>{t.ui.supportTitle}</h3>
            <p className={cn("mt-1.25", asideTextClass)}>{t.ui.supportDescription}</p>
            <a
              className="flex min-h-11 items-center justify-between text-sm/body hover:underline hover:underline-offset-4"
              href={`mailto:${supportEmail}`}
            >
              {supportEmail}
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        </aside>
      </div>

      <section
        className="mt-18 grid scroll-mt-6 grid-cols-[280px_minmax(0,1fr)] gap-14 border-t border-border pt-10 max-desk:grid-cols-[240px_minmax(0,1fr)] max-desk:gap-9 max-tablet:mt-13 max-tablet:grid-cols-[200px_minmax(0,1fr)] max-tablet:gap-6.5 max-narrow:mt-10 max-narrow:grid-cols-[1fr] max-narrow:pt-7"
        id="help"
        aria-labelledby="help-title"
      >
        <div>
          <Eyebrow className="before:hidden">{t.help.eyebrow}</Eyebrow>
          <h2 className="mt-3.5 text-3xl max-narrow:mt-2.5 max-narrow:text-2xl/[1.2]" id="help-title">
            {t.help.title}
          </h2>
          <p className={cn("mt-4 max-w-[27ch] wrap-anywhere max-narrow:mt-3 max-narrow:max-w-none", asideTextClass)}>
            {t.help.contact[0]}
            <TextLink variant="inline" href={`mailto:${supportEmail}`}>
              {supportEmail}
            </TextLink>
            {t.help.contact[1]}
          </p>
        </div>
        <DisclosureList className="border-t-0">
          {t.help.items.map((item, index) => (
            <Disclosure className="first:border-t" key={item.q}>
              <DisclosureTrigger
                className="min-h-16 gap-4 py-4.25 leading-body focus-visible:rounded-chip focus-visible:outline-offset-4 max-narrow:min-h-15.5 max-narrow:gap-3 max-[23.4375rem]:gap-3"
                indicator={<HelpToggle />}
              >
                <span className="text-xs/body text-muted-foreground" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="flex-1 text-md/[1.6] font-medium tracking-normal group-hover/trigger:text-muted-foreground max-narrow:text-base/[1.6]">
                  {item.q}
                </h3>
              </DisclosureTrigger>
              <DisclosureContent className="m-0 text-base/[1.75] wrap-anywhere max-narrow:text-sm/[1.75]">
                <p className="pr-10 pb-5.5 pl-7.5 max-narrow:pr-3 max-narrow:pl-6">
                  <RichText text={item.a} base={homePath} inlineLinks />
                </p>
              </DisclosureContent>
            </Disclosure>
          ))}
        </DisclosureList>
      </section>
    </div>
  );
}

/** FAQ toggle: a plus-sign square; the expanded question is "current", the square turns highlight yellow with ink lines inside. */
function HelpToggle() {
  return (
    <span
      className="relative size-6.25 shrink-0 rounded-chip border border-border transition-colors duration-150 group-open/disclosure:border-highlight-foreground group-open/disclosure:bg-highlight before:absolute before:top-2.75 before:left-1.75 before:h-px before:w-2.25 before:bg-muted-foreground group-open/disclosure:before:bg-highlight-foreground after:absolute after:top-2.75 after:left-1.75 after:h-px after:w-2.25 after:rotate-90 after:bg-muted-foreground after:transition-transform after:duration-150 group-open/disclosure:after:rotate-0 group-open/disclosure:after:bg-highlight-foreground"
      aria-hidden="true"
    />
  );
}

const mailCardClass = "absolute h-61 w-63.5 rounded-mark border border-border";
// abnormal-allow: a glyph of the drawing, sized to the drawing rather than the type scale.
const mailCardRowClass = "flex items-center justify-between text-[8px] tracking-[0.12em] text-muted-foreground";

/** Decorative stationery, kept in the page's own theme tokens. */
function MailArtwork() {
  return (
    <div
      className="relative h-72.5 w-87.5 justify-self-end max-desk:origin-right max-desk:scale-[0.84] max-tablet:scale-[0.64] max-narrow:hidden"
      aria-hidden="true"
    >
      <div className="absolute top-5 left-11.75 size-63 rounded-full border border-border" />
      {/* abnormal-allow: a glyph of the drawing, sized to the drawing rather than the type scale. */}
      <span className="absolute top-0.5 right-3.25 text-[36px] text-signal">✳</span>
      {/* abnormal-allow: a glyph of the drawing, sized to the drawing rather than the type scale. */}
      <span className="absolute bottom-0 left-1.75 text-[27px] font-light text-muted-foreground">+</span>
      {/* The hero illustration is a showcase: the card behind it is a big block of highlight yellow, the same in both themes. */}
      <div className={cn(mailCardClass, "top-7 left-12.5 rotate-[10deg] border-highlight bg-highlight")} />
      <div className={cn(mailCardClass, "top-4.75 left-9 -rotate-[7deg] bg-card px-5 pt-4.5 pb-3")}>
        <div className={mailCardRowClass}>
          {/* abnormal-allow: a glyph of the drawing, sized to the drawing rather than the type scale. */}
          <span className="text-[22px] leading-none font-semibold tracking-[-0.04em] text-foreground">a↗</span>
          <span>YOUR NEXT CHAPTER</span>
        </div>
        <svg
          className="mx-auto mt-5.5 mb-4.25 text-foreground"
          width="104"
          height="76"
          viewBox="0 0 104 76"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        >
          <rect x="2" y="2" width="100" height="72" rx="8" />
          <path d="m3 8 49 34L101 8M3 68l33-29m65 29L68 39" />
        </svg>
        {/* abnormal-allow: a glyph of the drawing, sized to the drawing rather than the type scale. */}
        <span className="block text-center text-[19px] tracking-heading">
          you<span className="text-muted-foreground">@{defaultDomain}</span>
        </span>
        <div className={cn(mailCardRowClass, "mt-4.25 border-t border-border pt-2.25")}>
          <span>MADE FOR YOU.</span>
          {/* abnormal-allow: a glyph of the drawing, sized to the drawing rather than the type scale. */}
          <span className="text-[17px] leading-none">↗</span>
        </div>
      </div>
      <span className="absolute right-8 bottom-9.75 grid size-11 -rotate-[7deg] place-items-center rounded-full border-[5px] border-background bg-foreground text-background">
        <CheckIcon className="size-5.75" strokeWidth={1.75} />
      </span>
    </div>
  );
}
