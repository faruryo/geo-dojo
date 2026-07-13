# 実装計画書: 復習項目一覧の正答率表示

**ブランチ**: `013-review-item-accuracy` | **日付**: 2026-07-14 | **仕様書**: [spec.md](./spec.md)

---

## 概要

「覚えている途中の市区町村」一覧ページ（`/quiz/review/items`）の各行（市区町村×モード）に、その項目のこれまでの正答率（正解数／総解答数）を表示する。集計は既存の「苦手ランキング」機能（`getWeaknessRankingData`）と同じ `municipality_quiz_results` を用い、同じ集計方式（正解率）を踏襲する。

### 技術的アプローチ

- `getReviewItemList`（`app/(app)/dashboard/actions.ts:102-147`）の SELECT に `municipalityCode` を追加する（現状は `municipalityName`/`mode`/`dueDate`/`repetition`/`interval` のみで、正答率集計に必要な結合キーが欠けている）。
- 新規に `getItemAccuracyData(userId, pairs: { municipalityCode: string; mode: string }[])` を `app/(app)/dashboard/queries.ts` に追加する。`getWeaknessRankingData`（同ファイル 516-547行）と同じ SQL 集計パターン（`SUM(CASE WHEN isCorrect ...)/COUNT(*)`)を、`municipality_quiz_results` を `userId` + 現在ページの `municipalityCode` 群（`inArray`）で絞り込み、`municipalityCode, mode` で `GROUP BY` して呼び出す。ページサイズが25件と小さいため、N+1にはならず1回の追加クエリで完結する。
- `getReviewItemList` 内で、SRS一覧取得（`rows`/`totalRow`）とは独立して `getItemAccuracyData` を呼び出し、**専用の try/catch で失敗を分離する**（FR-006: 正答率取得の失敗が一覧本体の表示をブロックしてはならない）。失敗時は全項目の `accuracy` を `undefined` にして返す。
- 戻り値の各アイテムに `accuracy?: { correct: number; total: number }` を追加する（既存フィールドは変更しない）。
- フロントエンド（`app/(app)/quiz/review/items/page.tsx:141-154` のリスト項目）に、正答率表示を追加する。`accuracy` があれば `Math.round(correct/total*100)` を `%` 表記で表示し、未定義（取得失敗）の場合は非表示（他の情報は通常通り表示、FR-006）。
- 低正答率（50%未満）の視覚的区別（FR-007）は、既存の色分けパターン（同ページ96行目 `text-green-500`）を踏襲し、`text-destructive` 等の条件付きクラスで表現する。新規コンポーネントは追加しない。
- 既存の「解答内容（都道府県名）を返さない」方針（FR-005, 005-spaced-review FR-016a）は維持。`getReviewItemList` は引き続き `prefecture` を選択・返却しない。

---

## 技術的文脈

**言語/バージョン**: TypeScript (strict)、Next.js 15.2.6+（App Router / React 19）
**主要な依存関係**: TanStack Query v5（`useReviewItemList`）、Drizzle ORM、shadcn/ui `Badge`
**ストレージ**: 既存 Supabase Postgres `municipality_quiz_results`・`srs_records`。スキーマ変更なし（新規テーブル・カラム・インデックス不要。既存 `mqr_user_code_idx (user_id, municipality_code)` を再利用）
**テスト**: Vitest (`pnpm test`)。`getItemAccuracyData` の DB 統合テスト（`DATABASE_URL` 設定時のみ実行、`__tests__/lib/dashboard/queries-parity.test.ts` と同様の隔離パターン）。正答率取得失敗時のフォールバック（`getReviewItemList` 全体は成功する）のユニット/統合テストを追加
**対象プラットフォーム**: PWA（モバイルファースト 375px 基準、ダークモード `#111111`）
**プロジェクトタイプ**: Web アプリケーション
**パフォーマンス目標**: 一覧ページ1回の表示につき追加クエリは最大1回（現在ページの最大25件をまとめて集計、N+1なし）
**制約事項**: `getReviewItemList` の既存シグネチャ・既存フィールドは変更せず `accuracy` を追加するのみ。`prefecture`（解答内容）は引き続き返さない（FR-005）。正答率集計の失敗は一覧全体の表示をブロックしない（FR-006）

---

## 憲法チェック (憲法原則の確認)

| 原則 | 評価 | 判定 |
|------|------|------|
| I. セキュリティ & コンプライアンス | 新規APIキー・新規外部通信なし。既存 Server Action（`getReviewItemList`）の拡張のみ。 | ✅ 合格 (Pass) |
| II. アーキテクチャ & パフォーマンス | Read は既存の `useReviewItemList`（TanStack Query）をそのまま利用（クエリキー・キャッシュ戦略は変更なし）。DB 集計は既存インデックス（`mqr_user_code_idx`）で完結し新規インデックス不要。ページあたり追加クエリ1回のみで N+1 を回避。 | ✅ 合格 (Pass) |
| III. ロジック & UI | 375px幅の一覧リスト項目内にテキスト（正答率%）を1つ追加するのみ。既存レイアウト（バッジ・市区町村名・次回期日）は維持。 | ✅ 合格 (Pass) |
| コーディング規約 | TypeScript strict 順守。DB 集計ロジックは既存パターン（`getWeaknessRankingData`）を踏襲し `queries.ts` に配置、Server Action（`actions.ts`）からは呼び出すのみ。 | ✅ 合格 (Pass) |

---

## プロジェクト構成

### ドキュメント（本機能）

```text
specs/013-review-item-accuracy/
├── plan.md              # このファイル
├── research.md          # 調査結果
├── data-model.md        # データモデル定義（スキーマ変更なしの明記含む）
├── quickstart.md        # クイックスタートガイド
├── contracts/
│   └── item-accuracy.md  # getReviewItemList 拡張 / getItemAccuracyData の内部契約
├── checklists/
│   └── requirements.md  # 仕様品質チェックリスト
└── tasks.md              # タスクリスト（/speckit-tasks で生成）
```

### ソースコード（リポジトリルート）

```text
app/(app)/dashboard/
├── actions.ts             # [変更] getReviewItemList: municipalityCode を SELECT に追加、getItemAccuracyData 呼び出しをtry/catchで合成
└── queries.ts              # [変更] getItemAccuracyData(userId, pairs) を新規追加（getWeaknessRankingData と同じ集計パターン）

app/(app)/quiz/review/items/
└── page.tsx                # [変更] リスト項目に正答率表示（低正答率の視覚的強調を含む）を追加

__tests__/lib/dashboard/
└── queries-parity.test.ts  # [変更] getItemAccuracyData の DB 統合テストケースを追加
```

**構成に関する決定**: 既存の Next.js 単一プロジェクト構造（LIFT原則）を踏襲。新規テーブル・新規エンドポイントは追加せず、既存 Server Action・既存クエリファイルへの機能追加のみで実現する。
