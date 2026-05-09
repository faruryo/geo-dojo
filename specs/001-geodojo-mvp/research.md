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

---

## R-008: 市区町村 GeoJSON/TopoJSON データソース

**Decision**: 国土数値情報 N03（行政区域データ）の最新版を **MLIT 公式から直接ダウンロード** し、`ogr2ogr`（Shapefile → GeoJSON）→ `mapshaper`（簡略化 + TopoJSON 化 + プロパティリネーム）のパイプラインで `public/japan-municipalities.topojson` を生成する。

**Rationale（中継リポジトリを使わない理由）**:
- `niiyz/JapanCityGeoJson` は **LICENSE ファイルなし**（"All rights reserved" がデフォルト）で再配布の法的根拠が不明確。
- 同リポジトリのデータは **2020-01-01 時点**で6年以上古く、その後の市町村合併・改称が反映されていない。
- 一方 MLIT N03 は **PDL1.0（Public Data License 1.0）** で商用利用可能、毎年4月頃に更新されている。

**ライセンス遵守**:
- N03 行政区域データは PDL1.0（商用可）。
- アプリ内に **出典表記の表示が必須**（FR-016 参照）：
  ```
  「国土数値情報（行政区域データ）」（国土交通省）
  https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-v3_1.html
  をもとに GeoDojo が加工して作成
  ```
- 出典表記は `app/layout.tsx` の footer または `/about` ページで常時アクセス可能にする。

**プロパティ命名規則**:
- N03 標準プロパティ：`N03_001`（都道府県）・`N03_004`（市区町村）・`N03_007`（団体コード5桁）
- これを既存の都道府県 TopoJSON と整合させるため、mapshaper の `-rename-fields` で `nam_ja`（市区町村名）・`pref_ja`（都道府県）・`code`（団体コード）に **明示的にリネーム**する。

**変換パイプライン**:
```bash
# 1. MLIT 公式から最新の N03 Shapefile をダウンロード
#    https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-v3_1.html
#    → N03-YYYYMMDD_GML.zip を取得・解凍

# 2. Shapefile → GeoJSON（GDAL の ogr2ogr が必要）
ogr2ogr -f GeoJSON -t_srs EPSG:4326 \
  japan-municipalities-raw.geojson \
  N03-YYYYMMDD.shp

# 3. mapshaper で簡略化 + プロパティ統一 + TopoJSON 化
npx mapshaper japan-municipalities-raw.geojson \
  -simplify 0.05 keep-shapes \
  -rename-fields nam_ja=N03_004,pref_ja=N03_001,code=N03_007 \
  -filter-fields nam_ja,pref_ja,code \
  -o format=topojson public/japan-municipalities.topojson

# 4. サイズ実測（目標: モバイル受容範囲 < 2MB）
ls -lh public/japan-municipalities.topojson
```

**注意**: `-simplify` の値（0.05）と最終ファイルサイズは実測後に決定する。0.02 / 0.05 / 0.1 を比較し、視認性とサイズのバランスを取る。

**PWA キャッシュ設定**:
```ts
// app/sw.ts に追加
{
  matcher: ({ url }) => url.pathname.endsWith('japan-municipalities.topojson'),
  handler: 'CacheFirst',
  options: { cacheName: 'map-data', expiration: { maxAgeSeconds: 2592000 } },
},
```

**同名市区町村（複数都道府県に存在する例）**:
- 府中市: 東京都・広島県
- 八幡市: 京都府・福岡県
- 栄町: 千葉県・長野県
- 大多喜町: 千葉県・高知県

これらは `code`（団体コード）で一意に識別する。クイズデータには `id: code` を付与する。

**Alternatives considered**:
- `niiyz/JapanCityGeoJson`: LICENSE なし・データが2020年で古いため不採用
- `smartnews-smri/japan-topography`: LICENSE はあるが N03 N03 ベースでこちらも更新が遅延しがち
- `dataofjapan/land`: 都道府県のみで市区町村未対応

---

## R-009: municipality_quiz_results テーブル設計

**Decision**: `municipality_quiz_results` テーブルを新設し、正解/不正解を記録。苦手優先モードは直近 100 件の不正解率で重み付けする。

**Rationale**:
- SRS の `srs_records` とは独立して設計する（クイズ結果は SRS の学習履歴とは異なるエンティティ）。
- 苦手優先モード実装に必要な最小フィールドのみ保持してテーブルを軽量に保つ。
- `(user_id, municipality_code)` インデックスで苦手市区町村の集計クエリを高速化。

**Drizzle スキーマ**:
```ts
export const municipalityQuizResults = pgTable(
  'municipality_quiz_results',
  {
    id:               uuid('id').primaryKey().defaultRandom(),
    userId:           uuid('user_id').notNull(),
    municipalityCode: text('municipality_code').notNull(), // 行政区域コード（一意識別）
    municipalityName: text('municipality_name').notNull(),
    prefecture:       text('prefecture').notNull(),
    mode:             text('mode').notNull(),              // 'A'|'B'|'C'|'D'
    isCorrect:        boolean('is_correct').notNull(),
    answeredAt:       timestamp('answered_at').defaultNow().notNull(),
  },
  (table) => ({
    userCodeIdx: index('mqr_user_code_idx').on(table.userId, table.municipalityCode),
    userTimeIdx: index('mqr_user_time_idx').on(table.userId, table.answeredAt),
  }),
);
```

**苦手優先アルゴリズム**（weighted random selection）:
```ts
// 直近 100 件の結果から不正解率を計算
// weight = 1 + (incorrect_count / total_count) * 4  → 1.0〜5.0
// 全市区町村をこの weight に比例したランダム選択で出題
```

---

## R-010: MunicipalityMap コンポーネント（モードD）

