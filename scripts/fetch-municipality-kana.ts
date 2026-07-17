// 総務省「全国地方公共団体コード」から都道府県・市区町村の読み仮名を取り込み、
// municipality_master.kana 用のシード JSON を生成する一回限りのツール。
// Run: pnpm tsx scripts/fetch-municipality-kana.ts
import { config } from 'dotenv';
config({ path: '.env.local' });

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import postgres from 'postgres';
import { ALL_PREFECTURES } from '@/lib/quiz/municipality-data';

const SOURCE_URL = 'https://www.soumu.go.jp/main_content/000925835.xlsx';
const OUT_PATH = path.join(__dirname, 'data', 'municipality-kana-seed.json');

// ─── 半角カタカナ → 全角カタカナ → ひらがな（決定的変換） ──────────────

const HALFWIDTH_TO_FULLWIDTH_BASE: Record<string, string> = {
  '｡': '。', '｢': '「', '｣': '」', '､': '、', '･': '・',
  'ｦ': 'ヲ', 'ｧ': 'ァ', 'ｨ': 'ィ', 'ｩ': 'ゥ', 'ｪ': 'ェ', 'ｫ': 'ォ',
  'ｬ': 'ャ', 'ｭ': 'ュ', 'ｮ': 'ョ', 'ｯ': 'ッ', 'ｰ': 'ー',
  'ｱ': 'ア', 'ｲ': 'イ', 'ｳ': 'ウ', 'ｴ': 'エ', 'ｵ': 'オ',
  'ｶ': 'カ', 'ｷ': 'キ', 'ｸ': 'ク', 'ｹ': 'ケ', 'ｺ': 'コ',
  'ｻ': 'サ', 'ｼ': 'シ', 'ｽ': 'ス', 'ｾ': 'セ', 'ｿ': 'ソ',
  'ﾀ': 'タ', 'ﾁ': 'チ', 'ﾂ': 'ツ', 'ﾃ': 'テ', 'ﾄ': 'ト',
  'ﾅ': 'ナ', 'ﾆ': 'ニ', 'ﾇ': 'ヌ', 'ﾈ': 'ネ', 'ﾉ': 'ノ',
  'ﾊ': 'ハ', 'ﾋ': 'ヒ', 'ﾌ': 'フ', 'ﾍ': 'ヘ', 'ﾎ': 'ホ',
  'ﾏ': 'マ', 'ﾐ': 'ミ', 'ﾑ': 'ム', 'ﾒ': 'メ', 'ﾓ': 'モ',
  'ﾔ': 'ヤ', 'ﾕ': 'ユ', 'ﾖ': 'ヨ',
  'ﾗ': 'ラ', 'ﾘ': 'リ', 'ﾙ': 'ル', 'ﾚ': 'レ', 'ﾛ': 'ロ',
  'ﾜ': 'ワ', 'ﾝ': 'ン',
};

// 濁点（ﾞ）が付くと変化する行（カ・サ・タ・ハ行 + ウ→ヴ）
const DAKUTEN_MAP: Record<string, string> = {
  'カ': 'ガ', 'キ': 'ギ', 'ク': 'グ', 'ケ': 'ゲ', 'コ': 'ゴ',
  'サ': 'ザ', 'シ': 'ジ', 'ス': 'ズ', 'セ': 'ゼ', 'ソ': 'ゾ',
  'タ': 'ダ', 'チ': 'ヂ', 'ツ': 'ヅ', 'テ': 'デ', 'ト': 'ド',
  'ハ': 'バ', 'ヒ': 'ビ', 'フ': 'ブ', 'ヘ': 'ベ', 'ホ': 'ボ',
  'ウ': 'ヴ',
};

// 半濁点（ﾟ）が付くと変化する行（ハ行のみ）
const HANDAKUTEN_MAP: Record<string, string> = {
  'ハ': 'パ', 'ヒ': 'ピ', 'フ': 'プ', 'ヘ': 'ペ', 'ホ': 'ポ',
};

function halfwidthKatakanaToFullwidth(input: string): string {
  const chars = [...input];
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const base = HALFWIDTH_TO_FULLWIDTH_BASE[ch];
    if (base === undefined) {
      out += ch; // 変換表にない文字（英数字など）はそのまま
      continue;
    }
    const next = chars[i + 1];
    if (next === 'ﾞ' && DAKUTEN_MAP[base]) {
      out += DAKUTEN_MAP[base];
      i++;
    } else if (next === 'ﾟ' && HANDAKUTEN_MAP[base]) {
      out += HANDAKUTEN_MAP[base];
      i++;
    } else {
      out += base;
    }
  }
  return out;
}

function fullwidthKatakanaToHiragana(input: string): string {
  let out = '';
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    // カタカナ ァ(U+30A1)～ヶ(U+30F6) は +0x60 でひらがなに1:1対応する
    // （長音記号ー U+30FCはひらがなに対応がないためそのまま残す）。
    if (code >= 0x30a1 && code <= 0x30f6) {
      out += String.fromCodePoint(code - 0x60);
    } else {
      out += ch;
    }
  }
  return out;
}

