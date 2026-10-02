import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

vi.mock('server-only', () => ({}));

const mockRequireUserId = vi.fn<() => Promise<string>>();
vi.mock('@/lib/auth/current-user', () => ({
  requireUserId: () => mockRequireUserId(),
}));

type Condition =
  | { op: 'eq'; col: unknown; val: unknown }
  | { op: 'in'; col: unknown; vals: unknown[] }
  | { op: 'and'; parts: Condition[] };

vi.mock('drizzle-orm', async (importOriginal) => ({
  ...(await importOriginal<typeof import('drizzle-orm')>()),
  eq: (col: unknown, val: unknown): Condition => ({ op: 'eq', col, val }),
  inArray: (col: unknown, vals: unknown[]): Condition => ({ op: 'in', col, vals }),
  and: (...parts: Condition[]): Condition => ({ op: 'and', parts }),
}));

const recordsWhere = vi.fn<(cond: Condition) => Promise<unknown[]>>();
const wrongWhere = vi.fn<(cond: Condition) => Promise<unknown[]>>();
const mockSelect = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    select: (...args: unknown[]) => {
      mockSelect(...args);
      return { from: () => ({ where: (cond: Condition) => recordsWhere(cond) }) };
    },
    selectDistinct: () => ({ from: () => ({ where: (cond: Condition) => wrongWhere(cond) }) }),
  },
}));

import { getSrsSnapshot } from '@/app/(app)/quiz/review/actions';
import { municipalityQuizResults, srsRecords } from '@/lib/db/schema';

function partsOf(cond: Condition | undefined): Condition[] {
  return cond?.op === 'and' ? cond.parts : [];
}

let errorSpy: MockInstance<typeof console.error>;
beforeEach(() => {
  vi.clearAllMocks();
  mockRequireUserId.mockResolvedValue('user-123');
  recordsWhere.mockResolvedValue([]);
  wrongWhere.mockResolvedValue([]);
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  errorSpy.mockRestore();
});

describe('getSrsSnapshot Server Action', () => {
  it('(コード, モード) で突き合わせ、入力キーの順に record と誤答歴を返す', async () => {
    recordsWhere.mockResolvedValueOnce([
      {
        municipalityCode: '01202',
        mode: 'B',
        easeFactor: 2.36,
        repetition: 2,
        interval: 6,
        status: 'reviewing',
        dueDate: new Date('2026-06-07T00:00:00Z'),
        lastReviewedAt: new Date('2026-06-01T09:59:00Z'),
      },
    ]);
    wrongWhere.mockResolvedValueOnce([{ municipalityCode: '01202', mode: 'C' }]);

    const result = await getSrsSnapshot([
      { municipalityCode: '01203', mode: 'B' },
      { municipalityCode: '01202', mode: 'C' },
      { municipalityCode: '01202', mode: 'B' },
    ]);

    expect(result).toEqual([
      { municipalityCode: '01203', mode: 'B', record: null, everWrong: false },
      { municipalityCode: '01202', mode: 'C', record: null, everWrong: true },
      {
        municipalityCode: '01202',
        mode: 'B',
        record: {
          easeFactor: 2.36,
          repetition: 2,
          interval: 6,
          status: 'reviewing',
          dueDate: '2026-06-07T00:00:00.000Z',
          lastReviewedAt: '2026-06-01T09:59:00.000Z',
        },
        everWrong: false,
      },
    ]);
  });

  it('srs_records と誤答歴の両クエリを本人の user_id と重複除去したコードで絞る', async () => {
    await getSrsSnapshot([
      { municipalityCode: '01202', mode: 'B' },
      { municipalityCode: '01202', mode: 'C' },
    ]);

    const recordParts = partsOf(recordsWhere.mock.calls[0]?.[0]);
    expect(recordParts).toContainEqual({ op: 'eq', col: srsRecords.userId, val: 'user-123' });
    expect(recordParts).toContainEqual({ op: 'in', col: srsRecords.municipalityCode, vals: ['01202'] });

    const wrongParts = partsOf(wrongWhere.mock.calls[0]?.[0]);
    expect(wrongParts).toContainEqual({ op: 'eq', col: municipalityQuizResults.userId, val: 'user-123' });
    expect(wrongParts).toContainEqual({ op: 'eq', col: municipalityQuizResults.isCorrect, val: false });
    expect(wrongParts).toContainEqual({ op: 'in', col: municipalityQuizResults.municipalityCode, vals: ['01202'] });
  });

  it('未認証なら DB に触れずに reject する', async () => {
    mockRequireUserId.mockRejectedValueOnce(new Error('Unauthorized'));
    await expect(getSrsSnapshot([{ municipalityCode: '01202', mode: 'B' }])).rejects.toThrow('Unauthorized');
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('不正な入力は DB に触れずに reject する', async () => {
    await expect(getSrsSnapshot([{ municipalityCode: '1202', mode: 'B' }])).rejects.toThrow('Invalid municipality code');
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('DB 失敗時は理由をログしてから再 throw する', async () => {
    recordsWhere.mockRejectedValueOnce(new Error('connection lost'));
    await expect(getSrsSnapshot([{ municipalityCode: '01202', mode: 'B' }])).rejects.toThrow('connection lost');
    expect(errorSpy).toHaveBeenCalledWith(
      '[getSrsSnapshot] failed',
      expect.objectContaining({ count: 1, error: 'Error: connection lost' }),
    );
  });
});
