# 実装計画書: 都道府県・市区町村の読み仮名表示

**ブランチ**: `015-kana-support` | **日付**: 2026-07-17 | **仕様書**: [spec.md](./spec.md)

---

## 概要

47都道府県・市区町村マスタ全件に読み仮名（ひらがな）を追加し、クイズ回答直後のフィードバック（P1）、苦手リスト・復習項目一覧（P2）、出題中の問題文・選択肢（P3）に併記します。

### 技術的アプローチ:
- **都道府県・市区町村とも**: 読み仮名は総務省が公開する公式データ「全国地方公共団体コード」（団体コード／都道府県名・市区町村名の漢字・カナ）を一次情報源として取り込みます。団体コード（6桁）の先頭5桁が既存 `municipality_master.code`（JISコード5桁）と一致し、政令指定都市の区も個別収録されているため、既存のコード単位データ構造をそのまま踏襲できます。カタカナ→ひらがなは決定的変換（誤読リスクなし）。AI生成は、万一この公式データに欠落するコードがあった場合の補助手段に留め、全件をAI生成に頼ることはしません。
- **都道府県**: 上記データから取り込んだ読みを `lib/quiz/municipality-data.ts` の静的 `PREFECTURE_KANA` マップ（47件）として保持します（DBテーブルは持たない）。
- **市区町村**: `municipality_master` テーブルに `kana` カラム（nullable text）を追加します。マイグレーションは手書きせず `pnpm drizzle-kit generate` で生成し、`supabase/migrations/meta/` のスナップショットを `schema.ts` と一致させます（CIのmigrate driftチェック対策）。取り込んだ読み仮名はチェックイン済みのシード JSON（`scripts/data/municipality-kana-seed.json`）として保存し、既知の地雷である `sync-municipality-master.ts`（実行すると政令市名がward名で上書きされモードBが壊れる副作用がある）を拡張せず、独立した `scripts/import-municipality-kana.ts` から DB へ反映します。
- **配信経路**: `getMunicipalityMaster()`（Server Action）は `municipality_master` を `SELECT *` しているため、カラム追加のみで自動的に `kana` を返すようになります。これをクライアント側の `Municipality` インターフェースに `kana?: string` として伝播させ、出題・フィードバック・苦手リストの各コンポーネントで表示します。
- **苦手リスト系クエリ**: `getWeaknessRankingData`（既存 `municipalityMaster` との JOIN あり）は SELECT 列に `kana` を追加するだけで済みます。`getDueReviewItems` と `getReviewItemList` は現状 `srsRecords` 単独の SELECT のため、`municipalityMaster` との JOIN を新設して `kana` を取得します。

---

## 技術的文脈

**言語/バージョン**: TypeScript (strict)、Next.js 15.2.6+（App Router / React 19）
**主要な依存関係**: Drizzle ORM、TanStack Query、`@google/generative-ai`（Gemini、シード生成スクリプト内でのみ使用）
**ストレージ**: Supabase Postgres（`municipality_master.kana` カラム追加）。チェックイン済み静的シード JSON（`scripts/data/`）
**テスト**: Vitest (`pnpm test`)。`Municipality`/`MunicipalityMaster` への `kana` 伝播、および `getWeaknessRankingData`/`getDueReviewItems`/`getReviewItemList` の DB 統合テスト（既存の `DATABASE_URL` 切り替えパターンに準拠）を追加
**対象プラットフォーム**: PWA（モバイルファースト 375px 基準、ダークモード `#111111`）
**プロジェクトタイプ**: Web アプリケーション
**パフォーマンス目標**: 追加の JOIN・カラムは軽量な text 型のみで、既存クエリのレイテンシに有意な影響を与えない
**制約事項**: 既存の出題・解答・採点・SM-2復習スケジューリングのロジック・シグネチャは変更しない（表示のみの追加）。読み仮名データが欠落する行があっても既存表示を壊さない（FR-005）

---

## 憲法チェック (憲法原則の確認)

