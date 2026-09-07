---

description: "Task list for 027 地図クイズのフルスクリーン HUD"
---

# Tasks: 地図クイズのフルスクリーン HUD（GeoGuessr風）

**Input**: Design documents from `specs/027-map-quiz-hud/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/hud-contract.md](./contracts/hud-contract.md)

**Tests**: 本機能は runtime の挙動を変えるため**テストは必須**。とくに FR-024（タイマー起点）は
SM-2 の定着間隔に静かに波及するため、既存の `__tests__/lib/quiz/answer-time.test.ts` を
回帰の見張りとして扱う。新規の回帰テストは `.agents/rules/testing.instructions.md` に従い、
**一度条件を反転させて実際に赤くなることを確認**してから採用する。

**Organization**: ユーザーストーリーごとにフェーズを切っている。US1 まで終われば
「地図が画面いっぱいになる」という Issue #82 の主目的は動く状態になる（MVP）。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並行実行可（別ファイル・未完了タスクへの依存なし）
- **[Story]**: 対応するユーザーストーリー（US1〜US4）
- パスはリポジトリルートからの相対

## Path Conventions

Next.js 単一プロジェクト。`app/` / `components/` / `lib/` / `__tests__/` がルート直下にある。

---

## Phase 1: Setup（計測の基準を取る）

**Purpose**: 変更前の値を先に記録する。あとから比較できなくなるものだけを扱う。

- [x] T001 変更前の地図描画面積を計測して `specs/027-map-quiz-hud/research.md` の D5 節末尾に追記する。`pnpm dev` → `/quiz/municipality/d` を 375×812 で開き、DevTools で `MunicipalityMap` のコンテナ div の実高（px）を記録する。SC-007（130% 以上）の分母になるので、この計測を飛ばすと受け入れ判定ができない
- [x] T002 [P] `pnpm test` を実行し `__tests__/lib/quiz/answer-time.test.ts` が緑であることを確認する。FR-024 / FR-050 の回帰基準として、以降このテストを赤くする変更を入れない

**Checkpoint**: 比較の基準が揃った

---

## Phase 2: Foundational（全ストーリーの前提・ブロッキング）

**Purpose**: 判断を担う pure 関数と、枠を出し分ける仕組み。ここが終わるまで US1〜US4 は着手できない

**⚠️ CRITICAL**: このフェーズが完了するまでユーザーストーリーの作業を始めない

### テストを先に書く（失敗することを確認する）

- [x] T003 [P] `__tests__/lib/quiz/immersive-layout.test.ts` を新規作成する。`sessionUsesImmersiveLayout` のケース表: A のみ / D のみ / B・C のみ / A と B の混在 / D と C の混在 / 空配列。**モジュール未実装で失敗すること**を確認する
- [x] T004 [P] `__tests__/lib/quiz/hud-metrics.test.ts` を新規作成する。`resolveIntroPlan(false)` が `mode:'motion'` / `holdMs:1000` / `transitionMs:320`、`resolveIntroPlan(true)` が `mode:'static'` / `holdMs:2500` / `transitionMs:0` / `enlargedBandPx:64` / `enlargedTextPx:24` を返すこと。`bottomBandHeightPx` の3分岐（feedback 時 72 / mode A 52 / それ以外 44）と、**feedback 時はモードによらず同値**（SC-008）であること

### 実装

- [x] T005 [P] `lib/quiz/immersive-layout.ts` に `sessionUsesImmersiveLayout(questions: readonly Question[]): boolean` を実装する。判定条件は `kind === 'A'` または `kind === 'BCD' && mode === 'D'` を1問以上含むこと。**引数に `modeDFailed` / `currentQuestion` / `qIdx` を取らない**（research D2。取ると FR-004 / FR-005 が壊れる）
- [x] T006 [P] `lib/quiz/hud-metrics.ts` に data-model.md 4節の定数（`TOP_BAND_PX`=44、`BOTTOM_BAND_PX`=44、`BOTTOM_BAND_MODE_A_PX`=52、`BOTTOM_BAND_FEEDBACK_PX`=72（暫定）、`INTRO_TEXT_PX`=34、`STEADY_TEXT_PX`=16、`MIN_TEXT_PX`=12）と `resolveIntroPlan` / `bottomBandHeightPx` を実装する
- [x] T007 T003・T004 の各テストについて、実装側の条件を1つずつ一時的に反転させて**実際に赤くなることを確認**し、確認後に復元して再実行する（`.agents/rules/testing.instructions.md` の MUST）
- [x] T008 [P] `lib/hooks/usePrefersReducedMotion.ts` を新規作成する。`window.matchMedia('(prefers-reduced-motion: reduce)')` を購読し、`change` で追随する。SSR 安全に初期値 `false` から始める
- [x] T009 `app/(app)/app-shell.tsx` を新規作成する（`'use client'`）。immersive の boolean Context と `useImmersiveLayout(active: boolean)` を公開し、`active` のとき出典 `<footer>`・`<BottomNav />` を描画せず、`<main>` の `paddingBottom` を `0`・`overflowY` を `hidden` にする。`useImmersiveLayout` は effect の cleanup で必ず `false` に戻す（contracts C1）
- [x] T010 `app/(app)/layout.tsx` を変更し、`children` を `<AppShell>` で包む。server component のまま（`getCurrentUserId()` の await を残す）。あわせて現行の inline `style`（`height:100dvh` / `flex:1` / `paddingBottom:6rem`）を Tailwind ユーティリティへ移す（Constitution「Tailwind 優先」）

**Checkpoint**: 枠の出し分けが呼べる状態。ここから US1〜US4 が着手可能

---

## Phase 3: User Story 1 - 地図を画面いっぱいに使って解く (Priority: P1) 🎯 MVP

**Goal**: 出題中はヘッダーとボトムナビが消え、画面が「上端の帯 / 地図 / 下端の帯」の3段だけになる

**Independent Test**: 対象クイズを開始し、上端・下端の帯以外に地図以外の常時表示がなく、ヘッダーとボトムナビが見えないこと

### テスト

- [x] T011 [P] [US1] `__tests__/components/quiz/hud-layout.test.tsx` を新規作成する（先頭に `// @vitest-environment happy-dom`）。`@testing-library` は未導入なので、`__tests__/components/map/autofocus-integration.test.tsx` と同じく `react-dom/client` の `createRoot` + `act` で描画する。ケース: immersive のとき `BottomNav` と出典 footer が DOM に無い / 非 immersive のとき両方ある。**実装前に失敗すること**を確認する

