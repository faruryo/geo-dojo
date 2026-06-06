// Read-only diagnostic for srs_records state on production.
// Prints only aggregates / non-PII timestamps. No secrets echoed.
import 'dotenv/config';
import postgres from 'postgres';
import { config } from 'dotenv';
config({ path: '.env.prod.local', override: true });

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

const fmt = (d) => (d ? new Date(d).toISOString() : 'null');

try {
  const total = await sql`SELECT count(*)::int n FROM srs_records`;
  console.log('total srs_records:', total[0].n);

  const byStatus = await sql`SELECT status, count(*)::int n FROM srs_records GROUP BY status`;
  console.log('by status:', byStatus.map((r) => `${r.status}=${r.n}`).join(', '));

  const dueNow = await sql`SELECT count(*)::int n FROM srs_records WHERE status='reviewing' AND due_date <= now()`;
  console.log('due now (reviewing & due<=now):', dueNow[0].n);

  const reviewedToday = await sql`SELECT count(*)::int n FROM srs_records WHERE last_reviewed_at IS NOT NULL`;
  console.log('records with last_reviewed_at NOT NULL:', reviewedToday[0].n);

  const recent = await sql`
    SELECT municipality_name, mode, repetition, interval, status,
           due_date, last_reviewed_at, created_at
    FROM srs_records
    WHERE last_reviewed_at IS NOT NULL
    ORDER BY last_reviewed_at DESC
    LIMIT 10`;
  console.log('\n-- most recently reviewed 10 --');
  for (const r of recent) {
    console.log(
      `${r.municipality_name}(${r.mode}) rep=${r.repetition} int=${r.interval} ${r.status} due=${fmt(r.due_date)} lastRev=${fmt(r.last_reviewed_at)}`,
    );
  }

  const dueSample = await sql`
    SELECT municipality_name, mode, interval, due_date, last_reviewed_at
    FROM srs_records
    WHERE status='reviewing' AND due_date <= now()
    ORDER BY due_date ASC, interval ASC
    LIMIT 25`;
  console.log('\n-- top 25 due (query order used by getDueReviewItems) --');
  for (const r of dueSample) {
    console.log(
      `${r.municipality_name}(${r.mode}) int=${r.interval} due=${fmt(r.due_date)} lastRev=${fmt(r.last_reviewed_at)}`,
    );
  }

  // distinct due_date values among due records — are they all identical (backfill now())?
  const distinctDue = await sql`
    SELECT count(DISTINCT due_date)::int d, min(due_date) mn, max(due_date) mx
    FROM srs_records WHERE status='reviewing' AND due_date <= now()`;
  console.log('\ndistinct due_date among due:', distinctDue[0].d, 'min=', fmt(distinctDue[0].mn), 'max=', fmt(distinctDue[0].mx));

  // ── Are quiz results being written AT ALL right now? ──
  const qr = await sql`
    SELECT count(*)::int total,
           max(answered_at) latest,
           count(*) FILTER (WHERE answered_at >= now() - interval '2 days')::int last2d
    FROM municipality_quiz_results`;
  console.log('\n-- municipality_quiz_results --');
  console.log('total:', qr[0].total, '| latest answered_at:', fmt(qr[0].latest), '| rows in last 2 days:', qr[0].last2d);
} finally {
  await sql.end();
}
