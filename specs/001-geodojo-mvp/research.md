# Research: GeoDojo MVP（Phase 1）

**Generated**: 2026-05-06
**Feature**: GeoDojo MVP — SRS学習, 地図クイズ, カード作成, AI生成レビュー

## R-001: SM-2 簡略化アルゴリズム（3段階評価）

**Decision**: 標準SM-2を1/3/5の3段階評価に簡略化した独自実装を採用する。

**Rationale**:
- 標準SM-2は6段階評価（0〜5）で複雑な easiness factor 更新式を持つが、
  GeoDojoはカジュアルユーザー向けなので「全然・うろ覚え・完璧」の3択に簡略化する。
- easiness factor（EF）を維持しつつ、interval は以下のルールで決定：
  - rating=1（全然）: interval = 1 日、EF 変更なし（再学習扱い）
  - rating=3（うろ覚え）: interval = max(interval * 1.2, 3) 日
  - rating=5（完璧）: interval = interval * EF 日（初回は2.5日）
- reps=0（初回）の場合は interval=1（rating1）/ 3（rating3）/ 5（rating5）で固定。

**Alternatives considered**:
- Anki の SuperMemo 2+（より精緻だが実装複雑、ユーザーへの説明が難しい）
- 固定間隔（1/3/7日）— シンプルすぎて長期記憶効果が薄い

**Algorithm pseudocode**:
```
function calculateNextReview(record: SrsRecord, rating: 1 | 3 | 5): SrsUpdate {
  const { interval, easiness, reps } = record;
  
  if (reps === 0) {
    return { interval: [1, 3, 5][rating/2 - 0.5], easiness, reps: 1 };
  }
  
  if (rating === 1) {
    return { interval: 1, easiness, reps: 0 }; // reset
  }
  
  const factor = rating === 3 ? 1.2 : easiness;
  const newInterval = Math.max(Math.round(interval * factor), rating === 3 ? 3 : 5);
  return { interval: newInterval, easiness, reps: reps + 1 };
}
```

---

## R-002: @vnedyalk0v/react19-simple-maps の使用方法

**Decision**: Client Component として実装し、TopoJSON は useEffect で非同期フェッチする。

**Rationale**:
- @vnedyalk0v/react19-simple-maps は React 19 / Next.js 15 対応のフォーク。
- SVG ベースの地図レンダリングで bundle に地図データを含めないことが重要。
- `'use client'` ディレクティブが必要（ブラウザ DOM 操作のため）。
- TopoJSON は `public/japan.topojson` に配置し、React Suspense + fetch で非同期ロード。

**Key implementation pattern**:
```tsx
'use client';
import { ComposableMap, Geographies, Geography } from '@vnedyalk0v/react19-simple-maps';

const GEO_URL = '/japan.topojson';

export function JapanMap({ onPrefectureClick }: { onPrefectureClick: (name: string) => void }) {
  return (
    <ComposableMap projection="geoMercator" projectionConfig={{ center: [136, 37], scale: 1500 }}>
      <Geographies geography={GEO_URL}>
        {({ geographies }) =>
          geographies.map((geo) => (
            <Geography
              key={geo.rsmKey}
              geography={geo}
              onClick={() => onPrefectureClick(geo.properties.name)}
              style={{ default: { fill: '#2a2a2a' }, hover: { fill: '#4a7c59' }, pressed: { fill: '#2d5a3d' } }}
            />
          ))
        }
      </Geographies>
    </ComposableMap>
  );
}
```

**TopoJSON 変換手順**:
```bash
# 国土地理院 GeoJSON → TopoJSON 変換（mapshaper使用）
npx mapshaper japan-prefectures.geojson \
  -simplify 0.1 \
  -proj mercator \
  -o format=topojson japan.topojson
```

**Alternatives considered**:
- react-simple-maps（React 18以前、React 19 非対応のため除外）
- Leaflet / Mapbox GL（重量級すぎる、TopoJSON非対応）

---

## R-003: @serwist/next の部分オフライン設定

**Decision**: 地図データ（TopoJSON）のみをキャッシュ、APIルートはキャッシュしない。

**Rationale**:
- @ducanh2912/next-pwa は Next.js 15 / Turbopack 非対応のため使用禁止（憲法 II 条）。
- @serwist/next は @ducanh2912/next-pwa から派生した Workbox フォーク。
- 地図 TopoJSON は静的ファイルなので長期キャッシュが適切。
- SRS 記録・カードデータはリアルタイム性が必要なのでキャッシュしない。

**Key configuration**:
```ts
// next.config.ts
import { withSerwist } from '@serwist/next';

const withSerwistConfig = withSerwist({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
});

export default withSerwistConfig({ ... });
```

```ts
// app/sw.ts
import { defaultCache } from '@serwist/next/worker';
import { installSerwist } from '@serwist/sw';

installSerwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: [
    {
      matcher: /^https?:\/\/.+\/japan\.topojson$/,
      handler: 'CacheFirst',
      options: { cacheName: 'map-data', expiration: { maxAgeSeconds: 60 * 60 * 24 * 30 } },
    },
    ...defaultCache,
  ],
});
```

