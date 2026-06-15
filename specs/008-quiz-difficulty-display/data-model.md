# Phase 1 Data Model: 市区町村クイズの問題に難易度を表示

本機能は新規の永続エンティティを導入しない（DB スキーマ変更なし）。既存の型と、追加する派生ロジックのみを記述する。

## 既存型（再利用）

### Difficulty

- 定義: `lib/quiz/municipality-data.ts`
- 値: `'easy' | 'medium' | 'hard' | 'expert'`
- 順序: `DIFFICULTIES = ['easy', 'medium', 'hard', 'expert']`（昇順＝左が易しい、右が難しい）
- 表記: `DIFFICULTY_LABEL`（`☆ 入門` / `☆☆ 中級` / `☆☆☆ 上級` / `☆☆☆☆ 達人`）

### Municipality

- 定義: `lib/quiz/municipality-data.ts`
- 関連フィールド: `difficulty?: Difficulty`（市区町村マスタ由来、optional）

### Question（`components/quiz/quiz-runner.tsx`）

- `ModeAQuestion`: `{ kind: 'A'; name; instances: Municipality[]; correctPrefectures }`
  - 表示する難易度は `instances` 全体から導出
- `SingleQuestion`: `{ kind: 'BCD'; mode: 'B'|'C'|'D'; municipality: Municipality; choices }`
  - 表示する難易度は `municipality.difficulty`

## 追加する派生ロジック（純粋関数）

### representativeDifficulty(municipalities: Municipality[]): Difficulty | undefined

- 配置: `lib/quiz/municipality-data.ts`
- 入力: 1 件以上の `Municipality`（0 件も許容）
- 出力: 対象のうち最も難しい（`DIFFICULTIES` のインデックス最大の）`difficulty`。難易度を持つ要素が一つもない／空配列なら `undefined`
- 規則（FR-007 / FR-005）:
  - `difficulty === undefined` の要素は無視する
  - 全要素が `undefined`、または入力が空 → `undefined` を返す
  - 比較は `DIFFICULTIES.indexOf()` の大小で行う
- 用途:
  - モードA: `representativeDifficulty(question.instances)`
  - モードB/C/D: 単一要素のため `representativeDifficulty([question.municipality])` でも `municipality.difficulty` でも可（実装は前者で統一すると分岐が減る）

## 状態遷移

なし。難易度表示は `currentQuestion` から純粋に導出される読み取り専用の派生値であり、解答・フィードバック・問題遷移によって独自の状態を持たない（問題が変われば自動的に再計算される）。
