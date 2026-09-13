// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MapCountdownPulse } from '@/components/quiz/hud/map-countdown-pulse';

(globalThis as unknown as Record<string, boolean>).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

function render(secondsLeft: number, feedback: 'idle' | 'correct' | 'incorrect' = 'idle') {
  act(() => {
    root.render(<MapCountdownPulse secondsLeft={secondsLeft} feedback={feedback} />);
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

describe('MapCountdownPulse マップ端カウントダウンパルス', () => {
  it('通常時（7秒以上）は何も描画しない', () => {
    render(7);
    expect(host.firstChild).toBeNull();
    render(15);
    expect(host.firstChild).toBeNull();
    render(30);
    expect(host.firstChild).toBeNull();
  });

  it('タイムアウト時（0秒以下）は何も描画しない', () => {
    render(0);
    expect(host.firstChild).toBeNull();
    render(-1);
    expect(host.firstChild).toBeNull();
  });

  it('回答後（feedback !== "idle"）は残り時間に関わらず何も描画しない', () => {
    render(5, 'correct');
    expect(host.firstChild).toBeNull();
    render(5, 'incorrect');
    expect(host.firstChild).toBeNull();
    render(1, 'correct');
    expect(host.firstChild).toBeNull();
  });

  it('残り5秒以下の出題中（idle）ではパルス要素が描画され、pointer-events-none と aria-hidden を持つ', () => {
    render(5, 'idle');
    const overlay = host.querySelector('[data-testid="map-countdown-pulse"]');
    expect(overlay).not.toBeNull();
    expect(overlay?.getAttribute('aria-hidden')).toBe('true');
    expect(overlay?.className).toContain('pointer-events-none');
    expect(overlay?.className).toContain('opacity-0');
    expect(overlay?.className).toContain('motion-safe:animate-map-edge-pulse');
    expect(overlay?.className).toContain('shadow-[');
  });

  it('残り6秒（warning）でもパルス要素が描画される', () => {
    render(6, 'idle');
    const overlay = host.querySelector('[data-testid="map-countdown-pulse"]');
    expect(overlay).not.toBeNull();
    expect(overlay?.className).toContain('motion-safe:animate-map-edge-pulse');
  });

  it('残り秒数ごとにキーまたは要素が更新されてパルスが再発火する構造になっている', () => {
    render(5, 'idle');
    const overlay5 = host.querySelector('[data-testid="map-countdown-pulse"]');
    expect(overlay5?.getAttribute('data-seconds')).toBe('5');

    render(4, 'idle');
    const overlay4 = host.querySelector('[data-testid="map-countdown-pulse"]');
    expect(overlay4?.getAttribute('data-seconds')).toBe('4');
    expect(overlay4).not.toBe(overlay5);
  });
});
