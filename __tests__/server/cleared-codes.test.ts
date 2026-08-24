/* eslint-disable sonarjs/no-nested-functions */
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

import { getClearedMunicipalityCodes, getMunicipalityWeakness } from '@/app/(app)/quiz/municipality/actions';

// Mock supabase server auth
const mockGetUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({
    auth: {
      getUser: mockGetUser,
    },
  }),
}));

// Mock DB
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockGroupBy = vi.fn();
const mockHaving = vi.fn();

const havingChain = {
  orderBy: (..._obArgs: unknown[]) => mockOrderBy(),
};

const groupByChain = {
  having: (..._hArgs: unknown[]) => {
    mockHaving();
    return havingChain;
  },
};

const whereChain = {
  groupBy: (..._gbArgs: unknown[]) => {
    mockGroupBy();
    return groupByChain;
  },
};

const fromChain = {
  where: (..._whereArgs: unknown[]) => {
    mockWhere();
    return whereChain;
  },
};

const selectDistinctChain = {
  from: (..._fromArgs: unknown[]) => ({
    where: (..._whereArgs: unknown[]) => mockWhere(),
  }),
};

const selectChain = {
  from: (..._fromArgs: unknown[]) => {
    mockFrom();
    return fromChain;
  },
};

vi.mock('@/lib/db', () => ({
  db: {
    select: (..._args: unknown[]) => {
      mockSelect();
      return selectChain;
    },
    selectDistinct: (..._args: unknown[]) => selectDistinctChain,
  },
}));

describe('getClearedMunicipalityCodes Server Action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws Unauthorized error when user is not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('Unauthorized') });

    await expect(getClearedMunicipalityCodes('mode_a')).rejects.toThrow('Unauthorized');
  });

  it('fetches distinct cleared codes for the authenticated user and mode', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-123' } },
      error: null,
    });
    mockWhere.mockResolvedValueOnce([
      { municipalityCode: '13101' },
      { municipalityCode: '13102' },
    ]);

    const result = await getClearedMunicipalityCodes('mode_b');
    expect(result).toEqual(['13101', '13102']);
  });
});

describe('getMunicipalityWeakness Server Action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws Unauthorized error when user is not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('Unauthorized') });

    await expect(getMunicipalityWeakness()).rejects.toThrow('Unauthorized');
  });

  it('fetches all weakness data without 100 limit restriction', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-123' } },
      error: null,
    });
    mockOrderBy.mockResolvedValueOnce([
      {
        municipalityCode: '13101',
        municipalityName: '千代田区',
        prefecture: '東京都',
        errorRate: 0.6,
      },
    ]);

    const result = await getMunicipalityWeakness();
    expect(result).toHaveLength(1);
    expect(result[0].municipalityCode).toBe('13101');
    expect(result[0].errorRate).toBeCloseTo(0.6);
  });
});
