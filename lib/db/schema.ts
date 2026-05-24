import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

// ──────────────────────────────────────────────────────
// municipality_quiz_results — 市区町村クイズ正解/不正解記録（苦手優先モード用）
// ──────────────────────────────────────────────────────
export const municipalityQuizResults = pgTable(
  'municipality_quiz_results',
  {
    id:               uuid('id').primaryKey().defaultRandom(),
    userId:           uuid('user_id').notNull(),
    municipalityCode: text('municipality_code').notNull(),
    municipalityName: text('municipality_name').notNull(),
    prefecture:       text('prefecture').notNull(),
    mode:             text('mode').notNull(),
    isCorrect:        boolean('is_correct').notNull(),
    answeredAt:       timestamp('answered_at').defaultNow().notNull(),
  },
  (table) => [
    index('mqr_user_code_idx').on(table.userId, table.municipalityCode),
    index('mqr_user_time_idx').on(table.userId, table.answeredAt),
  ],
);

// ──────────────────────────────────────────────────────
// municipality_master — 市区町村マスタ（e-Stat 国勢調査をバッチ取り込み、難易度バケット付き）
// ──────────────────────────────────────────────────────
export const municipalityMaster = pgTable(
  'municipality_master',
  {
    code:           text('code').primaryKey(),
    name:           text('name').notNull(),
    prefecture:     text('prefecture').notNull(),
    region:         text('region').notNull(),
    population:     integer('population'),
    populationYear: integer('population_year'),
    difficulty:     text('difficulty').notNull(),
    updatedAt:      timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('mm_difficulty_idx').on(table.difficulty),
    index('mm_region_diff_idx').on(table.region, table.difficulty),
  ],
);

// TypeScript 型エクスポート
export type MunicipalityQuizResult = typeof municipalityQuizResults.$inferSelect;
export type NewMunicipalityQuizResult = typeof municipalityQuizResults.$inferInsert;
export type MunicipalityMaster = typeof municipalityMaster.$inferSelect;
export type NewMunicipalityMaster = typeof municipalityMaster.$inferInsert;
export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';
