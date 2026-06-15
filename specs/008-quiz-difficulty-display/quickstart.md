# Quickstart: 市区町村クイズの問題に難易度を表示

## 変更点の概要

| ファイル | 変更 |
|----------|------|
| `lib/quiz/municipality-data.ts` | `representativeDifficulty(municipalities): Difficulty \| undefined` を追加 |
| `components/quiz/quiz-runner.tsx` | 問題カードに難易度 `Badge` を描画（モードA/B/C/D・復習共通） |
| `__tests__/lib/quiz/representative-difficulty.test.ts` | 純粋関数の単体テスト追加 |

## 実装メモ

### representativeDifficulty

```ts
// lib/quiz/municipality-data.ts
export function representativeDifficulty(
  municipalities: Municipality[],
): Difficulty | undefined {
  let best: Difficulty | undefined;
  for (const m of municipalities) {
    if (m.difficulty === undefined) continue;
    if (best === undefined || DIFFICULTIES.indexOf(m.difficulty) > DIFFICULTIES.indexOf(best)) {
      best = m.difficulty;
    }
  }
  return best;
}
```

### QuizRunner 側

- `currentQuestion` から導出:
  - `kind === 'A'` → `representativeDifficulty(currentQuestion.instances)`
  - `kind === 'BCD'` → `representativeDifficulty([currentQuestion.municipality])`
- 問題カード内（問題文の上または直下）に、値があるときだけ `<Badge variant="secondary">{DIFFICULTY_LABEL[difficulty]}</Badge>` を表示。
- `currentQuestion` 由来なのでフィードバック中も自動的に保持される（C-03）。

## 検証

```bash
pnpm test                 # representative-difficulty.test.ts が通ること
pnpm lint                 # 型チェック / Lint
pnpm dev                  # http://127.0.0.1:3000
```

手動確認（`pnpm dev`）:
1. `/quiz/municipality/A` 〜 `/D` を開き出題開始 → 各問題カードに難易度バッジが出る。
2. 次の問題へ進むとバッジが更新される。
3. 解答直後のフィードバック中もバッジが消えない。
4. 復習クイズ（`/quiz/review`）でも同様に表示される。
5. 375px 幅・ダークモードでレイアウトが崩れない。

## 受け入れ基準との対応

- US1 / FR-001〜003 → 出題ごとにバッジ表示・更新
- US2 / FR-004 → 全モード＋復習で共通（`QuizRunner` 一箇所）
- FR-005 → `undefined` 時は非表示
- FR-007 → モードA は `representativeDifficulty(instances)` で最高難易度
