# Contracts: Server Actions & Read Hooks

本機能はアプリ内 UI からの操作のみ（外部 API 無し）。インターフェース契約は **Server Actions（Write）** と **TanStack Query フック（Read）** で構成する（憲法 II）。すべて Server Action 内で `supabase.auth.getUser()` により `userId` を解決し、未認証は `throw`。

---

## Write: Server Actions

### `saveMunicipalityQuizResult(input)` 〔既存を拡張〕

`app/(app)/quiz/municipality/actions.ts`

```ts
input: {
  municipalityCode: string;
  municipalityName: string;
  prefecture: string;
  mode: 'A' | 'B' | 'C' | 'D';
  isCorrect: boolean;
}
returns: void  // 失敗はログ記録に留め UI を止めない（既存挙動踏襲）
```

**追加責務（FR-005a / FR-001 / FR-019）**:
1. 従来どおり `municipality_quiz_results` に 1 行 INSERT。
2. `(userId, code, mode)` の `srs_records` を取得（無ければ既定 state）。
3. SM-2 適用:
   - `isCorrect=false`（q=2）: 常にリセット/復帰（status='reviewing', rep=0, int=1, due=翌日, EF減算）。
   - `isCorrect=true`（q=4）: `alreadyAdvancedToday` なら前進スキップ（INSERT のみ）。未前進なら `applySm2` で前進、`shouldGraduate` 成立で status='graduated'。
4. `srs_records` を upsert（`ON CONFLICT (user_id, code, mode)`）。`lastReviewedAt=now`。

> 備考: 復習セッションも同じ Action を使うため、復習・通常の区別は不要。

---

### `getDueReviewItems(opts?)` 〔新規〕

`app/(app)/dashboard/actions.ts`（または `quiz/review/actions.ts`）

```ts
opts?: { limit?: number }   // 既定 20（セッション上限, FR-010）
returns: Array<{
  municipalityCode: string;
  municipalityName: string;
  prefecture: string;
  mode: 'A' | 'B' | 'C' | 'D';
  interval: number;
  dueDate: string;          // ISO
}>
```

**仕様**: `status='reviewing' AND due_date <= now()` を `due_date ASC, interval ASC`（期日が古い→定着度が低い順, FR-010/012b）で `limit` 件。期日未到来は返さない（FR-009 / SC-008）。出題順はこの順序のまま（インターリービング, FR-012b）。

---

## Read: Server Actions + TanStack Query フック

### `getDueReviewSummary()` → `useDueReviewSummary()` 〔新規〕

```ts
returns: {
  dueCount: number;        // status='reviewing' AND due_date<=now
  reviewingCount: number;  // status='reviewing' 総数
  graduatedCount: number;  // status='graduated' 総数
  nextDueAt: string | null;// 未来の最短 due_date（dueCount=0 の案内用, FR-015）
}
```

- フック: `lib/hooks/useDueReviewSummary.ts`。ダッシュボードの「今日の復習」カード（FR-013/015）と進捗（FR-016）が参照。

### `getUpcomingReviewSchedule(days = 7)` → `useUpcomingReviewSchedule()` 〔新規 / US3〕

```ts
returns: Array<{ date: string; count: number }>  // 今後 days 日の日別 due 件数
```

- 進捗カード（US3 / FR-016）。読み取り専用。

### `getReviewItemList(opts?)` → `useReviewItemList({mode,page,pageSize})` 〔新規 / FR-016a,b〕

```ts
opts?: { mode?: 'A'|'B'|'C'|'D'; limit?: number; offset?: number } // limit 既定 25
returns: {
  items: Array<{ municipalityName: string; mode: string; dueDate: string; repetition: number; interval: number }>;
  total: number; // フィルタ適用後の総件数（ページング用）
}
```

- 「覚えている途中（status='reviewing'）」の一覧。**答え（都道府県）は返さない**（流暢性の錯覚回避, FR-016a）。`due_date ASC` 順。サーバーサイド**ページング**（limit/offset）＋**モードフィルタ**（FR-016b）。フックは `placeholderData: keepPreviousData` でページ送りを滑らかに。専用ページ `/quiz/review/items` が使用。

### `getReviewModeBreakdown()` → `useReviewModeBreakdown()` 〔新規 / FR-016c〕

```ts
returns: Array<{ mode: 'A'|'B'|'C'|'D'; reviewing: number; graduated: number }>
```

- モード×status を1クエリで集計しピボット。専用ページ先頭の**モード別サマリ表**（A/B/C/D × 復習中・定着済み・定着率）に使用。定着率は `graduated/(reviewing+graduated)` を UI 側で算出。

---

## UI ルート契約

### `/quiz/review`（新規ページ）

- 入口: ダッシュボード「今日の復習」カードのボタン（FR-014）。3タップ以内で到達（SC-001）。
- 処理: `getDueReviewItems()` → クライアントで市区町村データセット + distractor から **モード混在 `Question[]`** を生成 → `QuizRunner` で出題。
- Mode A: due な code を name でグルーピングして `ModeAQuestion` 化（research R6）。
- 各回答で `saveMunicipalityQuizResult` を呼ぶ（SM-2 更新 + ログ）。
- due 0 件で開始された場合は完了画面（または「今日の復習なし」へ戻す）。

### `/quiz/review/items`（新規ページ / FR-016a,b,c）

- 入口: ダッシュボード進捗カードの「覚えている途中の市区町村を見る N件 →」リンク。
- 先頭に**モード別サマリ表**（`getReviewModeBreakdown`）、下に**モードフィルタ**チップ＋**ページング**された一覧（`getReviewItemList`）。答え（都道府県）は非表示。

### `<QuizRunner questions onComplete />`（新規コンポーネント）

- 既存 `[mode]/page.tsx` の playing フェーズ（A/B/C/D 描画・回答ハンドラ・`recordAndAdvance`・フィードバック）を抽出。通常クイズ・復習セッション双方で再利用。
- 入力 `Question[]` のモードが混在していても、問題ごとに該当 UI を描画（FR-012a）。同一 (code, mode) を同一セッションで重複出題しない（FR-011）。
- Mode A の記録は `dedupeInstancesByPrefecture` で都道府県ごと代表1件に畳む（政令市の区による多重カウント防止 / B007）。

---

## 契約と要件の対応

| 契約要素 | 充足する FR/SC |
|----------|----------------|
| saveMunicipalityQuizResult 拡張 | FR-001, FR-005, FR-005a, FR-006, FR-007, FR-011a, FR-018, FR-019, SC-002, SC-003 |
| getDueReviewItems | FR-009, FR-010, FR-012b, SC-006, SC-008 |
| getDueReviewSummary / useDueReviewSummary | FR-013, FR-015, FR-016 |
| getUpcomingReviewSchedule | FR-016（US3） |
| /quiz/review + QuizRunner | FR-012, FR-012a, FR-014, SC-001, SC-007 |
| srs_records (user_id, code, mode) 一意 | FR-002, SC-004 |
| バックフィル INSERT...SELECT | FR-001a |
