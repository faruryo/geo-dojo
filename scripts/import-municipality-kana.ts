// scripts/data/municipality-kana-seed.json を読み込み、municipality_master.kana を
// code 単位で UPDATE する独立スクリプト。
// 既存の sync-municipality-master.ts（政令市名をward名で上書きする既知の副作用がある）
// は変更・実行しない（[[project_sync_ward_name_trap]]）。
// Run: pnpm tsx scripts/import-municipality-kana.ts
import { config } from 'dotenv';
config({ path: '.env.local' });

import * as fs from 'fs';
import * as path from 'path';
import postgres from 'postgres';

const SEED_PATH = path.join(__dirname, 'data', 'municipality-kana-seed.json');

async function main() {
  const seed: Record<string, string> = JSON.parse(fs.readFileSync(SEED_PATH, 'utf-8'));
  const entries = Object.entries(seed);
  console.log(`[import] loaded ${entries.length} codes from ${SEED_PATH}`);

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  const sql = postgres(url, { prepare: false });

  try {
    let updated = 0;
    for (const [code, kana] of entries) {
      const result = await sql`
        UPDATE municipality_master SET kana = ${kana} WHERE code = ${code}
      `;
      updated += result.count;
    }
    console.log(`[import] updated ${updated} / ${entries.length} rows`);

    const [{ count: nullCount }] = await sql<{ count: string }[]>`
      SELECT COUNT(*) FROM municipality_master WHERE kana IS NULL
    `;
    console.log(`[import] municipality_master rows still without kana: ${nullCount}`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error('[import] failed:', e);
  process.exit(1);
});