### 実装

- [x] T012 [US1] `components/quiz/hud/top-hud.tsx` を新規作成する。contracts C3 の Props に従い、中断・進捗（N/M）・`timer`・ミュートを 44px の帯に並べる。`timer` が `undefined` のとき**時間表示の領域を確保しない**（FR-013）。`padding-top: env(safe-area-inset-top)` を持つ。ミュートは既存 `components/quiz/mute-toggle.tsx` を使う。**正解数と難易度バッジを props に足さない**（FR-040 で廃止）
- [x] T013 [US1] `components/quiz/hud/bottom-hud.tsx` を新規作成する。この段階では `kind: 'prompt'`（定常のお題 1行 16px）と `kind: 'error'`（地図読み込み失敗の1行）だけを実装する。高さは `bottomBandHeightPx()` のみで決まり、内容で伸縮しない。`padding-bottom: env(safe-area-inset-bottom)` を持つ。背景は `#111111` の完全不透明で、`bg-*/NN`・`backdrop-blur`・`bg-gradient-*` を使わない（FR-035）
- [x] T014 [US1] `components/quiz/quiz-runner.tsx` を contracts C2 の3段骨格へ再構成する。`useImmersiveLayout(sessionUsesImmersiveLayout(questions))` を呼び、地図コンテナは `flex-1 min-h-0` にして高さを固定値で計算しない（FR-032 / FR-034 が副作用で満たされる）。帯と地図の間に `gap` を置かない
- [x] T015 [US1] `components/quiz/views/mode-a-view.tsx` から確定ボタンと選択中バッジ列（現 70-84 行）を取り除き、`BottomHud` の `submit` と `selectedCount` へ移す。ボタンのラベルは「あと N か所選択」→「解答する」に統合し、お題側の「N か所あります」「あと N か所」表示（`quiz-runner.tsx` の `subTitle` / `extraPrompt`）を廃止する（FR-028 / FR-040）
- [x] T016 [US1] `app/(app)/quiz/prefecture/page.tsx` の playing フェーズを3段骨格へ書き換える。`useImmersiveLayout(phase === 'playing')` を呼び、現行の「中断して設定に戻る」リンク・進捗・経過タイム・ミュートを `TopHud`（`timer: { kind: 'elapsed', elapsedMs }`）へ、お題カードを `BottomHud` へ移す。**`startTimeRef` と `performance.now()` の起点には触れない**（FR-024）
- [x] T017 [P] [US1] `components/map/JapanMap.tsx` のズームコントロール（224 行付近）を `absolute top-2 right-2` から `absolute right-2 top-1/2 -translate-y-1/2` へ移し、ボタンを `w-9 h-9` から `w-11 h-11`（44px）へ広げる（FR-033 / SC-002）
- [x] T018 [P] [US1] `components/map/MunicipalityMap.tsx` の `new maps.Map(...)` オプションに `zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_CENTER }` を追加する（FR-033）
- [ ] T019 ~~`components/quiz/quiz-header.tsx` を削除する~~ **N/A**: 4択のみのセッションは現行レイアウトのまま残す方針（FR-006）なので、`QuizHeader` と `QuizQuestionCard` はその経路で引き続き使う。出題中の HUD からは正解数と難易度バッジを落とし済み（T014 に含む）
- [x] T020 [US1] SC-007 を検証する。`/quiz/municipality/d` を 375×812 で開き、地図コンテナの実高が T001 の記録比 **130% 以上**であることを確認して research.md D5 に追記する → **達成**: 375×724 = 271,500 px²、ベースライン 167,603 px² 比 **162%**

