# Data Model: 復習完了時のSRS進捗・定着可視化

DB スキーマの変更はない。以下はすべてアプリ内の型（永続化しない）。

## SrsSnapshotKey

| フィールド | 型 | 説明 |
|---|---|---|
| `municipalityCode` | `string` | 5桁の自治体コード（Mode A は県別代表コード） |
| `mode` | `'A' \| 'B' \| 'C' \| 'D'` | 出題モード |

出題からの導出（`questionSrsKeys`）:

- Mode A: `dedupeInstancesByPrefecture(question.instances)` の各要素 → `{ code, 'A' }`。保存時の `useModeAAction` と同じ関数・同じ順序。
- B/C/D: `{ question.municipality.code, question.mode }`。

## SrsSnapshotEntry

| フィールド | 型 | 説明 |
|---|---|---|
| `municipalityCode` / `mode` | キーと同じ | |
| `record` | `SrsSnapshotRecord \| null` | `srs_records` の行。無ければ `null` |
| `everWrong` | `boolean` | `municipality_quiz_results` に同ユーザー・同コード・同モードの誤答が1件以上あるか |

`SrsSnapshotRecord`: `easeFactor: number`, `repetition: number`, `interval: number`, `status: 'reviewing' | 'graduated'`, `dueDate: string`（ISO）, `lastReviewedAt: string | null`（ISO）。

## QuestionSaveMeta

| フィールド | 型 | 説明 |
|---|---|---|
| `questionIndex` | `number` | 回答した問題の番号（`state.qIdx`、0始まり） |
| `persisted` | `boolean` | `executeQuizAdvance` の `persisted`（クイズ結果＋SRS のトランザクション成功） |
| `mode` | `GameMode` | |
| `isCorrect` | `boolean` | |
| `codes` | `string[]` | 保存したコード（`entries` の順） |
| `srsSkippedCodes` | `string[]` | 保存時に同日ガードで SRS を更新しなかったコード。`saveMunicipalityQuizResults` の戻り値 `srsSkippedCodes` をそのまま入れる。保存失敗時は空 |

整合ガード（`isSaveMetaConsistent(questions, meta, resultCount)`）は、次のすべてを満たすときだけ真を返す。

1. `meta.length === resultCount`
2. `questionIndex` が `0..resultCount-1` の範囲内で重複しない
3. 各 meta の `mode` と `codes` が `questionSrsKeys(questions[questionIndex])` と順序込みで一致する
4. `srsSkippedCodes` がすべて `codes` に含まれる

## 行ラベル（OutcomeLabel）の判定表

入力: `persisted`, `isCorrect`, `srsSkipped`（その行のコードが `srsSkippedCodes` に含まれるか）, `pre: SrsSnapshotEntry | undefined`, `post: SrsSnapshotEntry | undefined`, `now`。上から順に評価し、最初に当てはまったものを採用する。

| # | 条件 | `kind` | 表示 |
|---|---|---|---|
| 1 | `!persisted` | `saveFailed` | ⚠️ 保存失敗 |
| 2 | `isCorrect && (srsSkipped \|\| (pre.record && post.record.lastReviewedAt === pre.record.lastReviewedAt))` | `sameDay` | ⏸️ 同日回答済み |
| 3 | `!isCorrect && pre.record?.status === 'graduated'` | `relapsed` | ⚠️ 復習に戻りました（明日もう一度） |
| 4 | `!isCorrect` | `retryTomorrow` | 🔄 明日もう一度 |
| 5 | `post.status === 'graduated' && pre.record?.status === 'graduated'` | `kept` | 🎓 定着維持 |
| 6 | `post.status === 'graduated'` | `graduated` | 🎉 卒業（定着達成） |
| 7 | それ以外 | `scheduled` (`daysUntil`) | 📅 次回 今日／明日／N日後 |

`daysUntil = diffJSTCalendarDays(post.dueDate, now)`。0以下は「今日」、1は「明日」、2以上は「N日後」。

保存成功なのに `post.record` が無い行がある場合は不整合として扱い、成果全体をフォールバックにする（`buildReviewOutcome` が `null` を返す）。

## 残り回数（remainingSteps）

- 対象: ラベルが `saveFailed` 以外で、かつ `post.record.status === 'reviewing'` の行。
- 入力: `post.record` の `easeFactor` / `repetition` / `interval`、`effectiveEverWrong = (pre?.everWrong ?? false) || !isCorrect`。
- `simulateStepsToGraduation` の戻り値: `1..20` の整数、または `null`（20回以内に卒業しない）。
- 表示: `最速あと{n}回` ／ `null` のとき `最速20回以上`。
- 画面上の並びは `questions` の保存順とは別。`groupOutcomeQuestions` が残り回数の少ないまとまり（複数県は最小値、同じ回数は元の順）、「最速20回以上」だけの問題、卒業、保存失敗の順に組む。`questions` 自体は results と同じ順のまま。

シミュレーション手順（1ステップ）: `result = applySm2(state, 5)`、`graduated = (!everWrong && result.repetition >= 2) || result.graduated`。卒業すればそのステップ数を返し、しなければ `state = result` で続ける。

## ReviewOutcome

```text
ReviewOutcome
├── summary: { graduated: number; continuing: number; saveFailed: number }
└── questions: ReviewOutcomeQuestion[]   // results と同じ順・同じ件数
      ├── name / kana                    // results[i] の表示名（Mode D の区名正規化済み）
      ├── mode / isCorrect
      ├── category: 'graduated' | 'continuing' | 'saveFailed'
      └── rows: ReviewOutcomeRow[]       // 保存コード単位（Mode A 多県は県ごと）
            ├── code / prefecture
            ├── label: OutcomeLabel
            └── remainingSteps?: number | null   // 未定義 = 表示しない
```

問題の分類: `!persisted` → `saveFailed`、全行の `post.record.status === 'graduated'` → `graduated`、それ以外 → `continuing`。不変条件は `graduated + continuing + saveFailed === results.length`。
