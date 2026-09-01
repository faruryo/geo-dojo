# Interface Contracts: 詳細分析ページ (025-detailed-analytics)

## 1. ページルーティング & Server Component

### `GET /analytics` (`app/(app)/analytics/page.tsx`)
- **保護**: Supabase Auth 認証必須（`(app)/layout.tsx` のセッションチェック）
- **動作**:
  1. `requireUserId()` でログイン中ユーザーの `userId` を取得。
  2. `getAnalyticsDehydratedState()` を実行し、`queryKeys` ファクトリ（`lib/query-keys.ts`）に定義されたキーで以下のクエリ結果を事前取得してキャッシュに格納。
     - `queryKeys.dashboard.summary()`: 総合サマリー（出題数・正答率・A制覇率・D制覇率）
     - `queryKeys.dashboard.streak()`: 連続学習日数
     - `queryKeys.dashboard.difficulty('all', '全国')`: 難易度別クリア状況
     - `queryKeys.dashboard.trend('7d', 'all', '全国')`: 初期7日間の推移
     - `queryKeys.dashboard.weakness('7d', 'all', '全国')`: 苦手ランキング（初期7日間/全国/全モード）
  3. `<HydrationBoundary state={dehydratedState}>` 内で `<AnalyticsClient />` をレンダリング。

---

## 2. クライアントコンポーネント構成 (`components/analytics/analytics-client.tsx`)

### コンポーネントツリー
```text
AnalyticsClient (app/(app)/analytics/page.tsx から呼び出し)
├── Header ("詳細分析", "学習の推移・苦手・モード別進捗")
├── EmptyState (総問題数 0 の場合のみ表示)
└── AnalyticsContent (総問題数 > 0 の場合に表示)
    ├── SummaryCards (累計出題数、全体正答率、県当て(A)制覇率、場所当て(D)制覇率)
    ├── FilterBar (期間: 7d/30d/all, 地方, モード: 全て/A/B/C/D)
    ├── AccuracyChart (選択期間・地方・モードの推移グラフ)
    ├── DifficultyProgress (選択モード・地方ごとの難易度別クリア状況)
    └── WeaknessRanking (選択期間・モード・地方でサーバー側絞り込みを行った誤答率上位の自治体リスト)
```

---

## 3. Server Actions / Data Access Contracts

### `getDashboardSummary()`
- **引数**: なし（Cookieから `userId` 解決）
- **戻り値**: `Promise<AnalyticsSummary>`
  - `totalQuestions`: 累計出題数
  - `overallAccuracy`: 全体正答率
  - `conquestRateA`: 県当て(A)制覇率（024確立の出題対象一意自治体名 `name` 単位、`getCompletionByModeData` 準拠）
  - `conquestRateD`: 場所当て(D)制覇率（5桁自治体コード `code` 単位、`getCompletionByModeData` 準拠）
  - `prev`: 前日比比較用（`totalQuestions`, `overallAccuracy`, `conquestRateA`, `conquestRateD`）
- **集計仕様**:
  - **Mode A出題正規化**: 同名・複数県（伊達市など）で保存された複数レコード（同一 `answered_at` かつ `mode='A'` かつ `municipality_name`、および過去のレガシーレコードに対する同一ユーザー・同一自治体名・2秒以内回答の近似グループ化）を1問として集約し、出題数・正答率を算出。
  - **A/D制覇率算出**: 既存の `getCompletionByModeData(userId, 'A', '全国')` および `getCompletionByModeData(userId, 'D', '全国')` の制覇率算出ロジックを再利用。前日比の `prev.conquestRateA` / `prev.conquestRateD` は `asOf` 引数（`startOfTodayJst`）を指定して前日時点の確定値を算出。

### `getCompletionByModeData(userId: string, mode: 'A' | 'B' | 'C' | 'D', region: string, asOf?: Date)`
- **引数**: ユーザーID、モード、地方、オプショナルの基準日時（`asOf`）
- **動作**: `asOf` が指定されている場合は `answered_at < asOf` の条件を適用し、指定日時時点での制覇率・クリア自治体数を返す。

