# Tasks: 市区町村クイズの未制覇（未クリア）優先出題と進捗可視化

**Input**: Design documents from `/specs/022-uncompleted-priority-quiz/`  
**Prerequisites**: plan.md (required), spec.md (required)

**Tests**: 動作変更を伴うため、純粋関数のユニットテストおよびServer Actionテストを実装前に作成し、FAILすることを確認してから実装を進める。

---

## User Story 1 - 未クリア（未制覇）優先出題で残りの市区町村を確実に攻略する (Priority: P1)

- [x] T001 [US1] 純粋関数 `sampleMunicipalityPool` / `computePoolStats` / `buildQuizQuestions` の決定論的ユニットテスト作成（未クリア選出・既クリア補充・Mode A 同名集約・Mode B/C/D 出題単位集約・難易度を跨ぐ政令市区/同名自治体のクリア判定集約・苦手優先併用時の出題単位集約・`computePoolStats` グループ化母数/クリア数集計・RNG注入対応、`__tests__/lib/quiz/sampling.test.ts`）
- [x] T002 [US1] 未クリア優先サンプリング純粋関数 `sampleMunicipalityPool` / `computePoolStats` / `buildQuizQuestions` の実装（`identityCodeMap`/全マスタ参照による難易度跨ぎ集約対応・`options.random` 注入・出題単位のクリア＆苦手集約・出題単位母数集計対応、`lib/quiz/sampling.ts`）
- [x] T003 [US1] DB インデックス追加マイグレーションの作成、`schema.ts` 更新、および `docs/db-schema.md` 同期 (`lib/db/schema.ts`, `supabase/migrations/0005_add_cleared_lookup_idx.sql`, `docs/db-schema.md`)
- [x] T004 [US1] Server Action `getClearedMunicipalityCodes` および `getMunicipalityWeakness` 全件取得の単体テスト作成 (`__tests__/server/cleared-codes.test.ts`)
- [x] T005 [US1] クリア済み自治体コード取得 Server Action `getClearedMunicipalityCodes` の実装および `getMunicipalityWeakness` の上限撤廃 (`app/(app)/quiz/municipality/actions.ts`)
- [x] T006 [US1] クエリキーと TanStack Query フック `useMunicipalityClearedCodes` の追加 (`lib/query-keys.ts`, `lib/hooks/useMunicipalityClearedCodes.ts`)
- [x] T007 [US1] 非同期キャッシュ同期・ガード（保留中保存待機・リプレイ時再フェッチ・中断/popstate戻る時の遅延タイマー破棄と完了抑止・`clearedCodes` および `weakness` のエラー/ローディング抑止）の統合テスト作成 (`__tests__/components/quiz/municipality-quiz-session-sync.test.tsx`)
- [x] T008 [US1] `use-quiz-actions` / `QuizRunner` への `awaitPendingSaves()` 公開・中断時の `advanceTimer` 破棄・popstate 戻る操作の共通 exit ルーティングと、セッション終了・中断時の pending save 待機・`clearedCodes` / `weakness` 両クエリ遅延再フェッチの実装 (`components/quiz/use-quiz-actions.ts`, `components/quiz/quiz-runner.tsx`, `app/(app)/quiz/municipality/[mode]/page.tsx`)
- [x] T009 [US1] クイズ設定画面への「未クリア優先モード」トグル（初期値ON）・`clearedCodes` & `weakness` 両クエリのローディング/再取得/エラーガード（`isLoading || isFetching || isError` 時のスタート・リプレイ抑止・リトライUI）と出題生成への統合 (`app/(app)/quiz/municipality/[mode]/page.tsx`)

---

## User Story 2 - クイズ設定画面で現在の制覇状況（クリア数 / 総数）を把握する (Priority: P1)

- [x] T010 [US2] クイズ設定画面への現在の制覇進捗（クリア件数 / 総件数 / 進捗率）のリアルタイム表示追加（トグル状態に関わらず独立したローディング/エラー/再試行表示、`computePoolStats` による出題単位集計、`components/quiz/quiz-pool-progress.tsx`, `app/(app)/quiz/municipality/[mode]/page.tsx`）

---

## User Story 3 - 苦手優先と未クリア優先の組み合わせ (Priority: P2)

- [x] T011 [US3] 「苦手優先」と「未クリア優先」併用時の決定論的重み付けサンプリング検証（T001 のテスト実行と T002 での挙動確認）

---

## User Story 4 - 「今日のおすすめクイズ」でも未クリア優先を適用する (Priority: P1)

- [x] T013 [US4] 推薦自動開始が `unclearedFirst` をバイパスせず、クリア済みクエリ成功まで待ってから出題することを検証するテスト (`__tests__/lib/quiz/recommend-auto-start.test.ts`)
- [x] T014 [US4] `source=recommend` 自動開始から `unclearedFirst: false` 上書きを除去し、手動スタートと同じ `settings` とクエリガードで出題する (`lib/quiz/recommend-auto-start.ts`, `app/(app)/quiz/municipality/[mode]/page.tsx`)

---

## 完了検証と品質保証

- [x] T012 全体の型検査・テスト・lint ratchet実行 (`pnpm type-check`, `pnpm test`, `pnpm lint:ratchet`)