### 全国 SVG 地図のフレーミング（B026 の取り込み）

- [x] T020a [US1] `lib/map/japan-projection.ts` に投影定数を集約する（viewBox 400×532、center [136.72, 36.44]、scale 1221）。枠は47都道府県の本体ポリゴンの外形が収まる最小範囲とする
- [x] T020b [US1] `components/map/JapanMap.tsx` の `ComposableMap` と `lib/map/autofocus-bounds.ts` の既定値を、どちらもこの定数から取るようにする。片方だけ変えると自動フォーカスが描画とずれる
- [x] T020c [P] [US1] `__tests__/lib/map/japan-projection.test.ts` を新規作成する。本体の外形 bbox の四隅が viewBox に収まること、外形が viewBox の 9 割以上を占めることを固定する。3つの変異で赤くなることを確認済み
- [x] T020d [US1] 県当てで地図面積と全県の可視性を実測する → **達成**: 375×499 = 187,125 px²、変更前 124,605 px² 比 **150%**。47県すべての本体が可視。不正解後の自動フォーカスが動作することも確認
- [ ] T020e `components/map/MiniJapanMap.tsx` は旧フレーミング（400×500 / center [138,35] / scale 1000）のまま。**N/A**: モード選択ページの装飾用サムネイルで出題画面ではなく、`showZoomFrame` が投影依存の座標を持つ可能性があるためスコープ外とする

**Checkpoint**: 3画面がフルスクリーン枠で動く。US1 は単独で検証可能

---

## Phase 4: User Story 2 - お題は最初だけ大きく、あとは端で小さく (Priority: P1)

**Goal**: 出題直後にお題が中央へ大きく出て約1秒で下端の1行へ縮小移動し、下端タップで再表示できる

