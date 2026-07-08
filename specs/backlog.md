# Backlog: 将来対応

次の spec で着手する候補。優先順は上から。

## 次期 spec 候補

- [x] B001 学習ダッシュボード → **実装完了**
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

- [x] B009 【バグ/UX・修正済】Mode A の全国地図がタッチ端末でピンチズームできない（iPhone Chrome で報告）
  - 修正: `components/map/JapanMap.tsx` で PointerEvent を pointerId ごとに Map で追跡し、2ポインタ時は距離比で `scale` を更新＋指の中点を不動点に保つよう `translate` を補正（2本指ドラッグのパンも同時に成立）。ピンチ→片指に戻ったらドラッグパンへシームレスに移行。ピンチ中は click 抑止（誤選択防止）
  - `MunicipalityMap.tsx`（Mode D 側）は Google Maps の `gestureHandling: 'greedy'` がピンチを処理するため対象外と確認
  - ↓ 当初の調査メモ
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

- [x] B011 【バグ・修正済】サインアップ確認メール（confirm your mail）のリンクが localhost に向く
  - 修正（①コード側）: `signUp` に ``options: { emailRedirectTo: `${window.location.origin}/auth/callback` }`` を追加済み
  - 修正（②設定側・2026-07-04 実施済み）: 本番 Supabase ダッシュボード（Authentication → URL Configuration）で Site URL を `https://geo-dojo.faru.jp` に変更し、Redirect URLs に `https://geo-dojo.faru.jp/**`・`https://geo-dojo.vercel.app/**`・`http://localhost:3000-3002/**` を登録（allowlist はパスまで照合されるため `/**` 必須）
  - 残: 本番で実際にサインアップし、メールのリンクが `https://geo-dojo.faru.jp/auth/callback` に向き、踏んだ後にログイン状態になることを end-to-end で確認
  - ↓ 当初の調査メモ
  - 症状: 本番でサインアップすると、届く確認メールのリンクが `http://localhost:3000` を指しアクセスできない
  - 原因（確認済・2要因）:
    - ① `app/(auth)/signup/page.tsx:27` の `auth.signUp({ email, password })` が **`emailRedirectTo` を渡していない** → リンク先が Supabase プロジェクトの Site URL 設定にフォールバック。`forgot-password/page.tsx:26` は `${window.location.origin}/auth/callback?next=...` を渡しており正しい実装の手本
    - ② 本番共有 Supabase プロジェクト（ダッシュボード側）の **Site URL がデフォルト `http://localhost:3000` のまま**の可能性大。ローカル `supabase/config.toml` は `enable_confirmations = false` で確認メール自体が出ないため、本番でのみ顕在化（ローカルで再現しない罠）
  - 修正案:
    - コード: `signUp` に ``options: { emailRedirectTo: `${window.location.origin}/auth/callback` }`` を追加（Preview/本番それぞれ自分の origin に戻れる）
    - 設定: 本番 Supabase ダッシュボード（Authentication → URL Configuration）で Site URL を本番 Vercel URL に変更し、Preview URL（ワイルドカード `https://*-<team>.vercel.app` 等）を Redirect URLs に追加。**redirect URL は allowlist 制なので②を直さないと①だけでは Site URL に丸められる**
  - 検証: Preview デプロイでサインアップ → Mailpit ではなく実メールで確認リンクの向き先を確認（本番 Supabase は Preview と共有なので end-to-end 検証可能）
  - 関連: AGENTS.md「環境分離」（Preview/本番が Supabase 共有）

