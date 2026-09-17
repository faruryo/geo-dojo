// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useModeAShortcuts, type UseModeAShortcutsOptions } from '@/components/quiz/hud/use-mode-a-shortcuts';

(globalThis as unknown as Record<string, boolean>).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

function TestHarness(props: UseModeAShortcutsOptions) {
  useModeAShortcuts(props);
  return (
    <div>
      <input type="text" data-testid="input" />
      <textarea data-testid="textarea" />
      <button type="button" data-testid="other-button">
        その他ボタン
      </button>
      <button type="button" data-submit-button="true" data-testid="submit-button">
        解答する
      </button>
    </div>
  );
}

function render(options: Partial<UseModeAShortcutsOptions> = {}) {
  const onSubmit = options.onSubmit ?? vi.fn();
  const onClear = options.onClear ?? vi.fn();
  const props: UseModeAShortcutsOptions = {
    canSubmit: options.canSubmit ?? true,
    feedback: options.feedback ?? 'idle',
    onSubmit,
    onClear,
    enabled: options.enabled ?? true,
  };

  act(() => {
    root.render(<TestHarness {...props} />);
  });

  return { onSubmit, onClear };
}

function fireKey(key: string, code = key, target: HTMLElement = document.body) {
  const event = new KeyboardEvent('keydown', {
    key,
    code,
    bubbles: true,
    cancelable: true,
  });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  // 念のため dialog 残骸を除去
  document.querySelectorAll('[role="alertdialog"], [role="dialog"]').forEach((el) => el.remove());
});

describe('useModeAShortcuts: Space / Enter キーでの即時解答確定', () => {
  it('canSubmit === true かつ feedback === idle のとき、Spaceキーで onSubmit が呼ばれデフォルトスクロールが抑止される', () => {
    const { onSubmit } = render({ canSubmit: true, feedback: 'idle' });

    const event = fireKey(' ', 'Space');

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('canSubmit === true かつ feedback === idle のとき、Enterキーで onSubmit が呼ばれる', () => {
    const { onSubmit } = render({ canSubmit: true, feedback: 'idle' });

    const event = fireKey('Enter', 'Enter');

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('canSubmit === false（件数不足等）のとき、Spaceキーを押しても onSubmit は呼ばれないがスクロールは抑止される', () => {
    const { onSubmit } = render({ canSubmit: false, feedback: 'idle' });

    const event = fireKey(' ', 'Space');

    expect(onSubmit).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it('canSubmit === false のとき、Enterキーを押しても onSubmit は呼ばれない', () => {
    const { onSubmit } = render({ canSubmit: false, feedback: 'idle' });

    fireKey('Enter', 'Enter');

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('feedback !== idle（正誤判定表示中）のとき、Space / Enter キーを押しても onSubmit は呼ばれない', () => {
    const { onSubmit } = render({ canSubmit: true, feedback: 'correct' });

    fireKey(' ', 'Space');
    fireKey('Enter', 'Enter');

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('enabled === false のとき、Space / Enter キーを押しても onSubmit は呼ばれない', () => {
    const { onSubmit } = render({ enabled: false, canSubmit: true, feedback: 'idle' });

    fireKey(' ', 'Space');
    fireKey('Enter', 'Enter');

    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('useModeAShortcuts: Escape キーでの都道府県全解除', () => {
  it('feedback === idle のとき、Escapeキーで onClear が呼ばれデフォルト動作が抑止される', () => {
    const { onClear } = render({ feedback: 'idle' });

    const event = fireKey('Escape', 'Escape');

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('feedback !== idle（正誤表示中）のとき、Escapeキーを押しても onClear は呼ばれない', () => {
    const { onClear } = render({ feedback: 'incorrect' });

    fireKey('Escape', 'Escape');

    expect(onClear).not.toHaveBeenCalled();
  });
});

describe('useModeAShortcuts: フォーカスおよびモーダル表示時のガード', () => {
  it('input 要素にフォーカスがあるときは Space / Enter / Escape が無視される', () => {
    const { onSubmit, onClear } = render({ canSubmit: true, feedback: 'idle' });
    const input = host.querySelector<HTMLInputElement>('[data-testid="input"]');
    if (!input) throw new Error('input not found');

    fireKey(' ', 'Space', input);
    fireKey('Enter', 'Enter', input);
    fireKey('Escape', 'Escape', input);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onClear).not.toHaveBeenCalled();
  });

  it('textarea 要素にフォーカスがあるときは Space / Enter / Escape が無視される', () => {
    const { onSubmit, onClear } = render({ canSubmit: true, feedback: 'idle' });
    const textarea = host.querySelector<HTMLTextAreaElement>('[data-testid="textarea"]');
    if (!textarea) throw new Error('textarea not found');

    fireKey(' ', 'Space', textarea);
    fireKey('Enter', 'Enter', textarea);
    fireKey('Escape', 'Escape', textarea);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onClear).not.toHaveBeenCalled();
  });

  it('確定ボタン以外のボタン（例: 中断ボタン）にフォーカスがあるときは Enter / Space で onSubmit を横取りしない', () => {
    const { onSubmit } = render({ canSubmit: true, feedback: 'idle' });
    const otherBtn = host.querySelector<HTMLButtonElement>('[data-testid="other-button"]');
    if (!otherBtn) throw new Error('other button not found');

    const spaceEvent = fireKey(' ', 'Space', otherBtn);
    const enterEvent = fireKey('Enter', 'Enter', otherBtn);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(spaceEvent.defaultPrevented).toBe(false);
    expect(enterEvent.defaultPrevented).toBe(false);
  });

  it('確定ボタン以外のボタンにフォーカスがあるときでも Escape で onClear が呼ばれる', () => {
    const { onClear } = render({ canSubmit: true, feedback: 'idle' });
    const otherBtn = host.querySelector<HTMLButtonElement>('[data-testid="other-button"]');
    if (!otherBtn) throw new Error('other button not found');

    const escapeEvent = fireKey('Escape', 'Escape', otherBtn);

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(escapeEvent.defaultPrevented).toBe(true);
  });

  it('確定ボタン（data-submit-button="true"）にフォーカスがあるときは Enter / Space で onSubmit が呼ばれる', () => {
    const { onSubmit } = render({ canSubmit: true, feedback: 'idle' });
    const submitBtn = host.querySelector<HTMLButtonElement>('[data-testid="submit-button"]');
    if (!submitBtn) throw new Error('submit button not found');

    fireKey(' ', 'Space', submitBtn);
    expect(onSubmit).toHaveBeenCalledTimes(1);

    fireKey('Enter', 'Enter', submitBtn);
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it('alertdialog が表示されているときは Space / Enter / Escape が無視される', () => {
    const { onSubmit, onClear } = render({ canSubmit: true, feedback: 'idle' });

    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'alertdialog');
    document.body.appendChild(dialog);

    fireKey(' ', 'Space');
    fireKey('Enter', 'Enter');
    fireKey('Escape', 'Escape');

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onClear).not.toHaveBeenCalled();

    dialog.remove();
  });
});
