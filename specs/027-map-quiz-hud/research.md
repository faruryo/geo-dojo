# Phase 0 Research: 地図クイズのフルスクリーン HUD

**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md) | **Date**: 2026-09-06

調査は既存コードの読解で行った。参照した実装は各判断に file:line で示す。

---

## D1: 出題中だけアプリの枠を外す仕組み

**Decision**: `app/(app)/layout.tsx`（server component）は残したまま、client の
`app/(app)/app-shell.tsx` を1枚挟む。`AppShell` が boolean 1つの Context を持ち、
`main` の `paddingBottom` / `overflowY`、出典 footer、`BottomNav` の3つを出し分ける。
出題側は `useImmersiveLayout(active: boolean)` を呼ぶだけにする。

**Rationale**:

現行の `app/(app)/layout.tsx:19-32` は次の形で、消したい3要素がすべてここに集まっている。

```tsx
<div style={{ display:'flex', flexDirection:'column', height:'100dvh' }}>
  <main style={{ flex:1, overflowY:'auto', paddingBottom:'6rem' }}>
    {children}
    <footer>…国土数値情報／e-Stat の出典…</footer>
  </main>
  <BottomNav />
</div>
```

`getCurrentUserId()` を await するため layout 自体は server component のままにしたい。
子（`QuizRunner`）から祖先の描画を変える経路として、client 境界を1枚下げるのが最小の変更になる。
`overflowY` も `hidden` に倒す必要がある。倒さないと、帯＋地図で `100dvh` を割り付けたときに
1px 単位の端数でスクロールが発生し、SC-002 の「追加の画面スクロールなしに押せる」を破る。

**Alternatives considered**:

- **URL ステート（`?immersive=1`）**: 憲法「状態管理」が第一に挙げる手段だが却下。
  `lib/hooks/usePopstateGuard.ts` が出題中の `popstate` を捕まえて中断させる設計
  （`quiz-runner.tsx:57-59`、`prefecture/page.tsx:190`）なので、クエリの出し入れで
  history が増えると戻るボタン1回で中断が二重に走る。
- **プレイ中だけ別ルートに分割**: spec の Assumptions が明示的に不採用としている
  （`setup / playing / result` が同一ルートのクライアント状態であり、受け渡しの作り直しが機能に見合わない）。
- **`body[data-immersive]` の CSS のみ**: `BottomNav` は隠せるが `main` の `paddingBottom: 6rem` と
  footer の DOM が残る。地図に渡る高さがずれ、FR-032 の「帯の下に地図が覗く隙間を作らない」を保証できない。

---

## D2: フルスクリーン枠の切替単位（FR-004 / FR-005）

**Decision**: `QuizRunner` が受け取る `questions` から1回だけ判定する pure 関数
`sessionUsesImmersiveLayout(questions)` を `lib/quiz/immersive-layout.ts` に置く。
条件は「`kind === 'A'` または `mode === 'D'` の問題を1問以上含む」。

**Rationale**:

`questions` はセッション開始時に確定し（`[mode]/page.tsx:336` / `review/page.tsx` の `loadBatch`）、
途中で差し替わらない。したがってこの判定は自動的にセッション単位になり、FR-004 を構造で満たす。

FR-005（D が読み込み失敗して4択へフォールバックしても枠を維持）も追加コードなしで満たせる。
フォールバックは `modeDFailed` という描画側の state（`use-quiz-state.ts:16`）で表現され、
`questions` の中身は変わらないためである。`effectiveMode` の計算（`quiz-runner.tsx:120`）を
判定に混ぜてはいけない。混ぜるとフォールバックの瞬間に `BottomNav` が復帰して点滅する。

都道府県クイズは常に地図問題なので、`prefecture/page.tsx` では `phase === 'playing'` をそのまま渡す。

**Alternatives considered**:

- **問題ごとに判定**: US4 が明示的に否定している（4択に切り替わるたびにナビが点滅する）。
- **`currentQuestion` から導出**: 上と同じ。さらに `modeDFailed` と絡んで
  「D が失敗した瞬間だけ枠が外れる」という最悪の挙動になる。

---

## D3: 導入表示（中央・大 → 下端・小）の実装方式

**Decision**: 2要素方式を採る。

- 中央のオーバーレイ（`question-intro.tsx`）を絶対配置し、`transform: translateY() scale()` と
  `opacity` だけを遷移させて下端方向へ寄せながら消す。
