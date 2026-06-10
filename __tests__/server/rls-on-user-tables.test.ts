import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 回帰防止: user_id を持つユーザーデータ表は必ず RLS を有効化すること。
 *
 * RLS は drizzle schema 管理外なので `drizzle-kit generate` では付与されず、
 * migration SQL に手動同梱する運用（AGENTS.md 参照）。そのため有効化漏れが起きやすい。
 * 実際 `municipality_quiz_results` は RLS 無効のまま作成され、Supabase Data API
 * (PostgREST) + publishable key 経由で全ユーザーのクイズ履歴が read/改ざん/削除
 * できる状態だった。アプリは Drizzle/DATABASE_URL（RLS バイパス）経由なので
 * アプリ側からは漏れに気付けない。
 *
 * 本テストは migration SQL を静的走査し、user_id 列を持つ全テーブルについて
 * ENABLE ROW LEVEL SECURITY が存在することを検査する。
 */
const ROOT = path.resolve(__dirname, '..', '..');
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');

/** `--` 行コメントを除去（コメントアウトされた SQL を有効扱いしないため） */
function stripLineComments(sql: string): string {
  return sql.replace(/--.*$/gm, '');
}

function readAllMigrationSql(): string {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const raw = files
    .map((f) => fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf-8'))
    .join('\n');
  return stripLineComments(raw);
}

/** CREATE TABLE ブロックを抽出し、本文に user_id 列を含むテーブル名を返す */
function userDataTables(sql: string): string[] {
  const tables: string[] = [];
  const re = /CREATE TABLE(?:\s+IF NOT EXISTS)?\s+"([^"]+)"\s*\(([\s\S]*?)\)\s*;/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const [, name, body] = m;
    if (/"user_id"/.test(body)) tables.push(name);
  }
  // 同名テーブルが複数 migration で出てくる場合に備えユニーク化
  return [...new Set(tables)];
}

describe('user_id を持つテーブルは RLS 有効（broken access control 回帰防止）', () => {
  const sql = readAllMigrationSql();
  const tables = userDataTables(sql);

  it('user_id を持つテーブルが検出される（スキャンが空振りしていない）', () => {
    expect(tables.length).toBeGreaterThan(0);
  });

  it.each(tables)('%s に ENABLE ROW LEVEL SECURITY がある', (table) => {
    const enabled = new RegExp(
      `ALTER TABLE\\s+"${table}"\\s+ENABLE ROW LEVEL SECURITY`,
      'i',
    ).test(sql);
    expect(
      enabled,
      `テーブル "${table}" は user_id を持つが RLS が有効化されていません。` +
        `migration SQL に ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY と ` +
        `auth.uid() スコープのポリシーを手動同梱してください。`,
    ).toBe(true);
  });
});
