---
description: "GeoDojo MVP — 都道府県クイズ・市区町村クイズ（4モード＋難易度フィルター）"
---

# Tasks: GeoDojo MVP（Phase 1）

**Input**: Design documents from `specs/001-geodojo-mvp/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅

**Tests**: テストタスクは仕様に明示的な指定がないため含みません。

**Organization**: タスクはユーザーストーリー単位でグループ化され、各ストーリーを独立して実装・確認できます。

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: 並列実行可能（異なるファイル、依存なし）
- **[Story]**: 対応するユーザーストーリー（US1〜US4）
- ファイルパスを全タスクに明記

---

## Phase 1: Setup（プロジェクト初期化）

**Purpose**: 開発環境の初期構築。全フェーズの土台。

- [x] T001 `pnpm create next-app@latest` で Next.js 15.2.6+ プロジェクトを作成（TypeScript・App Router・Tailwind CSS v4）
- [x] T002 依存関係をインストール：`@supabase/supabase-js drizzle-orm postgres @tanstack/react-query @vnedyalk0v/react19-simple-maps topojson-client @google/generative-ai @serwist/next serwist`（pnpm add）
- [x] T003 devDependencies をインストール：`drizzle-kit @types/topojson-client vitest @vitejs/plugin-react`（pnpm add -D）
- [x] T004 shadcn/ui を初期化（`pnpm dlx shadcn@latest init`）し、button card badge skeleton toast をインストール
- [x] T005 `.env.local` 設定済み（実施済み）
- [x] T006 国土地理院GeoJSONを取得し `public/japan.topojson` に変換済み（40.8KB）
- [x] T007 [P] `tailwind.config.ts` と `app/globals.css` を設定：ダークモード（`#111111`）をデフォルト、375px モバイルファーストのベーススタイル

---

## Phase 2: Foundational（全ストーリー共通の基盤）

**Purpose**: 全ユーザーストーリーに必要な共通インフラ。完了前にストーリー実装を開始してはならない。

**⚠️ CRITICAL**: Phase 2 完了前はどのユーザーストーリー実装も開始しないこと。

- [x] T008 Drizzle スキーマを定義する `lib/db/schema.ts`（cards・annotations・srs_records・ai_candidates の4テーブル、`srs_user_due_idx` 複合インデックス必須）
- [x] T009 `drizzle.config.ts` を作成し `pnpm drizzle-kit push` でスキーマを Supabase に適用
- [x] T010 Supabase Dashboard でRLSポリシーを4テーブル全てに適用済み（実施済み）
- [x] T011 [P] Drizzle DBクライアントを実装：`lib/db/index.ts`（`postgres-js` ドライバー、`prepare: false`）
- [x] T012 [P] Supabase クライアントを実装：`lib/supabase/client.ts`（browser/server 両用）
- [x] T013 TanStack Query の QueryClientProvider を実装：`app/providers.tsx`（`'use client'`、`staleTime: 60000`）
- [x] T014 Root レイアウトに Providers・ThemeProvider を設定：`app/layout.tsx`（PWA manifest メタタグ含む）
- [x] T015 [P] @serwist/next PWA 設定を適用：`next.config.ts`（`withSerwist`）と `app/sw.ts`（CacheFirst で `/japan.topojson` をキャッシュ）
- [x] T016 アプリシェルレイアウト（BottomNav: 学習・クイズ・カード・AIレビュー）を実装：`app/(app)/layout.tsx`
- [x] T017 Supabase Auth を使ったログイン・サインアップページを実装：`app/(auth)/login/page.tsx`・`app/(auth)/signup/page.tsx`
- [x] T018 認証ガード（未認証で `/login` リダイレクト）を `app/(app)/layout.tsx` に組み込む
- [x] T019 **画像プロキシ API を実装**：`app/api/image-proxy/route.ts`（Auth チェック・pano_id バリデーション・Google Maps API キーをサーバー側のみで使用）— 憲法 I 条

**Checkpoint**: Phase 2 完了 → 全ストーリーの実装を並列開始できる

---

## Phase 3: User Story 1 — SRS学習セッション (Priority: P1) 🎯 MVP

