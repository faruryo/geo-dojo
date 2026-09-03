// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AnalyticsClient } from '@/components/analytics/analytics-client';

(globalThis as unknown as Record<string, boolean>).IS_REACT_ACT_ENVIRONMENT = true;

const mockSummaryData = {
  totalQuestions: 42,
  totalCorrect: 35,
  overallAccuracy: 0.833,
  conquestRateA: 0.45,
  conquestRateD: 0.2,
  studiedCount: 25,
  clearedCount: 20,
  totalMunicipalities: 1741,
  coverageRate: 0.011,
  prev: {
    totalQuestions: 30,
    totalCorrect: 25,
    overallAccuracy: 0.833,
    conquestRateA: 0.4,
    conquestRateD: 0.15,
    studiedCount: 20,
    clearedCount: 15,
    totalMunicipalities: 1741,
    coverageRate: 0.008,
  },
};

let currentSummary: typeof mockSummaryData | null = mockSummaryData;
let currentSummaryLoading = false;

vi.mock('@/lib/hooks/useDashboardSummary', () => ({
  useDashboardSummary: () => ({
    data: currentSummary,
    isLoading: currentSummaryLoading,
  }),
}));

vi.mock('@/lib/hooks/useAccuracyTrend', () => ({
  useAccuracyTrend: () => ({
    data: [{ date: '2026-09-01', all: 80, easy: 90 }],
    isLoading: false,
  }),
}));

vi.mock('@/lib/hooks/useDifficultyProgress', () => ({
  useDifficultyProgress: () => ({
    data: [
      { difficulty: 'easy', clearedCount: 10, totalCount: 20, rate: 0.5, coverageRate: 0.5 },
      { difficulty: 'medium', clearedCount: 5, totalCount: 20, rate: 0.25, coverageRate: 0.25 },
    ],
    isLoading: false,
  }),
}));

vi.mock('@/lib/hooks/useWeaknessRanking', () => ({
  useWeaknessRanking: () => ({
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
  }),
}));

describe('AnalyticsClient', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
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

  it('クイズプレイ履歴がある場合、詳細分析ヘッダー、4サマリーカード、推移、進捗、苦手ランキングが描画されること', () => {
    currentSummary = mockSummaryData;
    currentSummaryLoading = false;

    act(() => {
      root?.render(<AnalyticsClient />);
    });

    expect(container?.textContent).toContain('詳細分析');
    expect(container?.textContent).toContain('学習の推移・苦手・モード別進捗');

    // 4サマリーカード
    expect(container?.textContent).toContain('累計出題数');
    expect(container?.textContent).toContain('42');
    expect(container?.textContent).toContain('全体正答率');
    expect(container?.textContent).toContain('83.3%');
    expect(container?.textContent).toContain('県当て(A)制覇率');
    expect(container?.textContent).toContain('45.0%');
    expect(container?.textContent).toContain('場所当て(D)制覇率');
    expect(container?.textContent).toContain('20.0%');

    // 各セクション
    expect(container?.textContent).toContain('正答率推移');
    expect(container?.textContent).toContain('難易度別進捗');
    expect(container?.textContent).toContain('苦手ランキング');
    expect(container?.textContent).toContain('札幌市');
  });

  it('未プレイ（totalQuestions: 0）の場合、EmptyState が表示されること', () => {
    currentSummary = {
      ...mockSummaryData,
      totalQuestions: 0,
      totalCorrect: 0,
      overallAccuracy: 0,
      conquestRateA: 0,
      conquestRateD: 0,
    };
    currentSummaryLoading = false;

    act(() => {
      root?.render(<AnalyticsClient />);
    });

    expect(container?.textContent).toContain('詳細分析');
    expect(container?.textContent).toContain('まだクイズを受けていません。クイズを始めましょう！');
    expect(container?.textContent).not.toContain('正答率推移');
    expect(container?.textContent).not.toContain('苦手ランキング');
  });
});