**Independent Test**: 出題すると中央に大きくお題が出て 1 秒ほどで下端の小さな表示に変わり、下端タップで再び中央に大きく出ること。定常状態で上下の帯の合計が画面高の 15% 以下（セーフエリアを除くコンテンツ高）に収まっていること

### テスト

- [x] T021 [P] [US2] `__tests__/components/quiz/question-intro.test.tsx` を新規作成する（happy-dom + `vi.useFakeTimers()`）。ケース: `qIdx` 変化で `intro` に入る / `holdMs` 経過で `settling` / さらに `transitionMs` で `steady` / 再表示要求で `intro` へ戻る / reduced motion のとき `intro` を経ず `steady` から始まる。**実装前に失敗すること**を確認する

### 実装

- [x] T022 [US2] `components/quiz/hud/use-question-intro.ts` を新規作成する。`qIdx` と `usePrefersReducedMotion()` を入力に `'intro' | 'settling' | 'steady'` を進める。タイムラインは `resolveIntroPlan()` から取り、hook 側には `setTimeout` だけを残す（判断は pure 関数側。testing rules）。あわせて「その `qIdx` で導入が**初回**完了したか」のラッチを返す
- [x] T023 [US2] `components/quiz/hud/question-intro.tsx` を新規作成する。3段骨格の**兄弟**として絶対配置し（地図コンテナの中に入れない）、`transform: translateY() scale()` と `opacity` のみを遷移させる。`height` / `top` / `width` はアニメーションさせない（Performance Goals）。文字は `INTRO_TEXT_PX`（34px）
- [x] T024 [US2] `BottomHud` に `onRequestIntro` を追加し、帯タップで導入表示を再現できるようにする。再表示できることを示す拡大アイコンを `kind: 'prompt'` のとき添える。`submit` ボタンと4択ボタンの上ではタップを発火させない（FR-022 / contracts C4）
- [x] T025 [US2] reduced motion 分岐を実装する。`resolveIntroPlan(true)` のとき中央オーバーレイを描画せず、最初の 2500ms だけ下端の帯を 64px・文字を 24px にしてから通常サイズへ戻す。サイズ変更に transition を付けない（FR-023 / SC-011）
- [x] T026 [US2] `components/quiz/use-quiz-timer.ts` に `armed: boolean` を追加し、`armed === false` の間はインターバルを張らないようにする（`timeLeft` は `TIME_LIMIT_SEC` のまま）。**`components/quiz/use-quiz-state.ts` の `startTimeRef` には触れない**（contracts C5 / FR-024）
- [x] T027 [US2] `quiz-runner.tsx` で T022 のラッチを `useQuizTimer` の `armed` に渡す。**下端タップによる再表示で `armed` を `false` に戻さない**（戻すと読み返すたびに持ち時間が延び、事実上の無制限になる）
- [x] T028 [P] [US2] `components/quiz/hud/feedback-line.tsx` を新規作成する。文字は `#fafafa` に統一し、正解は `#22c55e` の塗り丸＋チェック、不正解は `#ef4444` の塗り丸＋× のアイコンで示す。**文字色に `#22c55e` / `#ef4444` / `#4a7c59` を使わない**（FR-037 / FR-038）（**T013 と同時に実施済み**。フィードバック表示を欠いた中間状態を作らないため）
- [x] T029 [US2] `BottomHud` に `kind: 'feedback'` を追加する。`detail` は `lib/quiz/feedback-labels.ts` の出力をそのまま渡してよみがなを落とさない（FR-026）。高さは `BOTTOM_BAND_FEEDBACK_PX` 固定で、正解・不正解・文言の長短で変わらない（FR-027 / SC-008）
- [x] T030 [US2] `pnpm test` を実行し `__tests__/lib/quiz/answer-time.test.ts` が**緑のまま**であることを確認する。赤い場合は FR-024 / FR-050 を破っているので T026・T027 を見直す → **緑のまま**（322 passed）

**Checkpoint**: 導入表示とタイマー分離が動く。US1 + US2 で spec の P1 が揃う