**Goal**: ユーザーがフラッシュカードで SM-2 間隔反復学習を行い、評価（1/3/5）後に次回出題日が更新される。

**Independent Test**: カードが1枚あり `/study` にアクセスしてカードが表示され、評価ボタンを押して次回出題日が変わればこのストーリーは完了。

### User Story 1 の実装

- [x] T020 [P] [US1] SM-2 簡略化アルゴリズムを実装：`lib/srs/algorithm.ts`（`calculateNextReview(record, rating: 1|3|5)` を export、research.md R-001 参照）
- [x] T021 [P] [US1] `useDueCards` フックを実装：`lib/hooks/useDueCards.ts`（`GET /api/cards/due` を queryFn に使用）
- [x] T022 [P] [US1] 当日期限カード取得 API を実装：`app/api/cards/due/route.ts`（due_date <= NOW() で srs_records + cards を JOIN、`srs_user_due_idx` 使用）
- [x] T023 [US1] `submitRating` API ルートを実装：`app/api/study/rate/route.ts`（algorithm を呼び出し srs_records を upsert）
- [x] T024 [P] [US1] `AnnotationOverlay` コンポーネントを実装：`components/flashcard/AnnotationOverlay.tsx`（SVG、`xRatio`/`yRatio` 相対座標でマーカー描画）
- [x] T025 [P] [US1] `MarkerPin` SVG コンポーネントを実装：`components/annotation/MarkerPin.tsx`（円＋ラベル、タップでラベル表示）
- [x] T026 [US1] `FlashCard` コンポーネントを実装：`components/flashcard/FlashCard.tsx`（画像表示 + AnnotationOverlay 重ね合わせ、panoId の場合は `/api/image-proxy` 経由で表示）
- [x] T027 [US1] `RatingButtons` コンポーネントを実装：`components/flashcard/RatingButtons.tsx`（「全然(1)」「うろ覚え(3)」「完璧(5)」3ボタン、タップ後は disabled）
- [x] T028 [US1] 学習セッションページを実装：`app/(app)/study/page.tsx`（useDueCards で取得 → FlashCard + RatingButtons → submitRating → 次カード。カード0件は「今日の学習は完了」表示）

**Checkpoint**: `/study` でカード表示・評価・次回日更新が動作 → User Story 1 完了・独立してデモ可能

---

## Phase 4: User Story 2 — 地図タップクイズ (Priority: P2)

**Goal**: 日本地図から都道府県をタップし、問題の都道府県に対して正誤判定が1秒以内に表示される。

**Independent Test**: `/quiz` にアクセスして地図が表示され、都道府県をタップして正誤フィードバックが表示されれば完了。

### User Story 2 の実装

- [x] T029 [P] [US2] `JapanMap` コンポーネントを実装：`components/map/JapanMap.tsx`（`'use client'`、`@vnedyalk0v/react19-simple-maps`、`/japan.topojson` を fetch で非同期ロード、各都道府県をタップ可能な Geography として描画）
- [x] T030 [P] [US2] `PrefectureLabel` — ハイライト処理は JapanMap に統合済み
- [x] T031 [US2] 地図タップクイズページを実装：`app/(app)/quiz/page.tsx`（問題出題 → JapanMap 表示 → タップ → 正誤判定 → 次の問題。クイズ終了後に正答率・苦手都道府県一覧表示）

**Checkpoint**: `/quiz` で地図タップ→即時フィードバック動作 → User Story 2 完了

---

## Phase 5: User Story 3 — 手動カード作成 (Priority: P3)

**Goal**: スクリーンショットをアップロードし、アノテーションを付けてカードを保存→SRS学習に利用できる。

**Independent Test**: `/cards/new` で画像をアップロード・メモ入力・保存後、`/study` または `/cards` に反映されれば完了。

### User Story 3 の実装

