import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 回帰防止: supabase/migrations の SQL はすべて drizzle の journal に載っていること。
 *
 * `drizzle-kit migrate`（本番 CI の migrate.yml）は meta/_journal.json に載った
 * migration しか適用しない。一方 `supabase db reset` はフォルダ内の SQL を名前順に
 * 全部適用するので、journal 漏れはローカルでは気付けない。実際
 * `0003_cleanup_same_name_history` と `0004_add_answer_time_ms` が journal に無く、
 * 新規 DB を drizzle-kit migrate で作ると answer_time_ms 列が欠けて推薦取得が失敗した。
 *
 * drizzle は「DB に記録された最後の created_at より when が大きい migration」だけを
 * 適用するため、when は tag の並びどおり単調増加である必要がある。
 */
const MIGRATIONS_DIR = path.resolve(__dirname, '..', '..', 'supabase', 'migrations');

interface JournalEntry { idx: number; when: number; tag: string }

function readJournal(): JournalEntry[] {
  const raw = fs.readFileSync(path.join(MIGRATIONS_DIR, 'meta', '_journal.json'), 'utf-8');
  return (JSON.parse(raw) as { entries: JournalEntry[] }).entries;
}

describe('migration journal', () => {
  const entries = readJournal();

  it('フォルダ内の SQL と journal の tag が過不足なく一致する', () => {
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => f.replace(/\.sql$/, ''))
      .sort((a, b) => a.localeCompare(b));
    expect(entries.map((e) => e.tag).sort((a, b) => a.localeCompare(b))).toEqual(files);
  });

  it('idx は 0 からの連番で、when は単調増加する', () => {
    entries.forEach((e, i) => {
      expect(e.idx).toBe(i);
      if (i > 0) expect(e.when).toBeGreaterThan(entries[i - 1].when);
    });
  });
});
