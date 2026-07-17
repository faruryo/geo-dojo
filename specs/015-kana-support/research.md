# Research: 都道府県・市区町村の読み仮名表示

本ドキュメントでは、都道府県・市区町村の読み仮名データをどう調達・格納し、既存の出題/フィードバック/苦手リスト経路にどう伝播させるかの調査結果と決定事項をまとめる。

## 調査した課題

1. **読み仮名データの調達方法**
   - 既存の `municipality_master`（名称・人口・難易度）は e-Stat 国勢調査 API から取得しているが、読み仮名（かな読み）データは e-Stat のレスポンスに含まれない。
   - 都道府県は47件で読みに曖昧さがなく静的な定数で足りるが、市区町村は約1,700件あり、かつ本機能の動機そのものが「難読地名の学習」であるため、汎用的な形態素解析器（辞書ベースの漢字→かな変換）では誤読するリスクが高い。
2. **既存データ経路への統合方法**
   - `public/municipalities.json` は過去に Vercel サーバーレス環境で `fs` 読み込みが失敗した実例（`app/(app)/quiz/municipality/actions.ts` のコメント参照）から、**現在は実行時に一切読み込まれていない**。実行時のクライアント側データはすべて `municipality_master` テーブル → `getMunicipalityMaster()` Server Action 経由で配信されている。
   - 苦手リスト・復習項目一覧系のクエリ（`getDueReviewItems`, `getReviewItemList`）は `srs_records` 単独の SELECT で、`municipality_master` との JOIN を持たない（`municipalityName`/`prefecture` は書き込み時に非正規化されたコピーを使っている）。
3. **正解の示唆（ヒント漏洩）にならないか**
   - 出題中に読み仮名を併記する場合（P3）、地図タップ系（モードA/D）では問題文の地名自体が問い（例: モードAは「この名前の市区町村がどの都道府県か」）であり、読み仮名は名前の読み方に過ぎず正解（都道府県）を示唆しない。選択肢形式（モードB/C）でも全選択肢に等しく読み仮名を付けるだけなので、特定の選択肢を強調することにはならない。

---

## Technical Decisions

### Decision 1: 都道府県の読み仮名は静的定数で管理する

- **決定内容**: `lib/quiz/municipality-data.ts` に既存の `PREFECTURE_TO_REGION` と同様の形で `PREFECTURE_KANA: Record<string, string>`（47件）を追加する。DBテーブルは作らない。
- **理由**: 都道府県名は変動がなく、読みも標準的（曖昧さがない）ため、DB化・AI生成のコストをかける必要がない。既存の `PREFECTURE_TO_REGION` パターンを踏襲することで実装・レビューコストも最小になる。
- **代替案**: DBに `prefectures` テーブルを新設 → 却下（47件固定データのためオーバーエンジニアリング。既存に都道府県専用テーブルがない設計とも整合しない）。

### Decision 2: 市区町村・都道府県の読み仮名は総務省「全国地方公共団体コード」の公式データを一次情報源として調達する

- **決定内容**: 総務省が公開している「全国地方公共団体コード」（https://www.soumu.go.jp/denshijiti/code.html、Excel/CSV配布）を一次情報源とする。同データは `団体コード（6桁、都道府県コード+市区町村コード+検査数字）／都道府県名（漢字）／市区町村名（漢字）／都道府県名（カナ）／市区町村名（カナ）` の列を持ち、政令指定都市の区も個別の団体コードで収録されている。取り込みスクリプト（`scripts/import-municipality-kana.ts`）で以下を行う:
  1. 団体コードの先頭5桁を取り出し（末尾の検査数字を除去）、既存 `municipality_master.code`（JISコード5桁）と突合する。
  2. カタカナ表記をひらがなへ決定的に変換する（Unicodeコードポイントのシフト。慣用的な変換のため誤読リスクはゼロ）。
  3. 都道府県名・市区町村名それぞれの読みを、`code` をキーとしたシード JSON（`scripts/data/municipality-kana-seed.json`）として出力する。
  4. 全 `municipality_master.code` に対応する行が見つかるかを検証し、欠落があれば取り込み時にエラーとして報告する（想定: 欠落なし。総務省データは全団体を網羅）。
