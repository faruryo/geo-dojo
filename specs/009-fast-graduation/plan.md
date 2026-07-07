# Implementation Plan: 誤答なし市区町村の早期卒業

**Branch**: `009-fast-graduation` | **Date**: 2026-07-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-fast-graduation/spec.md`

## Summary

一度も誤答していない市区町村×モードは、別日2回目の正解で即卒業させる。誤答の有無（`everWrong`）は既存の `municipality_quiz_results` から EXISTS で導出し、**スキーマ変更なし**。判定は純粋関数 `computeSrsUpdate` に `everWrong` を渡す形で拡張し、Vitest で検証する。既存該当レコードは冪等なバックフィルスクリプトで一括卒業させる。

技術的アプローチ:
- `lib/quiz/srs/update.ts`: `computeSrsUpdate(existing, isCorrect, now, everWrong)` に引数追加。SM-2 の結果に対し「正解 かつ `!everWrong` かつ 新 repetition >= 2 → `status: 'graduated'`」の上書き判定を追加。interval / dueDate / easeFactor は SM-2 の計算値をそのまま維持（状態のみ卒業）
- `app/(app)/quiz/municipality/actions.ts` の `upsertSrsRecord`: 正解時のみ `municipality_quiz_results` に (userId, code, mode, isCorrect=false) の行が存在するかを EXISTS で1回照会し、`everWrong` として渡す。不正解時は照会不要（SM-2 のリセット経路に everWrong は無関係）
- `scripts/backfill-early-graduation.ts`: `status='reviewing' AND repetition>=2` かつ誤答履歴なしのレコードを `graduated` に UPDATE する冪等スクリプト（手動実行、UI なし）
- テスト: `__tests__/lib/quiz/srs/update.test.ts` に早期卒業ケースを追加

## Technical Context

**Language/Version**: TypeScript (strict)、Next.js 15.2.6+（App Router / React 19）
**Primary Dependencies**: Drizzle ORM、Supabase (PostgreSQL)、postgres-js
**Storage**: 既存テーブルのみ（`srs_records`, `municipality_quiz_results`）。**スキーマ変更・マイグレーションなし**
**Testing**: Vitest（`pnpm test`）。純粋関数テストが主。バックフィルの述語ロジックも純粋関数に切り出してテスト可
**Target Platform**: PWA（モバイルファースト）。本機能は UI 変更なし（一覧から消えるのは既存の `status` フィルタの帰結）
**Project Type**: Web application（Next.js App Router 単一プロジェクト）
**Performance Goals**: 正解1回答あたり追加クエリは EXISTS 1回のみ。`mqr_user_code_idx` (user_id, municipality_code) が効くため実測影響は無視できる想定（SC-004）
**Constraints**: 同日ガード（1日1回前進）は現行のまま。既存卒業条件（interval>=30 かつ rep>=4）は不変。回答保存の直列フロー（results INSERT → srs upsert）も不変
**Scale/Scope**: 変更 2 ファイル＋新規スクリプト 1 本＋テスト拡張。UI・API・スキーマ変更なし

## Constitution Check

- **I. セキュリティ**: 新規キー・公開エンドポイントなし。バックフィルは `DATABASE_URL` を用いた運用者ローカル実行 → PASS
- **II. アーキテクチャ**: Write は既存 Server Action 内の拡張のみ。`srs_records` の複合インデックスに変更なし。追加 EXISTS は既存インデックスで担保 → PASS
- **III. ロジック & UI**: UI 変更なし → PASS
- **コーディング規約**: schema.ts 変更なし。生 SQL マイグレーション回避（そもそもマイグレーション不要）→ PASS

## Project Structure

### Documentation (this feature)

```text
specs/009-fast-graduation/
├── spec.md
├── plan.md              # This file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── srs-update.md
└── tasks.md             # /speckit-tasks で生成
```

### Source Code (repository root)

```text
lib/quiz/srs/
├── update.ts            # 変更: computeSrsUpdate に everWrong 引数と早期卒業判定を追加
├── sm2.ts               # 変更なし（SM-2 本体は不変）
└── scheduler.ts         # 変更なし

app/(app)/quiz/municipality/
└── actions.ts           # 変更: upsertSrsRecord で everWrong を EXISTS 導出して渡す

scripts/
└── backfill-early-graduation.ts   # 新規: 既存レコード一括卒業（冪等）

__tests__/lib/quiz/srs/
└── update.test.ts       # 変更: 早期卒業シナリオ追加
```

**Structure Decision**: 既存の SRS 純粋関数レイヤ（`lib/quiz/srs/`）と Server Action（`actions.ts`）の分離をそのまま踏襲。DB 照会は action 側、判定は純粋関数側に置き、[[verify-with-tests-not-db]] 方針を維持する。

## 設計メモ

- **判定順序の安全性**: `saveMunicipalityQuizResult` は results INSERT → srs upsert の順。正解時の EXISTS は `isCorrect=false` 行のみ見るため、直前に挿入された当該正解行の影響を受けない
- **卒業後の誤答**: `applySm2` の不正解経路が常に `status: 'reviewing'` へ戻す（既存挙動）。以後は誤答履歴が存在するため everWrong=true となり通常コースに自然に移行する
- **バックフィルの冪等性**: 条件付き UPDATE のみ（対象は `status='reviewing'`）。再実行しても既に graduated の行は対象外
- **Mode A 多重INSERT由来の重複履歴**: 正誤が同一の複製のため EXISTS 判定に影響なし（spec Assumptions 参照）

## Complexity Tracking

違反なし（記載不要）
