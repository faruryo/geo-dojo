// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
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

function renderFilterView() {
  weaknessCalls.length = 0;
  accuracyCalls.length = 0;
  progressCalls.length = 0;
  const mountPoint = document.createElement('div');
  document.body.appendChild(mountPoint);
  const r = createRoot(mountPoint);
  act(() => {
    r.render(<AnalyticsClient />);
  });
  const clickButton = (text: string) => {
    const btn = Array.from(mountPoint.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);
    expect(btn).toBeDefined();
    act(() => {
      btn?.click();
    });
  };
  return {
    mountPoint,
    clickButton,
    unmount: () => {
      act(() => {
        r.unmount();
      });
      mountPoint.remove();
    },
  };
}

describe('AnalyticsClient Filter Integration', () => {
  it('初期レンダリング時にデフォルト条件（7d, all, 全国）で各クエリが呼ばれること', () => {
    const { unmount } = renderFilterView();
    try {
      expect(weaknessCalls).toContainEqual({ period: '7d', mode: 'all', region: '全国' });
      expect(accuracyCalls).toContainEqual({ period: '7d', mode: 'all', region: '全国' });
      expect(progressCalls).toContainEqual({ mode: 'all', region: '全国' });
    } finally {
      unmount();
    }
  });

  it('期間タブをクリックしたとき、クエリが新しい期間（30d）で呼ばれること', () => {
    const { clickButton, unmount } = renderFilterView();
    try {
      clickButton('30日');
      expect(weaknessCalls).toContainEqual({ period: '30d', mode: 'all', region: '全国' });
      expect(accuracyCalls).toContainEqual({ period: '30d', mode: 'all', region: '全国' });
    } finally {
      unmount();
    }
  });

  it('モードタブをクリックしたとき、024命名規則（県当て(A)）でクエリが連動すること', () => {
    const { clickButton, unmount } = renderFilterView();
    try {
      clickButton('県当て(A)');
      expect(weaknessCalls).toContainEqual({ period: '7d', mode: 'A', region: '全国' });
      expect(accuracyCalls).toContainEqual({ period: '7d', mode: 'A', region: '全国' });
      expect(progressCalls).toContainEqual({ mode: 'A', region: '全国' });
    } finally {
      unmount();
    }
  });

  it('地方タブをクリックしたとき、選択地方（東北）でクエリが連動すること', () => {
    const { clickButton, unmount } = renderFilterView();
    try {
      clickButton('東北');
      expect(weaknessCalls).toContainEqual({ period: '7d', mode: 'all', region: '東北' });
      expect(accuracyCalls).toContainEqual({ period: '7d', mode: 'all', region: '東北' });
      expect(progressCalls).toContainEqual({ mode: 'all', region: '東北' });
    } finally {
      unmount();
    }
  });
});
