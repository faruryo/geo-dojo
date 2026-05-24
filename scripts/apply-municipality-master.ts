// One-off DDL: create municipality_master + indexes + RLS.
// Run once: pnpm tsx scripts/apply-municipality-master.ts
import { config } from 'dotenv';
config({ path: '.env.local' });
import postgres from 'postgres';

const DDL = `
CREATE TABLE IF NOT EXISTS "municipality_master" (
  "code"            text PRIMARY KEY NOT NULL,
  "name"            text NOT NULL,
  "prefecture"      text NOT NULL,
  "region"          text NOT NULL,
  "population"      integer,
  "population_year" integer,
  "difficulty"      text NOT NULL,
  "updated_at"      timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "mm_difficulty_idx" ON "municipality_master" USING btree ("difficulty");
CREATE INDEX IF NOT EXISTS "mm_region_diff_idx" ON "municipality_master" USING btree ("region", "difficulty");

ALTER TABLE "municipality_master" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mm_read_authenticated" ON "municipality_master";
CREATE POLICY "mm_read_authenticated" ON "municipality_master"
  FOR SELECT TO authenticated USING (true);
`;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  console.log(`[apply] connecting to ${url.replace(/:[^@]+@/, ':***@')}`);
  console.log('[apply] sleeping 3s — Ctrl+C to abort');
  await new Promise((r) => setTimeout(r, 3000));

  const sql = postgres(url, { prepare: false });
  try {
    await sql.unsafe(DDL);
    console.log('[apply] DDL applied successfully');
    const rows = await sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'municipality_master'
    `;
    console.log(`[apply] verified: ${rows.length === 1 ? 'OK' : 'NOT FOUND'}`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error('[apply] failed:', e);
  process.exit(1);
});
