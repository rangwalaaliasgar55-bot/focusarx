let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try { ctx = new AudioContext(); } catch { return null; }
  }
  return ctx;
}

function tone(freq: number, duration: number, type: OscillatorType = "sine", volume = 0.15) {
  const ac = getCtx();
  if (!ac) return;
  if (localStorage.getItem("fx_muted") === "1") return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + duration);
}

function chord(freqs: number[], duration: number, type: OscillatorType = "sine", volume = 0.2) {
  freqs.forEach(f => tone(f, duration, type, volume / freqs.length));
}

function arpeggio(freqs: number[], spacing: number, type: OscillatorType = "sine", volume = 0.2) {
  const ac = getCtx();
  if (!ac) return;
  if (localStorage.getItem("fx_muted") === "1") return;
  freqs.forEach((f, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.value = f;
    const start = ac.currentTime + i * spacing;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + spacing * 2);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(start);
    osc.stop(start + spacing * 2);
  });
}

export const playXpGain           = () => tone(880, 0.1, "sine", 0.15);
export const playCoinEarn         = () => tone(660, 0.08, "sine", 0.1);
export const playAchievement      = () => chord([523, 659, 784], 0.5, "triangle", 0.3);
export const playLevelUp          = () => arpeggio([261, 329, 392, 523], 0.08, "square", 0.2);
export const playSessionComplete  = () => chord([392, 494, 587], 0.8, "sine", 0.25);
export const playStreakMilestone  = () => arpeggio([440, 554, 659, 880], 0.06, "sine", 0.3);
export const playMissionComplete  = () => chord([349, 440, 523, 698], 0.6, "triangle", 0.2);
export const playError            = () => tone(220, 0.2, "sawtooth", 0.1);

export function toggleMute() {
  const muted = localStorage.getItem("fx_muted") === "1";
  localStorage.setItem("fx_muted", muted ? "0" : "1");
  return !muted;
}

export function isMuted() {
  return localStorage.getItem("fx_muted") === "1";
}
