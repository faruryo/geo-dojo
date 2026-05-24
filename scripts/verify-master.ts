// Throwaway verification — run after sync to sanity-check distribution.
import { config } from 'dotenv';
config({ path: '.env.local' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

(async () => {
  for (const d of ['easy', 'medium', 'hard', 'expert']) {
    const rows = await sql`
      SELECT code, name, prefecture, population
      FROM municipality_master
      WHERE difficulty = ${d}
      ORDER BY population DESC NULLS LAST
      LIMIT 3
    `;
    console.log(`\n=== ${d} (top by population) ===`);
    for (const r of rows) console.log(`  ${r.code} ${r.name}(${r.prefecture}) pop=${r.population}`);
  }
  const missing = await sql`
    SELECT code, name, prefecture FROM municipality_master WHERE population IS NULL
  `;
  console.log(`\n=== population NULL (${missing.length} rows) ===`);
  for (const r of missing) console.log(`  ${r.code} ${r.name}(${r.prefecture})`);
  await sql.end();
})();
