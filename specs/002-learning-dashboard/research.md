# Research: 学習ダッシュボード

**Branch**: `002-learning-dashboard` | **Date**: 2026-05-25

## R1: チャートライブラリ選定

**Decision**: Recharts を採用

**Rationale**:
- React 向けの宣言的 API で、shadcn/ui との統合が容易（shadcn/ui は Recharts ベースのチャートコンポーネントを公式提供）
- 折れ線グラフ・プログレスバー等、ダッシュボードに必要なチャートタイプをすべてサポート
- バンドルサイズが許容範囲（tree-shaking 対応）
- TanStack Query のデータをそのまま props として渡せる

**Alternatives considered**:
- **Visx (Airbnb)**: D3 ベースで柔軟だが、低レベル API のため開発工数が大きい
- **Chart.js / react-chartjs-2**: Canvas ベースでモバイルタッチ操作のツールチップが扱いにくい
- **Nivo**: 豊富だが、バンドルサイズが大きくPWAに不向き
- **shadcn/ui Charts**: Recharts のラッパーなので、Recharts 採用で自動的に利用可能

## R2: セッション推定ロジック

**Decision**: 同一モード・時間ギャップ 5 分以内の連続回答を設定問題数でグルーピング

**Rationale**:
- `municipality_quiz_results` にはセッションIDが存在しない
- クイズは 10/20/30 問の固定問題数で実施される
- 同一モードの回答が短時間（5分以内）に連続する場合、同一セッションとみなす
- 5 分超のギャップがあれば、問題数に達していなくても別セッションとする（途中離脱ケース）

**Implementation approach**:
- サーバー側クエリで `answeredAt` を `ORDER BY` し、`LAG()` ウィンドウ関数で前回回答との時間差を計算
- 5 分超のギャップまたはモード変更でセッション境界を設定
- セッション内の `isCorrect` を集計して正答率を算出

**Alternatives considered**:
- **session_id カラム追加**: 正確だがスキーマ変更が必要。既存データに遡及適用不可
- **固定時間ウィンドウ（30分単位）**: 同一ウィンドウ内に複数セッションが含まれうる

## R3: ダッシュボード集計のパフォーマンス戦略

**Decision**: Server Actions + TanStack Query キャッシュで対応。新テーブル不要

**Rationale**:
- 現時点のユーザー数・データ量では、クエリ時集計で十分なパフォーマンス（3秒以内）を達成可能
- 既存インデックス `mqr_user_time_idx (user_id, answered_at)` がほぼ全クエリに有効
- TanStack Query の `staleTime` でクライアント側キャッシュを活用

**Scale thresholds**:
- 1ユーザーあたり ~10,000 回答レコードまではクエリ時集計で問題なし
- それ以上のデータ量になった場合は、日次集計テーブル（マテリアライズドビュー相当）の導入を検討

**Alternatives considered**:
- **日次集計テーブル**: 確実だが、現時点では過剰設計。データ量増加時に別specで対応
- **Edge Functions による定期集計**: Supabase pg_cron が使えるが、MVPには不要

## R4: ナビゲーション構造の変更

**Decision**: ボトムナビに「ホーム」タブを追加し、3タブ構成にする

**Rationale**:
- ダッシュボードをログイン後のトップページ（`/`）にするため、ホームタブが必要
- 既存の2タブ（都道府県・市区町村）はクイズ選択ページ `/quiz` 配下に統合
- ボトムナビ: ホーム(`/`) / 都道府県(`/quiz/prefecture`) / 市区町村(`/quiz/municipality`)

**Impact on existing routing**:
- 現在の `app/(app)/quiz/page.tsx`（クイズ種類選択）はボトムナビの2タブで代替されるため、削除または簡素化を検討
- ログイン後のリダイレクト先を `/quiz` → `/` に変更

## R5: マイルストーン既読管理

**Decision**: ローカルストレージに閉じたマイルストーンIDの配列を保持

**Rationale**:
- マイルストーンは本人のみが確認する情報で、デバイス間同期の必要性が低い
- 新テーブル不要でシンプル
- ローカルストレージキー: `geodojo:milestones:dismissed`
- 値: `["correct-100", "correct-500", "coverage-25", ...]`

**Alternatives considered**:
- **DB テーブル**: デバイス間同期が可能だが、マイルストーンのためだけにテーブル新設は過剰
- **Cookie**: サイズ制限あり、サーバーに毎回送信されるため不適切
