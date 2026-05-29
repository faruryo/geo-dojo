<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at specs/003-adaptive-quiz/plan.md

Backlog（将来の spec 候補）は specs/backlog.md に管理
<!-- SPECKIT END -->

# geo-dojo

日本の地理クイズ PWA。市区町村・都道府県の位置当てクイズと、苦手・適応型の出題推薦を提供する。詳細設計は `specs/<feature>/plan.md`（最新: `specs/003-adaptive-quiz/plan.md`）を参照。

## 技術スタック

- **Next.js 15.2.6**（App Router / React 19）+ TypeScript strict、Turbopack（`next dev --turbopack`）
- **Tailwind CSS v4** + shadcn/ui、lucide-react。ダークモード（`#111111`）デフォルト・モバイルファースト（375px 基準）
- **TanStack Query v5**（Read）/ **Server Actions**（Write）
- **Supabase**（PostgreSQL + Auth）。DB アクセスは **Drizzle ORM**（`postgres-js`, `prepare: false`）
- **PWA**: `@serwist/next`（dev では無効化、`next.config.ts` 参照）
- パッケージマネージャ **pnpm**（Node 25 / pnpm 10）

## ディレクトリ

- `app/` — App Router。`(app)/` 認証必須画面、`(auth)/` ログイン系、`auth/callback/` コールバック
- `lib/db/` — Drizzle スキーマ（`schema.ts`）と接続（`index.ts`、`DATABASE_URL`）
- `lib/supabase/` — Supabase クライアント（`client.ts` / `server.ts`）
- `lib/quiz/` — クイズ・推薦エンジン（純粋関数）
- `scripts/` — データ投入・検証スクリプト（下記）
- `public/` — `municipalities.json`（市区町村シード）、`japan-municipalities.topojson`（16MB 地図）
- `supabase/` — `config.toml` とマイグレーション（`migrations/`）

## コマンド

```bash
pnpm dev      # 開発サーバー（Turbopack、http://127.0.0.1:3000）
pnpm build    # 本番ビルド（serwist 有効）
pnpm start    # 本番サーバー
pnpm lint     # next lint（型チェック含む）
```

ソース（`.tsx`/`.ts`/`.css`）編集は Turbopack HMR が反映するので dev 再起動不要。再起動が要るのは config / env / 依存変更時のみ。

## 環境分離

| 環境 | データ層 | 設定 |
|------|---------|------|
| **Local** | Supabase ローカルスタック（Docker） | `.env.local`（localhost 向け） |
| **Preview / Production** | 共有の本番 Supabase プロジェクト | Vercel env スコープ |

- 本番接続情報は `.env.prod.local`（gitignore 済・Next.js 非読込）にバックアップ。本番に繋ぐ時は `cp .env.prod.local .env.local`。
- 外部 API キー（Google Maps / Gemini / e-Stat）は全環境共通の値を使用。Maps キーは本番デプロイ前に client/server 分離＋制限が必要（`specs/.../tasks.md` T079）。

### ローカルスタックの起動・ログイン

```bash
supabase start    # 起動（DB:54322 / API:54321 / Studio:54323 / Mailpit:54324）
supabase stop     # 停止（データは Docker ボリュームに永続）
supabase status   # URL/キー確認
```

- **ログイン**: メール確認は無効（`config.toml` の `enable_confirmations = false`）なので、`/signup` で任意のメール＋パスワード（6文字以上）を作れば即ログインできる。
  - 用意済みテストユーザー: `test@example.com` / `password123`
  - ユーザーは Studio（http://127.0.0.1:54323 → Authentication）でも管理可能。パスワードリセット等のメールは Mailpit（http://127.0.0.1:54324）に届く。
  - dev は `http://127.0.0.1:3000` で開くこと（`config.toml` の `site_url` と一致。`localhost` だとリダイレクト系がずれる場合あり）。

## DB / マイグレーション

- スキーマの正は `lib/db/schema.ts`（`municipality_master` / `municipality_quiz_results` の2テーブル）。
- マイグレーションは Drizzle 生成 → `supabase/migrations/` に置き、`supabase start` / `supabase db reset` が適用。

```bash
pnpm drizzle-kit generate   # schema.ts から SQL マイグレーション生成
pnpm drizzle-kit push       # ローカル DB に直接反映（プロトタイプ時）
supabase db reset           # マイグレーションをゼロから再適用（ローカルを作り直す）
```

- **RLS** は `municipality_master` の authenticated read のみ。drizzle schema 管理外のため、マイグレーション SQL に手動で同梱している（生成後に追記すること）。
- `drizzle-kit push` は削除を伴うとき TTY プロンプトを出す。非対話シェルで失敗する場合は対象テーブルを drop してから push するか、`generate` + `db reset` を使う。

### データ投入スクリプト（`scripts/`、`pnpm tsx scripts/<name>.ts`）

- `sync-municipality-master.ts` — `public/municipalities.json` を元に e-Stat 国勢調査2020から人口を取得し `municipality_master` を upsert（難易度を人口で算出）。
  - **⚠️ 地雷**: e-Stat の正式名（政令市の区名入り、例「大阪市西区」）を取得して DB と `municipalities.json` を in-place 上書きする。しかしクイズは政令市を親市名（「大阪市」）で扱い mode B 等で `(name, prefecture)` 重複排除する設計なので、このスクリプトを素で実行すると政令市の区が個別出題されて壊れる。人口の再取得だけしたい場合は、実行後に `git checkout public/municipalities.json` で名前を戻し、DB の `name` も市レベルへ戻すこと（東京23区=131xx は独立自治体なので「区」名のままが正しい）。
- `apply-municipality-master.ts` — `municipality_master` の DDL + RLS を作る one-off（マイグレーション化済み。通常は不要）。
- `verify-master.ts` / `cleanup-master.ts` — 投入後の分布確認 / GIS 残骸除去。
- `generate-municipalities.ts` — topojson から `public/municipalities.json` を生成。

新しいローカル環境を立ち上げたら: `supabase start` → `supabase db reset` →
`pnpm tsx scripts/sync-municipality-master.ts` で `municipality_master` を埋める。

## 注意点

- `public/japan-municipalities.topojson`（16MB）は serwist precache / Tailwind v4 スキャナ / Turbopack+serwist を詰まらせるため除外設定済み（`next.config.ts` / `sw.ts`）。安易に precache 対象へ戻さない。
- `municipality_master` は e-Stat 由来データなので、ローカルでは `sync` を実行しないと空（クイズが成立しない）。
