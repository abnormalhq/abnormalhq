"use client";

import {
  MaximizeIcon,
  MinimizeIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  Volume1Icon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type Ref,
} from "react";
import { Spinner } from "@/components/ui/spinner";
import type { Copy } from "@/i18n/types";
import { fillTemplate } from "@/lib/template";
import { formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";

/** The strings the player needs; PromoVideo passes them in so the browser bundle does not carry the whole copy. */
export type PlayerCopy = Pick<
  Copy["video"],
  | "label"
  | "fallback"
  | "play"
  | "pause"
  | "replay"
  | "mute"
  | "unmute"
  | "fullscreen"
  | "exitFullscreen"
  | "seek"
  | "seekTemplate"
  | "volume"
>;

/** Seconds a single arrow press moves the playhead. */
const STEP = 5;
/** How long the controls stay up after the last pointer move while the video plays. */
const IDLE_MS = 2500;

// false while hydrating (so the prerendered native <video controls> is matched), true right after.
const subscribe = () => () => {};
const enhancedOnClient = () => true;
const notEnhancedOnServer = () => false;

type VideoElement = HTMLVideoElement & { webkitEnterFullscreen?: () => void; webkitDisplayingFullscreen?: boolean };

/**
 * The promo video's player: the site's own controls over a native <video>. The prerendered HTML is a plain
 * <video controls>, so without JavaScript, or before hydration, the browser's own player still works; once
 * hydrated the native controls give way to these. Nothing autoplays and only metadata loads up front.
 *
 * Controls: a large play button over the poster, then a floating bar with play / pause, a seek slider (with
 * buffered range), the time, mute and volume, and fullscreen (the whole player, or the video's own on iOS,
 * which only lets <video> go fullscreen). While playing the bar fades out after the pointer rests and comes
 * back on any move, tap or focus. Keys, while focus is in the player: Space / K play and pause, ← / → seek
 * 5 seconds, M mutes, F toggles fullscreen.
 */
export function VideoPlayer({
  src,
  type,
  poster,
  copy,
  className,
}: {
  src: string;
  type?: string;
  poster?: string;
  copy: PlayerCopy;
  className?: string;
}) {
  const enhanced = useSyncExternalStore(subscribe, enhancedOnClient, notEnhancedOnServer);
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<VideoElement>(null);

  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const [idle, setIdle] = useState(false);
  // Keyboard focus inside the bar keeps it up: someone tabbing or seeking with arrows should not lose it mid-use.
  const [barFocused, setBarFocused] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const overlayRef = useRef<HTMLButtonElement>(null);
  const barPlayRef = useRef<HTMLButtonElement>(null);
  // Set when the big button had focus as it started playback; it unmounts, so focus moves to the bar's play button.
  const refocusBar = useRef(false);

  const wake = useCallback(() => {
    setIdle(false);
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setIdle(true), IDLE_MS);
  }, []);
  useEffect(() => () => clearTimeout(idleTimer.current), []);

  // Mirror the element's state; it can also change from outside the controls (the OS media keys, iOS fullscreen).
  useEffect(() => {
    const video = videoRef.current;
    if (!enhanced || !video) return;
    const sync = () => {
      setPlaying(!video.paused);
      setEnded(video.ended);
      setTime(video.currentTime);
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
      setMuted(video.muted);
      setVolume(video.volume);
      const ranges = video.buffered;
      setBuffered(ranges.length ? ranges.end(ranges.length - 1) : 0);
    };
    const onPlay = () => {
      setStarted(true);
      sync();
    };
    const onWaiting = () => setWaiting(true);
    const onReady = () => setWaiting(false);
    const onError = () => setFailed(true);
    const events: [string, () => void][] = [
      ["play", onPlay],
      ["pause", sync],
      ["ended", sync],
      ["timeupdate", sync],
      ["durationchange", sync],
      ["loadedmetadata", sync],
      ["progress", sync],
      ["volumechange", sync],
      ["seeked", sync],
      ["waiting", onWaiting],
      ["playing", onReady],
      ["canplay", onReady],
      ["seeked", onReady],
      ["pause", onReady],
      ["error", onError],
    ];
    for (const [name, handler] of events) video.addEventListener(name, handler);
    // A <source> that fails reports on itself, not on the <video>.
    const source = video.querySelector("source");
    source?.addEventListener("error", onError);
    sync();
    // The native player may have been used before hydration: keep its playback in the bar, not under the big button.
    if (!video.paused || video.currentTime > 0) setStarted(true);
    // A source that failed before hydration fired its error unheard and leaves video.error null; the element is then
    // left with no usable source and nothing loaded.
    if (video.error || (video.networkState === video.NETWORK_NO_SOURCE && video.readyState === video.HAVE_NOTHING)) {
      setFailed(true);
    }
    setCanFullscreen(Boolean(document.fullscreenEnabled || video.webkitEnterFullscreen));
    return () => {
      for (const [name, handler] of events) video.removeEventListener(name, handler);
      source?.removeEventListener("error", onError);
    };
  }, [enhanced]);

  const overlayShown = !started || ended;
  useEffect(() => {
    if (overlayShown || !refocusBar.current) return;
    refocusBar.current = false;
    barPlayRef.current?.focus();
  }, [overlayShown]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || video.ended) {
      // play() rejects when the browser blocks it or the source fails; the error event reports the latter.
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, []);

  const seekTo = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    video.currentTime = Math.min(Math.max(seconds, 0), video.duration);
    setTime(video.currentTime);
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    // Unmuting at volume 0 would stay silent, so it brings the volume back too.
    if (video.muted || video.volume === 0) {
      video.muted = false;
      if (video.volume === 0) video.volume = 1;
    } else {
      video.muted = true;
    }
  }, []);

  const setLevel = useCallback((level: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = Math.min(Math.max(level, 0), 1);
    video.muted = video.volume === 0;
  }, []);

  const toggleFullscreen = useCallback(() => {
    const root = rootRef.current;
    const video = videoRef.current;
    if (!root || !video) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (document.fullscreenEnabled) {
      root.requestFullscreen().catch(() => {});
    } else {
      video.webkitEnterFullscreen?.();
    }
  }, []);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const onButton = (event.target as HTMLElement).closest("button");
    switch (event.key) {
      case " ":
        // A focused button already answers Space with a click.
        if (onButton) return;
        toggle();
        break;
      case "k":
      case "K":
        toggle();
        break;
      case "ArrowLeft":
        seekTo((videoRef.current?.currentTime ?? 0) - STEP);
        break;
      case "ArrowRight":
        seekTo((videoRef.current?.currentTime ?? 0) + STEP);
        break;
      case "m":
      case "M":
        toggleMute();
        break;
      case "f":
      case "F":
        if (canFullscreen) toggleFullscreen();
        break;
      default:
        return;
    }
    event.preventDefault();
    wake();
  };

  if (!enhanced) {
    return (
      <div className={cn("relative", className)}>
        <video
          className="block aspect-video w-full bg-[#f7f7f4]"
          controls
          playsInline
          preload="metadata"
          poster={poster}
          aria-label={copy.label}
        >
          <source src={src} type={type} />
          {/* Shown only by browsers without <video> support; when decoding fails the element still exists, so the download link sits separately below. */}
          <p className="p-6 text-base/body text-muted-foreground">{copy.fallback}</p>
        </video>
      </div>
    );
  }

  const silent = muted || volume === 0;
  const VolumeGlyph = silent ? VolumeXIcon : volume < 0.5 ? Volume1Icon : Volume2Icon;
  // The bar shows before the first play only as the big button; afterwards it hides only while playing and idle.
  const autoHidden = playing && idle && !barFocused;
  const barHidden = !started || autoHidden;

  return (
    <div
      ref={rootRef}
      className={cn(
        "group/player relative isolate select-none",
        fullscreen ? "flex items-center bg-black" : "bg-[#f7f7f4]",
        autoHidden && "cursor-none",
        className,
      )}
      data-state={playing ? "playing" : "paused"}
      onPointerMove={wake}
      onPointerDown={wake}
      onFocusCapture={wake}
      onKeyDown={onKeyDown}
    >
      <video
        ref={videoRef}
        className={cn("block aspect-video w-full", fullscreen && "h-full object-contain")}
        playsInline
        preload="metadata"
        poster={poster}
        aria-label={copy.label}
        onClick={toggle}
      >
        <source src={src} type={type} />
      </video>

      {waiting && playing && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="grid size-14 place-items-center rounded-full bg-popover/90 text-foreground shadow-popover backdrop-blur-sm">
            <Spinner className="size-6 border-2" />
          </span>
        </div>
      )}

      {failed ? (
        <div className="absolute inset-0 grid place-items-center bg-card/90 p-6 text-center">
          <p className="max-w-[28rem] text-base/body text-muted-foreground" role="alert">
            {copy.fallback}
          </p>
        </div>
      ) : (
        overlayShown && (
          <button
            ref={overlayRef}
            type="button"
            className="absolute inset-0 grid place-items-center focus-visible:outline-none [&:focus-visible>span]:outline-2 [&:focus-visible>span]:outline-offset-4 [&:focus-visible>span]:outline-focus"
            onClick={() => {
              refocusBar.current = document.activeElement === overlayRef.current;
              toggle();
            }}
            aria-label={ended ? copy.replay : copy.play}
          >
            <span className="grid size-[4.5rem] place-items-center rounded-full bg-brand text-brand-foreground shadow-popover transition-transform duration-150 group-hover/player:scale-105 active:scale-95 max-md:size-14">
              {ended ? (
                <RotateCcwIcon className="size-7 max-md:size-6" strokeWidth={1.8} aria-hidden="true" />
              ) : (
                <PlayIcon
                  className="size-7 translate-x-[2px] fill-current max-md:size-6"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              )}
            </span>
          </button>
        )
      )}

      <div
        className={cn(
          "absolute inset-x-3 bottom-3 flex items-center gap-1 rounded-panel border border-border bg-popover/90 px-1.5 py-1.5 text-foreground shadow-popover backdrop-blur-md transition-[opacity,translate] duration-200 max-phone:inset-x-2 max-phone:bottom-2 max-phone:gap-0.5",
          barHidden && "pointer-events-none translate-y-1 opacity-0",
          failed && "hidden",
        )}
        // Hidden from assistive tech only before the first play, when the big button is the one control.
        inert={!started}
        onFocus={(event) => setBarFocused(event.target.matches(":focus-visible"))}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setBarFocused(false);
        }}
      >
        <BarButton ref={barPlayRef} label={playing ? copy.pause : ended ? copy.replay : copy.play} onClick={toggle}>
          {playing ? (
            <PauseIcon className="fill-current" />
          ) : ended ? (
            <RotateCcwIcon />
          ) : (
            <PlayIcon className="translate-x-px fill-current" />
          )}
        </BarButton>

        <span className="shrink-0 px-1.5 text-sm tabular-nums text-muted-foreground max-phone:px-1 max-phone:text-xs">
          <span className="text-foreground">{formatTime(time)}</span>
          <span aria-hidden="true"> / </span>
          <span className="sr-only">, </span>
          {formatTime(duration)}
        </span>

        <Slider
          className="mx-1.5 flex-1"
          label={copy.seek}
          value={time}
          max={duration}
          buffered={buffered}
          step={STEP}
          valueText={fillTemplate(copy.seekTemplate, {
            current: formatTime(time),
            duration: formatTime(duration),
          }).join("")}
          onChange={seekTo}
        />

        <div className="group/volume flex shrink-0 items-center">
          <BarButton label={silent ? copy.unmute : copy.mute} onClick={toggleMute}>
            <VolumeGlyph />
          </BarButton>
          {/* Volume only on wide screens: phones control it with their buttons, and iOS ignores it anyway. */}
          <Slider
            className="w-0 opacity-0 transition-[width,opacity,margin] duration-200 group-focus-within/volume:mr-2 group-focus-within/volume:ml-1 group-focus-within/volume:w-20 group-focus-within/volume:opacity-100 group-hover/volume:mr-2 group-hover/volume:ml-1 group-hover/volume:w-20 group-hover/volume:opacity-100 max-md:hidden"
            label={copy.volume}
            value={silent ? 0 : volume}
            max={1}
            step={0.1}
            valueText={`${Math.round((silent ? 0 : volume) * 100)}%`}
            onChange={setLevel}
          />
        </div>

        {canFullscreen && (
          <BarButton label={fullscreen ? copy.exitFullscreen : copy.fullscreen} onClick={toggleFullscreen}>
            {fullscreen ? <MinimizeIcon /> : <MaximizeIcon />}
          </BarButton>
        )}
      </div>
    </div>
  );
}

