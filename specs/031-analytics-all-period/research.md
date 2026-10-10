# Research: 詳細分析の期間初期値と長期の正答率推移

## Decision: 全期間の粗さは「見えている回答」の JST 暦日差で決める

- **Decision**: `period !== 'all'` は日。`all` は `diffJSTCalendarDays(最後, 最初) > 364` のとき月、それ以外は月曜週。行が 0 件のときは週（点は出ない）。
- **Rationale**: 仕様の境界は 52 週 = 364 日。地方・モードで狭めた結果が 1 年以内なら週のままにする、という端と端の定義に合う。クエリは `answeredAt` 順なので先頭と末尾で足りる。
- **Alternatives considered**: 今日からの経過年数で切る（休止ユーザーが月次になる）。空の週を数えて 52 点で切る（歯抜けだと密度とずれる）。アカウント作成日（このアプリは持っていない）。

## Decision: バケットキーはソートできる文字列のまま

- **Decision**: 日と週は `YYYY-MM-DD`（週は従来どおり JST の月曜）。月は `YYYY-MM`。正答率の足し上げは今の `buildTrendDateMap` のまま、キー関数だけ差し替える。
- **Rationale**: `localeCompare` の並びが暦順のまま。Mode A のバッファと難易度の代表値は触らない。
- **Alternatives considered**: 週を `YYYY-Www` にする（既存の週次キーと表示が変わる）。SQL の `date_trunc` に移す（正規化が JS 側にあるので二重になる）。

## Decision: 軸の短縮は表示だけ

- **Decision**: `AccuracyChart` が `period === 'all'` のときだけ軸とツールチップを整形する。週の軸は `M/D`、月の軸は年内なら `M月`、複数年なら `YY/M`。ツールチップは `YYYY/M/Dの週` と `YYYY年M月`。点が多いときは `minTickGap` でラベルを間引く。7日・30日の軸は今の日付文字列のまま。
- **Rationale**: 日次も週次もキーが `YYYY-MM-DD` なので、期間を見ないと区別できない。制覇推移は日次のままなので軸は変えない。
- **Alternatives considered**: キー自体を表示用にする（ソートとツールチップが壊れる）。

## Decision: 期間の記憶はマウント後に復元する

- **Decision**: SSR と初期 state は常に `all`。prefetch も `all`。`getBrowserUserId` のあと、その学習者のキーだけ読んで state を更新する。読む前にユーザーが期間を変えていたら、保存値で上書きしない。不正値は無視して `all`。
- **Rationale**: `localStorage` はサーバに無い。先に保存値で描くと hydration がずれ、prefetch も当たらない。仕様が禁じているのは「7日が一瞬出てから全期間」であり、未保存の初回は最初から全期間になる。
- **Alternatives considered**: Cookie に載せて SSR から復元する（範囲が一段増える）。期間を DB に保存する（端末をまたぐ要件がない）。

## Decision: 制覇推移の集約は変えない

- **Decision**: `buildCompletionDailyTrend` と制覇グラフの軸はそのまま。変わるのは prefetch と画面の期間が `all` 起点になることだけ。
- **Rationale**: 仕様 FR-014。累積の日次を月に潰すと「いつ制覇が進んだか」の意味が変わる。
- **Alternatives considered**: 正答率と同じ週/月に揃える（今回の範囲外。長期は点が多くなりうる）。
