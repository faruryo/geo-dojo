// One-off cleanup: remove "所属未定地" GIS残骸 from municipality_master.
import { config } from 'dotenv';
config({ path: '.env.local' });
import postgres from 'postgres';

async function main(url: string) {
  const sql = postgres(url, { prepare: false });
  try {
    const deleted = await sql`
      DELETE FROM municipality_master
      WHERE code ~ '^.{2}000$' OR name LIKE '%所属未定地%'
      RETURNING code, name, prefecture
    `;
    console.log(`Deleted ${deleted.length} rows:`);
    for (const r of deleted) console.log(`  ${r.code} ${r.name}(${r.prefecture})`);
  } finally {
    await sql.end();
  }
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL not set');

main(databaseUrl).catch((error: unknown) => {
  console.error('[cleanup] failed:', error);
  process.exitCode = 1;
});
