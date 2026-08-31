import { describe, it, expect, vi } from 'vitest';
import {
  executeQuizAdvance,
  createTimeoutEntry,
  type QuizSessionEntry,
  type QuizResultEntry,
} from '@/lib/quiz/quiz-session-core';
import type { Municipality } from '@/lib/quiz/municipality-data';

describe('quiz-session-core', () => {
  const mFuchuTokyo: Municipality = {
    code: '13206',
    name: '府中市',
    prefecture: '東京都',
    region: '関東',
    difficulty: 'easy',
  };

  const mFuchuHiroshima: Municipality = {
    code: '34208',
    name: '府中市',
    prefecture: '広島県',
    region: '中国',
    difficulty: 'medium',
  };

  const mSapporo: Municipality = {
    code: '01100',
    name: '札幌市',
    prefecture: '北海道',
    region: '北海道',
    difficulty: 'easy',
  };

  describe('executeQuizAdvance', () => {
    it('Mode A の同名・複数県（府中市: 東京+広島）で、保存は2件実行され、表示結果は1件に集約されること', async () => {
      const entries: QuizSessionEntry[] = [
        { municipality: mFuchuTokyo, isCorrect: true, mode: 'A', answerTimeMs: 2500 },
        { municipality: mFuchuHiroshima, isCorrect: true, mode: 'A', answerTimeMs: 2500 },
      ];
      const initialResults: QuizResultEntry[] = [
        { name: '横浜市', prefecture: '神奈川県', correct: true },
      ];

      const saveCalls: unknown[] = [];
      const mockSaveFn = vi.fn(async (input) => {
        saveCalls.push(input);
        return { quizPersisted: true, srsPersisted: true };
      });

      const { results: updated, persisted } = await executeQuizAdvance(
        entries,
        initialResults,
        mockSaveFn,
      );

      expect(persisted).toBe(true);
      // 表示結果は1件だけ追加（合計2件）
      expect(updated).toHaveLength(2);
      expect(updated[1]).toEqual({
        name: '府中市',
        prefecture: '東京都',
        correct: true,
        kana: undefined,
      });

      // DB保存は各県ごとに2件呼ばれること
      expect(mockSaveFn).toHaveBeenCalledTimes(2);
      expect(saveCalls).toEqual([
        {
          municipalityCode: '13206',
          municipalityName: '府中市',
          prefecture: '東京都',
          mode: 'A',
          isCorrect: true,
          answerTimeMs: 2500,
        },
        {
          municipalityCode: '34208',
          municipalityName: '府中市',
          prefecture: '広島県',
          mode: 'A',
          isCorrect: true,
          answerTimeMs: 2500,
        },
      ]);
    });

    it('保存が reject されても例外を投げず、logger.error に詳細を出力して結果を返すこと', async () => {
      const entries: QuizSessionEntry[] = [
        { municipality: mSapporo, isCorrect: false, mode: 'B', answerTimeMs: 1200 },
      ];
      const mockSaveFn = vi.fn(async () => {
        throw new Error('Network error on DB save');
      });
      const mockLogger = {
        error: vi.fn(),
      };

      const { results: updated, persisted } = await executeQuizAdvance(
        entries,
        [],
        mockSaveFn,
        mockLogger,
      );

      expect(persisted).toBe(false);
      expect(updated).toHaveLength(1);
      expect(updated[0]).toEqual({
        name: '札幌市',
        prefecture: '北海道',
        correct: false,
        kana: undefined,
      });

      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[quiz-runner] failed to save result',
        expect.objectContaining({
          code: '01100',
          mode: 'B',
        }),
      );
    });

    it('treats quiz as persisted when saveFn reports quizPersisted after a later SRS failure', async () => {
      const entries: QuizSessionEntry[] = [
        { municipality: mSapporo, isCorrect: true, mode: 'A', answerTimeMs: 800 },
      ];
      const mockLogger = { error: vi.fn() };
      const mockSaveFn = vi.fn(async () => ({ quizPersisted: true, srsPersisted: false }));
      const { persisted } = await executeQuizAdvance(entries, [], mockSaveFn, mockLogger);
      expect(persisted).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[quiz-runner] srs failed after quiz insert',
        expect.objectContaining({ code: '01100', mode: 'A' }),
      );
    });
  });

  describe('createTimeoutEntry', () => {
    it('Mode D タイムアウト時に 30秒・不正解のエントリを生成すること', () => {
      const entry = createTimeoutEntry(mSapporo, 30);
      expect(entry).toEqual({
        municipality: mSapporo,
        isCorrect: false,
        mode: 'D',
        answerTimeMs: 30000,
      });
    });
  });
});
