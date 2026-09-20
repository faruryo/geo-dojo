'use client';

import { useEffect } from 'react';

/**
 * 解答フィードバック中の Space / Enter キーによる即時スキップ。
 * active === true のときのみ keydown リスナーを登録し、入力要素や長押しリピートは除外する (FR-004a, FR-004c)。
 */
export function useFeedbackKeyboardSkip(active: boolean, onSkip: () => void) {
  useEffect(() => {
    if (!active) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) return;

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.key === ' ' || event.code === 'Space' || event.key === 'Enter') {
        event.preventDefault();
        onSkip();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active, onSkip]);
}
