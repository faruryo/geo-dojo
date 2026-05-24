// One-off cleanup: remove "所属未定地" GIS残骸 from municipality_master.
import { config } from 'dotenv';
config({ path: '.env.local' });
import postgres from 'postgres';

(async () => {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
  const deleted = await sql`
    DELETE FROM municipality_master
    WHERE code ~ '^.{2}000$' OR name LIKE '%所属未定地%'
    RETURNING code, name, prefecture
  `;
  console.log(`Deleted ${deleted.length} rows:`);
  for (const r of deleted) console.log(`  ${r.code} ${r.name}(${r.prefecture})`);
  await sql.end();
})();
