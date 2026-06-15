export interface Municipality {
  code: string;
  name: string;
  prefecture: string;
  region: string;
  difficulty?: Difficulty;
}

export type GameMode = 'A' | 'B' | 'C' | 'D';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert'];

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: '☆ 入門',
  medium: '☆☆ 中級',
  hard: '☆☆☆ 上級',
  expert: '☆☆☆☆ 達人',
};

export const REGIONS = [
  '全国', '北海道', '東北', '関東', '中部', '近畿', '中国', '四国', '九州',
] as const;
export type Region = (typeof REGIONS)[number];

export const SESSION_COUNTS = [10, 20, 30] as const;
export type SessionCount = (typeof SESSION_COUNTS)[number];

export const PREFECTURE_TO_REGION: Record<string, string> = {
  北海道: '北海道',
  青森県: '東北', 岩手県: '東北', 宮城県: '東北', 秋田県: '東北', 山形県: '東北', 福島県: '東北',
  茨城県: '関東', 栃木県: '関東', 群馬県: '関東', 埼玉県: '関東', 千葉県: '関東', 東京都: '関東', 神奈川県: '関東',
  新潟県: '中部', 富山県: '中部', 石川県: '中部', 福井県: '中部', 山梨県: '中部', 長野県: '中部', 岐阜県: '中部', 静岡県: '中部', 愛知県: '中部',
  三重県: '近畿', 滋賀県: '近畿', 京都府: '近畿', 大阪府: '近畿', 兵庫県: '近畿', 奈良県: '近畿', 和歌山県: '近畿',
  鳥取県: '中国', 島根県: '中国', 岡山県: '中国', 広島県: '中国', 山口県: '中国',
  徳島県: '四国', 香川県: '四国', 愛媛県: '四国', 高知県: '四国',
  福岡県: '九州', 佐賀県: '九州', 長崎県: '九州', 熊本県: '九州', 大分県: '九州', 宮崎県: '九州', 鹿児島県: '九州', 沖縄県: '九州',
};

export const ALL_PREFECTURES = Object.keys(PREFECTURE_TO_REGION);

// Returns the prefectures belonging to a single region. '全国' → all 47.
export function getRegionPrefectures(region: Region): string[] {
  if (region === '全国') return ALL_PREFECTURES;
  return ALL_PREFECTURES.filter((p) => PREFECTURE_TO_REGION[p] === region);
}

// Returns the union of prefectures across multiple selected regions.
export function getRegionsPrefectures(regions: Region[]): string[] {
  if (regions.includes('全国')) return ALL_PREFECTURES;
  return [...new Set(regions.flatMap((r) => getRegionPrefectures(r)))];
}

// Filter by multiple regions. '全国' in the array → return all.
export function filterByRegions(municipalities: Municipality[], regions: Region[]): Municipality[] {
  if (regions.length === 0) return [];
  if (regions.includes('全国')) return municipalities;
  const regionSet = new Set(regions as string[]);
  return municipalities.filter((m) => regionSet.has(m.region));
}

// Mode B requires ≥2 prefectures across all selected regions.
// Only fails when regions=['北海道'] alone (1 prefecture).
export function isModeAvailable(mode: GameMode, regions: Region[]): boolean {
  if (mode === 'B') return getRegionsPrefectures(regions).length >= 2;
  return true;
}

export function filterByRegion(municipalities: Municipality[], region: Region): Municipality[] {
  if (region === '全国') return municipalities;
  if (REGIONS.slice(1).includes(region as Exclude<Region, '全国'>)) {
    // It's a region name — filter by region field
    return municipalities.filter((m) => m.region === region);
  }
  // Prefecture name — exact match (used when user picks a specific prefecture)
  return municipalities.filter((m) => m.prefecture === region);
}

export function filterByDifficulty(
  municipalities: Municipality[],
  difficulties: Difficulty[],
): Municipality[] {
  if (difficulties.length === 0) return [];
  const set = new Set(difficulties);
  return municipalities.filter((m) => m.difficulty !== undefined && set.has(m.difficulty));
}

/**
 * 出題対象の市区町村群から代表となる難易度を返す。
 * 複数の難易度が混在する場合は最も難しい（DIFFICULTIES のインデックスが最大の）ものを返す。
 * 難易度を持つ要素が一つもない、または空配列なら undefined（モードAで同名複数県のケース等、FR-007 / FR-005）。
 */
export function representativeDifficulty(
  municipalities: Municipality[],
): Difficulty | undefined {
  let best: Difficulty | undefined;
  for (const m of municipalities) {
    if (m.difficulty === undefined) continue;
    if (best === undefined || DIFFICULTIES.indexOf(m.difficulty) > DIFFICULTIES.indexOf(best)) {
      best = m.difficulty;
    }
  }
  return best;
}

/**
 * Mode A の採点対象を「都道府県ごとに代表1件」へ畳む。
 * 政令市は同名の区が複数コードで存在するため（例: 札幌市=10区）、
 * instances をそのまま記録すると区数ぶん多重カウントされる（B007）。
 * 都道府県単位で代表1件に畳むことで、1問1県=1記録にする。
 * 同名が複数県にある場合（例: 府中市=東京/広島）は県ごとに1件ずつ残す。
 */
export function dedupeInstancesByPrefecture(instances: Municipality[]): Municipality[] {
  const byPref = new Map<string, Municipality>();
  for (const m of instances) {
    if (!byPref.has(m.prefecture)) byPref.set(m.prefecture, m);
  }
  return [...byPref.values()];
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function weightedSample(
  municipalities: Municipality[],
  weaknessMap: Map<string, number>,
  count: number,
): Municipality[] {
  if (municipalities.length === 0) return [];
  const n = Math.min(count, municipalities.length);
  const weights = municipalities.map((m) => 1 + (weaknessMap.get(m.code) ?? 0) * 4);
  const result: Municipality[] = [];
  const rem = [...municipalities];
  const remW = [...weights];

  for (let i = 0; i < n; i++) {
    const total = remW.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let j = 0; j < rem.length; j++) {
      r -= remW[j];
      if (r <= 0 || j === rem.length - 1) {
        result.push(rem[j]);
        rem.splice(j, 1);
        remW.splice(j, 1);
        break;
      }
    }
  }
  return result;
}
