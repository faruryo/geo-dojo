# Tasks: 地図タップモード（Mode A/D）不正解時の自動フォーカス (B006)

**Feature ID**: `016-map-autofocus`  
**Plan Document**: [plan.md](file:///Users/faru/geo-dojo/specs/016-map-autofocus/plan.md)  

---

## 1. 準備 & ユーティリティ計算ロジック (Phase 1: Math & Helpers TDD)

- [ ] **T001**: Bounding Box 算出ユーティリティの単体テスト作成 & Red 確認 (`__tests__/lib/map/autofocus-bounds.test.ts`)
  - 複数要素合成、単一極小要素、0除算ガード、`topojson-client` デコード後の `geoMercator({ center: [138, 35], scale: 1000 })` 投影座標算出の仕様テストを記述し、未実装状態で Red（失敗）を確認する
- [ ] **T002**: 座標領域計算・Bounding Box 算出ユーティリティ関数の実装と Green 確認 (`lib/map/autofocus-bounds.ts`)
  - Bounds 合成処理（`mergeBounds`）
  - TopoJSON (`topojson-client.feature`) デコードおよび Mercator 投影 (`geoMercator`) に基づく SVG 用 `scale` & `translate` 算出関数（`calculateFocusTransform`）

---

## 2. 地図フォーカス統合テスト環境 & テスト先行実装 (Phase 2: Component Integration Tests TDD)

- [ ] **T003**: コンポーネント統合テスト用 DOM 実行環境・Google Maps/SVG モックの設定確認・定義
  - `happy-dom` / `jsdom` 環境プロバイダまたは `google.maps` API スパイモック設定
- [ ] **T004**: 地図フォーカス & リセット動作のコンポーネント統合テスト作成 & Red 確認 (`__tests__/components/map/autofocus-integration.test.ts`)
  - 不正解時 (`isIncorrect: true`) の `fitBounds` / `setTranslate` 呼び出しおよび `idle` 後の `zoom > 12` から `setZoom(12)` への非同期クランプ検証
  - **否定テスト (FR-03.1)**: 初期表示 (`idle`) でコンポーネントをマウントし、初期表示 `fitBounds` 呼び出し後にスパイをクリア (`spy.mockClear()`) してから同一 `qIdx` のまま正解判定 (`isIncorrect: false` / `feedback === 'correct'`) へ再レンダリングし、追加のカメラ移動が発生しないことを検証
  - `qIdx` 変更時（新しい問題遷移）のカメラ構図・ズームリセット検証
  - 未改修コードに対して統合テストが Red（失敗）になることを明確に確認する

---

## 3. Mode D (Google Maps) 自動フォーカス実装 (Phase 3: Mode D Implementation)

- [ ] **T005**: `MunicipalityMap.tsx` への `isIncorrect` および `qIdx` prop 追加とスタイル適用連携
- [ ] **T006**: `MunicipalityMap.tsx` における `isIncorrect` 時の `fitBounds` 発動＆非同期 `idle` リスナによる maxZoom 12 クランプ処理実装
- [ ] **T007**: 新しい問題遷移時 (`qIdx` 変化 / `feedback === 'idle'`) の `fitBounds` リセット処理の実装

---

## 4. Mode A (JapanMap / Simple Maps) 自動フォーカス実装 (Phase 4: Mode A Implementation)

- [ ] **T008**: `JapanMap.tsx` への `isIncorrect` および `qIdx` prop 追加と SVG 座標算出ロジックの組み込み
- [ ] **T009**: `JapanMap.tsx` での `scale` / `translate` 更新と smooth transition アニメーションの実装
- [ ] **T010**: Mode A 問題切り替え時 (`qIdx` 変化) の構図リセット (`scale: 1, translate: {x:0, y:0}`) 実装

---

## 5. QuizRunner 統合 & 全体検証 (Phase 5: QuizRunner Integration & Verification)

- [ ] **T011**: `QuizRunner.tsx` から `MunicipalityMap` および `JapanMap` へ `isIncorrect` フラグと `qIdx` (問題インデックス) を伝達
- [ ] **T012**: フィードバック時間（1500ms）とフォーカスアニメーション（500ms）のタイミング調整および手動動作確認
- [ ] **T013**: 全統合テストの Green（成功）確認、型チェック、回帰テスト、品質チェックスクリプト実行 (`pnpm type-check`, `pnpm test`, `pnpm lint:ratchet`)
