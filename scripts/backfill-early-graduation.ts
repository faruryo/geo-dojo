// 誤答なし市区町村の早期卒業バックフィル: 既存の srs_records のうち
// 「status='reviewing' かつ repetition>=2 かつ誤答履歴なし」を graduated に一括更新する。
// 冪等（再実行しても既に graduated の行は対象外・結果不変）。DELETE/INSERT なし。
// Run: DATABASE_URL=... pnpm tsx scripts/backfill-early-graduation.ts
import { config } from 'dotenv';
config({ path: '.env.local' });
import postgres from 'postgres';

const CANDIDATE_PREDICATE = `
  s.status = 'reviewing' AND s.repetition >= 2
  AND NOT EXISTS (
    SELECT 1 FROM municipality_quiz_results q
    WHERE q.user_id = s.user_id AND q.municipality_code = s.municipality_code
      AND q.mode = s.mode AND q.is_correct = false
  )
`;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  console.log(`[backfill] connecting to ${url.replace(/:[^@]+@/, ':***@')}`);

  const sql = postgres(url, { prepare: false });
  try {
    const [{ count: candidateCount }] = await sql.unsafe<{ count: number }[]>(`
      SELECT CAST(COUNT(*) AS int) AS count FROM srs_records s WHERE ${CANDIDATE_PREDICATE}
    `);
    console.log(`[backfill] candidates: ${candidateCount}`);

    const updated = await sql.unsafe(`
      UPDATE srs_records s SET status = 'graduated'
      WHERE ${CANDIDATE_PREDICATE}
    `);
    console.log(`[backfill] updated: ${updated.count}`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error('[backfill] failed:', e);
  process.exit(1);
});
