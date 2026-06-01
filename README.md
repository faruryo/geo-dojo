# GeoDojo

記憶科学（間隔反復 SRS・アクティブリコール）に基づく日本地理クイズ学習アプリ。

技術スタック: Next.js 15 (App Router, React 19) / Drizzle ORM / Supabase (PostgreSQL) / TanStack Query / Tailwind v4 + shadcn/ui / PWA。
詳細は [`.specify/memory/constitution.md`](./.specify/memory/constitution.md) と各 `specs/*/plan.md` を参照。

---

## ローカル開発環境

ローカルでは **Supabase をローカルスタック（Docker）で動かす**。本番/preview のクラウド DB とは別データ。

> クラウド版（`pooler.supabase.com`）でゼロから構築する手順は [`specs/001-geodojo-mvp/quickstart.md`](./specs/001-geodojo-mvp/quickstart.md) を参照。

### 前提

- Node.js 24 LTS / pnpm
- Docker Desktop（Supabase ローカルスタックに必須）
- Supabase CLI

### 起動手順

```bash
# 1. 依存インストール
pnpm install

# 2. Docker Desktop を起動してから、ローカル Supabase スタックを起動
supabase start
#   → 起動後に表示される API URL / anon key / DB URL を控える
#   → 既に起動済みの値は `supabase status` で再表示できる

# 3. DB マイグレーション適用（schema.ts → ローカル DB）
pnpm drizzle-kit push

# 4. 開発サーバ起動
pnpm dev          # http://localhost:3000
```

### ローカルの各サービス（`supabase/config.toml` 既定）

| サービス | URL / ポート | 用途 |
|----------|-------------|------|
| アプリ | http://localhost:3000 | Next.js dev |
| Supabase API | http://127.0.0.1:54321 | 認証・PostgREST |
| PostgreSQL | `127.0.0.1:54322` | `DATABASE_URL`（`.env.local`）の接続先 |
| Supabase Studio | http://127.0.0.1:54323 | DB を GUI で閲覧（テーブル/RLS 確認） |
| Inbucket（メール） | http://127.0.0.1:54324 | ローカル送信メールの確認 |

### ログイン

固定のテストアカウントは無い。ローカルは `enable_signup = true` かつ **`enable_confirmations = false`**（`supabase/config.toml [auth.email]`）なので、**メール確認なしで、任意のメール/パスワードでサインアップ→即ログインできる**（メール/パスワードは何でもよい）。

- 手順: http://localhost:3000/signup で適当なメール（例 `a@a.com`）＋パスワードを登録 → 即ログイン
- **`supabase start` / `supabase db reset` でローカル DB はまっさらになる**ため、リセット後はまた適当に登録し直す

> クラウド（本番/preview）の認証はメール確認が有効な場合があるため、この挙動はローカル限定。

### 環境変数

`.env.local` をローカル用に設定（クラウドとは別）。`supabase start` / `supabase status` が出力する値を使う。

```env
# ローカル Supabase
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase status の anon key>
# Google APIs（サーバー専用 — NEXT_PUBLIC_ を付けない / 憲法 I）
GOOGLE_MAPS_API_KEY=...
GEMINI_API_KEY=...
```

⚠️ `.env.prod.local` には本番値のバックアップがある。`supabase db reset` はローカルデータを破棄するので注意。

---

## よく使うコマンド

| コマンド | 用途 |
|---------|------|
| `pnpm dev` | 開発サーバ（Turbopack） |
| `pnpm build` | プロダクションビルド |
| `pnpm lint` | Lint / 型チェック |
| `pnpm test` | 単体テスト（Vitest） |
| `pnpm drizzle-kit generate` | スキーマからマイグレーション生成 |
| `pnpm drizzle-kit push` | マイグレーションをローカル DB へ適用 |

> 本番マイグレーションは GitHub Actions（`migrate.yml`）で自動適用、デプロイは Vercel GitHub 連携。
