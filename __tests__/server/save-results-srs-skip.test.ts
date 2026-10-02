import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/auth/current-user', () => ({
  requireUserId: () => Promise.resolve('user-123'),
}));

vi.mock('@/lib/quiz/rate-limit', () => ({
  checkRateLimit: () => true,
}));

const mockUpsert = vi.fn<(userId: string, input: { municipalityCode: string }) => Promise<'updated' | 'skipped'>>();
vi.mock('@/lib/quiz/srs/record-service', () => ({
  upsertSrsRecord: (userId: string, input: { municipalityCode: string }) => mockUpsert(userId, input),
}));

const masterLookup = { limit: () => Promise.resolve([{ code: '01202' }]) };
const selectChain = { from: () => ({ where: () => masterLookup }) };
const insertChain = { values: () => Promise.resolve() };
const tx = { insert: () => insertChain };

vi.mock('@/lib/db', () => ({
  db: {
    select: () => selectChain,
    transaction: (cb: (client: unknown) => Promise<void>) => cb(tx),
  },
}));

import { saveMunicipalityQuizResults } from '@/app/(app)/quiz/municipality/actions';

const input = {
  municipalityCode: '01202',
  municipalityName: '函館市',
  prefecture: '北海道',
  mode: 'B' as const,
  isCorrect: true,
};

describe('saveMunicipalityQuizResults — 同日ガードのスキップ報告', () => {
  beforeEach(() => {
    mockUpsert.mockReset();
  });

  it('SRS 更新が同日ガードでスキップされたコードを srsSkippedCodes で返す', async () => {
    mockUpsert.mockResolvedValueOnce('skipped');
    await expect(saveMunicipalityQuizResults([input])).resolves.toEqual({
      quizPersisted: true,
      srsPersisted: true,
      srsSkippedCodes: ['01202'],
    });
  });

  it('SRS を更新したコードは srsSkippedCodes に含めない', async () => {
    mockUpsert.mockResolvedValueOnce('updated');
    await expect(saveMunicipalityQuizResults([input])).resolves.toEqual({
      quizPersisted: true,
      srsPersisted: true,
      srsSkippedCodes: [],
    });
  });
});