- 下端の定常表示は最初から DOM にあり、`opacity` で現れる。
- 進行は `use-question-intro.ts` が `'intro' → 'settling' → 'steady'` の3相で持つ。

タイムラインは pure 関数 `resolveIntroPlan(reducedMotion)` が返す（`lib/quiz/hud-metrics.ts`）。

| | 通常 | `prefers-reduced-motion: reduce` |
|---|---|---|
| 中央オーバーレイ | あり（32〜36px） | **なし** |
| hold | 1000ms | 2500ms |
| transition | 320ms（合計 1.32s、FR-021 の 0.8〜1.2s＋遷移に収まる） | 240ms（文字を通常サイズへ緩ませる。当初 0ms としたが一段で落ちて見えたため） |
| 定常前の下端 | 通常サイズ | 文字 24px（帯の高さは変えない。太らせると地図が縮み、戻すときに拡大率と位置がずれる） |

**Rationale**:

要素を1つにして中央から下端へ実際に動かす（FLIP）方式は、お題の文字数で幅が変わるため
毎問 `getBoundingClientRect()` を2回測る必要があり、フォント読み込みのタイミングでずれる。
2要素にすれば測定が不要で、`transform` と `opacity` しか動かさないので合成のみで済み、
Performance Goals（60fps）を素直に満たす。

View Transitions API は却下。React 19 の `startTransition` とは別物で、
Next.js App Router 内での同一ルート更新に噛ませる公式の口がまだ薄く、
Safari の挙動差を吸収するコストが本機能に見合わない。

**FR-022（下端タップで再表示）との関係**: 再表示は `'intro'` 相へ戻すだけで実装できる。
ただし後述 D4 のとおり、**再表示はモード D のタイマーを再度止めてはならない**。
「導入が終わった」信号は問題ごとに1回だけラッチする。

**Alternatives considered**:

- **FLIP（First-Last-Invert-Play）**: 上記のとおり測定コストと文字幅依存で却下。
- **CSS keyframes 1本で完結**: 再表示（FR-022）のたびにアニメーションを再生し直す制御が
  `animation-play-state` の付け外しになり、3相の state 機械より読みにくい。

---

## D4: モード D の制限時間だけを導入後に開始する（FR-024）

**Decision**: `use-quiz-timer.ts` に `armed: boolean` を足し、`armed` が false の間は
インターバルを張らない。`QuizRunner` は「その問題で導入が1回完了したか」を渡す。
`use-quiz-state.ts` の `startTimeRef` には**一切触れない**。

**Rationale**:

spec が FR-024 で名指ししているとおり、起点を動かしてよいのは D の持ち時間だけである。
根拠をコードで確認した。

- `use-quiz-state.ts:22-26` — `startTimeRef` は `qIdx` の変化で `Date.now()` に更新される。
- `use-quiz-actions.ts` — `elapsedMs = Date.now() - state.startTimeRef.current` を
  `answerTimeMs` として保存する。
- `lib/quiz/srs/quality.ts` — `FAST_ANSWER_THRESHOLD_MS = 10_000`。10秒以内の正解が quality=5 となり、
  EF 加速と早期卒業（018）に効く。起点を 1.32 秒遅らせると実質の速答の窓が約 8.7 秒に縮み、
  定着間隔が静かに変わる。FR-050（SRS の意味を変えない）違反になる。
- `prefecture/page.tsx:186-190` — 経過タイムは `performance.now()` を `phase === 'playing'` で
  起点にし、`localStorage` の自己ベストと比較する（`getBestTimeKey`）。起点を変えると過去の記録と
  比較不能になる。

**再表示（FR-022）との相互作用**: `armed` は「その `qIdx` で最初の導入が終わったか」で決める。
下端タップによる再表示では `armed` を false に戻さない。戻すと、読み返すたびに持ち時間が
延びて事実上の無制限になる。

**⚠️ SPEC-1**: spec は US2 受け入れ4 と FR-024 で「15秒の持ち時間」と書いているが、
実装は `use-quiz-timer.ts:6` の `TIME_LIMIT_SEC = 30` で **30秒**である。要件の中身
（導入後に計測を始める）は変わらないので、spec の数値のみ訂正する。

---

## D5: Google Maps の帰属表示と下端の密着（FR-032 / SC-012）

