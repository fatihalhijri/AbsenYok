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

/** Status audio: browser menahan suara sampai ada interaksi pengguna (kebijakan autoplay). */
export function audioState(): AudioContextState | 'unsupported' {
  if (typeof AudioContext === 'undefined') return 'unsupported';
  return audioContext?.state ?? 'suspended';
}

/** Buka kunci audio — panggil dari gestur pengguna (klik/ketuk). */
export async function unlockAudio(): Promise<boolean> {
  try {
    audioContext ??= new AudioContext();
    await audioContext.resume();
    return audioContext.state === 'running';
  } catch {
    return false;
  }
}

/** Nada "ding" lembut dua tingkat (notifikasi entri baru di layar kiosk). */
export function ding() {
  try {
    audioContext ??= new AudioContext();
    const ctx = audioContext;
    if (ctx.state !== 'running') return; // belum dibuka oleh gestur pengguna
    const start = ctx.currentTime;
    for (const [offset, frequency] of [
      [0, 880],
      [0.12, 1318.5],
    ] as const) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      const t = start + offset;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(t);
      oscillator.stop(t + 0.62);
    }
  } catch {
    /* audio tidak tersedia */
  }
}
