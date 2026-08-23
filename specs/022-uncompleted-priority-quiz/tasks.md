# Tasks: 市区町村クイズの未制覇（未クリア）優先出題と進捗可視化

**Input**: Design documents from `/specs/022-uncompleted-priority-quiz/`  
**Prerequisites**: plan.md (required), spec.md (required)

**Tests**: 動作変更を伴うため、純粋関数のユニットテストおよびServer Actionテストを実装前に作成し、FAILすることを確認してから実装を進める。

---

## User Story 1 - 未クリア（未制覇）優先出題で残りの市区町村を確実に攻略する (Priority: P1)

- [ ] T001 [US1] 純粋関数 `sampleMunicipalityPool` のユニットテスト作成 (`__tests__/lib/quiz/sampling.test.ts`)
- [ ] T002 [US1] 未クリア優先サンプリング純粋関数 `sampleMunicipalityPool` の実装 (`lib/quiz/sampling.ts`)
- [ ] T003 [US1] Server Action `getClearedMunicipalityCodes` の単体テスト作成 (`__tests__/server/cleared-codes.test.ts`)
- [ ] T004 [US1] クリア済み自治体コード取得 Server Action `getClearedMunicipalityCodes` の実装 (`app/(app)/quiz/municipality/actions.ts`)
- [ ] T005 [US1] クエリキーと TanStack Query フック `useMunicipalityClearedCodes` の追加 (`lib/query-keys.ts`, `lib/hooks/useMunicipalityClearedCodes.ts`)
- [ ] T006 [US1] クイズ結果保存後および中断（abort）時のクリア済みキャッシュ無効化 (`app/(app)/quiz/municipality/[mode]/page.tsx`)
- [ ] T007 [US1] クイズ設定画面への「未クリア優先モード」トグル・ローディングガードと出題生成への統合 (`app/(app)/quiz/municipality/[mode]/page.tsx`)

---

## User Story 2 - クイズ設定画面で現在の制覇状況（クリア数 / 総数）を把握する (Priority: P1)

- [ ] T008 [P] [US2] クイズ設定画面への現在の制覇進捗（クリア件数 / 総件数 / 進捗率）のリアルタイム表示追加 (`app/(app)/quiz/municipality/[mode]/page.tsx`)

---

## User Story 3 - 苦手優先と未クリア優先の組み合わせ (Priority: P2)

- [ ] T009 [P] [US3] 「苦手優先」と「未クリア優先」併用時の重み付け検証とテスト拡充 (`__tests__/lib/quiz/sampling.test.ts`)

---

## 完了検証と品質保証

- [ ] T010 全体の型検査・テスト・lint ratchet実行 (`pnpm type-check`, `pnpm test`, `pnpm lint:ratchet`)