**Decision**: 出題画面を `[上端 HUD][flex-1 の地図コンテナ][下端 HUD]` の縦 flex にし、
下端 HUD をビューポート最下端に置く。地図コンテナは flex で残りを取るため、
自動的に帯の高さぶん縮む。Google のロゴと著作権表記は地図コンテナ内の左下に描かれるので、
帯の直上に可視のまま残る。

**Rationale**:

`components/map/MunicipalityMap.tsx:238` の返り値は `<div className="w-full h-full …" />` で、
Google Maps はこの div の内側にロゴを描く。div の下端＝帯の上端になれば、規約が要求する
「可視かつ非遮蔽」を満たしつつ、帯の下に地図が覗く隙間も生じない。

県当て（A）・都道府県クイズは `@vnedyalk0v/react19-simple-maps` の SVG（`JapanMap.tsx`）で
Google Maps を使わないため、地図上に帰属表示は置かない。出典は D7 のとおり footer に残る。

**Alternatives considered**:

- **地図を全面に敷いて HUD を上に重ねる**: ロゴが帯に隠れ、Google Maps Platform の規約に反する。
  ロゴ位置は API から動かせない。
- **帯を画面下端から浮かせる**: 帯の下に地図が細く覗く。FR-032 が明示的に禁止している。

### SC-007 のベースライン計測（T001・2026-09-06）

変更前（`70be933`）の場所当て（D）の地図コンテナを、viewport 375×812 で実測した。

| 項目 | 値 |
|---|---|
| 幅 | 351px（`max-w-4xl mx-auto` の内側、`p-3` で左右 12px ずつ削られる） |
| 高さ | 478px |
| **面積** | **167,603 px²** |
| SC-007 の達成ライン（130%） | **217,884 px² 以上** |

計測方法: ホストの Chrome ウィンドウが最大化されていて `resize_window` が効かなかったため、
同一オリジンの iframe を 375×812 で作り、その中で `/quiz/municipality/d` を開いて
`MunicipalityMap` のルート要素（`.w-full.h-full.rounded-xl.overflow-hidden.touch-none`）の
`getBoundingClientRect()` を読んだ。`100dvh` は iframe の高さで解決されるため、
実機の縦画面と同じ条件になる。T020 の事後計測も同じ方法で行うこと。

### 事後計測（T020・2026-09-06）

同じ方法で変更後を実測した。

| 項目 | 値 |
|---|---|
| 幅 | 375px（全幅） |
| 高さ | 724px（812 − 上端 44 − 下端 44） |
| **面積** | **271,500 px²** |
| ベースライン比 | **162%**（達成ライン 130% を超過） |

県当て（A）は上端 44px・下端 52px で帯の合計 96px、都道府県クイズは 88px。いずれも
SC-001 の 122px 以内に収まっている。

**ローカルで検証できない項目**: この環境では Maps API キーが `127.0.0.1:3000` の referrer 制限を
通らず、地図が `StaticMapService.Get` の静止画フォールバックで描画される。Google のロゴ・
帰属表示・ズームコントロールがそもそも出ないため、**SC-012 は Preview デプロイで確認する**。
面積の計測はコンテナの矩形を読んでいるので、この制約の影響を受けない。

---

## D6: セーフエリアと SC-001 の測り方

**Decision**: 上端 HUD に `padding-top: env(safe-area-inset-top)`、下端 HUD に
`padding-bottom: env(safe-area-inset-bottom)` を与える。帯の**コンテンツ高**は
44px（県当て A の下端のみ 52px）で固定し、インセットはその外側に積む。
SC-001 の 15% / 122px は**コンテンツ高の合計（44+52=96px、または 44+44=88px）で判定**する。

**Rationale**:

`app/(app)/bottom-nav.tsx:19` が既に `pb-[env(safe-area-inset-bottom)]` を使っており、
同じ流儀に揃う。SC-001 をインセット込みで解釈すると、standalone PWA の iPhone X 系
（上 44px・下 34px）では合計 174px となり、帯の中身をどれだけ削っても達成できない。
インセットは端末が要求する不可侵領域であり、設計で削れる量ではないため、
達成条件から外すのが妥当と判断した。

**⚠️ SPEC-2**: spec の SC-001 にこの解釈を明記する必要がある。

---

## D7: 出典表記の行き先（FR-041）

**Decision**: **新規ページを作らない。** 出典 footer は `app/(app)/layout.tsx:22-27` にあり、
immersive でない全画面（ホーム・分析・クイズ選択・各クイズの設定・結果）に出ている。
immersive のときだけ描画しないようにすれば、FR-041 の「常設ページから確認できる状態を維持」は
そのまま満たされる。

