# Tasks: 市区町村クイズモード選択画面のUX改善

- [x] T001: `components/quiz/mode-preview-frame.tsx` を新規作成（破線枠・「プレイ画面イメージ」バッジ・減光、中身に `inert` + `pointer-events-none select-none`）
- [x] T002: `app/(app)/quiz/municipality/page.tsx` の戻るリンク行に「✨ おすすめ」ボタンを追加し、`RecommendHeroCard` を `useRecommendSheet` + `RecommendSheet` へ置き換え
- [x] T003: 同ファイルの grid を組み替え、CTA をモードカードの直下へ移動。文言を「このモードで遊ぶ」に変更、重複する `longLabel` 見出しを削除して `description` を枠のキャプションへ移し、`min-h-[30rem]` を削除
- [x] T004: プレビューを T001 の枠で包む（区切り文は置かない。枠の破線とラベルが境界を示す）
- [x] T005: `__tests__/components/quiz/municipality-mode-select.test.tsx` を追加（遷移先 URL / CTA がプレビューより DOM 前 / `RecommendHeroCard` 非マウント）。赤くなることを確認してから通す
- [~] T006: `.design-sync/` に `ModePreviewFrame` を追随させる（`entry.tsx` の export、`config.json` の `componentSrcMap` / `dtsPropsFor`、`previews/ModePreviewFrame.tsx`、`node .design-sync/build-css.mjs`）— entry/config/previews は反映済み。build-css は `.ds-sync/`（gitignore・未配置）の Tailwind CLI が要るため同期実行時に回す
- [x] T007: `pnpm type-check` / `pnpm lint` / `pnpm lint:ratchet` / `pnpm test` の全パス確認と 375px・ダークモードでの実機確認
