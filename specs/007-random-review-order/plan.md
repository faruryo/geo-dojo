# Implementation Plan: 復習クイズのランダム化（選定＋出題順）

**Branch**: `007-random-review-order` | **Date**: 2026-06-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-random-review-order/spec.md`

## Summary

復習クイズ（`/quiz/review`）は「出題順」と「選ばれる顔ぶれ（due>20件のとき）」が両方とも
決定論的に固定され、暗記で回答できてしまう。復習頻度の調整は SM-2 が `dueDate` で既に担うため、
本件は **due 集合の中の選び方・並べ方だけ**を変える。均等ランダムを採用したことで、
`getDueReviewItems` のクエリを `ORDER BY random() LIMIT 20` にするだけで「均等抽選」と「順序ランダム」が
同時に満たせる。出題数は20件固定、スキーマ変更なし。

## Technical Context

**Language/Version**: TypeScript / React 19 (Next.js App Router 15.2.6+)
**Primary Dependencies**: Drizzle ORM（`sql\`random()\``）、TanStack Query v5
**Storage**: Supabase/PostgreSQL（`srs_records`）。**スキーマ変更なし**。クエリの ORDER BY のみ変更。
**Testing**: Vitest。選定が PostgreSQL `random()` に閉じるため新規ユニットテストは原則不要（必要なら DB 統合テストで集合不変・件数を確認）。
**Target Platform**: Web (PWA)
**Project Type**: Web application（単一 Next.js プロジェクト）
**Performance Goals**: 影響軽微。`random()` は対象ユーザーの due 行（status='reviewing' & dueDate<=now）のみが対象でデータ小。LIMIT で取得は20件。
**Constraints**: 出題内容・正答判定・SRS 更新・結果集計の挙動を変えない。due≤20 は全件出題（漏れ防止）。
**Scale/Scope**: 変更1ファイル（`app/(app)/quiz/review/actions.ts`）。`page.tsx` は変更不要。

## Constitution Check

*GATE: Phase 0 前に通過必須。Phase 1 後に再確認。*

- **I. セキュリティ & コンプライアンス**: 認証（`getUser`）・RLS・`user.id` スコープ・APIキーに変更なし。✅ 影響なし
- **II. アーキテクチャ & パフォーマンス**: 取得経路・件数（LIMIT 20）は不変。ORDER BY を `random()` に変えるのみ。✅ 適合
- **III. ロジック & UI**: 出題組み立て（`page.tsx`）・選択肢生成・Mode A グルーピングは不変。選定/順序の決定論性のみ解消。✅ 適合

→ 違反なし。Gate PASS。

## Project Structure

### Documentation (this feature)

```text
specs/007-random-review-order/
├── plan.md              # 本ファイル
└── spec.md              # 機能仕様
```

> research.md / data-model.md / contracts/ / quickstart.md は本機能では **不要（N/A）**。
> - research: 未解決事項なし（選定方式＝均等ランダムで確定）。
> - data-model: 永続データモデルの変更なし。
> - contracts: `getDueReviewItems` のシグネチャ・戻り値型は不変（並び順の意味のみ変化）。
> - quickstart: UI 操作手順は従来と同一。

### Source Code (repository root)

```text
app/(app)/quiz/review/
├── actions.ts           # 【変更】ORDER BY dueDate ASC, interval ASC → ORDER BY random()。LIMIT 20 維持
└── page.tsx             # 変更なし（items が random 順で返るため qs もランダム順になる）

components/quiz/
└── quiz-runner.tsx      # 変更なし（questions 配列順に出題）

lib/quiz/srs/             # 変更なし（SM-2/scheduler は不変）
```

## Phase 0: Research

未解決の NEEDS CLARIFICATION なし。根本原因・修正箇所は調査済み：

- 固定の原因（調査済み）:
  - `getDueReviewItems`（`actions.ts:43`）の `ORDER BY dueDate ASC, interval ASC ... LIMIT 20` で、due>20 のとき常に同じ20件＋同じ順序。
  - `page.tsx:58` が期日順のまま `Question[]` を組み立て、`QuizRunner` が `questions[qIdx]` を配列順に消費。
- SM-2 との関係（確認済み）: 復習頻度の低減は `applySm2`（`sm2.ts`）の interval 増加と graduated 判定で実現済み。`getDueReviewItems` は due な reviewing 行のみ返す。本件は due 集合内の選定/順序のみ変更し、SM-2 には触れない。
- 採用方針（Decision）:
  1. **選定 = 均等ランダム**（ユーザー決定）。期日超過の重み付けは行わない。
  2. **出題数 = 20件固定**（ユーザー決定）。due≤20 は全件。
  3. **提示順 = ランダム**。
  4. 実装 = `ORDER BY random() LIMIT 20`。これ1つで「均等抽選」と「順序ランダム」を同時に満たし、`page.tsx` 変更不要。
- Alternatives considered:
  - 期日優先の重み付き抽選 → 却下: ユーザーが均等ランダムを選択。SM-2 が頻度を担うため due 集合内の優先度差は小さく、実装/テストの複雑さに見合わない。
  - アプリ側で全 due 取得 → `shuffle().slice(0,limit)` → 妥当だが、均等ランダムなら DB `random()` の方が単純・取得件数も小。却下寄り。
  - 件数自体のランダム化 → スコープ外（20固定）。

**Output**: 追加の research.md なし（本節で完結）。

## Phase 1: Design & Contracts

- **Data model**: 変更なし（N/A）。
- **Contracts**: `getDueReviewItems(opts?: { limit?: number }): Promise<DueReviewItem[]>` シグネチャ・戻り値型不変。
  内部の ORDER BY を `dueDate ASC, interval ASC` → `random()` に変更。`where`（user/status/due 判定）・`limit` は不変。
- **設計（変更点）**:
  - `review/actions.ts`: drizzle で `.orderBy(sql\`random()\`)` を使用（`import { sql } from 'drizzle-orm'`。未使用になる `asc` は除去）。`.limit(limit)` は維持。
  - `due ≤ limit` のケースは LIMIT により自然に全件返る（追加分岐不要）。
- **テスト方針**:
  - 選定は PostgreSQL `random()` に閉じるため新規ユニットテストは原則不要。
  - 既存テスト（`__tests__/lib/quiz/srs/*`, `quiz-results.test.ts`）に影響しないこと（SM-2/集計ロジック不変）を確認。
  - 任意: DB 統合テスト（`project_db_integration_tests` の枠組み）で「due≤20 で全件」「due>20 で件数=20・集合⊆due」を確認できるが、`random()` の分布検証まではスコープ外。
- **Agent context update**: CLAUDE.md の現行プラン参照を本 plan（007）へ更新済み。

**Output**: 設計確定（上記）。data-model.md / contracts/ / quickstart.md は N/A。

## 次のステップ

- 変更が1行レベルに収束したため、`/speckit-tasks` を経ずにこのセッションで直接実装しても良い。
- 実装: `actions.ts` の ORDER BY を `random()` に変更 → `pnpm lint` / 既存 `pnpm test` がグリーンであることを確認。
