'use client';

import { useCallback, useEffect, useState } from 'react';
import { isSoundMuted, setSoundMuted } from '@/lib/quiz/sound-effects';

export function useSoundMuted(): [muted: boolean, setMuted: (muted: boolean) => void] {
  const [muted, setMutedState] = useState(false);

  // SSR/hydration との不一致を避けるためマウント後に localStorage から同期する
  useEffect(() => {
    setMutedState(isSoundMuted());
  }, []);

  const setMuted = useCallback((next: boolean) => {
    setSoundMuted(next);
    setMutedState(next);
  }, []);

  return [muted, setMuted];
}
