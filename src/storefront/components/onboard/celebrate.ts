/**
 * The celebration on successful activation: the heading bursts, confetti fires from both sides in a row, then a shower of paper falls.
 * Reuses the highlight, brand, text-secondary and badge-ink theme colours (highlight yellow first); canvas-confetti is loaded on demand only on success;
 * leaving the page or enabling reduced motion cancels further shots and clears the canvas.
 */
import type { Options } from "canvas-confetti";

const TOKENS = ["--highlight", "--brand", "--text-secondary", "--badge-ink"] as const;
const FALLBACK_COLORS = ["#ffe14d", "#141412", "#5c5c55", "#704800"];

/** Current token values: the dark theme has a different set; canvas-confetti only accepts hex. */
function tokenColors(): string[] {
  const style = getComputedStyle(document.documentElement);
  const colors = TOKENS.map((name) => style.getPropertyValue(name).trim()).filter((value) =>
    /^#[0-9a-f]{3,8}$/i.test(value),
  );
  return colors.length > 0 ? colors : FALLBACK_COLORS;
}

/** Fires from the centre of the result heading; without an anchor, from a third of the way down the page. */
function originOf(anchor: HTMLElement | null): { x: number; y: number } {
  if (!anchor) return { x: 0.5, y: 0.35 };
  const rect = anchor.getBoundingClientRect();
  const clamp = (value: number) => Math.min(0.9, Math.max(0.1, value));
  return {
    x: clamp((rect.left + rect.width / 2) / window.innerWidth),
    y: clamp((rect.top + rect.height / 2) / window.innerHeight),
  };
}

/** Cancelling also ends the wait, so no confetti or dangling Promise survives leaving the page. */
function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const finish = () => {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = window.setTimeout(finish, ms);
    signal.addEventListener("abort", finish, { once: true });
  });
}

export async function celebrate(anchor: HTMLElement | null, signal: AbortSignal): Promise<void> {
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (signal.aborted || motion.matches) return;

  let cleanUp: (() => void) | undefined;
  try {
    const { default: confetti } = await import("canvas-confetti");
    if (signal.aborted || motion.matches) return;

    const fire = confetti.create(undefined, {
      resize: true,
      useWorker: true,
      disableForReducedMotion: true,
    });
    let stopped = false;
    const stop = () => {
      stopped = true;
      fire.reset();
    };
    signal.addEventListener("abort", stop, { once: true });
    motion.addEventListener("change", stop);
    cleanUp = () => {
      signal.removeEventListener("abort", stop);
      motion.removeEventListener("change", stop);
      fire.reset();
    };

    const density = window.innerWidth < 640 ? 0.65 : 1;
    const base: Options = {
      colors: tokenColors(),
      shapes: ["circle", "square"],
      scalar: 1.45,
      gravity: 0.75,
      decay: 0.92,
      ticks: 300,
      disableForReducedMotion: true,
    };
    let finished: ReturnType<typeof fire> = null;
    const burst = (options: Options) => {
      finished = fire({
        ...base,
        ...options,
        particleCount: Math.round((options.particleCount ?? 0) * density),
      });
    };

    burst({
      origin: originOf(anchor),
      particleCount: 150,
      angle: 90,
      spread: 150,
      startVelocity: 48,
      scalar: 1.6,
    });

    // Three rounds of confetti fire from both screen edges toward the centre, covering the whole viewport.
    for (const wave of [
      { delay: 0, count: 130, velocity: 64 },
      { delay: 260, count: 90, velocity: 58 },
      { delay: 400, count: 65, velocity: 50 },
    ]) {
      if (wave.delay) await pause(wave.delay, signal);
      if (signal.aborted || motion.matches || stopped) return;
      for (const left of [true, false]) {
        burst({
          origin: { x: left ? 0.03 : 0.97, y: 0.78 },
          particleCount: wave.count,
          angle: left ? 60 : 120,
          spread: 65,
          startVelocity: wave.velocity,
          drift: left ? 0.4 : -0.4,
        });
      }
    }

    await pause(340, signal);
    if (signal.aborted || motion.matches || stopped) return;
    // The final beat covers the top and falls slowly, no longer confined to the small area around the heading.
    for (let column = 0; column < 8; column++) {
      burst({
        origin: { x: (column + 0.5) / 8, y: -0.08 },
        particleCount: 16,
        angle: 270,
        spread: 55,
        startVelocity: 12,
        gravity: 0.6,
        ticks: 330,
        scalar: 1.3,
      });
    }
    await finished;
  } catch {
    // Offline or script blocked: no celebration is fine.
  } finally {
    cleanUp?.();
  }
}
