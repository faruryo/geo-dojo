# Backlog: 将来対応

次の spec で着手する候補。優先順は上から。

## 次期 spec 候補

- [ ] B001 学習ダッシュボード（spec-002 予定）
  - 正答率の推移グラフ、苦手市区町村ランキング、連続学習日数（ストリーク）
  - 既存 `municipality_quiz_results` のデータを可視化、新テーブル不要の見込み

- [ ] B002 間隔反復復習モード（spec-003 予定）
  - 概要: 一度でも不正解だった市区町村を Leitner システム（1→3→7→14→30日）で復習出題する
  - 正解で次の Box へ昇格、不正解で Box 1 に戻る。Box 5 正解で卒業
  - 新規テーブル: `municipality_srs`（user_id, municipality_code, box, next_review_at）で Box 状態を管理
  - 既存 `municipality_quiz_results`（ログ型）とは別に状態管理が必要

- [ ] B003 都道府県クイズ強化 + タイムアタック（spec-004 予定）
  - 都道府県クイズの結果を DB 保存 + 苦手優先 + 復習モード対応
  - 時間制限モード追加（タイムを記録・競える）
  - 前提: 地図タップの操作性改善（現状のUIのイマイチな点を洗い出して改修）

## アイデアストック

- [ ] B004 政令指定都市の区レベル詳細化（高難易度モード）
  - 現状: 仙台市5区が全て `name:'仙台市'` → Mode C/D で重複出題・Mode D でタップ精度問題
  - 案: expert 難易度のみ区名（`仙台市青葉区`）を個別エントリとして出題
  - 対応ファイル: `scripts/generate-municipalities.ts`、`scripts/sync-municipality-master.ts`、`lib/quiz/municipality-data.ts`

- [ ] B005 難易度計算 Phase 3 — クラウド正答率の導入
  - 現状: Phase 2（e-Stat 人口ベース）で difficulty を静的に焼き込み済み
  - 案: 全ユーザーの正答率データを集計し、人口ベース difficulty と combined score で最終難易度を算出
  - 検討事項: 集計バッチの実行頻度、正答率カラム追加（`municipality_master.crowd_accuracy`）、combined score の重み付け