**Rationale**:

`grep -rn "国土数値情報" app components` の結果は `app/(app)/layout.tsx:24` の1件のみで、
出典はこの footer に集約されている。プレイ中に隠すのは immersive フラグの効果であり、
それ以外の画面での可視性は変わらない。新しい `/about` を作ってリンク導線を考えるのは、
達成すべき状態がすでに満たされている以上、増やすだけの変更になる。

**⚠️ SPEC-3**: FR-040 の表は「常設の情報ページへ移設」「移設は本 spec のスコープに含む（FR-041）」と
書いている。実態に合わせて「プレイ中のみ非表示。出典は既存 footer に残す」へ改める。

---

## D8: 不正解後の自動フォーカスの可視矩形（FR-034）

**Decision**: 追加のオフセット計算を書かない。地図コンテナが帯の内側に閉じているため、
既存の計測がそのまま可視矩形になる。ただし**帯の高さが変わる瞬間の計測順序**だけを担保する。

**Rationale**:

- 県当て A: `JapanMap.tsx:70` が `containerRef.current.getBoundingClientRect()` を読み、
  `calculateFocusTransform({ containerWidth, containerHeight })` に渡す。
  コンテナが帯の内側なら、この rect が可視矩形そのものになる。
- 場所当て D: `MunicipalityMap.tsx:184` の `map.fitBounds(bounds, { top:40, right:40, bottom:40, left:40 })` の
  padding は地図コンテナ基準。同じ理由で追加調整が不要。

**担保が要る点**: 正否フィードバック時の下端 HUD は定常時より高い（FR-027 が許容している）。
つまり `feedback` が `'incorrect'` になった commit で、帯が伸び地図コンテナが縮む。
自動フォーカスの effect は同じ commit の DOM 変更後に走るため rect は新しい値になるが、
Google Maps 側は内部のビューポートサイズを追随させる必要がある。実装時に
`fitBounds` の前で追随を確認し、必要なら `google.maps.event.trigger(map, 'resize')` を挟む。
これは tasks.md に検証タスクとして残す。

---

## D9: ズームコントロールの配置（FR-033）

**Decision**: 両地図とも右側面・垂直中央付近へ移す。

- `JapanMap.tsx:224` のズームボタン群 `absolute top-2 right-2` →
  `absolute right-2 top-1/2 -translate-y-1/2`。ボタンは現在 `w-9 h-9`（36px）なので
  `w-11 h-11`（44px）へ広げ、SC-002 を満たす。
- `MunicipalityMap.tsx:97-98` の `new maps.Map(...)` に
  `zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_CENTER }` を追加する。

**Rationale**: 現行の `top-2 right-2` は上端 HUD の真下に来て指が重なる。
Google Maps 側は既定が右下寄りで、下端 HUD と競合する。どちらも垂直中央へ寄せれば
上下の帯から等距離になり、親指の可動域にも入る。

---

## D10: 正否の表現と色（FR-037 / FR-038）

**Decision**: 文字は白 `#fafafa` に統一し、正否は色付きアイコンで示す。

| | アイコン | 色 | `#111111` 上のコントラスト | 基準 |
|---|---|---|---|---|
| 正解 | 塗り丸＋チェック | `#22c55e` | 9.1:1 | 非テキスト 3:1 ✅ |
| 不正解 | 塗り丸＋× | `#ef4444` | 5.02:1 | 非テキスト 3:1 ✅ |
| 文字 | — | `#fafafa` | 18.1:1 | 通常文字 7:1 ✅ |

**Rationale**:

`#ef4444` を文字色にすると 5.02:1 で、弱視向けに spec が定めた 7:1 に届かない。
地図の正解塗り `#4a7c59`（`JapanMap.tsx:212`）は 3.88:1 でさらに低く、塗りとしてのみ使う。
形（チェックと×）が異なるため、色だけに依存しない判別も同時に満たす。

現行の `quiz-question-card.tsx:70-73` は `text-green-500` / `text-red-500` を文字色に使っており、
この方針への置き換えが必要になる。

---

## D11: 下端 HUD のフィードバック時の高さ（FR-026 / FR-027 / SC-008）

**Decision**: フィードバック時の帯の高さを固定値とし、`lib/quiz/hud-metrics.ts` の定数に置く。
値は**実測で決める**。基準は `lib/quiz/feedback-labels.ts` が出しうる最長形が
375px 幅で折り返した状態。

