# Contract: 復習完了画面の構成と表示

## QuizResultCard（`components/quiz/quiz-result-card.tsx`）

追加 prop:

```ts
readonly footer?: React.ReactNode;
```

描画順: 戻るリンク → 「結果」→ 正答数 → 正答率 → `weakItems`（1件以上のときだけ）→ `children` → `actions` → `footer`。
`footer` 未指定の既存画面は DOM が変わらない。

## 復習ページでのスロット割り当て

| 成果の状態 | `weakItems` | `children` | `footer` |
|---|---|---|---|
| `loading`（回答後取得中） | `[]` | `<ReviewOutcomeSummary summary={null} />`（スケルトン） | `<UpcomingReviewMini />` |
| `ready` | `[]` | `<ReviewOutcomeSummary summary={…} />` | `<ReviewOutcomeDetails questions={…} />` + `<UpcomingReviewMini />` |
| `unavailable`（フォールバック） | 誤答一覧（従来） | なし | `<UpcomingReviewMini />` |

`actions`（続けて復習・おすすめ・ダッシュボード）は状態によらず同じ。

## ReviewOutcomeSummary（表示専用）

```ts
interface ReviewOutcomeSummaryProps {
  readonly summary: { graduated: number; continuing: number; saveFailed: number } | null;
}
```

- 見出し「今回の復習の成果」。
- チップ: `🎉 定着 {n}件`、`🔄 復習継続 {n}件`、`⚠️ 保存失敗 {n}件`（保存失敗は1件以上のときだけ）。
- `summary === null` のときは同じ高さのスケルトンを表示する。

## ReviewOutcomeDetails（表示専用）

```ts
interface ReviewOutcomeDetailsProps {
  readonly questions: readonly ReviewOutcomeQuestion[];
}
```

- `<details>`（初期状態は閉じる）。`<summary>` は「問題ごとの結果（{n}問）」。
- 1問ごとに、正誤マーク（✓／✗）・問題名・よみがなを表示する。
  - 行が1件: 同じブロックに県名・ラベル・残り回数を表示する。
  - 行が2件以上（Mode A 多県）: 県ごとのサブ行に県名・ラベル・残り回数を表示する。
- 文言は `formatOutcomeLabel` / `formatRemainingSteps`（`lib/quiz/srs/outcome.ts`）が正。

| `label.kind` | 文言 |
|---|---|
| `graduated` | 🎉 卒業（定着達成） |
| `kept` | 🎓 定着維持 |
| `relapsed` | ⚠️ 復習に戻りました（明日もう一度） |
| `retryTomorrow` | 🔄 明日もう一度 |
| `sameDay` | ⏸️ 同日回答済み |
| `scheduled` | 📅 次回 今日 ／ 📅 次回 明日 ／ 📅 次回 {N}日後 |
| `saveFailed` | ⚠️ 保存失敗 |

残り回数: `通常の速さならあと{n}回で卒業` ／ `通常の速さなら20回以上`。

## design-sync

- `ReviewOutcomeSummary` / `ReviewOutcomeDetails` は Server Action を値 import しないので同期対象に入れる（entry / componentSrcMap / dtsPropsFor / previews）。
- `QuizResultCard` の `dtsPropsFor` に `footer` を追加する。
