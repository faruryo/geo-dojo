# Implementation Plan: Mode D（順引き地図）市区町村出題選択・絞り込み

**Branch**: `faruryo/feat-mode-d` | **Date**: 2026-09-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/026-mode-d-custom-pool/spec.md`

## Summary

Mode D（順引き地図: 市区町村名 → 地図タップ）において、従来の地方単位（関東、近畿など）の絞り込みに加え、特定の都道府県単位の指定、および都道府県内の個別市区町村の選択・除外（全選択/全解除/検索機能付き）を可能にする。出題サンプリング・制覇進捗計算・URL パラメータ・リプレイ状態の全てを連動させる。

## Technical Context

**Language/Version**: TypeScript 5+ (strict mode), Next.js 15.2.6 (App Router / React 19)

**Primary Dependencies**: Tailwind CSS v4, shadcn/ui, lucide-react, TanStack Query v5

**Storage**: Supabase (PostgreSQL), Drizzle ORM (既存スキーマ変更なし), localStorage / URLSearchParams

**Testing**: Vitest (`__tests__/lib/quiz/`, `__tests__/components/`)

**Target Platform**: Mobile PWA (iOS / Android), Desktop Web (375px+ responsive, dark mode `#111111`)

**Project Type**: Web Application (Next.js App Router)

**Performance Goals**:
- 自治体選択モーダル・リストの開閉および検索レスポンス < 50ms
- サンプリング・進捗計算 < 10ms

**Constraints**:
- モバイル 375px 画面での快適な操作性
- サーバーコードでの `public/` fs 読み込み禁止（DB またはクライアントフックを正とする）
- 既存 Mode A/B/C の挙動を破壊しない後方互換性

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- ✅ **I. セキュリティ & コンプライアンス**: サーバーキーの露出なし。公的マスタ・クライアントデータのみを安全に取り扱う。
- ✅ **II. アーキテクチャ & パフォーマンス**: Read は TanStack Query、UI 状態は React state / URLSearchParams、Write（結果保存）は既存 Server Action を継続利用。
- ✅ **III. ロジック & UI**: 375px 基準のモバイルファースト設計。ダークモード基調。

## Project Structure

### Documentation (this feature)

```text
specs/026-mode-d-custom-pool/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── municipality-scope-contract.md
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code

```text
lib/
├── quiz/
│   ├── municipality-data.ts        # ScopeType, MunicipalityScope, filterByScope 実装
│   ├── municipality-questions.ts   # MunicipalityQuizSettings.scope 対応, 出題生成
│   └── recommendation/
│       └── types.ts                # (必要に応じた型拡張)
components/
└── quiz/
    ├── scope-selector.tsx          # 地方 vs 都道府県切り替え + 都道府県ピッカー
    ├── municipality-picker-dialog.tsx # 市区町村個別選択モーダル/ドロワー (検索, 全選択/解除)
    └── quiz-pool-progress.tsx      # (既存コンポーネント: 算出された poolStats を受容)
app/
└── (app)/
    └── quiz/
        └── municipality/
            └── [mode]/
                └── page.tsx        # Mode D 設定画面での scope UI 統合と URL パラメータ対応
__tests__/
└── lib/
    └── quiz/
        ├── municipality-scope.test.ts # スコープフィルタ・サンプリングテスト
        └── municipality-questions.test.ts # 出題生成回帰テスト
```

**Structure Decision**: 既存の `lib/quiz/` 純粋関数層にスコープフィルタと型を拡張し、`components/quiz/` に再利用可能なスコープ/自治体選択 UI コンポーネントを追加。`[mode]/page.tsx` でそれらを統合する。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| なし | — | — |
