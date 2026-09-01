export interface Municipality {
  code: string;
  name: string;
  prefecture: string;
  region: string;
  difficulty?: Difficulty;
  kana?: string;
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

// 総務省「全国地方公共団体コード」（scripts/fetch-municipality-kana.ts で取得・変換）から転記。
export const PREFECTURE_KANA: Record<string, string> = {
  北海道: 'ほっかいどう',
  青森県: 'あおもりけん', 岩手県: 'いわてけん', 宮城県: 'みやぎけん', 秋田県: 'あきたけん', 山形県: 'やまがたけん', 福島県: 'ふくしまけん',
  茨城県: 'いばらきけん', 栃木県: 'とちぎけん', 群馬県: 'ぐんまけん', 埼玉県: 'さいたまけん', 千葉県: 'ちばけん', 東京都: 'とうきょうと', 神奈川県: 'かながわけん',
  新潟県: 'にいがたけん', 富山県: 'とやまけん', 石川県: 'いしかわけん', 福井県: 'ふくいけん', 山梨県: 'やまなしけん', 長野県: 'ながのけん', 岐阜県: 'ぎふけん', 静岡県: 'しずおかけん', 愛知県: 'あいちけん',
  三重県: 'みえけん', 滋賀県: 'しがけん', 京都府: 'きょうとふ', 大阪府: 'おおさかふ', 兵庫県: 'ひょうごけん', 奈良県: 'ならけん', 和歌山県: 'わかやまけん',
  鳥取県: 'とっとりけん', 島根県: 'しまねけん', 岡山県: 'おかやまけん', 広島県: 'ひろしまけん', 山口県: 'やまぐちけん',
  徳島県: 'とくしまけん', 香川県: 'かがわけん', 愛媛県: 'えひめけん', 高知県: 'こうちけん',
  福岡県: 'ふくおかけん', 佐賀県: 'さがけん', 長崎県: 'ながさきけん', 熊本県: 'くまもとけん', 大分県: 'おおいたけん', 宮崎県: 'みやざきけん', 鹿児島県: 'かごしまけん', 沖縄県: 'おきなわけん',
};

export type ScopeType = 'region' | 'prefecture';

export interface MunicipalityScope {
  type: ScopeType;
  regions?: Region[];
  prefecture?: string;
  selectedCodes?: string[];
}

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

export function getScopePrefectures(scope: MunicipalityScope): string[] {
  if (scope.type === 'prefecture') {
    return scope.prefecture ? [scope.prefecture] : [];
  }
  return getRegionsPrefectures(scope.regions ?? ['全国']);
}

// Filter by multiple regions. '全国' in the array → return all.
export function filterByRegions(municipalities: Municipality[], regions: Region[]): Municipality[] {
  if (regions.length === 0) return [];
  if (regions.includes('全国')) return municipalities;
  const regionSet = new Set(regions as string[]);
  return municipalities.filter((m) => regionSet.has(m.region));
}

export function filterByScope(
  municipalities: Municipality[],
  scope: MunicipalityScope,
): Municipality[] {
  if (scope.type === 'prefecture') {
    if (!scope.prefecture) return municipalities;
    const prefMunicipalities = municipalities.filter((m) => m.prefecture === scope.prefecture);
    if (scope.selectedCodes !== undefined) {
      const codeSet = new Set(scope.selectedCodes);
      return prefMunicipalities.filter((m) => codeSet.has(m.code));
    }
    return prefMunicipalities;
  }
  return filterByRegions(municipalities, scope.regions ?? ['全国']);
}

// Mode A and B require ≥2 prefectures across all selected regions.
// Only fails when regions=['北海道'] alone (1 prefecture).
export function isModeAvailable(mode: GameMode, regions: Region[]): boolean {
  if (mode === 'A' || mode === 'B') {
    if (regions.length === 0 || regions.includes('全国')) return true;
    return getRegionsPrefectures(regions).length >= 2;
  }
  return true;
}

export function isScopeAvailable(mode: GameMode, scope: MunicipalityScope): boolean {
  if (mode === 'A' || mode === 'B') {
    if (scope.type === 'prefecture') return false;
    const regions = scope.regions ?? ['全国'];
    if (regions.includes('全国')) return true;
    return getRegionsPrefectures(regions).length >= 2;
  }
  return true;
}

export function parseScopeFromSearchParams(
  searchParams: URLSearchParams | { get: (key: string) => string | null },
): MunicipalityScope {
  const scopeType = searchParams.get('scope');
  const pref = searchParams.get('pref') ?? searchParams.get('prefecture');
  const codesParam = searchParams.get('codes');
  const regionParam = searchParams.get('region') ?? searchParams.get('regions');

  if (scopeType === 'prefecture' || pref) {
    const selectedCodes =
      codesParam !== null
        ? codesParam.split(',').map((c) => c.trim()).filter(Boolean)
        : undefined;
    return {
      type: 'prefecture',
      prefecture: pref ?? '東京都',
      selectedCodes,
    };
  }

  if (regionParam) {
    const regions: Region[] = regionParam
      .split(',')
      .map((r) => r.trim())
      .filter((r): r is Region => (REGIONS as readonly string[]).includes(r));
    if (regions.length > 0) {
      return {
        type: 'region',
        regions,
      };
    }
  }

  return {
    type: 'region',
    regions: ['全国'],
  };
}

export const LAST_MODE_D_SCOPE_KEY = 'geodojo_last_mode_d_scope';

export function updateSearchParamsWithScope(
  searchParams: URLSearchParams,
  scope: MunicipalityScope,
): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  next.delete('scope');
  next.delete('pref');
  next.delete('prefecture');
  next.delete('codes');
  next.delete('region');
  next.delete('regions');

  if (scope.type === 'prefecture' && scope.prefecture) {
    next.set('scope', 'prefecture');
    next.set('pref', scope.prefecture);
    if (scope.selectedCodes !== undefined) {
      next.set('codes', scope.selectedCodes.join(','));
    }
  } else if (scope.regions && scope.regions.length > 0 && !scope.regions.includes('全国')) {
    next.set('scope', 'region');
    next.set('region', scope.regions.join(','));
  }
  return next;
}

