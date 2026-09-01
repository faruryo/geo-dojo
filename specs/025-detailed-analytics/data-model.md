# Data Model: 詳細分析ページ (025-detailed-analytics)

本機能では新規テーブルの追加はなく、既存の `municipality_quiz_results` および `municipality_master` テーブルに対する集計クエリを使用する。

## 既存エンティティ（参照のみ）

### 1. `municipality_quiz_results` (ユーザー回答履歴)

| カラム | 型 | 説明 |
|---|---|---|
| `id` | `uuid` (PK) | 回答ID |
| `user_id` | `uuid` (FK) | ユーザーID (RLS対象) |
| `municipality_code` | `varchar(5)` | 市区町村コード |
| `municipality_name` | `varchar(100)` | 市区町村名 |
| `prefecture` | `varchar(50)` | 都道府県名 |
| `mode` | `varchar(10)` | モード ('A' \| 'B' \| 'C' \| 'D') |
| `difficulty` | `varchar(20)` | 難易度 ('beginner' \| 'intermediate' \| 'advanced' \| 'expert') |
| `is_correct` | `boolean` | 正誤フラグ |
| `answered_at` | `timestamptz` | 回答日時 (UTC / JST換算) |
| `answer_time_ms` | `integer` | 回答所要時間（ミリ秒） |

### 2. `municipality_master` (市区町村マスター)

| カラム | 型 | 説明 |
|---|---|---|
| `code` | `varchar(5)` (PK) | 5桁市区町村コード |
| `name` | `varchar(100)` | 市区町村名 |
| `prefecture` | `varchar(50)` | 都道府県名 |
| `region` | `varchar(50)` | 地方名（東北、関東など） |
| `difficulty` | `varchar(20)` | 難易度 |
| `is_same_name` | `boolean` | 同名異自治体フラグ |

---

## クライアント向けデータモデル / 型定義

### 1. `AnalyticsSummary` (総合学習サマリー)
```typescript
interface AnalyticsSummary {
  totalQuestions: number;       // 累計出題数（Mode A同名市重複を正規化した出題ベース）
  overallAccuracy: number;      // 全体正答率 (0.0-1.0)
  conquestRateA: number;        // 県当て(A)制覇率 (0.0-1.0)
  conquestRateD: number;        // 場所当て(D)制覇率 (0.0-1.0)
  prev: {
    totalQuestions: number;
    overallAccuracy: number;
    conquestRateA: number;
    conquestRateD: number;
  };
}
```

### 2. `AccuracyTrendPoint` (正答率推移データ点)
```typescript
interface AccuracyTrendPoint {
  date: string;                 // 日付 ('YYYY-MM-DD')
  all: number;                  // その日の全体正答率 (0-100%)
  easy?: number;                // 入門
  medium?: number;              // 中級
  hard?: number;                // 上級
  expert?: number;              // 達人
}
```

### 3. `WeaknessItem` (苦手市区町村)
```typescript
interface WeaknessItem {
  municipalityCode: string;     // 市区町村コード
  municipalityName: string;     // 市区町村名
  prefecture: string;           // 都道府県名
  mode: 'A' | 'B' | 'C' | 'D';
  region: string;
  difficulty: string;
  kana?: string;
  totalCount: number;           // 総出題回数
  errorCount: number;           // 不正解回数
  errorRate: number;            // 誤答率 (0.0-1.0)
}

interface WeaknessFilterOpts {
  mode?: 'all' | 'A' | 'B' | 'C' | 'D';
  region?: string;              // '全国' | '北海道' | '東北' | ...
}
```

### 4. `DifficultyProgressItem` (難易度・モード別進捗)
```typescript
interface DifficultyProgressItem {
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  clearedCount: number;         // クリア数
  totalCount: number;           // 母集団数
}
```

### 5. `AnalyticsFilterState` (分析フィルター状態)
```typescript
interface AnalyticsFilterState {
  period: '7d' | '30d' | 'all';
  region: string;               // '全国' | '北海道' | '東北' | ...
  mode: 'all' | 'A' | 'B' | 'C' | 'D';
}
```
