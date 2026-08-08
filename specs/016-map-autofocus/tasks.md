# Tasks: 地図タップモード（Mode A/D）不正解時の自動フォーカス (B006)

**Feature ID**: `016-map-autofocus`  
**Plan Document**: [plan.md](file:///Users/faru/geo-dojo/specs/016-map-autofocus/plan.md)  

---

## 1. 準備 & ユーティリティ計算ロジック (Phase 1: Math & Helpers)

- [ ] **T001**: 座標領域計算・Bounding Box 算出ユーティリティ関数の作成 (`lib/map/autofocus-bounds.ts`)
  - Bounds 合成処理（`mergeBounds`）
  - SVG 用 `scale` & `translate` 算出関数（`calculateFocusTransform`）
- [ ] **T002**: ユーティリティ関数の単体テスト実装 (`__tests__/lib/map/autofocus-bounds.test.ts`)
  - 複数要素合成、単一極小要素、0除算ガードの検証

---

## 2. Mode D (Google Maps) 自動フォーカス改修 (Phase 2: Mode D Implementation)

- [ ] **T003**: `MunicipalityMap.tsx` への `isIncorrect` prop 追加とスタイル適用連携
- [ ] **T004**: `MunicipalityMap.tsx` における `isIncorrect` 時の `fitBounds` 発動＆ maxZoom ガード処理実装
- [ ] **T005**: 新しい問題遷移時の `fitBounds` リセット処理の確認・実装

---

## 3. Mode A (JapanMap / Simple Maps) 自動フォーカス改修 (Phase 3: Mode A Implementation)

- [ ] **T006**: `JapanMap.tsx` への `isIncorrect` prop 追加と SVG 座標算出ロジックの組み込み
- [ ] **T007**: `JapanMap.tsx` での `scale` / `translate` 更新と smooth transition アニメーションの実装
- [ ] **T008**: Mode A 問題切り替え時の構図リセット (`scale: 1, translate: {x:0, y:0}`) 実装

---

## 4. QuizRunner 統合 & アニメーション調整 (Phase 4: QuizRunner Integration)

- [ ] **T009**: `QuizRunner.tsx` から `MunicipalityMap` および `JapanMap` へ `isIncorrect` フラグを伝達
- [ ] **T010**: フィードバック時間（1500ms）とフォーカスアニメーション（500ms）のタイミング調整および手動動作確認

---

## 5. テスト・回帰検証 (Phase 5: Verification)

- [ ] **T011**: 型チェック・回帰テスト・品質チェックスクリプト実行 (`pnpm type-check`, `pnpm test`, `pnpm lint:ratchet`)
