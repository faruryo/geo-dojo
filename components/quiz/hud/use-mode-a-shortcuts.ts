'use client';

import { useEffect } from 'react';
import type { FeedbackState } from '../use-quiz-state';

export interface UseModeAShortcutsOptions {
  readonly enabled?: boolean;
  readonly canSubmit: boolean;
  readonly feedback: FeedbackState;
  readonly onSubmit: () => void;
  readonly onClear: () => void;
}

function isEditableTarget(target: HTMLElement | null): boolean {
  if (!target) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  );
}

function isModalOpen(): boolean {
  return (
    typeof document !== 'undefined' &&
    Boolean(document.querySelector('[role="alertdialog"], [role="dialog"]'))
  );
}

function isNonSubmitButton(target: HTMLElement | null): boolean {
  return Boolean(
    target &&
      target.tagName === 'BUTTON' &&
      target.getAttribute('data-submit-button') !== 'true',
  );
}

/**
 * Mode A（県当て）向けのキーボードショートカット。
 *
 * - Space / Enter: 解答確定（canSubmit === true かつ feedback === 'idle' の場合のみ）
 * - Escape: 選択中の都道府県を全解除（リセット）
 *
 * 入力要素にフォーカスがある場合や、ダイアログ表示中、解答済みフィードバック中は発火しない。
 */
export function useModeAShortcuts({
  enabled = true,
  canSubmit,
  feedback,
  onSubmit,
  onClear,
}: UseModeAShortcutsOptions) {
  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;

      const target = event.target as HTMLElement | null;
      if (isEditableTarget(target) || isModalOpen() || isNonSubmitButton(target)) {
        return;
      }

      if (event.key === ' ' || event.code === 'Space') {
        event.preventDefault();
        if (feedback === 'idle' && canSubmit) onSubmit();
        return;
      }

      if (event.key === 'Enter') {
        if (feedback === 'idle' && canSubmit) {
          event.preventDefault();
          onSubmit();
        }
        return;
      }

      if (event.key === 'Escape' && feedback === 'idle') {
        event.preventDefault();
        onClear();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, canSubmit, feedback, onSubmit, onClear]);
}
