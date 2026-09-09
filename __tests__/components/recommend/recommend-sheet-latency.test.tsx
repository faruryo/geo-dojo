// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

(globalThis as unknown as Record<string, boolean>).IS_REACT_ACT_ENVIRONMENT = true;

// ルーターの遷移は「返ってこない」ものとして扱う。RSC の再フェッチを待つ実装だと、
// この状態でシートが開かないまま止まる。
const push = vi.fn();
const replace = vi.fn();
let params = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push,
    replace,
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => params,
  usePathname: () => '/',
}));

vi.mock('@/lib/hooks/useRecommendation', () => ({
  useRecommendation: () => ({
    data: {
      mode: 'A',
      difficulties: ['easy'],
      count: 10,
      regions: ['関東'],
      rationaleCategory: 'weakness',
      rationaleText: '苦手な地方です',
      notes: [],
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

const { RecommendHeroCard } = await import('@/components/recommend/recommend-hero-card');

let host: HTMLDivElement;
let root: Root;

function render() {
  act(() => {
    root.render(<RecommendHeroCard />);
  });
}

const openButton = () =>
  [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('おすすめを確認する'));
const cancelButton = () =>
  [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'キャンセル');
const sheetIsOpen = () => document.body.textContent?.includes('そのまま開始') ?? false;

beforeEach(() => {
  push.mockClear();
  replace.mockClear();
  params = new URLSearchParams();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('おすすめシートの開閉', () => {
  it('タップした時点で開く（ルーターの遷移を待たない）', () => {
    render();
    expect(sheetIsOpen()).toBe(false);

    act(() => openButton()?.click());

    expect(sheetIsOpen()).toBe(true);
  });

  it('タップした時点で閉じる（ルーターの遷移を待たない）', () => {
    render();
    act(() => openButton()?.click());
    expect(sheetIsOpen()).toBe(true);

    act(() => cancelButton()?.click());

    expect(sheetIsOpen()).toBe(false);
  });

  it('開閉にルーターの遷移を使わない（RSC の再取得を起こさない）', () => {
    render();
    act(() => openButton()?.click());
    act(() => cancelButton()?.click());

    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('URL は後から合わせる。開くときは履歴を積み、閉じるときは積まない', () => {
    const pushState = vi.spyOn(window.history, 'pushState');
    const replaceState = vi.spyOn(window.history, 'replaceState');
    render();

    act(() => openButton()?.click());
    expect(pushState).toHaveBeenCalledWith(null, '', '/?recommend=open');

    act(() => cancelButton()?.click());
    expect(replaceState).toHaveBeenCalledWith(null, '', '/');

    pushState.mockRestore();
    replaceState.mockRestore();
  });

  it('他画面からのリンクで開いた状態を引き継ぐ', () => {
    params = new URLSearchParams('recommend=open');
    render();

    expect(sheetIsOpen()).toBe(true);
  });
});
