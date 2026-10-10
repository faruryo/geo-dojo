---

description: "Task list for analytics period default and long-range accuracy buckets"
---

# Tasks: 詳細分析の期間初期値と長期の正答率推移

**Input**: Design documents from `/specs/031-analytics-all-period/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/analytics-period.md, quickstart.md

**Tests**: バケット判定と期間の読み書きは純粋関数のケース表。既存の prefetch とフィルター初期値テストを期待値ごと先に赤くする。

**Organization**: ユーザーストーリー単位。US1 の初期値、US2 の集約、US3 の記憶。

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

作業なし。依存追加もスキーマ変更もしない。

## Phase 2: Foundational

US1 は既存の期間引数の初期値だけを変える。US2 と US3 の純粋関数は各ストーリー内で足す。共有のブロッカーはない。

## Phase 3: User Story 1 - 開いただけでこれまでの推移を見る (Priority: P1)

**Goal**: 保存が無いとき、詳細分析の期間は最初から全期間。prefetch も同じ。

**Independent Test**: フィルターテストの初期呼び出しと prefetch ソースが `all`。

- [x] T001 [US1] `__tests__/lib/analytics/prefetch.test.ts` と `__tests__/components/analytics/analytics-filter.test.tsx` の初期期間期待を `all` に変えて赤くする
- [x] T002 [US1] `components/analytics/analytics-client.tsx` の `period` 初期値を `all` にする
- [x] T003 [US1] `lib/analytics/prefetch.ts` の trend / completionTrend / weakness の初期キーとクエリを `all` にする
- [x] T004 [US1] `components/dashboard/accuracy-chart.tsx` の内部初期値を `all` にする

## Phase 4: User Story 2 - 長く使っても正答率の線が読める (Priority: P2)

**Goal**: 全期間の正答率を、JST 暦日差 364 以下は月曜週、365 以上は月にまとめる。軸とツールチップを短くする。

**Independent Test**: `accuracy-buckets` の境界とラベル。7日・30日は日のまま。

- [x] T005 [US2] `__tests__/lib/analytics/accuracy-buckets.test.ts` に 364/365・月曜・月キー・軸・ツールチップのケースを追加して赤くする
- [x] T006 [US2] `lib/analytics/accuracy-buckets.ts` に粒度・キー・軸ラベル・ツールチップを実装する
- [x] T007 [US2] `lib/db/queries/dashboard.ts` の正答率日付キーをバケット関数へ委譲する。Mode A の足し上げは変えない
- [x] T008 [US2] `components/dashboard/accuracy-chart.tsx` の全期間だけ軸・ツールチップ・`minTickGap` を付ける

## Phase 5: User Story 3 - 選んだ期間を次回も使う (Priority: P3)

**Goal**: 期間だけを学習者ごとの `localStorage` に覚え、マウント後に復元する。読む前の操作は上書きしない。

**Independent Test**: 不正値と他ユーザーのキーを読まない。画面は保存された `30d` を呼び、操作後の復元で上書きしない。

- [x] T009 [P] [US3] `__tests__/lib/analytics/period-preference.test.ts` を追加して赤くする
- [x] T010 [US3] `lib/analytics/period-preference.ts` を実装する
- [x] T011 [US3] `components/analytics/analytics-client.tsx` でマウント後に復元し、変更時に保存する
- [x] T012 [US3] `__tests__/components/analytics/analytics-filter.test.tsx` に復元と、操作後は保存値で上書きしないケースを追加する

## Phase 6: Polish

- [x] T013 対象テストを通し、新規ケースを一時的に壊して赤くなることを確認してから戻す

## Dependencies

- US1 → US3（画面の初期値が `all` でないと復元の上書き判定がぶれる）
- US2 は US1 と独立。同じ `accuracy-chart.tsx` を触るので US1 の後
- US3 は US1 の後

## Parallel

- T005 と T009 は別ファイル
- T006 と T010 は別ファイル

## Implementation Strategy

MVP は US1（初期値を全期間にする）。US2 で長期の密度、US3 で選択の記憶を足す。
