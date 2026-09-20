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

export interface Tone {
  frequency: number;
  startAt: number;
  duration: number;
  type: OscillatorType;
  peakGain: number;
}

export interface CorrectSeOptions {
  /** 連続正解数（1〜）。未指定時は 1 として扱う */
  readonly streak?: number;
}

export const CHORD_TOTAL_DURATION_SEC = 0.28;
export const FANFARE_TOTAL_DURATION_SEC = 0.34;

const BASE_CHORD_FREQS = [1046.5, 1318.51, 1567.98]; // C6, E6, G6

export function getChordTones(streak: number = 1): Tone[] {
  if (streak === 5) {
    // 5連続達成時ファンファーレ (FR-005c)
    return [
      { frequency: 1046.5, startAt: 0.0, duration: 0.08, type: 'triangle', peakGain: 0.4 },
      { frequency: 1318.51, startAt: 0.06, duration: 0.08, type: 'triangle', peakGain: 0.4 },
      { frequency: 1567.98, startAt: 0.12, duration: 0.08, type: 'triangle', peakGain: 0.4 },
      { frequency: 2093.0, startAt: 0.18, duration: 0.16, type: 'sine', peakGain: 0.45 },
      { frequency: 1567.98, startAt: 0.18, duration: 0.16, type: 'triangle', peakGain: 0.35 },
    ];
  }

  // 1〜4問目および6問目以降: メジャーコード和音 (FR-005b)
  const shiftSemitones = Math.min(3, Math.max(0, streak - 1)) * 2;
  const multiplier = Math.pow(2, shiftSemitones / 12);

  return [
    {
      frequency: BASE_CHORD_FREQS[0] * multiplier,
      startAt: 0,
      duration: CHORD_TOTAL_DURATION_SEC,
      type: 'sine',
      peakGain: 0.35,
    },
    {
      frequency: BASE_CHORD_FREQS[1] * multiplier,
      startAt: 0,
      duration: CHORD_TOTAL_DURATION_SEC,
      type: 'sine',
      peakGain: 0.35,
    },
    {
      frequency: BASE_CHORD_FREQS[2] * multiplier,
      startAt: 0,
      duration: CHORD_TOTAL_DURATION_SEC,
      type: 'sine',
      peakGain: 0.3,
    },
  ];
}

const SE_TONES: Record<SeEvent, Tone[]> = {
  correct: getChordTones(1),
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
const COUNTDOWN_EVENTS = new Set<SeEvent>(['tick', 'halfway', 'warning']);
const activeCountdownNodes = new Set<{ osc: OscillatorNode; gain: GainNode }>();
const activeAllNodes = new Set<{ osc: OscillatorNode; gain: GainNode }>();

export function stopCountdownSe(): void {
  try {
    for (const node of activeCountdownNodes) {
      try {
        node.osc.stop();
        node.osc.disconnect();
        node.gain.disconnect();
      } catch {
        // すでに停止済みの場合は無視
      }
    }
    activeCountdownNodes.clear();
  } catch {
    // 安全に握り潰す
  }
}

export function stopAllSe(): void {
  stopCountdownSe();
  try {
    for (const node of activeAllNodes) {
      try {
        node.osc.stop();
        node.osc.disconnect();
        node.gain.disconnect();
      } catch {
        // すでに停止済みの場合は無視
      }
    }
    activeAllNodes.clear();
  } catch {
    // 安全に握り潰す
  }
}

export function isAudioContextRunning(): boolean {
  return audioContext !== null && audioContext.state === 'running';
}

export function unlockAudioContext(): void {
  try {
    if (isSoundMuted()) return;
    if (typeof window === 'undefined' || typeof window.AudioContext !== 'function') return;

    audioContext ??= new window.AudioContext();
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }
  } catch {
    // 安全に握り潰す
  }
}

let hasRegisteredUnlockListener = false;
export function registerAudioUnlockListener(): void {
  if (hasRegisteredUnlockListener) return;
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
  hasRegisteredUnlockListener = true;

  const onUserGesture = () => {
    unlockAudioContext();
    if (audioContext && audioContext.state === 'running') {
      if (typeof window.removeEventListener === 'function') {
        window.removeEventListener('pointerdown', onUserGesture);
        window.removeEventListener('keydown', onUserGesture);
        window.removeEventListener('touchstart', onUserGesture);
      }
    }
  };

  window.addEventListener('pointerdown', onUserGesture, { passive: true });
  window.addEventListener('keydown', onUserGesture, { passive: true });
  window.addEventListener('touchstart', onUserGesture, { passive: true });
}

export function playCorrectSe(options?: CorrectSeOptions): void {
  playSe('correct', options);
}

export function playSe(event: SeEvent, options?: CorrectSeOptions): void {
  try {
    if (isSoundMuted()) return;
    if (typeof window === 'undefined' || typeof window.AudioContext !== 'function') return;

    registerAudioUnlockListener();

    const isCountdown = COUNTDOWN_EVENTS.has(event);
    if (!isCountdown) {
      // 解答判定・セッション完了時は、進行中のカウントダウンSEのみ即座に停止する
      stopCountdownSe();
    }

    audioContext ??= new window.AudioContext();
    const ctx = audioContext;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
      // AudioContext が suspended（未アンロック）の場合、
      // タイマー駆動のSEはスケジュールせず破棄し、後からの遅延重複再生を防ぐ
      if (isCountdown) {
        return;
      }
    }
    const now = ctx.currentTime;
    const tones =
      event === 'correct' ? getChordTones(options?.streak ?? 1) : SE_TONES[event];
    for (const tone of tones) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const node = { osc, gain };
      activeAllNodes.add(node);
      if (isCountdown) {
        activeCountdownNodes.add(node);
      }

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
        activeAllNodes.delete(node);
        activeCountdownNodes.delete(node);
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
