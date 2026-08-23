# Tasks: 市区町村クイズの未制覇（未クリア）優先出題と進捗可視化

**Input**: Design documents from `/specs/022-uncompleted-priority-quiz/`  
**Prerequisites**: plan.md (required), spec.md (required)

**Tests**: 動作変更を伴うため、純粋関数のユニットテストおよびServer Actionテストを実装前に作成し、FAILすることを確認してから実装を進める。

---

## User Story 1 - 未クリア（未制覇）優先出題で残りの市区町村を確実に攻略する (Priority: P1)

- [ ] T001 [US1] 純粋関数 `sampleMunicipalityPool` / `computePoolStats` / `buildQuizQuestions` の決定論的ユニットテスト作成（未クリア選出・既クリア補充・Mode A 同名集約・Mode B/C/D 出題単位集約・苦手優先併用時の出題単位集約・`computePoolStats` グループ化母数/クリア数集計・RNG注入対応、`__tests__/lib/quiz/sampling.test.ts`）
- [ ] T002 [US1] 未クリア優先サンプリング純粋関数 `sampleMunicipalityPool` / `computePoolStats` / `buildQuizQuestions` の実装（`options.random` 注入・出題単位のクリア＆苦手集約・出題単位母数集計対応、`lib/quiz/sampling.ts`）
- [ ] T003 [US1] Server Action `getClearedMunicipalityCodes` および `getMunicipalityWeakness` 全件取得の単体テスト作成 (`__tests__/server/cleared-codes.test.ts`)
- [ ] T004 [US1] クリア済み自治体コード取得 Server Action `getClearedMunicipalityCodes` の実装および `getMunicipalityWeakness` の上限撤廃 (`app/(app)/quiz/municipality/actions.ts`)
- [ ] T005 [US1] クエリキーと TanStack Query フック `useMunicipalityClearedCodes` の追加 (`lib/query-keys.ts`, `lib/hooks/useMunicipalityClearedCodes.ts`)
- [ ] T006 [US1] 非同期キャッシュ同期・ガード（保留中保存待機・リプレイ時再フェッチ・中断時遅延タイマー破棄と完了抑止・`clearedCodes` および `weakness` のエラー/ローディング抑止・推薦バイパス）の統合テスト作成 (`__tests__/components/quiz/municipality-quiz-session-sync.test.tsx`)
- [ ] T007 [US1] `use-quiz-actions` / `QuizRunner` への `awaitPendingSaves()` 公開・中断時の `advanceTimer` 破棄と、セッション終了・中断時の pending save 待機・`clearedCodes` / `weakness` 両クエリ遅延再フェッチの実装 (`components/quiz/use-quiz-actions.ts`, `components/quiz/quiz-runner.tsx`, `app/(app)/quiz/municipality/[mode]/page.tsx`)
- [ ] T008 [US1] クイズ設定画面への「未クリア優先モード」トグル（初期値ON）・`clearedCodes` & `weakness` 両クエリのローディング/再取得/エラーガード（`isLoading || isFetching || isError` 時のスタート・リプレイ抑止・リトライUI・推薦セッションバイパス）と出題生成への統合 (`app/(app)/quiz/municipality/[mode]/page.tsx`)

---

## User Story 2 - クイズ設定画面で現在の制覇状況（クリア数 / 総数）を把握する (Priority: P1)

- [ ] T009 [US2] クイズ設定画面への現在の制覇進捗（クリア件数 / 総件数 / 進捗率）のリアルタイム表示追加 (`app/(app)/quiz/municipality/[mode]/page.tsx`)

---

## User Story 3 - 苦手優先と未クリア優先の組み合わせ (Priority: P2)

- [ ] T010 [US3] 「苦手優先」と「未クリア優先」併用時の決定論的重み付けサンプリング検証（T001 のテスト実行と T002 での挙動確認）

---

## 完了検証と品質保証

- [ ] T011 全体の型検査・テスト・lint ratchet実行 (`pnpm type-check`, `pnpm test`, `pnpm lint:ratchet`)
