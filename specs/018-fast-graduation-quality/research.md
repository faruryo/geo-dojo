# Research & Decisions: 018-fast-graduation-quality

## 1. SM-2 Quality の段階化と閾値設計

### Decision
`ReviewQuality` 型を `2 | 4 | 5` に拡張し、純粋関数 `determineReviewQuality` で評価を決定する。
- 不正解 (`!isCorrect`): `2`
- 正解かつ 10秒以内 (`isCorrect && answerTimeMs != null && answerTimeMs <= 10000`): `5`
- 正解かつ上記以外 (`isCorrect && (answerTimeMs == null || answerTimeMs > 10000)`): `4`

### Rationale
- SM-2 アルゴリズムの標準計算式において：
  - `q=5` の場合: $\Delta EF = +0.10$（間隔拡大が加速）
  - `q=4` の場合: $\Delta EF = 0.00$（現在の拡大率を維持）
  - `q=2` の場合: 不正解リセット（$EF$ 低下 + repetition=0, interval=1）
- 10秒（10,000ms）は、テキスト4択問題（Mode B/C）での即答はもちろん、地図タップ問題（Mode A/D）においても位置が頭に入っていて即座にタップしたとみなせる妥当な閾値。

### Alternatives Considered
- モード別閾値（4択=5秒、地図=12秒など）: 初期の複雑性を抑えるため、全モード一律10秒とし、将来の実データ検証で調整可能にする。

---

## 2. 早期卒業条件の設計 (Fast Graduation)

### Decision
卒業条件（`graduated`）を以下のいずれかを満たす場合とする：
1. **誤答歴なし早期卒業（既存 009 仕様）**: `!everWrong && isCorrect && repetition >= 2`
2. **速答定着による早期卒業（新規）**: `isCorrect && quality === 5 && repetition >= 3 && interval >= 15`
3. **通常卒業（既存仕様）**: `repetition >= 4 && interval >= 30`

### Rationale
- 誤答歴がある問題でも、復習で速答（q=5）を重ねて rep=3（interval=16）に達した場合、最短 3回の復習（Day 0 -> Day 1 -> Day 7 -> Day 23）で卒業となる。
- まぐれ正解ではなく、3回連続で別日に正解かつ即答できるレベルに達しているため、十分に定着したとみなせる。
- 通常正解（q=4）の場合は従来どおり 4回正解（interval>=30）を要求し、安全性を担保。

---

## 3. I/O 境界とアーキテクチャ

### Decision
- 判断ロジック（`determineReviewQuality`, `applySm2`, `computeSrsUpdate`）はすべて純粋関数として `lib/quiz/srs/` 配下に配置する。
- DB アクセス・認証・Server Action（`app/(app)/quiz/municipality/actions.ts`）は引数を仲介する境界にとどめる。
- DB スキーマの変更は不要（`answer_time_ms` は 017 で追加済み）。

### Rationale
- `.agents/rules/testing.instructions.md` の「判断とI/Oを分離する」原則に完全準拠。
- Vitest で新規・境界値・エッジケースを高速かつ決定論的にテスト可能。
