# Research: 誤答なし市区町村の早期卒業

Technical Context に NEEDS CLARIFICATION なし。主要な設計判断はブレインストーミングでユーザー確認済み。以下に決定事項を記録する。

## D1: 卒業速度 — 別日2回連続正解で卒業

- **Decision**: 誤答なしのレコードは「別日での正解2回目」で即卒業（初回正解では卒業しない）
- **Rationale**: 地図タップ等のまぐれ正解を2回目の確認でふるい落とす。同日ガード（1日1回前進）が既にあるため「2回 = 別日2回」が追加実装なしで保証される
- **Alternatives considered**: 初回正解で即卒業（まぐれを卒業させてしまう）／interval ジャンプのみ（卒業まで依然1週間超かかり主訴を解消しない）

## D2: 誤答有無の判定 — 履歴テーブルから導出（スキーマ変更なし）

- **Decision**: `municipality_quiz_results` に (userId, code, mode, isCorrect=false) の行が存在するかの EXISTS で `everWrong` を導出し、純粋関数に引数で渡す
- **Rationale**: 正答率表示と同じ既存データソースで完結。カラム追加だと二重管理とバックフィル時のデータ整合リスクが生じる。判定ロジックは純粋関数のままなので Vitest で検証可能。`mqr_user_code_idx` が既にあり EXISTS は安価
- **Alternatives considered**: `srs_records` に `lapses` カラム追加（当初案A。既存履歴から同じ情報が導出できるため YAGNI で却下）／boolean `ever_wrong` カラム（同上）

## D3: 既存レコードの扱い — 一括バックフィル

- **Decision**: `status='reviewing' AND repetition>=2` かつ誤答履歴なしの既存レコードを、冪等な手動実行スクリプトで一括 `graduated` 化
- **Rationale**: 「覚えている途中」一覧を導入時点で実態に合わせて減らす（主訴の即時解消）。判定条件は実行時ロジック（D1/D2）と同一述語
- **Alternatives considered**: 次回正解時に判定（全件をもう1回ずつ解く必要があり解消が遅い）／新規のみ適用（既存の溜まりが解消されない）

## D4: 早期卒業時の SRS 値 — status のみ変更

- **Decision**: 早期卒業時も easeFactor / repetition / interval / dueDate は SM-2 計算値をそのまま保存し、`status` だけ `graduated` にする
- **Rationale**: 復習対象の抽出・一覧表示は `status` フィルタで行われており、値の意味を変えない方が卒業後の誤答復帰（既存のリセット経路）と整合する
- **Alternatives considered**: interval を 30日等に引き上げて保存（卒業判定に使われない値の加工は無意味で、復帰時の挙動を歪めるだけ）
