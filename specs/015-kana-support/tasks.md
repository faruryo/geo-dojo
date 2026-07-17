# Tasks: 都道府県・市区町村の読み仮名表示

**Input**: Design documents from `/specs/015-kana-support/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/kana-data.md, quickstart.md

**Tests**: PREFECTURE_KANA の整合性・kana 伝播ロジックに対する Vitest 単体テスト、および `getWeaknessRankingData`/`getDueReviewItems`/`getReviewItemList` の kana 列に対する既存 DB 統合テストパターンの拡張を含む（プロジェクト方針: 純粋関数＋Vitest、DB統合テストは `DATABASE_URL` 切り替え）。UI レンダリングは手動確認（quickstart.md）。

**Organization**: タスクはユーザーストーリー単位。US1（解答直後フィードバック）が P1 (MVP)。US2（苦手リスト・復習項目一覧）、US3（出題中表示）は独立して実装・検証可能だが、いずれも Foundational フェーズでの `kana` データ整備・伝播に依存する。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 別ファイル・依存なしで並行実行可能
- **[Story]**: US1 / US2 / US3

## Path Conventions

Next.js 単一プロジェクト（App Router）。DB スキーマは `lib/db/schema.ts`、データ取り込みは `scripts/`、出題ロジックは `lib/quiz/`、UI は `components/quiz/`・`components/dashboard/`、画面は `app/(app)/quiz/`・`app/(app)/dashboard/`。

---

## Phase 1: Setup

**Purpose**: 読み仮名データの一次情報源の取得・検証

- [x] T001 総務省「全国地方公共団体コード」公式データを取得・検証済み。実ファイル: `https://www.soumu.go.jp/main_content/000925835.xlsx`（令和6年1月1日更新版）。列構成は `団体コード（6桁）／市区町村名（漢字）／市区町村名（半角カタカナ）` （xlsx内部の `sharedStrings.xml` で実データ確認済み）。**半角カタカナ**表記であるため、変換は「半角カタカナ→全角カタカナ→ひらがな」の順で行うこと。ローカル作業用に生データ（xlsx）を一時保存する（リポジトリにはコミットしない。シード JSON のみをコミット対象とする）。

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: `kana` データの調達・DB格納・型伝播という、全ユーザーストーリーが依存する基盤を整備する

- [ ] T002 `lib/db/schema.ts` の `municipalityMaster` に `kana: text('kana')`（nullable）カラムを追加する。
- [ ] T003 `pnpm drizzle-kit generate` を実行し、`supabase/migrations/` にマイグレーション SQL と `meta/` スナップショットを生成する（手書きしない。CIのmigrate driftチェック対策）。
- [ ] T004 [P] `scripts/fetch-municipality-kana.ts` を新規作成する。`https://www.soumu.go.jp/main_content/000925835.xlsx` をダウンロードし解析する（xlsx パーサーが未導入なら `xlsx`/`exceljs` 等を追加するか、zip展開して `xl/sharedStrings.xml` 等から抽出する）。団体コード（6桁）の先頭5桁を `municipality_master.code`（JISコード5桁）として正規化し、**半角カタカナ→全角カタカナ→ひらがな**の順で決定的に変換する。都道府県レベルの読み（47件、団体コード末尾が `000` の行など上位コード）と市区町村レベルの読み（コード単位）を分離して集計し、既存の全 `municipality_master.code` に対応する行が見つかるかを検証・レポートする（欠落があれば警告出力。全件をAI生成に頼らない）。
- [ ] T005 [P] T004 のスクリプトを実行し、`scripts/data/municipality-kana-seed.json`（市区町村: code → kana のマップ）と、都道府県47件分の読みデータ（`lib/quiz/municipality-data.ts` への転記用）を出力する。
- [ ] T006 `scripts/import-municipality-kana.ts` を新規作成する。`scripts/data/municipality-kana-seed.json` を読み込み、`municipality_master.kana` を `code` 単位で `UPDATE` する独立スクリプトとする（既存の `sync-municipality-master.ts` は変更・実行しない。政令市名がward名で上書きされる既知の副作用を回避するため）。
- [ ] T007 `lib/quiz/municipality-data.ts` に `PREFECTURE_KANA: Record<string, string>`（47件、T005 の都道府県読みデータから転記）を追加し、`Municipality` インターフェースに `kana?: string` を追加する。
- [ ] T008 [P] `__tests__/lib/quiz/municipality-data.test.ts` に、`Object.keys(PREFECTURE_KANA)` が `ALL_PREFECTURES` と完全に一致することを検証するテストを追加する。
- [ ] T009 ローカル環境で `pnpm drizzle-kit migrate` → `pnpm tsx scripts/import-municipality-kana.ts` を実行し、ローカル Supabase の `municipality_master.kana` にデータが反映されることを確認する。

