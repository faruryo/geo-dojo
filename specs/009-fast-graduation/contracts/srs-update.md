# Contract: computeSrsUpdate（早期卒業対応）

## 関数シグネチャ（lib/quiz/srs/update.ts）

```ts
export function computeSrsUpdate(
  existing: ExistingSrs | null,
  isCorrect: boolean,
  now: Date,
  everWrong: boolean,   // ★追加: この (user, code, mode) に誤答履歴があるか
): SrsUpdateAction;
```

## 事後条件

| # | 前提 | 結果 |
|---|------|------|
| 1 | 正解・同日ガード該当 | `{ kind: 'skip' }`（不変） |
| 2 | 不正解 | SM-2 リセット、`status: 'reviewing'`（不変。everWrong の値に依存しない） |
| 3 | 正解・`everWrong=false`・新 repetition >= 2 | `status: 'graduated'`。easeFactor / interval / dueDate は SM-2 計算値のまま |
| 4 | 正解・`everWrong=true` | 従来の卒業判定のみ（interval>=30 && rep>=4） |
| 5 | 正解・`everWrong=false`・新 repetition = 1（新規初回正解） | `status: 'reviewing'`（卒業しない） |

## 呼び出し側の義務（actions.ts）

- 正解時: `municipality_quiz_results` への EXISTS（is_correct=false, 同一 user/code/mode）の結果を `everWrong` に渡す
- 不正解時: EXISTS 照会は不要（値は結果に影響しないため `true` を渡してよい）

## バックフィルスクリプト（scripts/backfill-early-graduation.ts）

- 入力: `DATABASE_URL`（環境変数）
- 動作: 述語 `status='reviewing' AND repetition>=2 AND NOT everWrong` に該当する `srs_records` を `status='graduated'` に UPDATE
- 出力: 対象件数・更新件数を stdout に表示
- 性質: 冪等（再実行で結果不変）。DELETE/INSERT なし
