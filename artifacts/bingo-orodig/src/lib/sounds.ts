let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function playTone(freq: number, type: OscillatorType, duration: number, gain = 0.25, delay = 0) {
  try {
    const a = getCtx();
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.connect(g);
    g.connect(a.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, a.currentTime + delay);
    g.gain.setValueAtTime(0, a.currentTime + delay);
    g.gain.linearRampToValueAtTime(gain, a.currentTime + delay + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + delay + duration);
    osc.start(a.currentTime + delay);
    osc.stop(a.currentTime + delay + duration);
  } catch {}
}

export const sounds = {
  ballDraw() {
    playTone(440, "sine", 0.18, 0.2);
    playTone(660, "sine", 0.12, 0.1, 0.06);
  },
  ballMark() {
    playTone(523, "sine", 0.08, 0.12);
    playTone(659, "sine", 0.07, 0.08, 0.05);
  },
  win() {
    [523, 659, 784, 1047].forEach((f, i) => playTone(f, "sine", 0.4, 0.2, i * 0.12));
  },
  click() {
    playTone(660, "sine", 0.06, 0.08);
  },
  buy() {
    playTone(392, "sine", 0.1, 0.15);
    playTone(523, "sine", 0.1, 0.12, 0.1);
    playTone(659, "sine", 0.1, 0.1, 0.2);
  },
};

// Resume on user gesture (required by browsers)
export function resumeAudio() {
  try { getCtx().resume(); } catch {}
}
