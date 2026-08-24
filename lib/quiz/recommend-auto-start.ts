export type QuizPhase = 'setup' | 'playing' | 'result';

export interface RecommendAutoStartInput {
  isRecommendSource: boolean;
  alreadyStarted: boolean;
  phase: QuizPhase;
  masterReady: boolean;
  modeAvailable: boolean;
  unclearedFirst: boolean;
  clearedQuerySettledOk: boolean;
  weaknessFirst: boolean;
  weaknessQuerySettledOk: boolean;
}

/**
 * 「今日のおすすめ」自動開始が、未クリア/苦手優先に必要なクエリを待ったうえで実行できるか。
 * 推薦経路でも unclearedFirst の既定（ON）を維持する。
 */
export function isRecommendAutoStartReady(input: RecommendAutoStartInput): boolean {
  if (!input.isRecommendSource) return false;
  if (input.alreadyStarted) return false;
  if (input.phase !== 'setup') return false;
  if (!input.masterReady) return false;
  if (!input.modeAvailable) return false;
  if (input.unclearedFirst && !input.clearedQuerySettledOk) return false;
  if (input.weaknessFirst && !input.weaknessQuerySettledOk) return false;
  return true;
}
