import { describe, it, expect } from 'vitest';
import { computeSrsUpdate, type ExistingSrs } from '@/lib/quiz/srs/update';

const NOW = new Date('2026-06-01T10:00:00Z'); // JST 19:00
const DAY_MS = 24 * 60 * 60 * 1000;

function daysFromNow(due: Date): number {
  return Math.round((due.getTime() - NOW.getTime()) / DAY_MS);
}

describe('computeSrsUpdate — 新規（未登録）', () => {
  it('新規で誤答: reviewing / rep0 / 翌日 due', () => {
    const a = computeSrsUpdate(null, false, NOW);
    expect(a.kind).toBe('upsert');
    if (a.kind !== 'upsert') return;
    expect(a.status).toBe('reviewing');
    expect(a.repetition).toBe(0);
    expect(a.interval).toBe(1);
    expect(daysFromNow(a.dueDate)).toBe(1); // 翌日
    expect(a.lastReviewedAt).toEqual(NOW);
  });

  it('新規で正解: rep1 / 翌日 due（同日ガードは既存レコードのみ）', () => {
    const a = computeSrsUpdate(null, true, NOW);
    expect(a.kind).toBe('upsert');
    if (a.kind !== 'upsert') return;
    expect(a.repetition).toBe(1);
    expect(a.interval).toBe(1);
    expect(daysFromNow(a.dueDate)).toBe(1);
  });
});

describe('computeSrsUpdate — 同日ガード（FR-005a / R3）', () => {
  const reviewedToday: ExistingSrs = {
    easeFactor: 2.5,
    repetition: 1,
    interval: 1,
    status: 'reviewing',
    lastReviewedAt: new Date('2026-06-01T01:00:00Z'), // 同 JST 日
  };

  it('今日すでに前進済みのアイテムに正解 → skip（前進しない）', () => {
    const a = computeSrsUpdate(reviewedToday, true, NOW);
    expect(a.kind).toBe('skip');
  });

  it('今日すでに前進済みでも、不正解は常に処理される（リセット）', () => {
    const a = computeSrsUpdate(reviewedToday, false, NOW);
    expect(a.kind).toBe('upsert');
    if (a.kind !== 'upsert') return;
    expect(a.repetition).toBe(0);
    expect(daysFromNow(a.dueDate)).toBe(1);
  });

  it('前回復習が昨日（JST別日）なら正解で前進する', () => {
    const reviewedYesterday: ExistingSrs = {
      ...reviewedToday,
      lastReviewedAt: new Date('2026-05-31T01:00:00Z'),
    };
    const a = computeSrsUpdate(reviewedYesterday, true, NOW);
    expect(a.kind).toBe('upsert');
    if (a.kind !== 'upsert') return;
    expect(a.repetition).toBe(2);
    expect(a.interval).toBe(6); // rep2 → 6日
    expect(daysFromNow(a.dueDate)).toBe(6);
  });

  it('lastReviewedAt が null（バックフィル直後）なら正解で前進する', () => {
    const backfilled: ExistingSrs = {
      easeFactor: 2.5,
      repetition: 0,
      interval: 0,
      status: 'reviewing',
      lastReviewedAt: null,
    };
    const a = computeSrsUpdate(backfilled, true, NOW);
    expect(a.kind).toBe('upsert');
    if (a.kind !== 'upsert') return;
    expect(a.repetition).toBe(1);
    expect(daysFromNow(a.dueDate)).toBe(1);
  });
});

describe('computeSrsUpdate — 連続正解で間隔が伸びる', () => {
  it('rep が進むほど due が先になる（昨日復習済みから）', () => {
    const yesterday = (d: number) => new Date(NOW.getTime() - d * DAY_MS - 9 * 60 * 60 * 1000);
    // rep2, interval6 の状態から、別日に正解 → rep3, interval round(6*2.5)=15
    const a = computeSrsUpdate(
      { easeFactor: 2.5, repetition: 2, interval: 6, status: 'reviewing', lastReviewedAt: yesterday(1) },
      true,
      NOW,
    );
    expect(a.kind).toBe('upsert');
    if (a.kind !== 'upsert') return;
    expect(a.repetition).toBe(3);
    expect(a.interval).toBe(15);
    expect(daysFromNow(a.dueDate)).toBe(15);
  });
});

describe('computeSrsUpdate — 卒業と復帰（FR-018/019）', () => {
  it('閾値到達で graduated', () => {
    // rep3, interval12 → 正解で rep4, interval=round(12*2.5)=30 → 卒業
    const a = computeSrsUpdate(
      { easeFactor: 2.5, repetition: 3, interval: 12, status: 'reviewing', lastReviewedAt: null },
      true,
      NOW,
    );
    expect(a.kind).toBe('upsert');
    if (a.kind !== 'upsert') return;
    expect(a.status).toBe('graduated');
    expect(a.interval).toBeGreaterThanOrEqual(30);
  });

  it('graduated を誤答 → reviewing に復帰・翌日 due（同日ガードは効かない）', () => {
    const graduated: ExistingSrs = {
      easeFactor: 2.5,
      repetition: 5,
      interval: 60,
      status: 'graduated',
      lastReviewedAt: new Date('2026-06-01T02:00:00Z'), // 今日でも不正解は処理される
    };
    const a = computeSrsUpdate(graduated, false, NOW);
    expect(a.kind).toBe('upsert');
    if (a.kind !== 'upsert') return;
    expect(a.status).toBe('reviewing');
    expect(a.repetition).toBe(0);
    expect(daysFromNow(a.dueDate)).toBe(1);
  });
});
