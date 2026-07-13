# データモデル: 復習の連続プレイ

本機能では、データベーススキーマの変更は行わない（新規テーブル・新規カラムなし）。
既存の `srs_records` テーブル（`lib/db/schema.ts`）をそのまま利用する。

クライアント側で新設・拡張する型と、共通化する DB クエリ条件について定義する。

---

## データ構造 (Entities)

### 1. `DueReviewItem`（既存・変更なし）

`app/(app)/quiz/review/actions.ts` で定義済み。`getDueReviewItems()` の戻り値。

```typescript
export type DueReviewItem = {
  municipalityCode: string;
  municipalityName: string;
  prefecture: string;
  mode: 'A' | 'B' | 'C' | 'D';
  interval: number;
  dueDate: string;
};
```

「続けて復習する」でも同じ型・同じ Server Action をそのまま再利用する（FR-004: 初回バッチと同じ選定条件）。

### 2. `Question`（既存・変更なし）

`components/quiz/quiz-runner.tsx` で定義済みの `ModeAQuestion | SingleQuestion` 合併型。`buildReviewQuestions()` の戻り値として引き続き使う。

### 3. `ReviewPhase`（既存拡張なし・状態遷移の明確化のみ）

```typescript
type Phase = 'loading' | 'empty' | 'playing' | 'result';
```

型定義自体は変更しないが、状態遷移に「続ける」からの再遷移が加わる：

```text
loading --(items>0)--> playing --(onComplete)--> result
loading --(items=0)--> empty
result --(続ける押下)--> loading --(items>0)--> playing --(onComplete)--> result
result --(続ける押下)--> loading --(items=0)--> empty   ※FR-008
```

`result` フェーズでは `useDueReviewSummary()` の `dueCount` を参照して「続けて復習する」ボタンの表示要否と件数表示を決める（DB 側の状態を直接持ち回らない）。表示要否は「`dueCount === 0`（確実に0件と判明）」の場合のみ非表示とし、取得失敗（`data === undefined`）の場合はボタン自体は表示したまま件数表示のみ省略する（FR-007）。

---

## 新規関数シグネチャ

### `buildReviewQuestions`（`lib/quiz/review-questions.ts`）

```typescript
export function buildReviewQuestions(
  items: DueReviewItem[],
  allMunicipalities: Municipality[],
): Question[];
```

- 入力・出力ともに副作用なし（`shuffle()` 内部で `Math.random()` を使うため呼び出しごとに非決定的だが、外部状態の読み書きはしない）。
- `page.tsx` の既存 `useEffect` 内ロジック（Mode A グルーピング、Mode B/C/D 選択肢生成）をそのまま移設する。ロジック自体は変更しない。

### `dueReviewCondition`（`lib/db/srs-due.ts`）

```typescript
export function dueReviewCondition(userId: string): SQL;
```

- `srsRecords` テーブルに対する `userId` + `status='reviewing'` + `dueDate < JST明日0時` の WHERE 条件を返す。
- `getDueReviewItems`（review/actions.ts）と `getDueReviewSummaryData`（dashboard/queries.ts）の両方の `.where()` で共有する。
- 既存の戻り値・件数は変更しない（振る舞い保存のリファクタ）。

---

## 影響範囲の確認（振る舞い不変を保証する観点）

| 関数 | 変更前の due 判定 | 変更後 | 期待される差分 |
|------|------------------|--------|----------------|
| `getDueReviewItems` | インラインで `and(eq(userId), eq(status,'reviewing'), lt(dueDate, jstStartOfTomorrow))` | `dueReviewCondition(userId)` を `.where()` に渡す | なし（同一条件） |
| `getDueReviewSummaryData` の `dueRow` | 同上をインラインで記述 | `dueReviewCondition(userId)` を `.where()` に渡す | なし（同一条件） |
| `getDueReviewSummaryData` の `nextDueRow` / `getUpcomingReviewScheduleData` | `gte(dueDate, jstStartOfTomorrow)` 側の条件 | 変更なし | 対象外（due ではなく「明日以降」の条件のため） |

既存の DB 統合テスト（`__tests__/lib/dashboard/queries-parity.test.ts`）がこの2関数の戻り値を検証しているため、リファクタ後も同テストが green であることをもって振る舞い不変を確認する。
