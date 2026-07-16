# 実装計画書: クイズ効果音（SE）の追加

**ブランチ**: `014-sound-effects` | **日付**: 2026-07-16 | **仕様書**: [spec.md](./spec.md)

---

## 概要

すべてのクイズ画面（市区町村クイズ モードA〜D・復習セッション・都道府県クイズ）に、正解・不正解・クイズ完了（通常／全問正解）の4種類の効果音を追加し、クイズ画面共通のミュートトグル（localStorage 永続化、デフォルト音あり）を提供する。

### 技術的アプローチ

- **音源は Web Audio API による動的シンセ生成**（オシレータ＋ゲインエンベロープ）を採用する。音声アセットファイルを一切持たないため、ライセンス問題が構造的に発生せず（FR-013）、serwist の precache 設定変更なしでオフライン再生が成立する（FR-014）。依存パッケージの追加もない。詳細比較は [research.md](./research.md) Decision 1。
- 共有ユーティリティ `lib/quiz/sound-effects.ts` に `playSe(event)` を新設する。`event` は `'correct' | 'incorrect' | 'complete' | 'perfect'` の4種（spec Key Entities「効果音イベント」に対応）。内部で AudioContext の遅延初期化・ミュート判定・try/catch を完結させ、**呼び出しは同期的な fire-and-forget**（await 不要・例外を外に漏らさない）とすることで、既存のフィードバック表示時間（1200/1500ms の setTimeout）やクイズ進行に一切影響を与えない（FR-007, FR-012）。
- ミュート設定は localStorage（キー `geo-dojo:se-muted`）に保持する。既存の localStorage 利用パターン（`components/recommend/recommend-override.tsx` 等の try/catch ガード）を踏襲。キー未保存時は「音あり」（Clarifications 確定事項）。`playSe` は呼び出しごとに設定を直接参照し、UI 表示用には `useSoundMuted` フックを提供する（グローバルストア不要、憲法コーディング規約に適合）。
- **市区町村クイズ・復習セッションへの統合は `components/quiz/quiz-runner.tsx` 1ファイルで完結**する。正誤音は各解答ハンドラ（`handleModeASubmit` / `handleBChoice` / `handleCChoice` / `handleDTap` / `handleTimeout`）の `setFeedback(...)` と同時に、完了音は `advanceQuestion` 内の `onComplete(updatedResults)` 呼び出し直前に `updatedResults` の全問正解判定付きで再生する。これにより QuizRunner の3つの呼び出し元（`municipality/[mode]/page.tsx`・`review/page.tsx`）は無変更で済み、復習の連続プレイでもバッチごとに完了音が鳴る（FR-003）。`onAbort` 経路では何も鳴らさない（FR-005）。
- **都道府県クイズ（`app/(app)/quiz/prefecture/page.tsx`、QuizRunner 非使用の別実装）**には、同じ `playSe` を `handleTap`（正誤音）と結果画面遷移時（完了音・全問正解判定付き）に直接差し込む。共有するのはユーティリティとトグルコンポーネントのみで、ランナーの共通化はしない（本 feature のスコープ外の大規模リファクタを避ける）。
- ミュートトグルは `components/quiz/mute-toggle.tsx`（lucide-react の `Volume2`/`VolumeX` アイコンボタン）として新設し、QuizRunner のヘッダ行（中断・進捗・正解数の行）と都道府県クイズのヘッダ行に配置する（FR-008, FR-009）。
- ブラウザの自動再生制限対策: AudioContext は初回の `playSe` 呼び出し時に生成し、`suspended` 状態なら `resume()` を試みる。失敗・拒否時はその回の音のみ黙ってスキップする（Edge Case / FR-012）。
- テストは「イベント種→音パラメータの対応」「ミュート時に再生パイプラインへ到達しない」ことを純粋ロジックとして分離し Vitest で検証する（Web Audio 実体はブラウザ手動確認 = quickstart.md）。

---

## 技術的文脈

**言語/バージョン**: TypeScript (strict)、Next.js 15.2.6+（App Router / React 19）
**主要な依存関係**: **Web Audio API（ブラウザ標準・追加依存なし）**、lucide-react（トグルアイコン）、shadcn/ui 既存トークン。音声ライブラリ・音声アセットファイルは導入しない
**ストレージ**: localStorage（キー `geo-dojo:se-muted`）のみ。**DB スキーマ変更なし**（新規テーブル・カラム・マイグレーション不要。サーバー側保存はスコープ外 = spec Assumptions）
**テスト**: Vitest (`pnpm test`)。音種選択・ミュートゲートの純粋ロジックのユニットテスト。実音の聞こえ方は quickstart.md の手動検証
**対象プラットフォーム**: PWA（モバイルファースト 375px 基準、ダークモード `#111111`）。オフライン時も再生可能であること（FR-014、コード生成音のため自動的に充足）
**プロジェクトタイプ**: Web アプリケーション
**パフォーマンス目標**: `playSe` 呼び出しが既存のフィードバック表示時間（1200/1500ms）・次問題への遷移タイミングを 1ms も遅延させない（同期 fire-and-forget、FR-007 / SC-005）
**制約事項**: 正誤判定ロジック・結果集計・SRS スケジューリング・既存 UI レイアウトへの変更は一切行わない（spec Assumptions「既存挙動への影響」）。音の再生失敗はユーザーに表面化させない（FR-012）。音源はライセンス上安全であること（FR-013 → 自作生成音で充足）

