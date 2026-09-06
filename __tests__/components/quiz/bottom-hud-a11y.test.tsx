// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BottomHud, type BottomHudContent } from '@/components/quiz/hud/bottom-hud';

(globalThis as unknown as Record<string, boolean>).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

function render(content: BottomHudContent, onRequestIntro?: () => void) {
  act(() => {
    root.render(<BottomHud content={content} mode="BCD" onRequestIntro={onRequestIntro} />);
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
