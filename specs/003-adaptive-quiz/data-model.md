# Data Model: おすすめクイズ

**Branch**: `003-adaptive-quiz` | **Date**: 2026-05-28

## 既存テーブル（変更なし）

### municipality_quiz_results

推薦エンジンのプライマリソース。スキーマ変更不要。

| カラム | 型 | 制約 | 用途（推薦エンジン） |
|--------|-----|------|--------------------|
| id | uuid | PK, auto | — |
| user_id | uuid | NOT NULL | ユーザー別集計のフィルタ |
| municipality_code | text | NOT NULL | セル所属判定、カバレッジ算出 |
| municipality_name | text | NOT NULL | 推薦内容の表示 |
| prefecture | text | NOT NULL | セル所属判定（→ region 変換） |
| mode | text | NOT NULL | セル所属判定 |
| is_correct | boolean | NOT NULL | 正答率移動平均、cell-level 制覇率算出 |
| answered_at | timestamp | NOT NULL | セッション境界推定、復習タイミング、移動平均の時系列順 |

**使用するインデックス**:
- `mqr_user_time_idx` on (user_id, answered_at) — セッション抽出、移動平均
- `mqr_user_code_idx` on (user_id, municipality_code) — カバレッジ・苦手判定

### municipality_master

`code → (region, difficulty)` 変換に使用。スキーマ変更不要。

| カラム | 型 | 制約 | 用途（推薦エンジン） |
|--------|-----|------|--------------------|
| code | text | PK | `municipality_code` 結合キー |
| name | text | NOT NULL | 推薦内容の表示 |
| prefecture | text | NOT NULL | region 導出（`PREFECTURE_TO_REGION`） |
| region | text | NOT NULL | セル所属判定 |
| difficulty | text | NOT NULL | セル所属判定、クラウド平均集計 |

**使用するインデックス**:
- `mm_difficulty_idx` on (difficulty) — クラウド平均集計
- `mm_region_diff_idx` on (region, difficulty) — セル単位の市区町村プール抽出

## 派生データ（クエリ時算出 / TypeScript 計算）

### 1. セッション抽出 (Session Inference)

**入力**: 単一ユーザーの全 `municipality_quiz_results` 行（最新 N 件、`answered_at` DESC）。

**処理（TypeScript）**:

```ts
type Session = {
  startAt: Date;
  endAt: Date;
  mode: 'A' | 'B' | 'C' | 'D';
  rows: MunicipalityQuizResult[];
  accuracy: number;     // 正答数 / 行数
  count: 10 | 20 | 30;  // 推定問題数（行数一致）
};

function inferSessions(rows: MunicipalityQuizResult[]): Session[] {
  // 1) answered_at 昇順に並べる
  // 2) 同一 mode かつ前行との時間差 ≤ 30 分でグルーピング
  // 3) グループ内行数が 10/20/30 のいずれかに一致 → セッションとして採用
  // 4) 一致しないグループは混合扱いで除外
}
```

**根拠**: research.md R-001。spec-002 のセッション推定方式を踏襲。

### 2. セル別正答率移動平均 (Cell Accuracy Moving Average)

**型**:

```ts
type Cell = {
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  region: '北海道' | '東北' | '関東' | '中部' | '近畿' | '中国' | '四国' | '九州';
  mode: 'A' | 'B' | 'C' | 'D';
};

type CellAccuracy = {
  cell: Cell;
  movingAverage: number;       // 0.0 〜 1.0
  sessionCount: number;        // このセル所属の総セッション数（全期間）
  windowSessions: Session[];   // 移動平均計算に使った直近 5 件
  source: 'self' | 'difficulty-mode' | 'mode' | 'overall' | 'crowd-average';
};
```

**処理**:

1. `inferSessions()` 結果をセッションごとに走査
2. 各セッションについて、構成市区町村の (difficulty, region, mode) 分布を集計し、**50% 以上を占めるタプル** をそのセッションの所属セルとする（占有率 50% 未満は混合扱いで除外）
3. セッションを所属セルごとに時系列でグルーピング
4. 各セルの直近 5 セッションの正答率を単純平均
5. データ不足セル（< 3 セッション）はバックオフ:
   - `difficulty-mode` 同モード × 同難易度の全地方プール平均
   - `mode` 同モード × 全難易度の全地方プール平均
   - `overall` ユーザー全体正答率
   - `crowd-average` `municipality_master.difficulty` バケットに対する全ユーザー集計

**根拠**: spec FR-006、research.md R-002。

### 3. 適切ゾーン (Fit Zone)

**型**:

```ts
type FitZone = {
  cells: CellAccuracy[];                    // 60% ≤ movingAverage ≤ 80%
  maxDifficulty: 'easy' | 'medium' | 'hard' | 'expert';   // Fit Zone 内の最高難易度
  isCappedAt: 'easy' | 'medium' | 'hard' | 'expert' | null;
  //   Fit Zone が単一難易度バケットに収束し、その平均 > 80% なら昇格対象
};
```

**処理**:

1. 全セル × `CellAccuracy` を計算
2. `0.6 ≤ movingAverage ≤ 0.8` を満たすセルを集合化
3. 集合が空なら、最も近い `movingAverage` のセルを 1 件入れて Fit Zone を最低 1 セル保証
4. Fit Zone 内の最高難易度を `maxDifficulty` とする
5. 全 Fit Zone セルが `maxDifficulty` のみで構成され、かつ平均 > 80% → `isCappedAt = maxDifficulty` に設定（成長軸発火フラグ）

**根拠**: spec FR-005, FR-006、research.md R-003。

### 4. cell-level 制覇率 (Cell Coverage Rate)

**型**:

