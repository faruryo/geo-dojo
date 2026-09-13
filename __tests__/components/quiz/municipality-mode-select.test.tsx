// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
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

const roots: Root[] = [];

function mount(): HTMLElement {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  roots.push(root);
  act(() => {
    root.render(<MunicipalityModeSelectPage />);
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

function modeRadios(host: HTMLElement): HTMLInputElement[] {
  return [...host.querySelectorAll<HTMLInputElement>('input[type="radio"][name="quiz-mode"]')];
}

/** モードカードを選ぶ。カードは label なので button 経由では押せない */
function selectMode(host: HTMLElement, longLabel: string): void {
  const card = [...host.querySelectorAll('label')].find((l) =>
    l.textContent?.includes(longLabel),
  );
  const radio = card?.querySelector('input');
  if (!radio) throw new Error(`モードカードが見つからない: ${longLabel}`);
  act(() => {
    radio.click();
  });
}

function inertBox(host: HTMLElement): HTMLElement {
  const found = host.querySelector<HTMLElement>('[inert]');
  if (!found) throw new Error('inert なプレビュー枠が見つからない');
  return found;
}

function previewLabel(host: HTMLElement): HTMLParagraphElement {
  const found = [...host.querySelectorAll('p')].find(
    (el) => el.textContent?.trim() === PREVIEW_LABEL,
  );
  if (!found) throw new Error(`サンプル枠のラベルが見つからない: ${PREVIEW_LABEL}`);
  return found;
}

beforeEach(() => {
  push.mockClear();
  localStorage.clear();
});

// innerHTML を空にするだけでは React の effect cleanup が走らず root が残る
afterEach(() => {
  act(() => {
    for (const root of roots) root.unmount();
  });
  roots.length = 0;
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

  it('サンプルはキーボードからも操作できない', () => {
    const host = mount();
    const box = inertBox(host);

    // 地図の各都道府県は react-simple-maps が tabIndex={0} を固定で付けるため、
    // pointer-events-none だけではタブで入れてしまう
    expect(box.textContent).toContain('この市区町村はどの都道府県？');
    // ラベルは枠の外に置き、読み上げには残す
    expect(box.contains(previewLabel(host))).toBe(false);
  });

  it('選択中モードの説明はサンプル枠のキャプションに置き、CTA の上で見出しを重複させない', () => {
    const host = mount();
    const cta = buttonByText(host, 'このモードで遊ぶ');

    // 既定はモードB。longLabel はカードに出ているので、枠外での再掲は1回だけ
    const longLabelCount = [...host.querySelectorAll('p')].filter(
      (el) => el.textContent?.trim() === '県当て（4択）・練習',
    ).length;
    expect(longLabelCount).toBe(1);

    const caption = [...host.querySelectorAll('p')].find(
      (el) => el.textContent?.trim() === '市区町村名から所属県を4択で答える練習。',
    );
    expect(caption).toBeDefined();
    expect(
      cta.compareDocumentPosition(inertBox(host)) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('選択中のモードを radio の checked で支援技術に伝える', () => {
    const host = mount();
    const radios = modeRadios(host);

    expect(radios).toHaveLength(4);
    // 4つから1つの排他選択。トグルボタン（aria-pressed）では表せない関係なので、
    // radiogroup に入れて選択状態を checked で伝える
    expect(host.querySelector('[role="radiogroup"]')?.contains(radios[0])).toBe(true);
    // CTA の文言からモード名を外したので、選択状態はここでしか伝わらない
    expect(radios.map((r) => r.checked)).toEqual([false, true, false, false]);

    selectMode(host, '場所当て（地図）');
    expect(modeRadios(host).map((r) => r.checked)).toEqual([false, false, false, true]);
  });

  it('選んだモードの設定画面へ遷移する', () => {
    const host = mount();

    selectMode(host, '場所当て（地図）');
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
