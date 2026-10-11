# municipality-master Specification

## Purpose
出題と集計の元になる市区町村マスタ（`municipality_master`）の中身と、その作り方・配り方を定める。行の単位（5桁コード）、人口から決める難易度、政令市・東京23区・同名自治体の扱い、クライアントへの配信とキャッシュ、データ投入スクリプトが守る条件を保証する。クイズの出題・判定は municipality-quiz、復習は srs-review、画面は dashboard / analytics を参照。

## Requirements

### Requirement: マスタの列と意味
システムは、`municipality_master` を 5 桁の全国地方公共団体コード（`code`、主キー）で 1 行 1 自治体として持たなければならない (SHALL)。各行は `name`、`prefecture`、`region`、`difficulty` を必ず持ち、`population`、`population_year`、`kana` は欠けてもよい (MAY)。

#### Scenario: 必須の列
- **WHEN** 行を作るとき
- **THEN** `code`、`name`、`prefecture`、`region`、`difficulty`、`updated_at` が埋まっている

#### Scenario: 地方区分
- **WHEN** `region` を見るとき
- **THEN** 値は 北海道、東北、関東、中部、近畿、中国、四国、九州 の 8 つのいずれかである

#### Scenario: 難易度の値
- **WHEN** `difficulty` を見るとき
- **THEN** 値は `easy`、`medium`、`hard`、`expert` のいずれかである

#### Scenario: 人口が欠けている
- **WHEN** 人口が取得できなかった自治体のとき
- **THEN** `population` と `population_year` は `NULL` で、`difficulty` は人口以外の規則で決まっている（「難易度の決定」を参照）

### Requirement: 政令市と東京23区の行の単位
システムは、政令指定都市を区ごとのコードで 1 行ずつ持ち、各行の `name` を区名ではなく親市名（例「札幌市」「大阪市」）にしなければならない (SHALL)。東京23区は独立した自治体として、区名（例「千代田区」）のまま持たなければならない (MUST)。

#### Scenario: 政令市の区
- **WHEN** 札幌市の 10 区のコード（01101〜01110）を見るとき
- **THEN** すべて `name = '札幌市'`、`prefecture = '北海道'` で、行は区の数だけある

#### Scenario: 区の名前の表示
- **WHEN** 政令市の区を区名で見せる必要があるとき（Mode D の位置当て）
- **THEN** `name` ではなく、コードから区名を引く静的データ（`lib/quiz/data/designated-city-ward-names.json`、読みは `designated-city-ward-kana.json`）を使う。それ以外のモードは `name` のまま表示する

#### Scenario: 東京23区
- **WHEN** 東京都の特別区（13101〜13123）を見るとき
- **THEN** `name` は「千代田区」のような区名で、親市名には畳まれない

#### Scenario: 同じ名前と都道府県が複数コードに現れる
- **WHEN** 政令市の区、または北海道の泊村（01403 と 01696）を見るとき
- **THEN** `(name, prefecture)` が同じ行が複数のコードに存在する。`code` だけが行の識別子である

#### Scenario: 所属未定地を含めない
- **WHEN** マスタを作るとき
- **THEN** 末尾が `000` のコード（例 13000）や名前に「所属未定地」を含む GIS 由来の残骸は行にならない

### Requirement: 難易度の決定
システムは、`difficulty` を行ごとに人口から決めなければならない (SHALL)。境界は 100,000 人以上が `easy`、30,000 人以上が `medium`、10,000 人以上が `hard`、それ未満が `expert` とする (MUST)。政令市の区は親市の人口ではなく、区自身の人口で決める。

#### Scenario: 人口がある
- **WHEN** 人口が 100,000 / 30,000 / 10,000 のちょうど境界のとき
- **THEN** それぞれ `easy` / `medium` / `hard` になる（境界値は上の区分に入る）

#### Scenario: 人口が無い
- **WHEN** 人口を取得できなかったとき
- **THEN** 名前の末尾で決める。「区」は `easy`、「市」は `medium`、「町」は `hard`、「村」は `expert`、どれでもなければ `medium`

