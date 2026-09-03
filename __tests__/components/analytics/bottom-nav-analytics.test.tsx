// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import BottomNav from '@/app/(app)/bottom-nav';

(globalThis as unknown as Record<string, boolean>).IS_REACT_ACT_ENVIRONMENT = true;

let mockPathname = '/';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

describe('BottomNav Analytics Tab', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
    root = null;
  });

  it('4つのナビゲーション項目（ホーム、都道府県、市区町村、分析）が存在すること', () => {
    mockPathname = '/';
    act(() => {
      root?.render(<BottomNav />);
    });

    const links = container?.querySelectorAll('a') ?? [];
    expect(links).toHaveLength(4);

    const labels = Array.from(links).map((l) => l.textContent?.trim());
    expect(labels).toEqual(['ホーム', '都道府県', '市区町村', '分析']);

    const hrefs = Array.from(links).map((l) => l.getAttribute('href'));
    expect(hrefs).toEqual(['/', '/quiz/prefecture', '/quiz/municipality', '/analytics']);
  });

  it('/analytics にアクセス中、分析タブがアクティブ（text-primary）になり、ホームタブは非アクティブになること', () => {
    mockPathname = '/analytics';
    act(() => {
      root?.render(<BottomNav />);
    });

    const links = container?.querySelectorAll('a') ?? [];
    const homeLink = Array.from(links).find((l) => l.getAttribute('href') === '/');
    const analyticsLink = Array.from(links).find((l) => l.getAttribute('href') === '/analytics');

    expect(analyticsLink?.className).toContain('text-primary');
    expect(analyticsLink?.className).not.toContain('text-muted-foreground');

    expect(homeLink?.className).toContain('text-muted-foreground');
    expect(homeLink?.className).not.toContain('text-primary');
  });

  it('/ にアクセス中、ホームタブがアクティブになり、分析タブは非アクティブになること', () => {
    mockPathname = '/';
    act(() => {
      root?.render(<BottomNav />);
    });

    const links = container?.querySelectorAll('a') ?? [];
    const homeLink = Array.from(links).find((l) => l.getAttribute('href') === '/');
    const analyticsLink = Array.from(links).find((l) => l.getAttribute('href') === '/analytics');

    expect(homeLink?.className).toContain('text-primary');
    expect(analyticsLink?.className).toContain('text-muted-foreground');
  });
});
