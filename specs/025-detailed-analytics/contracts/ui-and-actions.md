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
     - `queryKeys.dashboard.weakness()`: 苦手ランキング（初期全国/全モード）
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
    └── WeaknessRanking (選択モード・地方でサーバー側絞り込みを行った誤答率上位の自治体リスト)
```

---

## 3. Server Actions / Data Access Contracts

### `getDashboardSummary()`
- **引数**: なし（Cookieから `userId` 解決）
- **戻り値**: `Promise<AnalyticsSummary>`
  - `totalQuestions`: 累計出題数（Mode A同名・複数県の出題正規化を考慮）
  - `overallAccuracy`: 全体正答率
  - `conquestRateA`: 県当て(A)制覇率
  - `conquestRateD`: 場所当て(D)制覇率
  - `prev`: 前日比比較用

### `getAccuracyTrend(params: { period: '7d' | '30d' | 'all'; mode: QuizModeFilter; region: string })`
- **引数**: フィルター条件（期間、モード、地方）
- **戻り値**: `Promise<AccuracyTrendPoint[]>`

### `getWeaknessRanking(params?: { mode?: QuizModeFilter; region?: string })`
- **引数**: フィルター条件（モード、地方）※省略時は全体
- **戻り値**: `Promise<WeaknessItem[]>`
- **動作**: サーバークエリ内で指定のモード・地方条件を WHERE 句に適用した上で `ORDER BY errorRate DESC, totalCount DESC LIMIT 20` を実行し、選択条件に適合する上位20件を返す。

### `getDifficultyProgress(params: { mode: 'all' | 'A' | 'B' | 'C' | 'D'; region: string })`
- **引数**: モード、地方
- **戻り値**: `Promise<DifficultyProgressItem[]>`

---

## 4. ナビゲーション更新契約 (`app/(app)/bottom-nav.tsx`)

```typescript
const navItems = [
  { href: '/', label: 'ホーム', icon: Home, exact: true },
  { href: '/quiz/prefecture', label: '都道府県', icon: Map, exact: false },
  { href: '/quiz/municipality', label: '市区町村', icon: MapPin, exact: false },
  { href: '/analytics', label: '分析', icon: BarChart2, exact: false },
];
```
- `/analytics` にアクセス中、ボトムナビの「分析」アイコンが `text-primary` にハイライトされる。