---

## Phase 5: User Story 3 - 中断・完了後は通常の枠に戻る (Priority: P2)

**Goal**: 中断は誤操作で起きず、中断・完了のどちらでもフルスクリーン枠が解けて通常レイアウトへ戻る

**Independent Test**: 出題中に中断、および全問終了のそれぞれでフルスクリーンが解け、ナビまたは結果画面に戻れること。中断は1タップでは離脱しないこと

### テスト

- [x] T031 [P] [US3] `__tests__/components/quiz/hud-layout.test.tsx` にケースを追加する。immersive を要求したコンポーネントが unmount したとき、`BottomNav` と出典 footer が復帰すること（contracts C1 の cleanup 契約）。**実装前に失敗すること**を確認する

### 実装

- [x] T032 [US3] `components/quiz/hud/top-hud.tsx` の中断に確認を1段挟む。`components/ui/` に AlertDialog は無かったが、`components/ui/sheet.tsx` が使っている Base UI（`@base-ui/react`）に `alert-dialog` があったため、依存を増やさずそれを直接使った（`components/quiz/hud/abort-confirm.tsx`）。タップ領域を 44×44px 以上にする。1タップで `onAbort` を呼ばない（FR-014）。取り消したときはセッションを中断せず出題へ戻る
- [x] T033 [US3] 中断・全問終了・エラー境界のいずれで抜けても immersive が `false` へ戻ることを確認する。`app/(app)/quiz/municipality/[mode]/page.tsx` の `handleExitToSetup` / `onComplete`、`app/(app)/quiz/prefecture/page.tsx` の `setPhase('setup')` / `setPhase('result')`、および `lib/hooks/usePopstateGuard.ts` 経由の戻るボタンの4経路すべてで実機確認する（FR-007）

  実測（375×812）: 都道府県の中断・戻る、市区町村モード A の中断の3経路で、`nav` と出典 footer が
  消えて `main` が `overflow-hidden` になり、抜けたあと `overflow-y-auto pb-24` と両者が戻ることを
  確認した。結果画面の経路は setup と同じ早期 return なので、`hud-layout.test.tsx` の unmount /
  `false` 切替の2ケースで代替している。

**Checkpoint**: 出口が塞がらない。US3 完了

---

## Phase 6: User Story 4 - 復習セッションでも画面構成が変わらない (Priority: P2)

**Goal**: A・B・C・D が混在する復習セッションで、途中で枠組みが切り替わらない

**Independent Test**: A と B/C と D を含む復習セッションを最初から最後まで通し、ヘッダー／ボトムナビの表示状態が一度も変わらないこと

### 実装

- [x] T034 [US4] 復習セッション中の4択を下端 HUD の領域に表示する（FR-029）。

  `content` のバリアント（`kind: 'choices'`）にはしていない。C4 は同時に
  「高さは `bottomBandHeightPx` の戻り値のみで決まる」とも定めており、44〜52px の行に
  選択肢4つは入らないため、この2つは両立しない。FR-029 は「下端 HUD の**領域**に表示する」
  なので、`BottomHud` が `choices` を別の領域として受け取り、お題の行の直上に積む形にした。
  これで下端 HUD の内側という要件と、お題の行の高さ不変（FR-027 / SC-008）が両立する。
  C4 の記述もこれに合わせて修正した。
  回帰テスト: `__tests__/components/quiz/review-session-frame.test.tsx`
- [x] T035 [US4] `app/(app)/quiz/review/page.tsx` を通しで検証する。ローカルスタックの Studio（http://127.0.0.1:54323）で `srs_records` の `due_date` を過去日にして A・B/C・D が混ざるバッチを作り、セッション全体で枠が一度も変わらないことを確認する（SC-009）。**本番 DB では絶対に行わない**（Preview は本番 Supabase を共有する）

  実測（375×812 / ローカルスタック）: `test@example.com` は B しか持たず4択のみのセッションに
  なるため、ローカル DB にだけ A・D の due 行を足して 18 問の混在セッションを作った（確認後に削除）。
  q1〜q5（4択）→ q6（A・全国地図）→ q7〜q10（4択）→ q11（D・カウントダウンあり）と種類が変わっても、
  `nav` 非表示・出典 footer 非表示・`main` が `overflow-hidden`・上端 header と下端 band ありの
  5点が一度も変化しなかった。
  なお B のみのセッションが通常レイアウトで出るのは FR-006 どおりの正しい挙動である。
