import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { IconTile } from "@/components/ui/icon-tile";
import { Eyebrow, HeadingMark, SectionTitle, sectionSpaceClassName } from "@/components/ui/section-heading";
import { TextLink } from "@/components/ui/text-link";
import { site, type Lang } from "@/data/site";
import { useCopy } from "@/i18n";
import { reveal } from "@/lib/reveal";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";

export function Start({ lang }: { lang: Lang }) {
  const { t, links } = useCopy(lang);
  const s = t.start;
  const supportEmail = site.contact.email.trim();

  return (
    <section className="border-t border-border" id="start" aria-labelledby="start-title">
      <Container className={sectionSpaceClassName}>
        <div
          className="mb-10 flex items-end justify-between gap-8 max-lg:gap-4 max-md:mb-7 max-md:flex-col max-md:items-start"
          {...reveal()}
        >
          <div>
            <Eyebrow lang="en">
              <span className="mr-1">02 /</span> {s.eyebrow}
            </Eyebrow>
            <SectionTitle id="start-title">
              {s.title}
              <HeadingMark>{t.dot}</HeadingMark>
            </SectionTitle>
          </div>
          <p className="pb-[0.2rem] text-md/prose text-muted-foreground">
            {s.intro[0]}
            {t.space}
            <br className="hidden md:block" />
            {s.intro[1]}
          </p>
        </div>
        <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
          {s.entries.map((entry, index) => (
            <Card
              asChild
              variant={entry.primary ? "featured" : "interactive"}
              className="group/card px-[1.4rem] pt-6 pb-[1.4rem] max-sm:p-6"
              key={entry.title}
              {...reveal(index)}
            >
              <a href={links[entry.link]}>
                <span className="flex items-center justify-between gap-[0.7rem]">
                  <IconTile variant={entry.primary ? "highlight" : "default"} aria-hidden="true">
                    <Icon name={entry.icon} className="size-5" />
                  </IconTile>
                  <Badge className="h-auto border-0 py-0.5 leading-[1.55]">{entry.eyebrow}</Badge>
                </span>
                <span className="mt-6 flex items-center justify-between text-xl/[1.4] font-semibold tracking-[-0.01em] max-sm:mt-[1.1rem]">
                  {entry.title}
                  <span className="text-xs/[1.4] font-normal tracking-normal text-muted-foreground" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </span>
                <span className="mt-[0.6rem] flex-1 text-base/prose text-muted-foreground">{entry.description}</span>
                <span className="mt-[1.4rem] flex items-center justify-between border-t border-border pt-[1.1rem] text-base/body font-medium">
                  {entry.action}
                  <Icon
                    name="up-right"
                    className={cn(
                      "size-4 transition-colors duration-150",
                      entry.primary ? "text-brand" : "text-muted-foreground group-hover/card:text-foreground",
                    )}
                  />
                </span>
              </a>
            </Card>
          ))}
        </div>
        <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-2">
          {s.secondary.map(({ link, label }) => (
            <TextLink className="text-sm/[1.6] wrap-anywhere" href={links[link]} key={link}>
              {label} <Icon name="up-right" className="size-3.5" />
            </TextLink>
          ))}
          {supportEmail && (
            <TextLink className="text-sm/[1.6] wrap-anywhere" href={`mailto:${supportEmail}`}>
              {s.support} {supportEmail}
            </TextLink>
          )}
        </div>
      </Container>
    </section>
  );
}
