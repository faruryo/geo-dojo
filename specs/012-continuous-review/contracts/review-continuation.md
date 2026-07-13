# 内部契約: 復習の連続プレイ

本機能は外部公開 API を持たない（社内 Next.js アプリの一画面の拡張）ため、コンポーネント間・関数間の内部契約として以下を定義する。

---

## 1. `buildReviewQuestions` 契約

**場所**: `lib/quiz/review-questions.ts`

```typescript
function buildReviewQuestions(
  items: DueReviewItem[],
  allMunicipalities: Municipality[],
): Question[]
```

**事前条件**:
- `allMunicipalities` は空でないこと（呼び出し側の `page.tsx` は `masterLoading` 完了後にのみ呼ぶ）。

**事後条件**:
- `items` が空なら `[]` を返す。
- `items` 内で `mode==='A'` かつ同一 `name` を持つものは1問に集約する（既存ロジック踏襲）。
- `items` 内で同一 `(municipalityCode, mode)` の重複は1件に de-dupe する（既存の `seenInSession` ロジック踏襲）。
- 戻り値の `Question[]` は `QuizRunner` にそのまま渡せる形式であること。

**呼び出し元**: `app/(app)/quiz/review/page.tsx` の `loadBatch()`。マウント時と「続けて復習する」ボタン押下時の両方から同一関数を呼ぶ。

---

## 2. `dueReviewCondition` 契約

**場所**: `lib/db/srs-due.ts`

```typescript
function dueReviewCondition(userId: string): SQL
```

**事後条件**:
- `srsRecords` テーブルに対する `.where()` にそのまま渡せる Drizzle 条件式を返す。
- 条件は `userId` 一致 + `status='reviewing'` + `dueDate < JST明日0時`（`getJSTStartOfTomorrow()`）。

**呼び出し元**:
- `getDueReviewItems`（`app/(app)/quiz/review/actions.ts`）
- `getDueReviewSummaryData` の `dueRow` クエリ（`app/(app)/dashboard/queries.ts`）

**非対象**（意図的に対象外）:
- `getDueReviewSummaryData` の `nextDueRow`（`gte(dueDate, jstStartOfTomorrow)`）
- `getUpcomingReviewScheduleData`（`gte`/`lt` の範囲条件）

---

## 3. 結果画面 → 続行アクション の UI 契約

**場所**: `app/(app)/quiz/review/page.tsx`（`phase === 'result'` の描画部分）

| 状態 | 条件 | 表示 |
|------|------|------|
| 続行アクションを表示（件数あり） | `useDueReviewSummary().data?.dueCount` が `number` かつ `> 0` | 「続けて復習する（残り {dueCount} 件）」ボタン。押下で `loadBatch()` を呼ぶ |
| 続行アクションを表示（件数なし） | `data === undefined`（未取得・取得失敗、`isError` を含む） | 「続けて復習する」ボタン（件数表示は省略）。押下で `loadBatch()` を呼ぶ |
| 続行アクションを非表示 | `dueCount === 0`（取得に成功し、確実に0件と判明） | 既存の完了体験（「今日のおすすめクイズを試す」／「ダッシュボードへ」）のみ表示 |

**注記**:
- `dueCount` は表示時点のスナップショットであり、その後の状況変化（他デバイスでの消化等）との厳密な一致は保証しない（SC-002 の許容範囲）。
- 続行アクションの表示可否（＝続けられるかどうか）は `useDueReviewSummary` の取得成否に依存させない。取得失敗時にボタンごと隠すと、実際には大量に残っている項目があるユーザーからも本機能の中核価値（ダッシュボード往復の排除）を奪ってしまうため、件数表示のみを取得成否に連動させ、ボタンの表示は「確実に0件と判明したか」でのみ判断する（FR-007）。
- `loadBatch()` の結果、新バッチが実質0件だった場合は `phase='empty'` に遷移し、既存の「今日の復習はありません」を表示する（FR-008）。この場合、`useDueReviewSummary` の表示とは別経路（`getDueReviewItems` の直接結果）で判定するため、上記テーブルの「表示」判定と実際の続行結果が食い違うことは仕様上許容される。