- [x] T032 [P] [US3] `AnnotationEditor` コンポーネントを実装：`components/annotation/AnnotationEditor.tsx`（`'use client'`、画像上のタップ位置を相対座標 0.0〜1.0 に変換してマーカー追加・削除、ラベル入力UI付き）
- [x] T033 [US3] カード作成ロジックを実装：`app/(app)/cards/new/page.tsx`（Supabase Storage に画像アップロード → POST /api/cards → cards INSERT → annotations INSERT → srs_records 初期状態 INSERT）
- [x] T034 [US3] カード作成ページを実装：`app/(app)/cards/new/page.tsx`（画像アップロードUI → AnnotationEditor → notes・tags 入力 → 保存ボタン）
- [x] T035 [P] [US3] `useCards` フックを実装：`lib/hooks/useCards.ts`（タグ配列でフィルタリング、`GET /api/cards` を queryFn に使用）
- [x] T036 [US3] カード一覧 API を実装：`app/api/cards/route.ts`（`?tags=東北,電柱` クエリパラメータ対応、`tags @> ARRAY[...]` で絞り込み）
- [x] T037 [US3] カード削除 API を実装：`app/api/cards/[id]/route.ts`（DELETE エンドポイント）
- [x] T038 [US3] カード一覧ページを実装：`app/(app)/cards/page.tsx`（タグフィルタUI + カードグリッド + 削除ボタン）

**Checkpoint**: `/cards/new` でカード作成 → `/study` または `/cards` に反映 → User Story 3 完了

---

## Phase 6: User Story 4 — AI生成カード候補レビュー (Priority: P4)

**Goal**: AI生成候補一覧でユーザーが承認/却下でき、承認したカードが SRS 学習に追加される。

**Independent Test**: `/ai-review` で候補が表示され、承認後に `/study` に追加されれば完了。

### User Story 4 の実装

- [x] T039 [P] [US4] Gemini 2.5 Flash ラッパーを実装：`lib/ai/gemini.ts`（`gemini-2.5-flash` モデル、画像解析プロンプト、JSON レスポンス `{ notes, suggestedTags }` を返す）
- [x] T040 [US4] AI生成 API ルートを実装：`app/api/ai-generate/route.ts`（ai_candidates INSERT → 非同期で Gemini 呼び出し → 結果を ai_candidates UPDATE、即時 `{ candidateId, status: "processing" }` を返す）
- [x] T041 [US4] 承認・却下 API を実装：`app/api/ai-candidates/[id]/route.ts`（承認: ai_candidates.status → 'approved' + cards INSERT + srs_records INSERT。却下: status → 'rejected'）
- [x] T042 [P] [US4] `AiReviewCard` コンポーネントを実装：`components/ai/AiReviewCard.tsx`（候補画像・提案メモ・提案タグ表示、メモ・タグ編集フォーム、承認・却下ボタン）
- [x] T043 [P] [US4] `useAiCandidates` フックを実装：`lib/hooks/useAiCandidates.ts`（`GET /api/ai-candidates` を queryFn に使用、`status=pending` でフィルタ）
- [x] T044 [US4] AI候補一覧 API を実装：`app/api/ai-candidates/route.ts`（status=pending のみ返す）
- [x] T045 [US4] AI候補レビューページを実装：`app/(app)/ai-review/page.tsx`（pending 件数バッジ、AiReviewCard 一覧、生成中ステータス表示）

**Checkpoint**: `/ai-review` で候補表示・承認・却下動作 → User Story 4 完了

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 全ストーリーに影響する品質改善。

- [x] T046 [P] `app/(app)/loading.tsx` + 各ページの Skeleton フォールバック追加済み
- [x] T047 [P] safe-area-inset・44px タップターゲット・ダークモード globals.css 適用済み
- [x] T048 [P] image-proxy にインメモリレート制限（100req/min）追加済み
- [x] T049 Supabase Realtime で ai_candidates の UPDATE を subscribe し `/ai-review` を自動更新
- [x] T050 `quickstart.md` の動作確認シナリオを手動実行し、全 Acceptance Scenarios をパスすることを確認

---

## Phase 8: Post-MVP バグ修正・UX改善

**Purpose**: MVP動作確認後に発見された不具合・UX問題の修正。

