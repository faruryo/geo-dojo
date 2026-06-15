# Phase 0 Research: 市区町村クイズの問題に難易度を表示

spec に `[NEEDS CLARIFICATION]` は残っていない（モードA の代表難易度ルールは clarify 済み）。
本フェーズでは実装方針に関わる既存実装の確認結果を整理する。

## Decision 1: 難易度データの取得元

- **Decision**: 既存の `Municipality.difficulty`（`lib/quiz/municipality-data.ts`）をそのまま使用する。新規取得・算出は行わない。
- **Rationale**: 市区町村マスタ（`municipality_master.difficulty`）が TanStack Query（`useMunicipalityMaster`）経由でクライアントに既にロードされ、`app/(app)/quiz/municipality/[mode]/page.tsx:173` と `app/(app)/quiz/review/page.tsx:43` で各 `Municipality` に `difficulty` がマップされている。`QuizRunner` の各問題（`instances` / `municipality`）も同じオブジェクトを保持する。
- **Alternatives considered**:
  - 別途 API で難易度を取得 → 不要なネットワーク・複雑化のため却下。
  - 結果保存時に難易度を記録 → 表示要件には不要、Write 経路を増やすため却下。

## Decision 2: モードA の代表難易度ルール

- **Decision**: 出題対象（`ModeAQuestion.instances`）のうち**最も難しい**難易度を代表値とする。`DIFFICULTIES = ['easy','medium','hard','expert']` の配列インデックスが大きいものを最難とする。
- **Rationale**: spec の Clarification（2026-06-16）で確定。モードA は「同名の全該当県を当てる」課題のため、最難の対象を知っている必要があり、最高難易度を代表とするのが体感と整合する。`DIFFICULTIES` が既に昇順で定義されているためインデックス比較で実装でき、新たな順序定義が不要。
- **Alternatives considered**:
  - 最頻値 → 同数時のタイブレークが別途必要で複雑。却下。
  - 混在時は非表示 → 情報量が落ちる。clarify で不採用。

## Decision 3: 難易度が欠落している場合の扱い

- **Decision**: 代表難易度が `undefined`（対象に難易度を持つものが一つもない）の場合はバッジを描画しない（FR-005）。
- **Rationale**: 誤った難易度を出さず、レイアウトも崩さない。`Municipality.difficulty` は型上 optional。
- **Alternatives considered**: 「不明」ラベル表示 → ノイズになり UX 低下のため却下。

## Decision 4: 表示コンポーネントと位置

- **Decision**: 既存の shadcn/ui `Badge`（`components/ui/badge`、`QuizRunner` で import 済み）と既存 `DIFFICULTY_LABEL`（星付きラベル）を用い、問題カード（`rounded-xl bg-card p-3 text-center` ブロック）内の問題文近傍に配置する。
- **Rationale**: 表記の一貫性（FR-002）。`Badge` は設定画面（`[mode]/page.tsx:344` の `DIFFICULTY_LABEL[d]`）でも難易度表記に使われており既存パターンに沿う。進捗表示（`N / M`・`N 正解`・残り秒数）とは別ブロックのため競合しない（FR-006 / SC-004）。
- **Alternatives considered**: 進捗ヘッダー行に追加 → 行が窮屈になりモバイルで折り返す懸念。却下。

## Decision 5: テスト戦略

- **Decision**: `representativeDifficulty()` を純粋関数として切り出し、`__tests__/lib/quiz/representative-difficulty.test.ts` で Vitest 単体テスト（単一・混在・欠落・空配列）。UI 描画は手動確認（`pnpm dev`）。
- **Rationale**: プロジェクト方針「データ／判定ロジックは手動 DB いじりでなく純粋関数＋Vitest で検証」に一致。既存 `__tests__/lib/quiz/mode-a-dedupe.test.ts` と同じ場所・流儀。
- **Alternatives considered**: コンポーネントテスト導入 → 現状リポジトリに UI テスト基盤がなく、表示ロジックが単純なため過剰。却下。