export function serializeScopeToQueryString(scope: MunicipalityScope): string {
  const params = updateSearchParamsWithScope(new URLSearchParams(), scope);
  const str = params.toString();
  return str ? `?${str}` : '';
}

export function filterByRegion(municipalities: Municipality[], region: Region): Municipality[] {
  if (region === '全国') return municipalities;
  if (REGIONS.slice(1).includes(region)) {
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

export function isSameNameMunicipality(name: string, prefecture: string): boolean {
  const mName = name.replace(/[市区町村]$/, '');
  const pName = prefecture.replace(/[都道府県]$/, '');
  return mName === pName;
}

export function filterSameName(municipalities: Municipality[]): Municipality[] {
  return municipalities.filter((m) => !isSameNameMunicipality(m.name, m.prefecture));
}

export function isTokyoSpecialWard(m: Municipality): boolean {
  return m.prefecture === '東京都' && m.name.endsWith('区');
}

export function filterTokyoSpecialWards(municipalities: Municipality[]): Municipality[] {
  return municipalities.filter((m) => !isTokyoSpecialWard(m));
}

export function filterTextModeMunicipalities(municipalities: Municipality[]): Municipality[] {
  return filterTokyoSpecialWards(filterSameName(municipalities));
}

interface DistractorFilterContext {
  targetPrefecture: string;
  useRegion: boolean;
  regionPrefSet: Set<string> | null;
  namesInTargetPref: Set<string>;
}

function isValidDistractor(
  c: Municipality,
  ctx: DistractorFilterContext,
  diffSet?: Set<Difficulty> | null,
): boolean {
  if (c.prefecture === ctx.targetPrefecture) return false;
  if (ctx.useRegion && ctx.regionPrefSet && !ctx.regionPrefSet.has(c.prefecture)) return false;
  if (ctx.namesInTargetPref.has(c.name)) return false;
  if (diffSet && (c.difficulty === undefined || !diffSet.has(c.difficulty))) return false;
  return true;
}

function collectDistractors(
  pool: Municipality[],
  ctx: DistractorFilterContext,
  diffSet: Set<Difficulty> | null,
  distractorPool: Map<string, Municipality>,
): void {
  for (const c of pool) {
    if (isValidDistractor(c, ctx, diffSet) && !distractorPool.has(c.name)) {
      distractorPool.set(c.name, c);
    }
  }
}

/**
 * モードC・D等で市区町村名を選択肢にする際の誤答選択肢（3件）を抽出する。
 * 出題難易度 (targetDifficulties / target.difficulty) に一致する市区町村を優先して選択する。
 */
export function buildModeCDistractors(
  target: Municipality,
  pool: Municipality[],
  options?: {
    regionPrefs?: string[];
    targetDifficulties?: Difficulty[];
  },
): string[] {
  const useRegion = (options?.regionPrefs?.length ?? 0) >= 4;
  const ctx: DistractorFilterContext = {
    targetPrefecture: target.prefecture,
    useRegion,
    regionPrefSet: options?.regionPrefs ? new Set(options.regionPrefs) : null,
    namesInTargetPref: new Set(
      pool.filter((a) => a.prefecture === target.prefecture).map((a) => a.name),
    ),
  };

  let targetDiffs: Difficulty[] | null = null;
  if (options?.targetDifficulties && options.targetDifficulties.length > 0) {
    targetDiffs = options.targetDifficulties;
  } else if (target.difficulty) {
    targetDiffs = [target.difficulty];
  }

  const diffSet = targetDiffs ? new Set(targetDiffs) : null;
  const distractorPool = new Map<string, Municipality>();

  // 1st pass: 難易度一致 ＆ リージョン一致（リージョン指定時）
  collectDistractors(pool, ctx, diffSet, distractorPool);

  // 2nd pass: 3件未満なら、難易度一致のままリージョン制限を外して全国から探索
  if (distractorPool.size < 3 && useRegion) {
    collectDistractors(pool, { ...ctx, useRegion: false }, diffSet, distractorPool);
  }

  // 3rd pass: それでも 3 件未満なら、全難易度・全国から補テン
  if (distractorPool.size < 3) {
    collectDistractors(pool, { ...ctx, useRegion: false }, null, distractorPool);
  }

  return shuffle([...distractorPool.values()]).slice(0, 3).map((d) => d.name);
}