- [x] T051 [P] `/cards/new` に「✨ AIに提案させる」ボタンを追加（`app/(app)/cards/new/page.tsx`）
- [x] T052 [P] `AiReviewCard` の processing→pending 遷移時にフォームが空になる不具合を修正（`useEffect` で state 同期）
- [x] T053 [P] `FlashCard`・`AnnotationEditor` の縦長画像クロップ問題を修正（`aspect-video` + `object-cover`）
- [x] T054 `/study` ページの「残り -1 枚」バグを修正（`currentIndex` 廃止、常に `cards[0]` を表示）
- [x] T055 `/study` ページのレイアウト改善（評価ボタンを画面下部に固定、カードエリアをスクロール可能に）
- [x] T056 `react-easy-crop` を使った16:9クロップUI導入（`app/(app)/cards/new/page.tsx`）— アップロード前にユーザーが範囲調整可能
- [x] T057 [P] `FlashCard`・`AnnotationEditor`・`AiReviewCard` を `max-w-2xl mx-auto self-center aspect-video` で統一（Web/モバイル両対応）
- [x] T058 [P] `ai-generate` API の catch ブロックにエラーログを追加（デバッグ用）
- [x] T074 パスワード再発行ページを追加：`app/(auth)/forgot-password/page.tsx`（`supabase.auth.resetPasswordForEmail` でメール送信、`redirectTo=/auth/callback?next=/reset-password`）
- [x] T075 新パスワード設定ページを追加：`app/(auth)/reset-password/page.tsx`（リカバリーセッションで `supabase.auth.updateUser({ password })`、確認入力で一致チェック）
- [x] T076 `app/auth/callback/route.ts` に `?next=` クエリ対応を追加（`/`始まりのパスのみ許可、未指定時は `/study`）。`app/(auth)/login/page.tsx` に「パスワードを忘れた方」リンクを追加
- [x] T077 モードD（市区町村地図タップ）の背景を Google Maps JS API に置き換える — `components/map/MunicipalityMap.tsx` を `@googlemaps/js-api-loader` v2（`setOptions`+`importLibrary`）ベースで書き直し済み。TopoJSON を `map.data.addGeoJson()` で overlay、クリックは `map.data.addListener('click')` で `code`/`name` 取得、スタイル（選択中=青・正解=緑・不正解=赤）は `map.data.setStyle()` で動的更新。`fitBounds` で都道府県ごとに自動フィット、`gm_authFailure` で onLoadError → モードC フォールバック。モードA（JapanMap）は現状維持
- [x] T078 `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` を追加（client 側 Maps JS API 用）。`GOOGLE_MAPS_API_KEY` は image-proxy/Street View Static 用に server-side 専用として維持。`.env.local`・`.env.example` 更新済み。ローカル: Maps JavaScript API は有効化済み（2026-05-23）
- [x] T079 **本番デプロイ前必須** — Google Cloud Console で client 用キーを発行：① 新規 API キー作成、② 「Maps JavaScript API」のみに API 制限、③ HTTP referrer 制限（本番ドメイン + プレビュー用 `*.vercel.app` 等）、④ そのキー値を本番環境変数 `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` に設定。**既存の `GOOGLE_MAPS_API_KEY`（image-proxy 用）にも server 用の制限を設定**（Vercel egress IP allowlist または「Street View Static API」のみに API 制限）

---

## Phase 9: User Story 5 — 市区町村クイズ データアセット準備 (Priority: P5)

**Purpose**: 市区町村クイズが依存する静的データファイルを生成する。コード実装前に完了する必要がある。

- [x] T059 [US5] MLIT 国土数値情報 N03 最新 Shapefile をダウンロードし、`mapshaper`（`-rename-fields nam_ja=N03_004,pref_ja=N03_001,code=N03_007` ）で `public/japan-municipalities.topojson` を生成する（実測: 16.3MB uncompressed / 2.0MB gzip。ogr2ogr未導入のため mapshaper 直接処理）
- [x] T060 [P] [US5] `scripts/generate-municipalities.ts` を実装・実行して `public/municipalities.json` を生成する（実測: 1905件・149.4KB）
- [x] T061 [P] [US5] `scripts/generate-prefecture-center.ts` を実装・実行して `lib/quiz/prefecture-center.ts` を生成する（47都道府県・d3-geo で自動計算）

