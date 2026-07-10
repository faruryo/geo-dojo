# Research: 今日のおすすめクイズにおける地域選択（絞り込み）機能の改善

本ドキュメントでは、「今日のおすすめクイズ」の地域選択をポジティブな絞り込み（地方・都道府県）にするための設計上の決定事項と技術的調査結果をまとめる。

## 調査した課題

1. **「地方」および「都道府県」のポジティブ選択 UI の実現方法**
   - 現在の UI（`RecommendOverride`）は「除外する地方」を横並びのボタンでトグルするのみである。
   - モバイル幅（375px基準）に収めつつ、47都道府県を直感的に選択させるためのコンパクトなUIが必要。
2. **既存クイズプレイ画面（`page.tsx`）への設定の引き継ぎ方法**
   - 調整ダイアログで絞り込んだ地域設定を、遷移先のクイズプレイ画面（`/quiz/municipality/[mode]?region=...`）にどう引き継ぐか。
3. **データフィルタリングロジックの修正**
   - クライアントサイドでの出題構築ロジック（`buildQuestions`）を都道府県レベルのフィルタに対応させる。
4. **LocalStorage を用いた永続化**
   - ユーザーが選択した絞り込み条件を LocalStorage に保存し、次回起動時にも復元する。

---

## Technical Decisions

### Decision 1: ポジティブトグルによる地域・都道府県選択 UI

- **決定内容**:
  - `RecommendOverride` コンポーネント内の「除外する地方」セクションを、「対象地域」セクションへ刷新する。
  - 「地方」の選択肢（トグルボタン）を提供し、いずれかの地方が選択された場合、その地方に属する都道府県がリスト表示され個別にトグルで有効/無効化できるようにする。
  - 地方がどれも選択されていない、または「全国」が選択された場合は、都道府県リストは表示せず、全国の市区町村を出題対象（無制限）とする。
- **理由**:
  - 47都道府県を最初からすべて並べるとモバイル画面で縦に長くなりすぎるが、選択された「地方」に属する都道府県のみを動的に開閉表示することで、縦スクロールを最小限に抑えつつ直感的な操作が可能となる。
  - 「除外する地方」のネガティブ方式より、対象を「選ぶ」ポジティブ方式のほうがユーザーにとって直感的である。

### Decision 2: クエリパラメータ `prefectures` の新設

- **決定内容**:
  - 遷移先 URL のクエリパラメータに `prefectures` を新設し、カンマ区切りで選択された都道府県名（例: `?prefectures=宮城県,福島県`）を渡す。
  - 地方が選択され、かつ特定の都道府県が絞り込まれていない場合は、従来どおり `region` パラメータ（例: `?region=東北`）を使用する。
  - `page.tsx` 側では両パラメータを解析して初期設定（`Settings`）を構築する。
- **理由**:
  - `region` パラメータに都道府県名を混在させることも可能だが、型（`Region` は '全国' | '東北' などの固定値）を壊さず、明示的にパラメータを分離したほうがパースやデバッグが容易になる。

### Decision 3: クライアントサイドフィルタ（`buildQuestions`）の拡張

- **決定内容**:
  - `Settings` インターフェースに `prefectures: string[]` プロパティを追加する。
  - `buildQuestions` 内で以下のようにフィルタリングを適用する：
    ```typescript
    const isPrefecturesFiltered = settings.prefectures && settings.prefectures.length > 0;
    const byRegion = isPrefecturesFiltered
      ? source.filter((m) => settings.prefectures.includes(m.prefecture))
      : filterByRegions(source, settings.regions);
    ```
- **理由**:
  - 既存の推薦 Server Action（`getRecommendation`）は全体の学習統計から問題リスト（`codes`）を推薦するため、そこからクライアントの `buildQuestions` で地域フィルタを最終適用して出題数を制限するのが、既存APIを変更せずに実現する最も安全かつ低リスクなアプローチである。

### Decision 4: LocalStorage による設定の永続化

- **決定内容**:
  - キー名 `geodojo-recommend-region-filters` を使用して、選択された地方および都道府県リストを LocalStorage に保存する。
  - クイズ開始ボタン（`handleStart`）を押したタイミング、または設定を変更したタイミングで保存し、`RecommendOverride` のマウント時に初期値として復元する。

---

## Alternatives Considered

### Alternative A: サーバーサイド推薦 API に都道府県フィルタパラメータを追加する

- **不採用理由**:
  - `getRecommendation` 自体を修正して DB クエリ側で絞り込むことも可能だが、推薦エンジン（`lib/quiz/recommendation/engine.ts`）に地方・都道府県の複雑な絞り込みロジックを持ち込む必要があり、変更範囲と回帰リスクが大きくなる。
  - すでにクライアント側に全マスタ（`allMunicipalities`）が存在するため、クライアントサイドでのフィルタ適用で十分高速（O(N)で1ms未満）に動作する。

### Alternative B: アコーディオン UI ライブラリの導入

- **不採用理由**:
  - 憲法原則（III. ロジック & UI）に基づき、新規パッケージの追加を避け、React の素の `useState`（`isExpanded` のトグル）と Tailwind のトランジションのみでシンプルな折りたたみUIを構築する。
