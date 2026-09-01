# Data Model: 詳細分析ページ (025-detailed-analytics)

本機能では新規テーブルの追加はなく、既存の `municipality_quiz_results`, `municipality_master`, `srs_records` テーブルに対する集計クエリを使用する。

## 既存エンティティ（参照のみ）

### 1. `municipality_quiz_results` (ユーザー回答履歴)

| カラム | 型 | 説明 |
|---|---|---|
| `id` | `uuid` (PK) | 回答ID |
| `userId` (`user_id`) | `uuid` (FK) | ユーザーID (RLS対象) |
| `municipalityCode` (`municipality_code`) | `text` | 市区町村コード |
| `municipalityName` (`municipality_name`) | `text` | 市区町村名 |
| `prefecture` | `text` | 都道府県名 |
| `mode` | `text` | モード ('A' \| 'B' \| 'C' \| 'D') |
| `isCorrect` (`is_correct`) | `boolean` | 正誤フラグ |
| `answeredAt` (`answered_at`) | `timestamp` | 回答日時 (UTC / JST換算、Server Action側でサーバー時刻を付与) |
| `answerTimeMs` (`answer_time_ms`) | `integer` | 回答所要時間（ミリ秒、NULL許容） |

### 2. `municipality_master` (市区町村マスター)

| カラム | 型 | 説明 |
|---|---|---|
| `code` | `text` (PK) | 5桁市区町村コード |
| `name` | `text` | 市区町村名 |
| `prefecture` | `text` | 都道府県名 |
| `region` | `text` | 地方名（東北、関東など） |
| `difficulty` | `text` | 難易度 ('easy' \| 'medium' \| 'hard' \| 'expert') |
| `population` | `integer` | 人口（国勢調査） |
| `populationYear` | `integer` | 人口調査年 |
| `kana` | `text` | 読み仮名（ひらがな） |
| `updatedAt` | `timestamp` | 更新日時 |

※ 難易度（`difficulty`）や地方（`region`）に基づく集計は、`municipality_quiz_results.municipality_code` と `municipality_master.code` の JOIN により行う。

---

## クライアント向けデータモデル / 型定義

### 1. `AnalyticsSummary` (総合学習サマリー)
```typescript
interface AnalyticsSummary {
  totalQuestions: number;       // 累計出題数（Mode A同名市を同一answeredAt+municipalityNameで1問集約）
  overallAccuracy: number;      // 全体正答率 (0.0-1.0)
  conquestRateA: number;        // 県当て(A)制覇率 (0.0-1.0, 024確立の一意市区町村名単位)
  conquestRateD: number;        // 場所当て(D)制覇率 (0.0-1.0, 5桁市区町村コード単位)
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
  date: string;                 // 日付 ('YYYY-MM-DD') または 週初日
  all: number;                  // その日の全体正答率 (0-100%, Mode A同名市正規化対応)
  easy?: number;                // 入門 (Mode A同名市はrepresentativeDifficulty採用)
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
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  kana?: string;
  totalCount: number;           // 総出題回数
  errorCount: number;           // 不正解回数
  errorRate: number;            // 誤答率 (0.0-1.0)
}

interface WeaknessFilterOpts {
  period?: '7d' | '30d' | 'all';
  mode?: 'all' | 'A' | 'B' | 'C' | 'D';
  region?: string;              // '全国' | '北海道' | '東北' | ...
}
```

### 4. `DifficultyProgressItem` (難易度・モード別進捗)
```typescript
interface DifficultyProgressItem {
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  clearedCount: number;         // クリア数（Mode A同名市はrepresentativeDifficulty採用で1バケット集約）
  totalCount: number;           // 母集団数（Mode A同名市はrepresentativeDifficulty採用で1バケット集約）
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