- [x] T036 [US4] モード D の地図読み込みに失敗させて4択へフォールバックさせ、**枠が維持される**ことを確認する（FR-005）。

  API キーを不正な値にする手は採らなかった。ローカルでは `gm_authFailure` がそもそも発火せず
  再現できないうえ、キーの差し戻し忘れが事故になる。代わりに `modeDFailed` を立てた状態を
  `__tests__/components/quiz/review-session-frame.test.tsx` で固定し、枠の5点が地図表示時と
  一致すること・4択と失敗の告知が出ることを回帰テストにした

**Checkpoint**: 4ストーリーすべて完了

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 実測で確定させる値と、横断的な受け入れ確認

- [ ] T037 `BOTTOM_BAND_FEEDBACK_PX` の暫定値 72px を実測で確定する。`lib/quiz/feedback-labels.ts` の最長形（`大和町 （正解: 宮城県: たいわちょう / 神奈川県: やまとまち）`）を 375px 幅で描画し、折り返した実高に合わせて `lib/quiz/hud-metrics.ts` の定数と `__tests__/lib/quiz/hud-metrics.test.ts` の期待値を更新する（research D11）
- [x] T037b **SC-012（Google ロゴが帯の直上に可視）は Preview デプロイで検証する。** ローカルの
  `127.0.0.1:3000` では Maps API キーの referrer 制限を通らず、地図が `StaticMapService.Get` の
  静止画フォールバックで描画される。この状態ではロゴ・帰属表示・ズームコントロールがそもそも
  出ないため、可視性を確認できない。PR の Preview URL で確認すること

  PR #89 の Preview URL で確認済み。ロゴと帰属表示が帯の直上に可視で残っていることを確認した。
- [x] T038 モード D で不正解 → 自動フォーカスが働く際、帯の高さが変わったあとに Google Maps がビューポートサイズへ追随しているかを確認する。追随していなければ `components/map/MunicipalityMap.tsx` の `fitBounds` の前に `google.maps.event.trigger(map, 'resize')` を挟む（research D8 / FR-034）

  PR #89 の Preview URL で確認済み。帯の高さが変わったあとも正解地点が帯に隠れず、地図が追随していた。
  `google.maps.event.trigger(map, 'resize')` の追加は不要と判断した。
- [ ] T039 [P] セーフエリアを検証する。DevTools のデバイスツールバーで iPhone 系の端末をエミュレートし、上端・下端の HUD がノッチ／ホームインジケータと重なって押せなくならないことを確認する（Edge Cases）
- [ ] T040 [P] アクセシビリティを検証する。HUD 内の通常文字が `#111111` 上で 7:1 以上・最小 12px 以上（SC-013）、操作対象が 44×44px 以上（SC-002）、DevTools の *Emulate vision deficiencies* → Achromatopsia で正否がアイコンの形だけでも判別できること（FR-037）
- [ ] T041 [P] SC-001 を検証する。定常状態で上端＋下端の帯のコンテンツ高（セーフエリアのインセットを除く）が画面高の 15% 以下、375×812 で 122px 以下であること
- [ ] T042 [P] FR-041 を検証する。出題中は出典 footer が見えず、中断して `/quiz` や `/`・分析画面へ戻ると出典 footer が見えていること
- [ ] T043 [quickstart.md](./quickstart.md) の S1〜S9 を通しで実施する
- [ ] T044 `pnpm type-check` / `pnpm lint:ratchet` / `pnpm test` / `pnpm audit:dead-code` を実行し、いずれも通ることを確認する

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup（Phase 1）**: 依存なし。ただし T001 は**コード変更前に**実施する（変更後は測れない）
- **Foundational（Phase 2）**: Setup 完了後。**全ユーザーストーリーをブロックする**
- **US1（Phase 3）**: Foundational 完了後
- **US2（Phase 4）**: **US1 に依存**。3段骨格と `BottomHud` の土台の上に導入表示を載せるため
- **US3（Phase 5）**: US1 に依存（`TopHud` の中断を触る）。US2 とは独立
- **US4（Phase 6）**: US1 に依存（`BottomHud` に `kind` を足す）。US2 とは独立
- **Polish（Phase 7）**: 全ストーリー完了後。ただし T037 は US2 完了後に単独で先行可

