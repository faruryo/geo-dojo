# design-sync notes — geo-dojo

geo-dojo は Next.js アプリであってコンポーネントライブラリではない。以下は
その前提から生じた回避策で、再同期でも必要になる。

## この repo 固有の事情

- **`dist/` もライブラリビルドも無い。** `pnpm build` は `next build` で、
  取り込める成果物を出さない。コンバータはソースからバンドルを合成する。
- **`node_modules/geo-dojo` が要る。** コンバータは `node_modules/<pkg>` を
  探す。`ln -sfn ../ node_modules/geo-dojo` で自己参照リンクを張ること
  （pnpm install のたびに消えうる）。
- **エントリは `.design-sync/entry.tsx`（手書き・コミット対象）。**
  srcDir 丸ごとの自動合成だとサーバ側コードまで巻き込むため、載せるものを
  明示している。コンポーネントを足すときはここと `componentSrcMap` の両方。
- **`process` シム。** `.design-sync/overrides/bundle.mjs` は `lib/bundle.mjs`
  のフォークで、`banner` に `globalThis.process ||= { env: {} }` を足すだけ。
  next/link・next/dynamic と `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` が `process` を
  読むため、無いと IIFE が即死して `window.GeoDojo` が空になる。
  兄弟 import は `../../.ds-sync/lib/common.mjs` に書き換えてある。
  `ln -sfn ../.ds-sync/node_modules .design-sync/node_modules` も必要。
- **CSS は自前で焼く。** `app/globals.css` は `@import "tailwindcss"` のままで
  実体が無い。`node .design-sync/build-css.mjs` が Tailwind CLI で
  `.design-sync/tailwind.css` を生成し、`.dark` のトークンを `:root` に昇格
  させる（アプリは `<html class="dark">` 固定、プレビューにはその class が無い）。
  **ソース編集後は毎回これを流してから build すること。**
- **`.d.ts` は `cfg.dtsPropsFor` が正。** 型ルートが無く自動抽出が
  `[key: string]: unknown` になるため、各コンポーネントの `Props` を
  ソースから移植してある。props を変えたら手で追随が必要。

## 同期対象外（意図的）

ブラウザにバンドルできないため 11 個を外している:

- `QuizRunner` — `use-quiz-session` を値 import → サーバアクション → drizzle → postgres
- dashboard のデータ取得カード（`SummaryCards` `AccuracyChart` `CompletionChart`
  `CompletionProgress` `DifficultyProgress` `ReviewCard` `StreakDisplay`
  `WeaknessRanking` `DashboardClient`）と `UpcomingReviewMini`
  — `lib/hooks/*` が同じ経路でサーバアクションを呼ぶ

これらを入れたい場合は、サーバアクション層を空モジュールに差し替える
プラグインを `overrides/bundle.mjs` に足し、`cfg.provider` に
QueryClientProvider を設定する必要がある（それでもスケルトンしか出ない）。

## Known render warns

- `FilterBar`: 地方の行が右端で切れる。実アプリでも横スクロールする行なので想定内。
- 残り 3 個は floor card。`MunicipalityMap` と `MunicipalityMapView` は
  Google Maps API キーと maps.googleapis.com への通信が要るが、プレビューは
  外部ネットワークに出られないので、何を書いても空になる（諦め）。
  `InViewMount` は視覚を持たないユーティリティ。
- **地図系プレビューは `_topology.ts` の fetch シムで動く。** `JapanMap` /
  `MiniJapanMap` / `ModeAView` は `/japan.topojson` を実行時 fetch するが、
  プレビューの箱にそのパスは無い。`.design-sync/previews/japan-topology.json`
  （`public/japan.topojson` の写し・41KB）を `window.fetch` の差し替えで返して
  いる。**元ファイルを更新したらこの写しも取り直すこと。**

## Re-sync risks

- `node_modules/geo-dojo` と `.design-sync/node_modules` のリンクは
  クローンや再インストールで消える。build 前に張り直す。
- `.design-sync/tailwind.css` は生成物で、ソースの class を変えると古くなる。
  `build-css.mjs` を流し忘れると、消えたユーティリティのぶんだけ崩れる。
- `cfg.dtsPropsFor` はソースから手で写した写しなので、props 変更に追随しない。
  型を変えたら再抽出すること。
- `.design-sync/overrides/bundle.mjs` は上流 `lib/bundle.mjs` のフォーク。
  スキル側が更新されたら差分を取り込む必要がある（足しているのは banner 1行）。
- Tailwind CLI と playwright は `.ds-sync/` に入れており、gitignore 対象。
  新しい環境では入れ直す。

## プレビューを書くときの型

`cfg.dtsPropsFor` で以下は `unknown` から実型に差し替え済み。ソース側の型を
変えたらここも直すこと。

- `MunicipalityPickerDialog.municipalities` → `Municipality[]`（code/name/prefecture/region/difficulty/kana）
- `QuizPoolProgress.stats` → `PoolStats`（totalCount/clearedCount/percentage）
- `ScopeSelector.mode` / `.scope` → `GameMode` と `MunicipalityScope`

`ScopeSelector` の「N / M 件選択中」は `selectedCount` と
`totalPrefectureCount` の**両方**を渡さないと出ない（片方だけだと
「すべての市区町村」になる）。

カード幅は 351px の枠だとグリッドからはみ出すので、
`cfg.overrides.<Name>.cardMode = "column"` を付けている。ダイアログ系は
`{"cardMode":"single","primaryStory":"Open","viewport":"390x640"}`。
