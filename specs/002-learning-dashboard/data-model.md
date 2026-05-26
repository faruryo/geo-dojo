# Data Model: 学習ダッシュボード

**Branch**: `002-learning-dashboard` | **Date**: 2026-05-25

## 既存テーブル（変更なし）

### municipality_quiz_results

ダッシュボードの全集計のプライマリソース。スキーマ変更不要。

| カラム | 型 | 制約 | 用途（ダッシュボード） |
|--------|-----|------|----------------------|
| id | uuid | PK, auto | — |
| user_id | uuid | NOT NULL | ユーザー別集計のフィルタ |
| municipality_code | text | NOT NULL | コンプリート率・難易度別進捗の集計キー |
| municipality_name | text | NOT NULL | 苦手ランキング・復習リストの表示 |
| prefecture | text | NOT NULL | 苦手ランキングの表示 |
| mode | text | NOT NULL | モード別フィルター・セッション推定 |
| is_correct | boolean | NOT NULL | 正答率・コンプリート率の算出 |
| answered_at | timestamp | NOT NULL, default now() | 日別集計・ストリーク・セッション推定 |

**既存インデックス**:
- `mqr_user_code_idx` on (user_id, municipality_code) — コンプリート率、苦手ランキング
- `mqr_user_time_idx` on (user_id, answered_at) — 日別集計、ストリーク、セッション推定

### municipality_master

コンプリート率の分母、難易度別進捗の集計に使用。スキーマ変更不要。

| カラム | 型 | 制約 | 用途（ダッシュボード） |
|--------|-----|------|----------------------|
| code | text | PK | `municipality_code` との結合キー |
| name | text | NOT NULL | — |
| prefecture | text | NOT NULL | — |
| region | text | NOT NULL | — |
| population | integer | nullable | — |
| difficulty | text | NOT NULL | 難易度別コンプリート率の GROUP BY キー |
| updated_at | timestamp | NOT NULL | — |

**既存インデックス**:
- `mm_difficulty_idx` on (difficulty) — 難易度別件数カウント
- `mm_region_diff_idx` on (region, difficulty) — 将来の地方×難易度クロス集計用

## 派生データ（クエリ時算出）

### 日別正答率集計

```
SELECT
  DATE(answered_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo') AS quiz_date,
  mode,
  COUNT(*) FILTER (WHERE is_correct) AS correct_count,
  COUNT(*) AS total_count
FROM municipality_quiz_results
WHERE user_id = :userId
  AND answered_at >= :startDate
GROUP BY quiz_date, mode
ORDER BY quiz_date
```

- 期間フィルター: 7日 / 30日 / 全期間
- モードフィルター: 全モード or 個別モード
- 全期間で90日超の場合、90日以前は週単位に集約

### ストリーク

```
-- JST日付に変換して一意な学習日を取得
SELECT DISTINCT DATE(answered_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo') AS quiz_date
FROM municipality_quiz_results
WHERE user_id = :userId
ORDER BY quiz_date DESC
```

アプリケーション層で連続日数を計算:
- `today (JST)` から遡って連続する日数 = 現在のストリーク
- 全期間の最長連続日数 = 最長ストリーク
- 今日の日付がリストに含まれるか = 今日の学習状況

### コンプリート率

```
-- 正解経験済み市区町村数
SELECT COUNT(DISTINCT municipality_code) AS cleared_count
FROM municipality_quiz_results
WHERE user_id = :userId AND is_correct = true

-- 全市区町村数
SELECT COUNT(*) AS total_count FROM municipality_master

-- 難易度別
SELECT
  mm.difficulty,
  COUNT(DISTINCT mm.code) AS total,
  COUNT(DISTINCT CASE WHEN mqr.is_correct THEN mqr.municipality_code END) AS cleared
FROM municipality_master mm
LEFT JOIN municipality_quiz_results mqr
  ON mm.code = mqr.municipality_code AND mqr.user_id = :userId
GROUP BY mm.difficulty
```

