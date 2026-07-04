# Backlog: 将来対応

次の spec で着手する候補。優先順は上から。

## 次期 spec 候補

- [ ] B001 学習ダッシュボード（spec-002 予定）
  - 正答率の推移グラフ、苦手市区町村ランキング、連続学習日数（ストリーク）
  - 既存 `municipality_quiz_results` のデータを可視化、新テーブル不要の見込み

- [x] B002 間隔反復復習モード → **005-spaced-review で SM-2 として着手済み**
  - Leitner 想定から変更: SM-2（Anki方式）を採用（1問ごとに easeFactor で間隔動的最適化）
  - 新規テーブル: `srs_records`（user_id, municipality_code, mode, ease_factor, interval, due_date, status）
  - 管理単位: (municipalityCode, mode) — モードごとに独立した学習状態
  - 既存誤答ログから初期バックフィル、全クイズ回答で SM-2 更新

- [ ] B003 都道府県クイズ強化 + タイムアタック（spec-004 予定）
  - 都道府県クイズの結果を DB 保存 + 苦手優先 + 復習モード対応
  - 時間制限モード追加（タイムを記録・競える）
  - 前提: 地図タップの操作性改善（現状のUIのイマイチな点を洗い出して改修）

- [ ] B009 【バグ/UX】Mode A の全国地図がタッチ端末でピンチズームできない（iPhone Chrome で報告）
  - 症状: 市区町村クイズ Mode A（逆引き地図）で、iPhone Chrome にてピンチイン/アウトの拡大縮小が効かない
  - 原因（確認済）: `components/map/JapanMap.tsx` が `touch-none` でブラウザ標準のピンチズームを無効化した上で、独自ズームは wheel イベント（PC のみ）と +/− ボタンのみ。Pointer イベントは単一ポインタのドラッグパンだけでマルチタッチ（2本指ピンチ）未処理 → iPhone に限らずタッチ端末全般で再現するはず
  - 案: PointerEvent を pointerId で複数追跡し、2ポインタ間距離の変化で `scale` を更新（中点を transformOrigin 側で考慮できると理想）。2本指ドラッグでのパンも同時に対応すると自然
  - 関連: [[B006]]（Mode A のズーム可能化が前提と記載）、[[B003]]（地図タップの操作性改善）。`MunicipalityMap.tsx`（Mode D 側）も同様の構造なら合わせて確認

- [ ] B010 解答時間の記録と、時間・ミス履歴に基づく習熟（卒業）判定の高速化
  - 動機（ユーザー報告）: ①Mode D で何秒で解答できたか保存したい ②制限30秒は判定基準として長すぎ、10秒以内で答えられたら「覚えた」扱いにしたい ③いつまで経っても復習リストから覚えた場所が消えない。一度もミスしていない簡単な問題は早めに卒業させたい
  - 現状（確認済）:
    - 解答時間は未計測・未保存。`municipality_quiz_results` に時間カラムなし、`quiz-runner.tsx` には制限タイマー（`TIME_LIMIT_SEC=30`）があるだけ
    - SM-2 の quality は正解=4 / 不正解=2 の固定2値（`lib/quiz/srs/types.ts` の `ReviewQuality`、`update.ts:56`）で「余裕で正解（q=5）」の道がない
    - 卒業条件は `interval>=30日 && repetition>=4`（`sm2.ts` の `GRADUATION_*`）+ 正解は JST 1日1回しか前進しない同日ガード → **毎日完璧に復習しても卒業まで最短22日**（1d→6d→15d→38d）。しかも1回の不正解で repetition=0 / interval=1日 に完全リセット＋EF低下 → 「復習から消えない」体感は仕様通り
  - 案（段階実装）:
    - Phase 1（計測・保存）: 出題表示時刻から解答確定までの経過時間を計測し、`municipality_quiz_results` に `answer_time_ms` カラムを追加して保存（マイグレーション + RLS 留意）。Mode D が主目的だが計測コストは同じなので全モード保存でよい
    - Phase 2（判定への反映）: 解答時間で quality を段階化（例: 正解かつ10秒以内 → q=5、正解 → q=4、不正解 → q=2）。q=5 は EF が上がり interval の伸びが加速 → 卒業が早まる
    - Phase 3（卒業の高速化）: ミス0回（lapse なし）かつ常に速答の項目はさらに前倒し（例: repetition>=3 かつ全て q=5 なら卒業、あるいは `GRADUATION_INTERVAL`/`GRADUATION_REPETITIONS` の緩和、easy bonus 係数）。閾値（10秒等）はモードにより適正が違う可能性あり（Mode D 地図タップ vs B/C 選択式）ので spec 時に検討
  - 該当: `components/quiz/quiz-runner.tsx`（計測）、`lib/db/schema.ts` + `supabase/migrations/`（カラム追加）、`lib/quiz/srs/sm2.ts` / `update.ts` / `types.ts`（quality 拡張・卒業条件）、`app/actions`（保存 Server Action）
  - 関連: 005-spaced-review（SM-2 本体）、[[B005]]（正答率ベース難易度とも思想が近い）

