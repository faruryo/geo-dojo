# Research: 024-conquest-mode-a

## 1. 全国制覇を A / D の2本にする

### Decision
トップの制覇は `CompletionProgress` をモード固定の2本（A=県当て、D=場所当て）にする。合算スロット（`mode=all` の coverage）と B/C クリアはトップから外す。A の母数・クリアは現行 Mode A（`name` 単位、同一名除外）を流用する。D の母数・クリアは `municipality_master` 行＝市区町村コード単位（既存 `getMasterPoolSize('D')` と同じ）。

### Rationale
`lib/db/queries/dashboard.ts` の合算は A+B+C+D を1本の「全国制覇」に足している。仕様の不満の本体がこの足し算である。D の SQL 母数はすでにコード件数なので、トップを D 単独にすれば政令市の区が分母に残る。A は現行どおり北海道を分母に含む。

### Alternatives considered
- 023 の A→B クレジットで1枠にまとめる: 未実装のまま本仕様が置き換える。
- 3本目に B/C 練習バー: 仕様がトップ非表示。

---

## 2. おすすめ抽選を Fit Zone エンジンから置き換える

### Decision
`generateRecommendation` のモード決定を次の純粋関数パイプラインに置き換える（乱数は注入）。

1. `random() < 0.5` でモード A または D。
2. そのモードで開始できる地方から均等抽選。A は北海道を除く。全難易度が制覇 90% 以上の地方は捨てて引き直す。A の「全市」も北海道除外後の地方集合。
3. 選んだ地方×モードで、90% 未満のうち最も易しい難易度。
4. 抽選対象の全市が 90% 以上なら、A/D の開始できる地方×難易度マスから制覇率最小（同率は均等）。100% しか無いならその中から均等。開始不能マス（A かつ北海道。最小規則で B は出さない）は除外。
5. 出題プールは現行の未クリア優先（022）を、選ばれたモード×地方×難易度に適用。D だけコード単位。

苦戦フォールバック（下記）以外では B/C を初手で選ばない。現行の cold-start=全国 B 入門は廃止する。直近 A セッションが無いことだけが「差し替えしない」条件。

### Rationale
現行エンジンは Fit Zone・新規モード注入・回帰ガード（正答率 30% 未満）で B に寄り、A/D 半々にならない。仕様は能力未知でも入口を簡単すぎる4択にしない。

### Alternatives considered
- Fit Zone を残して重みだけ変える: A/D 50% と地方引き直しを保証できない。
- サーバーでセッションを時間窓推定（現行 `inferSessions` の 30 分結合）: FR-011 が連続 A を別セッションとするため不可。

---

## 3. 苦戦判定・差し替え1回・表示1問正規化

### Decision
「正答率が低い」は現行どおり直近セッション正答率 `< 0.3`（`evaluateProgression` の回帰ガードと同じ閾値。新閾値は作らない）。

セッション境界は DB の時間近接では切らない。クイズ開始時にクライアントで `quizSessionId` を発行し、そのランナーが保存した回答だけを1セッションとする。0問退出はセッションにしない。正答率の分母は保存した表示1問（`toQuestionResult` 相当。Mode A の複数県行は1問）のみ。未回答は入れない。中断・戻るで1問以上保存していればセッション。

苦戦メタ（直近 A の sessionId・正規化正答率・その sessionId に対する B/C 差し替え済フラグ）は既存の recommendation history localStorage を拡張して持つ。`getRecommendation` にクライアントから渡し、サーバーの抽選純粋関数へ注入する。新テーブルは作らない。`municipality_quiz_results` への `session_id` 列も必須としない（保存経路は現行の行挿入のまま）。

差し替え: A 引きかつ直近 A が低いときだけ。行き先は B/C。同じ地方×難易度の直近 B/C セッション（あるもの）がいずれも低くなければ A のまま。片方だけ低いならそれだけ。両方無いか両方低いなら B/C 均等。同じ A sessionId への差し替えは1回。D 引きでは変えない。

直近 B/C セッションも同じクライアント履歴（モード別 last session）で足りる。サーバーの `inferSessions` はおすすめ本体からは使わない。

### Rationale
仕様が「新テーブル必須としない」「時間近接で1本にまとめるな」と同時に課している。クライアント発行の sessionId が唯一、連続プレイを切れる。

### Alternatives considered
- `session_id` カラム: 正確だがマイグレーションと既存行の欠落処理が要る。仕様は必須としていない。
- 002 ダッシュボードと同じ 30 分窓: シナリオ13に反する。

---

## 4. モード D をコード単位にする（判定・地図・出題文）

### Decision
- **サンプリング / 未クリア**: `IdentityCodeMap` を B/C と D で分ける。D はコードが identity。B/C は現行 `(prefecture, normalizedName)`。
- **正誤**: `useMapAction` は `tappedName === municipality.name` をやめ、タップした `code === municipality.code`。ハイライトも出題コードと誤タップコードのみ（同一市名の全区を正解面にしない）。
- **地図**: `MunicipalityMap` は `nam_ja` での union をやめる。同一 `code` の複数ポリゴン（離島・飛地）だけマージする。政令市の区は区界のままタップできる。
- **回答前表示**: マスタの `name` は政令市が市名（例: 札幌市が全区同じ）なので区別できない。ビルド時 import のコード→区付きラベル（例: 札幌市中央区）を D の問題文・フィードバックに使う。A/B/C と `municipality_master.name` は変えない（県当て集約を壊すため）。

### Rationale
TopoJSON の `nam_ja` も全区「札幌市」である。名前マージすると先頭コード以外が選べない。名前判定だと他区タップが正解になる。ラベル用データはマスタ上書きにしない（`sync-municipality-master` の区名地雷と同じ事故を避ける）。

### Alternatives considered
- `municipality_master.name` を区名に戻す: A/B/C と 022 集約が壊れる。
- 地図に区名を描くだけで問題文は市名: FR-020 不足。

---

## 5. おすすめキャッシュの鮮度

### Decision
`useRecommendation` の `staleTime: 60_000` を、1問以上保存してセッションを抜けたあとに効かせない。クイズ側の既存 `awaitPendingSaves` 完了後に `queryKeys.recommendation()` を invalidate + refetch する（完了・中断・popstate・やり直し）。ダッシュボード再表示時に古い A/D 推薦が残らないこと。

### Rationale
仕様 FR-015。現在はヒーロー再マウントでもキャッシュ再利用が意図されている。

### Alternatives considered
- staleTime を 0 にするだけ: 未プレイの再訪問で不要フェッチが増える。退出時 invalidate の方がピンポイント。

---

## 6. トップから外す分析 UI

### Decision
`DashboardClient` から AccuracyChart、CompletionChart（合算推移）、WeaknessRanking、合算用 FilterBar、MilestoneBanner の合算 coverage、SummaryCards の「全国制覇」合算を外す。ReviewCard とおすすめと A/D バーは残す。詳細分析ページは作らない（FR-017）。

### Rationale
P2 は「無いこと」と仕様上の移管前提だけ。画面を新設するとスコープ超過。

---

## 7. モード選択ラベル

### Decision
`app/(app)/quiz/municipality/page.tsx` の `MODES` を仕様の日本語に合わせる。URL の A/B/C/D は変えない。B/C に「練習」が読める短いラベル。

### Alternatives considered
- 記号を廃止: FR-005 が記号残し。
