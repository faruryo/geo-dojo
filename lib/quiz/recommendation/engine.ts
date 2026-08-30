import type { LearnerState, Recommendation } from './types';
import { generateConquestRecommendation, type RecommendClientState } from './conquest-lottery';

type MasterEntry = { code: string; region: string; difficulty: string; name: string; prefecture: string };

export function generateRecommendation(
  state: LearnerState,
  excludeCodes: string[],
  allMaster: MasterEntry[],
  options?: { random?: () => number; client?: RecommendClientState },
): Recommendation {
  return generateConquestRecommendation(state, excludeCodes, allMaster, options);
}

export type { RecommendClientState } from './conquest-lottery';
