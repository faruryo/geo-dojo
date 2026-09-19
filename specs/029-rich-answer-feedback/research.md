# Phase 0 Research: クイズ解答時のリッチフィードバック演出と補足情報表示

**Feature**: `029-rich-answer-feedback`  
**Date**: 2026-09-20  
**Status**: Complete  

---

## 調査・設計トピック一覧

- **D1: 市区町村人口の解決・政令市区合算アルゴリズム (US1)**
- **D2: HUD経路フローティングカードの配置・レイアウト・z-index (US1)**
- **D3: `BottomHud` の idle 高さ完全固定と 027 契約改定 (US1/US2)**
- **D4: 進行制御・スキップ・誤タップガード (US2)**
- **D5: 和音 SE・ファンファーレ Web Audio 実装 (US3)**
- **D6: CSS 紙吹雪アニメーション・パルス演出・アクセシビリティ (US3)**

---

## D1: 市区町村人口の解決・政令市区合算アルゴリズム (US1)

### 背景・課題
- `municipality_master` テーブルにはすでに `population` 列（integer）が存在し、国勢調査データが投入されている。
- `app/(app)/quiz/municipality/actions.ts` の `getMunicipalityMaster()` は `select().from(municipalityMaster)` で全列を取得しているが、クライアント側のページ（`[mode]/page.tsx` および `review/page.tsx`）で `Municipality` 型へマッピングする際に `population` を落としている。
- モードB・CおよびモードAでは、政令指定都市は親市名（例: 「大阪市」「静岡市」）で出題され、出題候補データとしては区ごとにレコードが存在する。このため、市全体の人口を表示するには所属区の人口を合算する必要がある。
- 一方、モードDは5桁コード単位（政令市の場合は当該区そのもの）の出題であるため、合算せず当該区の人口を表示しなければならない（FR-002b）。
- モードAの同名異県（例: 伊達市＝北海道・福島県、池田町＝北海道・福井県・長野県・岐阜県）では、合算せず各県の人口・読み仮名を併記する必要がある（FR-002c）。

### 決定事項 (Decision)
1. **型拡張**:
   - `lib/quiz/municipality-data.ts` の `Municipality` インターフェースに `population?: number` を追加する。
   - `[mode]/page.tsx` と `review/page.tsx` の `masterData.map(...)` に `population: m.population ?? undefined` を追加する。
2. **政令市人口合算マップの純粋関数化 (`lib/quiz/municipality-population.ts`)**:
   - `buildDesignatedCityPopulationMap(municipalities: readonly Municipality[]): Map<string, number | null>`
   - 同一都道府県内で同一名称を持ち、2つ以上の区（コード末尾や行政区構造）を持つ政令市をグループ化。
   - グループ内の全区の `population` を合計する。
   - **欠損防御 (FR-002a)**: 所属区のいずれか1つでも `population == null || population <= 0` の場合は、不完全な合算値を避けるため市全体の合算結果を `null` とする。
3. **出題対象人口の導出ロジック (`resolveFeedbackPopulation`)**:
   - 入力: `question: Question`, `designatedCityMap: Map<string, number | null>`
   - Mode D の場合: `question.municipality.population ?? null`（区単位の人口）
   - Mode B/C の場合: 政令市合算マップに存在すればその値（`null` の場合は非表示）、存在しなければ `question.municipality.population ?? null`
   - Mode A の場合: 各県インスタンスごとに上記を適用（政令市なら合算、一般市町村なら個別）。合算せず県別内訳として配列で保持。
4. **人口フォーマット関数 (`formatPopulation(pop: number): string`) (FR-002d)**:
   - `pop >= 10_000`: `(pop / 10_000).toFixed(1)` で小数第2位を四捨五入し、`約${val}万人` とする（100万人以上も同一基準、例: `約377.7万人`）。
   - `pop < 10_000`: `Math.round(pop).toLocaleString()` で1の位までカンマ区切りにし、`約${val}人` とする（例: `約6,320人`）。

