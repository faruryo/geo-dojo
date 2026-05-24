// Sync municipality_master from e-Stat 国勢調査 2020 (statsDataId=0003445139).
// Run: pnpm tsx scripts/sync-municipality-master.ts
import { config } from 'dotenv';
config({ path: '.env.local' });

import * as fs from 'fs';
import * as path from 'path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { municipalityMaster, type Difficulty } from '@/lib/db/schema';

const STATS_DATA_ID = '0003445139';
const POPULATION_YEAR = 2020;
const CHUNK_SIZE = 100;     // codes per API call
const THROTTLE_MS = 250;    // ≤ 5 req/sec safety margin

interface Seed { code: string; name: string; prefecture: string; region: string; }
interface EStatValue { '@area': string; '$': string; }
interface MetaClass { '@code': string; '@name': string; '@level'?: string; }
interface MetaClassObj { '@id': string; '@name': string; CLASS: MetaClass | MetaClass[]; }

function calculateDifficulty(input: { name: string; population: number | null }): Difficulty {
  if (input.population !== null) {
    if (input.population >= 100_000) return 'easy';
    if (input.population >= 30_000)  return 'medium';
    if (input.population >= 10_000)  return 'hard';
    return 'expert';
  }
  // Fallback when population is missing
  if (input.name.endsWith('区')) return 'easy';
  if (input.name.endsWith('市')) return 'medium';
  if (input.name.endsWith('町')) return 'hard';
  if (input.name.endsWith('村')) return 'expert';
  return 'medium';
}

// Fetch official municipality names from e-Stat getMetaInfo.
// The 国勢調査 area classification contains proper names including 政令市 ward names
// (e.g. "仙台市　青葉区") which the topojson nam_ja field lacks.
async function fetchMunicipalityNameMap(): Promise<Map<string, string>> {
  const appId = process.env.E_STAT_APP_ID;
  if (!appId) throw new Error('E_STAT_APP_ID not set');

  const url = new URL('https://api.e-stat.go.jp/rest/3.0/app/json/getMetaInfo');
  url.searchParams.set('appId', appId);
  url.searchParams.set('statsDataId', STATS_DATA_ID);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`e-Stat getMetaInfo ${res.status}: ${await res.text()}`);

  const json = await res.json() as {
    GET_META_INFO: {
      RESULT: { STATUS: number; ERROR_MSG: string };
      METADATA_INF?: { CLASS_INF?: { CLASS_OBJ?: MetaClassObj | MetaClassObj[] } };
    };
  };
  const result = json.GET_META_INFO;
  if (result.RESULT.STATUS !== 0) throw new Error(`e-Stat MetaInfo: ${result.RESULT.ERROR_MSG}`);

  const rawObjs = result.METADATA_INF?.CLASS_INF?.CLASS_OBJ ?? [];
  const classObjs: MetaClassObj[] = Array.isArray(rawObjs) ? rawObjs : [rawObjs];

  // Find the area classification by @id='area', or fall back to the one with 5-digit codes.
  let areaObj = classObjs.find((o) => o['@id'] === 'area');
  if (!areaObj) {
    areaObj = classObjs.find((o) => {
      const first = Array.isArray(o.CLASS) ? o.CLASS[0] : o.CLASS;
      return /^\d{5}$/.test(first?.['@code'] ?? '');
    });
  }
  if (!areaObj) {
    console.warn('[sync] area classification not found in e-Stat MetaInfo — names unchanged');
    return new Map();
  }

  const classes: MetaClass[] = Array.isArray(areaObj.CLASS) ? areaObj.CLASS : [areaObj.CLASS];
  const nameMap = new Map<string, string>();
  for (const c of classes) {
    if (!/^\d{5}$/.test(c['@code'])) continue;
    // e-Stat uses full-width space between city and ward name: "仙台市　青葉区" → "仙台市青葉区"
    const name = c['@name'].replace(/[\s　]+/g, '');
    if (name) nameMap.set(c['@code'], name);
  }
  console.log(`[sync] fetched ${nameMap.size} municipality names from e-Stat MetaInfo`);
  return nameMap;
}

