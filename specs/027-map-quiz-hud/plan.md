# Implementation Plan: 地図クイズのフルスクリーン HUD（GeoGuessr風）

**Branch**: `faruryo/feat-ui-hud-ui-geoguessr` | **Date**: 2026-09-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/027-map-quiz-hud/spec.md`

## Summary

出題中だけアプリ共通の枠（footer の出典表記・BottomNav・`paddingBottom: 6rem`）を外し、
画面を「上端 HUD ／ 地図 ／ 下端 HUD」の3段に固定する。お題は出題直後に画面中央へ大きく出し、
約1秒で下端の1行へ縮小移動させることで、定常状態の占有面積を 44〜52px に抑える。

技術的な要は3つある。

1. **枠の出し分け**: `app/(app)/layout.tsx` は server component なので、client の `AppShell` を1枚挟み、
   boolean 1つの Context で footer / BottomNav / padding を切り替える。切替の単位はセッションであり、
   判定は `questions` から導く pure 関数に置く（FR-004）。
2. **導入表示**: 中央のオーバーレイを `transform` + `opacity` で下端へ寄せて消し、同時に下端の定常表示を
   出す2要素方式にする。FLIP や View Transitions は使わない。
3. **タイマーの起点分離**: 導入が終わってから動かすのは**モード D の制限時間だけ**。`answerTimeMs` と
   都道府県タイムアタックの経過タイムは現行どおり `qIdx` 起点のまま触らない（FR-024 / FR-050）。

地図コンテナを帯の内側に閉じ込める設計にすると、FR-034（自動フォーカスの可視矩形）と
FR-032（Google ロゴの直上に帯を密着）が副作用として満たされ、追加コードが要らない。

## Technical Context

**Language/Version**: TypeScript 5（`strict: true`）/ React 19 / Next.js 15.2.6（App Router, Turbopack）

**Primary Dependencies**: Tailwind CSS v4、shadcn/ui、lucide-react、
`@vnedyalk0v/react19-simple-maps`（県当て A・都道府県クイズの全国 SVG 地図）、
`@googlemaps/js-api-loader`（場所当て D）、TanStack Query v5

**Storage**: 変更なし。DB スキーマ・Server Actions・localStorage のキーはいずれも触らない

**Testing**: Vitest（`environment: 'node'` 既定、DOM が要るテストは先頭に `// @vitest-environment happy-dom`）。
`@testing-library` は未導入のため、既存の
`__tests__/components/map/autofocus-integration.test.tsx` と同じく `react-dom/client` の
`createRoot` + `act` で描画する

**Target Platform**: モバイル Web / PWA。基準は 375×812 の縦向き、ダークモード（`#111111`）

**Project Type**: Web application（Next.js 単一プロジェクト）

**Performance Goals**: 導入表示の縮小移動が 60fps を割らないこと。`transform` と `opacity` のみを
アニメーションさせ、`height` / `top` / `width` は動かさない

**Constraints**: 幅 375px で操作対象 44×44px 以上、HUD 内の通常文字は `#111111` 上で 7:1 以上・最小 12px、
定常状態の帯の合計が画面高の 15% 以下（SC-001。ただし後述 SPEC-2 の解釈が要る）

**Scale/Scope**: 対象は出題画面3つ（市区町村 A・市区町村 D・都道府県クイズ）。
新規ファイル 8、変更 7、DB マイグレーションなし

## Constitution Check

*GATE: Phase 0 research の前に通し、Phase 1 design のあとで再確認する。*

| 原則 | 判定 | 根拠 |
|---|---|---|
| I. セキュリティ & コンプライアンス | ✅ PASS | 新しい API キー・環境変数を導入しない。`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` の扱いは現行のまま。Next.js のバージョンも変えない |
| II. アーキテクチャ & パフォーマンス | ✅ PASS | Read/Write の経路を触らない。TopoJSON の読み込み方式も現行のまま。DB インデックスに影響なし |
| III. ロジック & UI（375px・ダーク） | ✅ PASS | 本機能の目的そのもの。背景は `#111111` 固定（FR-035）、基準幅は 375px |
| コーディング規約（Tailwind 優先） | ⚠️ 要対応 | 現行 `app/(app)/layout.tsx` は inline `style` で高さと padding を書いている。`AppShell` へ移す際に Tailwind ユーティリティへ寄せる |
| コーディング規約（複雑なグローバルストアを避ける） | ✅ PASS | 導入するのは boolean 1つの Context のみ。判断は下の Complexity Tracking に記録した |

**Post-Design 再確認（Phase 1 後）**: 判定に変更なし。data-model.md で定義した状態はすべて
既存コンポーネントのローカル state か boolean 1つの Context に収まり、新しいストアもデータ層の変更も生じない。

## Project Structure

### Documentation (this feature)

```text
specs/027-map-quiz-hud/
├── spec.md                    # 確定済み（PR #83 でマージ）
├── plan.md                    # 本ファイル
├── research.md                # Phase 0: 技術判断と却下した代替案
├── data-model.md              # Phase 1: 画面状態とレイアウト定数
├── quickstart.md              # Phase 1: 受け入れの手動検証手順
├── contracts/
│   └── hud-contract.md        # Phase 1: HUD の内部契約（Context・Props・CSS 変数）
├── checklists/
│   └── requirements.md        # 既存
└── tasks.md                   # Phase 2: /speckit-tasks が生成（本コマンドでは作らない）
```

### Source Code (repository root)