#### Scenario: 境界を変えたとき
- **WHEN** 難易度の境界を変えたいとき
- **THEN** 難易度は同期スクリプトが DB に焼き込むので、スクリプトを再実行するまで既存の行は変わらない

### Requirement: 人口データの出典
システムは、人口を e-Stat の国勢調査 2020（`statsDataId=0003445139`）の総数（国籍総数・男女総数・年齢総数）から取らなければならない (SHALL)。人口が入った行は `population_year = 2020` とし、人口が無い行は `NULL` にしなければならない (MUST)。

#### Scenario: 人口が取れた
- **WHEN** 同期で人口を取得できたコードのとき
- **THEN** `population` に総人口、`population_year` に 2020 が入る

#### Scenario: 人口が取れなかった
- **WHEN** 取得結果にそのコードが無いとき
- **THEN** `population` と `population_year` は `NULL` になる。以前の値を残さない

### Requirement: マスタの同期（sync-municipality-master）
システムは、`scripts/sync-municipality-master.ts` で、`public/municipalities.json` を元に `municipality_master` をコード単位で upsert しなければならない (SHALL)。再実行しても結果は変わらず、1 回の実行は取得に失敗したら DB に何も書かずに終了しなければならない (MUST)。

#### Scenario: 更新される列
- **WHEN** 同期を実行したとき
- **THEN** 既存コードは `name`、`prefecture`、`region`、`population`、`population_year`、`difficulty`、`updated_at` が更新され、新しいコードは挿入される

#### Scenario: かなを上書きしない
- **WHEN** 同期を実行したとき
- **THEN** `kana` は upsert の更新対象に含まれず、既に入っている値は変わらない

#### Scenario: 取得に失敗した
- **WHEN** e-Stat の取得が途中で失敗したとき
- **THEN** スクリプトはエラーで終了し、DB への書き込みを始めていない

#### Scenario: 前提の環境変数
- **WHEN** `DATABASE_URL` または `E_STAT_APP_ID` が無いとき
- **THEN** スクリプトは実行を始めない

#### Scenario: 行を消さない
- **WHEN** 既に DB にあるコードが種データから消えていたとき
- **THEN** 同期はその行を削除しない。残骸の除去は `cleanup-master.ts` が別に行う

### Requirement: 政令市の名前を上書きしない同期（--keep-seed-names）
システムは、通常運用の同期を `--keep-seed-names` 付きで実行しなければならない (SHALL)。このフラグを付けずに実行すると、政令市の `name` が e-Stat の区名入りの名前（例「大阪市西区」）に書き換えられ、`public/municipalities.json` も上書きされて出題の単位が壊れるため、通常運用でフラグなしの実行をしてはならない (MUST NOT)。

#### Scenario: フラグあり
- **WHEN** `--keep-seed-names` を付けて実行したとき
- **THEN** `name` は種データのまま（政令市は親市名）で、人口と難易度だけが更新される。`municipalities.json` は書き換えられない

#### Scenario: フラグなし
- **WHEN** フラグ無しで実行したとき
- **THEN** 種データと DB の `name` が e-Stat の正式名に置き換わる。直すには `public/municipalities.json` を git で戻し、DB の `name` を市レベルへ戻す。ただし東京23区のコード（131xx）は区名のままが正しい

### Requirement: かなの投入（import-municipality-kana）
システムは、`municipality_master.kana` を `scripts/data/municipality-kana-seed.json`（コードからかなへの対応）から、`scripts/import-municipality-kana.ts` だけで投入しなければならない (SHALL)。このスクリプトは `kana` 以外の列を変更せず、行を挿入してはならない (MUST NOT)。

#### Scenario: 投入
- **WHEN** スクリプトを実行したとき
- **THEN** 種データの各コードについて `UPDATE municipality_master SET kana = ... WHERE code = ...` を行い、更新件数と、まだ `kana` が `NULL` の行数を出力する

#### Scenario: マスタに無いコード
- **WHEN** 種データにあってマスタに無いコードがあるとき
- **THEN** その分は更新されず、行も作られない

