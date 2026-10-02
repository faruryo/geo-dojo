# Contract: `getSrsSnapshot`（Server Action）

**Location**: `app/(app)/quiz/review/actions.ts`

```ts
export async function getSrsSnapshot(keys: SrsSnapshotKey[]): Promise<SrsSnapshotEntry[]>;
```

型は [data-model.md](../data-model.md) を参照。

## 入力検証（`validateSrsSnapshotKeys`、`lib/quiz/srs/snapshot.ts`）

| 条件 | 結果 |
|---|---|
| 配列でない／空配列 | throw `Invalid snapshot keys` |
| 101件以上 | throw `Too many snapshot keys` |
| 要素がオブジェクトでない | throw `Invalid snapshot key` |
| `mode` が `A`/`B`/`C`/`D` 以外 | throw `Invalid mode` |
| `municipalityCode` が `/^\d{5}$/` に一致しない | throw `Invalid municipality code` |
| 同一 `code::mode` の重複 | 1件に畳む（エラーにしない） |

## 振る舞い

1. `requireUserId()` で本人を確定する（未ログインは throw）。
2. `srs_records` を `user_id = 本人 AND municipality_code IN (codes)` で取得し、`(code, mode)` で突き合わせる。
3. `municipality_quiz_results` を `user_id = 本人 AND is_correct = false AND municipality_code IN (codes)` で `(code, mode)` を distinct 取得し、`everWrong` を決める。
4. 入力キー（重複除去後）と同じ順で `SrsSnapshotEntry[]` を返す。レコードが無いキーは `record: null`。
5. 日時は ISO 文字列で返す。
6. 失敗時はサーバで `console.error('[getSrsSnapshot] failed', …)` を出してから再 throw する（本番で digest に隠れる対策。既存の保存系と同じ方針）。

## 呼び出し側の約束

- 回答前: 出題確定後・出題開始前に1回。失敗したら `console.error` を出し、成果表示なしで出題を始める。
- 回答後: 保存成功した問題のキーだけで1回。0件なら呼ばない。
- いずれも 100件を超える場合は呼ばずにフォールバックにする。
- 書き込みは一切行わない（read-only）。Preview 環境が本番 DB を共有していても安全。