**Checkpoint**: T059〜T061 完了 → 静的データが揃い実装開始可能

---

## Phase 10: User Story 5 — 市区町村クイズ 基盤追加 (Priority: P5)

**Purpose**: US5 固有のデータベーステーブル・キャッシュ・出典表記を追加する。Phase 9 完了後に実施。

- [x] T062 [US5] `lib/db/schema.ts` に `municipalityQuizResults` テーブル（`municipality_quiz_results`）を追加し DB に適用（drizzle-kit push バグのため node-postgres で直接適用）
- [x] T063 [US5] `municipality_quiz_results` テーブルに RLS ポリシー（`mqr_own`）を適用（T062 と同時に node-postgres で適用済み）
- [x] T064 [P] `app/sw.ts` に `japan-municipalities.topojson` の `CacheFirst` ルールを追加
- [x] T065 [P] `app/layout.tsx` の footer に国土数値情報 PDL1.0 出典表記を追加

**Checkpoint**: T062〜T065 完了 → US5 実装開始可能

---

## Phase 11: User Story 5 — 市区町村クイズ 実装 (Priority: P5)

**Goal**: ユーザーが `/quiz/municipality` で モードA〜D・地域フィルター・苦手優先を使って市区町村クイズをプレイでき、結果が DB に記録される。

**Independent Test**: `/quiz/municipality` にアクセスしてモードBで1問出題・回答・結果画面表示が動作すれば独立して機能する。

### User Story 5 の実装

- [x] T066 [P] [US5] `lib/quiz/municipality-data.ts` を実装する — 型定義・地域フィルター・weighted random selection
- [x] T067 [P] [US5] `components/map/MunicipalityMap.tsx` を実装する — pref_ja フィルタ・prefectureCenter ズーム・highlightCodes/wrongCodes・ズームコントロール
- [x] T068 [P] [US5] `lib/hooks/useMunicipalityWeakness.ts` を実装する
- [x] T069 [US5] `app/(app)/quiz/municipality/actions.ts` を実装する — mode ホワイトリスト・validCodes 検証・60件/分レート制限・INSERT・getMunicipalityWeakness
- [x] T070 [US5] `app/(app)/quiz/municipality/page.tsx` を実装する — モード選択・ゲームループ（A/B/C/D）・結果画面・DB記録
- [x] T071 [US5] `app/(app)/quiz/page.tsx` に「市区町村クイズへ」リンクカードを追加
- [x] T072 [P] [US5] モードD フォールバック（onLoadError → モードC 切り替え・エラーメッセージ表示）を実装

**Checkpoint**: `/quiz/municipality` でモードA〜D・地域フィルター・苦手優先が動作 → User Story 5 完了・独立してデモ可能

---

## Phase 12: User Story 5 — 検証

- [x] T073 [US5] `/quiz/municipality` の全 Acceptance Scenarios（7シナリオ）を手動実行して確認する。特に同名市区町村（例: 府中市）の全選択フロー・残数カウンタ・「解答する」送信・DB 記録・苦手優先出題の動作を確認する（手動実施必要）

---

## Phase 13: User Story 6 — 難易度フィルター データ準備 (Priority: P6)

**Purpose**: e-Stat API 連携の前提となる環境変数・スキーマ・初期データを準備する。Phase 14 開始前に完了する必要がある。

> **バッチ実行先**: ローカル手動のみ（Vercel・Supabase 上では動かさない）。国勢調査は5年周期のため自動スケジューラは MVP 外。本番運用後にニーズが出たら別 spec で Cron 化を検討。

- [x] T080 [US6] e-Stat ユーザー登録で `appId` を取得し、`.env.local` と `.env.example` に `E_STAT_APP_ID` を追加
- [x] T081 [US6] statsDataId 確定: **`0003445139`**（令和2年国勢調査 男女・年齢・国籍別人口、market 市区町村レベル area=4086、`cdCat01=0&cdCat02=0&cdCat03=000` で総人口取得可能）
- [x] T082 [US6] `lib/db/schema.ts` に `municipalityMaster` テーブルと `Difficulty` 型を追加。`scripts/apply-municipality-master.ts` で DDL + インデックス + RLS を直接適用
- [x] T083 [US6] RLS ポリシー `mm_read_authenticated`（SELECT to authenticated）を適用済み（T082 と同時実行）

