# Research: クイズ効果音（SE）の追加

本ドキュメントでは、クイズ効果音機能を実現するための設計上の決定事項と技術的調査結果をまとめる。

## 調査した課題

1. **音源の実現方式**
   - spec は「いつ・どう聞こえるべきか」のみを定め、実現方式（合成音の動的生成か音声アセットか）は実装判断に委ねている（Assumptions「実現方式」）。制約はライセンス安全性（FR-013）とオフライン再生（FR-014）の2点。
   - `package.json` に音声関連の既存依存はない。また `public/` への大きいファイル追加は serwist precache / Tailwind スキャナを巻き込む既知の問題があり、静的アセットの追加には注意が必要なリポジトリである。
2. **ミュート設定の永続化方式**
   - 「同一端末・同一ブラウザで次回訪問時も維持」（FR-010）が要件で、サーバー側保存・複数端末同期はスコープ外（Assumptions「永続化の範囲」）。
   - リポジトリには localStorage を try/catch ガード付きで使う確立済みパターンが3箇所ある（`components/recommend/recommend-override.tsx`、`lib/quiz/recommendation/history-cache.ts`、`components/dashboard/milestone-banner.tsx`）。
3. **2つのクイズ実装への統合方法**
   - 市区町村クイズ（モードA〜D）と復習セッションは `components/quiz/quiz-runner.tsx` を共有しており、正誤判定（`setFeedback`）・完了（`advanceQuestion` → `onComplete`）・中断（`onAbort`）が全てこの1ファイルに集まっている。
   - 都道府県クイズ（`app/(app)/quiz/prefecture/page.tsx`）は QuizRunner を使わない独立実装で、`handleTap` 内で正誤判定し、`setTimeout` 内で最終ラウンドなら `setState('result')` で結果画面へ遷移する。
4. **ブラウザの自動再生制限と再生失敗時の扱い**
   - AudioContext はユーザー操作なしでは `suspended` のまま再生できない場合がある。モードDのタイムアウト不正解（操作を伴わない発火）でも、クイズ進行をブロックしてはならない（FR-012、Edge Cases）。

---

## Technical Decisions

### Decision 1: 音源は Web Audio API による動的シンセ生成とする（音声アセットファイルを持たない）

- **決定内容**: `lib/quiz/sound-effects.ts` で、Web Audio API の `OscillatorNode` + `GainNode`（ゲインエンベロープ）を用いて4種の効果音（正解・不正解・完了・全問正解）をコードで動的に生成・再生する。mp3/wav 等の音声アセットファイルは一切リポジトリに追加しない。
- **理由**:
  - **FR-013（ライセンス安全性）を構造的に充足**: 音は自作コードによる生成音そのものであり、第三者音源のライセンス確認・クレジット管理が不要になる。
  - **FR-014（オフライン再生）を追加作業ゼロで充足**: 音がJSバンドルに含まれるため、serwist の precache manifest への追加・キャッシュ戦略の変更が不要。`public/` への静的ファイル追加が precache 周りの問題を起こした過去の教訓（16MB topojson）にも抵触しない。
  - **依存追加なし**: `package.json` に音声ライブラリを増やさず、バンドルサイズ増加は生成コード数百行分のみ。
  - 要件の音は「短く控えめ」（FR-007）な UI サウンドであり、オシレータ合成（例: 正解=上昇2音、不正解=低い短音、完了=3音アルペジオ、全問正解=長めのファンファーレ風）で十分に聞き分け可能な品質を実現できる。
- **注意点**: 音色の細部はコードパラメータ（周波数・波形・エンベロープ・長さ）の調整で行う。具体値は実装時のデザイン判断（spec Assumptions「音の性格」）。

### Decision 2: ミュート設定は localStorage（キー `geo-dojo:se-muted`）で永続化する

