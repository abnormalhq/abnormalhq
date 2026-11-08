/**
 * 用 Tone.js 合成宣传视频的背景音乐，写到 assets/music.wav（不提交，渲染前由 pnpm music 生成）。
 * 没有现成的配乐素材，也不想引入版权问题，所以全部由代码生成：C 大调，96 BPM，
 * Cmaj9 → Am9 → Fmaj9 → G6/9 循环，铺底、电钢琴、贝斯、琶音与轻鼓点分层进入，末尾回到 C 和弦收束。
 *
 * Tone.js 是浏览器库，这里用 node-web-audio-api 提供 Web Audio 实现，把它需要的全局对象补上，再用
 * Tone.Offline 离线渲染。噪声源用固定种子的随机数，每次生成的文件完全一样。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as webAudio from "node-web-audio-api";

// 固定种子的随机数（mulberry32）：Tone 的噪声源与抖动都走 Math.random。
let seed = 0x5eed;
Math.random = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Tone.js 与它依赖的 standardized-audio-context 只认 window 上的 Web Audio 类。
const globals = globalThis as unknown as Record<string, unknown>;
globals.window ??= globalThis;
globals.document ??= { createElement: () => ({}), addEventListener() {}, removeEventListener() {} };
for (const [name, value] of Object.entries(webAudio)) {
  if (
    /^(Audio|Offline|Base|Gain|Oscillator|Biquad|Convolver|Delay|Dynamics|Stereo|WaveShaper|Analyser|Channel|Constant|Periodic|Panner|IIR|Media)/.test(
      name,
    )
  ) {
    globals[name] ??= value;
  }
}
const Tone = await import("tone");
// Tone 的默认上下文会去开实时的 AudioContext，Node 里没有声卡；噪声源等模块级资源都从默认上下文取，
// 所以先把默认上下文换成一个离线上下文，真正的渲染在下面的 Tone.Offline 里。
Tone.setContext(new Tone.OfflineContext(2, 0.1, 44100));

const SAMPLE_RATE = 44100;
const SECONDS = 36;
const BPM = 96;
const BAR = (60 / BPM) * 4; // 2.5 秒
const BARS = Math.floor(35 / BAR); // 14 小节，最后一小节是收束和弦

// 和弦：根音与九和弦的音程（MIDI，C4 = 60）。
const progression = [
  { root: 60, intervals: [0, 4, 7, 11, 14] }, // Cmaj9
  { root: 57, intervals: [0, 3, 7, 10, 14] }, // Am9
  { root: 53, intervals: [0, 4, 7, 11, 14] }, // Fmaj9
  { root: 55, intervals: [0, 4, 7, 9, 14] }, // G6/9
] as const;
const note = (midi: number) => Tone.Frequency(midi, "midi").toNote();
/** 第 bar 小节第 beat 拍的时间（秒）。 */
const at = (bar: number, beat = 0) => bar * BAR + (beat * BAR) / 4;

