import type { GameMode, Difficulty, Region } from '@/lib/quiz/municipality-data';

export type { GameMode, Difficulty, Region };

export type Cell = {
  difficulty: Difficulty;
  region: Exclude<Region, '全国'>;
  mode: GameMode;
};

export type Session = {
  startAt: Date;
  endAt: Date;
  mode: GameMode;
  rows: Array<{
    municipalityCode: string;
    municipalityName: string;
    prefecture: string;
    isCorrect: boolean;
    answeredAt: Date;
    region?: string;
    difficulty?: string;
  }>;
  accuracy: number;
  count: 10 | 20 | 30;
};

export type CellAccuracy = {
  cell: Cell;
  movingAverage: number;
  sessionCount: number;
  windowSessions: Session[];
  source: 'self' | 'difficulty-mode' | 'mode' | 'overall' | 'crowd-average';
};

export type CellCoverage = {
  cell: Cell;
  totalMunicipalities: number;
  conqueredCount: number;
  coverageRate: number;
};

export type FitZone = {
  cells: CellAccuracy[];
  maxDifficulty: Difficulty;
  isCappedAt: Difficulty | null;
};

export type LearnerState = {
  userId: string;
  totalSessions: number;
  totalAnswers: number;
  cellAccuracies: Map<string, CellAccuracy>;
  cellCoverages: Map<string, CellCoverage>;
  fitZone: FitZone;
  weaknessByMunicipality: Map<string, number>;
  lastSessionAccuracy: number | null;
  recentQuestionCounts: (10 | 20 | 30)[];
  recentlyPlayedCodes: Set<string>;
  crowdAccuracyByDifficulty: Record<Difficulty, number>;
};

export type RationaleCategory =
  | 'cold-start'
  | 'regression'
  | 'difficulty-step-up'
  | 'mode-change'
  | 'bridging'
  | 'weakness-focused'
  | 'review-timing'
  | 'new-exploration';

export type Recommendation = {
  mode: GameMode;
  difficulties: Difficulty[];
  regions: Exclude<Region, '全国'>[];
  count: 10 | 20 | 30;
  codes: string[];
  rationaleCategory: RationaleCategory;
  rationaleText: string;
  poolBreakdown: {
    fitZoneWeakness: number;
    coverageNew: number;
    exploration: number;
    randomFallback: number;
  };
  isProgressionFired: boolean;
  isRegressionGuarded: boolean;
};

export type RecommendationHistoryCache = {
  lastCodes: string[];
  storedAt: string;
};

export function cellKey(cell: Cell): string {
  return `${cell.difficulty}_${cell.region}_${cell.mode}`;
}

export const REGION_VALUES = [
  '北海道', '東北', '関東', '中部', '近畿', '中国', '四国', '九州',
] as const;
export type RegionValue = (typeof REGION_VALUES)[number];

export const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'medium', 'hard', 'expert'];
