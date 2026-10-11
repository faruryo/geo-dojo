import { describe, expect, it } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { getFilterCondSql, type QuizModeFilter } from '@/lib/db/queries/sql-helpers';

const dialect = new PgDialect();

function render(mode: QuizModeFilter): string {
  const cond = getFilterCondSql(mode);
  return cond ? dialect.sqlToQuery(cond).sql : '';
}

const TOKYO_WARD = `= '東京都'`;

describe('getFilterCondSql', () => {
  it.each(['A', 'B', 'C'] as const)('Mode %s は同名と東京23区を除く', (mode) => {
    const sql = render(mode);
    expect(sql).toContain('REGEXP_REPLACE');
    expect(sql).toContain(TOKYO_WARD);
  });

  it('Mode D は除外しない', () => {
    expect(render('D')).toBe('');
  });

  it('モード「全て」は D 以外に同名と東京23区の除外をかける', () => {
    const sql = render('all');
    expect(sql).toContain(`= 'D' OR`);
    expect(sql).toContain(TOKYO_WARD);
  });
});
