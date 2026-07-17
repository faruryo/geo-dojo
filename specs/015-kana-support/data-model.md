# データモデル: 都道府県・市区町村の読み仮名表示

## データ構造 (Entities)

### 1. 都道府県読み仮名マップ (PREFECTURE_KANA)

`lib/quiz/municipality-data.ts` に静的定数として追加。DBテーブルは持たない。

```typescript
export const PREFECTURE_KANA: Record<string, string> = {
  北海道: 'ほっかいどう',
  青森県: 'あおもりけん',
  // ... 47件
};
```

### 2. 市区町村マスタ (municipality_master) — カラム追加

既存テーブルに `kana`（nullable text）を追加する。

```typescript
export const municipalityMaster = pgTable('municipality_master', {
  code:           text('code').primaryKey(),
  name:           text('name').notNull(),
  prefecture:     text('prefecture').notNull(),
  region:         text('region').notNull(),
  population:     integer('population'),
  populationYear: integer('population_year'),
  difficulty:     text('difficulty').notNull(),
  kana:           text('kana'),          // [新規] ひらがな読み。データ未整備の行は null
  updatedAt:      timestamp('updated_at').defaultNow().notNull(),
}, ...);
```

- **nullable な理由**: マイグレーション直後（シード適用前）や将来的にデータ欠落がありうるケースで、既存表示を壊さずグレースフルデグレードするため（FR-005）。
- **値の形式**: ひらがなのみ（例: `さっぽろし`）。文字単位のルビ（各漢字への個別対応）ではなく、名称全体に対する読みをまとめて1文字列として保持する。

### 3. クライアント側 Municipality インターフェース — フィールド追加

```typescript
export interface Municipality {
  code: string;
  name: string;
  prefecture: string;
  region: string;
  difficulty?: Difficulty;
  kana?: string; // [新規] 読み仮名。municipality_master.kana から伝播（未整備なら undefined）
}
```

### 4. 苦手リスト・復習項目一覧の返却型 — フィールド追加

```typescript
// getDueReviewItems (app/(app)/quiz/review/actions.ts)
export type DueReviewItem = {
  municipalityCode: string;
  municipalityName: string;
  prefecture: string;
  mode: 'A' | 'B' | 'C' | 'D';
  interval: number;
  dueDate: string;
  kana?: string; // [新規] municipality_master との JOIN で取得
};

// getReviewItemList (app/(app)/dashboard/actions.ts) の items 要素
{
  municipalityCode: string;
  municipalityName: string;
  mode: string;
  dueDate: string;
  repetition: number;
  interval: number;
  accuracy?: { correct: number; total: number };
  kana?: string; // [新規]
}

// getWeaknessRankingData (app/(app)/dashboard/queries.ts) の返却行
{
  municipalityCode: string;
  municipalityName: string;
  prefecture: string;
  mode: string;
  region: string;
  difficulty: string;
  totalCount: number;
  errorRate: number;
  kana?: string; // [新規] 既存 JOIN の SELECT に追加するのみ
}
```

---

## シード・生成データ

### 1. 生成スクリプト出力: `scripts/data/municipality-kana-seed.json`

```json
{
  "01101": "さっぽろし",
  "01102": "さっぽろし",
  "13103": "みなとく"
}
```

- キー: `municipality_master.code`（政令指定都市の区など同名複数コードは、それぞれ個別にキーを持つ。既存の名寄せ構造は変更しない）
- 値: ひらがな読み1文字列
- 生成元: `scripts/fetch-municipality-kana.ts`。総務省「全国地方公共団体コード」（団体コード6桁の先頭5桁＝JISコード、カナ表記）を取り込み、カタカナ→ひらがなへ決定的変換したもの。欠落コードがあった場合のみAI生成を補助的に使う。

### 2. `import-municipality-kana.ts` への反映

シード JSON を読み込んで `municipality_master.kana` を `code` 単位で `UPDATE` する独立スクリプト。既存の `sync-municipality-master.ts`（e-Stat 名称・人口・difficulty の同期、政令市名をward名で上書きする既知の副作用あり）は変更・実行しない。対応するシードが存在しない `code` は `kana` を `null` のまま残す（FR-005）。

---

## 状態遷移・ライフサイクル

読み仮名データは市区町村の不変属性として扱い、ユーザーの学習状態（SM-2 の `easeFactor`/`interval`/`dueDate` 等）とは独立している。ユーザーごとの状態遷移は発生しない（表示専用データ）。
