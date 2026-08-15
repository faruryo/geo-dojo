# Implementation Plan: クイズ完了画面での復習予定表示と即時おすすめPlay導線 (B019)

**Branch**: `019-recommend-complete-loop` | **Date**: 2026-08-15 | **Spec**: [spec.md](file:///Users/faru/geo-dojo/specs/019-recommend-complete-loop/spec.md)
**Input**: Feature specification from `/specs/019-recommend-complete-loop/spec.md`

## Summary

クイズ完了画面（市区町村クイズ全モードおよび復習クイズ）に最新の「明日の復習予定件数」と「今後7日間のミニスケジュール」を表示する `UpcomingReviewMini` コンポーネントを導入する。また、クイズ結果表示時に TanStack Query のキャッシュを最新化し、おすすめクイズ経由時には最上部に目立つ「✨ もう一度おすすめでプレイ」ボタンを配置して、ダッシュボードとの往復なしに連奏できる即時ループ導線を実現する。

## Technical Context

**Language/Version**: TypeScript 5.x (Strict mode) / React 19  
**Primary Dependencies**: Next.js 15.2.6 (App Router), Tailwind CSS v4, TanStack Query v5, lucide-react  
**Storage**: なし（既存の `useUpcomingReviewSchedule` フック経由）  
**Testing**: Vitest (`__tests__/lib/quiz/srs/schedule-helper.test.ts`)  
**Target Platform**: Web / PWA (Mobile-first, 375px基準, ダークモード `#111111`)  
**Project Type**: Web Application  
**Performance Goals**: キャッシュ無効化と再取得による最新データの即時表示（スケルトンローディング対応）  
**Constraints**: 判断ロジック（JST明日の日付算出・件数抽出）は純粋関数として分離  
**Scale/Scope**: クイズ完了画面（`[mode]/page.tsx`, `review/page.tsx`）および新規 UI コンポーネント  

## Constitution Check

- [x] **I. セキュリティ & コンプライアンス**: 外部 API やセキュリティに関わる変更なし。
- [x] **II. アーキテクチャ & パフォーマンス**: 日付計算ロジックは pure 関数（`lib/quiz/srs/schedule-helper.ts`）に分離。データ取得は TanStack Query を利用。
- [x] **III. ロジック & UI**: 375px 基準モバイルファースト、ダークモード最適化。

## Project Structure

### Documentation (this feature)

```text
specs/019-recommend-complete-loop/
├── plan.md              # This file
├── research.md          # Phase 0: 設計・方針
├── data-model.md        # Phase 1: 型定義 & インターフェース
├── quickstart.md        # Phase 1: 動作確認手順
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2: タスクリスト
```

### Source Code

```text
lib/quiz/srs/
└── schedule-helper.ts               # 新規: getTomorrowReviewCount pure 関数

components/quiz/
└── upcoming-review-mini.tsx         # 新規: 復習予定ミニカード（明日の件数 + 7日間グラフ）

components/recommend/
└── recommend-replay-button.tsx      # 更新: プライマリボタンデザイン

app/(app)/quiz/municipality/[mode]/
└── page.tsx                         # 完了画面に UpcomingReviewMini 配置 & キャッシュ無効化

app/(app)/quiz/review/
└── page.tsx                         # 復習完了画面に UpcomingReviewMini 配置 & キャッシュ無効化

__tests__/lib/quiz/srs/
└── schedule-helper.test.ts          # 新規: getTomorrowReviewCount の単体テスト
```

## Complexity Tracking

> Constitution 違反なし。
