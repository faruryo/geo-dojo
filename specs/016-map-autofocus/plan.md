# Implementation Plan: 地図タップモード（Mode A/D）不正解時の自動フォーカス (B006)

**Feature ID**: `016-map-autofocus`  
**Plan Date**: 2026-08-07  
**Spec Document**: [spec.md](file:///Users/faru/geo-dojo/specs/016-map-autofocus/spec.md)  

---

## 1. コンポーネント改修設計 (Component Refactoring)

### 1.1 `MunicipalityMap.tsx` (Mode D / Google Maps)

#### 追加・変更インターフェース (Props)
```typescript
interface MunicipalityMapProps {
  prefecture: string;
  onMunicipalityClick: (code: string, name: string) => void;
  highlightCodes?: string[];  // 正解の市区町村コード
  wrongCodes?: string[];      // 誤タップの市区町村コード
  isIncorrect?: boolean;       // 不正解状態フラグ（自動フォーカス起動用）
  qIdx?: number;               // 問題インデックス（問題切り替え時のリセットトリガー用）
  onLoadError?: () => void;
}
```

#### フォーカス計算 & 発動ロジック
1. `useEffect` で `isIncorrect` が `true` に変化した際をトリガーとする。
2. `dataLayerRef.current` から `highlightCodes` (正解) および `wrongCodes` (誤り) に一致する feature(s) を抽出。
3. `google.maps.LatLngBounds` オブジェクトを構築し、対象 feature(s) の全 `LatLng` を `bounds.extend(ll)` で追加。
4. 対象の `bounds` が有効な場合、`mapRef.current.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 })` を発動。
5. **過度なズームイン防止 (非同期 Clamping)**: `fitBounds` による非同期のアニメーション・ビューポート適用完了を検知するため、`google.maps.event.addListenerOnce(map, 'idle', ...)`（または `zoom_changed`）でワンショットイベントをリスン。アニメーション確定後の `zoom` が `12` を超える（`zoom > 12`）場合のみ `map.setZoom(12)` でクランプし、周囲の地理コンテキスト（山脈海沿い・隣接市）が確実に視認できるように調整。
6. **問題リセット処理**: `qIdx` の変更または `feedback === 'idle'` 復帰時をトリガーとして、対象 `prefecture` 全体の Bounds へ `fitBounds` して初期表示に確定リセットする。

---

### 1.2 `JapanMap.tsx` (Mode A / Simple Maps SVG)

#### 追加・変更インターフェース (Props)
```typescript
interface JapanMapProps {
  onPrefectureClick: (name: string) => void;
  highlightCorrect?: string | string[];  // 正解都道府県
  highlightWrong?: string;               // 誤選択都道府県
  selectedNames?: string[];              // ユーザーが選択中の都道府県
  isIncorrect?: boolean;                 // 不正解状態フラグ（自動フォーカス起動用）
  qIdx?: number;                         // 問題インデックス（問題切り替え時のリセットトリガー用）
}
```

#### Bounds 計算 & 座標変換ロジック
1. `japan.topojson` 内の FeatureCollection より、正解 (`highlightCorrect`) および 誤選択 (`selectedNames`) の都道府県の全 Geometry 座標を抽出。
2. TopoJSON 経緯度 `[lng, lat]` の最小・最大値 `[minLng, minLat, maxLng, maxLat]` を取得。
3. `ComposableMap` の標準プロジェクション（`geoMercator` または `geoAlbers`）による Bounding Box または Viewport 座標へ変換。
4. コンテナサイズ（幅・高さ）に対して、対象領域が画面の 70% 程度を占める最適 `targetScale`（1〜8 の範囲）と中心位置合わせ用 `targetTranslate` (`{ x, y }`) を計算。
5. `scale` と `translate` を更新し、CSS の smooth transition (`transition: transform 500ms cubic-bezier(0.16, 1, 0.3, 1)`) でアニメーション移動。
6. **問題リセット処理**: `qIdx` が変化して新しい問題に進んだ際（または `isIncorrect` が `false` に戻った際）、手動ズーム/パン位置をリセットし、`scale: 1, translate: { x: 0, y: 0 }` に確定スムーズ復元。

---

### 1.3 `QuizRunner.tsx` (クイズ進行オーケストレーション)

- `feedback === 'incorrect'` の場合、`JapanMap` / `MunicipalityMap` へ `isIncorrect={true}` を渡す。
- 問題切り替え時のリセットを確実にシグナルするため、`qIdx`（問題インデックス）を各地図コンポーネントに伝達する (`qIdx={qIdx}`)。
- これにより、正解判定時（`isIncorrect` が `false` のままのケース）や手動ズーム操作後でも、`advanceQuestion` による問題遷移 (`qIdx` インクリメント) で確実に初期カメラ構図へのリセット Effect がトリガーされる。

---

## 2. 処理フロー図 (Workflow)

```mermaid
sequenceDiagram
    autonumber
    actor User as ユーザー
    participant QR as QuizRunner
    participant Map as MapComponent (Mode A/D)
    participant GM as GoogleMaps / SVG State

    User->>QR: 解答をタップ / 時間切れ
    QR->>QR: 判定 (isCorrect = false)
    QR->>QR: setFeedback('incorrect')
    QR->>Map: props更新 (isIncorrect=true, highlightCodes, wrongCodes)
    
    Map->>Map: 正解 & 誤タップの Bounds / 座標範囲を計算
    Map->>GM: fitBounds / transform(scale, translate)
    GM-->>User: 500ms で正解・誤り位置へスムーズズームフォーカス
    
    Note over User,GM: 1500ms のフィードバック時間中、正解位置を注視・復習
    
    QR->>QR: advanceQuestion()
    QR->>Map: props更新 (isIncorrect=false)
    Map->>GM: 初期都道府県 Bounds / scale:1 にリセット
```

---

## 3. テスト計画 (Testing Plan)

1. **ロジック単体テスト (`__tests__/lib/map/autofocus.test.ts`)**:
   - 複数座標・複数ポリゴンから正確な Union Bounding Box が算出できるか。
   - `scale` と `translate` の計算において 0 除算や 範囲外 (`scale < 1`, `scale > 8`) のガードが動作するか。
2. **コンポーネント統合テスト (`__tests__/components/map/autofocus-integration.test.ts`)**:
   - **前提条件**: Client Component マウントおよび `google.maps` / SVG 連携検証用 DOM テスト環境（`happy-dom` または lightweight DOM harness + Maps API Mock）の定義。
   - **不正解フォーカス**: 不正解時 (`isIncorrect: true`) に `fitBounds` または `setTranslate` が適切に呼ばれ、`idle` リスナで zoom 12 クランプが発動するか。
   - **正解時の否定テスト (FR-03.1)**: 初期表示 (`idle`) でコンポーネントをマウントして初期表示 `fitBounds` の呼び出しを確認後、スパイをクリア (`spy.mockClear()`) し、同一 `qIdx` のまま正解判定 (`isIncorrect: false` / `feedback === 'correct'`) へ再レンダリングした際、追加の `fitBounds` や SVG transform 呼び出しが発生しないことを確認。
   - **問題遷移リセット**: `qIdx` 更新（新しい問題遷移）時にカメラ位置および zoom / translate が初期構図へリセットされるか。
3. **回帰テスト・品質検証**:
   - `pnpm type-check`
   - `pnpm test`
   - `pnpm lint:ratchet`
