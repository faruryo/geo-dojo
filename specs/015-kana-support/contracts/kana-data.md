# 契約定義書 (Contracts): kana フィールドのデータ契約

新規の公開APIエンドポイントは追加しない。既存の Server Action / クエリの戻り値型に `kana` フィールドを追加する内部契約を定義する。

## 1. `getMunicipalityMaster()`（既存・無変更）

`app/(app)/quiz/municipality/actions.ts`。`db.select().from(municipalityMaster)` の全列 SELECT のため、`municipality_master.kana` カラム追加のみで自動的に戻り値に含まれる。呼び出し側のシグネチャ・契約に変更はない。

```typescript
// MunicipalityMaster 型（drizzle-orm 推論、schema.ts のカラム追加で自動拡張）
{
  code: string;
  name: string;
  prefecture: string;
  region: string;
  population: number | null;
  populationYear: number | null;
  difficulty: string;
  kana: string | null;       // [新規]
  updatedAt: Date;
}
```

## 2. `getDueReviewItems(opts?)` — 契約拡張

`app/(app)/quiz/review/actions.ts`。`srsRecords` に `municipalityMaster` を `innerJoin`（`srsRecords.municipalityCode = municipalityMaster.code`）で結合し、SELECT 列に `kana` を追加する。

- **後方互換性**: 既存フィールド（`municipalityCode`/`municipalityName`/`prefecture`/`mode`/`interval`/`dueDate`）は変更しない。`kana` は追加フィールドのみ（`string | undefined`）。
- **null 時の扱い**: `municipality_master.kana` が `null` の行は `kana: undefined` として返す（呼び出し側で読み仮名表示を省略する判断材料にする）。

## 3. `getReviewItemList(opts?)` — 契約拡張

`app/(app)/dashboard/actions.ts`。`srsRecords` の SELECT に `municipalityMaster` との JOIN を追加し、`items[].kana` を返却する。既存の `accuracy` フィールドと同様、取得失敗時も一覧表示全体をブロックしない方針（既存の try/catch パターンを踏襲）とする。

## 4. `getWeaknessRankingData(userId)` — 契約拡張

`app/(app)/dashboard/queries.ts`。既存の `municipalityMaster` との `innerJoin` に SELECT 列 `kana` を追加するのみ。`groupBy` にも `municipalityMaster.kana` を追加する必要がある（PostgreSQL の GROUP BY 制約）。

## 5. `PREFECTURE_KANA`（新規・静的定数）

`lib/quiz/municipality-data.ts` からエクスポートする読み取り専用マップ。

```typescript
export const PREFECTURE_KANA: Record<string, string>; // 47件、既存 ALL_PREFECTURES のキーと1:1対応
```

- **整合性ルール**: `Object.keys(PREFECTURE_KANA)` は `ALL_PREFECTURES` と完全に一致しなければならない（テストで担保）。
