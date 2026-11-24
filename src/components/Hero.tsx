import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { HeadingMark } from "@/components/ui/section-heading";
import { TextLink } from "@/components/ui/text-link";
import type { Lang } from "@/data/site";
import { getCopy } from "@/i18n";
import { screens, screenSrc, screenSrcSet } from "@/lib/screens";
import { Icon } from "./Icon";
import { ProductTabs } from "./ProductTabs";

const titleClassName =
  "mx-auto mt-8 max-w-[15em] animate-rise font-heading text-[clamp(2.5rem,6.2vw,5.25rem)] leading-[1.06] font-semibold tracking-[-0.035em] [animation-delay:70ms] max-phone:text-display-sm";
const descriptionClassName =
  "mx-auto mt-6 max-w-144 animate-rise text-md/prose text-muted-foreground [animation-delay:140ms] md:text-lg/prose";
const actionsClassName = "mt-8 flex animate-rise flex-wrap justify-center gap-3 [animation-delay:210ms]";
/** The stage: the product sits on a faintly lifted panel, wide as the page, under the headline. */
const stageClassName =
  "mx-auto mt-14 max-w-280 animate-rise rounded-dialog border border-border bg-control p-1.5 [animation-delay:280ms] md:mt-16 md:p-2";

/**
 * The stage at the top of the home page: a tab per product, each with its own headline, sentence, actions and a stage
 * under them. Mail shows its real inbox; Doppel is not public, so it shows a drawing of what a workspace keeps and
 * leads to the waitlist status further down the page.
 */
export function Hero({ lang }: { lang: Lang }) {
  const { t, links } = getCopy(lang);
  const h = t.hero;
  const inbox = screens.find(({ key }) => key === "inbox")!;

  const mail = (
    <div className="text-center">
      <h1 className={titleClassName}>
        {h.mail.titleLines[0]}
        {t.space}
        <br className="max-md:hidden" />
        {h.mail.titleLines[1]}
        <HeadingMark>{t.dot}</HeadingMark>
      </h1>
      <p className={descriptionClassName}>{h.mail.description}</p>
      <div className={actionsClassName}>
        <Button asChild size="lg" variant="highlight">
          <a href={links.shop}>
            {h.mail.buy} <Icon name="up-right" className="size-4" />
          </a>
        </Button>
        <Button asChild size="lg" variant="outline">
          <a href="#mail">
            {h.mail.explore} <Icon name="arrow" className="size-4" />
          </a>
        </Button>
      </div>
      <p className="mt-5 flex animate-rise flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm/body text-muted-foreground [animation-delay:240ms]">
        <span>{h.loginPrompt}</span>
        <TextLink className="min-h-11" href={links.account}>
          {h.loginLink} <Icon name="up-right" className="size-3.5" />
        </TextLink>
        <TextLink className="min-h-11" href={links.webmail}>
          {h.webmailLink} <Icon name="up-right" className="size-3.5" />
        </TextLink>
      </p>
      <div className={stageClassName} id="screens">
        {/* The site runs on a Worker without an image service, so the widths are made ahead of time (src/lib/screens.ts). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="block h-auto w-full rounded-control border border-border"
          src={screenSrc(lang, inbox.key, inbox.width)}
          srcSet={screenSrcSet(lang, inbox)}
          sizes="(min-width: 1184px) 1120px, 100vw"
          width={inbox.width}
          height={inbox.height}
          alt={t.screens.inbox.alt}
          fetchPriority="high"
        />
      </div>
    </div>
  );

  const doppel = (
    <div className="text-center">
      {/* The same heading level as Mail's: only one panel is ever shown, so the page has one h1 at a time. */}
      <h1 className={titleClassName}>
        {h.doppel.titleLines[0]}
        {t.space}
        <br className="max-md:hidden" />
        {h.doppel.titleLines[1]}
        <HeadingMark>{t.dot}</HeadingMark>
      </h1>
      <p className={descriptionClassName}>{h.doppel.description}</p>
      <div className={actionsClassName}>
        <Button asChild size="lg" variant="outline">
          <a href={links.doppel}>
            {h.doppel.action} <Icon name="arrow" className="size-4" />
          </a>
        </Button>
      </div>
      {/* A drawing, not the product: three workspaces, each keeping its own identity, cookies and sign-ins. */}
      <div className={stageClassName} aria-hidden="true">
        <div className="grid gap-1.5 rounded-control md:grid-cols-3 md:gap-2">
          {["01", "02", "03"].map((number, index) => (
            <div
              key={number}
              className="flex flex-col gap-6 rounded-control border border-border bg-background p-5 text-left md:p-6"
            >
              <span className="flex items-center justify-between font-mono text-xs text-muted-foreground" lang="en">
                <span>workspace / {number}</span>
                <span className={index === 0 ? "size-2 rounded-full bg-signal" : "size-2 rounded-full bg-border"} />
              </span>
              <ul className="grid gap-2.5">
                {h.doppel.keeps.map((keep) => (
                  <li key={keep} className="flex items-center gap-3 text-sm/body">
                    <Icon name="check" className="size-3.5 text-muted-foreground" />
                    {keep}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <Container asChild>
      {/* "products" and "screens" were the product cards and the screenshots this stage replaced: the ids keep saved links landing on it. */}
      <section className="pt-12 pb-8 md:pt-16 lg:pt-20" id="products">
        <ProductTabs
          label={h.productsLabel}
          tabs={[
            { value: "mail", label: h.mail.tab, content: mail },
            { value: "doppel", label: h.doppel.tab, badge: h.doppel.badge, content: doppel },
          ]}
        />
      </section>
    </Container>
  );
}