**Checkpoint**: `municipality_master.kana` と `PREFECTURE_KANA` が整備され、`getMunicipalityMaster()` が自動的に `kana` を返すようになる。以降のユーザーストーリーはここに依存する。

---

## Phase 3: User Story 1 - 解答直後のフィードバックで正しい読み方がわかる (Priority: P1) 🎯 MVP

**Goal**: クイズ回答直後の正解・不正解フィードバックに、対象の都道府県名・市区町村名の読み仮名を併記する。

**Independent Test**: 読み仮名データが整備された市区町村を出題させ、解答直後のフィードバック表示に読み仮名が併記されることを確認する。

### Implementation for User Story 1

- [ ] T010 [US1] `app/(app)/quiz/municipality/[mode]/page.tsx` で `masterData` から `Municipality[]` を構築する箇所に `kana: m.kana ?? undefined` を追加し、下流（`buildQuestions`, `QuizRunner`）に伝播させる。
- [ ] T011 [US1] `app/(app)/quiz/review/page.tsx` で同様に `allMunicipalities` の構築箇所に `kana` を伝播させる。
- [ ] T012 [US1] `components/quiz/quiz-runner.tsx` のモードA正解・不正解フィードバック部分で、出題対象の市区町村名（`name`）に対応する読み仮名、および正解都道府県リスト（`correctPrefectures`）に `PREFECTURE_KANA` を用いた読み仮名を併記する。読み仮名が存在しない場合は何も表示しない（FR-005）。
- [ ] T013 [US1] `components/quiz/quiz-runner.tsx` のモードB/C/D正解・不正解フィードバック部分で、対象市区町村の `kana` を読み仮名として併記する。読み仮名が存在しない場合は何も表示しない（FR-005）。

**Checkpoint**: 全モードの解答直後フィードバックに読み仮名が併記される（MVP完了）。

---

## Phase 4: User Story 2 - 苦手リストで読み方を確認できる (Priority: P2)

**Goal**: ダッシュボードの苦手ランキング、復習項目一覧、復習セッション完了後の「まだ苦手な市区町村」バッジに読み仮名を併記する。

**Independent Test**: 苦手市区町村が存在する状態でダッシュボードおよび復習項目一覧を開き、各項目に読み仮名が併記されていることを確認する。

### Implementation for User Story 2

