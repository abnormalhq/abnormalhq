import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { IconTile } from "@/components/ui/icon-tile";
import { Eyebrow, HeadingMark, SectionTitle, sectionSpaceClassName } from "@/components/ui/section-heading";
import { TextLink } from "@/components/ui/text-link";
import { desktopDownloads, type Lang } from "@/data/site";
import { useCopy } from "@/i18n";
import { fileLabel, formatSize, releaseDate, type DesktopReleases } from "@/lib/releases";
import { Icon } from "./Icon";

/**
 * Desktop client download page: current version number, one card per platform, sign-in notes, past releases and checksums.
 * releases is read on every request (src/lib/releases.ts); when unavailable, the version number and past releases are hidden and the download buttons still work.
 */
export function Download({ lang, releases }: { lang: Lang; releases?: DesktopReleases }) {
  const { t, links } = useCopy(lang);
  const d = t.download;
  const platforms = [
    { ...d.macos, href: desktopDownloads.macos, brew: true, arm: undefined },
    { ...d.windows, href: desktopDownloads.windows, brew: false, arm: d.windows.armDownload },
  ];

  return (
    <section aria-labelledby="download-title">
      <Container className={sectionSpaceClassName}>
        <Eyebrow lang="en">{d.eyebrow}</Eyebrow>
        <SectionTitle asChild>
          <h1 id="download-title">
            {d.title}
            <HeadingMark>{t.dot}</HeadingMark>
          </h1>
        </SectionTitle>
        <p className="mt-4 max-w-2xl text-md/prose text-muted-foreground">{d.intro}</p>
        {releases && (
          <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm/[1.6] text-muted-foreground">
            <span>{d.currentLabel}</span>
            <Badge className="font-mono" variant="brand">
              {releases.current.version}
            </Badge>
            <span aria-hidden="true">·</span>
            <span>
              {d.releasedLabel} <time dateTime={releases.current.releasedAt}>{releaseDate(releases.current)}</time>
            </span>
          </p>
        )}

        <div className="mt-10 grid grid-cols-2 gap-4 max-md:grid-cols-1">
          {platforms.map((platform) => (
            <Card className="gap-0 px-[1.4rem] pt-6 pb-[1.4rem] max-sm:p-6" key={platform.name}>
              <span className="flex items-center gap-3">
                <IconTile aria-hidden="true">
                  <Icon name="monitor" className="size-5" />
                </IconTile>
                <h2 className="text-xl/[1.4] font-semibold tracking-[-0.01em]">{platform.name}</h2>
              </span>
              <p className="mt-4 text-base/prose text-muted-foreground">{platform.requirement}</p>
              <div className="mt-6">
                <Button asChild size="lg">
                  <a href={platform.href} download>
                    {platform.download}
                    <Icon name="arrow" className="size-4 rotate-90" />
                  </a>
                </Button>
              </div>
              {platform.arm && (
                <p className="mt-4">
                  {/* inline, not flex: on a narrow card the arrow follows the last word when the line wraps. */}
                  <TextLink className="inline text-sm/[1.6]" href={desktopDownloads.windowsArm} download>
                    {platform.arm} <Icon name="arrow" className="inline size-3.5 rotate-90 align-[-2px]" />
                  </TextLink>
                </p>
              )}
              {platform.brew && (
                <div className="mt-5">
                  <p className="text-sm/[1.6] text-muted-foreground">{d.macos.brewLabel}</p>
                  <pre className="mt-2 overflow-x-auto rounded-control border border-border bg-control px-3 py-2 font-mono text-sm/[1.6]">
                    <code>{desktopDownloads.brew}</code>
                  </pre>
                </div>
              )}
              <p className="mt-5 border-t border-border pt-4 text-sm/[1.6] text-muted-foreground">
                {platform.firstLaunch}
              </p>
            </Card>
          ))}
        </div>

        <div className="mt-12 max-w-2xl">
          <h2 className="text-xl/[1.4] font-semibold tracking-[-0.01em]">{d.signInTitle}</h2>
          <ol className="mt-4 grid list-decimal gap-2 pl-5 text-base/prose text-muted-foreground">
            {d.signInSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>

        {releases && (
          <div className="mt-12">
            <h2 className="text-xl/[1.4] font-semibold tracking-[-0.01em]" id="previous-versions">
              {d.historyTitle}
            </h2>
            <p className="mt-2 max-w-2xl text-base/prose text-muted-foreground">
              {releases.previous.length > 0 ? d.historyIntro : d.historyEmpty}
            </p>
            {releases.previous.length > 0 && (
              <ul aria-labelledby="previous-versions" className="mt-5 border-t border-border">
                {releases.previous.map((release) => (
                  <li
                    className="flex flex-wrap items-baseline gap-x-8 gap-y-2 border-b border-border py-4"
                    key={release.version}
                  >
                    <span className="flex min-w-40 items-baseline gap-3">
                      <span className="font-mono text-base/[1.6] font-semibold">{release.version}</span>
                      <time className="text-sm/[1.6] text-muted-foreground" dateTime={release.releasedAt}>
                        {releaseDate(release)}
                      </time>
                    </span>
                    <span className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                      {release.files.map((file) => (
                        <TextLink className="inline text-sm/[1.6]" download href={file.url} key={file.name}>
                          {fileLabel(file)}{" "}
                          <span className="font-normal whitespace-nowrap">({formatSize(file.size)})</span>
                        </TextLink>
                      ))}
                      <TextLink className="text-sm/[1.6]" href={release.manifestUrl}>
                        {d.historyChecksums} <Icon name="up-right" className="size-3.5" />
                      </TextLink>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-2">
          <TextLink className="text-sm/[1.6]" href={desktopDownloads.manifest}>
            {d.checksums} <Icon name="up-right" className="size-3.5" />
          </TextLink>
          <span className="text-sm/[1.6] text-muted-foreground">
            {d.webmailNote}
            {t.space}
            <TextLink href={links.webmail}>
              {d.webmailLink} <Icon name="up-right" className="size-3.5" />
            </TextLink>
          </span>
        </div>
      </Container>
    </section>
  );
}