- [ ] B011 【バグ・コード側修正済】サインアップ確認メール（confirm your mail）のリンクが localhost に向く
  - 修正（①コード側）: `signUp` に `options: { emailRedirectTo: \`${window.location.origin}/auth/callback\` }` を追加済み
  - **残作業（②設定側・手動）**: 本番 Supabase ダッシュボード（Authentication → URL Configuration）で Site URL を本番 Vercel URL に変更し、Preview URL を Redirect URLs に追加。redirect URL は allowlist 制なので②を直すまで①だけでは Site URL に丸められる
  - ↓ 当初の調査メモ
  - 症状: 本番でサインアップすると、届く確認メールのリンクが `http://localhost:3000` を指しアクセスできない
  - 原因（確認済・2要因）:
    - ① `app/(auth)/signup/page.tsx:27` の `auth.signUp({ email, password })` が **`emailRedirectTo` を渡していない** → リンク先が Supabase プロジェクトの Site URL 設定にフォールバック。`forgot-password/page.tsx:26` は `${window.location.origin}/auth/callback?next=...` を渡しており正しい実装の手本
    - ② 本番共有 Supabase プロジェクト（ダッシュボード側）の **Site URL がデフォルト `http://localhost:3000` のまま**の可能性大。ローカル `supabase/config.toml` は `enable_confirmations = false` で確認メール自体が出ないため、本番でのみ顕在化（ローカルで再現しない罠）
  - 修正案:
    - コード: `signUp` に `options: { emailRedirectTo: \`${window.location.origin}/auth/callback\` }` を追加（Preview/本番それぞれ自分の origin に戻れる）
    - 設定: 本番 Supabase ダッシュボード（Authentication → URL Configuration）で Site URL を本番 Vercel URL に変更し、Preview URL（ワイルドカード `https://*-<team>.vercel.app` 等）を Redirect URLs に追加。**redirect URL は allowlist 制なので②を直さないと①だけでは Site URL に丸められる**
  - 検証: Preview デプロイでサインアップ → Mailpit ではなく実メールで確認リンクの向き先を確認（本番 Supabase は Preview と共有なので end-to-end 検証可能）
  - 関連: AGENTS.md「環境分離」（Preview/本番が Supabase 共有）

## アイデアストック

- [ ] B004 政令指定都市の区レベル詳細化（高難易度モード）
  - 現状: 仙台市5区が全て `name:'仙台市'` → Mode C/D で重複出題・Mode D でタップ精度問題
  - 案: expert 難易度のみ区名（`仙台市青葉区`）を個別エントリとして出題
  - 対応ファイル: `scripts/generate-municipalities.ts`、`scripts/sync-municipality-master.ts`、`lib/quiz/municipality-data.ts`

- [ ] B008 Mode A で東京23特別区が区ごとに出題される（全部答えが東京都）
  - 症状: Mode A（逆引き地図・名前→都道府県）で `港区` `渋谷区` 等が個別に出題され、**23問すべて答えが「東京都」**になる。冗長・簡単すぎる
  - 実データ（確認済）: `港区` は東京都のみ（code 13103・曖昧ではない）。東京都の「区」エントリ＝23（特別区が各個別）。一方、政令市県（愛知/大阪/宮城）に「区」エントリは無く、政令市の区は親市名にマージ済（例: 仙台市5区＝全て `name='仙台市'`）。→ **特別区は個別・政令市の区はマージ、という非対称**
  - 補足: 特別区はデータ上は正しい（地方自治法上の独立した基礎自治体）。問題は「クイズ出題として東京23区を個別に出すか」の設計判断
  - 案: ①Mode A では東京23特別区をまとめて扱う/出題比率を下げる ②そのまま許容（東京＝簡単枠と割り切る） ③難易度・出題ロジックで調整。いずれも [[B004]]（政令市の区レベル詳細化）と整合させて設計
  - 関連: B004、B007（政令市の多コード）、[[project-sync-ward-name-trap]]。マスタ生成 `scripts/generate-municipalities.ts` / `sync-municipality-master.ts`