---

## 憲法チェック (憲法原則の確認)

| 原則 | 評価 | 判定 |
|------|------|------|
| I. セキュリティ & コンプライアンス | 新規 API キー・外部通信・外部音源 CDN なし。localStorage に保存するのは二値のミュートフラグのみで個人情報を含まない。 | ✅ 合格 (Pass) |
| II. アーキテクチャ & パフォーマンス | DB・Server Actions・TanStack Query への変更なし（サーバー状態を持たないため Read/Write 原則の対象外）。PWA: 音声アセットを持たないため serwist precache 設定は無変更（`public/` に大きいファイルを追加すると precache が問題を起こす既知の教訓にも抵触しない）。再生は fire-and-forget で既存テンポに影響なし。 | ✅ 合格 (Pass) |
| III. ロジック & UI | 375px のクイズヘッダ行に小さなアイコントグルを1つ追加するのみ。既存レイアウト（中断・進捗・正解数）と視覚フィードバックは維持。 | ✅ 合格 (Pass) |
| コーディング規約 | TypeScript strict 順守。「複雑なグローバルストアを避ける」→ ミュート状態は localStorage 直読み＋軽量フックで実現し、Context/store ライブラリを導入しない。localStorage 利用は既存慣行（`recommend-override.tsx`・`history-cache.ts`・`milestone-banner.tsx`）と同じ try/catch パターンを踏襲。 | ✅ 合格 (Pass) |

**補足（違反ではないが明記する判断）**: 憲法の状態管理規約は「URL ステートまたは TanStack Query のキャッシュを活用」と記すが、ミュート設定は端末ローカルの永続設定でありサーバー状態でも一時的 UI 状態でもないため、どちらにも該当しない。リポジトリ内で確立済みの localStorage パターン（3箇所で実績あり）に従うのが最小構成であり、Complexity Tracking に載せる違反には当たらないと判断した。

---

## プロジェクト構成

### ドキュメント（本機能）

```text
specs/014-sound-effects/
├── plan.md              # このファイル
├── research.md          # 調査結果（音源方式・永続化・統合方法の決定）
├── data-model.md        # データモデル定義（DBスキーマ変更なしの明記含む）
├── quickstart.md        # クイックスタートガイド（手動検証手順）
├── contracts/
│   └── sound-effects.md # playSe / ミュート設定 / 各画面統合の内部契約
├── checklists/
│   └── requirements.md  # 仕様品質チェックリスト
└── tasks.md             # タスクリスト（/speckit-tasks で生成）
```

### ソースコード（リポジトリルート）

```text
lib/quiz/
└── sound-effects.ts            # [新規] SeEvent 型、playSe()（Web Audio 合成・ミュート判定・try/catch 内包）、
                                #        isSoundMuted()/setSoundMuted()（localStorage 永続化）

lib/hooks/
└── useSoundMuted.ts            # [新規] ミュート状態の React フック（UI 表示用、既存 lib/hooks/ の粒度に合わせる）

components/quiz/
├── mute-toggle.tsx             # [新規] ミュートトグルアイコンボタン（Volume2/VolumeX）
└── quiz-runner.tsx             # [変更] 各解答ハンドラで正誤音、onComplete 直前で完了音、ヘッダ行に MuteToggle

app/(app)/quiz/prefecture/
└── page.tsx                    # [変更] handleTap で正誤音、結果遷移時に完了音、ヘッダ行に MuteToggle

__tests__/lib/quiz/
└── sound-effects.test.ts       # [新規] イベント種→音パラメータ対応・ミュートゲート・localStorage 不可用時フォールバックのユニットテスト
```

**構成に関する決定**: 既存の Next.js 単一プロジェクト構造（LIFT 原則）を踏襲。音の生成・再生ロジックは `lib/quiz/`（コアロジック置き場）に純粋なユーティリティとして置き、UI（トグル）は `components/quiz/` に置く。QuizRunner 系（市区町村・復習）と都道府県クイズの2実装は統合せず、共有はユーティリティ＋トグルコンポーネントの2点に限定する。

## Complexity Tracking

憲法チェックに違反なし（本セクション対象外）。
