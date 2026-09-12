// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { JapanMap } from '@/components/map/JapanMap';

(globalThis as unknown as Record<string, boolean>).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  vi.unstubAllGlobals();
});

it('タッチの12px移動はパン扱いにせずクリックを通す', async () => {
  const topology: unknown = JSON.parse(readFileSync('public/japan.topojson', 'utf8'));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => topology }));
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const onPrefectureClick = vi.fn();
  try {
    await act(async () => { root.render(<JapanMap onPrefectureClick={onPrefectureClick} />); });
    const path = host.querySelector<SVGPathElement>('.rsm-geography');
    if (!path) throw new Error('geography path not found');

    act(() => {
      path.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 }));
      path.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, pointerType: 'touch', clientX: 112, clientY: 100 }));
      path.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, pointerType: 'touch', clientX: 112, clientY: 100 }));
      path.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onPrefectureClick).toHaveBeenCalledOnce();
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
