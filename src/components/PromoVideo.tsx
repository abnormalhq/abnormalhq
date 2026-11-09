import { Container } from "@/components/ui/container";
import { Eyebrow, HeadingMark, SectionTitle, sectionSpaceClassName } from "@/components/ui/section-heading";
import { TextLink } from "@/components/ui/text-link";
import { configuredVideo, videoMimeType, type Lang, type PromoVideo as Video } from "@/data/site";
import { useCopy } from "@/i18n";
import { Icon } from "./Icon";
import { VideoPlayer } from "./VideoPlayer";

/**
 * The promo video under the hero, in the site's own player (VideoPlayer): it does not autoplay or interrupt visitors with sound, loads only metadata at first, and lets the poster hold the layout.
 * Before hydration, and without JavaScript, the player is a native <video controls>.
 * One per language (the text in the film is the page's language); the addresses are in promoVideos in src/data/site.ts, and without one the whole section is not rendered.
 */
export function PromoVideo({ lang, video = configuredVideo(lang) }: { lang: Lang; video?: Video | null }) {
  const { t } = useCopy(lang);
  if (!video) return null;
  const v = t.video;
  const type = videoMimeType(video.src);

  return (
    <section className="border-t border-border" id="video" aria-labelledby="video-title">
      <Container className={sectionSpaceClassName}>
        <div className="mb-10 flex items-end justify-between gap-8 max-lg:gap-4 max-md:mb-7 max-md:flex-col max-md:items-start">
          <div>
            <Eyebrow lang="en">{v.eyebrow}</Eyebrow>
            <SectionTitle id="video-title">
              {v.title}
              <HeadingMark>{t.dot}</HeadingMark>
            </SectionTitle>
          </div>
          <p className="max-w-[34rem] pb-[0.2rem] text-md/prose text-muted-foreground">{v.description}</p>
        </div>
        {/* Same treatment as the cards: a thin border, no fill, no shadow. The video is a paper-colored picture, so the background is paper too and no black bars show. */}
        <figure className="overflow-hidden rounded-panel border border-border bg-card">
          <VideoPlayer
            src={video.src}
            type={type}
            poster={video.poster || undefined}
            copy={{
              label: v.label,
              fallback: v.fallback,
              play: v.play,
              pause: v.pause,
              replay: v.replay,
              mute: v.mute,
              unmute: v.unmute,
              fullscreen: v.fullscreen,
              exitFullscreen: v.exitFullscreen,
              seek: v.seek,
              seekTemplate: v.seekTemplate,
              volume: v.volume,
            }}
          />
          <figcaption className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-border px-5 py-3 text-sm/[1.6] text-muted-foreground max-phone:px-4">
            <span>{v.label}</span>
            <TextLink className="text-sm/[1.6]" href={video.src} download>
              {v.download} <Icon name="up-right" className="size-3.5" />
            </TextLink>
          </figcaption>
        </figure>
      </Container>
    </section>
  );
}
