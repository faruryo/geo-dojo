// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { TopHud, type HudTimer } from '@/components/quiz/hud/top-hud';

(globalThis as unknown as Record<string, boolean>).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

function render(timer?: HudTimer) {
  act(() => {
    root.render(
      <TopHud
        currentIndex={0}
        totalQuestions={10}
        onAbort={vi.fn()}
        timer={timer}
      />,
    );
  });
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('TopHud タイマー表示と視認性・警告表現', () => {
  it('タイマー未指定時はタイマー領域を描画しない', () => {
    render();
    expect(host.querySelector('[role="timer"]')).toBeNull();
  });

  it('通常カウントダウン（残り6秒以上）では通常スタイル・非干渉 aria-live を適用する', () => {
    render({ kind: 'countdown', secondsLeft: 20, totalSeconds: 30 });

    const timer = host.querySelector('[role="timer"]');
    expect(timer).not.toBeNull();
    expect(timer?.getAttribute('aria-label')).toBe('残り 20 秒');
    expect(timer?.getAttribute('aria-live')).toBe('off');
    expect(timer?.getAttribute('aria-atomic')).toBe('true');

    // 通常時は赤色枠や発光背景を持たない
    expect(timer?.className).toContain('border-transparent');
    expect(timer?.className).not.toContain('border-red-500/50');
    expect(timer?.className).not.toContain('shadow-[');

    // PC/タブレット向けのレスポンシブサイズ調整クラスを持つ
    const gauge = timer?.querySelector('.rounded-full.bg-white\\/20');
    expect(gauge?.className).toContain('w-14');
    expect(gauge?.className).toContain('md:w-24');
    expect(gauge?.className).toContain('h-1');
    expect(gauge?.className).toContain('md:h-1.5');

    const secText = timer?.querySelector('.tabular-nums');
    expect(secText?.className).toContain('text-xs');
    expect(secText?.className).toContain('md:text-sm');
    expect(secText?.className).toContain('text-[#fafafa]');
    expect(secText?.className).not.toContain('text-red-400');

    // 通常時はパルスアニメーションを持たない
    expect(timer?.querySelector('.motion-safe\\:animate-timer-pulse')).toBeNull();

    // TopHud 下端アクセントは透明
    const accent = host.querySelector('header > div[aria-hidden]');
    expect(accent?.className).toContain('bg-transparent');
    expect(accent?.className).not.toContain('bg-red-500/40');
  });

  it('残り5秒以下の警告状態では赤色発光・パルスアニメーション・assertive 読み上げを適用する', () => {
    render({ kind: 'countdown', secondsLeft: 5, totalSeconds: 30 });

    const timer = host.querySelector('[role="timer"]');
    expect(timer).not.toBeNull();
    expect(timer?.getAttribute('aria-label')).toBe('残り 5 秒');
    expect(timer?.getAttribute('aria-live')).toBe('assertive');
    expect(timer?.getAttribute('aria-atomic')).toBe('true');

    // 警告時の発光・背景・枠線
    expect(timer?.className).toContain('border-red-500/50');
    expect(timer?.className).toContain('bg-red-950/40');
    expect(timer?.className).toContain('shadow-[0_0_12px_rgba(239,68,68,0.35)]');

    // パルスアニメーションクラス
    const pulseWrapper = timer?.querySelector('.motion-safe\\:animate-timer-pulse');
    expect(pulseWrapper).not.toBeNull();

    // 秒数文字が赤色かつ太字
    const secText = timer?.querySelector('.tabular-nums');
    expect(secText?.className).toContain('text-red-400');
    expect(secText?.className).toContain('font-bold');

    // TopHud 下端の周辺視野アクセントが警告色になる
    const accent = host.querySelector('header > div[aria-hidden]');
    expect(accent?.className).toContain('bg-red-500/40');
  });

  it('残り1秒でも警告状態が維持される', () => {
    render({ kind: 'countdown', secondsLeft: 1, totalSeconds: 30 });

    const timer = host.querySelector('[role="timer"]');
    expect(timer?.getAttribute('aria-live')).toBe('assertive');
    expect(timer?.className).toContain('border-red-500/50');
    expect(timer?.querySelector('.motion-safe\\:animate-timer-pulse')).not.toBeNull();
  });

  it('経過時間タイマー（elapsed）はレスポンシブ文字サイズで描画される', () => {
    render({ kind: 'elapsed', elapsedMs: 65430 });

    const elapsedSpan = [...host.querySelectorAll('span.font-mono')].find((s) =>
      s.textContent?.includes('1:05.43'),
    );
    expect(elapsedSpan).not.toBeUndefined();
    expect(elapsedSpan?.className).toContain('md:text-sm');
  });
});
