# Contract: 詳細分析の期間

## 画面の初期状態

`AnalyticsClient` の期間 state の初期値は `all`。地方は `全国`、モードは `all`。

SSR prefetch（`getAnalyticsDehydratedState`）の初期キー:

- `queryKeys.dashboard.trend('all', 'all', '全国')`
- `queryKeys.dashboard.completionTrend('all', 'all', '全国')`
- `queryKeys.dashboard.weakness('all', 'all', '全国')`

`AccuracyChart` を期間未指定で使うときの内部初期値も `all`。詳細分析は `showPeriodTabs={false}` のまま、期間は `FilterBar` が持つ。

## 正答率バケット

`getAccuracyTrendData` が返す `date` は [data-model.md](../data-model.md) のキー。7日・30日は日次。全期間だけ週または月。

判定とキー生成、軸ラベル、ツールチップ文は `lib/analytics/accuracy-buckets.ts` の純粋関数。入力の時刻は UTC の `Date`、日界は JST。

## 期間の記憶

`lib/analytics/period-preference.ts`:

- キー: `geodojo:analytics:period:<userId>`
- `readAnalyticsPeriod(storage, userId)` は `7d` | `30d` | `all` 以外を `null` にする
- `writeAnalyticsPeriod(storage, userId, period)` はそのキーだけを書く
- 他の学習者のキーは読まない、消さない

画面はマウント後に `getBrowserUserId()` で読み、保存があれば期間をその値にする。読み終わる前に期間を変えていたら、保存値では上書きしない。変更のたびに同じキーへ書く。`getBrowserUserId` が失敗したときは `all` のまま記憶しない。

## 変えないもの

- 期間の選択肢は 7日 / 30日 / 全期間
- `getCompletionTrendData` の点は日次
- 苦手ランキングの中身の計算。変わるのは渡す `period` だけ
- Mode A の 1 問正規化、難易度代表、東京23区の除外
