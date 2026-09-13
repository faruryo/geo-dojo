export type SeEvent =
  | 'correct'
  | 'incorrect'
  | 'complete'
  | 'perfect'
  | 'tick'
  | 'halfway'
  | 'warning';

const MUTE_STORAGE_KEY = 'geo-dojo:se-muted';

export function isSoundMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setSoundMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MUTE_STORAGE_KEY, muted ? 'true' : 'false');
  } catch {
    // localStorage 不可用時は永続化なし（セッション内も「音あり」のまま）
  }
}

export function completionSeEvent(results: { correct: boolean }[]): 'perfect' | 'complete' {
  return results.length > 0 && results.every((r) => r.correct) ? 'perfect' : 'complete';
}

interface Tone {
  frequency: number;
  startAt: number;
  duration: number;
  type: OscillatorType;
  peakGain: number;
}

const SE_TONES: Record<SeEvent, Tone[]> = {
  correct: [
    { frequency: 659.25, startAt: 0, duration: 0.09, type: 'sine', peakGain: 0.95 },
    { frequency: 880, startAt: 0.09, duration: 0.14, type: 'sine', peakGain: 0.95 },
  ],
  incorrect: [
    { frequency: 196, startAt: 0, duration: 0.18, type: 'triangle', peakGain: 0.9 },
  ],
  complete: [
    { frequency: 523.25, startAt: 0, duration: 0.11, type: 'sine', peakGain: 0.9 },
    { frequency: 659.25, startAt: 0.11, duration: 0.11, type: 'sine', peakGain: 0.9 },
    { frequency: 783.99, startAt: 0.22, duration: 0.22, type: 'sine', peakGain: 0.9 },
  ],
  perfect: [
    { frequency: 523.25, startAt: 0, duration: 0.1, type: 'triangle', peakGain: 0.95 },
    { frequency: 659.25, startAt: 0.1, duration: 0.1, type: 'triangle', peakGain: 0.95 },
    { frequency: 783.99, startAt: 0.2, duration: 0.1, type: 'triangle', peakGain: 0.95 },
    { frequency: 1046.5, startAt: 0.3, duration: 0.35, type: 'triangle', peakGain: 0.65 },
    { frequency: 783.99, startAt: 0.3, duration: 0.35, type: 'sine', peakGain: 0.3 },
  ],
  tick: [
    { frequency: 880, startAt: 0, duration: 0.04, type: 'sine', peakGain: 0.35 },
  ],
  halfway: [
    { frequency: 587.33, startAt: 0, duration: 0.12, type: 'sine', peakGain: 0.4 },
  ],
  warning: [
    { frequency: 783.99, startAt: 0, duration: 0.06, type: 'sine', peakGain: 0.5 },
    { frequency: 880, startAt: 0.08, duration: 0.08, type: 'sine', peakGain: 0.5 },
  ],
};

let audioContext: AudioContext | null = null;
const activeNodes = new Set<{ osc: OscillatorNode; gain: GainNode }>();

export function stopAllSe(): void {
  try {
    for (const node of activeNodes) {
      try {
        node.osc.stop();
        node.osc.disconnect();
        node.gain.disconnect();
      } catch {
        // すでに停止済みの場合は無視
      }
    }
    activeNodes.clear();
  } catch {
    // 安全に握り潰す
  }
}

export function playSe(event: SeEvent): void {
  try {
    if (isSoundMuted()) return;
    if (typeof window === 'undefined' || typeof window.AudioContext !== 'function') return;

    // 解答判定・セッション完了時は、進行中のタイマーSE等の余韻を即座に停止する
    if (event === 'correct' || event === 'incorrect' || event === 'complete' || event === 'perfect') {
      stopAllSe();
    }

    audioContext ??= new window.AudioContext();
    const ctx = audioContext;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;
    for (const tone of SE_TONES[event]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const node = { osc, gain };
      activeNodes.add(node);

      osc.type = tone.type;
      osc.frequency.value = tone.frequency;
      const start = now + tone.startAt;
      const end = start + tone.duration;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(tone.peakGain, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.onended = () => {
        activeNodes.delete(node);
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {
          // すでに切断済みの場合は無視
        }
      };
      osc.start(start);
      osc.stop(end + 0.05);
    }
  } catch {
    // 再生失敗は当該回の音のみ諦め、進行をブロックしない（FR-012）
  }
}