| 原則 | 評価 | 判定 |
|------|------|------|
| I. セキュリティ & コンプライアンス | 新規 API キーの露出なし。取り込みスクリプトは開発者がローカルで一度だけ実行するオフラインツール（総務省の公開データを取り込むのみ）。 | ✅ 合格 (Pass) |
| II. アーキテクチャ & パフォーマンス | DB 書き込みは既存の Server Action 経由の読み取り専用拡張（新規 Server Action 追加なし）。マイグレーションは `municipality_master` への nullable カラム追加のみで、既存インデックス（`srs_records` の `(user_id, due_date)` 等）に影響しない。 | ✅ 合格 (Pass) |
| III. ロジック & UI | 読み仮名は既存の名称表示に対する小さな補助テキストとして追加し、375px幅レイアウトを崩さない。地図タップ対象自体の変更は行わない。 | ✅ 合格 (Pass) |
| IV. コーディング規約 | TypeScript strict を順守。データ伝播ロジックは既存の `Municipality`/`MunicipalityMaster` 型を拡張し、クエリ変更は Vitest の DB 統合テストで検証。 | ✅ 合格 (Pass) |

---

## プロジェクト構成

### ドキュメント（本機能）

```text
specs/015-kana-support/
├── plan.md              # このファイル
├── research.md          # 調査結果
├── data-model.md        # データモデル定義
├── quickstart.md        # クイックスタートガイド
├── contracts/
│   └── kana-data.md     # kana フィールドのデータ契約（DB/型/クエリ）
├── checklists/
│   └── requirements.md  # 仕様品質チェックリスト
└── tasks.md             # タスクリスト（/speckit-tasks で生成）
```

### ソースコード（リポジトリルート）

```text
supabase/migrations/
└── (pnpm drizzle-kit generate で自動生成)   # [新規] municipality_master.kana (nullable text) 追加。meta/ スナップショットも同時生成

lib/db/
└── schema.ts                        # [変更] municipalityMaster に kana: text('kana') を追加

scripts/data/
└── municipality-kana-seed.json      # [新規] 総務省「全国地方公共団体コード」から取り込んだ都道府県47件+市区町村全件の読み仮名シード（code → kana）

scripts/
├── fetch-municipality-kana.ts       # [新規] 総務省の公式データ（団体コード／カナ）を取り込み、先頭5桁をJISコードに正規化・カタカナ→ひらがな変換して seed JSON を出力する一回限りのツール
└── import-municipality-kana.ts      # [新規] seed JSON を読み込み municipality_master.kana のみを UPDATE する独立スクリプト（sync-municipality-master.ts は拡張しない）

lib/quiz/
└── municipality-data.ts             # [変更] PREFECTURE_KANA（47件の静的マップ）追加、Municipality interface に kana?: string 追加

app/(app)/quiz/municipality/[mode]/
└── page.tsx                         # [変更] masterData → Municipality 変換時に kana を伝播、問題文・選択肢表示に反映（P3）

app/(app)/quiz/review/
├── page.tsx                         # [変更] masterData → Municipality 変換時に kana を伝播、「まだ苦手な市区町村」バッジに反映（P2）
└── actions.ts                       # [変更] getDueReviewItems が municipality_master と JOIN し kana を取得・返却

app/(app)/quiz/review/items/
└── page.tsx                         # [変更] 復習項目一覧の各行に kana を表示（P2）

app/(app)/dashboard/
├── actions.ts                       # [変更] getReviewItemList が municipality_master と JOIN（または既存 Map 経由）し kana を返却
└── queries.ts                       # [変更] getWeaknessRankingData の SELECT に municipalityMaster.kana を追加

components/
├── quiz/quiz-runner.tsx             # [変更] 正解・不正解フィードバック表示に kana を併記（P1）。選択肢形式モードの問題文・選択肢にも併記（P3）
└── dashboard/weakness-ranking.tsx   # [変更] 苦手ランキングの各項目に kana を併記（P2）

__tests__/
├── lib/quiz/municipality-data.test.ts   # [変更/新規] PREFECTURE_KANA・Municipality.kana 伝播のテスト
└── lib/dashboard/queries-parity.test.ts # [変更] getWeaknessRankingData/getDueReviewItems/getReviewItemList の kana 列 DB 統合テスト追加
```

**構成に関する決定**: 既存の Next.js 単一プロジェクトの構造（LIFT原則）を踏襲します。新規テーブルは作らず既存 `municipality_master` にカラムを1つ追加するのみとし、表示は既存コンポーネントの拡張で完結させます。
