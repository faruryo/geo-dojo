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

interface MockOscillator {
  readonly stop: ReturnType<typeof vi.fn>;
  readonly disconnect: ReturnType<typeof vi.fn>;
}

function createMockAudioContextClass(options?: {
  readonly onStop?: () => void;
  readonly onDisconnect?: () => void;
  readonly onOscillatorCreated?: (osc: MockOscillator) => void;
}) {
  return class MockAudioContext {
    state = 'running';
    currentTime = 0;
    destination = {};
    createOscillator() {
      const osc = {
        type: 'sine',
        frequency: { value: 0 },
        start: vi.fn(),
        stop: vi.fn((..._args: unknown[]) => {
          options?.onStop?.();
        }),
        connect: vi.fn(),
        disconnect: vi.fn((..._args: unknown[]) => {
          options?.onDisconnect?.();
        }),
      };
      options?.onOscillatorCreated?.(osc);
      return osc;
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

  it('解答判定SE（correct）再生時に先行するカウントダウンSE（warning）が即時停止される', async () => {
    const oscList: MockOscillator[] = [];
    vi.stubGlobal('window', {
      localStorage: fakeLocalStorage(),
      AudioContext: createMockAudioContextClass({
        onOscillatorCreated: (osc) => oscList.push(osc),
      }),
    });
    const { playSe } = await loadModule();

    playSe('warning');
    expect(oscList.length).toBeGreaterThan(0);
    const warningOscs = [...oscList];
    oscList.length = 0;

    // warning のオシレーターはいずれもまだ即時停止（引数なし stop()）されていない
    for (const osc of warningOscs) {
      expect(osc.stop).not.toHaveBeenCalledWith();
    }

    playSe('correct');
    // correct 呼び出しにより、先行する warning の全オシレーターに対して即時 stop() が呼ばれていること
    for (const osc of warningOscs) {
      expect(osc.stop).toHaveBeenCalledWith();
    }
  });

  it('stopCountdownSe は正答音（correct）を切断・停止しない', async () => {
    const oscList: MockOscillator[] = [];
    vi.stubGlobal('window', {
      localStorage: fakeLocalStorage(),
      AudioContext: createMockAudioContextClass({
        onOscillatorCreated: (osc) => oscList.push(osc),
      }),
    });
    const { playSe, stopCountdownSe } = await loadModule();

    playSe('correct');
    expect(oscList.length).toBeGreaterThan(0);
    const correctOscs = [...oscList];

    for (const osc of correctOscs) {
      osc.stop.mockClear();
      osc.disconnect.mockClear();
    }

    // タイマークリーンアップ等で stopCountdownSe が走っても、correct 音の即時停止・切断は行われない
    stopCountdownSe();
    for (const osc of correctOscs) {
      expect(osc.stop).not.toHaveBeenCalledWith();
      expect(osc.disconnect).not.toHaveBeenCalled();
    }
  });
});
