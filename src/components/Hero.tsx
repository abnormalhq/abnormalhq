import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { TextLink } from "@/components/ui/text-link";
import type { Lang } from "@/data/site";
import { getCopy } from "@/i18n";
import { screens, screenSrc, screenSrcSet } from "@/lib/screens";
import { Icon } from "./Icon";
import { MarkedLine } from "./MarkedLine";
import { ProductTabs } from "./ProductTabs";

/**
 * The headline is set like the cover line of a magazine: the editorial serif at a regular weight, large and flush left,
 * so the size carries it rather than a heavy stroke. Chinese keeps its natural spacing; only Latin closes up.
 */
const titleClassName =
  "mt-10 max-w-[13em] animate-rise font-serif text-[clamp(2.75rem,7vw,6rem)] leading-[1.02] font-normal tracking-display text-balance [animation-delay:70ms] md:mt-14 [&:lang(zh)]:tracking-normal max-phone:text-display";
/** Under the headline, a hairline and two columns: the sentence on the left, what to do on the right. */
const dekClassName =
  "mt-10 grid animate-rise gap-8 border-t border-border pt-6 [animation-delay:140ms] md:mt-12 md:grid-cols-[minmax(0,34rem)_1fr] md:gap-12";
const descriptionClassName = "text-md/prose text-pretty text-muted-foreground md:text-lg/prose";
const actionsClassName = "flex flex-wrap items-start gap-3 md:justify-end";
/** The stage: the product itself under a hairline, framed once by its own border. */
const stageClassName = "mt-14 animate-rise [animation-delay:280ms] md:mt-16";

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
    <div>
      <h1 className={titleClassName}>
        {h.mail.titleLines[0]}
        {t.space}
        <br className="max-md:hidden" />
        <MarkedLine line={h.mail.titleLines[1]} marked={h.mail.marked} />
        {t.dot}
      </h1>
      <div className={dekClassName}>
        <p className={descriptionClassName}>{h.mail.description}</p>
        <div className="grid content-start gap-4 md:justify-items-end">
          {/* The highlighter in the headline is the page's yellow, so the lead action is the plain primary: paper on the ink. */}
          <div className={actionsClassName}>
            <Button asChild size="lg">
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
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm/body text-muted-foreground md:justify-end">
            <span>{h.loginPrompt}</span>
            <TextLink className="min-h-11" href={links.account}>
              {h.loginLink} <Icon name="up-right" className="size-3.5" />
            </TextLink>
            <TextLink className="min-h-11" href={links.webmail}>
              {h.webmailLink} <Icon name="up-right" className="size-3.5" />
            </TextLink>
          </p>
        </div>
      </div>
      <div className={stageClassName} id="screens">
        {/* The site runs on a Worker without an image service, so the widths are made ahead of time (src/lib/screens.ts). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="block h-auto w-full rounded-dialog border border-border"
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
    <div>
      {/* The same heading level as Mail's: only one panel is ever shown, so the page has one h1 at a time. */}
      <h1 className={titleClassName}>
        {h.doppel.titleLines[0]}
        {t.space}
        <br className="max-md:hidden" />
        <MarkedLine line={h.doppel.titleLines[1]} marked={h.doppel.marked} />
        {t.dot}
      </h1>
      <div className={dekClassName}>
        <p className={descriptionClassName}>{h.doppel.description}</p>
        <div className={actionsClassName}>
          <Button asChild size="lg" variant="outline">
            <a href={links.doppel}>
              {h.doppel.action} <Icon name="arrow" className="size-4" />
            </a>
          </Button>
        </div>
      </div>
      {/* A drawing, not the product: three workspaces, each keeping its own identity, cookies and sign-ins, set as three
          columns under hairlines like the rest of the page. */}
      <div className={stageClassName} aria-hidden="true">
        <div className="grid gap-x-10 gap-y-8 md:grid-cols-3">
          {["01", "02", "03"].map((number) => (
            <div key={number} className="flex flex-col gap-6 border-t border-border pt-5">
              <span className="font-mono text-xs text-muted-foreground" lang="en">
                workspace / {number}
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
