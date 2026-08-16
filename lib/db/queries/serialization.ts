/**
 * DB クエリ結果のシリアライズユーティリティ。
 * Date オブジェクトを ISO 文字列に、bigint を number に変換する。
 */
function stripDates(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj.toISOString();
  if (typeof obj === 'bigint') return Number(obj);
  if (Array.isArray(obj)) return obj.map(stripDates);
  if (typeof obj === 'object') {
    const entries = Object.entries(obj as Record<string, unknown>).map(
      ([k, v]) => [k, stripDates(v)],
    );
    return Object.fromEntries(entries);
  }
  return obj;
}

export function serialize<T>(data: T): T {
  return stripDates(data) as T;
}
