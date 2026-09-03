/**
 * TanStack Query の Query Key Factory。
 *
 * 設計方針:
 * - 既存のキー配列（'dashboard', 'srs-summary' など）を 100% 維持する。
 * - クイズ完了後の invalidateQueries({ queryKey: queryKeys.dashboard.all }) で
 *   ダッシュボードと復習カードを一括更新できる構造を保つ。
 */
export const queryKeys = {
  dashboard: {
    all: ['dashboard'] as const,
    summary: () => ['dashboard', 'summary'] as const,
    trend: (period: string, mode: string, region: string = '全国') =>
      ['dashboard', 'trend', period, mode, region] as const,
    completionTrend: (period: string, mode: string, region: string = '全国') =>
      ['dashboard', 'completionTrend', period, mode, region] as const,
    completion: (mode: string = 'all', region: string = '全国') =>
      ['dashboard', 'completion', mode, region] as const,
    difficulty: (mode: string = 'all', region: string = '全国') =>
      ['dashboard', 'difficulty', mode, region] as const,
    weakness: (period: string = 'all', mode: string = 'all', region: string = '全国') =>
      ['dashboard', 'weakness', period, mode, region] as const,
    streak: () => ['dashboard', 'streak'] as const,
    srsSummary: () => ['dashboard', 'srs-summary'] as const,
    srsSchedule: (days: number = 7) => ['dashboard', 'srs-schedule', days] as const,
    srsList: (mode: string = 'all', page: number = 0, pageSize: number = 25) =>
      ['dashboard', 'srs-list', mode, page, pageSize] as const,
    srsModeBreakdown: () => ['dashboard', 'srs-mode-breakdown'] as const,
  },
  municipality: {
    all: ['municipality'] as const,
    master: () => ['municipality', 'master'] as const,
    weakness: () => ['municipality', 'weakness'] as const,
    clearedCodes: (mode: string) => ['municipality', 'clearedCodes', mode] as const,
  },
  recommendation: {
    all: ['recommendation'] as const,
    user: (userId: string) => ['recommendation', userId] as const,
  },
  browserUserId: ['browser-user-id'] as const,
};