- [x] B013 【バグ・修正済】復習の due 判定における時分秒の考慮漏れとダッシュボードの表示矛盾
  - 修正: `lib/utils/date-jst.ts` に `getJSTStartOfTomorrow()`（境界）と `diffJSTCalendarDays()`（JST暦日単位の日数差）を追加し、以下を全て同じ境界に統一
    - `getDueReviewSummaryData`（`app/(app)/dashboard/queries.ts`）: `dueCount` を `lt(dueDate, jstStartOfTomorrow)`、`nextDueAt` を `gte(dueDate, jstStartOfTomorrow)` に変更（今日中に due になるものは dueCount 側に寄せ、nextDueAt は明日以降のみ）
    - `getUpcomingReviewScheduleData`: 開始基準を `now` から `jstStartOfTomorrow` に変更（今日分の二重表示を防止）
    - `getDueReviewItems`（`app/(app)/quiz/review/actions.ts`）: 同じ境界に統一（プレイ可能な due と dueCount の不一致を防止）
    - `formatNextDue`（`components/dashboard/review-card.tsx`）: `Math.ceil(ms差)` を `diffJSTCalendarDays` による JST暦日ベースの差分に変更
  - テスト: `__tests__/lib/utils/date-jst.test.ts` で境界値（JST 23:59、翌日またぎ等）を検証
  - ↓ 当初の調査メモ
  - 症状: 「今日の復習はありません」と表示されているのに、「今後7日間の予定」の今日の日付（例: 07-05）に件数（例: 13件）が表示される。また、「次の復習: 明日」と表示されているのに、実際は数分後〜数時間後に due になるアイテムがある。
  - 原因:
    1. `formatNextDue` の日数計算が `Math.ceil(diff / DAY_MS)` になっており、1ミリ秒でも未来なら一律で「明日」と判定される。
    2. `srsRecords.dueDate` と `now` の比較が秒（ミリ秒）単位で行われているため、今日のこれからの時間に due になるものは `dueCount` に入らない。
    3. 一方、カレンダーの「今後7日間の予定」は `gt(dueDate, now)` かつ `Asia/Tokyo` タイムゾーンの日付でグループ化されるため、今日 due になる未来のアイテムがカレンダーの「今日」に表示される。
  - 対策案:
    - 復習の due 判定を日付単位（JST での「今日」の終わり以前）にする。
    - `getDueReviewSummaryData` や `getDueReviewItems` での due 条件を `dueDate <= jstEndOfToday` に変更する。
    - `getUpcomingReviewScheduleData` の開始基準を `dueDate > jstEndOfToday`（明日以降の予定）に変更する。
    - `formatNextDue` を JST 日付ベースの差分計算に修正する（差分0日なら「今日」、1日なら「明日」など）。

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
  - 関連: [[B004]]、B006（ズームパン）

- [ ] B012 都道府県名と同一の市区町村を出題から除外するフィルタ
  - 案: 「青森市（青森県）」や「秋田市（秋田県）」などのように、都道府県名と市区町村名（接尾辞を除く）が一致するものは、答えが自明（簡単すぎる）なため、テキストベースのクイズ（Mode Aなど）で出題から除外できるようにする。
  - 考慮事項: 地図で位置を当てる問題（地図タップ系モードなど）は、名前が一致していても位置当て自体の難易度は下がらないため、除外対象外（出題してよい）とする。
  - 対応: 出題選択ロジック（`lib/quiz/` や `buildQuestions`）において、モードに応じて `municipality.name` と `municipality.prefecture` の共通部分（例：「青森」）が一致するものを除外するフィルタを追加（設定でオンオフできるとより良い）。

- [ ] B014 いい感じのSE（効果音）の追加
  - 案: クイズの正解・不正解時やクイズ完了（全問正解など）の際に、ユーザー体験を高める効果音を再生する。
  - 考慮事項: 設定画面やクイズ画面での音量調節・ミュート機能。軽量な Web Audio API でのシンセサイズ音生成、またはライセンス的に安全な音声アセットの選定。

- [ ] B015 都道府県・市区町村の読み仮名（ふりがな）対応
  - 案: 難読な市区町村の学習効果を高めるため、出題時や結果画面、苦手リスト等で読み仮名（ひらがな）を表示できるようにする。特に、クイズ回答直後の正解・不正解フィードバック（結果表示）のタイミングで読み仮名を表示しておくと、その場で正しい読み方を確認できて学習効果が高い。
  - 対応: DBの `municipality_master` に `kana` カラムを追加し、`municipalities.json` に読み仮名データを同梱。`sync-municipality-master.ts` の同期ロジックも修正。

- [ ] B016 今日のおすすめクイズにおける地域選択（絞り込み）機能の改善
  - 案: 今日のおすすめクイズを開始する前に、特定の地域（特定の地方や都道府県）に絞り込んで出題できるようにする。
  - 現状: 「除外する地方」をトグルするUIはあるが、ポジティブに「この地方や都道府県だけをプレイする」といった選択や、都道府県単位での絞り込みには対応していない。
  - 対応: 推薦クイズ開始前の調整ダイアログ（`RecommendOverride`）において、特定の地方や都道府県を選択（または除外）して出題プールを絞り込めるUI/UXを追加する。