**Checkpoint**: T080〜T083 完了 → バッチ実装と Server Action 開発を並列開始可能

---

## Phase 14: User Story 6 — バッチスクリプト + Server Action (Priority: P6)

- [x] T084 [P] [US6] `scripts/sync-municipality-master.ts` 実装：seed → e-Stat API（100件/req・250ms throttle）→ `calculateDifficulty()` → upsert。N03 GIS残骸（「所属未定地」XX000）はフィルタ
- [x] T085 [US6] バッチ初回実行完了。結果: 1898 行、人口取得 1888/1898 (99.5%)、分布 easy=404 / medium=515 / hard=445 / expert=534。バランス良好で閾値調整不要。NULL 10件は北方領土6村・双葉町・旧浜松3区で fallback 適切に動作
- [x] T086 [P] [US6] `getMunicipalityMaster` Server Action 追加（認証必須、全件返却）
- [x] T087 [P] [US6] `lib/hooks/useMunicipalityMaster.ts` 実装（TanStack Query、staleTime 1h）

**Checkpoint**: T084〜T087 完了 → UI 実装可能

---

## Phase 15: User Story 6 — UI 実装 (Priority: P6)

**Goal**: ユーザーが設定画面で難易度 chip を複数選択でき、地域フィルターと AND で出題プールが絞り込まれる。

**Independent Test**: `/quiz/municipality` 設定画面で「☆ のみ + 全国」を選んで開始 → 出題された全市区町村が `easy` バケットであることを確認。

- [x] T088 [US6] 設定画面に「難易度」chip select（複数選択、デフォルト [easy, medium]）追加。masterLoading 時はグレーアウト
- [x] T089 [US6] `filterByDifficulty()` helper を `lib/quiz/municipality-data.ts` に追加し `buildQuestions` で region + difficulty を AND 適用。データソースを `/municipalities.json` fetch → `useMunicipalityMaster()` に切替
- [x] T090 [US6] スタートボタンの活性判定: masterLoading / 難易度未選択 / 地域+難易度プール 0件 で disabled。状況別ラベル表示。プール < 設定問題数のとき注意書き
- [x] T091 [US6] 苦手優先モード: `buildQuestions` が region+difficulty フィルター後のプールを `weightedSample` に渡す既存実装で問題なし
- [x] T092 [P] [US6] `app/layout.tsx` の footer に e-Stat 出典表記 (FR-022) + API クレジット表示 (FR-023) を追記

**Checkpoint**: T088〜T092 完了 → User Story 6 独立してデモ可能

---

## Phase 16: User Story 6 — 検証 (Priority: P6)

- [x] T093 [US6] Acceptance Scenarios 6項目を手動実行して確認（特に scenario 3 の空プールエラー、scenario 6 のバッチ再実行で difficulty が再計算されるか）
- [x] T094 [US6] Phase 2 → Phase 3 移行用の TODO を tasks.md に追記（クラウド正答率カラムの追加・combined score の検討は別 spec 化）

---

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし — 即開始可能
- **Foundational (Phase 2)**: Phase 1 完了後 — 全ユーザーストーリーをブロック
- **US1 (Phase 3)**: Phase 2 完了後 — 他ストーリーへの依存なし
- **US2 (Phase 4)**: Phase 2 完了後 — 他ストーリーへの依存なし
- **US3 (Phase 5)**: Phase 2 完了後 — 他ストーリーへの依存なし
- **US4 (Phase 6)**: Phase 2 完了後 + US3 推奨（画像アップロード機能を再利用）
- **Polish (Phase 7)**: 実装したい全ストーリー完了後

### User Story Dependencies

