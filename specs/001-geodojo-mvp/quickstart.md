# Quickstart: GeoDojo MVP（Phase 1）

**Generated**: 2026-05-06
**対象**: 開発環境のゼロからのセットアップ

## 前提条件

- Node.js 24 LTS（`node --version` で確認）
- pnpm（`npm i -g pnpm` でインストール）
- Supabase アカウント（無料プランで可）
- Google Cloud アカウント（Maps API + Gemini API キー）

---

## 1. リポジトリのセットアップ

```bash
# Next.js 15 プロジェクト作成（既存プロジェクトならスキップ）
pnpm create next-app@latest geo-dojo \
  --typescript \
  --tailwind \
  --app \
  --src-dir false \
  --import-alias "@/*"

cd geo-dojo
```

## 2. 依存関係のインストール

```bash
# コア依存関係
pnpm add \
  @supabase/supabase-js \
  drizzle-orm \
  postgres \
  @tanstack/react-query \
  @vnedyalk0v/react19-simple-maps \
  topojson-client \
  @google/generative-ai \
  @serwist/next \
  serwist

# shadcn/ui 初期化
pnpm dlx shadcn@latest init
# ダークモードをデフォルトに設定、色テーマは slate 推奨

# shadcn コンポーネント（最低限）
pnpm dlx shadcn@latest add button card badge skeleton toast

# 開発依存
pnpm add -D \
  drizzle-kit \
  @types/topojson-client \
  vitest \
  @vitejs/plugin-react
```

## 3. Supabase プロジェクト作成

1. [supabase.com/dashboard](https://supabase.com/dashboard) で新規プロジェクト作成
2. `Project Settings > Database` から Connection string を取得
   - **Transaction pooler** URL（ポート 6543）を `DATABASE_URL` に使用
3. `Project Settings > API` から以下を取得：
   - `URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` → `SUPABASE_SERVICE_ROLE_KEY`
4. Supabase Storage にバケット `card-images` を作成（Public 設定）

## 4. 環境変数の設定

```bash
cp .env.example .env.local
```

`.env.local`:
```env
# Supabase
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
NEXT_PUBLIC_SUPABASE_URL=https://[ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Google APIs（サーバー側のみ — NEXT_PUBLIC_ を付けないこと）
GOOGLE_MAPS_API_KEY=AIza...
GEMINI_API_KEY=AIza...
```

⚠️ `GOOGLE_MAPS_API_KEY` と `GEMINI_API_KEY` は絶対に `NEXT_PUBLIC_` を付けないこと（憲法 I 条）。

## 5. データベースのセットアップ

```bash
# スキーマ生成（drizzle-kit）
pnpm drizzle-kit generate

# マイグレーション適用（開発時は push でも可）
pnpm drizzle-kit push

# Supabase Dashboard で RLS ポリシーを適用
# → data-model.md の「Supabase RLS ポリシー」セクションを参照
```

## 6. TopoJSON 地図データの準備

```bash
# 国土地理院データをダウンロード（または既存の GeoJSON を使用）
# https://github.com/dataofjapan/land

# mapshaper で最適化変換
npx mapshaper japan-prefectures.geojson \
  -simplify 0.1 \
  -o format=topojson public/japan.topojson

# ファイルサイズ確認（目標: 200KB 以下）
ls -lh public/japan.topojson
```

## 7. PWA 設定（@serwist/next）

```typescript
// next.config.ts
import type { NextConfig } from 'next';
import { withSerwist } from '@serwist/next';

const nextConfig: NextConfig = {
  // ... 設定
};

export default withSerwist({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
})(nextConfig);
```

```typescript
// app/sw.ts
import { defaultCache } from '@serwist/next/worker';
import { installSerwist } from '@serwist/sw';

declare const self: ServiceWorkerGlobalScope;

installSerwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: [
    {
      matcher: ({ url }) => url.pathname.endsWith('japan.topojson'),
      handler: 'CacheFirst',
      options: { cacheName: 'map-data', expiration: { maxAgeSeconds: 2592000 } },
    },
    ...defaultCache,
  ],
});
```

## 8. 開発サーバー起動

```bash
pnpm dev
```

ブラウザで `http://localhost:3000` を開き、以下を確認：
- [ ] ログイン画面が表示される
- [ ] 認証後 `/study` にリダイレクトされる
- [ ] 「カードが0件」の状態が正しく表示される

## 9. 最初の機能動作確認（US3 → US1 の順）

```bash
# 1. カード作成（US3）を先にテスト
# /cards/new でスクリーンショットをアップロード → タグを付けて保存

# 2. 学習セッション（US1）
# /study で保存したカードが表示されることを確認
# 評価ボタン（1/3/5）を押して次回出題日が設定されることを確認

# 3. 地図クイズ（US2）
# /quiz で日本地図が表示されることを確認
# 都道府県をタップして正誤フィードバックを確認

# 4. AI生成（US4）
# /cards/new で画像をアップロード後、「AIに提案させる」ボタンをクリック
# /ai-review で候補が表示されることを確認
```

## トラブルシューティング

| 問題 | 原因 | 対処 |
|------|------|------|
| `prepare: false` エラー | Supabase Pooler は prepared statement 非対応 | `postgres(url, { prepare: false })` を設定 |
| TopoJSON が表示されない | Public ファイルパスが間違い | `public/japan.topojson` に配置し `/japan.topojson` でアクセス |
| 画像プロキシが 401 | Supabase JWT が渡されていない | fetch に `Authorization: Bearer` ヘッダーを追加 |
| Serwist ビルドエラー | `swSrc` ファイルが見つからない | `app/sw.ts` が存在することを確認 |