**Decision**: 既存の `JapanMap` と同じ `@vnedyalk0v/react19-simple-maps` パターンで実装。都道府県名でフィルタして該当都道府県の市区町村のみ描画する。

**Rationale**:
- 全 1,741 市区町村を一度に SVG 描画すると重いため、選択した都道府県の市区町村のみを表示する。
- TopoJSON を一度ロードしてメモリに保持し、都道府県切り替え時はフィルタのみ（再フェッチなし）。

**プロパティ前提**: TopoJSON は R-008 のパイプラインで `nam_ja` / `pref_ja` / `code` にリネーム済み。既存 `JapanMap` と同じ命名規則。

**Key implementation pattern**:
```tsx
'use client';
import { ComposableMap, Geographies, Geography } from '@vnedyalk0v/react19-simple-maps';
import { prefectureCenter } from '@/lib/quiz/prefecture-center'; // R-010-bis 参照

const GEO_URL = '/japan-municipalities.topojson';

export function MunicipalityMap({ prefecture, onMunicipalityClick, highlightCodes, wrongCodes }) {
  const [topology, setTopology] = useState(null);

  useEffect(() => {
    fetch(GEO_URL).then(r => r.json()).then(setTopology).catch(console.error);
  }, []);

  return (
    <ComposableMap projection="geoMercator" projectionConfig={prefectureCenter[prefecture]}>
      <Geographies geography={topology}>
        {({ geographies }) =>
          geographies
            .filter(geo => geo.properties.pref_ja === prefecture)
            .map(geo => (
              <Geography
                key={geo.properties.code}
                geography={geo}
                onClick={() => onMunicipalityClick(geo.properties.code, geo.properties.nam_ja)}
                style={{ ... }}
              />
            ))
        }
      </Geographies>
    </ComposableMap>
  );
}
```

---

## R-010-bis: prefectureCenter 定数の生成（モードD 初期ズーム）

**Decision**: `lib/quiz/prefecture-center.ts` に各都道府県の `{ center: [lng, lat], scale: number }` を定義する。値は **TopoJSON の各都道府県 BBox から自動算出**する `scripts/generate-prefecture-center.ts` で生成する（手書きしない）。

**Rationale**:
- 北海道（広い）と東京（小さい）でスケールが大きく異なるため、固定値は不可。
- BBox 算出は `topojson-client` の `feature()` + `d3-geo` の `geoBounds()` で機械的に決定可能。
- 値が一度生成されれば変更頻度は低いため、定数として commit する。

**生成スクリプト**（実装時）:
```ts
// scripts/generate-prefecture-center.ts
import { feature } from 'topojson-client';
import { geoBounds, geoCentroid } from 'd3-geo';
import topology from '../public/japan-municipalities.topojson';

const collection = feature(topology, topology.objects.municipalities) as any;
const byPrefecture: Record<string, any[]> = {};
for (const f of collection.features) {
  const pref = f.properties.pref_ja;
  (byPrefecture[pref] ||= []).push(f);
}

const result: Record<string, { center: [number, number]; scale: number }> = {};
for (const [pref, feats] of Object.entries(byPrefecture)) {
  const fc = { type: 'FeatureCollection', features: feats };
  const [[w, s], [e, n]] = geoBounds(fc as any);
  const center = geoCentroid(fc as any);
  // モバイル 375px 想定で BBox を画面に収めるスケール
  // ComposableMap の scale=1000 で日本全体が収まることを基準に逆算
  const span = Math.max(e - w, (n - s) * 1.4);
  const scale = Math.round(8000 / span);  // 経験則。実装時にチューニング
  result[pref] = { center, scale };
}

writeFileSync('lib/quiz/prefecture-center.ts',
  `export const prefectureCenter = ${JSON.stringify(result, null, 2)} as const;`);
```

**`scale` の係数 (8000)** は初期実装時に実機で確認しながら調整する。47都道府県を順に表示して画面外にはみ出る・小さすぎるケースを目視で確認する。

---

## R-011: 市区町村クイズ静的データ（public/municipalities.json）

**Decision**: TopoJSON から生成した静的 JSON ファイルを `public/municipalities.json` に配置する。~1,741 件・暫定目標 < 300KB（実測で確定、plan.md「実測で確定する数値」参照）。

**前提**: TopoJSON は R-008 のパイプラインで `nam_ja`/`pref_ja`/`code` にリネーム済み。生成スクリプトはこの命名を前提とする。

**Rationale**:
- API 不要で Supabase への接続コストゼロ。
- PWA でオフラインキャッシュ可能（`defaultCache` に含まれる）。
- 苦手優先モードは DB の `municipality_quiz_results` から weight を計算し、この静的リストに適用する。

**フォーマット**:
```json
[
  { "code": "13201", "name": "八王子市", "prefecture": "東京都", "region": "関東" },
  { "code": "34202", "name": "府中市",   "prefecture": "広島県", "region": "中国" },
  { "code": "13206", "name": "府中市",   "prefecture": "東京都", "region": "関東" }
]
```

**同名市区町村の扱い**: `code` が異なれば別エントリ。クイズ出題時に `name` で検索して複数ヒットした場合は全選択必須（FR-013）。

**生成スクリプト** (`scripts/generate-municipalities.ts`):
```ts
import topology from '../public/japan-municipalities.topojson';
import { feature } from 'topojson-client';

const geojson = feature(topology, topology.objects.municipalities);
const municipalities = geojson.features.map(f => ({
  code: f.properties.code,
  name: f.properties.nam_ja,
  prefecture: f.properties.pref_ja,
  region: prefectureToRegion[f.properties.pref_ja],
}));
writeFileSync('public/municipalities.json', JSON.stringify(municipalities));
```