- [ ] T014 [US2] `app/(app)/dashboard/queries.ts` の `getWeaknessRankingData` の SELECT・GROUP BY に `municipalityMaster.kana` を追加し、返却オブジェクトに含める。
- [ ] T015 [US2] `components/dashboard/weakness-ranking.tsx` で、各項目の `municipalityName` の隣に `kana`（存在する場合のみ）を併記する。
- [ ] T016 [US2] `app/(app)/quiz/review/actions.ts` の `getDueReviewItems` に `municipalityMaster` との `innerJoin`（`srsRecords.municipalityCode = municipalityMaster.code`）を追加し、`DueReviewItem` 型・返却値に `kana` を含める。
- [ ] T017 [US2] `app/(app)/dashboard/actions.ts` の `getReviewItemList` に同様の JOIN（またはコード一覧に対する `municipality_master` 参照）を追加し、返却する `items[].kana` を含める。
- [ ] T018 [US2] `app/(app)/quiz/review/items/page.tsx` で、各行の市区町村名の隣に `kana`（存在する場合のみ）を併記する。
- [ ] T019 [US2] `components/quiz/quiz-runner.tsx` の `onComplete` コールバックが構築する結果エントリ（`ResultEntry` 相当）に `kana` を含め、`app/(app)/quiz/review/page.tsx` の「まだ苦手な市区町村」バッジ表示に読み仮名を併記する。
- [ ] T020 [US2] [P] 既存の DB 統合テストパターン（`DATABASE_URL` 切り替え）に倣い、`getWeaknessRankingData`/`getDueReviewItems`/`getReviewItemList` が `kana` を正しく返すことを検証するテストケースを追加する。

**Checkpoint**: 苦手リスト・復習項目一覧・復習完了画面のすべてに読み仮名が併記される。

---

## Phase 5: User Story 3 - 出題中の問題文・選択肢でも読み方がわかる (Priority: P3)

**Goal**: クイズ出題中の問題文・選択肢に表示される都道府県名・市区町村名にも読み仮名を併記する。

**Independent Test**: 選択肢形式のモードでクイズを開始し、問題文・全選択肢の地名に等しく読み仮名が併記されることを確認する（特定の選択肢のみの強調がないこと）。

### Implementation for User Story 3

- [ ] T021 [US3] `components/quiz/quiz-runner.tsx` のモードA問題文表示（出題対象の市区町村名）に読み仮名を併記する。
- [ ] T022 [US3] `components/quiz/quiz-runner.tsx` のモードB/C/D問題文・選択肢表示に読み仮名を併記する。全選択肢に等しく適用し、特定の選択肢のみを強調しないこと（FR-007）。
- [ ] T023 [US3] モードAの地図タップ対象（都道府県）自体には読み仮名を追加しない（地図UI自体は変更対象外であることを確認する）。

**Checkpoint**: 出題中の全モードで問題文・選択肢に読み仮名が併記される。

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: コード品質の担保、最終検証、バックログ更新

- [ ] T024 `pnpm lint` を実行し、型チェックと ESLint をパスさせる。
- [ ] T025 `pnpm test` を実行し、既存テストおよび新規作成したテストをすべてパスさせる。
- [ ] T026 `quickstart.md` の手動確認手順（P1/P2/P3 それぞれ、および既存機能への影響がないことの確認）を実行する。
- [ ] T027 `specs/backlog.md` の B015 を実装完了としてチェック済みに更新する。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし
- **Foundational (Phase 2)**: Setup 完了後（T001 のデータ確認が T004 の前提）
- **US1 (Phase 3)**: Foundational 完了後（`kana` カラム・`PREFECTURE_KANA` が存在しないと表示できない）
- **US2 (Phase 4)**: Foundational 完了後。US1 とは独立して実装・検証可能（同じ `Municipality.kana`/DBカラムに依存するのみで、US1 のUI変更には依存しない）
- **US3 (Phase 5)**: Foundational 完了後。US1/US2 とは独立（同じ `Municipality.kana` に依存するのみ）
- **Polish (Phase 6)**: 全ユーザーストーリー完了後

### Parallel Opportunities

- T004/T005（データ取り込みスクリプト）と T008（`PREFECTURE_KANA` テスト作成）は並行して進められる。
- Foundational 完了後、US1（Phase 3）・US2（Phase 4）・US3（Phase 5）はそれぞれ異なるファイルが中心のため、担当を分けて並行実装できる（ただし `components/quiz/quiz-runner.tsx` は US1/US3 で重複して変更するため、この2つは同一ファイル内で競合しないよう順序を調整するか、レビュー時にマージすること）。
- T024（Lint）と T025（テスト実行）は並行可能。
