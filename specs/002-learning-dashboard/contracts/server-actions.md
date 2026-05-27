# Server Actions Contract: 学習ダッシュボード

**Branch**: `002-learning-dashboard` | **Date**: 2026-05-25

## 配置

`app/(app)/dashboard/actions.ts`（新規）

既存の `app/(app)/quiz/municipality/actions.ts` は変更しない。ダッシュボード専用の Server Actions を新ファイルに配置する。

## Actions

### getDashboardSummary

サマリーカード用の累計統計を返す。

```typescript
export async function getDashboardSummary(): Promise<{
  totalQuestions: number;
  totalCorrect: number;
  overallAccuracy: number;       // 0.0〜1.0
  studiedCount: number;          // 1回以上出題された市区町村数
  clearedCount: number;          // 1回以上正解した市区町村数
  totalMunicipalities: number;   // municipality_master の全件数
  coverageRate: number;          // clearedCount / totalMunicipalities (0.0〜1.0)
  // 前日比
  prevTotalQuestions: number;
  prevTotalCorrect: number;
  prevOverallAccuracy: number;
  prevStudiedCount: number;
  prevClearedCount: number;
  prevCoverageRate: number;
}>
```

### getAccuracyTrend

正答率推移グラフ用の日別データを返す。

```typescript
export async function getAccuracyTrend(input: {
  period: '7d' | '30d' | 'all';
  mode: 'all' | 'A' | 'B' | 'C' | 'D';
}): Promise<Array<{
  date: string;            // 'YYYY-MM-DD' or 'YYYY-Www' (週次集約時)
  correctCount: number;
  totalCount: number;
  accuracy: number;        // 0.0〜1.0
}>>
```

- `period: 'all'` で90日超の場合、90日以前は週単位に集約
- 日付はJST基準

### getWeaknessRanking

苦手市区町村ランキングを返す。

```typescript
export async function getWeaknessRanking(): Promise<Array<{
  municipalityCode: string;
  municipalityName: string;
  prefecture: string;
  totalCount: number;
  errorCount: number;
  errorRate: number;       // 0.0〜1.0
}>>
```

- 上位20件、errorRate降順
- 既存 `getMunicipalityWeakness()` を拡張（totalCount/errorCount追加）

### getStreak

ストリーク情報を返す。

```typescript
export async function getStreak(): Promise<{
  currentStreak: number;   // 現在の連続日数
  longestStreak: number;   // 最長記録
  hasPlayedToday: boolean; // 今日クイズを実施済みか
}>
```

- 日付境界はJST固定（UTC+9）

### getDifficultyProgress

難易度バケット別のコンプリート率を返す。

```typescript
export async function getDifficultyProgress(): Promise<Array<{
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  totalCount: number;      // そのバケットの全市区町村数
  clearedCount: number;    // 1回以上正解した数
  coverageRate: number;    // 0.0〜1.0
}>>
```

### getReviewRecommendations

復習おすすめリストを返す。

```typescript
export async function getReviewRecommendations(): Promise<Array<{
  municipalityCode: string;
  municipalityName: string;
  prefecture: string;
  lastAnsweredAt: string;  // ISO 8601
  errorRate: number;       // 0.0〜1.0
}>>
```

- 不正解歴あり＋最終出題から7日以上経過
- 上位10件、errorRate降順

### getRecentSessions

セッション推定結果を返す（ベスト記録・前回比較用）。

```typescript
export async function getRecentSessions(input: {
  limit: number;           // 取得するセッション数
}): Promise<Array<{
  sessionIndex: number;    // 新しい順に 0, 1, 2...
  mode: 'A' | 'B' | 'C' | 'D';
  startedAt: string;       // ISO 8601
  questionCount: number;
  correctCount: number;
  accuracy: number;        // 0.0〜1.0
}>>
```

- セッション推定: 同一モード・5分以内の連続回答をグルーピング

## TanStack Query Hooks

`lib/hooks/` に配置。

| Hook | Query Key | staleTime | Server Action |
|------|-----------|-----------|---------------|
| `useDashboardSummary()` | `['dashboard', 'summary']` | 60s | `getDashboardSummary` |
| `useAccuracyTrend(period, mode)` | `['dashboard', 'trend', period, mode]` | 60s | `getAccuracyTrend` |
| `useWeaknessRanking()` | `['dashboard', 'weakness']` | 60s | `getWeaknessRanking` |
| `useStreak()` | `['dashboard', 'streak']` | 60s | `getStreak` |
| `useDifficultyProgress()` | `['dashboard', 'difficulty']` | 60s | `getDifficultyProgress` |
| `useReviewRecommendations()` | `['dashboard', 'review']` | 60s | `getReviewRecommendations` |
| `useRecentSessions(limit)` | `['dashboard', 'sessions', limit]` | 60s | `getRecentSessions` |
