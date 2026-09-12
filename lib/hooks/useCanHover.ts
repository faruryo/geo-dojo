'use client';

import { useEffect, useState } from 'react';

const QUERY = '(hover: hover) and (pointer: fine)';

/**
 * マウスなど hover 可能な入力かを購読する。
 *
 * タッチ端末では Safari が互換 mouseenter で hover 色を張り付かせ、
 * click 生成を妨げることがあるため、地図の hover スタイル分岐に使う。
 */
export function useCanHover(): boolean {
  const [canHover, setCanHover] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(QUERY);
    setCanHover(mql.matches);

    const onChange = (e: MediaQueryListEvent) => setCanHover(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return canHover;
}
