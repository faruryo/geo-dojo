# Tasks: 復習項目一覧の正答率表示

**Input**: Design documents from `/specs/013-review-item-accuracy/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/item-accuracy.md, quickstart.md

**Tests**: DBクエリ集計（`getItemAccuracyData`）はプロジェクト方針（メモリ: 純粋関数+Vitestで検証）に従い、`DATABASE_URL` ゲート付きの DB 統合テスト（既存 `queries-parity.test.ts` と同パターン）で検証する。UI 表示分岐（正答率の表示/非表示・低正答率の強調）は quickstart.md による手動確認とする。

**Organization**: タスクはユーザーストーリー単位。US1（正答率の表示）が P1 (MVP)、US2（低正答率の視覚的区別）は US1 の表示に依存するが独立して検証可能。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 別ファイル・依存なしで並行実行可能
- **[Story]**: US1 / US2

## Path Conventions

Next.js 単一プロジェクト（App Router）。DBクエリは `app/(app)/dashboard/queries.ts`、Server Action は `app/(app)/dashboard/actions.ts`、一覧UIは `app/(app)/quiz/review/items/page.tsx`。

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 既存の再利用資産の確認（新規パッケージ追加なし）

- [ ] T001 `getReviewItemList`（`app/(app)/dashboard/actions.ts`）、`getWeaknessRankingData`（`app/(app)/dashboard/queries.ts`）、`useReviewItemList`（`lib/hooks/useReviewItemList.ts`）が現状のまま import・参照可能であることを確認する。新規依存パッケージ追加が不要であることを確認する。

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 両ユーザーストーリーが依存する「正答率データの取得」基盤。US1/US2 のUI実装はこのフェーズの完了後に着手する。

**⚠️ CRITICAL**: このフェーズが完了するまで US1/US2 のUI実装には着手しない

- [ ] T002 `app/(app)/dashboard/queries.ts` に `getItemAccuracyData(userId: string, pairs: { municipalityCode: string; mode: string }[]): Promise<Map<string, { correct: number; total: number }>>` を新規実装する。`getWeaknessRankingData`（同ファイル）と同じ集計パターン（`municipality_quiz_results` を `userId` + `municipalityCode IN (...)` で絞り込み `municipalityCode, mode` で `GROUP BY`、`COUNT(*)`/`SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)`）を用いる。`pairs` が空配列の場合はクエリを発行せず空の `Map` を返す。キーは `` `${municipalityCode}|${mode}` ``。data-model.md・contracts/item-accuracy.md #1 の契約を参照。
- [ ] T003 `app/(app)/dashboard/actions.ts` の `getReviewItemList` の SELECT に `municipalityCode`（`srsRecords.municipalityCode`）を追加する（既存の `municipalityName`/`mode`/`dueDate`/`repetition`/`interval` は変更しない）。（依存: なし、T002と並行可）
- [ ] T004 `getReviewItemList` 内で、`rows`/`totalRow` の既存 `Promise.all` とは独立した `try/catch` で `getItemAccuracyData(userId, rows から組んだ pairs)`（T002）を呼び出す。成功時は各 `item.accuracy` に `{ correct, total }` を設定し、失敗時（例外送出）は全項目の `accuracy` を `undefined` のまま `items`/`total` を返す（この関数自体は例外を再スローしない）。戻り値の型に `municipalityCode: string` と `accuracy?: { correct: number; total: number }` を追加する。contracts/item-accuracy.md #2 の契約を参照。（依存: T002, T003）
- [ ] T005 [P] `DATABASE_URL=... pnpm test __tests__/lib/dashboard/queries-parity.test.ts` に `getItemAccuracyData` のテストケースを追加する: ①複数 `(code, mode)` ペアに対する正解数/総数の集計が実際のレコードと一致する ②該当レコードがない `(code, mode)` はキーとして返らない ③`pairs=[]` → 空の `Map`。（依存: T002）
- [ ] T006 [P] 同テストファイルに `getReviewItemList` のフォールバック検証を追加する: `getItemAccuracyData` が例外を投げる状況（モックまたは不正な接続设定を用いて再現）でも `getReviewItemList` 自体は例外を投げず、`items` の各要素の `accuracy` が `undefined` になることを確認する（FR-006）。（依存: T004）

**Checkpoint**: 正答率データ取得の基盤（DBクエリ・Server Action拡張・失敗時フォールバック）が完了し、既存の `items`/`total` フィールドの挙動に回帰がない。ここから先はUI変更のみで両ストーリーを実装できる。

---

## Phase 3: User Story 1 - 項目ごとの正答率を確認する (Priority: P1) 🎯 MVP

**Goal**: 「覚えている途中の市区町村」一覧ページの各項目（市区町村×モード）に正答率を表示する。

**Independent Test**: 復習中の項目を複数持つユーザーで一覧ページを開き、各行に正答率（パーセンテージ）が表示され、その値が実際の解答試行の正解割合と一致することを確認する（quickstart.md 手順1）。

### Implementation for User Story 1

- [ ] T007 [US1] `app/(app)/quiz/review/items/page.tsx` のリスト項目（141〜154行目付近）に、`item.accuracy` が存在する場合 `Math.round(item.accuracy.correct / item.accuracy.total * 100)` を `{n}%` として表示する要素を追加する。`item.accuracy` が `undefined` の場合はこの要素を描画せず、種目バッジ・市区町村名・次回期日は既存通り表示する（FR-001〜003, FR-006; contracts/item-accuracy.md #3）。（依存: T004）
- [ ] T008 [US1] 同一市区町村が複数モードで復習中の場合に、モードごとに別々の正答率が表示され合算されないことを手動確認する（FR-004; quickstart.md 手順1）。（依存: T007）
- [ ] T009 [US1] 試行回数が1回のみの項目について、正答率が0%または100%としてそのまま表示され、非表示や特別な注記が付かないことを手動確認する（Edge Case; quickstart.md 手順4）。（依存: T007）

**Checkpoint**: US1 完了。MVP としてリリース可能（低正答率の強調表示なしでも正答率自体は見える）。

---

## Phase 4: User Story 2 - 正答率が低い項目を一目で見分ける (Priority: P2)

**Goal**: 一覧の中で正答率が低い項目を視覚的にすぐ見分けられるようにする。

**Independent Test**: 正答率が異なる複数の項目（例: 30%・60%・90%）が並ぶ一覧で、正答率が低い項目が他と視覚的に区別できることを確認する（quickstart.md 手順2）。

### Implementation for User Story 2

- [ ] T010 [US2] `app/(app)/quiz/review/items/page.tsx` の正答率表示（T007）に、`correct / total < 0.5` の場合 `text-destructive` クラスを条件付きで適用する（既存の96行目 `text-green-500` の色分けパターンを踏襲）。閾値・表現は実装時の裁量（FR-007; contracts/item-accuracy.md #3）。（依存: T007）

**Checkpoint**: US1 + US2 完了。一覧で正答率とその強弱を一目で確認できる。

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: コード品質の担保と最終検証

- [ ] T011 [P] `pnpm lint` を実行し、型チェックと ESLint をパスさせる。
- [ ] T012 [P] `DATABASE_URL=... pnpm test` を実行し、新規テスト（T005, T006）を含む全テストがパスすることを確認する。
- [ ] T013 `quickstart.md` の手動確認手順（1〜4）をすべて実行し、正答率の表示・低正答率の強調・取得失敗時のフォールバック・試行回数が少ない項目の表示を最終確認する。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし
- **Foundational (Phase 2)**: Setup 完了後。T002・T003 は並行可 → T004（両方に依存）→ T005/T006（並行可）
- **US1 (Phase 3)**: Foundational（特に T004）完了後
- **US2 (Phase 4)**: US1 の T007（正答率表示の土台）完了後
- **Polish (Phase 5)**: 全ストーリー完了後

### Parallel Opportunities

- T002（`getItemAccuracyData` 実装）と T003（SELECT への `municipalityCode` 追加）は並行可能（別々の変更点）。
- T005 と T006（DB統合テストの追加）は並行可能。
- T008 と T009（US1 の手動確認タスク）は並行可能。
- T011 と T012（lint / test）は並行可能。

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup
2. Phase 2: Foundational（T002〜T006）— 正答率データ取得基盤の実装とテスト
3. Phase 3: User Story 1（T007〜T009）— 正答率表示の実装
4. **STOP and VALIDATE**: quickstart.md 手順1・3・4 で US1 を独立検証
5. 低正答率の強調なしでもリリース可能な状態（MVP）

### Incremental Delivery

1. Setup + Foundational → 正答率データ取得基盤が完成し、既存の一覧表示に回帰がないことを確認済み
2. US1 追加 → 独立検証 → デプロイ可（MVP）
3. US2 追加 → 独立検証 → デプロイ可
4. Polish（lint/test/quickstart全項目）→ 最終リリース

---

## Notes

- [P] タスク = 別ファイル・依存なし
- [Story] ラベルはユーザーストーリーへのトレーサビリティ用
- Foundational フェーズ（正答率集計・フォールバック）は既存の `getWeaknessRankingData` と同じ集計方式を踏襲し、`municipality_quiz_results` を正とするデータソースの二重管理を避ける
- 各タスク後、または論理的なまとまりごとにコミットすることを推奨
- チェックポイントごとに独立して動作確認すること
