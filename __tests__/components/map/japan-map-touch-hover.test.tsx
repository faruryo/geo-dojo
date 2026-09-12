// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { JapanMap } from '@/components/map/JapanMap';

(globalThis as unknown as Record<string, boolean>).IS_REACT_ACT_ENVIRONMENT = true;

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderMap(matches: boolean) {
  stubMatchMedia(matches);
  const topology: unknown = JSON.parse(readFileSync('public/japan.topojson', 'utf8'));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => topology }));
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(<JapanMap onPrefectureClick={vi.fn()} />); });
  await act(async () => { await Promise.resolve(); });
  const path = host.querySelector<SVGPathElement>('.rsm-geography');
  if (!path) throw new Error('geography path not found');
  return { host, root, path };
}

it('タッチ端末ではフォーカスでも hover 色を付けない', async () => {
  const { host, root, path } = await renderMap(false);
  try {
    expect(path.style.fill).toBe('#2a2a2a');
    act(() => { path.focus(); });
    expect(path.style.fill).toBe('#2a2a2a');
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});

it('マウス端末ではフォーカスで hover 色を付ける', async () => {
  const { host, root, path } = await renderMap(true);
  try {
    act(() => { path.focus(); });
    expect(path.style.fill).toBe('#3a3a3a');
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
