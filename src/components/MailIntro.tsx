import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Eyebrow, SectionTitle } from "@/components/ui/section-heading";
import { TextLink } from "@/components/ui/text-link";
import type { Lang } from "@/data/site";
import { getCopy } from "@/i18n";
import { AddressCheck } from "./AddressCheck";
import { Icon } from "./Icon";
import { ServiceStatus } from "./ServiceStatus";

/** Mail's existing discovery, sign-in and address check now sit within the product rather than the family hero. */
export function MailIntro({ lang }: { lang: Lang }) {
  const { t, links } = getCopy(lang);
  const m = t.mailIntro;
  const h = t.hero;
  return (
    <section id="mail" aria-labelledby="mail-title" className="border-t border-border">
      <Container className="pt-12 pb-10 md:pt-16 md:pb-12">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl">
            <Eyebrow lang="en">{m.eyebrow}</Eyebrow>
            <SectionTitle id="mail-title">{m.title}</SectionTitle>
            <p className="mt-4 text-md/prose text-muted-foreground">{m.description}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <a href={links.shop}>
                {t.header.buy} <Icon name="up-right" className="size-4" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#demo">
                {m.tryDemo} <Icon name="arrow" className="size-4" />
              </a>
            </Button>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-x-12 gap-y-6 border-t border-border pt-7">
          <AddressCheck
            className="w-full max-w-[440px] min-w-0 flex-1 basis-[400px]"
            lang={lang}
            copy={t.pricing.check}
            shop={links.shop}
            pricing={links.pricing}
          />
          <div className="min-w-0 flex-1 basis-[400px] text-muted-foreground">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm/body">
              <span>{h.loginPrompt}</span>
              <TextLink className="min-h-11" href={links.account}>
                {h.loginLink} <Icon name="up-right" className="size-3.5" />
              </TextLink>
              <TextLink className="min-h-11" href={links.webmail}>
                {h.webmailLink} <Icon name="up-right" className="size-3.5" />
              </TextLink>
            </p>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs/body">
              {h.promises.map((promise) => (
                <span className="inline-flex items-center gap-1.5" key={promise}>
                  <Icon name="check" className="size-3.5 text-foreground" />
                  {promise}
                </span>
              ))}
            </div>
            <div className="mt-3 flex min-h-6 text-xs/body">
              <ServiceStatus copy={t.serviceStatus} href={links.status} />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