function toHiragana(halfwidthKatakana: string): string {
  return fullwidthKatakanaToHiragana(halfwidthKatakanaToFullwidth(halfwidthKatakana));
}

// ─── 総務省データの取得・解析 ──────────────────────────────────────

interface SoumuRow {
  code6: string;
  prefectureKanji: string;
  municipalityKanji: string | null;
  prefectureKanaHalf: string;
  municipalityKanaHalf: string | null;
}

async function fetchSoumuRows(): Promise<SoumuRow[]> {
  console.log(`[fetch] downloading ${SOURCE_URL}`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`download failed: ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());

  const wb = XLSX.read(buf, { type: 'buffer' });
  // 「現在の団体」シート（都道府県・市区町村の基本表）を使う。政令指定都市の区は
  // 別シートに個別収録されているが、municipality_master は区コードでも名称を
  // 市名のまま保持しているため（例: code=01101 でも name="札幌市"）、
  // 名称+都道府県のペアで突合する本スクリプトでは市レベルの読みで十分・一致する。
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false });

  return rows.slice(1)
    .filter((r) => r[0])
    .map((r) => ({
      code6: String(r[0]),
      prefectureKanji: String(r[1] ?? ''),
      municipalityKanji: r[2] ? String(r[2]) : null,
      prefectureKanaHalf: String(r[3] ?? ''),
      municipalityKanaHalf: r[4] ? String(r[4]) : null,
    }));
}

// 総務省データと municipality_master（e-Stat 由来）とで異体字表記が異なり、
// 名称+都道府県の突合が外れる既知のケース（読みは同一・確認済み）。
// 例: 高知県 檮原町（municipality_master）＝ 総務省データの「梼原町」（異体字違い）。
const KNOWN_KANJI_VARIANT_OVERRIDES: Record<string, string> = {
  '檮原町::高知県': 'ゆすはらちょう',
};

async function main() {
  const rows = await fetchSoumuRows();
  console.log(`[fetch] parsed ${rows.length} rows`);

  // 都道府県読み（47件）: 市区町村名が空の行 = 都道府県そのものの行
  const prefectureKana: Record<string, string> = {};
  // 市区町村読み: 「名称::都道府県」をキーに持つ（政令市区は市レベルの1行のみ収録）
  const municipalityKanaByNamePref = new Map<string, string>();

  for (const r of rows) {
    if (!r.municipalityKanji) {
      prefectureKana[r.prefectureKanji] = toHiragana(r.prefectureKanaHalf);
    } else if (r.municipalityKanaHalf) {
      municipalityKanaByNamePref.set(
        `${r.municipalityKanji}::${r.prefectureKanji}`,
        toHiragana(r.municipalityKanaHalf),
      );
    }
  }

  const missingPrefectures = ALL_PREFECTURES.filter((p) => !prefectureKana[p]);
  if (missingPrefectures.length > 0) {
    console.warn(`[fetch] WARNING: missing prefecture kana for: ${missingPrefectures.join(', ')}`);
  } else {
    console.log(`[fetch] all 47 prefectures matched`);
  }

  console.log('[fetch] PREFECTURE_KANA (lib/quiz/municipality-data.ts へ転記用):');
  console.log(
    ALL_PREFECTURES.map((p) => `  ${p}: '${prefectureKana[p] ?? ''}',`).join('\n'),
  );

  // ── municipality_master と突合してシードを作る ──
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  const sql = postgres(url, { prepare: false });
  try {
    const masterRows = await sql<{ code: string; name: string; prefecture: string }[]>`
      SELECT code, name, prefecture FROM municipality_master ORDER BY code
    `;
    console.log(`[fetch] municipality_master has ${masterRows.length} rows`);

    const seed: Record<string, string> = {};
    const missing: string[] = [];
    for (const m of masterRows) {
      const key = `${m.name}::${m.prefecture}`;
      const kana = municipalityKanaByNamePref.get(key) ?? KNOWN_KANJI_VARIANT_OVERRIDES[key];
      if (kana) {
        seed[m.code] = kana;
      } else {
        missing.push(`${m.code} (${m.name}/${m.prefecture})`);
      }
    }

    console.log(`[fetch] matched ${Object.keys(seed).length} / ${masterRows.length} municipality codes`);
    if (missing.length > 0) {
      console.warn(`[fetch] WARNING: ${missing.length} codes with no kana match (kana will be left null via FR-005):`);
      console.warn(missing.slice(0, 50).join('\n'));
      if (missing.length > 50) console.warn(`  ... and ${missing.length - 50} more`);
    }

    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, JSON.stringify(seed, null, 2) + '\n', 'utf-8');
    console.log(`[fetch] wrote ${OUT_PATH}`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error('[fetch] failed:', e);
  process.exit(1);
});
