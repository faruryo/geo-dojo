# Quickstart: 詳細分析の期間初期値と長期の正答率推移

## 前提

- ローカル: `supabase start` 済み、`pnpm dev`（http://127.0.0.1:3000）
- ログイン: `test@example.com` / `password123`
- 回答が 1 件以上あるアカウント。無い場合はクイズを 2 日以上空けて数問解く

## 自動

```bash
pnpm exec vitest run __tests__/lib/analytics/accuracy-buckets.test.ts __tests__/lib/analytics/period-preference.test.ts __tests__/lib/analytics/prefetch.test.ts __tests__/components/analytics/analytics-filter.test.tsx
```

期待: 364 日は週、365 日は月。不正な保存値は `null`。prefetch と詳細分析の初期呼び出しが `all`。

## 画面

1. 別期間を保存していない状態で `/analytics` を開く。期間が「全期間」で、正答率・制覇・苦手が全期間を向いている。7日のグラフが先に出ない。
2. 「30日」にして再読み込みする。同じユーザーでは「30日」に戻る。地方とモードは全国・全てに戻る。
3. 幅 375px で全期間の正答率グラフを見る。横軸が重ならない。点を押すと週なら「YYYY/M/Dの週」、月なら「YYYY年M月」。
4. 開発者ツールで `geodojo:analytics:period:<userId>` を壊した値にして再読み込みする。「全期間」になる。

長期の月次は、回答の端と端が 365 日以上のアカウントで全期間を開き、点の `date` が `YYYY-MM` であることをネットワーク応答か React Query のキャッシュで見る。短い履歴では `YYYY-MM-DD` の月曜のまま。

## 対象外の確認

全国制覇推移は日ごとのまま（月のキーにならない）。ホーム（`/`）に期間フィルターは増えない。
