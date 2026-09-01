# Research & Architecture Decisions: Mode D 市区町村出題選択・絞り込み

## 1. 出題範囲データ構造とフィルタリング設計

### 決定事項 (Decision)
出題範囲（Scope）を管理するため、以下のデータ型を `lib/quiz/municipality-data.ts` および `lib/quiz/municipality-questions.ts` に定義する。

```typescript
export type ScopeType = 'region' | 'prefecture';

export interface MunicipalityScope {
  type: ScopeType;
  regions: Region[];          // type === 'region' の場合（デフォルト: ['全国']）
  prefecture?: string;        // type === 'prefecture' の場合（例: '長野県'）
  selectedCodes?: string[];   // type === 'prefecture' かつ個別選択時（未指定/空配列なら県内全自治体）
}
```

### 理由 (Rationale)
1. **後方互換性**: 既存の `regions: Region[]` をそのまま引き継ぎつつ、`type: 'prefecture'` の時に単一都道府県および個別自治体コードリスト（`selectedCodes`）を適用できる。
2. **純粋関数の合成**:
   - `filterByScope(allMunicipalities, scope)` を提供し、`filterByDifficulty` や `sampleMunicipalityPool` の前段で透過的にプールを絞り込める。
   - `computePoolStats`（制覇進捗計算）や `buildMunicipalityQuestions`（出題生成）がそのまま同じフィルタ結果を利用できる。
3. **他モードへの拡張性**: 将来 Mode C 等でも同様のスコープ指定が可能となる。

### 検討した代替案 (Alternatives Considered)
- **代替案 A**: `regions` に都道府県名（"長野県"）を直接混在させる。
  - 却下理由: 既存の `Region` 型（'全国' | '北海道' | '東北' ...）と都道府県型が混ざり、地方一括選択と単一都道府県選択のロジックが複雑化しバグの原因となる。
- **代替案 B**: クイズ設定ごとに別々の state / reducer を設ける。
  - 却下理由: 既存の `Settings` state を小さく拡張する方がシンプルで型安全。

---

## 2. 設定画面 UI 設計 (375px モバイルファースト)

### 決定事項 (Decision)
1. **スコープ切り替え**:
   - Mode D 設定画面の最上部に「地域で選ぶ (地方単位)」と「都道府県で選ぶ」のセグメント切り替え（タブまたはピルボタン）を配置。
2. **都道府県セレクター**:
   - 「都道府県で選ぶ」選択時、地方ごとにグループ化された都道府県選択モーダル/ドロワーまたはセレクトボックスを表示。
   - 初期値はユーザーの直前選択または「東京都」（デフォルト）。
3. **市区町村個別選択パネル (Drawer / Dialog)**:
   - 選択された都道府県名の横に「出題する市区町村を選択 (XX/YY件)」ボタンを配置。
   - タップで全画面に近いドロワー/モーダルが開き、以下を提供：
     - 検索バー（自治体名・ひらがな検索）
     - 「すべて選択」「すべて解除」クイックボタン
     - 自治体リスト（チェックボックス、自治体名、かな、難易度バッジ、制覇バッジ）
     - 「決定 (X件選択)」ボタン

### 理由 (Rationale)
- 375px モバイル画面でも、70件以上ある自治体リスト（例: 長野県77件、北海道179件）をスクロールして直感的に選択できる。
- 画面遷移せずモーダル/ドロワーで即座に設定を切り替えられるため、ストレスのない UX を実現。

---

## 3. URL クエリパラメータと状態永続化

### 決定事項 (Decision)
- URL パラメータ仕様:
  - `scope`: `region` | `prefecture` (省略時は `region`)
  - `pref`: 都道府県名 (例: `長野県`)
  - `codes`: カンマ区切りの JIS 自治体コード (例: `20201,20202,20203`)
- `localStorage` による直近設定の復元:
  - Mode D において、選択したスコープ、都道府県、カスタムコードを記憶し、次回訪問時に自動復元する。

### 理由 (Rationale)
- URL パラメータにより、特定の都道府県や市区町村特訓セットをブックマークしたりリンク共有できる。
- `localStorage` により、反復学習するユーザーが毎回都道府県を選び直す手間を排除。

---

## 4. サンプリングと制覇進捗の連動

### 決定事項 (Decision)
- `filteredPool` の計算：
  - `source = allMunicipalities`
  - `scoped = filterByScope(source, settings.scope)`
  - `filtered = filterByDifficulty(scoped, settings.difficulties)`
- `computePoolStats(filtered, 'D', clearedCodesSet, identityCodeMap)`：
  - これにより、制覇プログレスバーは「選択した自治体群の中でのクリア数 / 選択自治体総数」を正確に表示する。
- 問題数より選択自治体数が少ない場合（例: 3件選択で10問クイズ）：
  - `sampleMunicipalityPool` はプール内の3件をシャッフル・反復して10問を構成する。
  - UI に「選択した3件から繰り返し出題されます」等の注意メッセージを表示し、エラーにはしない。

