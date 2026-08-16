'use client';

import { useEffect } from 'react';

/**
 * プレイ中のブラウザ戻るボタン誤操作を防止するポップステートガードフック。
 *
 * @param enabled ガードを有効化するか（例: phase === 'playing'）
 * @param onPopState 戻る操作時に実行するコールバック（例: setPhase('setup')）
 */
export function usePopstateGuard(enabled: boolean, onPopState: () => void) {
  useEffect(() => {
    if (!enabled) return;
    window.history.pushState(null, '');
    function handlePopState() {
      onPopState();
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [enabled, onPopState]);
}
