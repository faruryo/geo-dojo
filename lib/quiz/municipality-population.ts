import type { Municipality } from './municipality-data';

export interface FeedbackItem {
  readonly prefecture: string;
  readonly name: string;
  readonly kana?: string;
  readonly population: number | null;
  readonly formattedPopulation: string | null;
}

/**
 * FR-002d: 人口の表記形式
 * - 10,000人以上: 小数第2位を四捨五入し「約○.○万人」と表記（100万人以上も同一基準）
 * - 10,000人未満: 1の位までカンマ区切りで「約○,○○○人」と表記
 * - null/undefined/0/負数: null を返し非表示
 */
export function formatPopulation(pop: number | null | undefined): string | null {
  if (pop == null || pop <= 0) return null;
  if (pop >= 10_000) {
    const man = (pop / 10_000).toFixed(1);
    return `約${man}万人`;
  }
  return `約${Math.round(pop).toLocaleString('ja-JP')}人`;
}

/**
 * FR-002a: 同一県内に複数区を持つ政令指定都市の人口を合算する。
 * 所属区のいずれか1つでも population が欠損（null/undefined/0）している場合は、
 * 不完全な合算値を避けるため市全体の合算値を null とする。
 * キー: `${prefecture}:${name}`
 */
export function buildDesignatedCityPopulationMap(
  municipalities: readonly Municipality[],
): Map<string, number | null> {
  const groups = new Map<string, Municipality[]>();

  for (const m of municipalities) {
    const key = `${m.prefecture}:${m.name}`;
    const list = groups.get(key);
    if (list) {
      list.push(m);
    } else {
      groups.set(key, [m]);
    }
  }

  const result = new Map<string, number | null>();

  for (const [key, list] of groups.entries()) {
    if (list.length >= 2) {
      let total = 0;
      let hasMissing = false;
      for (const m of list) {
        if (m.population == null || m.population <= 0) {
          hasMissing = true;
          break;
        }
        total += m.population;
      }
      result.set(key, hasMissing ? null : total);
    }
  }

  return result;
}

type ResolveOptions =
  | {
      readonly mode: 'A';
      readonly instances: readonly Municipality[];
      readonly designatedCityMap?: Map<string, number | null>;
    }
  | {
      readonly mode: 'B' | 'C' | 'D';
      readonly municipality: Municipality;
      readonly designatedCityMap?: Map<string, number | null>;
    };

/**
 * 出題モードおよび自治体情報から、解答フィードバック表示用の FeedbackItem 配列を解決する。
 * - Mode D: 5桁コード単位（政令市の場合は当該区自身）の人口を表示（FR-002b）
 * - Mode B/C: 政令市なら合算人口、それ以外は自身の人口を表示（FR-002a）
 * - Mode A: 複数県に存在する同名市町村を合算せず県ごとの内訳として解決（FR-002c）
 */
export function resolveFeedbackItems(options: ResolveOptions): FeedbackItem[] {
  const { mode, designatedCityMap } = options;

  if (mode === 'A') {
    return options.instances.map((m) => {
      const key = `${m.prefecture}:${m.name}`;
      const designatedPop = designatedCityMap?.get(key);
      const pop = designatedPop !== undefined ? designatedPop : (m.population ?? null);
      return {
        prefecture: m.prefecture,
        name: m.name,
        kana: m.kana,
        population: pop,
        formattedPopulation: formatPopulation(pop),
      };
    });
  }

  const { municipality: m } = options;
  let pop: number | null = null;

  if (mode === 'D') {
    // Mode D: 当該区自身の人口
    pop = m.population ?? null;
  } else {
    // Mode B/C: 政令市なら合算人口
    const key = `${m.prefecture}:${m.name}`;
    const designatedPop = designatedCityMap?.get(key);
    pop = designatedPop !== undefined ? designatedPop : (m.population ?? null);
  }

  return [
    {
      prefecture: m.prefecture,
      name: m.name,
      kana: m.kana,
      population: pop,
      formattedPopulation: formatPopulation(pop),
    },
  ];
}
