/** Umpan balik haptik & suara untuk scan (tanpa file audio). */

export const VIBRATE_SUCCESS = 80;
export const VIBRATE_ERROR = [100, 50, 100];

export function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* iOS Safari tidak mendukung — abaikan */
  }
}

let audioContext: AudioContext | null = null;

/** Bunyi "beep" pendek via Web Audio API (oscillator sinus ~120 ms). */
export function beep({ frequency = 1046, durationMs = 120 } = {}) {
  try {
    audioContext ??= new AudioContext();
    const ctx = audioContext;
    void ctx.resume();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    const start = ctx.currentTime;
    const end = start + durationMs / 1000;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(end);
  } catch {
    /* audio tidak tersedia — getaran sudah cukup */
  }
}
