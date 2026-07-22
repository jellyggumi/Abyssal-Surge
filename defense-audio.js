import { AUDIO_CUES } from "./defense-catalog.js";

const byId = Object.freeze(Object.values(AUDIO_CUES).reduce((map, cue) => ({ ...map, [cue.id]: cue }), {}));

export class DefenseAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.music = null;
    this.started = false;
    this.nodeCount = 0;
  }

  start() {
    if (this.started) return;
    const AudioContextCtor = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContextCtor) return;
    try {
      this.context = new AudioContextCtor();
      this.master = this.context.createGain();
      this.master.gain.value = 0.055;
      this.master.connect(this.context.destination);
      this.music = this.context.createOscillator();
      const musicGain = this.context.createGain();
      musicGain.gain.value = 0.018;
      this.music.type = "sine";
      this.music.frequency.value = 55;
      this.music.connect(musicGain).connect(this.master);
      this.music.start();
      this.nodeCount = 3;
      this.started = true;
    } catch {
      this.stop();
    }
  }

  play(cueId) {
    const cue = byId[cueId];
    if (!cue || !this.context || !this.master) return;
    try {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      const now = this.context.currentTime;
      oscillator.type = cue.waveform;
      oscillator.frequency.setValueAtTime(cue.frequency, now);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + cue.duration);
      oscillator.connect(gain).connect(this.master);
      oscillator.start(now);
      oscillator.stop(now + cue.duration);
      this.nodeCount += 2;
      oscillator.addEventListener?.("ended", () => { this.nodeCount = Math.max(1, this.nodeCount - 2); }, { once: true });
    } catch {
      // Audio is a presentation-only enhancement; simulation stays authoritative.
    }
  }

  consume(events = []) {
    events.forEach((event) => { if (event.cue) this.play(event.cue); });
  }

  stop() {
    try { this.music?.stop?.(); } catch { /* already stopped */ }
    try { this.context?.close?.(); } catch { /* already closed */ }
    this.music = null;
    this.master = null;
    this.context = null;
    this.nodeCount = 0;
    this.started = false;
  }

  debugMetrics() {
    return { nodes: this.nodeCount, started: this.started };
  }
}
