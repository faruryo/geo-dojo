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
  readonly graduatedNames?: readonly string[]; // 定着した問題名（1問1件、graduatedQuestionNames）
}
```

- 見出し「今回の復習の成果」。
- 定着が1件以上: チップより上に緑の強調行「🎉 {n}件 定着しました」（件数は大きく）と、定着した問題名（3件まで `・` 区切り、超過分は「ほかN件」）を出す。定着チップは出さない。
- 定着0件: チップ `🎉 定着 0件` を出す。
- チップ: `🔄 復習継続 {n}件`、`⚠️ 保存失敗 {n}件`（保存失敗は1件以上のときだけ）。
- `summary === null` のときは同じ高さのスケルトンを表示する。

## ReviewOutcomeDetails（表示専用）

```ts
interface ReviewOutcomeDetailsProps {
  readonly questions: readonly ReviewOutcomeQuestion[];
}
```

- `<details>`（初期状態は閉じる）。`<summary>` は「問題ごとの結果（{n}問）」。
- 1問ごとに、正誤マーク（✓／✗）・問題名・よみがなを表示する。
  - 各行は2列。左が県名とラベル、右が残り回数。
  - 行が2件以上（Mode A 多県）: 県ごとのサブ行。問題は分けない。
- 並びは `groupOutcomeQuestions`。残り回数の少ない順に「あとN回 M問」（同じ回数は出題順、0件は出さない）。複数県は県の最小回数のまとまりに置き、行の右は県ごとの回数。続く見出しなしの枠は「最速20回以上」だけの問題。その後「卒業 M問」「保存失敗 M問」（0件は出さない）。
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

残り回数: `最速あと{n}回` ／ `最速20回以上`。

## design-sync

- `ReviewOutcomeSummary` / `ReviewOutcomeDetails` は Server Action を値 import しないので同期対象に入れる（entry / componentSrcMap / dtsPropsFor / previews）。
- `QuizResultCard` の `dtsPropsFor` に `footer` を追加する。
