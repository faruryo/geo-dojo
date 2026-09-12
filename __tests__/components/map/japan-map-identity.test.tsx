// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { JapanMap } from '@/components/map/JapanMap';

(globalThis as unknown as Record<string, boolean>).IS_REACT_ACT_ENVIRONMENT = true;

it('親更新・選択・正誤表示で地図DOMを維持し、最新の回答ハンドラを呼ぶ', async () => {
  const topology: unknown = JSON.parse(readFileSync('public/japan.topojson', 'utf8'));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => topology }));
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const first = vi.fn();
  const latest = vi.fn();
  try {
    await act(async () => { root.render(<JapanMap onPrefectureClick={first} />); });
    const paths = [...host.querySelectorAll<SVGPathElement>('.rsm-geography')];
    expect(paths).toHaveLength(47);
    const path = paths[0];
    act(() => { path.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    const name = first.mock.calls[0][0] as string;
    first.mockClear();

    // タイマー更新と同様に、毎回新しいcallbackを渡して親を再描画する。
    for (let tick = 0; tick < 4; tick++) {
      await act(async () => {
        root.render(<JapanMap onPrefectureClick={(value) => latest(value)} />);
      });
      expect([...host.querySelectorAll('.rsm-geography')].every((node, i) => node.isSameNode(paths.at(i) ?? null))).toBe(true);
    }
    await act(async () => {
      root.render(<JapanMap selectedNames={[name]} onPrefectureClick={latest} />);
    });
    expect(host.querySelector('.rsm-geography')).toBe(path);
    expect(path.style.fill).toBe('#3b82f6');
    act(() => { path.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledExactlyOnceWith(name);

    latest.mockClear();
    vi.useFakeTimers();
    act(() => {
      path.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 }));
      path.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, pointerType: 'touch', clientX: 124, clientY: 100 }));
      path.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, pointerType: 'touch', clientX: 124, clientY: 100 }));
      vi.advanceTimersByTime(100);
      path.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(latest).not.toHaveBeenCalled();
    act(() => {
      path.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 2, pointerType: 'touch', clientX: 100, clientY: 100 }));
      path.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 2, pointerType: 'touch', clientX: 100, clientY: 100 }));
      path.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(latest).toHaveBeenCalledExactlyOnceWith(name);
    vi.useRealTimers();

    for (const [props, fill] of [
      [{ highlightCorrect: name }, '#4a7c59'],
      [{ highlightWrong: name }, '#ef4444'],
      [{ qIdx: 1 }, '#2a2a2a'],
    ] as const) {
      await act(async () => { root.render(<JapanMap {...props} onPrefectureClick={latest} />); });
      expect(host.querySelector('.rsm-geography')).toBe(path);
      expect(path.style.fill).toBe(fill);
    }
  } finally {
    act(() => root.unmount());
    host.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});
