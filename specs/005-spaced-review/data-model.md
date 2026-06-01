# Phase 1 Data Model: 科学的間隔反復による間違い復習

## 新規テーブル: `srs_records`

復習対象（Review Item）= ある学習者の (市区町村コード, 出題モード) ごとの SM-2 学習状態。憲法 II の `srs_records (user_id, due_date)` 規定に準拠。

### Drizzle 定義（`lib/db/schema.ts` に追加）

```ts
export const srsRecords = pgTable(
  'srs_records',
  {
    id:               uuid('id').primaryKey().defaultRandom(),
    userId:           uuid('user_id').notNull(),
    municipalityCode: text('municipality_code').notNull(),
    municipalityName: text('municipality_name').notNull(),
    prefecture:       text('prefecture').notNull(),
    mode:             text('mode').notNull(),            // 'A' | 'B' | 'C' | 'D'
    easeFactor:       real('ease_factor').notNull().default(2.5),
    repetition:       integer('repetition').notNull().default(0),
    interval:         integer('interval').notNull().default(0),   // 日数
    dueDate:          timestamp('due_date', { withTimezone: true }).notNull().defaultNow(),
    lastReviewedAt:   timestamp('last_reviewed_at', { withTimezone: true }),
    status:           text('status').notNull().default('reviewing'), // 'reviewing' | 'graduated'
    createdAt:        timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    // 期日クエリ用（憲法 II 必須）
    index('srs_user_due_idx').on(table.userId, table.dueDate),
    // (user, code, mode) 一意 — 復習対象の重複防止 & upsert ターゲット
    uniqueIndex('srs_user_code_mode_uidx').on(table.userId, table.municipalityCode, table.mode),
    // status 別件数の集計用
    index('srs_user_status_idx').on(table.userId, table.status),
  ],
);

export type SrsRecord = typeof srsRecords.$inferSelect;
export type NewSrsRecord = typeof srsRecords.$inferInsert;
export type SrsStatus = 'reviewing' | 'graduated';
```

### フィールド仕様

| フィールド | 型 | 説明 | 制約 |
|-----------|----|------|------|
| `id` | uuid | 主キー | default random |
| `userId` | uuid | 学習者 | not null, RLS スコープ |
| `municipalityCode` | text | 市区町村コード | not null |
| `municipalityName` | text | 表示用名称（最新ログ採用） | not null |
| `prefecture` | text | 都道府県 | not null |
| `mode` | text | 出題モード A/B/C/D | not null |
| `easeFactor` | real | SM-2 難易度係数 | default 2.5, 下限 1.3（アプリ層でクランプ） |
| `repetition` | int | 連続正解回数 | default 0, >=0 |
| `interval` | int | 現在の間隔（日） | default 0, >=0 |
| `dueDate` | timestamptz | 次回復習期日 | default now |
| `lastReviewedAt` | timestamptz | 最終 SM-2 更新日時（同日ガード用） | nullable |
| `status` | text | reviewing / graduated | default 'reviewing' |
| `createdAt` | timestamptz | 登録日時 | default now |

### 一意性・関係

- 一意キー: `(userId, municipalityCode, mode)`。これが復習対象の同一性（FR-002）。
- `municipalityCode` は `municipality_master.code` と論理的に対応（FK は張らない／既存 `municipality_quiz_results` と同方針）。
- 1 `userId` : 多 `srs_records`。

## 状態遷移

```text
        ┌─────────────── 新規登録(誤答 or 初回正解) ───────────────┐
        ▼                                                          │
   [reviewing] ──正解(q=4, JST同日1回まで前進)──▶ interval拡大       │
        │  ▲                                                       │
   不正解│  │正解で interval>=30日 かつ repetition>=4               │
 (q=2)   │  └───────────────────────────────┐                     │
 rep=0   │                                   ▼                     │
 int=1   │                              [graduated] ──不正解──┐     │
 due=now │                            (due/件数から除外)       │     │
        │                                                     │     │
        └───────────◀──── reviewing へ復帰(rep=0,int=1,due=now)◀────┘
                         EF は引き継ぐ
```

- **登録**: 誤答時（FR-001）または初回正解時（FR-005a で前進対象のため upsert）。バックフィルは導入時一括（FR-001a, due=now）。
- **前進**（reviewing, 正解, 同日未前進）: SM-2 で repetition/interval/EF 更新、due 再計算。
- **リセット**（reviewing, 不正解）: repetition=0, interval=1, due=翌日, EF 減算。
- **卒業**（reviewing → graduated）: 正解前進後 interval>=30 かつ repetition>=4。
- **復帰**（graduated → reviewing）: 不正解で rep=0/int=1/due=now、EF 据置。

## SM-2 純粋ロジック型（`lib/quiz/srs/types.ts`）

```ts
export type ReviewQuality = 2 | 4;            // 不正解=2, 正解=4（二値固定）

export interface SrsState {
  easeFactor: number;
  repetition: number;
  interval: number;   // 日
  status: SrsStatus;
}

export interface SrsUpdateResult extends SrsState {
  dueInDays: number;  // now からの日数（due_date = now + dueInDays）
  graduated: boolean; // この更新で卒業したか
}
```

- `applySm2(state: SrsState, quality: ReviewQuality): SrsUpdateResult` — 副作用なし。
- `scheduler.ts`: `isDue(dueDate, now)`, `shouldGraduate(interval, repetition)`, `alreadyAdvancedToday(lastReviewedAt, now)`。

## 既存テーブルへの影響

- `municipality_quiz_results`: **スキーマ変更なし**。復習セッションの回答もこのテーブルへ通常どおり INSERT（FR-011a）。SM-2 更新の入力源・バックフィルの元データ。
- `municipality_master`: 変更なし（distractor / 難易度の参照のみ）。

## マイグレーション（`supabase/migrations/XXXX_srs_records.sql`）

1. `CREATE TABLE srs_records ...`（drizzle-kit generate 出力）+ 各 index。
2. RLS 有効化 + ポリシー（`user_id = auth.uid()` の SELECT/INSERT/UPDATE/DELETE）を手動同梱（既存方針）。
3. バックフィル: `INSERT INTO srs_records (user_id, municipality_code, municipality_name, prefecture, mode, ease_factor, repetition, interval, due_date, status) SELECT ... FROM municipality_quiz_results GROUP BY user_id, municipality_code, mode HAVING SUM(CASE WHEN NOT is_correct THEN 1 ELSE 0 END) > 0` （name/prefecture は最新ログ、due=now、status='reviewing'）。`ON CONFLICT (user_id, municipality_code, mode) DO NOTHING`。
