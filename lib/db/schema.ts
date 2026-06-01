import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  real,
  timestamp,
  index,
  uniqueIndex,
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

// ──────────────────────────────────────────────────────
// srs_records — SM-2 間隔反復の学習状態（市区町村×モード単位）
// ──────────────────────────────────────────────────────
export const srsRecords = pgTable(
  'srs_records',
  {
    id:               uuid('id').primaryKey().defaultRandom(),
    userId:           uuid('user_id').notNull(),
    municipalityCode: text('municipality_code').notNull(),
    municipalityName: text('municipality_name').notNull(),
    prefecture:       text('prefecture').notNull(),
    mode:             text('mode').notNull(),
    easeFactor:       real('ease_factor').notNull().default(2.5),
    repetition:       integer('repetition').notNull().default(0),
    interval:         integer('interval').notNull().default(0),
    dueDate:          timestamp('due_date', { withTimezone: true }).notNull().defaultNow(),
    lastReviewedAt:   timestamp('last_reviewed_at', { withTimezone: true }),
    status:           text('status').notNull().default('reviewing'),
    createdAt:        timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('srs_user_due_idx').on(table.userId, table.dueDate),
    uniqueIndex('srs_user_code_mode_uidx').on(table.userId, table.municipalityCode, table.mode),
    index('srs_user_status_idx').on(table.userId, table.status),
  ],
);

// TypeScript 型エクスポート
export type SrsRecord = typeof srsRecords.$inferSelect;
export type NewSrsRecord = typeof srsRecords.$inferInsert;
export type SrsStatus = 'reviewing' | 'graduated';

export type MunicipalityQuizResult = typeof municipalityQuizResults.$inferSelect;
export type NewMunicipalityQuizResult = typeof municipalityQuizResults.$inferInsert;
export type MunicipalityMaster = typeof municipalityMaster.$inferSelect;
export type NewMunicipalityMaster = typeof municipalityMaster.$inferInsert;
export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';