- **決定内容**: ミュート状態を localStorage のキー `geo-dojo:se-muted` に保存する。キーが存在しない（初回・未設定）場合は「音あり」として扱う（Clarifications で確定したデフォルト）。読み書きは既存パターンに倣い try/catch でガードし、localStorage が使えない環境（プライベートモード等）では「音あり・永続化なし（セッション内のみ有効）」に静かにフォールバックする。
  - `playSe` は**呼び出しごとに localStorage を直接参照**してミュート判定する（読み取りは同期・軽量で、解答テンポ〜秒単位に対し無視できるコスト）。これによりグローバルストアや Context のセットアップが不要になり、どの画面から呼んでも常に最新の設定が反映される（FR-009 の単一設定を自然に実現）。
  - UI（トグルアイコンの表示状態）用には `lib/hooks/useSoundMuted.ts` を新設し、`useState` + localStorage 同期の軽量フックとして提供する。
- **理由**: FR-010 の要件は端末ローカルの永続化のみで、サーバー保存はスコープ外。localStorage はこのリポジトリで確立済みのパターンであり、憲法の「複雑なグローバルストアを避ける」規約とも整合する。DB スキーマ変更・Server Action 追加が不要になり、実装・テストが最小になる。

### Decision 3: QuizRunner 内で正誤音・完了音を完結させ、呼び出し元3画面は無変更とする

- **決定内容**: `components/quiz/quiz-runner.tsx` に以下の2種類のフックポイントで `playSe` を差し込む。
  - **正誤音**: 各解答ハンドラ（`handleModeASubmit` / `handleBChoice` / `handleCChoice` / `handleDTap` / `handleTimeout`）が `setFeedback(correct ? 'correct' : 'incorrect')` を呼ぶのと同じ箇所で `playSe(correct ? 'correct' : 'incorrect')` を呼ぶ。タイムアウト（`handleTimeout`）は不正解音（FR-002）。
  - **完了音**: `advanceQuestion` 内で最終問題を超えたとき、`onComplete(updatedResults)` の直前に `updatedResults` の全問正解判定を行い、`playSe(allCorrect ? 'perfect' : 'complete')` を呼ぶ。
- **理由**: QuizRunner は市区町村クイズ（モードA〜D）と復習セッションの両方から使われているため、この1ファイルの変更で spec 対象6画面のうち5画面分（FR-001〜FR-005 の大半）がカバーされる。呼び出し元（`municipality/[mode]/page.tsx`・`review/page.tsx`）の `onComplete`/`onAbort` シグネチャは無変更で済み、復習の連続プレイ（各バッチが独立に `onComplete` を通る）でもバッチごとに完了音が鳴る（FR-003）。中断は `onAbort` 経路であり `advanceQuestion` を通らないため、完了音が鳴らないこと（FR-005）が構造的に保証される。
- **完了音のタイミングについて**: spec は「結果画面が表示されるタイミング」と定めるが、`onComplete` から結果画面描画までは同期的な state 遷移（数十ms以内）であり、体感上同時である。呼び出し元で鳴らす案（結果画面の `useEffect`）は3画面それぞれに全問正解判定の重複実装が必要になるため採らない。

### Decision 4: 都道府県クイズには同じ `playSe` を個別に差し込み、ランナーの共通化はしない

- **決定内容**: `app/(app)/quiz/prefecture/page.tsx` の `handleTap` 内（`setState(isCorrect ? 'correct' : 'wrong')` と同時）に正誤音を、`setTimeout` 内の最終ラウンド分岐（`setState('result')` の直前）に完了音（全問正解判定付き）を差し込む。ヘッダ行に共通の `MuteToggle` を配置する。
- **理由**: 共有するのは `playSe`（音の意味と実体の一貫性 = FR-006）と `MuteToggle`（設定の単一性 = FR-009）の2点で十分。都道府県クイズを QuizRunner に統合するリファクタは、結果保存（Server Action）・SRS 連携など本 feature と無関係な差分を大量に生むため、spec Assumptions「既存挙動への影響」（既存の挙動には一切変更を加えない）に照らして行わない。

### Decision 5: 自動再生制限・再生失敗は `playSe` 内部で完全に吸収する

