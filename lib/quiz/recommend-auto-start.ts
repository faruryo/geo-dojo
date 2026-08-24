import type { Question } from '@/components/quiz/use-quiz-session';
import type { Municipality } from '@/lib/quiz/municipality-data';
import {
  buildMunicipalityQuestions,
  type MunicipalityQuizSettings,
} from '@/lib/quiz/municipality-questions';
import type { IdentityCodeMap, MunicipalityWeakness } from '@/lib/quiz/sampling';

/**
 * TanStack Query v5 では未キャッシュかつ offline だと
 * status: pending / fetchStatus: paused になり、
 * isLoading・isFetching・isError がすべて false のまま成功扱いにならない。
 * 出題サンプリングは isSuccess かつ未フェッチであることを成功とみなす。
 * キャッシュ成功かつ offline だと isSuccess のまま fetchStatus が paused になり、
 * 古い clearedCodes で自動開始してしまうため、isPaused 中も待たせる。
 */
export function isQueryResultReady(query: {
  isSuccess: boolean;
  isFetching: boolean;
  isPaused: boolean;
}): boolean {
  return query.isSuccess && !query.isFetching && !query.isPaused;
}

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

export interface RecommendAutoStartQuestionsInput extends RecommendAutoStartInput {
  allMunicipalities: readonly Municipality[];
  settings: MunicipalityQuizSettings;
  weaknessMap: Map<string, MunicipalityWeakness>;
  clearedCodes: Set<string>;
  identityCodeMap: IdentityCodeMap;
  random?: () => number;
}

/**
 * 推薦自動開始の出題。settings を上書きせず、手動スタートと同じサンプリングを使う。
 */
export function buildRecommendAutoStartQuestions(
  input: RecommendAutoStartQuestionsInput,
): Question[] {
  if (!isRecommendAutoStartReady(input)) return [];
  return buildMunicipalityQuestions(
    [...input.allMunicipalities],
    input.settings,
    input.weaknessMap,
    input.clearedCodes,
    input.identityCodeMap,
    input.random,
  );
}
