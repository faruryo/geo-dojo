# Data Model: GeoDojo MVP（Phase 1）

**Generated**: 2026-05-06
**Source**: spec.md Key Entities + constitution.md セキュリティ制約

## Entity Relationship Diagram

```
supabase.auth.users (Supabase管理)
    │
    ├── 1:N ──→ cards
    │              │
    │              ├── 1:N ──→ annotations
    │              └── 1:1 ──→ srs_records
    │
    └── 1:N ──→ ai_candidates
```

## Drizzle ORM Schema (`lib/db/schema.ts`)

```typescript
import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ──────────────────────────────────────────
// cards
// ユーザーが所有するフラッシュカード
// ──────────────────────────────────────────
export const cards = pgTable('cards', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    uuid('user_id').notNull(),                 // supabase.auth.users.id を参照
  notes:     text('notes'),                             // 特徴説明テキスト
  tags:      text('tags').array().notNull().default([]), // タグ配列（タグ = デッキ）
  imageUrl:  text('image_url'),                         // Supabase Storage URL（ユーザーアップロード画像）
  panoId:    text('pano_id'),                           // Street View pano_id のみ（画像本体は保存禁止）
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ──────────────────────────────────────────
// annotations
// カード画像上のビジュアルマーカー
// ──────────────────────────────────────────
export const annotations = pgTable('annotations', {
  id:     uuid('id').primaryKey().defaultRandom(),
  cardId: uuid('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
  // 相対座標（0.0〜1.0）で保存 — ピクセル座標禁止（憲法 III 条）
  xRatio: real('x_ratio').notNull(),
  yRatio: real('y_ratio').notNull(),
  label:  text('label').notNull(),
});

// ──────────────────────────────────────────
// srs_records
// SRS学習履歴（1カード × 1ユーザー = 1レコード）
// ──────────────────────────────────────────
export const srsRecords = pgTable(
  'srs_records',
  {
    id:           uuid('id').primaryKey().defaultRandom(),
    userId:       uuid('user_id').notNull(),
    cardId:       uuid('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
    dueDate:      timestamp('due_date').notNull().defaultNow(),
    interval:     integer('interval').notNull().default(1),     // 次回まで何日
    easiness:     real('easiness').notNull().default(2.5),       // SM-2 EFactor
    reps:         integer('reps').notNull().default(0),          // 学習回数
    lastRatedAt:  timestamp('last_rated_at'),
  },
  (table) => ({
    // 憲法 II 条：(user_id, due_date) 複合インデックスを常に維持する
    userDueIdx:     index('srs_user_due_idx').on(table.userId, table.dueDate),
    userCardUnique: uniqueIndex('srs_user_card_unique').on(table.userId, table.cardId),
  }),
);

// ──────────────────────────────────────────
// ai_candidates
// AI生成カード候補（HITL承認待ち）
// ──────────────────────────────────────────
export const aiCandidates = pgTable('ai_candidates', {
  id:             uuid('id').primaryKey().defaultRandom(),
  userId:         uuid('user_id').notNull(),
  imageUrl:       text('image_url'),           // 解析対象画像（Supabase Storage URL）
  panoId:         text('pano_id'),             // 元となった Street View pano_id（任意）
  suggestedNotes: text('suggested_notes'),
  suggestedTags:  text('suggested_tags').array().notNull().default([]),
  // 'pending' | 'approved' | 'rejected'
  status:         text('status').notNull().default('pending'),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
});

// 型エクスポート（TypeScript型推論用）
export type Card         = typeof cards.$inferSelect;
export type NewCard      = typeof cards.$inferInsert;
export type Annotation   = typeof annotations.$inferSelect;
export type SrsRecord    = typeof srsRecords.$inferSelect;
export type AiCandidate  = typeof aiCandidates.$inferSelect;
```

## テーブル設計の補足

### cards.imageUrl vs cards.panoId

| フィールド | 用途 | 保存するもの |
|-----------|------|------------|
| `image_url` | ユーザーがアップロードしたスクリーンショット | Supabase Storage の公開 URL |
| `pano_id` | Street View の位置参照 | pano_id 文字列のみ（画像本体は保存禁止） |

どちらか一方または両方を持てる。Street View 画像を表示する際は `/api/image-proxy?pano_id=xxx` を経由。

### tags[] = デッキ

`tags` 配列がデッキ機能を代替する。「デッキ」は tags の filter ビューとして実装する。

| タグ種別 | 例 | 付与方法 |
|---------|----|---------| 
| システム（都道府県） | `北海道`, `東京都` | AI生成または手動カード作成時に自動推定 |
| システム（地方） | `東北`, `関東`, `九州` | 都道府県タグから自動導出 |
| システム（特徴） | `電柱`, `看板`, `道路標識` | AI生成時に提案 |
| ユーザー任意 | `お気に入り`, `苦手` | ユーザーが自由に追加 |

### srs_records の設計

- 1ユーザー × 1カード = 1 srs_record（`UNIQUE(user_id, card_id)`）
- カードが削除された場合は `ON DELETE CASCADE` で自動削除
- `due_date <= NOW()` で当日の学習対象を効率的に取得
  （`srs_user_due_idx` インデックスにより高速化）

## Supabase RLS ポリシー（必須）

```sql
-- cards テーブル: 自分のカードのみ操作可能
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cards_own" ON cards
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- annotations テーブル: 自分のカードに紐づくもののみ
ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "annotations_own" ON annotations
  USING (card_id IN (SELECT id FROM cards WHERE user_id = auth.uid()));

-- srs_records テーブル: 自分のレコードのみ
ALTER TABLE srs_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "srs_own" ON srs_records
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ai_candidates テーブル: 自分の候補のみ
ALTER TABLE ai_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_candidates_own" ON ai_candidates
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

## 主要クエリパターン

```sql
-- 当日の学習対象カードを取得（インデックス使用）
SELECT c.*, s.*
FROM srs_records s
JOIN cards c ON c.id = s.card_id
WHERE s.user_id = $userId
  AND s.due_date <= NOW()
ORDER BY s.due_date ASC
LIMIT 20;

-- タグ絞り込みでカード一覧
SELECT * FROM cards
WHERE user_id = $userId
  AND tags @> ARRAY[$tag]::text[]
ORDER BY created_at DESC;

-- AI候補の未レビュー件数
SELECT COUNT(*) FROM ai_candidates
WHERE user_id = $userId AND status = 'pending';
```
