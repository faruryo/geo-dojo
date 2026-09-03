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

- [x] B003 都道府県クイズ強化 + タイムアタック → **020-prefecture-quiz-enhancement で実装完了**
  - 実装: 設定画面（全国/地方別地域選択、出題数10/20/全問、通常/タイムアタックモード切替、苦手優先トグル）を追加。タイマー表示・クリアタイム計測・タイムアタック時の自己ベスト保存（localStorage）およびベスト更新バッジ表示を実装。過去の誤答データに基づく苦手優先出題に対応。
  - 該当: `lib/quiz/prefecture-quiz.ts`（純粋関数）、`app/(app)/quiz/prefecture/page.tsx`（UI画面）、`__tests__/lib/quiz/prefecture-quiz.test.ts`

- [x] B025 詳細分析ページ（ダッシュボードから外した学習データの集約） → **025-detailed-analytics (#81) で実装完了**
  - 実装: 024 でトップ画面から外した学習の内訳データ（正答率推移グラフ、苦手市区町村ランキング、モード別・難易度別クリア状況、4サマリーカード）を独立した詳細分析画面（`/analytics`）に移行・集約。ボトムナビに「分析」タブ（BarChart2アイコン）を追加。動的フィルター連動、Mode A 同名市複数県（および政令指定都市）のアトミック保存・1問1件正規化・代表難易度集約を実装。
  - 該当: `app/(app)/analytics/page.tsx`, `components/analytics/analytics-client.tsx`, `app/(app)/quiz/municipality/actions.ts`, `lib/db/queries/dashboard.ts`, `specs/025-detailed-analytics/`

- [ ] B022 【UI/UX】地図クイズのフルスクリーン化とHUD（オーバーレイ）UI（GeoGuessr風レイアウト） → **#82（次期着手予定）**
  - 概要: 地図を操作するクイズ（市区町村 Mode A / Mode D、都道府県クイズ）において、地図を画面いっぱいに広げ、問題文やお題、進捗ゲージ、タイマー、フィードバックなどを地図の上に浮かぶオーバーレイ（HUD: Heads-Up Display）として配置する。
  - 動機: 現行の縦積み（flex-col）レイアウトではヘッダーやカードに画面領域が圧迫され、肝心の地図表示領域が狭くなっている。GeoGuessrのように画面全体を地図として活用することで、高い没入感と直感的な地図の視認性・操作性（ズーム・パン・タップ）を提供する。
  - 対象画面:
    - 市区町村クイズ Mode A（逆引き地図タップ）
    - 市区町村クイズ Mode D（順引き地図タップ）
    - 都道府県クイズ（全国地図タップ・タイムアタック含む）
  - 想定UI/レイアウト案:
    - 地図レイヤー: 画面全体（ビューポートフル、100vh / h-full）にベースとして全画面描画
    - 上部HUD: 画面上部にフローティング配置（中断ボタン、進捗バー/問題数ゲージ、タイマー、音量ミュート）
    - 問題お題HUD: 地図上部中央または下部に半透明/ブラー加工のフローティングカードでお題（自治体名・ヒント等）と正否フィードバックを表示
    - アクションHUD: Mode A の解答確定ボタンや選択中の都道府県バッジ等を画面下部にフローティング配置
  - 検討事項:
    - 地図のパン/ピンチ操作とオーバーレイUIのインタラクション制御（`pointer-events-none` と `pointer-events-auto` の切り分け）
    - モバイル（375px基準・セーフエリア考慮）とデスクトップでのレスポンシブ配置
    - 不正解時の自動フォーカス（016-map-autofocus）やダークモード（`#111111`）との親和性

- [x] B014 (022) 市区町村クイズの未制覇（未クリア）優先出題と進捗可視化 → **022-uncompleted-priority-quiz (#63, #64) で実装完了**
  - 関東・中部など母数の大きい地域・難易度における100%制覇の難易度（クーポンコレクター問題）を解消。
  - 実装: クイズ設定画面に「未クリア優先出題」トグル（デフォルトON）とリアルタイム進捗（クリア件数/総数/進捗率）表示を追加。「今日のおすすめ」でも未クリア優先を自動適用。
  - 該当: `lib/quiz/sampling.ts`, `components/quiz/quiz-pool-progress.tsx`, `app/(app)/quiz/municipality/[mode]/page.tsx`, `lib/quiz/recommend-auto-start.ts`
  - 注: 効果音（014-sound-effects）と番号が重複していたため `B014 (022)` と表記。


- [x] B009 【バグ/UX・修正済】Mode A の全国地図がタッチ端末でピンチズームできない（iPhone Chrome で報告）
  - 修正: `components/map/JapanMap.tsx` で PointerEvent を pointerId ごとに Map で追跡し、2ポインタ時は距離比で `scale` を更新＋指の中点を不動点に保つよう `translate` を補正（2本指ドラッグのパンも同時に成立）。ピンチ→片指に戻ったらドラッグパンへシームレスに移行。ピンチ中は click 抑止（誤選択防止）
  - `MunicipalityMap.tsx`（Mode D 側）は Google Maps の `gestureHandling: 'greedy'` がピンチを処理するため対象外と確認
  - ↓ 当初の調査メモ
  - 症状: 市区町村クイズ Mode A（逆引き地図）で、iPhone Chrome にてピンチイン/アウトの拡大縮小が効かない
  - 原因（確認済）: `components/map/JapanMap.tsx` が `touch-none` でブラウザ標準のピンチズームを無効化した上で、独自ズームは wheel イベント（PC のみ）と +/− ボタンのみ。Pointer イベントは単一ポインタのドラッグパンだけでマルチタッチ（2本指ピンチ）未処理 → iPhone に限らずタッチ端末全般で再現するはず
  - 案: PointerEvent を pointerId で複数追跡し、2ポインタ間距離の変化で `scale` を更新（中点を transformOrigin 側で考慮できると理想）。2本指ドラッグでのパンも同時に対応すると自然
  - 関連: [[B006]]（Mode A のズーム可能化が前提と記載）、[[B003]]（地図タップの操作性改善）。`MunicipalityMap.tsx`（Mode D 側）も同様の構造なら合わせて確認

- [x] B010 解答時間の記録と、時間・ミス履歴に基づく習熟（卒業）判定の高速化 → **実装完了**
  - **Phase 1 実装完了**: 017-answer-time-recording (`specs/017-answer-time-recording/spec.md`) にて出題表示からの経過時間 (`answer_time_ms`) の計測・DB保存および上限バリデーションを実装済み。
  - **Phase 2 & 3 実装完了**: 018-fast-graduation-quality (`specs/018-fast-graduation-quality/spec.md`) にて解答時間に基づく SM-2 `quality = 5`（10秒以内速答）の段階化と Ease Factor 加速、および速答定着（rep>=3 && quality===5 && interval>=15）による早期卒業判定を実装済み。
  - 該当: `lib/quiz/srs/quality.ts`（速答判定）、`lib/quiz/srs/sm2.ts`（q=5 & 早期卒業）、`lib/quiz/srs/update.ts`（answerTimeMs 連携）、`app/(app)/quiz/municipality/actions.ts`（Server Action 連携）

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

- [x] B017 【バグ】市区町村モードCで「入門」難易度なのに「村」がダミー選択肢に出てしまう
  - 症状: 市区町村クイズのモードC（順引き4択）で難易度「入門」を選択している際、問題の答え（正解）は入門対象の「市」などだが、不正解のダミー選択肢に「村」などの高難易度の市区町村が混入してしまう。
  - 原因: `app/(app)/quiz/municipality/[mode]/page.tsx` の `buildQuestions` 内で、ダミー選択肢（distractors）を抽出する `distractorPool` の収集ループ（`for (const c of all)`）において、難易度（difficulty）によるフィルタリングを一切行っていないため。
  - 対策案: `distractorPool` を構築する際、`settings.difficulties` に含まれる難易度の市区町村のみを対象にするように修正する。
  - 該当: [page.tsx](file:///Users/faru/geo-dojo/app/%28app%29/quiz/municipality/%5Bmode%5D/page.tsx) の `buildQuestions`

- [x] B018 【UX改善】モード選択画面に戻った際に直前に選択・プレイしていたモードを保持する → **実装完了**
  - 実装: `lib/quiz/last-selected-mode.ts` にモード解釈・フォールバック関数 `resolveInitialSelectedMode` と純粋関数群を定義し、localStorage キー `geo-dojo:last-selected-mode` に保存・復元。モード選択画面 (`/quiz/municipality`) でのボタン選択・決定時、および各モード設定画面 (`/quiz/municipality/[mode]`) への直アクセス・遷移時に自動記録。URL パラメータ（`?mode=X`）がある場合は URL パラメータを最優先。`__tests__/lib/quiz/last-selected-mode.test.ts` に単体テストを追加。

## アイデアストック

- [x] B004 政令指定都市の区レベル詳細化（Mode D 対応） → **024-conquest-mode-a (#74) / 026-mode-d-custom-pool (#79) で解決済み**
  - 実装: Mode D（場所当て地図）において、`designated-city-ward-names.json` と `locationLabel` により政令市の区名（例:「札幌市中央区」）を出題表示し、5桁市区町村コード単位で正誤判定および個別地図タップが可能に。また 026 にて市区町村選択ダイアログでも区単位での選択に対応。
  - 設計方針: Mode A/B/C（テキスト・県当てモード）については親市名（「札幌市」等）に集約する仕様で確定（同名区の不条理回避およびマスタ整合性維持のため、DBの `municipality_master.name` は市名のまま維持）。

- [x] B008 Mode A/B/C で東京23特別区が区ごとに出題される（gh issue #32 にて対応完了）
  - 概要: テキスト形式クイズ（Mode A, B, C）において、`isTokyoSpecialWard` / `filterTokyoSpecialWards` により東京23区（`東京都` かつ `〇〇区`）を出題プールから除外。自明性および同名区（大阪市港区等）の不理不尽さを解消。Mode D（順引き地図）などの位置当てモードでは引き続き出題可能。

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

- [x] B006 地図タップモード（A/D）不正解時に正解位置へ自動スクロール → **016-map-autofocus で実装完了**
  - 現状: 地図タップ系（Mode D 順引き地図 / Mode A 逆引き地図）で不正解でも地図が動かず、正解位置がビューポート外だと確認できない
  - 案: 不正解時に**正解位置が見える位置へ地図をパン/ズーム**。できれば**「誤ってタップ/選択した位置」と「正解位置」の両方が画面内に収まる**よう移動（両者の bounding box にフィット）すると、誤り↔正解の対比で覚えやすい
  - **Mode D**（順引き地図タップ）: 正解＝市区町村の位置。`components/map/MunicipalityMap.tsx`。タップ座標と正解 codes の座標から表示領域を計算してパン。`QuizRunner` の `correctCodes`/`wrongCodes` と連動
  - **Mode A**（逆引き地図・都道府県タップ）: 正解＝対象都道府県（複数あり得る）。`components/map/JapanMap.tsx`。誤選択した都道府県と正解都道府県の両方が収まるようフィット。`QuizRunner` の `selectedPrefectures`/`correctPrefectures` と連動
  - 補足: 同名複数区（政令市）や複数県（Mode A の同名グルーピング）は正解が複数 → 全体を含む領域にフィット。Mode A は全国地図が既に全体表示なので、ズーム可能化が前提（不可ならハイライト強調のみで可）
  - 関連: [[B004]]、B006（ズームパン）、詳細仕様・設計: [specs/016-map-autofocus/spec.md](file:///Users/faru/geo-dojo/specs/016-map-autofocus/spec.md)

- [x] B012 都道府県名と同一の市区町村を出題から除外するフィルタ → **010-exclude-same-name (#22) で実装完了**
  - 「青森市（青森県）」や「秋田市（秋田県）」などの都道府県名と市区町村名が一致する自明な問題をテキストモード（Mode A/B/C）の出題プール・ダッシュボード集計から除外。Mode D（位置当て地図タップ）では引き続き出題。
  - 該当: `lib/quiz/municipality-data.ts`（`isSameNameMunicipality`, `filterSameName`, `filterTextModeMunicipalities`）、`app/(app)/dashboard/queries.ts`（`notSameNameSql`）、`__tests__/lib/quiz/same-name-exclusion.test.ts`

- [x] B014 いい感じのSE（効果音）の追加 → **014-sound-effects で実装完了**
  - 実装: Web Audio APIによる動的シンセ生成（音声アセットなし）で正解・不正解・完了・全問正解の4種を再生。市区町村クイズ全モード・復習セッション・都道府県クイズに統合。ミュートはlocalStorage永続化（デフォルト音あり）。音量スライダーや専用設定画面は対象外（将来判断）。

- [x] B015 都道府県・市区町村の読み仮名（ふりがな）対応 → **015-kana-support で実装完了**
  - 実装: 総務省「全国地方公共団体コード」を一次情報源とし、`scripts/fetch-municipality-kana.ts` で取得・決定的変換（半角カナ→全角カナ→ひらがな）、`municipality_master.kana` カラムへ `scripts/import-municipality-kana.ts` で反映（`sync-municipality-master.ts` は未変更、地雷回避）。都道府県47件は `PREFECTURE_KANA` 静的マップ。municipality_master 全1898件で読み仮名マッチ率100%（AI生成なし）。
  - 反映箇所: 回答直後の正解・不正解フィードバック（P1、モードA/Bは出題側の市区町村名＋答え側の都道府県名、モードC/Dは答え側の市区町村名、いずれも読み仮名を常時併記）、苦手ランキング・復習項目一覧・まだ苦手バッジ（P2）。
  - スコープ縮小（ユーザー判断）: 出題中（解答前）の問題文・選択肢への読み仮名併記（P3）は対象外。読み方を含めて記憶する必要があるため、解答前に読みを見せない方針。
  - **本番デプロイ時の注意**: マイグレーションが追加する `kana` カラムは nullable で、値は `scripts/import-municipality-kana.ts` を実行するまで全件 NULL のまま（migrate.yml には組み込まれていない）。本番反映時はマイグレーション適用後に `scripts/import-municipality-kana.ts` を本番DBに対して手動実行する必要がある（さもないと機能が「存在するが読み仮名が一切出ない」状態になる）。

- [x] B016 今日のおすすめクイズにおける地域選択（絞り込み）機能の改善 → **実装済み確認**
  - `components/recommend/recommend-override.tsx` で地方単位のポジティブ選択トグルUI（`targetRegions`）が実装済み。`localStorage`（`geodojo-recommend-region-filters`）に永続化
  - 都道府県単位の絞り込みは未対応（地方単位のみ）だが、当初の主眼だった「ポジティブ選択」は満たしている

- [x] B019 【UX改善】「今日のおすすめクイズ」完了画面での復習予定（明日の件数）表示と即時ループPlay導線 → **019-recommend-complete-loop で実装完了**
  - 実装: クイズ完了画面（市区町村クイズ全モードおよび復習クイズ）に `UpcomingReviewMini` コンポーネントを配置し、最新の「明日の復習予定件数」と今後7日間のミニスケジュールを表示。結果フェーズ遷移時に `queryClient.invalidateQueries` で最新状態を即時反映。おすすめ経由時は `RecommendReplayButton` を最優先アクションとして配置し、ダッシュボードに戻ることなく即時ループプレイが可能。
  - 該当: `lib/quiz/srs/schedule-helper.ts`（明日件数抽出）、`components/quiz/upcoming-review-mini.tsx`（ミニカード）、`app/(app)/quiz/municipality/[mode]/page.tsx`、`app/(app)/quiz/review/page.tsx`

- [x] B020 Mode D（順引き地図）での市区町村単位の出題選択・絞り込み → **026-mode-d-custom-pool (#79, #80) で実装完了**
  - 実装: Mode D 設定画面にスコープセレクター（全国 / 地方 / 都道府県 / 市区町村選択）を追加。`MunicipalityPickerDialog` による複数自治体のチェック選択、50音インデックス、かな検索に対応。選択状態は localStorage に永続化され、おすすめクイズセッション終了後も保持。
  - 該当: `components/quiz/scope-selector.tsx`, `components/quiz/municipality-picker-dialog.tsx`, `lib/quiz/municipality-scope.ts`, `app/(app)/quiz/municipality/[mode]/page.tsx`

- [x] B021 今日のおすすめクイズにおける難易度変更（オーバーライド）機能 → **025-recommend-difficulty-override で実装**
  - 概要: 「今日のおすすめクイズ」の調整ダイアログ（`RecommendOverride`）において、ユーザーが難易度（☆入門、☆☆中級、☆☆☆上級、☆☆☆☆達人）をトグル選択・変更してクイズを開始できるようにする。
  - 該当: `components/recommend/recommend-override.tsx`, `components/recommend/recommend-content.tsx`

- [x] B024 全国制覇のA/D分離とおすすめA/D抽選 → **024-conquest-mode-a (#74) で実装完了**
  - 実装: ダッシュボードトップの全国制覇ゲージを「県当て（A）」と「場所当て（D）」の2本に分離（B/C練習モードや合算%をトップから除外）。「今日のおすすめ」をA/D半々の抽選＋未制覇地方/難易度優先に刷新（A苦戦時のみB/C練習へフォールバック）。トップ画面をスリム化し、詳細分析は後続仕様（025）へ移行。
  - 該当: `lib/quiz/recommendation/conquest-lottery.ts`, `lib/quiz/recommendation/coverage-cells.ts`, `components/dashboard/dashboard-client.tsx`, `components/dashboard/completion-progress.tsx`

- [ ] B023 【学習分析/SRS】定着済み数（習熟数）の対象モード見直し（A/D限定化）と推移グラフ表示
  - 概要:
    1. **集計スコープの見直し**: 現在の「定着済み（graduated）」カウントは全モード（A/B/C/D）の合算になっているが、4択（B/C）を除外し、知識の定着度が高い本番モード「Mode A（県当て）」と「Mode D（場所当て）」のみに絞り込む（またはモード別表示に整理）。
    2. **定着済み数の推移グラフ**: 日々学習を進める中で定着済み自治体数がどのように積み上がっているかの累積推移（タイムシリーズ）を可視化する。
  - 動機:
    - 4択練習モード（B/C）は偶然当たる要素もあり、定着数として合算すると純粋な地理定着の達成感・実力把握にブレが出る。トップ画面の制覇表示も A/D がメイン。
    - 定着済み数が増えていく累積推移が見えることで、継続的な復習と長期定着へのモチベーションが大幅に高まる。
  - 検討事項:
    - 過去の推移データの復元・保持方法（`srs_records.last_reviewed_at` からの集計、または定着イベントログ/日次スナップショットの導入）
    - `025-detailed-analytics`（詳細分析画面 `/analytics`）の推移グラフ（正答率推移など）への統合、または復習カード（`ReviewCard`）での表示
    - 既存の `ReviewCard` の「定着済み」カウンターにおける Mode A/D の表示方法（AとDの合算 vs 分離表示）