```
Setup ──▶ Foundational ──▶ US1 ──┬──▶ US2 ──┐
                                  ├──▶ US3 ──┼──▶ Polish
                                  └──▶ US4 ──┘
```

### Within Each User Story

- テストを先に書き、実装前に失敗することを確認する
- pure 関数 → hook → 表示コンポーネント → 画面への組み込み の順
- ストーリーを終えてから次の優先度へ進む

### Parallel Opportunities

- **Phase 1**: T002 は T001 と並行可
- **Phase 2**: T003・T004 が並行可。続いて T005・T006・T008 が並行可（T009 → T010 は直列）
- **Phase 3**: T017・T018 は地図コンポーネント2つを別々に触るので並行可。T011 は他と独立
- **Phase 4**: T021 と T028 は他と独立
- **Phase 7**: T039〜T042 はすべて並行可
- US3 と US4 は US1 完了後、担当を分ければ並行可（US2 とも独立）

---

## Parallel Example: Phase 2 Foundational

```bash
# まずテストを2本同時に書く（どちらも失敗する）
Task: "__tests__/lib/quiz/immersive-layout.test.ts のケース表を書く"
Task: "__tests__/lib/quiz/hud-metrics.test.ts のケース表を書く"

# 次に実装を3本同時に
Task: "lib/quiz/immersive-layout.ts の sessionUsesImmersiveLayout"
Task: "lib/quiz/hud-metrics.ts の定数と resolveIntroPlan / bottomBandHeightPx"
Task: "lib/hooks/usePrefersReducedMotion.ts"
```

---

## Implementation Strategy

### MVP First（US1 まで）

1. Phase 1: Setup（T001 の計測を忘れない）
2. Phase 2: Foundational（**ここが全体のブロッカー**）
3. Phase 3: US1
4. **STOP して検証**: quickstart の S1 と SC-007 を通す
5. この時点で Issue #82 の主目的「地図が狭い」は場所当て（D）で解消している

### Incremental Delivery

1. Setup + Foundational → 枠の出し分けが呼べる
2. US1 → 3画面がフルスクリーンに（MVP・デモ可）
3. US2 → お題の導入表示とタイマー分離（P1 完了）
4. US3 / US4 → 出口の安全性と復習セッションの一貫性
5. Polish → 実測値の確定と受け入れ確認

### 後続との関係

**B026（全国 SVG 地図の縦画面最適化）を続けて実施する前提**。本 spec だけでは、
県当て（A）と都道府県クイズは全国 SVG 地図の縦横比が固定のため地図面積が増えない
（帯の位置に余白が来るだけ）。B026 を落とすと Issue #82 の動機が3画面のうち2つで満たされない。

---

## Notes

- [P] タスク = 別ファイル・依存なし
- 各タスクはコミット単位にしてよい。指摘1件＝1コミットの粒度に合わせる
- **絶対に触らないもの**: `components/quiz/use-quiz-state.ts` の `startTimeRef`、
  `app/(app)/quiz/prefecture/page.tsx` の `performance.now()` 起点、
  `lib/quiz/srs/` 配下、DB スキーマ、Server Actions
- **Preview は本番 Supabase を共有する**。検証用のデータ投入はローカルスタックのみで行う
