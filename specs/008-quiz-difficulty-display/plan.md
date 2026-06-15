# Implementation Plan: 市区町村クイズの問題に難易度を表示

**Branch**: `008-quiz-difficulty-display` | **Date**: 2026-06-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-quiz-difficulty-display/spec.md`

## Summary

市区町村クイズの出題中、各問題カードにその問題の難易度（入門／中級／上級／達人）を表示する。難易度は既に市区町村マスタに存在し、`QuizRunner` の各問題が保持する `Municipality.difficulty` から導出できる。表示専用の軽微な UI 機能であり、DB 変更・新規 API・データ算出は伴わない。

技術的アプローチ:
- 問題の代表難易度を返す純粋関数 `representativeDifficulty()` を `lib/quiz/municipality-data.ts` に追加（モードA の複数対象は最も難しい難易度を返す＝FR-007）。
- `components/quiz/quiz-runner.tsx` の問題カード内に、既存 `Badge` + `DIFFICULTY_LABEL` で難易度ラベルを描画。`currentQuestion` から導出するためフィードバック表示中も保持される。
- ロジックは Vitest 単体テストで検証（プロジェクト方針：純粋関数＋テストで検証）。

## Technical Context

**Language/Version**: TypeScript (strict)、Next.js 15.2.6+（App Router / React 19）
**Primary Dependencies**: shadcn/ui（`Badge`）、lucide-react、TanStack Query v5（既存マスタ取得）、Tailwind CSS v4
**Storage**: N/A（既存 `municipality_master` の `difficulty` を読み取り表示するのみ。スキーマ変更なし）
**Testing**: Vitest（`vitest run` / `pnpm test`）。`__tests__/lib/quiz/` に純粋関数テストを追加
**Target Platform**: PWA（モバイルファースト、375px 基準、ダークモード `#111111`）
**Project Type**: Web application（Next.js App Router 単一プロジェクト）
**Performance Goals**: 追加のネットワーク/DB アクセスなし。表示は既にメモリ上にある問題データから O(1)〜O(対象件数) で導出
**Constraints**: 既存の出題・採点・進行ロジックに影響を与えない。問題カードのレイアウト（問題文・選択肢・地図・進捗表示）を崩さない
**Scale/Scope**: 変更対象は 2 ファイル（`lib/quiz/municipality-data.ts`、`components/quiz/quiz-runner.tsx`）＋テスト 1 ファイル。復習クイズも同一 `QuizRunner` 経由のため自動的に対象

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 評価 | 判定 |
|------|------|------|
| I. セキュリティ & コンプライアンス | API キー・新規エンドポイント・外部通信なし。Next.js バージョン据え置き。 | ✅ Pass |
| II. アーキテクチャ & パフォーマンス | 新規 Read/Write なし。表示は既存の TanStack Query で取得済みデータを利用。Server Actions / API Routes の追加なし。地図・PWA 構成に変更なし。 | ✅ Pass |
| III. ロジック & UI | 375px モバイルファースト・ダークモード前提でバッジを配置。Tailwind ユーティリティ＋既存 `Badge` を使用、CSS-in-JS なし。状態は `currentQuestion` から導出し新規グローバルストアを作らない。 | ✅ Pass |
| コーディング規約 | TypeScript strict、純粋関数を `lib/quiz` に集約し Vitest で検証。`schema.ts` 迂回なし（DB 変更なし）。 | ✅ Pass |

違反なし。Complexity Tracking は不要。

## Project Structure

### Documentation (this feature)

```text
specs/008-quiz-difficulty-display/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── difficulty-badge.md   # UI 表示契約
├── checklists/
│   └── requirements.md  # spec 品質チェックリスト（作成済み）
└── tasks.md             # /speckit-tasks で生成（本コマンドでは作成しない）
```

### Source Code (repository root)

```text
lib/quiz/
└── municipality-data.ts        # [変更] representativeDifficulty() を追加
                                #        既存 Difficulty/DIFFICULTIES/DIFFICULTY_LABEL を再利用

components/quiz/
└── quiz-runner.tsx             # [変更] 問題カードに難易度バッジを描画
                                #        モードA: representativeDifficulty(instances)
                                #        モードB/C/D: municipality.difficulty

__tests__/lib/quiz/
└── representative-difficulty.test.ts   # [新規] 代表難易度ロジックの単体テスト
```

**Structure Decision**: 既存の Next.js 単一プロジェクト構成を踏襲。ロジックは `lib/quiz/`（純粋関数）、UI は `components/quiz/`（クライアントコンポーネント）に配置する LIFT 原則どおり。市区町村クイズ（`app/(app)/quiz/municipality/[mode]/page.tsx`）と復習クイズ（`app/(app)/quiz/review/page.tsx`）は共通の `QuizRunner` を使うため、`QuizRunner` への一箇所の変更で両方を満たす。

## Complexity Tracking

> Constitution Check に違反がないため記載なし。
