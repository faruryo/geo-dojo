# geo-dojo の使い方

日本の地理クイズ PWA。モバイル縦持ち（375px 基準）とダークモードが前提で、
明色テーマは存在しない。

## 前提とセットアップ

- **プロバイダは不要。** どのコンポーネントも単体でマウントできる。ルートに
  ラッパーを置く必要はない。
- **必ずダークで組む。** アプリは `<html class="dark">` を固定で当てている。
  トークンの実値は `.dark` 側にしかないので、ルート要素に `dark` クラスを付ける
  か、地の色を `var(--background)`（`#111111`）で明示すること。付け忘れると
  明色トークンにフォールバックし、アプリと違う見た目になる。
- **フォントは Geist Sans。** 未指定なら `system-ui` に落ちる。
- **同期対象外**: `QuizRunner`（出題セッションの制御）と dashboard のデータ
  取得カード（`SummaryCards` / `AccuracyChart` 等）は、サーバアクション経由で
  DB を読むためブラウザに載せられない。画面を組むときは、それらの presentational
  な部品（`QuizHeader` / `QuizQuestionCard` / `ChoiceView` / `QuizResultCard`）を
  自分で並べる。

## スタイルの書き方

Tailwind CSS v4 のユーティリティクラス＋ shadcn/ui のトークン。新しい色を作らず、
必ず下のトークンを使う。

| 用途 | クラス / 変数 |
|---|---|
| 地 | `bg-background`（`--background` = `#111111`） |
| 文字 | `text-foreground` / 補助は `text-muted-foreground` |
| カード | `bg-card` + `rounded-xl`（`--radius` = `0.625rem`） |
| 罫線 | `border-border`（`--border` = `oklch(1 0 0 / 10%)`） |
| 主ボタン | `bg-primary text-primary-foreground` |
| 危険・誤答 | `text-destructive` |

角丸は `rounded-lg`（10px）か `rounded-xl`。4/8px グリッドに丸めず、
既存コンポーネントの値をそのまま使うこと。

**タップ領域は 44×44px 以上。** `app/globals.css` が `button`, `a`,
`[role="button"]` に `min-height: 44px; min-width: 44px` を効かせている。

**地図の色は意味を持つ固定値**で、トークンではない。変えないこと:
通常 `#2a2a2a` / 正解 `#4a7c59` / 選択中 `#3b82f6` / 誤答 `#ef4444` /
境界 `#444444`。タイマーは残量で `#22c55e` → `#eab308` → `#ef4444`。

## 正となる場所

- スタイルの実体: `_ds/<folder>/styles.css`（`_ds_bundle.css` を `@import`
  している。トークン定義もここ）
- 各コンポーネントの API: `components/<group>/<Name>/<Name>.d.ts`
- 使い方: `components/<group>/<Name>/<Name>.prompt.md`
- 設計方針: `guidelines/`

## 典型的な組み方

```jsx
<div className="dark flex flex-col gap-2 bg-background p-3">
  <QuizHeader currentIndex={2} totalQuestions={10} correctCount={2} onAbort={handleAbort} />
  <QuizQuestionCard
    promptText="この市区町村がある都道府県を地図でタップ"
    title="府中市"
    subTitle="2 か所あります"
    difficulty="hard"
    feedback="idle"
  />
  <ChoiceView
    choices={['山形県', '秋田県', '新潟県', '福島県']}
    selectedChoice={null}
    correctChoice="山形県"
    feedback="idle"
    onSelectChoice={handleSelect}
  />
</div>
```

レイアウトは flex / grid と `gap` で組む。要素ごとの margin は使わない。
