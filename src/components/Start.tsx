import { Container } from "@/components/ui/container";
import { Eyebrow, SectionTitle, sectionSpaceClassName } from "@/components/ui/section-heading";
import { TextLink } from "@/components/ui/text-link";
import { site, type Lang } from "@/data/site";
import { getCopy } from "@/i18n";
import { reveal } from "@/lib/reveal";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";

export function Start({ lang }: { lang: Lang }) {
  const { t, links } = getCopy(lang);
  const s = t.start;
  const supportEmail = site.contact.email.trim();

  return (
    <section className="border-t border-border" id="start" aria-labelledby="start-title">
      {/* "how-it-works" was the activation steps section this one replaced; the id keeps its saved links landing here. */}
      <Container className={sectionSpaceClassName} id="how-it-works">
        <div
          className="mb-10 flex items-end justify-between gap-8 max-lg:gap-4 max-md:mb-7 max-md:flex-col max-md:items-start"
          {...reveal()}
        >
          <div>
            <Eyebrow lang="en">{s.eyebrow}</Eyebrow>
            <SectionTitle id="start-title">
              {s.title}
              {t.dot}
            </SectionTitle>
          </div>
          <p className="pb-0.75 text-md/prose text-muted-foreground">
            {s.intro[0]}
            {t.space}
            <br className="hidden md:block" />
            {s.intro[1]}
          </p>
        </div>
        {/* Four columns of a contents page, each opened by a hairline and its number in the serif: no boxes, no tiles.
            The whole column is the link; the first is the usual way in, so its action is underlined from the start. */}
        <div className="grid grid-cols-4 gap-x-10 gap-y-12 max-lg:grid-cols-2 max-sm:grid-cols-1">
          {s.entries.map((entry, index) => (
            <a
              className="group/entry flex flex-col border-t border-border pt-5 transition-colors duration-150 hover:border-foreground"
              href={links[entry.link]}
              key={entry.title}
              {...reveal(index)}
            >
              <span className="flex items-baseline justify-between gap-3">
                <span
                  className="font-serif text-3xl leading-none font-normal text-muted-foreground lining-nums"
                  aria-hidden="true"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-xs/body text-muted-foreground">{entry.eyebrow}</span>
              </span>
              <span className="mt-6 text-xl/[1.4] font-semibold tracking-title">{entry.title}</span>
              <span className="mt-2 flex-1 text-base/prose text-muted-foreground">{entry.description}</span>
              <span
                className={cn(
                  "mt-5 inline-flex items-center gap-1.5 self-start text-base/body font-medium underline-offset-4 group-hover/entry:underline",
                  entry.primary && "underline",
                )}
              >
                {entry.action}
                <Icon name="up-right" className="size-4 text-muted-foreground group-hover/entry:text-foreground" />
              </span>
            </a>
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