**Alternatives considered**:
- next-pwa（Workbox直接ラップ、React 19 問題あり）
- カスタム Service Worker（工数大）

---

## R-004: TanStack Query v5 + Next.js 15 App Router

**Decision**: Client Boundary に QueryClientProvider を配置し、Server Component からのデータを初期データとして渡す。

**Rationale**:
- TanStack Query v5 は `useQuery` / `useSuspenseQuery` の引数形式が v4 と異なる（オブジェクト必須）。
- App Router では `"use client"` コンポーネントツリー内でのみ使用可能。
- Server Component でデータを取得し `initialData` として渡すことで、ハイドレーションの整合性を保つ。

**Provider setup**:
```tsx
// app/providers.tsx
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 60 * 1000 } },
  }));
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

**Hook pattern**:
```ts
// lib/hooks/useDueCards.ts
'use client';
import { useQuery } from '@tanstack/react-query';

export function useDueCards() {
  return useQuery({
    queryKey: ['cards', 'due'],
    queryFn: () => fetch('/api/cards/due').then(r => r.json()),
  });
}
```

---

## R-005: Gemini 2.5 Flash — 画像解析

**Decision**: @google/generative-ai SDK を使用し、Server Action または API Route でのみ呼び出す（クライアント側露出禁止）。

**Rationale**:
- 憲法 I 条：AIモデルは Gemini 2.5 Flash を使用する（モデルID: `gemini-2.5-flash`）。
- 画像解析はユーザーアップロード画像（Supabase Storage URL）またはプロキシ経由の Street View 画像を使用。
- `inlineData`（base64）か `fileUri`（GCS URL）でプロンプトに渡す。
- 非同期処理にする（生成に数秒かかるため、即時レスポンスは POST → status: "processing" で返す）。

**Key implementation pattern**:
```ts
// lib/ai/gemini.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

export async function generateCardFromImage(imageUrl: string) {
  const imageResponse = await fetch(imageUrl);
  const imageBuffer = await imageResponse.arrayBuffer();
  const base64 = Buffer.from(imageBuffer).toString('base64');
  const mimeType = imageResponse.headers.get('content-type') ?? 'image/jpeg';

  const result = await model.generateContent([
    { inlineData: { data: base64, mimeType } },
    `この画像はGeoGuessrの日本のシーンです。
     以下の点を特定して、学習カード用のメモを日本語で作成してください：
     - 都道府県・地方（判定できる場合）
     - 目立つ視覚的特徴（看板の文字・電柱・道路標識・建物の特徴など）
     - 学習に役立つタグを3〜5個提案してください
     
     JSON形式で回答: { "notes": "...", "suggestedTags": ["tag1", "tag2", ...] }`,
  ]);

  return JSON.parse(result.response.text()) as { notes: string; suggestedTags: string[] };
}
```

---

## R-006: Drizzle ORM + Supabase PostgreSQL

**Decision**: Drizzle ORM の `postgres-js` ドライバーを使用し、Supabase の Connection Pooling URL で接続。

**Rationale**:
- `schema.ts` が唯一の真実のソース（憲法 II 条）。
- Supabase は PostgreSQL をホストしており、Connection Pooling（Supavisor）URL を使用することで
  サーバーレス環境での接続数過多を防げる。
- `drizzle-kit push` は開発時、`drizzle-kit generate` + migration は本番時に使用。

**Connection setup**:
```ts
// lib/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, { prepare: false }); // pooling では prepare: false が必要
export const db = drizzle(client, { schema });
```

**Environment variables**:
```env
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
NEXT_PUBLIC_SUPABASE_URL=https://[ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GOOGLE_MAPS_API_KEY=...
GEMINI_API_KEY=...
```

---

## R-007: 画像プロキシ実装パターン

**Decision**: `app/api/image-proxy/route.ts` にて Street View Static API をプロキシし、
APIキーをサーバー側でのみ使用する。

**Rationale**:
- 憲法 I 条：Google Maps API キーをクライアント側に露出させないこと。
- Next.js Route Handler で fetch → Response のストリームを返す。
- レート制限・不正利用防止のため認証チェックを追加する。

**Implementation**:
```ts
// app/api/image-proxy/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  // Auth check
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new NextResponse('Unauthorized', { status: 401 });

  const panoId = req.nextUrl.searchParams.get('pano_id');
  const width = req.nextUrl.searchParams.get('width') ?? '640';
  const height = req.nextUrl.searchParams.get('height') ?? '480';

  if (!panoId) return new NextResponse('Missing pano_id', { status: 400 });

  const url = `https://maps.googleapis.com/maps/api/streetview?pano=${panoId}&size=${width}x${height}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
  const upstream = await fetch(url);
  
  if (!upstream.ok) return new NextResponse('Upstream error', { status: 502 });

  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
```
