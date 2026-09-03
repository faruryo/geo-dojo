// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AnalyticsClient } from '@/components/analytics/analytics-client';

(globalThis as unknown as Record<string, boolean>).IS_REACT_ACT_ENVIRONMENT = true;

const mockSummaryData = {
  totalQuestions: 50,
  totalCorrect: 40,
  overallAccuracy: 0.8,
  conquestRateA: 0.5,
  conquestRateD: 0.3,
  studiedCount: 30,
  clearedCount: 25,
  totalMunicipalities: 1741,
  coverageRate: 0.014,
  prev: {
    totalQuestions: 40,
    totalCorrect: 30,
    overallAccuracy: 0.75,
    conquestRateA: 0.4,
    conquestRateD: 0.25,
    studiedCount: 25,
    clearedCount: 20,
    totalMunicipalities: 1741,
    coverageRate: 0.011,
  },
};

const weaknessCalls: unknown[] = [];
const accuracyCalls: unknown[] = [];
const progressCalls: unknown[] = [];

vi.mock('@/lib/hooks/useDashboardSummary', () => ({
  useDashboardSummary: () => ({
    data: mockSummaryData,
    isLoading: false,
  }),
}));

vi.mock('@/lib/hooks/useAccuracyTrend', () => ({
  useAccuracyTrend: (period: string, mode: string, region: string) => {
    accuracyCalls.push({ period, mode, region });
    return {
      data: [{ date: '2026-09-01', all: 80 }],
      isLoading: false,
    };
  },
}));

vi.mock('@/lib/hooks/useDifficultyProgress', () => ({
  useDifficultyProgress: (mode: string, region: string) => {
    progressCalls.push({ mode, region });
    return {
      data: [
        { difficulty: 'easy', clearedCount: 10, totalCount: 20, rate: 0.5, coverageRate: 0.5 },
      ],
      isLoading: false,
    };
  },
}));

vi.mock('@/lib/hooks/useWeaknessRanking', () => ({
  useWeaknessRanking: (opts?: unknown) => {
    weaknessCalls.push(opts);
    return {
      data: [
        {
          municipalityCode: '01100',
          municipalityName: '札幌市',
          prefecture: '北海道',
          mode: 'A',
          region: '北海道',
          difficulty: 'easy',
          totalCount: 5,
          errorCount: 3,
          errorRate: 0.6,
        },
      ],
      isLoading: false,
    };
  },
}));

describe('AnalyticsClient Filter Integration', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    weaknessCalls.length = 0;
    accuracyCalls.length = 0;
    progressCalls.length = 0;
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

  it('初期レンダリング時にデフォルト条件（7d, all, 全国）で各クエリが呼ばれること', () => {
    act(() => {
      root?.render(<AnalyticsClient />);
    });

    expect(weaknessCalls).toContainEqual({ period: '7d', mode: 'all', region: '全国' });
    expect(accuracyCalls).toContainEqual({ period: '7d', mode: 'all', region: '全国' });
    expect(progressCalls).toContainEqual({ mode: 'all', region: '全国' });
  });

  it('期間タブをクリックしたとき、クエリが新しい期間（30d）で呼ばれること', () => {
    act(() => {
      root?.render(<AnalyticsClient />);
    });

    // 「30日」ボタンを探してクリック
    const buttons = container?.querySelectorAll('button') ?? [];
    const button30d = Array.from(buttons).find((b) => b.textContent?.trim() === '30日');
    expect(button30d).toBeDefined();

    act(() => {
      button30d?.click();
    });

    expect(weaknessCalls).toContainEqual({ period: '30d', mode: 'all', region: '全国' });
    expect(accuracyCalls).toContainEqual({ period: '30d', mode: 'all', region: '全国' });
  });

  it('モードタブをクリックしたとき、024命名規則（県当て(A)）でクエリが連動すること', () => {
    act(() => {
      root?.render(<AnalyticsClient />);
    });

    // 「県当て(A)」ボタンを探してクリック
    const buttons = container?.querySelectorAll('button') ?? [];
    const buttonModeA = Array.from(buttons).find((b) => b.textContent?.trim() === '県当て(A)');
    expect(buttonModeA).toBeDefined();

    act(() => {
      buttonModeA?.click();
    });

    expect(weaknessCalls).toContainEqual({ period: '7d', mode: 'A', region: '全国' });
    expect(accuracyCalls).toContainEqual({ period: '7d', mode: 'A', region: '全国' });
    expect(progressCalls).toContainEqual({ mode: 'A', region: '全国' });
  });

  it('地方タブをクリックしたとき、選択地方（東北）でクエリが連動すること', () => {
    act(() => {
      root?.render(<AnalyticsClient />);
    });

    // 「東北」ボタンを探してクリック
    const buttons = container?.querySelectorAll('button') ?? [];
    const buttonTohoku = Array.from(buttons).find((b) => b.textContent?.trim() === '東北');
    expect(buttonTohoku).toBeDefined();

    act(() => {
      buttonTohoku?.click();
    });

    expect(weaknessCalls).toContainEqual({ period: '7d', mode: 'all', region: '東北' });
    expect(accuracyCalls).toContainEqual({ period: '7d', mode: 'all', region: '東北' });
    expect(progressCalls).toContainEqual({ mode: 'all', region: '東北' });
  });
});
