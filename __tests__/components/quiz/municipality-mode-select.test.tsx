// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

(globalThis as unknown as Record<string, boolean>).IS_REACT_ACT_ENVIRONMENT = true;

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/quiz/municipality',
}));

// 地図本体は topojson の実行時 fetch が要るので差し替える（ここでの関心は DOM の順序）
vi.mock('@/components/map/MiniJapanMap', () => ({
  MiniJapanMap: () => <div data-testid="mini-map" />,
}));

// シートは TanStack Query の Provider を要求する。開閉はこのテストの対象外
vi.mock('@/components/recommend/recommend-sheet', () => ({
  RecommendSheet: () => null,
}));

const { default: MunicipalityModeSelectPage } = await import(
  '@/app/(app)/quiz/municipality/page'
);

const PREVIEW_LABEL = 'プレイ画面イメージ（操作できません）';

function mount(): HTMLElement {
  const host = document.createElement('div');
  document.body.appendChild(host);
  act(() => {
    createRoot(host).render(<MunicipalityModeSelectPage />);
  });
  return host;
}

function buttonByText(host: HTMLElement, text: string): HTMLButtonElement {
  const found = [...host.querySelectorAll('button')].find((b) =>
    b.textContent?.includes(text),
  );
  if (!found) throw new Error(`ボタンが見つからない: ${text}`);
  return found;
}

function previewLabel(host: HTMLElement): HTMLSpanElement {
  const found = [...host.querySelectorAll('span')].find(
    (s) => s.textContent === PREVIEW_LABEL,
  );
  if (!found) throw new Error(`サンプル枠のラベルが見つからない: ${PREVIEW_LABEL}`);
  return found;
}

beforeEach(() => {
  push.mockClear();
  localStorage.clear();
  document.body.innerHTML = '';
});

describe('市区町村クイズ・モード選択の導線', () => {
  it('CTA はサンプルプレビューより DOM 上で前にある', () => {
    const host = mount();

    const cta = buttonByText(host, 'このモードで遊ぶ');
    const label = previewLabel(host);

    // 説明（プレビュー・出題ルール）が選択とアクションの間に戻ると落ちる
    expect(
      cta.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('選んだモードの設定画面へ遷移する', () => {
    const host = mount();

    act(() => {
      buttonByText(host, '場所当て（地図）').click();
    });
    act(() => {
      buttonByText(host, 'このモードで遊ぶ').click();
    });

    expect(push).toHaveBeenCalledWith('/quiz/municipality/d');
  });

  it('既定（モードB）のまま進める', () => {
    const host = mount();

    act(() => {
      buttonByText(host, 'このモードで遊ぶ').click();
    });

    // resolveInitialSelectedMode の fallbackMode。URL も localStorage も無い初見時
    expect(push).toHaveBeenCalledWith('/quiz/municipality/b');
  });

  it('おすすめは見出し行のボタンだけで、hero カードを積まない', () => {
    const host = mount();

    expect(buttonByText(host, 'おすすめ').textContent).toContain('おすすめ');
    expect(host.textContent).not.toContain('今日のおすすめクイズ');

    const src = readFileSync(
      resolve(process.cwd(), 'app/(app)/quiz/municipality/page.tsx'),
      'utf8',
    );
    expect(src).not.toMatch(/RecommendHeroCard/);
  });
});