### 代替案の検討 (Alternatives Considered)
- **DB側でビューや合算カラムを新設する**:
  - 却下理由: `municipality_master` は全件でも1,700件程度であり、ブラウザメモリ上で O(N)（数ミリ秒未満）で容易に集計可能。DBマイグレーションやキャッシュ無効化リスクを避けるためフロントエンドの純粋関数で解決する。

---

## D2: HUD経路フローティングカードの配置・レイアウト・z-index (US1)

### 背景・課題
- モバイル 375px 画面において、上部HUD（`TopHud` 44px）と下部HUD（`BottomHud` 通常44px / Mode A 52px）の間のステージ領域（地図面）に、解答結果と補足情報を表示する必要がある。
- 地図の中心位置や視認性を過度に妨げず、かつタップしやすい位置とサイズが求められる。
- 最多4県（池田町: 北海道、福井県、長野県、岐阜県）の同名多県ケースでも、スクロールバーを出さずに最大高さ 112px 以内に収める必要がある。

### 決定事項 (Decision)
1. **配置と階層**:
   - `Stage`（`relative min-h-0 flex-1`）内の上部中央に `absolute top-2 left-1/2 -translate-x-1/2 z-20` で配置。
   - `pointer-events: auto` を設定し、カード自体のタップで即時スキップ可能とする。
2. **スタイルと寸法**:
   - 幅: `w-[calc(100%-32px)] max-w-[340px]`（375px幅で左右17.5pxマージン）。
   - 背景: `bg-[#111111]`（不透明、境界は `border border-white/10 rounded-xl shadow-lg`）。
   - 高さ: 通常時約 68px、最大高さ `max-h-[112px]`。
   - 内部パディング: 通常時は `p-2.5`、4県併記時は `p-2`。
3. **多県表示レイアウト (池田町4県対応)**:
   - 1行目: 正否バッジ + 称賛/不正解ラベル + 連続正解チップ（または代表難易度）。
   - 2行目以降（グリッドまたは2列コンパクト表示）:
     - 4県ある場合、2×2グリッド（各セル: `北海道 (いけだ) 約0.6万人`）またはコンパクト行で配置し、文字サイズ `text-[11px]` で 112px 内にスクロールなしで完全に収める。
4. **カード経路（4択単独セッション）との分離**:
   - 地図を使わない4択単独セッション（モードB/C）では、既存の `QuizQuestionCard` 内の `feedbackDetail` に人口情報を追加し、バウンス演出を適用する（HUDフローティングカードは表示しない）。

---

## D3: `BottomHud` の idle 高さ完全固定と 027 契約改定 (US1/US2)

### 背景・課題
- `specs/027-map-quiz-hud` では、下部帯が 44px/52px から 56px（`BOTTOM_BAND_FEEDBACK_PX`）に伸長する設計となっていた。
- しかし実機プロトタイプ検証の結果、上下に同一の自治体名が重複表示され、帯の数ピクセルの伸び縮みによって地図コンテナのリサイズと自動フォーカス矩形のズレが発生することが確認された。
- 下部帯をお題据え置きとし、答えと補足情報をフローティングカードに集約することで、帯の高さを完全固定できることが判明した。

### 決定事項 (Decision)
1. **定数と関数の改定 (`lib/quiz/hud-metrics.ts`)**:
   - `BOTTOM_BAND_FEEDBACK_PX`（56px）を廃止。
   - `bottomBandHeightPx(mode: HudQuestionMode, feedback: HudFeedbackState): number` は、`feedback` 引数に関わらず常に `mode === 'A' ? BOTTOM_BAND_MODE_A_PX : BOTTOM_BAND_PX`（52px または 44px）を返すよう改修する。解答前後で地図コンテナの変動は完全 0px となる。
2. **`BottomHud` の描画内容据え置き**:
   - HUD経路（`modeAContent`, `singleContent`）では、`feedback !== 'idle'` の場合でも `kind: 'prompt'` を返し続ける。
   - 出題中のお題（例: 「池田町」「館山市」「千葉県」）を表示したままにする。
