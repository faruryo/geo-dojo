# Implementation Plan: 詳細分析の期間初期値と長期の正答率推移

**Branch**: `031-analytics-all-period` | **Date**: 2026-10-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/031-analytics-all-period/spec.md`

## Summary

詳細分析の期間初期値を「全期間」にし、SSR プリフェッチも同じキーにする。全期間の正答率は、見えている回答の JST 暦日差が 364 日以内なら月曜週、それを超えたら暦月にまとめる。横軸の短い表記と点を押したときの正式表記は表示側の純粋関数に置く。選んだ期間は `localStorage` に学習者 ID 付きで覚え、マウント後に復元する。全国制覇推移の日次集約は変えない。

## Technical Context

**Language/Version**: TypeScript 5（strict）、Node 25、pnpm 10

**Primary Dependencies**: Next.js 15.2.6（App Router / React 19）、TanStack Query v5、Recharts、Tailwind CSS v4

**Storage**: 期間の選択のみブラウザの `localStorage`。PostgreSQL のスキーマ変更なし

**Testing**: Vitest（`pnpm test`）。集約判定と保存の読み書きは純粋関数のケース表。既存の prefetch / フィルター初期値テストを更新する

**Target Platform**: モバイル Web / PWA（375px 基準・ダークモード）

**Project Type**: Next.js Web アプリ

**Performance Goals**: 初期表示は全期間の prefetch 1 セット。保存期間の復元はマウント後 1 回の再取得まで

**Constraints**: 7日・30日は日次のまま。Mode A の 1 問正規化と難易度集約は変えない。制覇推移は日次のまま。375px で全期間の横軸ラベルが重ならない

**Scale/Scope**: 詳細分析 1 画面。正答率の点は 5 年の月次で最大 60

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 要件 | 適合性 | 判定 |
|---|---|---|---|
| I. セキュリティ & コンプライアンス | API キー非露出、Next.js 15.2.6+ | 新規キーなし。期間は端末内に学習者 ID で分ける。他ユーザーのキーは読まない | PASS |
| II. アーキテクチャ & パフォーマンス | Read は TanStack Query、Write は Server Actions | 推移・苦手は既存クエリの prefetch キーを `all` に変えるだけ。期間の記憶は Server Action にしない | PASS |
| III. ロジック & UI | 375px、ダーク `#111111` | 全期間の横軸だけ短い表記にし、`minTickGap` で間引く。色とカード構成は維持 | PASS |

Phase 1 後の再確認: 新しい違反なし。テーブル追加なし。

## Project Structure

### Documentation (this feature)

```text
specs/031-analytics-all-period/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── analytics-period.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
lib/analytics/
├── accuracy-buckets.ts           # [NEW] 日/週/月の判定、バケットキー、軸ラベル、ツールチップ
├── period-preference.ts          # [NEW] 学習者別の期間読み書き（Storage を引数で受ける）
└── prefetch.ts                   # [MODIFY] trend / completionTrend / weakness の初期キーを all
lib/db/queries/dashboard.ts       # [MODIFY] 全期間の正答率キーをバケット関数へ委譲
components/analytics/analytics-client.tsx  # [MODIFY] 初期値 all。期間は useAnalyticsPeriod
components/analytics/use-analytics-period.ts # [NEW] マウント後の復元と変更時の保存
components/dashboard/accuracy-chart.tsx    # [MODIFY] 内部初期値 all、全期間の軸とツールチップ
__tests__/lib/analytics/accuracy-buckets.test.ts
__tests__/lib/analytics/period-preference.test.ts
__tests__/lib/analytics/prefetch.test.ts          # [MODIFY]
__tests__/components/analytics/analytics-filter.test.tsx  # [MODIFY]
```

**Structure Decision**: 既存の詳細分析（`components/analytics` + `lib/analytics` + `lib/db/queries/dashboard.ts`）に載せる。判定は `lib/analytics` の純粋関数に出し、DB と `localStorage` は呼び出し側に残す。

## Complexity Tracking

違反なし。この節に記録する例外はない。
