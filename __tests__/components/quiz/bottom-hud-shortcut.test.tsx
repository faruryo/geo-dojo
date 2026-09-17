// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BottomHud, type BottomHudContent } from '@/components/quiz/hud/bottom-hud';

(globalThis as unknown as Record<string, boolean>).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

const promptContent: BottomHudContent = { kind: 'prompt', title: '長野県' };

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('BottomHud: センタリングとキーボードショートカット案内バッジ', () => {
  it('コンテンツ領域に mx-auto max-w-2xl が適用されて中央集約される', () => {
    act(() => {
      root.render(
        <BottomHud
          content={promptContent}
          mode="A"
          submit={{
            label: '解答する',
            disabled: false,
            onSubmit: () => {},
            shortcutHint: 'Space',
          }}
        />,
      );
    });

    const contentRow = host.querySelector('footer > div');
    expect(contentRow).not.toBeNull();
    expect(contentRow?.className).toContain('mx-auto');
    expect(contentRow?.className).toContain('max-w-2xl');
  });

  it('submit.shortcutHint が指定され disabled=false のとき、kbdバッジがレンダリングされる', () => {
    act(() => {
      root.render(
        <BottomHud
          content={promptContent}
          mode="A"
          submit={{
            label: '解答する',
            disabled: false,
            onSubmit: () => {},
            shortcutHint: 'Space',
          }}
        />,
      );
    });

    const kbd = host.querySelector('button kbd');
    expect(kbd).not.toBeNull();
    expect(kbd?.textContent).toBe('Space');
    expect(kbd?.className).toContain('md:inline-flex');
    expect(kbd?.className).toContain('hidden');
  });

  it('disabled=true（件数不足等）のときは kbd バッジが表示されない', () => {
    act(() => {
      root.render(
        <BottomHud
          content={promptContent}
          mode="A"
          submit={{
            label: 'あと 1 か所',
            disabled: true,
            onSubmit: () => {},
            shortcutHint: 'Space',
          }}
        />,
      );
    });

    const kbd = host.querySelector('button kbd');
    expect(kbd).toBeNull();
  });

  it('shortcutHint が未指定のときは kbd バッジが表示されない', () => {
    act(() => {
      root.render(
        <BottomHud
          content={promptContent}
          mode="A"
          submit={{
            label: '解答する',
            disabled: false,
            onSubmit: () => {},
          }}
        />,
      );
    });

    const kbd = host.querySelector('button kbd');
    expect(kbd).toBeNull();
  });

  it('確定ボタンに data-submit-button="true" が付与されている', () => {
    act(() => {
      root.render(
        <BottomHud
          content={promptContent}
          mode="A"
          submit={{
            label: '解答する',
            disabled: false,
            onSubmit: () => {},
            shortcutHint: 'Space',
          }}
        />,
      );
    });

    const submitBtn = host.querySelector('button[data-submit-button="true"]');
    expect(submitBtn).not.toBeNull();
    expect(submitBtn?.textContent).toContain('解答する');
  });
});