### 苦手ランキング

既存の `getMunicipalityWeakness()` を拡張:

```
SELECT
  municipality_code,
  municipality_name,
  prefecture,
  COUNT(*) AS total_count,
  COUNT(*) FILTER (WHERE NOT is_correct) AS error_count,
  ROUND(COUNT(*) FILTER (WHERE NOT is_correct)::numeric / COUNT(*), 3) AS error_rate
FROM municipality_quiz_results
WHERE user_id = :userId
GROUP BY municipality_code, municipality_name, prefecture
HAVING COUNT(*) FILTER (WHERE NOT is_correct) > 0
ORDER BY error_rate DESC, total_count DESC
LIMIT 20
```

### 復習おすすめリスト

```
SELECT
  municipality_code,
  municipality_name,
  prefecture,
  MAX(answered_at) AS last_answered,
  ROUND(COUNT(*) FILTER (WHERE NOT is_correct)::numeric / COUNT(*), 3) AS error_rate
FROM municipality_quiz_results
WHERE user_id = :userId
GROUP BY municipality_code, municipality_name, prefecture
HAVING COUNT(*) FILTER (WHERE NOT is_correct) > 0
  AND MAX(answered_at) < NOW() - INTERVAL '7 days'
ORDER BY error_rate DESC
LIMIT 10
```

### セッション推定

```
WITH ordered AS (
  SELECT *,
    LAG(answered_at) OVER (PARTITION BY user_id, mode ORDER BY answered_at) AS prev_at,
    LAG(mode) OVER (PARTITION BY user_id ORDER BY answered_at) AS prev_mode
  FROM municipality_quiz_results
  WHERE user_id = :userId
),
sessions AS (
  SELECT *,
    SUM(CASE
      WHEN prev_at IS NULL
        OR EXTRACT(EPOCH FROM answered_at - prev_at) > 300
      THEN 1 ELSE 0
    END) OVER (PARTITION BY user_id ORDER BY answered_at) AS session_id
  FROM ordered
)
SELECT
  session_id,
  mode,
  MIN(answered_at) AS started_at,
  COUNT(*) AS question_count,
  COUNT(*) FILTER (WHERE is_correct) AS correct_count,
  ROUND(COUNT(*) FILTER (WHERE is_correct)::numeric / COUNT(*), 3) AS accuracy
FROM sessions
GROUP BY session_id, mode
ORDER BY started_at DESC
```

### サマリーカード

```
-- 累計出題数 & 全体正答率
SELECT
  COUNT(*) AS total_questions,
  COUNT(*) FILTER (WHERE is_correct) AS total_correct,
  ROUND(COUNT(*) FILTER (WHERE is_correct)::numeric / NULLIF(COUNT(*), 0), 3) AS overall_accuracy
FROM municipality_quiz_results
WHERE user_id = :userId

-- 学習済み市区町村数（1回以上出題）
SELECT COUNT(DISTINCT municipality_code) AS studied_count
FROM municipality_quiz_results
WHERE user_id = :userId

-- 前日比（前日終了時点 = JST昨日23:59:59まで）
-- 上記クエリに answered_at < :today_jst_start を追加して前日値を取得し、アプリ層で差分計算
```

## クライアント側ストレージ

### マイルストーン既読（localStorage）

- **キー**: `geodojo:milestones:dismissed`
- **値**: `string[]` — 閉じたマイルストーンID
- **ID体系**: `correct-{N}` (N=100,500,1000,5000) / `coverage-{P}` (P=25,50,75,100)
- **例**: `["correct-100", "coverage-25"]`

## 新規インデックス

現時点では追加インデックス不要。既存の `mqr_user_time_idx` と `mqr_user_code_idx` でカバー可能。

パフォーマンス問題が発生した場合の候補:
- `mqr_user_mode_time_idx` on (user_id, mode, answered_at) — モード別フィルター+時系列クエリの高速化
