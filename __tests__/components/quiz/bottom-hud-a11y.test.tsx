// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BottomHud, type BottomHudContent } from '@/components/quiz/hud/bottom-hud';

(globalThis as unknown as Record<string, boolean>).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

const CHOICES = ['宮城県', '山形県', '福島県', '岩手県'] as const;

function render(
  content: BottomHudContent,
  onRequestIntro?: () => void,
  withChoices = false,
) {
  act(() => {
    root.render(
      <BottomHud
        content={content}
        mode="BCD"
        onRequestIntro={onRequestIntro}
        choices={
          withChoices
            ? {
                items: CHOICES,
                selected: null,
                correct: CHOICES[0],
                feedback: 'idle',
                onSelect: () => {},
              }
            : undefined
        }
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

const prompt: BottomHudContent = { kind: 'prompt', title: '鶴岡市', subTitle: '（山形県）' };
const feedback: BottomHudContent = {
  kind: 'feedback',
  correct: false,
  detail: '鶴岡市（つるおかし）',
};

describe('BottomHud のアクセシビリティ', () => {
  it('再表示ボタンに aria-label を付けない（お題が読み上げから消えるため）', () => {
    render(prompt, () => {});

    const button = host.querySelector('button');
    expect(button).not.toBeNull();
    expect(button?.hasAttribute('aria-label')).toBe(false);
  });

  it('ボタンの中にお題そのものが含まれる', () => {
    render(prompt, () => {});

    const button = host.querySelector('button');
    expect(button?.textContent).toContain('鶴岡市');
    expect(button?.textContent).toContain('（山形県）');
  });

  it('タップで再表示できることを読み上げ向けに添える', () => {
    render(prompt, () => {});

    expect(host.querySelector('.sr-only')?.textContent).toContain('再表示');
  });

  it('フィードバックはボタンにしない（操作対象ではない）', () => {
    render(feedback, () => {});

    expect(host.querySelector('button')).toBeNull();
    expect(host.textContent).toContain('鶴岡市（つるおかし）');
  });

  it('ボタンの中に p を置かない（button の内容モデルとして不正）', () => {
    render(prompt, () => {});

    expect(host.querySelector('button p')).toBeNull();
  });
});

describe('帯のタップでお題を再表示する', () => {
  it('選択肢の余白を触ってもお題が戻る', () => {
    let calls = 0;
    render(prompt, () => { calls += 1; }, true);

    const region = host.querySelector('footer > div');
    if (!region) throw new Error('選択肢の領域が無い');
    act(() => {
      region.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(calls).toBe(1);
  });

  it('選択肢そのものを触ったときは戻さない', () => {
    let calls = 0;
    render(prompt, () => { calls += 1; }, true);

    const choice = [...host.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === CHOICES[0],
    );
    if (!choice) throw new Error('選択肢が無い');
    act(() => {
      choice.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(calls).toBe(0);
  });

  it('フィードバック中は帯を触っても戻さない', () => {
    let calls = 0;
    render(feedback, () => { calls += 1; }, true);

    const footer = host.querySelector('footer');
    if (!footer) throw new Error('帯が無い');
    act(() => {
      footer.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(calls).toBe(0);
  });
});
