'use client';

import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * OS の「視差効果を減らす」設定を購読する。
 *
 * SSR とハイドレーション不一致を避けるため `false` から始め、マウント後に実値へ寄せる。
 * 導入表示は最初の1問でも正しく分岐する必要があるので、`change` にも追随させる。
 */
export function usePrefersReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(QUERY);
    setReducedMotion(mql.matches);

    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return reducedMotion;
}
