import { Container } from "@/components/ui/container";
import { Eyebrow, HeadingMark, SectionTitle, sectionSpaceClassName } from "@/components/ui/section-heading";
import { TextLink } from "@/components/ui/text-link";
import { configuredVideo, videoMimeType, type Lang, type PromoVideo as Video } from "@/data/site";
import { langs, useCopy } from "@/i18n";
import { Icon } from "./Icon";

/**
 * 首屏下方的宣传视频：原生 <video> 带控件，不自动播放、不带声音打断访客，先只取元数据，封面图撑住版面。
 * 视频地址在 src/data/site.ts 的 promoVideo，没配置时整个区块不渲染。
 */
export function PromoVideo({ lang, video = configuredVideo() }: { lang: Lang; video?: Video }) {
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
        {/* 面板与卡片同一套：细描边、不铺底色、不加阴影；黑底是给视频两侧留边用的。 */}
        <figure className="overflow-hidden rounded-panel border border-border bg-card">
          <video
            className="block aspect-video w-full bg-black"
            controls
            playsInline
            preload="metadata"
            poster={video.poster || undefined}
            aria-label={v.label}
          >
            <source src={video.src} type={type} />
            {langs.map((captionLang) => {
              const src = video.captions[captionLang];
              return src ? (
                <track
                  key={captionLang}
                  kind="subtitles"
                  src={src}
                  srcLang={captionLang}
                  label={captionLang === "zh" ? "中文" : "English"}
                  default={captionLang === lang}
                />
              ) : null;
            })}
            <p className="p-6 text-base/body text-muted-foreground">
              {v.fallback}{" "}
              <TextLink href={video.src}>
                {v.download} <Icon name="up-right" className="size-3.5" />
              </TextLink>
            </p>
          </video>
          <figcaption className="sr-only">{v.label}</figcaption>
        </figure>
      </Container>
    </section>
  );
}