#### Scenario: 反映の漏れを隠さない
- **WHEN** 新しい DB や本番にかなが未投入のとき
- **THEN** `kana` は `NULL` のままで、アプリは静的データで自動補完しない。DB の値を正とし、投入し忘れは `NULL` の行数で気づく

### Requirement: 新しい DB の構築（db:bootstrap）
システムは、`pnpm db:bootstrap` で、スキーマ、マスタ、かなを一度に揃えなければならない (SHALL)。順序は `drizzle-kit migrate`、`sync-municipality-master.ts --keep-seed-names`、`import-municipality-kana.ts` とする (MUST)。接続先は `DATABASE_URL` で決まる。

#### Scenario: 順序
- **WHEN** `pnpm db:bootstrap` を実行したとき
- **THEN** migration が先に当たり、マスタの人口・難易度が入り、最後にかなが入る。どれかが失敗したら後続は実行されない

#### Scenario: マスタが空の環境
- **WHEN** 同期を実行していないローカル DB のとき
- **THEN** `municipality_master` は空で、クイズが成立しない

#### Scenario: migration が漏れていない
- **WHEN** `supabase/migrations/` に SQL を足したとき
- **THEN** `meta/_journal.json` にも載せる。載っていない migration は `drizzle-kit migrate` で当たらず、`__tests__/server/migration-journal.test.ts` が検出する

### Requirement: マスタの読み取り権限と配信
システムは、`municipality_master` を認証済みユーザーにだけ読ませなければならない (SHALL)。RLS は有効で、読み取り（`SELECT`）を `authenticated` ロールに許可するポリシー（`mm_read_authenticated`）だけを持ち、書き込みのポリシーは無い (MUST)。クライアントへの配信は Server Action の `getMunicipalityMaster()` が行う。

#### Scenario: 未認証
- **WHEN** 未認証のリクエストが `getMunicipalityMaster()` を呼んだとき
- **THEN** `Unauthorized` で失敗し、マスタは返らない

#### Scenario: 認証済み
- **WHEN** 認証済みユーザーが呼んだとき
- **THEN** 全行・全列（人口、難易度、かなを含む）を返す。ユーザーごとに内容は変わらない

#### Scenario: Data API からの書き込み
- **WHEN** 認証済みユーザーが Supabase Data API で `municipality_master` を書き換えようとしたとき
- **THEN** 書き込みのポリシーが無いので拒否される。更新は同期・投入スクリプト（特権接続）だけが行う

#### Scenario: 出題ページでの使い方
- **WHEN** 出題ページと復習ページがマスタを受け取ったとき
- **THEN** 各行を `code`、`name`、`prefecture`、`region`、`difficulty`、`kana`、`population` を持つ市区町村に写す。`kana` と `population` が `NULL` の行は値なし（`undefined`）として扱う

### Requirement: クライアントのキャッシュ
システムは、マスタをクライアントで TanStack Query のキー `['municipality', 'master']` に 1 時間（`staleTime` = 60 分）キャッシュしなければならない (SHALL)。マスタはバッチ再実行でしか変わらないため、ログイン状態の変化では破棄しない。

#### Scenario: DB 更新の反映
- **WHEN** DB のマスタ（かな、人口など）を更新した後に画面を開いたとき
- **THEN** キャッシュが残っているブラウザでは最長 1 時間は古い値が見える。確認するにはスーパーリロードをする

#### Scenario: 共通のキャッシュ
- **WHEN** 出題ページと復習ページが続けてマスタを使うとき
- **THEN** 同じキーのキャッシュを共有し、1 時間以内は再取得しない

### Requirement: サーバー側の検証データの出どころ
システムは、サーバー側でコードや名前の妥当性を確かめるとき、DB の `municipality_master` を情報源にしなければならない (SHALL)。実行時に `public/` の静的ファイルを `fs` で読んではならない (MUST NOT)。

#### Scenario: コードの妥当性
- **WHEN** クイズ結果の保存が、送られた自治体コードを検証するとき
- **THEN** `municipality_master` の全コードの集合（`getValidCodes()`）に含まれるかで判定する。この集合はプロセスごとに 1 回読み込み、以後は再利用する