**実測結果（2026-09-08 / 375px）**: `municipality_master` 全件に対して
`formatModeAFeedback` を当てた最長形は、当初の想定（`大和町 …`・37文字）ではなく
4県にまたがる次の62文字だった。

```
池田町 （正解: 北海道: いけだちょう / 岐阜県: いけだちょう / 福井県: いけだちょう / 長野県: いけだまち）
```

これが折り返すと**2行・30px**（行の高さ 15px）。3行なら 45px、4行なら 60px。
定数は 56px とした。実測の 30px に余裕があり、3行になっても割れず、
県当て（A）の定常 52px を下回らないので解答時に帯が縮まない。

**Rationale**:

高さを固定しないと、正解・不正解や文言の長短で帯が伸縮し、SC-008 に反するうえ
地図コンテナの高さが毎問変わって D8 の自動フォーカスが不安定になる。
当初の暫定値は 72px（4行分の見積もり）だったが、上記の実測により **56px** で確定した。
実測の 30px に上下 13px の余裕があり、3行 45px でも割れず、`BOTTOM_BAND_MODE_A_PX`(52) を
下回らないため解答時に帯が縮まない。
決め打ちで実装を進め、実測でずれたら定数1つを直せば済む形にする。

---

## 未解決事項

なし。SPEC-1 / SPEC-2 / SPEC-3 は spec 側の記述訂正として plan.md に記録済み。
D8 の Google Maps リサイズ追随と D11 の実測値は、いずれも実装時に確定させる検証タスクとして
tasks.md へ送る（設計判断そのものは確定している）。

---

## D12: 全国 SVG 地図の投影フレーミング（B026 の取り込み・2026-09-06）

**Decision**: 投影定数を `lib/map/japan-projection.ts` に集約し、viewBox を 400×500 から
400×532 へ、center を [138, 35] から [136.72, 36.44] へ、scale を 1000 から 1221 へ変更する。
枠は**47都道府県の本体ポリゴンの外形**が収まる最小範囲に 0.3 度の余白を足して決めた。
`calculateFocusTransform` の既定値もこの定数へ寄せ、単一の情報源にする。

**Rationale**:

027 のフルスクリーン化だけを入れると、県当て・都道府県では地図が広がらないまま余白だけが
75px から 344px へ増え、2画面が明確に悪化することが実測でわかった。B026 を後続に回すと
その状態で一度リリースされるため、本 spec に取り込んだ。

| | 地図の描画 | 上下の余白 | 面積 |
|---|---|---|---|
| 変更前レイアウト | 351×355 | 約 75px | 124,605 px² |
| フルスクリーン化のみ | 375×380 | 約 344px | 142,500 px² |
| **フレーミング詰め直し後** | **375×499** | **約 225px** | **187,125 px²（変更前比 150%）** |

**枠の基準を重心から外形へ変えた理由**: 各県の本体の重心が入る範囲で詰めると縦横比 0.713 まで
下がり地図は 526px になるが、**北海道の東部が右端で切れる**。ブラウザで可視率を測って検出した。
外形基準なら 0.752 / 499px で、全県の本体が完全に収まる。

**Alternatives considered**:

- **沖縄を別枠へ切り出す（天気予報型）**: 却下。南へ伸びていた分が失われて縦横比が
  0.752 から 0.843 へ悪化し、描画面積が 187,125 から 166,904 px² へ**減る**。天気予報の枠は
  横長画面で横幅を節約する工夫であり、縦画面では逆に働く。
- **投影を回転させて列島の軸を縦に立てる**: 縦横比の問題は解けるが、傾いた日本を覚えさせる
  ことになり地理の学習用途に反する。
- **container のアスペクト比から scale を実行時に算出**: 縦向き前提（FR-008）なので固定値で足り、
  実行時計測を挟むと自動フォーカスとの整合を保つ箇所が増える。

**残る制約**: 上下の余白 約 225px は日本の外形（Mercator 上で縦横比 0.988）に由来し、
47都道府県を保つ限り解消できない。375×724 の枠（0.518）を埋めるには沖縄本島か北海道東部を
枠外へ出すしかない。

**回帰の見張り**: `__tests__/lib/map/japan-projection.test.ts` が、本体の外形 bbox の四隅が
viewBox に収まることと、余白が詰まっていること（外形が viewBox の 9 割以上）を固定する。
