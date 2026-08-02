import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 回帰防止: server コード（app/・lib/）で public/ のファイルを実行時に fs 読みしないこと。
 *
 * Vercel の serverless 関数バンドル(/var/task)に public/ の静的アセットは含まれず、
 * `fs.readFileSync(path.join(process.cwd(), 'public', ...))` は本番で ENOENT になる。
 * ローカルでは public/ が存在するため再現せず、過去にクイズ結果が9日間サイレントに
 * 保存されない本番障害を起こした（PR #12）。検証データ等は DB から取得すること。
 *
 * NOTE: scripts/ はビルド時実行なので対象外（public/ 読み書きは許容）。
 */
const ROOT = path.resolve(__dirname, '..', '..');
const SCAN_DIRS = ['app', 'lib'];

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

describe('server コードは public/ を実行時 fs 読みしない (PR#12 回帰防止)', () => {
  const files = SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d)));

  it('対象ファイルが存在する（スキャンが空振りしていない）', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('fs read と public/ の組み合わせを含むファイルが無い', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf-8');
      const readsFile = /readFileSync?\s*\(|\.readFile\s*\(/.test(src);
      const touchesPublic = /['"`]public['"`]|\/public\//.test(src);
      if (readsFile && touchesPublic) {
        offenders.push(path.relative(ROOT, file));
      }
    }
    expect(offenders, `public/ を実行時 fs 読みしている可能性: ${offenders.join(', ')}`).toEqual([]);
  });
});
