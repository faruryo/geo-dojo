# Data Model: GeoDojo MVP（Phase 1）

> v0.2.0 でカード/SRS/AI テーブル (cards, annotations, srs_records, ai_candidates) を削除。

**Generated**: 2026-05-06
**Source**: spec.md Key Entities + constitution.md セキュリティ制約

## Entity Relationship Diagram

```
supabase.auth.users (Supabase管理)
    │
    └── 1:N ──→ municipality_quiz_results

municipality_master (静的マスタ / service_role のみ書き込み)
```

## Drizzle ORM Schema (`lib/db/schema.ts`)

```typescript
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

// ──────────────────────────────────────────
// municipality_quiz_results
// 市区町村クイズの正解/不正解記録（苦手優先モード用）
// ──────────────────────────────────────────
export const municipalityQuizResults = pgTable(
  'municipality_quiz_results',
  {
    id:               uuid('id').primaryKey().defaultRandom(),
    userId:           uuid('user_id').notNull(),
    municipalityCode: text('municipality_code').notNull(), // 行政区域コード（同名市区町村を区別）
    municipalityName: text('municipality_name').notNull(),
    prefecture:       text('prefecture').notNull(),
    mode:             text('mode').notNull(),              // 'A'|'B'|'C'|'D'
    isCorrect:        boolean('is_correct').notNull(),
    answeredAt:       timestamp('answered_at').defaultNow().notNull(),
  },
  (table) => ({
    userCodeIdx: index('mqr_user_code_idx').on(table.userId, table.municipalityCode),
    userTimeIdx: index('mqr_user_time_idx').on(table.userId, table.answeredAt),
  }),
);

// ──────────────────────────────────────────
// municipality_master
// 全市区町村の静的＋派生メタデータ（e-Stat 国勢調査をバッチ取り込み）
// ──────────────────────────────────────────
export const municipalityMaster = pgTable(
  'municipality_master',
  {
    code:           text('code').primaryKey(),         // 団体コード 5桁
    name:           text('name').notNull(),
    prefecture:     text('prefecture').notNull(),
    region:         text('region').notNull(),
    population:     integer('population'),              // nullable: 取得失敗時・新設合併直後など
    populationYear: integer('population_year'),         // 統計年（例: 2020 = 国勢調査令和2年）
    difficulty:     text('difficulty').notNull(),       // 'easy'|'medium'|'hard'|'expert'
    updatedAt:      timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    difficultyIdx: index('mm_difficulty_idx').on(table.difficulty),
    regionDiffIdx: index('mm_region_diff_idx').on(table.region, table.difficulty),
  }),
);

// 型エクスポート（TypeScript型推論用）
export type MunicipalityQuizResult  = typeof municipalityQuizResults.$inferSelect;
export type MunicipalityMaster      = typeof municipalityMaster.$inferSelect;
export type Difficulty              = 'easy' | 'medium' | 'hard' | 'expert';
```

## テーブル設計の補足

### municipality_quiz_results の設計

- 1 レコード = 1 回の回答（同一市区町村に複数回答えても INSERT）
- 苦手集計は直近 N 件でウィンドウを切って計算する（全件スキャン回避）
- `municipality_code` は行政区域コード（5桁）で同名市区町村（例: 府中市）を区別する
- 同名市区町村を全選択させるモードAでは、各選択につき 1 レコード INSERT する

### Supabase RLS（追加）

```sql
ALTER TABLE municipality_quiz_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mqr_own" ON municipality_quiz_results
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- municipality_master: 認証ユーザーは全件読み取り可能、書き込みは service_role のみ（バッチ用）
ALTER TABLE municipality_master ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mm_read_authenticated" ON municipality_master
  FOR SELECT TO authenticated USING (true);
-- INSERT/UPDATE/DELETE は明示的ポリシーなし → service_role キーを使うバッチのみ書き込み可能
```

### municipality_master の設計

- 1 レコード = 1 市区町村（`code` が PK、約1,900件）
- `population` は nullable: 平成大合併後の新設自治体や政令指定都市の区など、e-Stat で個別取得できないものを許容
- `difficulty` は **server-side で焼き込み**: バケット境界変更時はバッチを再実行
- バッチ取り込み時の処理順:
  1. `public/municipalities.json` を読み取り、code/name/prefecture/region をシード
  2. e-Stat API から人口取得（同一 code で突合）
  3. population または name 種別（市/町/村/区）から difficulty を計算
  4. `INSERT ... ON CONFLICT (code) DO UPDATE` で upsert
- バッチは `SUPABASE_SECRET_KEY`（service_role）で接続して RLS をバイパス

### Difficulty 計算ロジック

```ts
function calculateDifficulty(input: { code: string; name: string; population: number | null }): Difficulty {
  // Phase 2: 人口がある場合は人口ベース
  if (input.population !== null) {
    if (input.population >= 100_000) return 'easy';
    if (input.population >= 30_000)  return 'medium';
    if (input.population >= 10_000)  return 'hard';
    return 'expert';
  }
  // Phase 1 / fallback: 名称末尾ベース
  if (input.name.endsWith('区')) return 'easy';     // 政令指定都市の区
  if (input.name.endsWith('市')) return 'medium';
  if (input.name.endsWith('町')) return 'hard';
  if (input.name.endsWith('村')) return 'expert';
  return 'medium'; // 想定外パターンの安全側デフォルト
}
```

### 苦手優先クエリパターン

```sql
-- 市区町村ごとの直近100件における不正解率
SELECT municipality_code, municipality_name, prefecture,
       COUNT(*) FILTER (WHERE NOT is_correct)::float / COUNT(*) AS error_rate
FROM municipality_quiz_results
WHERE user_id = $userId
GROUP BY municipality_code, municipality_name, prefecture
ORDER BY error_rate DESC;
```