```text
app/(app)/
├── layout.tsx                          # 変更: AppShell で children を包む（server のまま）
├── app-shell.tsx                       # 新規: client。immersive Context と footer/BottomNav/padding の出し分け
├── bottom-nav.tsx                      # 変更なし
└── quiz/
    ├── prefecture/page.tsx             # 変更: playing フェーズを HUD 3段レイアウトへ
    └── municipality/[mode]/page.tsx    # 変更なし（QuizRunner 側で完結する）

components/quiz/
├── quiz-runner.tsx                     # 変更: HUD 3段レイアウトへ再構成
├── quiz-header.tsx                     # 削除: TopHud に統合
├── quiz-question-card.tsx              # 変更: 出題中は不使用（他画面での利用がなければ削除）
├── use-quiz-timer.ts                   # 変更: `armed` を受け取り、導入完了までカウントを始めない
├── use-quiz-state.ts                   # 変更なし（startTimeRef に触れない = FR-024）
├── views/mode-a-view.tsx               # 変更: 確定ボタンとバッジ列を BottomHud へ移す
└── hud/
    ├── top-hud.tsx                     # 新規: 中断・進捗・時間・ミュート
    ├── bottom-hud.tsx                  # 新規: 定常お題／確定／フィードバック／4択
    ├── question-intro.tsx              # 新規: 中央の導入オーバーレイ
    ├── use-question-intro.ts           # 新規: intro→settling→steady の進行と再表示
    └── feedback-line.tsx               # 新規: 白文字＋色付きアイコン（FR-037）

components/map/
├── JapanMap.tsx                        # 変更: ズームボタンを右側面・垂直中央へ（FR-033）
└── MunicipalityMap.tsx                 # 変更: zoomControlOptions を RIGHT_CENTER に（FR-033）

lib/
├── quiz/immersive-layout.ts            # 新規 pure: セッションがフルスクリーン対象かを判定
├── quiz/hud-metrics.ts                 # 新規 pure: 帯の高さと導入タイムラインの決定
└── hooks/usePrefersReducedMotion.ts    # 新規: matchMedia の購読

__tests__/
├── lib/quiz/immersive-layout.test.ts   # 新規
├── lib/quiz/hud-metrics.test.ts        # 新規
└── components/quiz/hud-layout.test.tsx # 新規（happy-dom）
```

**Structure Decision**: 既存の Next.js 単一プロジェクト構成をそのまま使う。新設は
`components/quiz/hud/`（HUD の表示コンポーネント群）と、テスト可能な判断を置く
`lib/quiz/immersive-layout.ts` / `lib/quiz/hud-metrics.ts` の2ファイルだけ。
`.agents/rules/testing.instructions.md` の「判断と I/O を分離する」に従い、
セッション種別の判定・帯の高さ・導入のタイムラインは pure 関数として `lib/` に置き、
`matchMedia` と `setTimeout` は呼び出し側の hook に残す。

## Spec に反映した差分

Phase 0 の調査でコードと spec の食い違いが2件、記述より軽く済む項目が1件見つかった。
いずれも spec.md へ**反映済み**（2026-09-06）。

| ID | 箇所 | 内容 | 対応 |
|---|---|---|---|
| SPEC-1 | US2 受け入れ4 | 「15秒の持ち時間」とあるが、実装は `components/quiz/use-quiz-timer.ts:6` の `TIME_LIMIT_SEC = 30` で **30秒**。要件（導入後に計測開始）は変わらず、数値だけが誤り | ✅ 30 秒に訂正 |
| SPEC-2 | SC-001 | 「375×812 で 122px 以下」がセーフエリアのインセットを含むか不明。帯のコンテンツ高は 44+52=96px だが、standalone PWA の iPhone X 系では上下のインセット計 78px が乗って 174px となり、中身を空にしても超過する | ✅ セーフエリアを除いた帯のコンテンツ高で判定すると明記（research D6） |
| SPEC-3 | FR-032・FR-040 表・FR-041 | 出典表記を「常設の情報ページへ移設」とあるが、現行 footer は `app/(app)/layout.tsx:22-27` にあり**出題中以外の全画面に出ている**。immersive のときだけ隠せば FR-041 は満たされ、新規ページは要らない | ✅ 「プレイ中のみ非表示。共通 footer に残す」へ変更。新規ページはスコープ外（research D7） |

## Complexity Tracking

> Constitution Check で justification が要る項目のみ

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| React Context を1つ追加（`AppShell` の immersive フラグ） | 枠を消す判断は出題コンポーネント（`QuizRunner` / 都道府県ページ）が持つが、消す対象（footer・`BottomNav`・`paddingBottom`）は祖先の layout にある。子から祖先へ状態を渡す経路が要る | **URL ステート**（憲法が推奨する第一候補）は却下。`?immersive=1` を出し入れすると history エントリが増え、`usePopstateGuard`（戻るボタンで中断させる既存の仕組み）と競合して中断が二重に走る。**CSS のみ**（`body[data-immersive]`）も却下。`BottomNav` を `display:none` にできても `main` の `paddingBottom: 6rem` と footer の DOM が残り、地図の高さ計算がずれる |

### Issue #90: タイマー更新中の地図タップ

`JapanMap` は `Geographies` 1.2.1 の描画関数変更による再マウントを避け、固定の子コンポーネント内で同ライブラリの `useGeographies` と `Geography` を使う。親更新・選択・正誤表示でもSVG pathの同一性を維持する。ドラッグ・ピンチ後の click 抑止は、遅延 click を最大1回破棄し、300ms で自動解除する。click が来ない端末では、続く非ドラッグタップの `pointerup` でも stale 抑止を解除する。遅延 click の誤回答を防ぎつつ、通常タップ・選択色・正誤表示の仕様を維持する。