3. **スキップヒントとタップ状態遷移 (FR-004a)**:
   - 出題中（回答受付中）: 帯タップでお題再表示（`onRequestIntro`）。
   - 解答フィードバック中: 帯タップで次問への即時スキップ（`onSkip`）。
   - フィードバック中は帯の右端に控えめなスキップヒント（例: `[タップで次へ]`、PCでは `[Spaceで次へ]`）を表示。

---

## D4: 進行制御・スキップ・誤タップガード (US2)

### 背景・課題
- 補足情報をじっくり読みたいユーザーと、テンポよく反復したいユーザーの双方が快適に学習できる必要がある。
- 地図のパン・ズームやHUDボタン操作で誤ってスキップしてはならない。
- 保存Server Action通信中にスキップが押された場合に取りこぼし（スタック）が発生してはならない。
- Spaceキー長押しによる連続スキップ誤爆や、次問切り替え直後の連打による次問誤答を防ぐ必要がある。

### 決定事項 (Decision)
1. **スキップトリガー**:
   - 有効なスキップトリガー:
     1. `BottomHud` 領域のタップ（背景またはスキップボタン）
     2. 上部フローティングカード本体のタップ
     3. キーボードの Space または Enter キー
   - スキップから除外する操作:
     - 地図ステージ領域（カード外）のドラッグ・パン・ピンチズーム
     - `TopHud` 内の操作ボタン（離脱、ミュート）
2. **非同期保存との調停 (`use-quiz-actions.ts`) (FR-004b)**:
   - `skipRequestedRef` を新設。
   - ユーザーがスキップを入力した時点で:
     - 保存Server Actionが実行中（通信中）の場合: `skipRequestedRef.current = true` をセット。保存完了コールバックで `skipRequestedRef.current === true` ならば待機時間ゼロで即座に `advanceQuestion` を呼び出す。
     - 保存が既に完了し 2.0s タイマー待ち中の場合: `clearTimeout(advanceTimerRef.current)` を行い、即座に `advanceQuestion` を呼び出す。
3. **キーリピート抑止 (FR-004c)**:
   - `event.repeat === true` のキーダウンイベントをスキップ処理から除外する。一度キーを離す（keyup）まで次のスキップは発火しない。
4. **誤タップガード 250ms (FR-004d)**:
   - `guardUntilRef` を新設。
   - `advanceQuestion` が呼ばれて問題インデックスが切り替わった瞬間に `guardUntilRef.current = Date.now() + 250` をセット。
   - 各回答アクション（`handleModeASubmit`, `handleChoice`, `handleDTap`）の冒頭で `Date.now() < guardUntilRef.current` の場合は即時 return して回答を破棄する。
5. **自動遷移待機時間 (FR-004e)**:
   - スキップ操作が行われない場合、全モード一律で保存完了後 **2.0秒（2,000ms）** 経過で次問へ自動遷移する（従来の 1,200ms / 1,500ms から統一）。

---

## D5: 和音 SE・ファンファーレ Web Audio 実装 (US3)

### 背景・課題
- 現行の正解SEは単音の「ピピッ」（Oscillator 2音: 659.25Hz → 880Hz）。
- 連続正解時の達成感を高めるため、心地よいメジャーコード調和音（0.35秒以内）へ刷新し、1〜4問目でピッチを段階的に上昇させ、5連続達成時にファンファーレ和音を鳴らす必要がある。
- Web Audio APIのオシレータ合成により、外部音声ファイル読み込みなしで超軽量・遅延ゼロで実現する。

### 決定事項 (Decision)
1. **連続正解数（Streak）の算出 (FR-005d)**:
   - `calculateStreak(results: readonly QuizResultEntry[]): number`
   - `results` の末尾から連続して `correct === true` である件数を純粋関数で算出。
   - 不正解、タイムアウト（Mode D）、セッション開始、中断再開時は 0 となる。
   - Mode A の同名異県も `toQuestionResult` により1問1件に正規化されているため安全。
