# Research & Decisions: 020-prefecture-quiz-enhancement

## 1. 出題生成ロジック (`buildPrefectureQuestions`)

### Decision
`lib/quiz/prefecture-quiz.ts` に純粋関数 `buildPrefectureQuestions` を定義する。
- 引数:
  - `settings: { regions: Region[]; count: 10 | 20 | 'all'; weaknessFirst: boolean }`
  - `weaknessMap?: Map<string, number>` (都道府県名 -> 誤答数または誤答率)
  - `randomFn?: () => number` (テスト用)
- 処理:
  - 選択された地域（`getRegionsPrefectures(regions)`）の都道府県をプールとする。
  - `weaknessFirst` が有効な場合は誤答データに基づいて重み付け/優先配置。
  - 要求問題数（`count === 'all'` の場合はプール全件、数値の場合は `min(count, pool.length)`）を抽出してシャッフル。

---

## 2. タイム計測とフォーマット (`formatClearTime`)

### Decision
- 所要時間（ミリ秒）から `M:SS.ss`（1分以上）または `SS.ss`（1分未満）への整形を行う純粋関数 `formatClearTime` を作成。
- タイムアタック時の自己ベスト保存は localStorage（キー: `geodojo-pref-best:${regionsKey}:${count}`）を利用。

---

## 3. UI/UX 設計 (Setup -> Playing -> Result)

### Decision
`/quiz/prefecture/page.tsx` を以下の3フェーズに構造化する。
1. **Setup Phase**:
   - 地域選択（全国 / 地方別）
   - 出題数（10問 / 20問 / 全問）
   - モード選択（通常モード / タイムアタックモード）
   - 苦手優先トグル
2. **Playing Phase**:
   - 進行状況（`3 / 10`）
   - タイマー表示（経過時間）
   - `JapanMap` による地図タップ
   - 回答時の読み仮名付きフィードバック
3. **Result Phase**:
   - 正答率、クリアタイム、自己ベスト更新表示
   - 苦手な都道府県（ふりがな付き）一覧
   - 「もう一度」「設定に戻る」ボタン