- [ ] B005 難易度計算 Phase 3 — クラウド正答率の導入
  - 現状: Phase 2（e-Stat 人口ベース）で difficulty を静的に焼き込み済み
  - 案: 全ユーザーの正答率データを集計し、人口ベース difficulty と combined score で最終難易度を算出
  - 検討事項: 集計バッチの実行頻度、正答率カラム追加（`municipality_master.crowd_accuracy`）、combined score の重み付け

- [x] B007 【バグ・修正済】Mode A で政令市の区の数だけ結果・記録が多重カウントされる
  - 修正: `dedupeInstancesByPrefecture`（`lib/quiz/municipality-data.ts`）で都道府県ごとに代表1件へ畳んでから記録。`QuizRunner.handleModeASubmit` で適用。採点（`correctPrefectures`）は無変更。`__tests__/lib/quiz/mode-a-dedupe.test.ts` でテスト
  - 注意: 修正は**今後の多重INSERTを防ぐ**もの。導入前に既に膨張した `srs_records`/`municipality_quiz_results` の行はそのまま残るため、必要なら `supabase db reset`（ローカル）で一掃する
  - ↓ 当初の調査メモ
  - 症状: Mode A を10問でプレイしても結果が「13 / 31」など水増し。苦手リストに `福岡市（福岡県）`×7・`川崎市（神奈川県）`×7 のように同名が区数ぶん重複
  - 原因: `buildQuestions` の Mode A が `instances = all.filter(a => a.name === m.name)` で**同名の全エントリ（政令市の区を含む）を収集**し、`handleModeASubmit` が `recordAndAdvance(instances.map(...))` で**instance（=区コード）ごとに結果記録・保存**している。福岡市は7区が全て `name:'福岡市'` のため1問で7件記録される
  - 影響: ①結果件数・正答率の母数が水増し ②`municipality_quiz_results` が区数ぶん多重INSERT ③**005 の `srs_records` も区ごとに登録され復習件数・SRS統計が歪む**（本機能に波及）
  - 該当: `components/quiz/quiz-runner.tsx`（`handleModeASubmit`）/ `app/(app)/quiz/municipality/[mode]/page.tsx`（`buildQuestions` Mode A）
  - 修正案: Mode A の記録単位を「**1問1記録**」または「**distinct (name, prefecture) ごと**」にする（`instances` を prefecture でユニーク化してから記録）。採点（`correctPrefectures`）は現状維持でよい
  - 関連: [[B004]] 政令市の区マージ（根本はマスタで区が同名複数行）。既存コード由来の元バグ（005 のリファクタで持ち越し）

- [ ] B006 地図タップモード（A/D）不正解時に正解位置へ自動スクロール
  - 現状: 地図タップ系（Mode D 順引き地図 / Mode A 逆引き地図）で不正解でも地図が動かず、正解位置がビューポート外だと確認できない
  - 案: 不正解時に**正解位置が見える位置へ地図をパン/ズーム**。できれば**「誤ってタップ/選択した位置」と「正解位置」の両方が画面内に収まる**よう移動（両者の bounding box にフィット）すると、誤り↔正解の対比で覚えやすい
  - **Mode D**（順引き地図タップ）: 正解＝市区町村の位置。`components/map/MunicipalityMap.tsx`。タップ座標と正解 codes の座標から表示領域を計算してパン。`QuizRunner` の `correctCodes`/`wrongCodes` と連動
  - **Mode A**（逆引き地図・都道府県タップ）: 正解＝対象都道府県（複数あり得る）。`components/map/JapanMap.tsx`。誤選択した都道府県と正解都道府県の両方が収まるようフィット。`QuizRunner` の `selectedPrefectures`/`correctPrefectures` と連動
  - 補足: 同名複数区（政令市）や複数県（Mode A の同名グルーピング）は正解が複数 → 全体を含む領域にフィット。Mode A は全国地図が既に全体表示なので、ズーム可能化が前提（不可ならハイライト強調のみで可）
