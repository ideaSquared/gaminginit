// The Season in Review's optional background music. Made in the browser with Web Audio, note by note, so there is no
// audio file to download and nothing to license: a mellow synth loop (pads, bass, a sparkling arpeggio and a soft beat)
// that never ends. It only starts when someone turns it on, which is also what browsers need before they play sound.

const BPM = 96;
const BEAT = 60 / BPM;
const STEP = BEAT / 2; // eighth notes; a bar is 8 steps
const AHEAD = 0.25; // how far ahead notes are scheduled, in seconds

// Am, F, C, G: a bar each, as MIDI notes (root first), looping.
export const PROGRESSION = [
  [57, 60, 64, 67],
  [53, 57, 60, 64],
  [48, 52, 55, 59],
  [55, 59, 62, 65],
];

export const frequency = (midi) => 440 * 2 ** ((midi - 69) / 12);

// The arpeggio's notes for a bar: up and back down the chord, two octaves up, one note per step.
export const arpeggio = (chord) => {
  const up = [chord[0], chord[1], chord[2], chord[3]].map((n) => n + 24);
  return [up[0], up[1], up[2], up[3], up[2], up[1], up[2], up[1]];
};

export const supported = () => typeof window !== 'undefined' && Boolean(window.AudioContext || window.webkitAudioContext);

// Music for one story. `start()` and `stop()` fade it in and out; `cue()` plays a small chime for a new slide.
export const createMusic = () => {
  const Context = window.AudioContext || window.webkitAudioContext;
  let ctx = null;
  let master = null;
  let echo = null;
  let noise = null;
  let timer = 0;
  let next = 0; // time of the next step
  let step = 0;
  let playing = false;

  const build = () => {
    ctx = new Context();
    master = ctx.createGain();
    master.gain.value = 0;
    const squash = ctx.createDynamicsCompressor();
    master.connect(squash).connect(ctx.destination);
    // A soft echo for the arpeggio.
    echo = ctx.createDelay(1);
    echo.delayTime.value = STEP * 3;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.35;
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    echo.connect(feedback).connect(echo);
    echo.connect(wet).connect(master);
    // A second of white noise for the hats and the clap.
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  };

  const tone = ({ type, freq, at, length, peak, attack = 0.01, to = master, send = 0, cutoff = 0, detune = 0 }) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(peak, at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    let out = osc;
    if (cutoff > 0) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      osc.connect(filter);
      out = filter;
    }
    out.connect(gain);
    gain.connect(to);
    if (send > 0) {
      const sent = ctx.createGain();
      sent.gain.value = send;
      gain.connect(sent).connect(echo);
    }
    osc.start(at);
    osc.stop(at + length + 0.05);
  };

  const hit = ({ at, length, peak, from, cut }) => {
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = from;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peak, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    source.connect(filter).connect(gain).connect(master);
    source.start(at, Math.random() * 0.5);
    source.stop(at + cut);
  };

  const kick = (at) => {
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(130, at);
    osc.frequency.exponentialRampToValueAtTime(42, at + 0.14);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.25);
    osc.connect(gain).connect(master);
    osc.start(at);
    osc.stop(at + 0.3);
  };

  // One eighth note of the loop.
  const schedule = (at, n) => {
    const inBar = n % 8;
    const chord = PROGRESSION[Math.floor(n / 8) % PROGRESSION.length];
    if (inBar === 0) {
      // The pad: the whole chord, held for the bar, two detuned voices a note.
      for (const note of chord.slice(1)) {
        for (const detune of [-8, 8]) {
          tone({ type: 'sawtooth', freq: frequency(note + 12), at, length: STEP * 8 + 0.3, peak: 0.03, attack: 0.6, cutoff: 1100, detune });
        }
      }
    }
    // The bass: the root on the beat, and again just before the next one.
    if (inBar % 2 === 0) tone({ type: 'triangle', freq: frequency(chord[0] - 12), at, length: BEAT * 0.9, peak: 0.28, attack: 0.015 });
    if (inBar === 3 || inBar === 7) tone({ type: 'triangle', freq: frequency(chord[0] - 12), at, length: STEP * 0.8, peak: 0.16, attack: 0.01 });
    // The arpeggio, a little quieter on the off-beats.
    tone({ type: 'triangle', freq: frequency(arpeggio(chord)[inBar]), at, length: STEP * 1.8, peak: inBar % 2 === 0 ? 0.13 : 0.09, send: 0.5, cutoff: 3200 });
    // The beat: kick on 1 and 3, clap on 2 and 4, hats on the off-beats.
    if (inBar === 0 || inBar === 4) kick(at);
    if (inBar === 2 || inBar === 6) hit({ at, length: 0.16, peak: 0.12, from: 1200, cut: 0.2 });
    if (inBar % 2 === 1) hit({ at, length: 0.05, peak: 0.05, from: 7000, cut: 0.08 });
  };

  const tick = () => {
    while (next < ctx.currentTime + AHEAD) {
      schedule(next, step);
      next += STEP;
      step += 1;
    }
  };

  return {
    get playing() {
      return playing;
    },
    start() {
      if (playing) return;
      if (!ctx) build();
      ctx.resume();
      playing = true;
      next = ctx.currentTime + 0.08;
      step = 0;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 1.5);
      timer = setInterval(tick, 60);
      tick();
    },
    stop() {
      if (!playing) return;
      playing = false;
      clearInterval(timer);
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0, now + 0.6);
      // Notes already scheduled die away with the fade, then the audio hardware is let go.
      setTimeout(() => !playing && ctx.suspend(), 800);
    },
    // A small rising chime, for a new slide.
    cue() {
      if (!playing) return;
      const at = ctx.currentTime + 0.02;
      tone({ type: 'sine', freq: frequency(81), at, length: 0.5, peak: 0.1, send: 0.4 });
      tone({ type: 'sine', freq: frequency(88), at: at + 0.07, length: 0.6, peak: 0.08, send: 0.4 });
    },
    // The loop is paused with the tab, so it never plays to nobody.
    pause() {
      if (playing) ctx.suspend();
    },
    resume() {
      if (playing) ctx.resume();
    },
    close() {
      clearInterval(timer);
      playing = false;
      ctx?.close();
      ctx = null;
    },
  };
};
