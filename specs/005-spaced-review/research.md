# Phase 0 Research: 科学的間隔反復による間違い復習

spec の Assumptions / Clarifications で plan へ委ねられた論点を確定する。

---

## R1. SM-2 アルゴリズムのパラメータと二値マッピング

**Decision**:
- 状態: `easeFactor`(初期 2.5・下限 1.3)、`repetition`(連続正解回数, 初期 0)、`interval`(日数, 初期 0)。
- 回答の質 `q`: **正解=4 / 不正解=2** に固定（spec Clarification Q3）。
- 更新規則（標準 SM-2）:
  - `q < 3`（不正解）: `repetition = 0`, `interval = 1`（翌日）。
  - `q >= 3`（正解）: `repetition += 1`；`interval = repetition===1 ? 1 : repetition===2 ? 6 : round(prevInterval * easeFactor)`。
  - `easeFactor` は毎回 `EF' = max(1.3, EF + (0.1 - (5-q)*(0.08 + (5-q)*0.02)))`。→ q=4 で EF 不変、q=2 で約 -0.32。
- `dueDate = now + interval 日`。`q=2` のとき翌日相当。

**Rationale**: 二値固定で判定ロジックとテストを単純化しつつ、EF による1問ごとの間隔最適化という SM-2 の科学的中核を保持（spec FR-005〜007 を満たす）。q=4 を「正解」既定にすると EF が下がらず、安定した間隔拡大になる。

**Alternatives considered**: Leitner 固定箱（適応性に欠ける／spec で SM-2 採用済み）。回答時間で q を 3–5 に刻む案（ヒント機能が存在せず、Mode D 以外に時間情報が乏しいため将来拡張に留保）。

---

## R2. 卒業（定着済み）判定と復帰

**Decision**:
- 正解更新後に **`interval >= 30 日` かつ `repetition >= 4`** に達したら `status = 'graduated'` とし、以後 due 抽出・件数から除外（FR-018）。
- `graduated` の対象が（通常クイズ・復習いずれかで）**不正解**になったら `status = 'reviewing'` に戻し、`repetition = 0 / interval = 1 / dueDate = now`（即時到来, FR-019）。`easeFactor` は引き継ぐ（過去の難しさを保持）。

**Rationale**: SM-2 は間隔が無限に伸びるため明示的な卒業境界が必要。rep>=4 はおおむね interval 30日超に到達する段階で、「十分覚えた」と判断できる。EF を引き継ぐことで再登録時に妥当な難易度から再開できる。

**Alternatives considered**: 卒業なしで永続スケジュール（spec Q4 で却下）。interval のみで判定（連続正解の安定性を担保できないため rep も併用）。

---

## R3. 全クイズ回答での SM-2 更新と同日重複ガード

**Decision**:
- `saveMunicipalityQuizResult`（既存 Server Action）に SM-2 upsert を統合。**復習セッション・通常クイズの区別なく**、回答対象 (code, mode) の `srs_records` 行を更新（無ければ作成）。
- **正解の前進は JST 1日1回まで**: `formatJSTDate(lastReviewedAt) === getJSTToday()` かつ正解なら、ログ記録のみで SM-2 前進をスキップ（`lib/utils/date-jst.ts` を再利用）。
- **不正解は常に反映**（リセット／復帰は学習上重要なため同日ガードの対象外）。
- 新規 (code, mode) で初回が正解の場合も登録するが（FR-001 は誤答時登録だが、FR-005a の前進対象として正解時も upsert）、初回正解は `repetition=1, interval=1` で登録。

**Rationale**: FR-005a（どのクイズの正解でも前進）を満たす。同一問題に同日複数回当たる重み付き出題で間隔が過剰に伸びる事故を 1日1回ガードで防ぐ。JST 基準は既存ダッシュボード集計と一貫。

**Alternatives considered**: 復習セッション内のみ前進（spec Q5 で却下）。ガードなし（間隔暴走リスク）。

---

## R4. 既存誤答ログのバックフィル

**Decision**:
- migration 内の `INSERT ... SELECT` で一括生成。`municipality_quiz_results` を `(user_id, municipality_code, mode)` でグルーピングし、**不正解が1回以上**ある組について 1 行作成。
- 初期値: `easeFactor=2.5, repetition=0, interval=0, dueDate=now(), status='reviewing'`、`municipalityName/prefecture` は最新ログから採用。
- **即時到来**（dueDate=now）で導入直後から全件復習可能（spec FR-001a）。負荷分散はしない（アプリ内表示のみ・通知なしのため、大量到来でも FR-010 のセッション上限＋優先順位で吸収）。

**Rationale**: 主目的（過去の間違いの復習）に直結。単発の集計 INSERT で完結し、ランタイムの遅延生成より単純。負荷分散の必要性はセッション上限で代替できる。

**Alternatives considered**: 初回ログイン時の遅延生成（実装複雑）。最終回答日からの期日推定で分散配置（通知が無いので分散の価値が低く、却下）。

---

## R5. モード混在セッションの実現方式

**Decision**:
- `app/(app)/quiz/municipality/[mode]/page.tsx` の **playing フェーズ（A/B/C/D 描画＋回答ハンドラ＋`recordAndAdvance`）を `components/quiz/quiz-runner.tsx` へ抽出**。入力: `Question[]`（各要素が自モードを保持）、出力: 完了時の結果。
- 復習ルート `app/(app)/quiz/review/page.tsx` は、Server Action `getDueReviewItems()` で期日到来の `srs_records`（優先度順: due_date 昇順 → interval 昇順, 上限まで）を取得し、クライアントで市区町村データセット + distractor 生成を用いて **モード混在の `Question[]`** を組み立て、`QuizRunner` に渡す。
- 出題順は優先度順のまま（モードをまとめ直さない＝インターリービング, FR-012b）。
- 既存 `[mode]/page.tsx` は単一モードの `Question[]` を生成して同じ `QuizRunner` を使う形へリファクタ。