```ts
type CellCoverage = {
  cell: Cell;
  totalMunicipalities: number;   // master でこのセル条件を満たす市区町村数
  conqueredCount: number;        // 1 回以上正解した市区町村数
  coverageRate: number;          // conqueredCount / totalMunicipalities
};
```

**処理**:

1. `municipality_master` をセル条件で絞り込み（`mm_region_diff_idx` 使用）→ `totalMunicipalities`
2. `municipality_quiz_results` でユーザー × `is_correct = true` のユニーク `municipality_code` 数をセルごとに集計 → `conqueredCount`
3. `coverageRate` を算出

**用途**:
- 探索軸: 全セルの `coverageRate` を昇順ソートして下位 25% を「低制覇セル」として識別
- カバレッジ軸: 各 Fit Zone セル内の未経験市区町村抽出

**根拠**: spec FR-006a, FR-006c、research.md R-002。

### 5. 学習状態スナップショット (Learner State)

**型**:

```ts
type LearnerState = {
  userId: string;
  totalSessions: number;
  totalAnswers: number;
  cellAccuracies: Map<string, CellAccuracy>;  // key = `${difficulty}_${region}_${mode}`
  cellCoverages: Map<string, CellCoverage>;
  fitZone: FitZone;
  weaknessByMunicipality: Map<string, number>; // errorRate (既存 getMunicipalityWeakness を流用)
  lastSessionAccuracy: number | null;          // 直近 1 セッションの正答率（後退抑制判定）
  recentQuestionCounts: (10 | 20 | 30)[];      // 直近 10 セッションの問題数（最頻値計算用）
  unplayedMunicipalitiesByCell: Map<string, string[]>; // セルキー → 未出題コード
  crowdAccuracyByDifficulty: Record<'easy' | 'medium' | 'hard' | 'expert', number>;
};
```

**処理**: 上記 1〜4 をまとめて 1 つの Server Action 内で構築。

### 6. 推薦セット (Recommendation)

**型**:

```ts
type Recommendation = {
  mode: 'A' | 'B' | 'C' | 'D';
  difficulties: ('easy' | 'medium' | 'hard' | 'expert')[];
  regions: ('北海道' | '東北' | '関東' | '中部' | '近畿' | '中国' | '四国' | '九州')[];
  count: 10 | 20 | 30;
  codes: string[];                              // 出題対象 municipality_code (count 件 + ランダム補充含む)
  rationaleCategory:
    | 'cold-start' | 'regression' | 'difficulty-step-up' | 'mode-change'
    | 'bridging' | 'weakness-focused' | 'review-timing' | 'new-exploration';
  rationaleText: string;                        // 表示用 1〜2 行テキスト
  poolBreakdown: {
    fitZoneWeakness: number;                    // 件数（標準 50%）
    coverageNew: number;                        // 件数（標準 20%）
    exploration: number;                        // 件数（標準 30%）
    randomFallback: number;                     // 件数（プール不足時の補充）
  };
  isProgressionFired: boolean;
  isRegressionGuarded: boolean;
};
```

**処理**: `generateRecommendation(state: LearnerState, excludeCodes: string[]): Recommendation`

1. `state.totalAnswers < 10` → コールドスタートフォールバック（全国 × ☆ × 全モード × 10 問）
2. `state.lastSessionAccuracy != null && state.lastSessionAccuracy < 0.3` → 後退抑制フラグセット、難易度拡張保留
3. Fit Zone と昇格条件を評価
4. 標準比率（50:20:30）で問題プールを 3 区分で構築
5. 各区分から `weightedSample` で問題を選定（苦手重み + `excludeCodes` ペナルティ 0.3 倍）
6. 問題数決定（直近 10 セッションの最頻値、コールドスタート時は 10）
7. 不足分はランダム補充して `randomFallback` カウントを増やす
8. 根拠文カテゴリを優先順位（R-008）で選択し、テンプレート展開

### 7. 推薦履歴キャッシュ (Recommendation History Cache)

**保存先**: `localStorage` キー `geodojo:recommendation:history`

**型**:

```ts
type RecommendationHistoryCache = {
  lastCodes: string[];   // 直前推薦/プレイで出題された municipality_code
  storedAt: string;      // ISO 8601。24 時間で expire
};
```

**書き込みタイミング**:
- 推薦エンジンが新規セットを返した直後（クライアント側で `lastCodes` を上書き）
- クイズ完了時（結果画面に遷移するタイミングで上書き）

**読み込みタイミング**:
- `useRecommendation` hook が呼び出される直前にクライアント側で読み、Server Action へ `excludeCodes` として渡す
- 24 時間以上経過していたら無視し空配列扱い

**根拠**: spec Entities、research.md R-005。

## 状態遷移 (State Transitions)

推薦エンジンは状態を保持しないため、状態遷移はクライアント側 UI のみで発生:

```
[ヒーローカード表示] --CTAタップ--> [ボトムシート: ローディング]
                                              |
                                              v
[ボトムシート: 推薦内容表示] <----推薦取得完了----+
       |
       |--「内容を変える」展開---> [上書きフォーム表示]
       |                                  |
       |---「そのまま開始」or「上書きして開始」----+
       |                                          v
       +---「キャンセル」---> [シート閉じる]    [クイズ実行画面遷移]
                                                  |
                                                  v
                                            [結果画面 + 「もう一度おすすめでプレイ」CTA]
                                                  |
                                                  +--CTA--> [ボトムシート再表示]
```

## まとめ

- 新規 DB テーブル・スキーマ変更ともに不要
- 派生データはすべて `municipality_quiz_results` と `municipality_master` のクエリ + TypeScript 集計で算出
- クライアント側状態は `localStorage` の Recommendation History Cache のみ
- 推薦エンジンの計算量は 1 ユーザー 10,000 行で ms オーダー、SC-003（1.5 秒）に十分な余裕
