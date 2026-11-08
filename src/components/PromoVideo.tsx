import { Container } from "@/components/ui/container";
import { Eyebrow, HeadingMark, SectionTitle, sectionSpaceClassName } from "@/components/ui/section-heading";
import { TextLink } from "@/components/ui/text-link";
import { configuredVideo, videoMimeType, type Lang, type PromoVideo as Video } from "@/data/site";
import { useCopy } from "@/i18n";
import { Icon } from "./Icon";

/**
 * 首屏下方的宣传视频：原生 <video> 带控件，不自动播放、不带声音打断访客，先只取元数据，封面图撑住版面。
 * 两种语言各一段（片中文字就是页面的语言），地址在 src/data/site.ts 的 promoVideos；没配置时整个区块不渲染。
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
        {/* 面板与卡片同一套：细描边、不铺底色、不加阴影。视频本身是纸色画面，底色用纸色，不露黑边。 */}
        <figure className="overflow-hidden rounded-panel border border-border bg-card">
          <video
            className="block aspect-video w-full bg-[#f7f7f4]"
            controls
            playsInline
            preload="metadata"
            poster={video.poster || undefined}
            aria-label={v.label}
          >
            <source src={video.src} type={type} />
            {/* 只有不支持 <video> 的浏览器会显示；解码失败时元素照常存在，所以下载链接另放在下面。 */}
            <p className="p-6 text-base/body text-muted-foreground">{v.fallback}</p>
          </video>
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