function BarButton({
  ref,
  label,
  onClick,
  children,
}: {
  ref?: Ref<HTMLButtonElement>;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      ref={ref}
      type="button"
      className="grid size-8 shrink-0 place-items-center rounded-control text-foreground transition-colors duration-150 hover:bg-control focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus active:scale-[0.96] [&_svg]:size-4 [&_svg]:shrink-0"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/**
 * A horizontal slider (role="slider") for the playhead and the volume: drag or click anywhere on the track,
 * arrows step, Page Up / Down take tenths, Home / End jump to the ends. A native range input cannot draw the
 * buffered range, and its thumb and track need different pseudo-elements in every engine.
 */
function Slider({
  label,
  value,
  max,
  step,
  buffered = 0,
  valueText,
  onChange,
  className,
}: {
  label: string;
  value: number;
  max: number;
  step: number;
  buffered?: number;
  valueText: string;
  onChange: (value: number) => void;
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const ratio = (n: number) => (max > 0 ? Math.min(Math.max(n / max, 0), 1) : 0);

  const fromPointer = (event: PointerEvent) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect?.width) return;
    onChange(((event.clientX - rect.left) / rect.width) * max);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const next = (
      {
        ArrowLeft: value - step,
        ArrowDown: value - step,
        ArrowRight: value + step,
        ArrowUp: value + step,
        PageDown: value - max / 10,
        PageUp: value + max / 10,
        Home: 0,
        End: max,
      } as Record<string, number>
    )[event.key];
    if (next === undefined) return;
    event.preventDefault();
    // The player's own arrows would seek the video; here they move this slider only.
    event.stopPropagation();
    onChange(Math.min(Math.max(next, 0), max));
  };

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(max * 100) / 100}
      aria-valuenow={Math.round(value * 100) / 100}
      aria-valuetext={valueText}
      aria-orientation="horizontal"
      className={cn(
        "group/slider relative flex h-8 min-w-0 cursor-pointer touch-none items-center rounded-control outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus",
        className,
      )}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
        fromPointer(event);
      }}
      onPointerMove={(event) => {
        if (dragging) fromPointer(event);
      }}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
    >
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-control transition-[height] duration-150 group-hover/slider:h-1.5">
        <div className="absolute inset-y-0 left-0 bg-input" style={{ width: `${ratio(buffered) * 100}%` }} />
        <div className="absolute inset-y-0 left-0 bg-brand" style={{ width: `${ratio(value) * 100}%` }} />
      </div>
      <div
        className={cn(
          "pointer-events-none absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand shadow-popover transition-transform duration-150",
          dragging ? "scale-110" : "scale-0 group-hover/slider:scale-100 group-focus-visible/slider:scale-100",
        )}
        style={{ left: `${ratio(value) * 100}%` }}
      />
    </div>
  );
}
