import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * `.design-sync/config.json` の `dtsPropsFor` はコンポーネントのソースから手で写した
 * 写しで、props を変えても自動では追随しない（AGENTS.md「Claude Design 同期」参照）。
 * 実際に `ModePreviewFrame` へ `caption` を足したとき写し忘れ、同期先のプレビューが
 * 説明文なしで描画される状態になった。その再発をここで止める。
 *
 * 走査は正規表現を避けて素直に文字列を辿る。props の型は入れ子の `{}` を含みうるので、
 * `[\s\S]*?` でまたごうとすると後戻りが膨らむ。
 */

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

interface Config {
  readonly componentSrcMap: Record<string, string>;
  readonly dtsPropsFor: Record<string, string>;
}

const config = JSON.parse(read('.design-sync/config.json')) as Config;
const entry = read('.design-sync/entry.tsx');
const declaredProps = new Map(Object.entries(config.dtsPropsFor));

/** `open` の位置から対応する閉じ括弧までの中身を返す */
function balanced(source: string, open: number, o: string, c: string): string | null {
  if (source.charAt(open) !== o) return null;
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    const ch = source.charAt(i);
    if (ch === o) depth += 1;
    else if (ch === c) {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  return null;
}

/**
 * 引数リストを「分割代入パターン」と「型注釈」に割るコロンの位置。
 *
 * 素朴に lastIndexOf すると `Readonly<{ caption: string; children: ReactNode }>` のような
 * インライン型の中の最後のコロンを拾い、注釈が `ReactNode }>` に切れて検査ごと落ちる。
 * 逆に indexOf だと `{ a: b }` のリネーム付き分割代入で落ちる。入れ子の外側から探す。
 */
function topLevelColon(params: string): number {
  let depth = 0;
  for (let i = 0; i < params.length; i += 1) {
    const ch = params.charAt(i);
    if (ch === '{' || ch === '(' || ch === '[' || ch === '<') depth += 1;
    else if (ch === '}' || ch === ')' || ch === ']' || ch === '>') depth -= 1;
    else if (ch === ':' && depth === 0) return i;
  }
  return -1;
}

/** `function Name(...)` の props 型注釈。取れなければ null */
function propsAnnotation(source: string, name: string): string | null {
  const at = source.indexOf(`function ${name}(`);
  if (at === -1) return null;
  const params = balanced(source, source.indexOf('(', at), '(', ')');
  if (params === null) return null;
  const colon = topLevelColon(params);
  return colon === -1 ? null : params.slice(colon + 1).trim();
}

/** 型注釈から props 本体（`{}` の中身）を解決する。inline と named type の両方を辿る */
function propsBody(source: string, annotation: string): string | null {
  const inlineAt = annotation.indexOf('{');
  if (inlineAt !== -1) return balanced(annotation, inlineAt, '{', '}');

  const typeName = annotation.replace('Readonly<', '').replace('>', '').trim();
  if (!typeName) return null;
  for (const head of [`interface ${typeName}`, `type ${typeName} =`]) {
    const at = source.indexOf(head);
    if (at === -1) continue;
    const brace = source.indexOf('{', at);
    if (brace !== -1) return balanced(source, brace, '{', '}');
  }
  return null;
}

function propNames(body: string): string[] {
  return body
    .split('\n')
    .map((line) => /^\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)\??\s*:/.exec(line))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => m[1]);
}

/** props をインライン型で書いているもの。ここがこぼれると検査が骨抜きになる */
const EXPECT_CHECKED = [
  'ModePreviewFrame',
  'EmptyState',
  'FilterBar',
  'InViewMount',
  'MilestoneBanner',
];

describe('.design-sync/ の同期契約', () => {
  it('entry.tsx の export はすべて componentSrcMap に登録されている', () => {
    const exported = [...entry.matchAll(/export \{ (\w+) \} from/g)].map((m) => m[1]);

    expect(exported.length).toBeGreaterThan(10);
    for (const name of exported) {
      expect(Object.keys(config.componentSrcMap)).toContain(name);
    }
    // props を持たないコンポーネント（MuteToggle 等）は dtsPropsFor を持たなくてよい。
    // props があるのに登録が無い・古い場合は次のテストが拾う
  });

  it('dtsPropsFor がコンポーネントの props 名を取りこぼしていない', () => {
    const missing: string[] = [];
    const checked: string[] = [];

    for (const [name, src] of Object.entries(config.componentSrcMap)) {
      const source = read(src.replace(/^\.\//, ''));
      const annotation = propsAnnotation(source, name);
      if (annotation === null) continue;
      const body = propsBody(source, annotation);
      if (body === null) continue;

      const names = propNames(body);
      if (names.length === 0) continue;
      checked.push(name);

      const declared = declaredProps.get(name) ?? '';
      for (const prop of names) {
        if (!propNames(declared).includes(prop)) missing.push(`${name}.${prop}`);
      }
    }

    // パースできない形はスキップするため、検査対象が痩せて骨抜きにならないことを担保する。
    // 件数の下限だけだと、インライン型のコンポーネントが全部こぼれても通ってしまう
    expect(checked).toEqual(expect.arrayContaining(EXPECT_CHECKED));
    expect(checked.length).toBeGreaterThanOrEqual(17);
    expect(missing).toEqual([]);
  });
});
