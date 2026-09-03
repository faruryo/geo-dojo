// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import BottomNav from '@/app/(app)/bottom-nav';

(globalThis as unknown as Record<string, boolean>).IS_REACT_ACT_ENVIRONMENT = true;

let mockPathname = '/';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

function renderNav(pathname: string) {
  mockPathname = pathname;
  const host = document.createElement('div');
  document.body.appendChild(host);
  const r = createRoot(host);
  act(() => {
    r.render(<BottomNav />);
  });
  const findLink = (href: string) => Array.from(host.querySelectorAll('a')).find((el) => el.getAttribute('href') === href);
  return {
    host,
    findLink,
    destroy: () => {
      act(() => {
        r.unmount();
      });
      host.remove();
    },
  };
}

describe('BottomNav Analytics Tab', () => {
  it('4つのナビゲーション項目（ホーム、都道府県、市区町村、分析）が存在すること', () => {
    const { host, destroy } = renderNav('/');
    try {
      const links = host.querySelectorAll('a');
      expect(links).toHaveLength(4);
      expect(Array.from(links).map((l) => l.textContent?.trim())).toEqual(['ホーム', '都道府県', '市区町村', '分析']);
      expect(Array.from(links).map((l) => l.getAttribute('href'))).toEqual(['/', '/quiz/prefecture', '/quiz/municipality', '/analytics']);
    } finally {
      destroy();
    }
  });

  it('/analytics にアクセス中、分析タブがアクティブになり、ホームタブは非アクティブになること', () => {
    const { findLink, destroy } = renderNav('/analytics');
    try {
      const home = findLink('/');
      const analytics = findLink('/analytics');
      expect(analytics?.className).toContain('text-primary');
      expect(analytics?.className).not.toContain('text-muted-foreground');
      expect(home?.className).toContain('text-muted-foreground');
    } finally {
      destroy();
    }
  });

  it('/ にアクセス中、ホームタブがアクティブになり、分析タブは非アクティブになること', () => {
    const { findLink, destroy } = renderNav('/');
    try {
      const home = findLink('/');
      const analytics = findLink('/analytics');
      expect(home?.className).toContain('text-primary');
      expect(analytics?.className).toContain('text-muted-foreground');
    } finally {
      destroy();
    }
  });
});