const buffer = await Tone.Offline(
  async ({ transport, destination }) => {
    // 总线：混响作为发送效果，再过压缩与限幅；主增益负责开头淡入、结尾淡出。
    const master = new Tone.Gain(0).connect(destination);
    const limiter = new Tone.Limiter(-1).connect(master);
    const compressor = new Tone.Compressor({ threshold: -18, ratio: 3, attack: 0.01, release: 0.25 }).connect(limiter);
    const reverb = new Tone.Reverb({ decay: 2.8, preDelay: 0.02, wet: 1 }).connect(compressor);
    await reverb.ready;
    const send = (level: number) => new Tone.Gain(Tone.dbToGain(level)).connect(reverb);

    // 铺底：三路失谐锯齿波，低通滤掉毛刺，慢起慢收。
    const pad = new Tone.PolySynth(Tone.Synth, {
      volume: -22,
      oscillator: { type: "fatsawtooth", count: 3, spread: 18 },
      envelope: { attack: 0.9, decay: 0.6, sustain: 0.85, release: 1.4 },
    });
    const padFilter = new Tone.Filter({ frequency: 1100, type: "lowpass", rolloff: -24, Q: 0.6 });
    pad.chain(padFilter, compressor);
    padFilter.connect(send(-10));

    // 电钢琴：FM 合成，短促的调制包络给出敲击感。
    const keys = new Tone.PolySynth(Tone.FMSynth, {
      volume: -16,
      harmonicity: 2,
      modulationIndex: 1.8,
      oscillator: { type: "sine" },
      modulation: { type: "triangle" },
      envelope: { attack: 0.004, decay: 1.1, sustain: 0.08, release: 1.2 },
      modulationEnvelope: { attack: 0.002, decay: 0.35, sustain: 0.05, release: 0.4 },
    });
    keys.connect(compressor);
    keys.connect(send(-14));

    // 贝斯：三角波单音合成器，滤波包络让每个音有一点「开口」。
    const bass = new Tone.MonoSynth({
      volume: -12,
      oscillator: { type: "triangle" },
      filter: { type: "lowpass", Q: 1, rolloff: -12 },
      envelope: { attack: 0.012, decay: 0.4, sustain: 0.6, release: 0.5 },
      filterEnvelope: { attack: 0.01, decay: 0.35, sustain: 0.25, release: 0.4, baseFrequency: 110, octaves: 2.6 },
    }).connect(compressor);

    // 琶音：短促的三角波，过乒乓延迟，左右轻微摆动。
    const arp = new Tone.Synth({
      volume: -24,
      oscillator: { type: "triangle" },
      envelope: { attack: 0.004, decay: 0.28, sustain: 0, release: 0.2 },
    });
    const pingPong = new Tone.PingPongDelay({ delayTime: "8n.", feedback: 0.22, wet: 0.28 });
    arp.chain(pingPong, compressor);
    pingPong.connect(send(-12));

    // 鼓组：膜合成底鼓、带通噪声的轻军鼓、高通噪声的踩镲。
    const kick = new Tone.MembraneSynth({
      volume: -10,
      pitchDecay: 0.04,
      octaves: 5,
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.32, sustain: 0, release: 0.2 },
    }).connect(compressor);
    const snare = new Tone.NoiseSynth({
      volume: -24,
      noise: { type: "pink" },
      envelope: { attack: 0.001, decay: 0.12, sustain: 0 },
    });
    const snareFilter = new Tone.Filter({ frequency: 1800, type: "bandpass", Q: 0.9 });
    snare.chain(snareFilter, compressor);
    snareFilter.connect(send(-16));
    const hat = new Tone.NoiseSynth({
      volume: -30,
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.035, sustain: 0 },
    });
    hat.chain(new Tone.Filter({ frequency: 8000, type: "highpass", rolloff: -24 }), compressor);

    transport.bpm.value = BPM;

    for (let bar = 0; bar < BARS; bar++) {
      const last = bar === BARS - 1;
      const chord = last ? progression[0] : progression[bar % progression.length]!;
      const notes = chord.intervals.map((interval) => chord.root + interval);

      // 铺底：低八度的整个和弦，每小节重新起一次，收束小节拉长。
      transport.schedule(
        (time) =>
          pad.triggerAttackRelease(
            notes.map((n) => note(n - 12)),
            last ? 3.2 : BAR * 0.95,
            time,
          ),
        at(bar),
      );

      // 电钢琴：每小节三下（第 1 拍、第 2 拍半、第 4 拍），收束小节只弹一下。
      const stabs: [number, number][] = last
        ? [[0, 0.9]]
        : [
            [0, 0.9],
            [1.5, 0.6],
            [3, 0.72],
          ];
      for (const [beat, velocity] of stabs) {
        transport.schedule(
          (time) =>
            keys.triggerAttackRelease(
              notes.slice(1).map((n) => note(n)),
              last ? 3 : 1.2,
              time,
              velocity,
            ),
          at(bar, beat),
        );
      }

      // 贝斯：根音在第 1、3 拍，第二小节起进入；每两小节在第 4 拍半加一个五度经过音。
      if (bar >= 1) {
        for (const beat of last ? [0] : [0, 2]) {
          transport.schedule(
            (time) => bass.triggerAttackRelease(note(chord.root - 24), last ? 3 : 1.1, time, 0.9),
            at(bar, beat),
          );
        }
        if (!last && bar % 2 === 1) {
          transport.schedule((time) => bass.triggerAttackRelease(note(chord.root - 17), 0.35, time, 0.6), at(bar, 3.5));
        }
      }

      // 琶音：八分音符在和弦音上来回，第四小节起进入。
      if (bar >= 3 && !last) {
        const pattern = [0, 1, 2, 3, 4, 3, 2, 1];
        for (const [step, degree] of pattern.entries()) {
          transport.schedule(
            (time) => arp.triggerAttackRelease(note(notes[degree]! + 12), 0.2, time, step % 2 === 0 ? 0.9 : 0.7),
            at(bar, step / 2),
          );
        }
      }

      // 鼓点：第三小节起。底鼓 1、3 拍，军鼓 2、4 拍，踩镲八分音符，反拍稍重。
      if (bar >= 2 && !last) {
        for (const beat of [0, 2])
          transport.schedule((time) => kick.triggerAttackRelease("C1", 0.3, time, 0.9), at(bar, beat));
        for (const beat of [1, 3])
          transport.schedule((time) => snare.triggerAttackRelease(0.12, time, 0.7), at(bar, beat));
        for (let eighth = 0; eighth < 8; eighth++) {
          transport.schedule(
            (time) => hat.triggerAttackRelease(0.04, time, eighth % 2 === 0 ? 0.55 : 0.85),
            at(bar, eighth / 2),
          );
        }
      }
    }

    // 淡入 0.4 秒，收束和弦从第 33 秒开始淡出到结尾。
    master.gain.setValueAtTime(0, 0);
    master.gain.linearRampToValueAtTime(1, 0.4);
    master.gain.setValueAtTime(1, 33);
    master.gain.linearRampToValueAtTime(0, SECONDS - 0.05);

    transport.start(0);
  },
  SECONDS,
  2,
  SAMPLE_RATE,
);

// 峰值归一化到 -3 dBFS，写成 16 位 PCM 立体声 WAV。
const channels = [buffer.getChannelData(0), buffer.getChannelData(1)];
let peak = 0;
for (const channel of channels) for (const sample of channel) peak = Math.max(peak, Math.abs(sample));
const normalize = Tone.dbToGain(-3) / peak;
const frames = buffer.length;
const wav = Buffer.alloc(44 + frames * 4);
wav.write("RIFF", 0);
wav.writeUInt32LE(36 + frames * 4, 4);
wav.write("WAVE", 8);
wav.write("fmt ", 12);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(SAMPLE_RATE, 24);
wav.writeUInt32LE(SAMPLE_RATE * 4, 28);
wav.writeUInt16LE(4, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(frames * 4, 40);
for (let i = 0; i < frames; i++) {
  wav.writeInt16LE(Math.round(channels[0]![i]! * normalize * 32767), 44 + i * 4);
  wav.writeInt16LE(Math.round(channels[1]![i]! * normalize * 32767), 46 + i * 4);
}

const out = new URL("../assets/music.wav", import.meta.url);
mkdirSync(new URL("../assets/", import.meta.url), { recursive: true });
writeFileSync(out, wav);
console.log(`${fileURLToPath(out)} (${SECONDS}s, ${(wav.length / 1024 / 1024).toFixed(1)} MB)`);
