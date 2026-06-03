import type { RationaleCategory, Recommendation, Difficulty } from './types';
import { DIFFICULTY_ORDER } from './types';
import { DIFFICULTY_LABEL } from '@/lib/quiz/municipality-data';

type RationaleFlags = {
  isColdStart: boolean;
  isRegressionGuarded: boolean;
  isProgressionFired: boolean;
  isDifficultyCapped: boolean;
  nextDifficulty?: string | null;
  nextMode?: string | null;
  nextRegion?: string | null;
  alternativeStrategy?: string;
  daysSinceLastPlay?: number;
  weaknessCount?: number;
  newExplorationCount?: number;
  isNovelMode?: boolean;
  isCompletelyUntriedMode?: boolean;
  novelRegion?: string | null;
};

export function selectRationale(
  recommendation: Pick<Recommendation, 'mode' | 'difficulties' | 'regions' | 'count'>,
  flags: RationaleFlags,
): { category: RationaleCategory; text: string } {
  // Priority order: cold-start > regression > difficulty-step-up > mode-change > bridging > weakness-focused > review-timing > new-exploration
  if (flags.isColdStart) {
    const diff = recommendation.difficulties[0] ?? 'easy';
    return {
      category: 'cold-start',
      text: `初めての方向けに ${DIFFICULTY_LABEL[diff] ?? diff} を全国から出題します`,
    };
  }

  if (flags.isRegressionGuarded) {
    return {
      category: 'regression',
      text: '少しペースを落として、現在のレベルを確実にしましょう',
    };
  }

  if (flags.isProgressionFired && flags.alternativeStrategy === 'change-mode' && flags.nextMode) {
    const currentMode = recommendation.mode;
    return {
      category: 'mode-change',
      text: `モード${currentMode}が安定したので、モード${flags.nextMode}に挑戦しましょう`,
    };
  }

  if (flags.isProgressionFired && flags.nextDifficulty) {
    const current = recommendation.difficulties[0] ?? 'easy';
    const next = flags.nextDifficulty as Difficulty;
    return {
      category: 'difficulty-step-up',
      text: `${DIFFICULTY_LABEL[current] ?? current}が安定したので、${DIFFICULTY_LABEL[next] ?? next}に挑戦しましょう`,
    };
  }

  if (flags.isProgressionFired && flags.alternativeStrategy === 'expand-region' && flags.nextRegion) {
    return {
      category: 'difficulty-step-up',
      text: `実力が伸びてきました！${flags.nextRegion}の市区町村に挑戦しましょう`,
    };
  }

  // Bridging: both progression and weakness present
  if (flags.isProgressionFired && flags.isDifficultyCapped) {
    const current = recommendation.difficulties[0] ?? 'easy';
    const nextIdx = DIFFICULTY_ORDER.indexOf(current as 'easy' | 'medium' | 'hard' | 'expert') + 1;
    const next = DIFFICULTY_ORDER[nextIdx];
    if (next) {
      return {
        category: 'bridging',
        text: `現在の${DIFFICULTY_LABEL[current] ?? current}復習と、${DIFFICULTY_LABEL[next] ?? next}の挑戦を半々で進めます`,
      };
    }
  }

  if (flags.isNovelMode) {
    const mode = recommendation.mode;
    return {
      category: 'new-exploration',
      text: flags.isCompletelyUntriedMode
        ? `モード${mode}は未挑戦！新しい問題形式に挑戦しましょう`
        : `モード${mode}をもっと練習して得意にしましょう`,
    };
  }

  if (flags.novelRegion) {
    return {
      category: 'new-exploration',
      text: `${flags.novelRegion}など未挑戦のエリアが含まれています`,
    };
  }

  if (flags.weaknessCount && flags.weaknessCount > 0) {
    const region = recommendation.regions[0];
    const diff = recommendation.difficulties[0] ?? 'easy';
    return {
      category: 'weakness-focused',
      text: region
        ? `${region}の${DIFFICULTY_LABEL[diff] ?? diff}で苦手な市区町村が${flags.weaknessCount}件あります`
        : `苦手な市区町村を重点的に練習します`,
    };
  }

  if (flags.daysSinceLastPlay && flags.daysSinceLastPlay >= 30) {
    return {
      category: 'review-timing',
      text: `最後にプレイから${flags.daysSinceLastPlay}日経った市区町村を復習します`,
    };
  }

  if (flags.newExplorationCount && flags.newExplorationCount > 0) {
    return {
      category: 'new-exploration',
      text: `未挑戦の市区町村${flags.newExplorationCount}件を含みます`,
    };
  }

  return {
    category: 'new-exploration',
    text: '新しい市区町村を探索しましょう',
  };
}
