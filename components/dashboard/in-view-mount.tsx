'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { shouldRevealFromEntries } from '@/lib/dashboard/in-view';

/**
 * ビューポートに入るまで children をマウントしない。
 * ファーストビュー外のチャート取得を遅らせるために使う。
 */
export function InViewMount({
  children,
  rootMargin = '200px',
}: Readonly<{
  children: ReactNode;
  rootMargin?: string;
}>) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;

    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (shouldRevealFromEntries(entries)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [shown, rootMargin]);

  return (
    <div ref={ref} className="flex min-h-px flex-col gap-6">
      {shown ? children : null}
    </div>
  );
}
