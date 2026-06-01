# Quickstart: 科学的間隔反復による間違い復習

実装後の動作確認手順。ローカル Supabase（`supabase start`）+ `pnpm dev` を前提とする。

## セットアップ

```bash
pnpm install
pnpm drizzle-kit generate   # srs_records マイグレーション生成
# 生成された SQL に RLS ポリシー + バックフィル INSERT...SELECT を同梱（data-model.md 参照）
pnpm drizzle-kit push       # ローカル DB へ適用
pnpm dev
```

> 本番/preview は CI(`migrate.yml`)で migration 適用。ローカルは別データ（memory: local supabase stack 参照）。

## 単体テスト（SM-2 純粋ロジック）

```bash
pnpm test            # vitest（lib/quiz/srs/*.test.ts）
```

確認ポイント:
- `applySm2`: 正解(q=4)で EF 不変・interval が 1→6→round(6*EF)... と拡大、不正解(q=2)で rep=0/interval=1/EF 約-0.32・下限1.3クランプ。
- `scheduler`: `isDue` の境界（due==now は対象）、`shouldGraduate`（interval>=30 && rep>=4）、`alreadyAdvancedToday`（JST 同日判定）。

## 手動シナリオ

### S1. 間違い→期日到来→復習→再スケジュール（US1 / FR-001,005,006,007,009）
1. 通常クイズ（例 Mode B）で数問わざと誤答。
2. ダッシュボードに戻ると「今日の復習 N件」が誤答数分だけ増えている（バックフィル分含む / 初回誤答は即時到来）。
3. 「復習を始める」→ 期日到来分のみ出題される。期日未到来は出ない（SC-008）。
4. 正解した問題は次回 due が延び（翌日以降）、誤答した問題は翌日に再 due。

### S2. モード混在セッション（FR-012a/012b / SC-007）
1. Mode A/B/C/D それぞれで誤答を作る（複数モード）。
2. `/quiz/review` 開始 → 1セッション内で地図選択(A)・4択(B/C)・地図タップ(D)が**問題ごとに切り替わって**出題される。
3. 出題順が due_date 昇順（モードは混在のまま）であることを確認（インターリービング）。

### S3. 通常クイズ正解での前進と同日ガード（FR-005a / R3）
1. 復習対象の市区町村を通常クイズ（苦手優先 off）で偶然正解。
2. その対象の due が延びる（前進）。
3. 同日にもう一度正解しても **2回目は前進しない**（ログのみ）。翌日以降の正解で再び前進。

### S4. 卒業と復帰（FR-018/019 / R2）
1. 同一対象を（日をまたいで）連続正解させ rep>=4 / interval>=30 に到達 → 「定着済み」件数に移り「今日の復習」から消える。
2. 卒業済み対象を通常クイズで誤答 → 「復習中」に戻り即時 due。

### S5. 空状態（FR-015）
1. 期日到来分を全消化 → ダッシュボードが「今日の復習なし」+ 次回予定日（nextDueAt）を表示。

### S6. データ分離（SC-004）
- 同一市区町村の Mode A と Mode D が独立した due を持ち、片方の復習が他方の期日に影響しないことを DB で確認。

## 受け入れ確認チェック

- [ ] S1〜S6 が期待どおり
- [ ] `pnpm lint` 型チェック通過
- [ ] `pnpm test` 緑
- [ ] `srs_records` に `(user_id, due_date)` インデックスが存在（憲法 II）
- [ ] RLS で他ユーザーの `srs_records` が見えない
- [ ] 復習回答が `municipality_quiz_results` にも記録され、既存ダッシュボード指標に反映（FR-011a）