async function fetchPopulationChunk(codes: string[]): Promise<Map<string, number>> {
  const appId = process.env.E_STAT_APP_ID;
  if (!appId) throw new Error('E_STAT_APP_ID not set');

  const url = new URL('https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData');
  url.searchParams.set('appId', appId);
  url.searchParams.set('statsDataId', STATS_DATA_ID);
  url.searchParams.set('cdCat01', '0');     // 国籍総数
  url.searchParams.set('cdCat02', '0');     // 男女総数
  url.searchParams.set('cdCat03', '000');   // 年齢総数
  url.searchParams.set('cdArea', codes.join(','));
  url.searchParams.set('metaGetFlg', 'N');
  url.searchParams.set('cntGetFlg', 'N');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`e-Stat API ${res.status}: ${await res.text()}`);
  const json = await res.json() as {
    GET_STATS_DATA: {
      RESULT: { STATUS: number; ERROR_MSG: string };
      STATISTICAL_DATA?: { DATA_INF?: { VALUE?: EStatValue | EStatValue[] } };
    };
  };
  if (json.GET_STATS_DATA.RESULT.STATUS !== 0) {
    throw new Error(`e-Stat error: ${json.GET_STATS_DATA.RESULT.ERROR_MSG}`);
  }

  const raw = json.GET_STATS_DATA.STATISTICAL_DATA?.DATA_INF?.VALUE ?? [];
  const values: EStatValue[] = Array.isArray(raw) ? raw : [raw];
  const out = new Map<string, number>();
  for (const v of values) {
    const n = Number(v.$);
    if (Number.isFinite(n)) out.set(v['@area'], n);
  }
  return out;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  console.log(`[sync] connecting to ${url.replace(/:[^@]+@/, ':***@')}`);
  console.log('[sync] sleeping 3s — Ctrl+C to abort');
  await new Promise((r) => setTimeout(r, 3000));

  const seedPath = path.join(process.cwd(), 'public', 'municipalities.json');
  const rawSeeds: Seed[] = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
  // Filter out N03 GIS残骸: "所属未定地" entries with prefecture-aggregate codes (XX000).
  // These are coastal/boundary placeholders, not real municipalities.
  const seeds = rawSeeds.filter(
    (s) => !/^.{2}000$/.test(s.code) && !s.name.includes('所属未定地'),
  );
  console.log(`[sync] loaded ${seeds.length} municipalities (filtered ${rawSeeds.length - seeds.length} GIS残骸)`);

  // Fetch proper names from e-Stat (fixes 政令市 ward names: "仙台市" → "仙台市青葉区" etc.)
  console.log('[sync] fetching municipality names from e-Stat MetaInfo...');
  const nameMap = await fetchMunicipalityNameMap();
  // Patch municipalities.json in-place so the static file stays consistent with the DB.
  const patchCount = rawSeeds.reduce((n, s) => {
    const proper = nameMap.get(s.code);
    if (proper && proper !== s.name) { s.name = proper; return n + 1; }
    return n;
  }, 0);
  if (patchCount > 0) {
    fs.writeFileSync(seedPath, JSON.stringify(rawSeeds));
    console.log(`[sync] patched ${patchCount} municipality names in municipalities.json`);
  }

  // Fetch populations in chunks
  const populations = new Map<string, number>();
  const allCodes = seeds.map((s) => s.code);
  for (let i = 0; i < allCodes.length; i += CHUNK_SIZE) {
    const chunk = allCodes.slice(i, i + CHUNK_SIZE);
    process.stdout.write(`[sync] fetching ${i + 1}..${i + chunk.length} / ${allCodes.length}\r`);
    try {
      const result = await fetchPopulationChunk(chunk);
      for (const [c, p] of result) populations.set(c, p);
    } catch (e) {
      console.error(`\n[sync] chunk ${i} failed:`, e);
      throw e;
    }
    await new Promise((r) => setTimeout(r, THROTTLE_MS));
  }
  console.log(`\n[sync] population coverage: ${populations.size} / ${seeds.length}`);

  // Upsert into DB
  const client = postgres(url, { prepare: false });
  const db = drizzle(client, { schema: { municipalityMaster } });
  try {
    const counts = { easy: 0, medium: 0, hard: 0, expert: 0 };
    let written = 0;
    for (const s of seeds) {
      const pop = populations.get(s.code) ?? null;
      const difficulty = calculateDifficulty({ name: s.name, population: pop });
      counts[difficulty]++;
      await db
        .insert(municipalityMaster)
        .values({
          code: s.code, name: s.name, prefecture: s.prefecture, region: s.region,
          population: pop,
          populationYear: pop !== null ? POPULATION_YEAR : null,
          difficulty,
        })
        .onConflictDoUpdate({
          target: municipalityMaster.code,
          set: {
            name: s.name, prefecture: s.prefecture, region: s.region,
            population: pop,
            populationYear: pop !== null ? POPULATION_YEAR : null,
            difficulty,
            updatedAt: new Date(),
          },
        });
      written++;
      if (written % 200 === 0) process.stdout.write(`[sync] upserted ${written}/${seeds.length}\r`);
    }
    console.log(`\n[sync] upserted ${written} rows`);
    console.log(`[sync] distribution:`, counts);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('[sync] failed:', e);
  process.exit(1);
});
