import { afterEach, describe, expect, it, vi } from 'vitest';

const MUTE_KEY = 'geo-dojo:se-muted';

function fakeLocalStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
}

function throwingLocalStorage() {
  return {
    getItem: () => {
      throw new Error('localStorage unavailable');
    },
    setItem: () => {
      throw new Error('localStorage unavailable');
    },
  };
}

async function loadModule() {
  vi.resetModules();
  return import('@/lib/quiz/sound-effects');
}

function createMockAudioContextClass(options?: {
  readonly onStop?: () => void;
  readonly onDisconnect?: () => void;
}) {
  return class MockAudioContext {
    state = 'running';
    currentTime = 0;
    destination = {};
    createOscillator() {
      return {
        type: 'sine',
        frequency: { value: 0 },
        start: vi.fn(),
        stop: options?.onStop ?? vi.fn(),
        connect: vi.fn(),
        disconnect: options?.onDisconnect ?? vi.fn(),
      };
    }
    createGain() {
      return {
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: options?.onDisconnect ?? vi.fn(),
      };
    }
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sound-effects', () => {
  it('ミュート中は playSe が AudioContext 生成を含む再生パイプラインへ到達しない', async () => {
    const audioContextSpy = vi.fn();
    vi.stubGlobal('window', {
      localStorage: fakeLocalStorage({ [MUTE_KEY]: 'true' }),
      AudioContext: audioContextSpy,
    });
    const { playSe, isSoundMuted } = await loadModule();

    expect(isSoundMuted()).toBe(true);
    playSe('correct');
    playSe('incorrect');
    playSe('complete');
    playSe('perfect');
    playSe('tick');
    playSe('halfway');
    playSe('warning');
    expect(audioContextSpy).not.toHaveBeenCalled();
  });

  it('localStorage キー不在時は isSoundMuted が false（音あり）を返す', async () => {
    vi.stubGlobal('window', { localStorage: fakeLocalStorage() });
    const { isSoundMuted } = await loadModule();

    expect(isSoundMuted()).toBe(false);
  });

  it('setSoundMuted の設定が isSoundMuted に反映される', async () => {
    vi.stubGlobal('window', { localStorage: fakeLocalStorage() });
    const { isSoundMuted, setSoundMuted } = await loadModule();

    setSoundMuted(true);
    expect(isSoundMuted()).toBe(true);
    setSoundMuted(false);
    expect(isSoundMuted()).toBe(false);
  });

  it('localStorage が例外を投げる環境でも例外を投げない', async () => {
    vi.stubGlobal('window', { localStorage: throwingLocalStorage() });
    const { isSoundMuted, setSoundMuted, playSe } = await loadModule();

    expect(() => isSoundMuted()).not.toThrow();
    expect(isSoundMuted()).toBe(false);
    expect(() => setSoundMuted(true)).not.toThrow();
    expect(() => playSe('correct')).not.toThrow();
  });

  it('SSR 環境（window なし）でも例外を投げず音あり扱いになる', async () => {
    const { isSoundMuted, setSoundMuted, playSe } = await loadModule();

    expect(isSoundMuted()).toBe(false);
    expect(() => setSoundMuted(true)).not.toThrow();
    expect(() => playSe('complete')).not.toThrow();
  });

  it('completionSeEvent は全問正解のときのみ perfect を返す', async () => {
    const { completionSeEvent } = await loadModule();

    expect(completionSeEvent([{ correct: true }, { correct: true }])).toBe('perfect');
    expect(completionSeEvent([{ correct: true }, { correct: false }])).toBe('complete');
    expect(completionSeEvent([{ correct: false }])).toBe('complete');
    expect(completionSeEvent([])).toBe('complete');
  });

  it('stopAllSe を呼ぶとアクティブなオシレーターが停止・切断される', async () => {
    const stopFn = vi.fn();
    const disconnectFn = vi.fn();
    vi.stubGlobal('window', {
      localStorage: fakeLocalStorage(),
      AudioContext: createMockAudioContextClass({
        onStop: stopFn,
        onDisconnect: disconnectFn,
      }),
    });
    const { playSe, stopAllSe } = await loadModule();

    playSe('warning');
    // start と stop(futureTime) がスケジュールされているが、早期切断はまだ行われていない
    expect(disconnectFn).not.toHaveBeenCalled();

    stopAllSe();
    // stopAllSe により即時切断・停止が行われる
    expect(stopFn).toHaveBeenCalledWith();
    expect(disconnectFn).toHaveBeenCalled();
  });

  it('解答判定SE（correct）再生時に先行するSEが停止される', async () => {
    const stopFn = vi.fn();
    vi.stubGlobal('window', {
      localStorage: fakeLocalStorage(),
      AudioContext: createMockAudioContextClass({ onStop: stopFn }),
    });
    const { playSe } = await loadModule();

    playSe('warning');
    stopFn.mockClear();

    playSe('correct');
    expect(stopFn).toHaveBeenCalled();
  });

  it('stopCountdownSe は正答音（correct）を切断・停止しない', async () => {
    const stopFn = vi.fn();
    vi.stubGlobal('window', {
      localStorage: fakeLocalStorage(),
      AudioContext: createMockAudioContextClass({ onStop: stopFn }),
    });
    const { playSe, stopCountdownSe } = await loadModule();

    playSe('correct');
    stopFn.mockClear();

    // タイマークリーンアップ等で stopCountdownSe が走っても、correct 音は即時停止されない
    stopCountdownSe();
    expect(stopFn).not.toHaveBeenCalledWith();
  });
});
