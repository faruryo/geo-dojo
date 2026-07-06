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

- [ ] B009 【バグ】復習の due 判定における時分秒の考慮漏れとダッシュボードの表示矛盾
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

- [ ] B010 いい感じのSE（効果音）の追加
  - 案: クイズの正解・不正解時やクイズ完了（全問正解など）の際に、ユーザー体験を高める効果音を再生する。
  - 考慮事項: 設定画面やクイズ画面での音量調節・ミュート機能。軽量な Web Audio API でのシンセサイズ音生成、またはライセンス的に安全な音声アセットの選定。

- [ ] B011 都道府県・市区町村の読み仮名（ふりがな）対応
  - 案: 難読な市区町村の学習効果を高めるため、出題時や結果画面、苦手リスト等で読み仮名（ひらがな）を表示できるようにする。特に、クイズ回答直後の正解・不正解フィードバック（結果表示）のタイミングで読み仮名を表示しておくと、その場で正しい読み方を確認できて学習効果が高い。
  - 対応: DBの `municipality_master` に `kana` カラムを追加し、`municipalities.json` に読み仮名データを同梱。`sync-municipality-master.ts` の同期ロジックも修正。


- [ ] B012 都道府県名と同一の市区町村を出題から除外するフィルタ
  - 案: 「青森市（青森県）」や「秋田市（秋田県）」などのように、都道府県名と市区町村名（接尾辞を除く）が一致するものは、答えが自明（簡単すぎる）なため、テキストベースのクイズ（Mode Aなど）で出題から除外できるようにする。
  - 考慮事項: 地図で位置を当てる問題（地図タップ系モードなど）は、名前が一致していても位置当て自体の難易度は下がらないため、除外対象外（出題してよい）とする。
  - 対応: 出題選択ロジック（`lib/quiz/` や `buildQuestions`）において、モードに応じて `municipality.name` と `municipality.prefecture` の共通部分（例：「青森」）が一致するものを除外するフィルタを追加（設定でオンオフできるとより良い）。

