import { Container } from "@/components/ui/container";
import { IconTile } from "@/components/ui/icon-tile";
import { Eyebrow, HeadingMark, SectionTitle, sectionSpaceClassName } from "@/components/ui/section-heading";
import { TextLink } from "@/components/ui/text-link";
import type { Lang } from "@/data/site";
import { useCopy } from "@/i18n";
import { reveal } from "@/lib/reveal";
import { Icon } from "./Icon";

/**
 * "What's inside": what a mailbox can do once it is activated, then where it can be used.
 * The features sit in a hairline grid (the borders are the gaps), so the section reads as one sheet rather than nine cards.
 */
export function Features({ lang }: { lang: Lang }) {
  const { t, links, path } = useCopy(lang);
  const f = t.features;

  return (
    <section className="border-t border-border" id="features" aria-labelledby="features-title">
      <Container className={sectionSpaceClassName}>
        <div
          className="mb-10 flex items-end justify-between gap-8 max-lg:gap-4 max-md:mb-7 max-md:flex-col max-md:items-start"
          {...reveal()}
        >
          <div>
            <Eyebrow lang="en">
              <span className="mr-1">01 /</span> {f.eyebrow}
            </Eyebrow>
            <SectionTitle id="features-title">
              {f.title}
              <HeadingMark>{t.dot}</HeadingMark>
            </SectionTitle>
          </div>
          <p className="max-w-[30rem] pb-[0.2rem] text-md/prose text-muted-foreground md:text-right">
            {f.intro[0]}
            {t.space}
            <br className="hidden md:block" />
            {f.intro[1]}
          </p>
        </div>

        <ul
          className="grid overflow-hidden rounded-panel border border-border bg-border gap-px sm:grid-cols-2 lg:grid-cols-3"
          {...reveal(1)}
        >
          {f.items.map((item) => (
            <li
              className="flex flex-col bg-background px-5 py-5 sm:px-6 sm:pt-6 sm:pb-7 lg:px-7 lg:pt-7 lg:pb-8"
              key={item.title}
            >
              <div className="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-5">
                <IconTile variant="outline" size="sm" aria-hidden="true">
                  <Icon name={item.icon} className="size-4" />
                </IconTile>
                <h3 className="text-[17px] leading-[1.4] font-semibold tracking-[-0.01em]">{item.title}</h3>
              </div>
              <p className="mt-2 text-base/prose text-muted-foreground">{item.description}</p>
            </li>
          ))}
        </ul>

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
                  <p className="text-[17px] leading-[1.4] font-semibold tracking-[-0.01em]">{platform.name}</p>
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
