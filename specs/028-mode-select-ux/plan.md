# 実装計画書: 市区町村クイズモード選択画面のUX改善

**フィーチャーブランチ**: `faruryo/feat-ui-ux`
**仕様書**: [spec.md](./spec.md) / **Issue**: [#87](https://github.com/faruryo/geo-dojo/issues/87) / **Backlog**: B027

---

## 概要

`app/(app)/quiz/municipality/page.tsx` の JSX の並び順を変え、説明ブロック（プレビュー・出題ルール）を CTA より下へ降格する。
おすすめは見出し行のボタンからシートを開く形にし、プレビューはラッパー1枚でサンプル化する。
新しい固定配置・新しいアニメーション・新しい状態は導入しない。差分はレイアウトの並べ替えが中心で、正味のコード量は減る。

## 目標レイアウト（375px）

```
← クイズ選択に戻る                    [✨ おすすめ]   ← 戻るリンクと同じ行
市区町村クイズ・モード選択
┌─────────┬─────────┐
│ モードA  │ モードB  │
├─────────┼─────────┤
│ モードC  │ モードD  │
└─────────┴─────────┘
[        このモードで遊ぶ        ]   ← 実測 272–316、fold（608px）内

┌╌ プレイ画面イメージ（操作できません）╌┐
│  市区町村名から所属県を…（description）│
│  ModePreview（減光・押せない）        │
└╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘
▸ 出題ルールと除外について
```

`md` 以上は左カラム（カード → CTA）／右カラム（プレビュー → 出題ルール）。

---

## 変更対象ファイル

1. `app/(app)/quiz/municipality/page.tsx`
   - `RecommendHeroCard` の import と使用を削除し、`useRecommendSheet` + `RecommendSheet` に置き換える。
     戻るリンクの行を `flex items-center justify-between` にし、右端に `Button variant="ghost" size="sm"` で「✨ おすすめ」を置く
     （h1 の行に置くと 375px で「市区町村クイズ・モード選」「択」と2行に折り返す。実機で確認）。
     `useRecommendation` はこの画面から消える（推薦フェッチが1つ減る）。
   - grid の中身を組み替える。左カラム = モードカード 2×2 → CTA、右カラム = プレビュー → 出題ルール `<details>`。
     現行の grid 外・全幅 CTA（`page.tsx` 末尾の `<Button onClick={handleProceed} className="w-full mt-2">`）を左カラム内へ移す。
   - CTA 文言を `{shortLabel}・{longLabel} で設定に進む` → `このモードで遊ぶ` に変更。
   - 選択中モードの `longLabel` 見出しは消す（選択中のカードに同じ文字列が出ており重複する）。`description` は `ModePreviewFrame` の `caption` へ渡す（FR-004）。
   - プレビューパネルの `min-h-[30rem]` を削除する。これは「CTA が飛ばないように」入れてあった回避策であり、CTA が上へ移ることで不要になる。
   - プレビューを新しいラッパーで包む。区切り文は置かない（枠の破線とラベルが境界を示すので重複する）。
   - `handleSelectMode` / `handleProceed` / `resolveInitialSelectedMode` の挙動（B018 の前回モード保持）は変更しない。

2. `components/quiz/mode-preview-frame.tsx`（新規・小）
   - `ModePreview` を包むラッパー。`border-dashed` + `bg-muted/10` の枠、左上に「プレイ画面イメージ」バッジ、
     中身に `inert` + `pointer-events-none select-none opacity-85`。`ModePreviewA`〜`D` の中身は触らない。
     `inert` はキーボード用（react-simple-maps が各パスに `tabIndex={0}` を付けるため、ポインタだけ止めても Tab で入れる）。
   - おすすめ系ではなくクイズ画面の部品なので `components/quiz/` に置く。

3. `.design-sync/`（Claude Design プロジェクトへの同期。`components/` に1つ足すので追随が要る）
   - `entry.tsx` に `export { ModePreviewFrame } from '../components/quiz/mode-preview-frame.tsx';` を追加
   - `config.json` の `componentSrcMap` に `"ModePreviewFrame": "./components/quiz/mode-preview-frame.tsx"`
   - `config.json` の `dtsPropsFor` に Props（`children: React.ReactNode` のみ）を追記
   - `previews/ModePreviewFrame.tsx` を追加。`QuizPoolProgress.tsx` と同じ体裁（`background: '#111111'`, `width: 351` の frame に包む）で、
     中身にダミーの問題カード＋4択を入れた1バリアント。地図は `_topology.ts` の fetch シムが要るので preview では使わない
   - 破線枠・減光で新しい Tailwind utility を使うため `node .design-sync/build-css.mjs` を流す
   - 手順の詳細は `.design-sync/NOTES.md`（symlink の張り直しなど）

4. `__tests__/components/quiz/municipality-mode-select.test.tsx`（新規）

変更しないもの: `components/recommend/recommend-hero-card.tsx`、`recommend-sheet.tsx`、`use-recommend-sheet.ts`、
`components/dashboard/dashboard-client.tsx`、`lib/quiz/municipality-mode-catalog.ts`、設定画面。

---

## テスト方針

純粋関数の追加はない（レイアウト変更のため、切り出せるドメイン判断がない）。
`.agents/rules/testing.instructions.md` の「変更の失敗モードに該当するケースを選ぶ」に従い、回帰は1本に絞る。

守る失敗モード = **CTA が再び説明ブロックの下に埋もれる**。
`__tests__/components/quiz/hud-layout.test.tsx` と同じ happy-dom + `react-dom/client` の `createRoot` + `act` で描画し、次を検証する。

- モードカードをクリックすると、CTA の押下で `router.push` に `/quiz/municipality/<mode>` が渡る（既定 B と、選択した D の2ケース）。
- サンプル枠に `inert` が付いており、ラベルはその外にある。
- CTA 要素が、プレビューのサンプル枠より DOM 上で前に来ている（`compareDocumentPosition` で判定）。
- この画面が `RecommendHeroCard` をマウントしない。

赤くなる確認: CTA を JSX 上でプレビューの後ろへ戻すと DOM 順のアサーションが落ちることを確認してから戻す。

---

## 実装ステップ

- **Step 1**: サンプル枠コンポーネントを追加する。
- **Step 2**: `page.tsx` の戻るリンク行を組み替え、`RecommendHeroCard` を `useRecommendSheet` + `RecommendSheet` に置き換える。
- **Step 3**: `page.tsx` の grid を組み替え、CTA を左カラムへ移し、文言を変更、`min-h-[30rem]` を削除、説明文の高さを固定する。
- **Step 4**: プレビューをサンプル枠で包む。
- **Step 5**: 回帰テストを追加し、赤くなることを確認してから通す。
- **Step 5.5**: `.design-sync/` を追随させる（`entry.tsx` / `componentSrcMap` / `dtsPropsFor` / `previews/ModePreviewFrame.tsx` / `build-css.mjs`）。
- **Step 6**: `pnpm type-check` / `pnpm lint` / `pnpm lint:ratchet` / `pnpm test` を通し、375px・ダークモードで実機確認（fold 内に CTA が入ること、`?recommend=open` でシートが開くこと）。