- **決定内容**: `playSe` は同期関数として呼び出し、内部処理全体を try/catch で包む。AudioContext はモジュール内で遅延生成（初回呼び出し時）・再利用し、`state === 'suspended'` なら `resume()` を試みる（await はするが呼び出し元へは伝播させない fire-and-forget）。生成・resume・再生のいずれが失敗しても例外を外に投げず、console 出力もエラーレベルでは行わない（音だけが黙って省略される）。
- **理由**: FR-012 / SC-005 は「再生失敗・拒否がクイズ進行をブロックしない」ことを最重要の不変条件としている。呼び出し側（QuizRunner 等）にエラーハンドリングを要求しない設計にすることで、5箇所以上ある呼び出しポイントの実装が「1行追加」に収まり、既存の `recordAndAdvance` → `setTimeout` のテンポ（1200/1500ms）に干渉する余地をなくす。通常フローでは解答は常にタップ/クリック起点のため、初回のユーザー操作で AudioContext は running になり、以後のタイムアウト発火でも再生できる見込み（できない場合も上記フォールバックで安全）。

### Decision 6: テストは音種選択・ミュートゲートを純粋ロジックとして分離して Vitest で検証する

- **決定内容**: 「結果配列 → 完了イベント種（complete/perfect）の判定」「ミュート時は再生パイプラインに到達しない」「localStorage 不可用時のフォールバック」を、Web Audio 実体から分離した純粋ロジック／モック境界としてユニットテストする（`__tests__/lib/quiz/sound-effects.test.ts`）。実際の音の聞こえ方・聞き分けは quickstart.md の手動検証で確認する。
- **理由**: jsdom に AudioContext はなく、音響出力の自動検証は不可能。データ変更ロジックを純粋関数 + Vitest で検証するのがこのリポジトリの方針であり、テスト可能な判定ロジックと不可能な音響出力を関数境界で分けておく。

---

## Alternatives Considered

### Alternative A: 音声アセットファイル（mp3/wav）+ HTMLAudioElement / fetch+decodeAudioData

- **不採用理由**: (1) フリー音源を使う場合、FR-013 のライセンス確認・出所記録・将来の差し替え時の再確認という継続的な管理コストが生じる。(2) FR-014 のために serwist の precache manifest への追加が必要になり、`public/` 静的ファイルと precache の組み合わせで問題が出た本リポジトリの経緯上、検証コストが上がる。(3) 4音のためにアセット管理・プリロード制御（初回再生の遅延防止）を実装する必要があり、シンセ生成より総コストが高い。音質面のメリット（リッチな効果音）は「短く控えめ」（FR-007）という要件に対して過剰。

### Alternative B: howler.js 等の音声ライブラリ導入

- **不採用理由**: 4種の短い UI サウンドの再生に対してライブラリ（スプライト管理・フェード・空間音響等）は明確に過剰で、依存とバンドルサイズを増やす。Web Audio API 標準だけで要件を満たせる。

### Alternative C: ミュート設定を DB（サーバー側）に保存し複数端末で同期する

- **不採用理由**: spec Assumptions「永続化の範囲」で明示的にスコープ外。スキーマ変更・マイグレーション・Server Action・TanStack Query 連携が必要になり、要件（同一端末での維持）に対して過剰。

### Alternative D: ミュート状態を React Context / グローバルストアで管理する

- **不採用理由**: 憲法コーディング規約「複雑なグローバルストアを避け」に反する方向。設定の読み手は `playSe`（呼び出し時に localStorage を直読みすれば足りる）とトグルアイコン（画面ローカルのフックで足りる）のみで、Provider をツリーに追加する必要性がない。

### Alternative E: 完了音を各画面の結果表示 `useEffect` で鳴らす

- **不採用理由**: 結果画面は3実装（市区町村・復習・都道府県）に分かれており、全問正解判定＋再生の同じロジックを3箇所に重複させることになる。QuizRunner 系は `onComplete` 直前の1箇所で2画面分をカバーできる Decision 3 の方が変更点が少なく、中断時に鳴らない保証（FR-005）も構造的に得られる。

### Alternative F: 都道府県クイズを QuizRunner に統合してから効果音を実装する

- **不採用理由**: QuizRunner は市区町村データ型（`Municipality`）・結果保存 Server Action・SRS 前提の構造を持ち、都道府県クイズ（保存なし・47件固定・10問）の統合は本 feature の目的（効果音追加）を超える大規模リファクタになる。spec Assumptions「既存挙動への影響」（既存の挙動には一切変更を加えない）に反するリスクが高い。
