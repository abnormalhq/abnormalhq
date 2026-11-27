import { BrandArrow } from "@/components/ui/brand-mark";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { TextLink } from "@/components/ui/text-link";
import type { Lang } from "@/data/site";
import { getCopy } from "@/i18n";
import { screens, screenSrc, screenSrcSet } from "@/lib/screens";
import { AddressCheck } from "./AddressCheck";
import { DoppelStage } from "./DoppelStage";
import { Icon } from "./Icon";
import { MarkedLine } from "./MarkedLine";
import { ProductTabs } from "./ProductTabs";
import { ServiceStatus } from "./ServiceStatus";
import { ThemedImage } from "./ThemedImage";

/**
 * The headline is set like the cover line of a magazine: Newsreader at light-touch regular weight for Latin, and
 * Noto Serif SC at medium weight and roomier leading for Chinese so display strokes stay sculptural on warm paper.
 */
const titleClassName =
  "animate-rise font-serif text-[clamp(2.5rem,6vw,5rem)] leading-[1.04] font-normal tracking-display text-balance [animation-delay:70ms] [&:lang(zh)]:text-[clamp(2.35rem,5.2vw,4.35rem)] [&:lang(zh)]:leading-[1.14] [&:lang(zh)]:font-medium [&:lang(zh)]:tracking-normal max-phone:text-display";
const descriptionClassName = "mt-5 max-w-xl text-md/prose text-pretty text-muted-foreground md:text-lg/prose";
const stageClassName = "mt-9 animate-rise [animation-delay:220ms] md:mt-11";

/**
 * The stage at the top of the home page: a tab per product, each with its own headline, action module and a stage
 * under them. Mail pairs its "in your own name" headline directly with the live address check and frames its real
 * inbox on an ink mat; Doppel shows an interactive schematic of three isolated browser workspaces.
 */
export function Hero({ lang }: { lang: Lang }) {
  const { t, links } = getCopy(lang);
  const h = t.hero;
  const inbox = screens.find(({ key }) => key === "inbox")!;

  const mail = (
    <div className="pt-8 md:pt-10">
      <div className="grid items-end gap-8 pb-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)] lg:gap-12">
        <div>
          <h1 className={titleClassName}>
            {h.mail.titleLines[0]}
            {t.space}
            <br className="max-md:hidden" />
            <MarkedLine line={h.mail.titleLines[1]} marked={h.mail.marked} />
          </h1>
          <p className={descriptionClassName}>{h.mail.description}</p>
          <div className="mt-6 flex animate-rise flex-wrap items-center gap-3 [animation-delay:140ms]">
            <Button asChild size="lg">
              <a href={links.shop}>
                {h.mail.buy} <Icon name="arrow" className="size-4" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#mail">
                {h.mail.explore} <Icon name="arrow" className="size-4 rotate-90" />
              </a>
            </Button>
          </div>
        </div>

        {/* Turn "in your own name" into an immediate first-screen interaction. */}
        <div className="grid animate-rise gap-3 [animation-delay:140ms]">
          <div className="rounded-panel border border-border-strong bg-popover p-5 shadow-sheet">
            <AddressCheck
              className="w-full min-w-0"
              lang={lang}
              copy={t.pricing.check}
              shop={links.shop}
              pricing={links.pricing}
            />
          </div>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs/body text-muted-foreground">
            <span>{h.loginPrompt}</span>
            <TextLink className="text-xs/body" href={links.account}>
              {h.loginLink} <Icon name="arrow" className="size-3" />
            </TextLink>
            <TextLink className="text-xs/body" href={links.webmail}>
              {h.webmailLink} <BrandArrow className="size-3" />
            </TextLink>
          </p>
        </div>
      </div>

      {/* Intentional ink mat: separates the warm-paper Mail sheet from the warm-paper page (and frames dark WebMail crisply in dark mode). */}
      <div className={stageClassName} id="screens">
        <div className="ink overflow-hidden rounded-dialog border border-border bg-ink px-3 pt-3 sm:px-5 sm:pt-4">
          <div
            className="mb-3 flex items-center justify-between gap-4 px-1 text-2xs text-muted-foreground"
            aria-hidden="true"
          >
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-full bg-border-strong" />
              <span className="inline-block size-2 rounded-full bg-border-strong" />
              <span className="inline-block size-2 rounded-full bg-border-strong" />
              <span className="ml-2 font-mono" lang="en">
                webmail.abnormalhq.com
              </span>
            </span>
            <span className="hidden font-mono sm:inline">{t.screens.inbox.title}</span>
          </div>
          {/* The site runs on a Worker without an image service, so the widths are made ahead of time (src/lib/screens.ts), in both themes. */}
          <ThemedImage
            className="block h-auto w-full rounded-t-mark border border-b-0 border-border"
            light={{ src: screenSrc(lang, inbox.key, inbox.width), srcSet: screenSrcSet(lang, inbox) }}
            dark={{ src: screenSrc(lang, inbox.key, inbox.width, "dark"), srcSet: screenSrcSet(lang, inbox, "dark") }}
            sizes="(min-width: 1184px) 1120px, 100vw"
            width={inbox.width}
            height={inbox.height}
            alt={t.screens.inbox.alt}
            fetchPriority="high"
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs/body text-muted-foreground">
          {h.promises.map((promise) => (
            <span className="inline-flex items-center gap-1.5" key={promise}>
              <Icon name="check" className="size-3.5 text-sage" />
              {promise}
            </span>
          ))}
        </div>
      </div>
    </div>
  );

  const doppel = (
    <div className="pt-8 md:pt-10">
      <div className="grid items-end gap-8 pb-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)] lg:gap-12">
        <div>
          {/* The same heading level as Mail's: only one panel is ever shown, so the page has one h1 at a time. */}
          <h1 className={titleClassName}>
            {h.doppel.titleLines[0]}
            {t.space}
            <br className="max-md:hidden" />
            <MarkedLine line={h.doppel.titleLines[1]} marked={h.doppel.marked} />
          </h1>
          <p className={descriptionClassName}>{h.doppel.description}</p>
        </div>
        <div className="flex animate-rise flex-wrap items-center gap-3 [animation-delay:140ms] lg:justify-end">
          <Button asChild size="lg">
            <a href={links.doppel}>
              {h.doppel.action} <Icon name="arrow" className="size-4 rotate-90" />
            </a>
          </Button>
        </div>
      </div>
      <div className={stageClassName}>
        <DoppelStage keeps={h.doppel.keeps} topology={h.doppel.topology} />
      </div>
    </div>
  );

  return (
    <Container asChild>
      {/* "products" and "screens" were the product cards and the screenshots this stage replaced: the ids keep saved links landing on it. */}
      <section className="pt-8 pb-12 md:pt-10 lg:pt-12" id="products">
        <ProductTabs
          label={h.productsLabel}
          aside={<ServiceStatus copy={t.serviceStatus} href={links.status} />}
          tabs={[
            { value: "mail", label: h.mail.tab, content: mail },
            { value: "doppel", label: h.doppel.tab, badge: h.doppel.badge, content: doppel },
          ]}
        />
      </section>
    </Container>
  );
}
