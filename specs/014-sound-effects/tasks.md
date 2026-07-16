# Tasks: クイズ効果音（SE）の追加

**Input**: Design documents from `/specs/014-sound-effects/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/sound-effects.md, quickstart.md

**Tests**: `lib/quiz/sound-effects.ts` の音種選択・ミュートゲート・localStorage フォールバックはプロジェクト方針（メモリ: 純粋関数+Vitestで検証）に従い Vitest 単体テストを含む（contracts/sound-effects.md #6、research.md Decision 6）。実音の聞こえ方（聞き分け・音量感・テンポ非破壊）は quickstart.md による手動確認とする（jsdom に AudioContext がないため）。

**Organization**: タスクはユーザーストーリー単位。US1（正解・不正解音）が P1 (MVP)、US2（完了音）・US3（ミュート）は US1 と同じ基盤（Phase 2）の上に独立して実装・検証できる。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 別ファイル・依存なしで並行実行可能
- **[Story]**: US1 / US2 / US3

## Path Conventions

Next.js 単一プロジェクト（App Router）。音の生成・再生ロジックは `lib/quiz/sound-effects.ts`、UI フックは `lib/hooks/useSoundMuted.ts`、トグルUIは `components/quiz/mute-toggle.tsx`。統合先は `components/quiz/quiz-runner.tsx`（市区町村モードA〜D・復習セッション共通）と `app/(app)/quiz/prefecture/page.tsx`（独立実装）の2ファイルのみ。DB スキーマ変更・音声アセットファイル追加は一切なし（data-model.md、research.md Decision 1）。

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 既存の再利用資産と統合ポイントの確認（新規パッケージ追加なし）

- [x] T001 統合ポイントの現状確認: `components/quiz/quiz-runner.tsx` に `handleModeASubmit` / `handleBChoice` / `handleCChoice` / `handleDTap` / `handleTimeout`（各 `setFeedback(...)` 呼び出し）と `advanceQuestion` 内の `onComplete(updatedResults)`（`completedRef` ガード内）が存在すること、`app/(app)/quiz/prefecture/page.tsx` に `handleTap`（`setState(isCorrect ? 'correct' : 'wrong')`）と `setTimeout` 内の `setState('result')` 分岐が存在することを確認する。lucide-react の `Volume2` / `VolumeX` が import 可能であること、既存 localStorage パターン（`components/recommend/recommend-override.tsx` の try/catch ガード）を参照できることを確認する。新規依存パッケージ追加が不要であることを確認する。

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 全ユーザーストーリーが依存する効果音ユーティリティ（`playSe` / ミュート設定）とUIフックの実装（contracts/sound-effects.md #1・#2）

**⚠️ CRITICAL**: このフェーズが完了するまで US1/US2/US3 の統合実装には着手しない

- [x] T002 `lib/quiz/sound-effects.ts` を新規作成し、`SeEvent` 型（`'correct' | 'incorrect' | 'complete' | 'perfect'`、data-model.md #1）と、ミュート設定の読み書き関数 `isSoundMuted(): boolean` / `setSoundMuted(muted: boolean): void` を実装する。localStorage キーは `geo-dojo:se-muted`、値 `'true'` のときのみミュート、キー不在・localStorage 不可用（プライベートモード等）・SSR 環境では `false`（音あり）を返し例外を投げない（contracts #2、data-model.md #2、Clarifications: デフォルト音あり）。try/catch ガードは既存パターン（`recommend-override.tsx` 等）を踏襲する。
- [x] T003 同 `lib/quiz/sound-effects.ts` に `playSe(event: SeEvent): void` を実装する（contracts #1）。①冒頭で `isSoundMuted()` を直読みし、ミュート時は AudioContext の生成・resume を含む一切の再生処理を行わず return（SC-004）②AudioContext はモジュールスコープ変数 `audioContext` に遅延生成・再利用（data-model.md #3、SSR安全: モジュール評価時に生成しない）③`suspended` なら `resume()` を試みる（fire-and-forget、呼び出し元へ伝播させない）④4イベント各々の音パラメータ（波形・周波数列・エンベロープ・長さ）をオシレータ＋ゲインエンベロープで定義（research.md Decision 1。例: 正解=上昇2音、不正解=低い短音、完了=3音アルペジオ、全問正解=ファンファーレ風。短く控えめ・correct/incorrect は聞き分け可能・perfect は complete より際立つ）⑤全体を try/catch で包み例外を外へ投げず、`console.error` を出さない（`console.debug` は可。FR-012、research.md Decision 5）⑥同期的に即座に return し呼び出し元の処理時間を増やさない（FR-007）。あわせて、完了イベント判定（結果配列 `{ correct: boolean }[]` → 全問正解なら `'perfect'`、それ以外は `'complete'`）をテスト可能なエクスポート純粋関数（例: `completionSeEvent(results)`）として実装する（research.md Decision 6、contracts #6「完了イベント判定」）。（依存: T002）
- [x] T004 [P] `lib/hooks/useSoundMuted.ts` を新規作成し、`useSoundMuted(): [muted: boolean, setMuted: (muted: boolean) => void]` を実装する。`useState` + localStorage 同期の軽量フックで、初期値は `isSoundMuted()` から取得し、`setMuted` は `setSoundMuted`（T002）と React state を同時更新する（contracts #2。Context / グローバルストアは導入しない = research.md Decision 2）。（依存: T002）
- [x] T005 `__tests__/lib/quiz/sound-effects.test.ts` を新規作成し、contracts #6 の5項目を検証する: ①ミュートゲート: `isSoundMuted() === true` のとき `playSe` が再生パイプライン（AudioContext 生成含む）へ到達しないこと ②デフォルト値: localStorage キー不在時に `isSoundMuted()` が `false` を返すこと ③永続化: `setSoundMuted(true)` → `isSoundMuted() === true`、`setSoundMuted(false)` → `false` ④フォールバック: localStorage が例外を投げる環境で `isSoundMuted` / `setSoundMuted` / `playSe` が例外を投げないこと ⑤完了イベント判定: 全問正解の結果配列のときのみ `'perfect'`、1問でも不正解を含めば `'complete'` を返すこと。実行: `pnpm test __tests__/lib/quiz/sound-effects.test.ts`。（依存: T002, T003）

**Checkpoint**: 効果音の生成・再生・ミュート判定・永続化の基盤が完成しテスト済み。ここから先は既存2ファイルへの `playSe` 差し込みとトグル配置のみで全ストーリーを実装できる。

---

## Phase 3: User Story 1 - 正解・不正解を音で即座に感じ取る (Priority: P1) 🎯 MVP

**Goal**: 全クイズ画面（市区町村モードA〜D・復習セッション・都道府県クイズ）で、1問解答するたびに正解音／不正解音が鳴る（FR-001, FR-002, FR-006）。

**Independent Test**: いずれかのクイズで1問解答し、正解時に正解音・不正解時に聞き分けられる不正解音が鳴ることを確認する（quickstart.md 手順1〜3）。完了音（US2）・ミュート（US3）が未実装でも単体で価値が成立する。

### Implementation for User Story 1

- [x] T006 [US1] `components/quiz/quiz-runner.tsx` に `playSe` を import し、5つの解答ハンドラへ正誤音を差し込む（contracts #4-1〜#4-5）: `handleModeASubmit` / `handleBChoice` / `handleCChoice` / `handleDTap` の各 `setFeedback(correct ? 'correct' : 'incorrect')` と同じ箇所で `playSe(correct ? 'correct' : 'incorrect')`、`handleTimeout` の `setFeedback('incorrect')` と同じ箇所で `playSe('incorrect')`（FR-002: タイムアウトも不正解音）。不変条件: `recordAndAdvance` の `delayMs`（1200/1500ms）・`setTimeout` の構造・`saveMunicipalityQuizResult` 呼び出し・`onComplete`/`onAbort`/props のシグネチャを一切変更しない（contracts #4 不変条件、FR-007）。（依存: T003）
- [x] T007 [P] [US1] `app/(app)/quiz/prefecture/page.tsx` に同じ `playSe` を import し、`handleTap` 内の `setState(isCorrect ? 'correct' : 'wrong')` と同じ箇所で `playSe(isCorrect ? 'correct' : 'incorrect')` を呼ぶ（contracts #5-1）。都道府県クイズ専用の音は定義しない（FR-006: 画面をまたいで同じ音）。1200ms の `setTimeout`・出題キュー・`restart` の挙動は変更しない（contracts #5 不変条件）。（依存: T003）
- [x] T008 [US1] quickstart.md 手順1〜3 を手動確認する: 全モード（A〜D）・復習セッション・都道府県クイズで正解音／不正解音が鳴り同じ音であること（FR-006）、モードDのタイムアウトで不正解音が鳴り進行がブロックされないこと（US1 シナリオ3）、連続解答してもテンポが変わらないこと（FR-007 / SC-005）。（依存: T006, T007）

**Checkpoint**: US1 完了。MVP としてリリース可能（完了音・ミュートなしでも「解答の手応えが増す」中核価値が成立）。

---

## Phase 4: User Story 2 - クイズ完了時に達成感のある音を聞く (Priority: P2)

**Goal**: 結果画面表示のタイミングで完了音が鳴り、全問正解時はより際立った演出音（`perfect`）が鳴る。中断時は鳴らない（FR-003, FR-004, FR-005）。

**Independent Test**: クイズを完走して結果画面到達と同時に完了音が鳴ること、全問正解時は聞き分けられる演出音が鳴ること、中断時は鳴らないことを確認する（quickstart.md 手順4）。

### Implementation for User Story 2

- [x] T009 [US2] `components/quiz/quiz-runner.tsx` の `advanceQuestion` 内、最終問題を超えたとき `onComplete(updatedResults)` の直前（`completedRef` ガードの内側）で `playSe(updatedResults.every((r) => r.correct) ? 'perfect' : 'complete')`（T003 の完了イベント判定関数を利用）を呼ぶ（contracts #4-6）。`complete` と `perfect` は排他（どちらか一方のみ鳴る、data-model.md #1）。不変条件: `onAbort` 経路（中断ボタン）ではいかなる `playSe` も呼ばない（FR-005）。復習の連続プレイは各バッチが独立にこの箇所を通過するためバッチごとに完了音が鳴る（FR-003 / US2 シナリオ4。追加実装不要であることを確認）。（依存: T003; 同一ファイルのため T006 完了後）
- [x] T010 [P] [US2] `app/(app)/quiz/prefecture/page.tsx` の `handleTap` 内 `setTimeout` コールバック、`round >= TOTAL_ROUNDS` 分岐で `setState('result')` の直前に `playSe(allCorrect ? 'perfect' : 'complete')` を差し込む（contracts #5-2）。全問正解判定は state の `results`（クロージャで古い場合がある）ではなく、`handleTap` 冒頭で組んだ最新の解答を含む結果配列で行うこと。「クイズ選択に戻る」等での離脱時に鳴らないことは `result` 遷移時のみの発火で構造的に保証される（FR-005 相当）。（依存: T003; 同一ファイルのため T007 完了後）
- [x] T011 [US2] quickstart.md 手順4 を手動確認する: 誤答を含む完走で通常完了音、全問正解で演出音（重ねて鳴らない）、中断時は鳴らない、都道府県クイズでも同様、復習の連続プレイでバッチごとに完了音が鳴る（US2 シナリオ4）。（依存: T009, T010）

**Checkpoint**: US1 + US2 完了。1問ごとのフィードバックと完走の達成感演出が揃う。

---

## Phase 5: User Story 3 - 音を消したいときにミュートする (Priority: P3)

**Goal**: クイズ画面のヘッダからワンタップでミュート切り替えができ、全画面共通・次回訪問時も維持される（FR-008〜FR-011）。

**Independent Test**: ミュート操作後に全効果音が鳴らず視覚フィードバックは維持されること、ブラウザ再訪問でミュート状態が引き継がれること、再操作で音が復帰することを確認する（quickstart.md 手順5・6）。

### Implementation for User Story 3

- [x] T012 [US3] `components/quiz/mute-toggle.tsx` を新規作成する（contracts #3）。props なしの `MuteToggle` コンポーネントで、`useSoundMuted()`（T004）を用い、音あり時は lucide `Volume2`・ミュート中は `VolumeX` を表示、タップで `setMuted` をワンタップ切り替え（確認ダイアログなし、SC-003）。既存ヘッダ行（`text-xs text-muted-foreground`）に馴染むサイズ・色とし、状態に応じた `aria-label`（「効果音をミュート」/「ミュートを解除」）を付与する。切り替え時に音を鳴らす場合は解除時のみ（ミュート操作時は鳴らさない）。（依存: T004）
- [x] T013 [US3] `components/quiz/quiz-runner.tsx` のヘッダ行（「中断 / 進捗 / 正解数」を並べている `flex items-center justify-between` の行）に `MuteToggle` を配置する。モードA とモードB/C/D の両レイアウトに含めること（contracts #3 配置箇所）。既存レイアウト（375px 基準）を崩さない。（依存: T012; 同一ファイルのため T009 完了後）
- [x] T014 [P] [US3] `app/(app)/quiz/prefecture/page.tsx` のプレイ中ヘッダ行（「round / 正解数」の行）に `MuteToggle` を配置する。結果画面への配置は不要（contracts #3 配置箇所）。（依存: T012; 同一ファイルのため T010 完了後）
- [x] T015 [US3] quickstart.md 手順5・6 を手動確認する: ミュート後に全効果音（正解・不正解・完了・全問正解）が鳴らないこと（SC-004）、視覚フィードバックと進行は通常どおりであること（FR-011）、市区町村クイズでのミュートが都道府県クイズ・復習セッションにも適用されること（FR-009）、解除で音が復帰すること、ブラウザを閉じて再訪問してもミュート状態が維持されること（FR-010 / SC-003。DevTools で `geo-dojo:se-muted` = `true` も確認）。（依存: T013, T014）

**Checkpoint**: 全ユーザーストーリー完了。効果音・完了演出・ミュートが全クイズ画面で機能する。

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: コード品質の担保と最終検証

- [x] T016 [P] `pnpm lint` を実行し、型チェックと ESLint をパスさせる。
- [x] T017 [P] `pnpm test` を実行し、新規テスト（T005）を含む全テストがパスすることを確認する。
- [ ] T018 quickstart.md の手動確認手順（1〜9）をすべて実行し、未実施分を最終確認する: 特に手順7（`AudioContext` を意図的に壊しても進行が止まらず error 出力が出ない = FR-012）、手順8（`pnpm build && pnpm start` の本番ビルドでオフライン再生・音声ファイルのネットワークリクエストなし = FR-014）、手順9（実機マナーモードで警告を出さない）。（依存: T016, T017）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし
- **Foundational (Phase 2)**: Setup 完了後。T002 → T003 / T004（並行可、別ファイル）→ T005（T002, T003 完了後）
- **US1 (Phase 3)**: Foundational（特に T003）完了後。T006 と T007 は並行可（別ファイル）
- **US2 (Phase 4)**: T003 完了後に着手可能だが、T009 は `quiz-runner.tsx` を T006 と共有するため T006 の後、T010 は `prefecture/page.tsx` を T007 と共有するため T007 の後に行う
- **US3 (Phase 5)**: T012（トグル作成）は T004 完了後いつでも着手可。T013 / T014 は配置先ファイルの先行変更（T009 / T010）完了後
- **Polish (Phase 6)**: 全ストーリー完了後

### Parallel Opportunities

- T003（`playSe` 実装）と T004（`useSoundMuted` フック）は並行可能（T004 は T002 のみに依存、別ファイル）。
- T006（QuizRunner 正誤音）と T007（都道府県クイズ正誤音）は並行可能（別ファイル）。
- T009 と T010、T013 と T014 も同様にファイル単位で並行可能。
- T012（MuteToggle 作成）は US1/US2 の統合作業（T006〜T011）と並行して先行作成できる（別ファイル・T004 のみに依存）。
- T016 と T017（lint / test）は並行可能。

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup（T001）
2. Phase 2: Foundational（T002〜T005）— 効果音ユーティリティ・フック・ユニットテスト
3. Phase 3: User Story 1（T006〜T008）— 正誤音の全画面統合
4. **STOP and VALIDATE**: quickstart.md 手順1〜3 で US1 を独立検証
5. 完了音・ミュートなしでもリリース可能な状態（MVP）。ただしミュート手段のない効果音リリースは公共の場での利用体験を損なうため（spec US3「Why this priority」）、実運用のリリース単位としては US3 まで揃えることを推奨

### Incremental Delivery

1. Setup + Foundational → 音の基盤完成・ユニットテスト green
2. US1 追加 → 独立検証 → MVP
3. US2 追加 → 独立検証（完了音・全問正解演出・中断時に鳴らない）
4. US3 追加 → 独立検証（ミュート・永続化・画面横断）
5. Polish（lint / test / quickstart 全項目）→ 最終リリース

---

## Notes

- [P] タスク = 別ファイル・依存なし
- [Story] ラベルはユーザーストーリーへのトレーサビリティ用
- 変更ファイルは新規3（`sound-effects.ts` / `useSoundMuted.ts` / `mute-toggle.tsx`）＋テスト1、既存変更2（`quiz-runner.tsx` / `prefecture/page.tsx`）のみ。DB スキーマ・serwist 設定・`public/`・呼び出し元3画面（`municipality/[mode]/page.tsx`・`review/page.tsx`）は無変更（plan.md プロジェクト構成、contracts #4 不変条件）
- `playSe` の差し込みはすべて「1行追加」であり、既存の正誤判定・遷移タイミング・結果集計・SRS スケジューリングを変更しない（spec Assumptions「既存挙動への影響」）
- 各タスク後、または論理的なまとまりごとにコミットすることを推奨
- チェックポイントごとに独立して動作確認すること
