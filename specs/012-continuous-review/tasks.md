# Tasks: 復習の連続プレイ

**Input**: Design documents from `/specs/012-continuous-review/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/review-continuation.md, quickstart.md

**Tests**: `lib/quiz/` の純粋関数はプロジェクト方針（メモリ: 純粋関数+Vitestで検証、DB直いじり検証は避ける）に従い Vitest 単体テストを含む。UI レンダリング分岐（続行ボタンの表示/非表示）は quickstart.md による手動確認とする。

**Organization**: タスクはユーザーストーリー単位。US1（続けてプレイ）が P1 (MVP)、US2（残数表示）は US1 のUI（続行ボタン）に依存するが独立して検証可能。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 別ファイル・依存なしで並行実行可能
- **[Story]**: US1 / US2

## Path Conventions

Next.js 単一プロジェクト（App Router）。復習フローは `app/(app)/quiz/review/`、出題構築の純粋関数は `lib/quiz/`、DBクエリ共通化は `lib/db/`。

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 既存の再利用資産の確認（新規パッケージ追加なし）

- [x] T001 `getDueReviewItems`（`app/(app)/quiz/review/actions.ts`）、`getDueReviewSummary`/`useDueReviewSummary`（`app/(app)/dashboard/actions.ts` / `lib/hooks/useDueReviewSummary.ts`）、`saveMunicipalityQuizResult` の SRS 更新（`app/(app)/quiz/municipality/actions.ts`）が現状のまま import・利用可能であることを確認する。新規依存パッケージ追加が不要であることを確認する。

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 両ユーザーストーリーが依存する「due判定の共通化」と「出題構築の関数抽出」。振る舞いは変更しない純粋リファクタ。

**⚠️ CRITICAL**: このフェーズが完了するまで US1/US2 のUI実装には着手しない

- [x] T002 `lib/db/srs-due.ts` を新規作成し、`dueReviewCondition(userId: string)` を実装する（`and(eq(srsRecords.userId, userId), eq(srsRecords.status, 'reviewing'), lt(srsRecords.dueDate, getJSTStartOfTomorrow()))` を返す）。data-model.md の契約を参照。
- [x] T003 `app/(app)/quiz/review/actions.ts` の `getDueReviewItems` を `dueReviewCondition(userId)` を使うようリファクタする（インラインの `and(...)` を置き換えるのみ。戻り値・limit・orderByは変更しない）。（依存: T002）
- [x] T004 `app/(app)/dashboard/queries.ts` の `getDueReviewSummaryData` 内 `dueRow` クエリを `dueReviewCondition(userId)` を使うようリファクタする（`nextDueRow`・`getUpcomingReviewScheduleData` は対象外のまま変更しない）。（依存: T002）
- [x] T005 [P] `DATABASE_URL=... pnpm test __tests__/lib/dashboard/queries-parity.test.ts` を実行し、T004リファクタ後も `getDueReviewSummaryData` の既存アサーション（`dueCount: 0` 等）が green であることを確認する。（依存: T004）
- [x] T006 [P] `lib/quiz/review-questions.ts` を新規作成し、`app/(app)/quiz/review/page.tsx` の `useEffect` 内にある出題構築ロジック（Mode A の同名グルーピング、Mode B/C/D の選択肢生成、`seenInSession` による de-dupe）を `buildReviewQuestions(items: DueReviewItem[], allMunicipalities: Municipality[]): Question[]` として移設する。ロジック自体（フィルタ条件・shuffle等）は変更しない。contracts/review-continuation.md の契約を参照。
- [x] T007 [P] `__tests__/lib/quiz/review-questions.test.ts` を新規作成し、`buildReviewQuestions` の単体テストを追加する: ①Mode A の同名複数県グルーピング ②Mode B/C/D の選択肢生成（正解を含む・重複なし） ③同一 `(municipalityCode, mode)` の de-dupe ④`items=[]` → `[]`。（依存: T006）
- [x] T008 `app/(app)/quiz/review/page.tsx` を書き換え、`buildReviewQuestions`（T006）を呼び出す `loadBatch()` 非同期関数に一本化する。既存の `useEffect`（マウント時の初回ロード）は `loadBatch()` を1回呼ぶだけにする。この時点では続行ボタンはまだ追加せず、既存の初回ロード〜結果表示の挙動を変更しない（回帰確認: 既存の復習フローを1バッチプレイし、従来通り結果画面が表示されることを目視確認）。（依存: T006）

**Checkpoint**: due判定・出題構築のリファクタが完了し、既存の復習フローが従来通り動作する。ここから先はUI変更（続行ボタン）のみで両ストーリーを実装できる。

---

## Phase 3: User Story 1 - 結果画面から続けて復習する (Priority: P1) 🎯 MVP

**Goal**: 復習セッション（1バッチ）を終えたユーザーが、期日を迎えている項目が残っている場合、結果画面から直接次のバッチのプレイを開始できる。

**Independent Test**: 期日超過の復習項目を21件以上持つユーザーで、1バッチ目（20件）を終えた結果画面に「続けて復習する」アクションが表示され、選択するとダッシュボードを経由せず次のバッチが直接始まることを確認する（quickstart.md 手順1）。

### Implementation for User Story 1

- [x] T009 [US1] `app/(app)/quiz/review/page.tsx` の `phase === 'result'` 描画部分に「続けて復習する」ボタンを追加し、押下時に `loadBatch()`（T008）を呼び出して画面遷移なしに次のバッチを開始する（FR-002, FR-003, FR-004）。（依存: T008）
- [x] T010 [US1] `loadBatch()` の結果、`getDueReviewItems` が空、または `buildReviewQuestions` の結果が実質0件だった場合に `phase='empty'` へ正しくフォールバックすることを確認する（FR-006, FR-008; quickstart.md 手順1・4）。（依存: T009）
- [x] T011 [US1] 複数バッチを連続プレイし、各バッチの結果画面（正答率・苦手一覧）が直近バッチ単体のものであり、前バッチと合算されないことを手動確認する（FR-005; quickstart.md 手順2）。（依存: T009）

**Checkpoint**: US1 完了。MVP としてリリース可能（残数表示なしでも「続ける」自体は機能する）。

---

## Phase 4: User Story 2 - 残り件数を見て続けるか判断する (Priority: P2)

**Goal**: ユーザーは結果画面上で、期日を迎えている残りの項目数を確認したうえで、続けるかどうかを判断できる。

**Independent Test**: バッチ終了時点で期日を迎えている残りの項目が既知の件数（例: 13件）のとき、結果画面の続行アクションにその残数が表示されることを確認する（quickstart.md 手順3）。残数の取得に失敗した場合は、件数表示のない「続けて復習する」ボタンが引き続き表示されることを確認する（quickstart.md 手順5）。

### Implementation for User Story 2

- [x] T012 [US2] `app/(app)/quiz/review/page.tsx` で `useDueReviewSummary()`（既存フック）を呼び出し、`phase === 'result'` 時に取得した `dueCount` が `number` かつ `> 0` の場合、続行ボタンのラベルへ「続けて復習する（残り{dueCount}件）」として反映する（FR-009）。あわせて、`QuizRunner` の `onComplete` 内 `queryClient.invalidateQueries({ queryKey: ['dashboard', 'srs-summary'] })` を `await` してから `setPhase('result')` を呼ぶよう変更する（古い `dueCount` が一瞬表示されるガタつきを防ぐ。contracts/review-continuation.md #3）。（依存: T009）
- [x] T013 [US2] `useDueReviewSummary()` の `isLoading` が `true` の間は表示を確定させない。`isLoading === false` になった時点で、`dueCount === 0`（取得成功かつ確実に0件）の場合のみ続行ボタン自体を非表示にする（FR-006）。`data === undefined`（取得失敗）の場合はボタンを隠さず、件数表示のみを省略した「続けて復習する」ボタンを表示する（FR-007; quickstart.md 手順4・5）。（依存: T012）

**Checkpoint**: US1 + US2 完了。結果画面から残数を見て連続プレイを判断できる。

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: コード品質の担保と最終検証

- [x] T014 [P] `pnpm lint` を実行し、型チェックと ESLint をパスさせる。
- [x] T015 [P] `DATABASE_URL=... pnpm test` を実行し、新規テスト（T007）と既存テスト（T005 で確認した `queries-parity.test.ts` を含む）が全てパスすることを確認する。
- [x] T016 `quickstart.md` の手動確認手順（1〜6）をすべて実行し、続行・非合算・残数表示・0件フォールバック・取得失敗フォールバック・due境界整合を最終確認する。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし
- **Foundational (Phase 2)**: Setup 完了後。T002 → T003/T004（並行可）→ T005。T006 → T007（並行してT003/T004と進行可）。T008 は T006 完了後、かつ着手前に T003/T004 の完了を待つ必要はないが、page.tsx の変更なので実務上は Foundational の最後にまとめて行う。
- **US1 (Phase 3)**: Foundational（特に T008）完了後
- **US2 (Phase 4)**: US1 の T009（続行ボタンの土台）完了後。US1 の残タスク（T010, T011）とは独立して並行可能
- **Polish (Phase 5)**: 全ストーリー完了後

### Parallel Opportunities

- T005（DBテスト実行）と T006/T007（出題構築の関数抽出＋テスト）は並行可能（別ファイル・別関心事）。
- T010 と T011（US1 の確認タスク）は並行可能。
- T014 と T015（lint / test）は並行可能。

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup
2. Phase 2: Foundational（T002〜T008）— due判定共通化・出題構築の関数抽出。ここまでで既存フローが壊れていないことを確認
3. Phase 3: User Story 1（T009〜T011）— 続行ボタンの実装
4. **STOP and VALIDATE**: quickstart.md 手順1・2・4 で US1 を独立検証
5. 残数表示なしでもリリース可能な状態（MVP）

### Incremental Delivery

1. Setup + Foundational → 既存フロー無変更で回帰確認済み
2. US1 追加 → 独立検証 → デプロイ可（MVP）
3. US2 追加 → 独立検証 → デプロイ可
4. Polish（lint/test/quickstart全項目）→ 最終リリース

---

## Notes

- [P] タスク = 別ファイル・依存なし
- [Story] ラベルはユーザーストーリーへのトレーサビリティ用
- Foundational フェーズ（due判定共通化・出題構築の関数抽出）は振る舞いを変更しないリファクタであり、B013（due境界不一致）の再発防止が目的。既存の `queries-parity.test.ts` が回帰検知の主手段
- 各タスク後、または論理的なまとまりごとにコミットすることを推奨
- チェックポイントごとに独立して動作確認すること
