# 計測結果: 改修前後（HAR ＋ サーバログ）

## サマリ

| 指標 | 改修前（prod baseline） | 改修後（preview, PR #13） |
|------|------------------------|--------------------------|
| 初回 read の Server Action（`POST /`）本数 | **11 本** | **1 本**（推薦のみ） |
| read のサーバ往復 | 完全直列（重なり 0/10） | サーバ側 1 バッチ並列 |
| サーバ側 read 取得時間 | 単純合計 ≒ **14.3s** | 認証 ~0.8s ＋ 9クエリ並列 **~1.6s** |
| ページ full last-byte（HAR, ログイン込み） | ~14.3s | **~5.0s** |

## 改修前（`geo-dojo.faru.jp.har`, 2026-06-08 本番）

- `POST /`（read Server Action）11 本、隣接重なり 0 ペア（完全直列）。
- 総ウォール ≒ 14,325ms。内訳（ms）: 2523(推薦) / 3095(summary) / 1505 / 1051 / 715 / 720 / 1064 / 1013 / 1170 / 710 / 704。

## 改修後（preview `006-dashboard-perf`）

サーバログ `[dash-prefetch]`（プール拡張後）:

```
auth=794ms allParallel=1598ms result=ok
per={streak:1117, weakness:1124, accuracyTrend:1267, upcomingSchedule:1262,
     dueReviewSummary:1272, summary:1341, completionTrend:1500, difficulty:1500, completionByMode:1585}
```

- 9 クエリが **並列で 1,598ms**（＝最遅 1 本ぶんに収束。直列合計 ~11.5s ではない）。
- HAR: 初回 `POST /` は **1 本のみ**（client の推薦取得 1,573ms）。read 9 本はハイドレーションで消滅。
- full last-byte ~4,971ms（Vercel ログイン保護のリダイレクト＋推薦取得を含む）。

## 障害と対処（preview デバッグ）

1. **認証 SSR が 300s ハング**: `getClaims()`（US3）が対称鍵構成で内部 `getSession()`+`getUser()` を入れ子呼びし GoTrue ロックでデッドロック。→ `getUser()` 直呼びに戻して解消。
2. **プリフェッチが 25s+ で詰まる**: 並列 read のサブクエリ fan-out（summary=9, due=4 等）が postgres-js 既定 `max:10` を超過し、最重 `completionTrend` がコネクション枯渇で停止。→ `max:20`＋`idle_timeout:20` で解消（allParallel 25s→1.6s）。
3. 安全弁: プリフェッチに 8s タイムアウト＋try/catch（詰まってもクライアントフェッチへフォールバック、ページをハングさせない）。

## AC 判定

- **AC1**（並列収束・重なり>0 相当）: ✅ 直列 11→並列 1 バッチ（1.6s）。
- **AC5**（< 3s, 目標 < 2s）: ✅ ダッシュボード read は ~1.6s で揃う（推薦カードは別途 client 取得で loading 表示）。
- **AC2 / AC4**: 既出（US1 dedup ＋ Vitest 50 passed）。
- **AC3**（認証往復削減）: プリフェッチで認証 1 回に集約済み。`getClaims` ローカル検証は本番の非対称署名鍵有効化後に再検討（research.md）。
