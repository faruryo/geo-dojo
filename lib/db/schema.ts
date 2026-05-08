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
import { sql } from 'drizzle-orm';

// ──────────────────────────────────────────────────────
// cards — フラッシュカード（学習の基本単位）
// ──────────────────────────────────────────────────────
export const cards = pgTable(
  'cards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    notes: text('notes'),
    tags: text('tags').array().notNull().default([]),
    imageUrl: text('image_url'),
    panoId: text('pano_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    // RLS フィルタ用（全ポリシーが user_id で絞り込む）
    index('cards_user_id_idx').on(table.userId),
    // GIN インデックス（tags @> 検索）は Supabase SQL Editor で手動適用:
    // CREATE INDEX CONCURRENTLY cards_tags_gin_idx ON cards USING gin(tags);
  ],
);

// ──────────────────────────────────────────────────────
// annotations — 相対座標マーカー（憲法 III 条）
// ──────────────────────────────────────────────────────
export const annotations = pgTable(
  'annotations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cardId: uuid('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    xRatio: real('x_ratio').notNull(),
    yRatio: real('y_ratio').notNull(),
    label: text('label').notNull(),
  },
  (table) => [
    // Postgres は FK に自動インデックスを作らないため明示的に追加
    index('annotations_card_id_idx').on(table.cardId),
  ],
);

// ──────────────────────────────────────────────────────
// srs_records — SRS 学習履歴
// ──────────────────────────────────────────────────────
export const srsRecords = pgTable(
  'srs_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    cardId: uuid('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    dueDate: timestamp('due_date').notNull().defaultNow(),
    interval: integer('interval').notNull().default(1),
    easiness: real('easiness').notNull().default(2.5),
    reps: integer('reps').notNull().default(0),
    lastRatedAt: timestamp('last_rated_at'),
  },
  (table) => [
    // 憲法 II 条: (user_id, due_date) 複合インデックスを常に維持する
    index('srs_user_due_idx').on(table.userId, table.dueDate),
    uniqueIndex('srs_user_card_unique').on(table.userId, table.cardId),
  ],
);

// ──────────────────────────────────────────────────────
// ai_candidates — AI 生成カード候補（HITL 承認待ち）
// ──────────────────────────────────────────────────────
export const aiCandidates = pgTable(
  'ai_candidates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    imageUrl: text('image_url'),
    panoId: text('pano_id'),
    suggestedNotes: text('suggested_notes'),
    suggestedTags: text('suggested_tags').array().notNull().default([]),
    status: text('status').notNull().default('pending'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    // RLS フィルタ用
    index('ai_candidates_user_id_idx').on(table.userId),
    // (user_id, status) で pending/processing 絞り込みを高速化
    index('ai_candidates_user_status_idx').on(table.userId, table.status),
  ],
);

// TypeScript 型エクスポート
export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
export type Annotation = typeof annotations.$inferSelect;
export type NewAnnotation = typeof annotations.$inferInsert;
export type SrsRecord = typeof srsRecords.$inferSelect;
export type NewSrsRecord = typeof srsRecords.$inferInsert;
export type AiCandidate = typeof aiCandidates.$inferSelect;
export type NewAiCandidate = typeof aiCandidates.$inferInsert;