2. **和音合成の音響設計 (`lib/quiz/sound-effects.ts`) (FR-005a/b/c)**:
   - **通常正解（1〜4問目）**:
     - 基本コード: C6メジャーコード（C6: 1046.5Hz, E6: 1318.5Hz, G6: 1568.0Hz）調。
     - 持続時間: 0.28秒。
     - ピッチシフト: `streak`（1〜4）に応じて全音（2半音 = `Math.pow(2, 2/12)`）ずつ周波数を上昇。
     - トーン波形: `sine` またはソフトな `triangle`、エンベロープでアタック 0.01s、ディケイ 0.27s。
   - **ファンファーレ（5連続達成時のみ）**:
     - アルペジオ＋コード展開（例: 根音・第3音・第5音・第8音）でオクターブ上のトーンを加えた華やかな構成。
     - 合計時間: 0.34秒（0.35s 以内を厳守）。
   - **6連続以降**:
     - 4段階目の最高音程の和音SEを維持（ファンファーレは鳴らさない）。
3. **不正解音・ミュート**:
   - 不正解音は従来のトライアングル低音（ブブー）を維持。
   - `isSoundMuted()` が真の場合は一切オシレータを起動しない。

---

## D6: CSS 紙吹雪アニメーション・パルス演出・アクセシビリティ (US3)

### 背景・課題
- 5連続正解時に視覚的な祝福感を与える紙吹雪演出が必要。
- モバイル端末（375px）で 50ms 超のロングタスク（フレーム落ち）を起こさない軽量な実装が必須（外部ライブラリ `canvas-confetti` 等はバンドル増加・オーバーヘッドがあるため不採用）。
- 正解ポリゴンの発光（Pulse）演出、およびスクリーンリーダー（`aria-live="polite"`）と `prefers-reduced-motion` の遵守。

### 決定事項 (Decision)
1. **純粋 CSS 紙吹雪コンポーネント (`ConfettiOverlay.tsx`) (FR-006b)**:
   - DOM 要素数: 16〜20個程度の軽量 `span` 要素。
   - アニメーション: 純粋 CSS `@keyframes confetti-fall`（`transform: translate3d(...) rotate(...)` と `opacity` のみを使用し GPU 合成レイヤーで実行）。
   - 表示時間: 1.5秒程度でフェードアウトし、自動で DOM からアンマウント。
   - 発火条件: **`streak === 5`（5連続達成時のみ）**。6連続以降は非表示（1セッション最大1回）。
2. **称賛ラベルと連続チップ (FR-006a)**:
   - 連続正解数に応じたラベル:
     - 1問: 「正解！」
     - 2連続: 「いいね！」
     - 3連続: 「お見事！」
     - 4連続: 「すごい！」
     - 5連続以上: 「完璧！」
   - 2連続以降はカード内に `[n連続]` チップを表示。
   - 称賛ラベルには `scale(1.15) -> scale(1.0)` のバウンスアニメーション（0.3s）を適用。
3. **正解ポリゴンの発光 (Pulse) (FR-006c)**:
   - Mode A (`JapanMap.tsx`): 正解県ハイライト SVG パスに CSS クラス `animate-pulse-glow` を適用。
   - Mode D (`MunicipalityMap.tsx`): 正解自治体ポリゴンの `strokeWeight` を一時的に太くし、`fillOpacity: 0.85` から 0.55 へ遷移。
4. **アクセシビリティ (FR-006d, FR-006e)**:
   - `prefers-reduced-motion: reduce`:
     - 紙吹雪コンポーネントはマウントされない。
     - バウンスやパルスアニメーションは `motion-reduce:animate-none` で静的表示（フェードインのみ）。
   - スクリーンリーダー (`aria-live="polite"`):
     - 2.0s の自動遷移時間内に読み終えられるよう、連続正解数は読み上げ文から除外。
     - フォーマット: `正解！ ${name}、${kana}、難易度: ${diff}、人口: ${pop}`。