**Rationale**: `QuizRunner` は既に1コンポーネント内で `question.kind`/`mode` により描画を分岐しているため、混在 `Question[]` を渡すだけでモード切替が成立（FR-012a）。重複実装を避け UI 一貫性を保つ。

**Alternatives considered**: 復習用に独立した進行UIを新規実装（重複・乖離リスク）。モードごとにセッション分割（FR-012b インターリービングに反する）。

---

## R6. Mode A（同名グルーピング）と (code, mode) 単位の整合

**Decision**:
- `srs_records` は (code, mode='A') 単位で保持。復習出題時、due な Mode A の各 code を **既存 buildQuestions と同じく name でグルーピング**して 1 つの `ModeAQuestion` に束ねる。
- 採点は instance（県）単位の正誤に基づき、束ねられた各 code の `srs_records` を個別に更新（その県を正しく選べたかで code ごとに正解/不正解を判定）。

**Rationale**: 出題は name 単位だが学習状態は code 単位で正確に追える。既存 Mode A の出題仕様（同名複数県を1問）と SRS の粒度を両立。

**Alternatives considered**: Mode A だけ name をキーにする（他モードと不整合・実装分岐増）。

---

## R7. 「今日の復習」件数・進捗・空状態

**Decision**:
- `getDueReviewSummary()`: `dueCount`(status='reviewing' AND due_date<=now), `reviewingCount`, `graduatedCount`, `nextDueAt`(最短の未来 due_date) を返す。
- ダッシュボード `review-recommendations.tsx` を「今日の復習 N件」カードへ置換。N>0 で `/quiz/review` 開始ボタン、N=0 で「今日の復習なし」＋ `nextDueAt` 案内（FR-015）。
- 進捗（US3）は同サマリ + 今後7日の日別 due 件数（`getUpcomingReviewSchedule()`）。読み取りは TanStack Query フック化。

**Rationale**: 既存ダッシュボードの Read=TanStack Query パターン（憲法 II）に沿い、1サマリ Server Action で主要数値をまとめて取得。

---

## R8. テスト方針

**Decision**: `lib/quiz/srs/`（純粋関数）のみ **Vitest** で単体テスト。`applySm2`（質ごとの EF/interval/repetition 遷移、下限クランプ）、`scheduler`（isDue 境界、卒業判定、JST 同日ガード）。DB・Server Action・UI は手動 quickstart 検証。`package.json` に `test` script と devDeps（vitest）を追加。

**Rationale**: SM-2 は決定的でバグが間隔計算に直結するため自動テスト価値が最大。既存にテスト基盤が無いため、純粋ロジックに絞って最小導入しコストを抑える。

**Alternatives considered**: E2E/コンポーネントテスト一式（現状スコープに対し過大）。テスト無し（SM-2 の回帰検知ができず却下）。

---

---

## R9. ダッシュボード UX: 復習最上位配置 と 復習→おすすめクイズ誘導

**Decision**:

### ダッシュボードレイアウト

`app/(app)/page.tsx` の配置を以下の順序に変更する。

```
[既存: 新規ユーザー向け（totalQuestions === 0）]
  RecommendHeroCard  ← 引き続き先頭（新規ユーザーに変更なし）

[guard: totalQuestions > 0（返却ユーザー向け）]
  ReviewRecommendations  ← ★ 最上位に移動（復習が最優先タスク）
  RecommendHeroCard      ← ★ 復習の直後に移動
  SummaryCards / StreakDisplay / Charts / WeaknessRanking / ReviewProgress
```

この並びにより:
- `dueCount > 0` の時: 復習カードがページ最上部 → 学習者が復習から始める
- `dueCount === 0` の時: 「今日の復習なし/完了」表示の直下に RecommendHeroCard が自然に昇格し、「次のアクション」として視覚的に浮かび上がる
- 新規ユーザー（`totalQuestions === 0`）: 現状どおり RecommendHeroCard が先頭

### 復習セッション結果画面への CTA 追加

`app/(app)/quiz/review/page.tsx` の `phase === 'result'` に「✨ 今日のおすすめクイズを試す」ボタンを追加。
リンク先: `/?recommend=open`。
`RecommendHeroCard` は `?recommend=open` を `useSearchParams` で検知して `RecommendSheet` を自動開放するため（`recommend-hero-card.tsx:openSheet` 参照）、ダッシュボードに戻った瞬間にシートが開き、ワンタップでおすすめクイズに入れる。

ボタン順: 「✨ 今日のおすすめクイズを試す」（primary）→「ダッシュボードへ」（secondary/outline）。

**Rationale**: 
- 学習者の daily flow（復習 → クイズ）を UI の上下に忠実に反映。
- `dueCount=0` 時に RecommendHeroCard が自然昇格する構造のため、追加の状態管理・条件分岐が不要。
- 結果画面の CTA は既存 `/?recommend=open` ルーティングを再利用し、実装コストを最小化。

**Alternatives considered**:
- 結果画面に RecommendSheet を直接埋め込む → 実装過大、ルーティング設計を複雑化。
- RecommendHeroCard に dueCount props を渡して見た目を変える → コンポーネントに余計な責務を持たせる。

---

## 未解決事項

なし（spec の plan 委譲項目はすべて上記で確定）。
