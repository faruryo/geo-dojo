# Research: ダッシュボード表示速度の改善

## 問題の確定（HAR 実測）

本番 HAR（`geo-dojo.faru.jp.har`, 2026-06-08）の解析結果:

- トップ表示で **POST `/` の Server Action が11本**発火。
- **並列なし**: 隣接リクエストの重なり = 0/10 ペア。各リクエストは前のが終わった約3ms後に開始。
- **総ウォール時間 ≒ 14.3秒**（全アクションの単純合計）。
- 各リクエスト所要の **約99%が `wait`**（サーバ処理 = 認証 + DB）。受信1〜2ms → 転送量・バンドルは無罪。
- `getRecommendation`（引数 `{excludeCodes:[]}`）が **2回**発火（2523ms + 1051ms）。
- 単発最重 = `getDashboardSummary` 相当（3095ms、`Promise.all` なしの直列10クエリ）。

→ ボトルネックは **クエリ性能ではなく取得アーキテクチャ（read 系 Server Action の直列化）**。インデックスは適切に存在（`mqr_user_*`, `srs_user_due_idx` 等）。

## なぜ Server Action が直列になるのか（根拠）

Next.js App Router では、クライアントから呼び出された Server Action は内部的に同一ルートへの POST として **キューイングされ、1度に1本ずつ実行**される（mutation の順序一貫性を保つ設計）。TanStack Query が複数フックから「並列に」発火しても、トランスポート層で直列化される。`(app)/layout.tsx` が `force-dynamic` のためルートキャッシュも効かず、毎回フル実行される。

→ **read（並列で取りたいデータ取得）に Server Action を使うのは設計上のアンチパターン**。憲法 II も「Read = TanStack Query」と定めており、Server Action は本来 Write 用。

## アプローチ比較

### 案1: GET Route Handlers 化
各 read を `/api/dashboard/*`（GET）に移し、TanStack Query から並列フェッチ。
- ✅ 既存の client/フック構造をほぼ維持。直列→並列で即効。
- ✅ 憲法「Read = TanStack Query」に適合（トランスポートは GET）。
- ⚠️ 初回も結局クライアント発火（往復が並列化されるだけ）。認証は各ハンドラに残る。
- ⚠️ エンドポイントが増える。CSRF/認可を各々で担保。

### 案2: 完全 RSC 化（Server Component で全取得）
ダッシュボードを純 server component 化し全クエリを `Promise.all`、HTML を直接描画。
- ✅ 最速。認証1回・往復最小・クライアント JS 削減。
- ❌ フィルタ変更（accMode/region 等の useState 連動再取得）の実装が大きく変わる。TanStack Query の利点（キャッシュ・再取得）を捨てる方向で、憲法「状態管理は TanStack Query 活用」と逆行。リグレッション面積大。

### 案3（採用）: サーバ並列プリフェッチ ＋ TanStack Query ハイドレーション（ハイブリッド）
`page.tsx` を薄い server wrapper にし、既定フィルタの全 read を **認証1回 ＋ `Promise.all`** で取得 → `dehydrate`/`HydrationBoundary` でクライアントへ。各部品は初回フェッチせず即描画。フィルタ変更・手動更新のみ既存取得関数でオンデマンド再取得（同時1〜2本なので直列化の害なし）。
- ✅ 初回 = 認証1回 + 最遅クエリ1本ぶんに収束（直列合計を解消）。
- ✅ TanStack Query を維持 → フィルタ・キャッシュ挙動そのまま（憲法 II/状態管理に適合）。
- ✅ UI コンポーネント階層を変えない → リグレッション最小。
- ⚠️ read クエリを認証非依存（`userId` 引数）に純粋化するリファクタが必要。

### 決定

- **Decision**: 案3（ハイブリッド）を採用。並行して案1の GET 化は「フィルタ変更のオンデマンド取得」には不要（既存関数流用で足りる）ため見送り。
- **Rationale**: 初回表示の直列合計という主因を最小リグレッションで解消でき、憲法 II（Read=Query / Write=SA）と状態管理方針に最も合致する。
- **Alternatives considered**: 案1は初回が依然クライアント発火で認証往復も残る。案2は最速だがフィルタ機能の作り直しでリスク大・憲法と逆行。

## 補助的判断

### 認証の往復削減: getUser → getClaims
`supabase.auth.getUser()` は GoTrue へのネットワーク往復で JWT を検証。新しい非対称 JWT 署名鍵が有効な場合、`supabase.auth.getClaims()` は **ローカル検証**でき往復ゼロ。
- **Decision**: リクエスト単位の認証ヘルパ `lib/auth/current-user.ts` を新設し `getClaims` を優先、未対応時は `getUser` フォールバック。プリフェッチで認証は元々1回に減るため、本項は副次的な上積み。
- **Rationale**: セキュリティを落とさず（署名検証は維持）往復を削減。
- **Note**: 署名鍵設定が未導入なら getUser のままでも案3の効果は得られる。導入は別途確認。

### getRecommendation の重複と重さ
- `page.tsx` の `RecommendHeroCard` が新規ユーザー分岐（L44）と既存ユーザー分岐（L52）の2箇所に記述。`useRecommendation` は `staleTime:0, refetchOnMount:'always'` で必ず再取得 → 二重発火の温床。
- **Decision**: ヒーローカードは単一マウントに整理し、`staleTime` を付与（例: 数十秒）。`getRecommendation` 自体はプリフェッチ対象に含める。
- **Rationale**: 単独で約3.5秒の重複を解消。アルゴリズムロジックは不変（憲法 非ゴール遵守）。

### getDashboardSummary の直列クエリ
現状 `await` を10連続。相互依存のない集計は `Promise.all` でまとめられる（`totalSlots` のみ後続依存に注意）。
- **Decision**: 独立クエリを `Promise.all` 化。
- **Rationale**: 単発3秒の最重関数を短縮。プリフェッチ全体の最遅を引き下げる。

## 未解決事項（NEEDS CLARIFICATION）

- Supabase の非対称 JWT 署名鍵（getClaims ローカル検証）が本番で有効か未確認。→ Phase C で確認。無効でも案3本体は成立。

### Phase C 実装結果（2026-06-08）

- 認証ヘルパ `lib/auth/current-user.ts`（`getCurrentUserId`）を新設し、`prefetch.ts` /
  `app/(app)/dashboard/actions.ts` の全ラッパ / `app/(app)/layout.tsx` の認証を一元化（往復削減）。
- **getClaims は不採用（preview で重大障害）**: 当初 `getClaims()`（非対称鍵ならローカル検証）を
  採用したが、preview デプロイで **認証済みユーザーの `GET /` が 300s ハング**（Vercel Runtime
  Timeout）した。原因は現行構成が対称 HS256（JWT 署名鍵未設定）のため、`getClaims` が内部で
  `getSession()` + `getUser()` を入れ子に呼び、GoTrue の `_acquireLock` の取り合いで SSR が
  デッドロックすること（未認証は getSession が即 null を返すため 307 redirect で正常＝症状が
  認証時のみに一致）。**実績のある `getUser()` 直呼びに戻して解消。**
- **将来の最適化（要前提）**: 本番 Supabase で非対称 JWT 署名鍵（JWT Signing Keys）を有効化した上で
  なら getClaims のローカル検証が往復削減に効く。鍵有効化を確認できてから再検討する。
- **堅牢化**: `prefetch.ts` に 8s タイムアウト＋ try/catch を追加。サーバ側 read が万一詰まっても
  `null` を返して初回描画をクライアントフェッチにフォールバックさせ、ページが 300s ハングしない。