#### Scenario: Vercel での実行時
- **WHEN** Vercel の serverless 関数が動くとき
- **THEN** `public/` の静的アセットは関数のバンドルに含まれないため、実行時の `fs` 読みは `ENOENT` になる。ローカルでは再現しない。`__tests__/server/no-public-runtime-read.test.ts` が `app/` と `lib/` の実行時読みを静的に検出する

#### Scenario: public の種データの位置づけ
- **WHEN** `public/municipalities.json` を使うとき
- **THEN** 同期スクリプトの入力として、およびビルド時の取り込みとしてだけ使う

### Requirement: 県名と同名の自治体の除外
システムは、名前から末尾の「市区町村」1 文字を除いたものが、都道府県名から末尾の「都道府県」1 文字を除いたものと等しい自治体（例 青森市と青森県、京都市と京都府）を「同名」と判定しなければならない (SHALL)。この判定は TypeScript（`isSameNameMunicipality`）と SQL（`notSameNameSql`）で同じ結果にならなければならない (MUST)。テキスト形式のモード（A/B/C）の出題と集計はこれらを除き、Mode D は除かない。

#### Scenario: 同名の判定
- **WHEN** 「青森市」「青森県」を判定するとき
- **THEN** どちらも「青森」になるので同名である。「札幌市」と「北海道」は同名ではない

#### Scenario: テキスト形式モードの出題プール
- **WHEN** Mode A/B/C の出題プールをマスタから作るとき
- **THEN** 同名の自治体を含めない。Mode D のプールには含める

#### Scenario: 過去の記録
- **WHEN** 同名の自治体の Mode A/B/C の既存の回答・SRS 記録があるとき
- **THEN** migration `0003_cleanup_same_name_history` がそれらを削除済みである

### Requirement: 東京23区の除外
システムは、東京23区（`prefecture = '東京都'` かつ `name` が「区」で終わる行）をテキスト形式のモード（A/B/C）の出題プールから除かなければならない (SHALL)。Mode A の母数と制覇判定を数える SQL（`notTokyoSpecialWardSql`）も同じ定義で除かなければならない (MUST)。Mode D のプールには残す。

#### Scenario: 判定
- **WHEN** 東京都の「港区」と、大阪府の区コードを持つ行を判定するとき
- **THEN** 東京都の港区だけが東京23区である。東京都の八王子市や瑞穂町は該当しない

#### Scenario: 出題プール
- **WHEN** Mode A/B/C のプールを作るとき
- **THEN** 東京23区が含まれない。同名の除外と合わせて `filterTextModeMunicipalities` が両方を除く

#### Scenario: Mode A の母数
- **WHEN** Mode A の制覇率の母数を数えるとき
- **THEN** 同名と東京23区を除いた、名前の異なる自治体の数になる

#### Scenario: Mode D
- **WHEN** Mode D のプールと母数を数えるとき
- **THEN** 東京23区と政令市の区をコード単位で含む

### Requirement: 同名で複数の県にある自治体
システムは、同じ名前の自治体が複数の都道府県にある場合（例 伊達市は北海道と福島県、川崎町は宮城県と福岡県）、マスタ上は県ごとに別のコードの行として持たなければならない (SHALL)。どの単位で 1 問にまとめるかは、マスタではなく出題の側が決める。

#### Scenario: マスタ上の姿
- **WHEN** 伊達市を引くとき
- **THEN** 北海道と福島県のそれぞれに、別のコードで行がある。人口・難易度・かなは行ごとに独立している

#### Scenario: 出題や集計での扱い
- **WHEN** Mode A が同名の自治体を 1 問にまとめ、保存は県ごとにするとき
- **THEN** その規則は municipality-quiz を参照する

#### Scenario: 人口の表示
- **WHEN** 解答時のフィードバックで人口を出すとき
- **THEN** 合算と併記の規則は municipality-quiz の「政令市の人口合算と多県同名市の併記」を参照する
