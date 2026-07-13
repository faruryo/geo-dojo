# 内部契約: 復習項目一覧の正答率表示

本機能は外部公開 API を持たない（社内 Next.js アプリの一画面の拡張）ため、コンポーネント間・関数間の内部契約として以下を定義する。

---

## 1. `getItemAccuracyData` 契約

**場所**: `app/(app)/dashboard/queries.ts`

```typescript
function getItemAccuracyData(
  userId: string,
  pairs: { municipalityCode: string; mode: string }[],
): Promise<Map<string, { correct: number; total: number }>>
```

**事前条件**:
- `pairs` は呼び出し元（`getReviewItemList`）が現在ページの行から組み立てたキー一覧であること（最大25件、ページサイズと同数以下）。

**事後条件**:
- `pairs` が空配列なら、クエリを発行せず空の `Map` を返す。
- 戻り値のキーは `` `${municipalityCode}|${mode}` ``。値は当該 `(municipalityCode, mode)` の `municipality_quiz_results`（`userId` で絞り込み）に対する `{ correct: 正解件数, total: 総解答件数 }`。
- `pairs` に含まれるが解答履歴が1件もない `(code, mode)` の組はキーとして含まれない（`Map.get` は `undefined` を返す）。

**呼び出し元**: `getReviewItemList`（`app/(app)/dashboard/actions.ts`）。

---

## 2. `getReviewItemList` 契約（拡張）

**場所**: `app/(app)/dashboard/actions.ts`

```typescript
function getReviewItemList(opts?: {
  mode?: 'A' | 'B' | 'C' | 'D';
  limit?: number;
  offset?: number;
}): Promise<{
  items: Array<{
    municipalityCode: string;
    municipalityName: string;
    mode: string;
    dueDate: string;
    repetition: number;
    interval: number;
    accuracy?: { correct: number; total: number };
  }>;
  total: number;
}>
```

**事後条件**:
- 既存の `items`/`total` の意味・ページング挙動は変更しない（`municipalityCode` と `accuracy` が追加されるのみ）。
- `getItemAccuracyData` の呼び出しが失敗（例外送出）した場合、当該呼び出しをこの関数内で捕捉し、全項目の `accuracy` を `undefined` として通常どおり `items`/`total` を返す。**この関数自体が例外を再スローしてはならない**（FR-006）。
- `accuracy` が存在する項目については `accuracy.total >= 1` であること（0除算を避ける。`total === 0` のキーは `getItemAccuracyData` が返さない設計のため、呼び出し側で追加のガードは不要）。

**呼び出し元**: `useReviewItemList`（`lib/hooks/useReviewItemList.ts`、既存・変更なし）。

---

## 3. 一覧行 → 正答率表示 の UI 契約

**場所**: `app/(app)/quiz/review/items/page.tsx`（リスト項目の描画部分）

| 状態 | 条件 | 表示 |
|------|------|------|
| 正答率を表示 | `item.accuracy` が存在する | `Math.round(correct / total * 100)` を `{n}%` 形式で表示 |
| 正答率を表示しない | `item.accuracy` が `undefined`（集計失敗、または理論上発生しない0試行） | 正答率欄を描画しない。種目バッジ・市区町村名・次回期日は通常どおり表示（FR-006） |
| 低正答率の強調 | `item.accuracy` が存在し、かつ `correct / total < 0.5` | 正答率テキストに `text-destructive` 等の既存トークンを適用し、他の項目と視覚的に区別する（FR-007） |

**注記**:
- 正答率は解答内容（都道府県名）そのものではないため、既存の「解答を一覧に出さない」方針（FR-005, 005-spaced-review FR-016a）には抵触しない。
- 低正答率の閾値（50%）・強調表現（テキスト色）は実装時の裁量であり、仕様上の要件は「視覚的に区別できること」（FR-007）のみ。将来的に閾値や表現を変更しても本契約・spec.md の変更は不要。
