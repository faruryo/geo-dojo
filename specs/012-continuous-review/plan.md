# 実装計画書: 復習の連続プレイ

**ブランチ**: `012-continuous-review` | **日付**: 2026-07-13 | **仕様書**: [spec.md](./spec.md)

---

## 概要

1バッチ（最大20件）の復習プレイが終わった結果画面から、ダッシュボードに戻らず次のバッチを直接開始できるようにする。あわせて、期日を迎えている残り件数を結果画面に表示し、続けるかどうかの判断材料にする。

### 技術的アプローチ

- `app/(app)/quiz/review/page.tsx` のuseEffect内にベタ書きされている出題構築ロジック（Mode A グルーピング、Mode B/C/D 選択肢生成、約65行）を `lib/quiz/review-questions.ts` の純粋関数 `buildReviewQuestions()` に抽出する。初回ロードと「続ける」の両方から同じ関数を呼び出せるようにする（コピペ複製を避ける）。
- ページ側は `loadBatch()` という単一の非同期関数にバッチ取得〜出題構築〜phase遷移をまとめ、マウント時の `useEffect` と「続けて復習する」ボタンの `onClick` の両方から呼び出す。
- 結果画面での残り件数表示は、新しいクエリを追加せず既存の `useDueReviewSummary()`（TanStack Query）の `dueCount` を再利用する。バッチ完了時に既存の `queryClient.invalidateQueries({ queryKey: ['dashboard', 'srs-summary'] })` が呼ばれているため、結果画面表示時には再フェッチ済みの最新値が得られる。
- due 判定の JST 境界 WHERE 句（`userId` + `status='reviewing'` + `dueDate < 明日0時`）が `getDueReviewItems`（review/actions.ts）と `getDueReviewSummaryData`（dashboard/queries.ts）の2箇所で重複しているため、`lib/db/srs-due.ts` に `dueReviewCondition(userId)` として共通化する。B013（due境界の不一致バグ）の再発防止を兼ねる。
- 各バッチの結果（`results` state）はバッチ完了ごとに置き換え（既存実装どおり）、合算は行わない（FR-005）。

---

## 技術的文脈

**言語/バージョン**: TypeScript (strict)、Next.js 15.2.6+（App Router / React 19）
**主要な依存関係**: TanStack Query v5、Drizzle ORM、既存の `lib/quiz/` 純粋関数群、shadcn/ui
**ストレージ**: 既存 Supabase Postgres `srs_records`。スキーマ変更なし（新規テーブル・カラム不要）
**テスト**: Vitest (`pnpm test`)。`buildReviewQuestions()` の純粋関数ユニットテストと `dueReviewCondition` を使う既存 DB 統合テスト（`queries-parity.test.ts` 等）の回帰確認
**対象プラットフォーム**: PWA（モバイルファースト 375px 基準、ダークモード `#111111`）
**プロジェクトタイプ**: Web アプリケーション
**パフォーマンス目標**: 「続ける」操作でページ遷移なし。追加ネットワークは既存と同じ1回の `getDueReviewItems` 呼び出しのみ（新規エンドポイント・新規クエリ追加なし）
**制約事項**: 既存の Server Action（`getDueReviewItems` / `getDueReviewSummary`）のシグネチャは変更しない。バッチ間の成績合算はスコープ外（FR-005）。残数判定失敗時は件数表示のみ省略し、続行アクション自体は表示する（FR-007）

---

## 憲法チェック (憲法原則の確認)

| 原則 | 評価 | 判定 |
|------|------|------|
| I. セキュリティ & コンプライアンス | 新規APIキー・新規外部通信なし。既存 Server Action を再利用するのみ。 | ✅ 合格 (Pass) |
| II. アーキテクチャ & パフォーマンス | Read は既存の `useDueReviewSummary`（TanStack Query）を再利用。バッチ取得（`getDueReviewItems`）はクライアント側シャッフルを伴う一度きりの取得アクションであり、キャッシュ対象の表示データではないため、既存実装を踏襲し関数抽出のみで対応（TanStack Query 化はしない）。新規 Server Action・新規 DB インデックスは不要（既存 `(user_id, due_date)` 複合インデックスをそのまま利用）。 | ✅ 合格 (Pass) |
| III. ロジック & UI | 375px幅の結果画面内に「続けて復習する（残り n 件）」ボタンを追加するのみ。既存の完了体験（ダッシュボードへ／おすすめクイズ）は維持。 | ✅ 合格 (Pass) |
| コーディング規約 | TypeScript strict 順守。出題構築ロジックは `lib/quiz/` の純粋関数として抽出しテストで検証。due 境界ロジックは `lib/db/` に共通化し `schema.ts` 経由でのみテーブルへアクセス。 | ✅ 合格 (Pass) |

---

## プロジェクト構成

### ドキュメント（本機能）

```text
specs/012-continuous-review/
├── plan.md              # このファイル
├── research.md          # 調査結果
├── data-model.md        # データモデル定義（スキーマ変更なしの明記含む）
├── quickstart.md        # クイックスタートガイド
├── contracts/
│   └── review-continuation.md  # buildReviewQuestions / dueReviewCondition の内部契約
├── checklists/
│   └── requirements.md  # 仕様品質チェックリスト
└── tasks.md              # タスクリスト（/speckit-tasks で生成）
```

### ソースコード（リポジトリルート）

```text
app/(app)/quiz/review/
├── page.tsx              # [変更] loadBatch() への一本化、result phase に続行CTA追加、useDueReviewSummary 連携
└── actions.ts             # [変更] dueReviewCondition() を利用するようリファクタ（シグネチャ・戻り値は不変）

app/(app)/dashboard/
└── queries.ts             # [変更] getDueReviewSummaryData の due 判定を dueReviewCondition() 経由に統一

lib/db/
└── srs-due.ts              # [新規] dueReviewCondition(userId) — due 判定 WHERE 句の共通化（B013再発防止）

lib/quiz/
└── review-questions.ts     # [新規] buildReviewQuestions(items, allMunicipalities) 純粋関数（Mode A/B/C/D 出題構築）

__tests__/lib/quiz/
└── review-questions.test.ts  # [新規] buildReviewQuestions のユニットテスト
```

**構成に関する決定**: 既存の Next.js 単一プロジェクト構造（LIFT原則）を踏襲。新規テーブル・新規 Server Action は追加せず、既存クエリの共通化とクライアント側ロジックの関数抽出のみで実現する。
