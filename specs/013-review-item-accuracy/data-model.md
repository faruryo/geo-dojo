# データモデル: 復習項目一覧の正答率表示

本機能では、データベーススキーマの変更は行わない（新規テーブル・新規カラムなし）。
既存の `municipality_quiz_results` テーブル・`srs_records` テーブル（`lib/db/schema.ts`）をそのまま利用する。

戻り値の型に追加するフィールドと、新規クエリ関数のシグネチャについて定義する。

---

## データ構造 (Entities)

### 1. `ReviewListItem`（`getReviewItemList` 戻り値・拡張）

`app/(app)/dashboard/actions.ts` の `getReviewItemList()` が返す配列要素。既存フィールドは変更せず、`municipalityCode` と `accuracy` を追加する。

```typescript
export type ReviewListItem = {
  municipalityCode: string;   // [新規] 正答率集計の結合キー。解答内容（都道府県名）ではないため FR-005 に抵触しない
  municipalityName: string;
  mode: 'A' | 'B' | 'C' | 'D';
  dueDate: string;
  repetition: number;
  interval: number;
  accuracy?: {                // [新規] undefined = 集計失敗（FR-006）。attempt 0 件は通常発生しない想定
    correct: number;
    total: number;
  };
};
```

- `accuracy.total > 0` が常に成り立つ想定（`status='reviewing'` の項目は既に最低1回出題済みのため）。
- 都道府県名（`prefecture`）は従来どおり返却しない（FR-005）。

### 2. `AccuracyPair`（`getItemAccuracyData` の入力キー）

```typescript
type AccuracyPair = { municipalityCode: string; mode: string };
```

現在ページに含まれる行（最大25件）から組み立てる、正答率集計の対象キー一覧。

---

## 新規関数シグネチャ

### `getItemAccuracyData`（`app/(app)/dashboard/queries.ts`）

```typescript
export async function getItemAccuracyData(
  userId: string,
  pairs: { municipalityCode: string; mode: string }[],
): Promise<Map<string, { correct: number; total: number }>>;
```

- キーは `` `${municipalityCode}|${mode}` ``。
- `municipality_quiz_results` を `userId` + `municipalityCode IN (pairs の code 群)` で絞り込み、`municipalityCode, mode` で `GROUP BY` して `COUNT(*)`（total）と `SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)`（correct）を集計する（`getWeaknessRankingData` と同じ SQL パターン）。
- `pairs` が空配列の場合は空の `Map` を返す（クエリを発行しない）。

### `getReviewItemList`（`app/(app)/dashboard/actions.ts`・拡張）

- SELECT に `municipalityCode` を追加。
- `rows`/`totalRow` の取得（既存 `Promise.all`）とは独立して `getItemAccuracyData(userId, rows から組んだ pairs)` を呼び出し、専用の `try/catch` で失敗を吸収する。失敗時は空の `Map` として扱い、全項目の `accuracy` を `undefined` にする（一覧本体の取得・返却は継続、FR-006）。
- 戻り値の各要素に `accuracy` を追加する以外、既存フィールド・既存の呼び出しシグネチャ（`opts.mode`/`opts.limit`/`opts.offset`）は変更しない。

---

## 影響範囲の確認（振る舞い不変を保証する観点）

| 関数 | 変更前 | 変更後 | 期待される差分 |
|------|--------|--------|----------------|
| `getReviewItemList` | `municipalityName`/`mode`/`dueDate`/`repetition`/`interval` を返す | 上記に加え `municipalityCode`・`accuracy` を返す | 既存フィールドの値・順序・ページング挙動に差分なし。追加フィールドのみ |
| `useReviewItemList`（`lib/hooks/useReviewItemList.ts`） | 変更なし | 変更なし | クエリキー・キャッシュ戦略は据え置き。戻り値の型に `accuracy` が増えるのみ |

既存の DB 統合テスト（`__tests__/lib/dashboard/queries-parity.test.ts`）に `getItemAccuracyData` の集計値検証と、`getReviewItemList` の `accuracy` 欠落時フォールバックの検証を追加する。
