/**
 * 合成宣传视频的背景音乐，写到 assets/music.wav（不提交，渲染前由 pnpm music 生成）。
 * 没有现成的配乐素材，也不想引入版权问题，所以用代码直接合成：C 大调，96 BPM，
 * Cmaj9 → Am9 → Fmaj9 → G6/9 的循环，铺底音色、电钢琴和弦、贝斯、琶音与轻鼓点分层进入，
 * 末尾回到 C 和弦收束。噪声用固定种子，每次生成的文件完全一样。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SAMPLE_RATE = 44100;
const SECONDS = 36;
const BPM = 96;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const BARS = Math.floor(35 / BAR); // 14 小节，最后一小节是收束和弦

const left = new Float64Array(SAMPLE_RATE * SECONDS);
const right = new Float64Array(SAMPLE_RATE * SECONDS);

const midiHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const TAU = Math.PI * 2;

/** 固定种子的随机数（mulberry32），给鼓点里的噪声用。 */
let seed = 0x5eed;
function random() {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** 把一个音符写进缓冲区：wave(t) 给出振幅，env(t) 给出包络，pan 在 -1（左）到 1（右）之间。 */
function play(
  start: number,
  duration: number,
  gain: number,
  wave: (t: number) => number,
  env: (t: number) => number,
  pan = 0,
) {
  const from = Math.floor(start * SAMPLE_RATE);
  const to = Math.min(left.length, Math.floor((start + duration) * SAMPLE_RATE));
  const l = Math.cos(((pan + 1) / 4) * Math.PI);
  const r = Math.sin(((pan + 1) / 4) * Math.PI);
  for (let i = from; i < to; i++) {
    const t = (i - from) / SAMPLE_RATE;
    const value = wave(t) * env(t) * gain;
    left[i]! += value * l;
    right[i]! += value * r;
  }
}

const tone = (hz: number, harmonics: readonly number[]) => (t: number) =>
  harmonics.reduce((sum, level, index) => sum + level * Math.sin(TAU * hz * (index + 1) * t), 0);
const pluck = (tau: number) => (t: number) => Math.exp(-t / tau) * Math.min(1, t / 0.004);
const swell = (attack: number, hold: number, release: number) => (t: number) =>
  t < attack ? t / attack : t < attack + hold ? 1 : Math.max(0, 1 - (t - attack - hold) / release);

// 和弦：根音（MIDI）与九和弦的音程。C4 = 60。
const progression = [
  { root: 60, intervals: [0, 4, 7, 11, 14] }, // Cmaj9
  { root: 57, intervals: [0, 3, 7, 10, 14] }, // Am9
  { root: 53, intervals: [0, 4, 7, 11, 14] }, // Fmaj9
  { root: 55, intervals: [0, 4, 7, 9, 14] }, // G6/9
] as const;

for (let bar = 0; bar < BARS; bar++) {
  const last = bar === BARS - 1;
  const chord = last ? progression[0] : progression[bar % progression.length]!;
  const at = bar * BAR;
  const notes = chord.intervals.map((interval) => chord.root + interval);

  // 铺底：每个和弦音两路微失谐的柔和音色，慢起慢收，整段都在。
  for (const note of notes) {
    for (const detune of [-0.6, 0.6]) {
      const hz = midiHz(note - 12) * 2 ** (detune / 1200);
      play(
        at,
        last ? 3.4 : BAR + 0.4,
        0.028,
        tone(hz, [1, 0.35, 0.12]),
        swell(0.5, (last ? 3.4 : BAR + 0.4) - 1.2, 0.7),
        detune,
      );
    }
  }

  // 电钢琴：每小节三下和弦（第 1 拍、第 2 拍半、第 4 拍），收束小节只弹一下。
  const stabs = last
    ? [[0, 1]]
    : [
        [0, 1],
        [1.5, 0.7],
        [3, 0.8],
      ];
  for (const [beat, velocity] of stabs) {
    for (const [index, note] of notes.slice(1).entries()) {
      play(
        at + beat! * BEAT,
        last ? 3.4 : 1.6,
        0.05 * velocity!,
        tone(midiHz(note), [1, 0.3, 0.08, 0.04]),
        pluck(last ? 1.2 : 0.55),
        (index - 1.5) * 0.25,
      );
    }
  }

  // 贝斯：根音，第 1 与第 3 拍，第二小节起进入。
  if (bar >= 1) {
    for (const beat of last ? [0] : [0, 2]) {
      play(
        at + beat * BEAT,
        last ? 3.2 : BEAT * 1.9,
        0.11,
        tone(midiHz(chord.root - 24), [1, 0.25, 0.06]),
        (t) => Math.min(1, t / 0.015) * Math.exp(-t / (last ? 1.6 : 0.9)),
      );
    }
  }

  // 琶音：八分音符，和弦音上下走，第四小节起进入，左右轻微摆动。
  if (bar >= 3 && !last) {
    const pattern = [0, 1, 2, 3, 4, 3, 2, 1];
    for (const [step, degree] of pattern.entries()) {
      const note = notes[degree]! + 12;
      play(
        at + step * (BEAT / 2),
        0.6,
        0.032,
        tone(midiHz(note), [1, 0.2]),
        pluck(0.17),
        step % 2 === 0 ? -0.35 : 0.35,
      );
    }
  }

  // 鼓点：第三小节起。底鼓在 1、3 拍，轻边击在 2、4 拍，踩镲走八分音符，都很轻。
  if (bar >= 2 && !last) {
    for (const beat of [0, 2]) {
      play(
        at + beat * BEAT,
        0.3,
        0.22,
        (t) => Math.sin(TAU * (45 + 70 * Math.exp(-t / 0.045)) * t),
        (t) => Math.exp(-t / 0.11),
      );
    }
    for (const beat of [1, 3]) {
      play(
        at + beat * BEAT,
        0.15,
        0.032,
        (t) => (random() * 2 - 1) * 0.6 + 0.5 * Math.sin(TAU * 190 * t),
        (t) => Math.exp(-t / 0.04),
      );
    }
    for (let eighth = 0; eighth < 8; eighth++) {
      let previous = 0;
      play(
        at + eighth * (BEAT / 2),
        0.08,
        eighth % 2 === 0 ? 0.012 : 0.02,
        () => {
          // 白噪声过一阶高通再减半，只留一点沙沙的高频。
          const sample = random() * 2 - 1;
          const high = (sample - previous) * 0.5;
          previous = sample;
          return high;
        },
        (t) => Math.exp(-t / 0.022),
        0.3,
      );
    }
  }
}

// 总线：轻微饱和，开头淡入，结尾随收束和弦淡出，再按峰值归一化。
let peak = 0;
for (let i = 0; i < left.length; i++) {
  const t = i / SAMPLE_RATE;
  const fade = Math.min(1, t / 0.4) * (t > SECONDS - 3.5 ? Math.max(0, (SECONDS - t) / 3.5) : 1);
  left[i] = Math.tanh(left[i]! * 1.3) * fade;
  right[i] = Math.tanh(right[i]! * 1.3) * fade;
  peak = Math.max(peak, Math.abs(left[i]!), Math.abs(right[i]!));
}
const normalize = 0.72 / peak;

// 16 位 PCM 立体声 WAV。
const frames = left.length;
const buffer = Buffer.alloc(44 + frames * 4);
buffer.write("RIFF", 0);
buffer.writeUInt32LE(36 + frames * 4, 4);
buffer.write("WAVE", 8);
buffer.write("fmt ", 12);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20);
buffer.writeUInt16LE(2, 22);
buffer.writeUInt32LE(SAMPLE_RATE, 24);
buffer.writeUInt32LE(SAMPLE_RATE * 4, 28);
buffer.writeUInt16LE(4, 32);
buffer.writeUInt16LE(16, 34);
buffer.write("data", 36);
buffer.writeUInt32LE(frames * 4, 40);
for (let i = 0; i < frames; i++) {
  buffer.writeInt16LE(Math.round(left[i]! * normalize * 32767), 44 + i * 4);
  buffer.writeInt16LE(Math.round(right[i]! * normalize * 32767), 46 + i * 4);
}

const out = new URL("../assets/music.wav", import.meta.url);
mkdirSync(new URL("../assets/", import.meta.url), { recursive: true });
writeFileSync(out, buffer);
console.log(`${fileURLToPath(out)} (${SECONDS}s, ${(buffer.length / 1024 / 1024).toFixed(1)} MB)`);