- **理由**: 本機能の価値は「読みが正しいこと」に尽きるため、幻覚のリスクがある LLM 生成より、公的機関が管理する一次情報源を使う方が精度・コストの両面で優れている。総務省データは既存 `code`（JISコード）と同一の体系（団体コードの先頭5桁）でキー変換でき、政令指定都市の区も個別収録されているため、既存のコード単位データ構造をそのまま踏襲できる。カタカナ→ひらがな変換は決定的処理であり誤りが発生しない。
- **フォールバック**: 万一総務省データに存在しない `code`（廃止/新設市区町村の切替期など）があった場合のみ、該当分に限り生成AI（Gemini）による読み推定 + 人手確認を補助的に使う。全件をAI生成に頼る当初案は誤読リスクが高く採用しない。
- **検証済み（実データ確認）**: `https://www.soumu.go.jp/main_content/000925835.xlsx`（令和6年1月1日更新版）を実際にダウンロードし中身を確認済み。カナ表記は**半角カタカナ**（例: `ｸﾗﾖｼｼ`）で格納されている。変換パイプラインは「半角カタカナ→全角カタカナ→ひらがな」の順で正規化する必要がある（半角カナのまま Unicode コードポイントシフトすると不正な変換になるため注意）。
- **代替案**:
  - 汎用かな変換ライブラリ（kuroshiro, MeCab 系）の導入 → 却下（辞書に無い難読地名を誤読しやすく、本機能の目的と相性が悪い）。
  - 全件 Gemini AI 生成 + 人手スポットチェック → 却下（誤読リスクが本機能の価値を損なう。抽出的なスポットチェックでは全件の正確性を担保できない。無料の公的データが同一キー体系で入手できるため不要）。

### Decision 3: 読み仮名は `municipality_master` に列追加、配信は既存の `getMunicipalityMaster()` を無変更で流用

- **決定内容**: `municipality_master` に `kana text`（nullable）カラムを `schema.ts` へ追加し、`pnpm drizzle-kit generate` でマイグレーション SQL と `supabase/migrations/meta/` のスナップショットを生成する（手書きしない）。既存の `0002`/`0003` は RLS/DML の手書きマイグレーションだが、カラム追加はスキーマ変更であるため drizzle-kit の生成物と `meta/` のスナップショットを一致させないと CI の migrate チェックで drift 検出に引っかかる。`getMunicipalityMaster()` は `db.select().from(municipalityMaster)`（全列SELECT）のため、コード変更なしで `kana` を返すようになる。クライアント側の `Municipality` インターフェースに `kana?: string` を追加し、各ページで `masterData` → `Municipality` 変換時に伝播させる。
- **理由**: 既存の配信経路（DB → Server Action → TanStack Query → 各コンポーネント）をそのまま使えるため、新規エンドポイントや契約変更が不要。nullable にすることで、シード適用前や一部データ欠落時にも FR-005（省略時のグレースフルデグレード）を自然に満たせる。
- **代替案**: `public/municipalities.json` をクライアントで直接 fetch し直す方式 → 却下（過去に Vercel サーバーレスで ENOENT を起こした経緯があり、DB経由への統一が既に確立している設計方針に反する）。

### Decision 3b: `kana` の DB反映は既存の `sync-municipality-master.ts` を拡張せず、独立スクリプトで行う

- **決定内容**: `scripts/import-municipality-kana.ts` を新設し、シード JSON を読み込んで `municipality_master.kana` のみを `code` 単位で `UPDATE` する。既存の `sync-municipality-master.ts`（e-Stat 名称・人口・difficulty の同期）は変更しない。
- **理由**: プロジェクトの既知の地雷（[[project_sync_ward_name_trap]]）として、`sync-municipality-master.ts` の実行は政令指定都市の区名を上書きしモードBを壊す副作用があり、実行後に json revert + DB名復元が必要になる。読み仮名の反映だけのためにこのスクリプトを都度実行・拡張すると、不要にこの地雷を踏むリスクが生まれる。責務を分離した独立スクリプトにすることで、この副作用を回避する。
- **代替案**: `sync-municipality-master.ts` に kana UPDATE 処理を追記 → 却下（上記の理由）。

### Decision 4: 苦手リスト・復習項目一覧系クエリは `municipality_master` との JOIN を新設する

- **決定内容**: `getWeaknessRankingData`（既存 JOIN あり）は SELECT 列に `municipalityMaster.kana` を追加するだけ。`getDueReviewItems`（`app/(app)/quiz/review/actions.ts`）と `getReviewItemList`（`app/(app)/dashboard/actions.ts`）は `srs_records` 単独クエリに `municipality_master` との `innerJoin`（`municipalityCode` = `code`）を追加し、SELECT 列に `kana` を加える。
- **理由**: `srs_records.municipalityCode` は常に `municipality_master.code` を参照する設計（既存の `municipalityName`/`prefecture` の非正規化コピーもこの前提に基づく）のため、`innerJoin` で安全に取得できる。既存の `getWeaknessRankingData` と同じ JOIN パターンを踏襲することで実装・レビューコストを抑える。
- **代替案**: `srs_records` 自体に `kana` を非正規化コピー → 却下（読み仮名は市区町村の不変属性であり、既存の `municipalityName`/`prefecture` の非正規化とは異なりレコード作成時点でのスナップショットである必要がない。JOINで十分かつシンプル）。

### Decision 5: 出題中の読み仮名表示（P3）はヒント漏洩防止の原則を明文化する

- **決定内容**: 選択肢・問題文への読み仮名併記は、「特定の選択肢のみ」ではなく「表示される全ての地名に等しく」適用する実装ルールとする（FR-007）。
- **理由**: 一部の選択肢だけに読み仮名を出すと、読めない選択肢が正解でないことを消去法的に示唆してしまう恐れがあるため。