- **US1 (P1)**: Foundation 完了後、単独で開始可能
- **US2 (P2)**: Foundation 完了後、単独で開始可能（US1と並列可）
- **US3 (P3)**: Foundation 完了後、単独で開始可能
- **US4 (P4)**: Foundation 完了後、US3 の画像アップロード（T033）完了推奨
- **US5 (P5)**: Phase 9（データアセット T059〜T061）→ Phase 10（基盤 T062〜T065）→ Phase 11（実装 T066〜T072）の順。他 US への依存なし
- **US6 (P6)**: US5 完了が前提（`municipality_quiz_results` と既存設定 UI を再利用）。Phase 13（データ準備 T080〜T083）→ Phase 14（バッチ + Server Action T084〜T087）→ Phase 15（UI 実装 T088〜T092）→ Phase 16（検証 T093〜T094）の順

### Within Each User Story

- アルゴリズム/ロジック（T020, T039）→ Server Actions が依存
- API Routes → TanStack Query フックが依存
- UI コンポーネント（[P]）→ ページコンポーネントが依存
- Foundation の schema（T008）→ 全 DB 操作が依存

### Parallel Opportunities

- Phase 1 の `[P]` タスク（T007）は独立して実行可能
- Phase 2 の `[P]` タスク（T011, T012, T015）は独立して実行可能
- Phase 3: T020・T021・T024・T025 は同時実行可能（異なるファイル）
- Phase 4: T029・T030 は同時実行可能
- Phase 5: T032・T035 は同時実行可能
- Phase 6: T039・T042・T043 は同時実行可能
- US1・US2・US3 は Phase 2 完了後に並列で進められる
- Phase 9（US5）: T060・T061 は T059 完了後に並列実行可能
- Phase 11（US5）: T066・T067・T068 は T069 着手前に並列実行可能

---

## Parallel Example: User Story 1

```bash
# Phase 2 完了後、以下を並列で開始:
Task T020: "SM-2アルゴリズムを実装 lib/srs/algorithm.ts"
Task T021: "useDueCarsフックを実装 lib/hooks/useDueCards.ts"
Task T022: "cards/due API route を実装 app/api/cards/due/route.ts"
Task T024: "AnnotationOverlayコンポーネントを実装 components/flashcard/AnnotationOverlay.tsx"
Task T025: "MarkerPinコンポーネントを実装 components/annotation/MarkerPin.tsx"

# 上記完了後:
Task T023: "submitRating Server Actionを実装 app/(app)/study/actions.ts" (T020依存)
Task T026: "FlashCardコンポーネントを実装 components/flashcard/FlashCard.tsx" (T024, T025依存)
Task T027: "RatingButtonsコンポーネントを実装 components/flashcard/RatingButtons.tsx"

# 全て完了後:
Task T028: "学習セッションページを実装 app/(app)/study/page.tsx"
```

---

## Implementation Strategy

### MVP First（User Story 1 のみ）

1. Phase 1: Setup 完了
2. Phase 2: Foundational 完了（全ストーリーのブロッカー）
3. Phase 3: User Story 1 完了
4. **STOP & VALIDATE**: `/study` で学習セッションが動作することを確認
5. 動作確認後にデプロイ/デモ可能

### Incremental Delivery

1. Setup + Foundational → 基盤完成
2. US1 追加 → 独立テスト → デプロイ（MVP！）
3. US3 追加 → 独立テスト → デプロイ（カード作成でコンテンツ充実）
4. US2 追加 → 独立テスト → デプロイ（クイズで学習を補完）
5. US5 追加 → 独立テスト → デプロイ（市区町村クイズで地理知識を深化）
5. US4 追加 → 独立テスト → デプロイ（AI生成でコンテンツ自動化）

### Parallel Team Strategy

Phase 2 完了後:
- Developer A: US1（SRS学習）
- Developer B: US2（地図クイズ）
- Developer C: US3（カード作成）

---

## Notes

- `[P]` タスク = 異なるファイル、他タスクへの依存なし
- `[Story]` ラベルでトレーサビリティを保証（spec.md のユーザーストーリーと対応）
- 各ユーザーストーリーは独立して完成・テスト可能
- **セキュリティ必須**: T019（画像プロキシ）は Phase 2 に含まれ、全実装より先に完成させること
- commit は各タスクまたは論理グループ完了時に実施
- 各 Checkpoint で独立動作を確認してから次フェーズに進む
