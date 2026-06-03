# Implementation Plan: 科学的間隔反復による間違い復習

**Branch**: `005-spaced-review` | **Date**: 2026-06-03 | **Spec**: [spec.md](./spec.md)

## Summary

SM-2 間隔反復アルゴリズム・`srs_records` テーブル・バックフィル SQL・復習クイズセッション・
一覧ページ・サーバーアクションはすべて **実装済み**。
本 plan が対象とする残作業は「**ダッシュボードの今日の復習を最上位に配置し、
復習完了後に ✨ 今日のおすすめクイズへ誘導する UX フロー**」のみ。

具体的には次の 3 点を実装する。

1. **ダッシュボードレイアウト**: `ReviewRecommendations` を先頭に移動、`RecommendHeroCard` を直後に配置
2. **復習完了後 CTA**: 復習セッション結果画面に「✨ 今日のおすすめクイズを試す」ボタンを追加
3. **既存重複導線の整理**: 古い独立配置の `RecommendHeroCard`（クイズ未経験ユーザー向け）を保ちつつ、経験ユーザーには新しい順序を提供

## Technical Context

**Language/Version**: TypeScript / Next.js 15.2.6+, React 19  
**Primary Dependencies**: Drizzle ORM, TanStack Query v5, shadcn/ui, Tailwind CSS v4  
**Storage**: PostgreSQL (Supabase) — `srs_records` テーブル migration 済み  
**Testing**: Vitest（純粋関数のみ）  
**Target Platform**: Web — モバイルファースト 375px, ダークモード (#111111)  
**Project Type**: Web application (Next.js App Router)  
**Performance Goals**: SC-001 達成（ダッシュボード表示→復習開始 3 タップ以内）  
**Constraints**: 既存コンポーネントの破壊的変更を最小化。データフロー・フェッチロジック変更なし  
**Scale/Scope**: 1 ユーザー最大 ~7200 SRS records（1800 市区町村 × 4 モード）

## Constitution Check

### I. セキュリティ & コンプライアンス
- ✅ 新規 API キーなし。既存 Supabase 認証をそのまま利用。
- ✅ Next.js 15.2.6+ 維持。

### II. アーキテクチャ & パフォーマンス
- ✅ @serwist/next 継続利用（変更なし）。
- ✅ Read: TanStack Query キャッシュ活用（useDueReviewSummary 等、変更なし）。
- ✅ Write: Server Actions パターン継続（変更なし）。
- ✅ `srs_records (userId, dueDate)` 複合インデックス維持（migration 0001 で作成済み）。

### III. ロジック & UI
- ✅ モバイルファースト 375px / ダークモード継続。
- ✅ グローバルストア不使用。URL ステート（`?recommend=open`）と TanStack Query キャッシュを活用。

**GATE**: 全 PASS。

## 実装済み機能（参照用）

| 機能 | ファイル | ステータス |
|------|---------|-----------|
| srs_records テーブル + RLS + バックフィル SQL | `supabase/migrations/0001_messy_meltdown.sql` | ✅ 完了 |
| SM-2 アルゴリズム | `lib/quiz/srs/sm2.ts` | ✅ 完了 |
| SRS 更新ロジック（同日重複ガード含む） | `lib/quiz/srs/update.ts` | ✅ 完了 |
| クイズ回答時の SRS 自動更新 | `app/(app)/quiz/municipality/actions.ts` | ✅ 完了 |
| 復習クイズセッション（モード混在） | `app/(app)/quiz/review/page.tsx` | ✅ 完了 |
| 復習一覧ページ（ページング・フィルタ・サマリ表） | `app/(app)/quiz/review/items/page.tsx` | ✅ 完了 |
| ReviewRecommendations コンポーネント | `components/dashboard/review-recommendations.tsx` | ✅ 完了 |
| ReviewProgress コンポーネント | `components/dashboard/review-progress.tsx` | ✅ 完了 |
| 全 SRS サーバーアクション | `app/(app)/dashboard/actions.ts` | ✅ 完了 |
| 卒業閾値: interval≥30 日 AND repetitions≥4 | `lib/quiz/srs/sm2.ts:GRADUATION_*` | ✅ 完了 |
| セッション出題上限: 20 件 | `app/(app)/quiz/review/actions.ts` | ✅ 完了 |

## 残作業スコープ

### T1: ダッシュボードレイアウト変更

**対象ファイル**: `app/(app)/page.tsx`

**現在の配置順（問題）**:
```
Title → MilestoneBanner → RecommendHeroCard → SummaryCards
→ [guard: totalQuestions > 0]
  → StreakDisplay → Charts → WeaknessRanking
  → ReviewRecommendations  ← 下部に埋まっている
  → ReviewProgress
```

**新しい配置順**:
```
Title → MilestoneBanner
→ [新規ユーザー向け: totalQuestions === 0]
  → RecommendHeroCard       ← 新規ユーザーは引き続き recommend を最初に見る
→ SummaryCards
→ [guard: totalQuestions > 0]
  → ReviewRecommendations   ← ★ 最上位に移動（復習が最優先タスク）
  → RecommendHeroCard       ← ★ 復習の直後（復習完了 or なし → recommend が昇格）
  → StreakDisplay → Charts → WeaknessRanking → ReviewProgress
```

**実装の核心**:
- `dueCount > 0` の時: 復習カードがページ最上部 → ユーザーは復習から始める
- `dueCount === 0` の時: 「なし/完了」表示の直下に `RecommendHeroCard` が位置し、
  視覚的に「次のアクション」として浮かび上がる

### T2: 復習セッション結果画面への CTA 追加

**対象ファイル**: `app/(app)/quiz/review/page.tsx`（`phase === 'result'` セクション）

**現在**: 「ダッシュボードへ」ボタンのみ（line 207-209）

**変更**: 「✨ 今日のおすすめクイズを試す」ボタンを追加
- ルーティング先: `/?recommend=open`（ダッシュボードで RecommendSheet が自動で開く）
- ボタン順: おすすめクイズ（primary） → ダッシュボードへ（secondary / outline）

## Project Structure

### Documentation (this feature)

```text
specs/005-spaced-review/
├── plan.md              ← このファイル
├── research.md          ← Phase 0 出力（実装状況調査結果）
├── data-model.md        ← Phase 1 出力（エンティティ設計）
├── contracts/
│   └── dashboard-ux.md  ← Phase 1 出力（UX フロー・コンポーネント契約）
└── tasks.md             ← Phase 2 出力（/speckit-tasks で生成）
```

### Source Code（変更対象）

```text
app/(app)/page.tsx                         ← レイアウト変更（T1）
app/(app)/quiz/review/page.tsx             ← result フェーズに CTA 追加（T2）
```

```text
# 参照のみ（変更なし）
components/dashboard/review-recommendations.tsx
components/dashboard/review-progress.tsx
components/recommend/recommend-hero-card.tsx
lib/quiz/srs/
app/(app)/quiz/review/actions.ts
app/(app)/dashboard/actions.ts
```

**Structure Decision**: 既存の Option 2 Web application 構造を踏襲。
新規ファイル作成なし。既存コンポーネントの配置変更のみ。