### `getAccuracyTrend(params: { period: '7d' | '30d' | 'all'; mode: QuizModeFilter; region: string })`
- **引数**: フィルター条件（期間、モード、地方）
- **戻り値**: `Promise<AccuracyTrendPoint[]>`
- **集計仕様**:
  - `period = '7d' | '30d'` の場合は日別（`date_trunc('day', ...)`）、`period = 'all'` の場合は週別（`date_trunc('week', ...)`）の推移を返す。
  - Mode A 同名市複数県のレコードは同一出題として1問集約（過去レガシーの2秒以内近似集約含む）し、難易度別系列の割り当てには `representativeDifficulty()`（最も難しい難易度）を採用して正答率を算出。

### `getWeaknessRanking(params?: { period?: '7d' | '30d' | 'all'; mode?: QuizModeFilter; region?: string })`
- **引数**: フィルター条件（期間、モード、地方）※省略時は ('all', 'all', '全国')
- **戻り値**: `Promise<WeaknessItem[]>`
- **動作**: サーバークエリ内で指定の期間（`answered_at >= NOW() - INTERVAL '...'`）・モード・地方条件を WHERE 句に適用した上で `ORDER BY errorRate DESC, totalCount DESC LIMIT 20` を実行し、選択条件に適合する上位20件を返す。

### `getDifficultyProgress(params: { mode: 'all' | 'A' | 'B' | 'C' | 'D'; region: string })`
- **引数**: モード、地方
- **戻り値**: `Promise<DifficultyProgressItem[]>`
- **集計仕様**:
  - Mode A において同名市複数県インスタンス（伊達市等）が異なる難易度を持つ場合、分母（母集団）と分子（クリア数）の両方で `representativeDifficulty()`（最も難しい難易度）を採用して1つの難易度バケットに割り当てる。

---

## 4. 回答保存時のバッチ処理 & トランザクション契約 (`app/(app)/quiz/municipality/actions.ts`)

### `saveMunicipalityQuizResults(results: NewResultInput[])`
- **同一出題の厳格バリデーション & マスター照合**:
  - **Mode A の場合**:
    1. 配列サイズ 1〜10件。全要素の `mode === 'A'`。
    2. 全要素の `municipalityCode` が重複なく一意であること。
    3. `municipality_master` から各 `municipalityCode` のマスターレコードを取得し、全件実在すること、および全マスター行の正規名称 `municipality_master.name` が同一であること（クライアント入力の `municipalityName` との一致検証を含む）を検証。
  - **Mode B / C / D の場合**:
    1. 配列サイズが厳密に `1` であること。
    2. 対象の `municipalityCode` が `municipality_master` に実在することを検証。
  - 各要素の `isCorrect`（boolean）、`answerTimeMs`（0以上の整数またはnull）の型・値を検証。
- **アトミックトランザクション実行**:
  - 単一の `db.transaction` 内で以下を不可分に実行する：
    1. サーバー時刻（`const serverAnsweredAt = new Date()`）を一括生成し、全要素に同一の `answeredAt` を設定して `municipalityQuizResults` に一括 insert。
    2. 入力された全アイテムに対して `upsertSrsRecord(tx, ...)` を実行し、SM-2 復習スケジュールを更新。
  - トランザクション失敗時は自動ロールバックされ、エラー理由を `console.error` で記録した上で再 throw してサイレント障害を防ぐ。

---

## 5. Query Key Factory 拡張 (`lib/query-keys.ts`)

```typescript
export const queryKeys = {
  dashboard: {
    // 既存キー ...
    summary: () => ['dashboard', 'summary'] as const,
    weakness: (period: string = 'all', mode: string = 'all', region: string = '全国') =>
      ['dashboard', 'weakness', period, mode, region] as const,
    difficulty: (mode: string = 'all', region: string = '全国') =>
      ['dashboard', 'difficulty', mode, region] as const,
    trend: (period: string, mode: string, region: string = '全国') =>
      ['dashboard', 'trend', period, mode, region] as const,
  },
  // ...
};
```

---

## 6. ナビゲーション更新契約 (`app/(app)/bottom-nav.tsx`)

```typescript
const navItems = [
  { href: '/', label: 'ホーム', icon: Home, exact: true },
  { href: '/quiz/prefecture', label: '都道府県', icon: Map, exact: false },
  { href: '/quiz/municipality', label: '市区町村', icon: MapPin, exact: false },
  { href: '/analytics', label: '分析', icon: BarChart2, exact: false },
];
```
- `/analytics` にアクセス中、ボトムナビの「分析」アイコンが `text-primary` にハイライトされる。
