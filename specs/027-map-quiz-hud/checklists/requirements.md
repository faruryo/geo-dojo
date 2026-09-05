# Specification Quality Checklist: 地図クイズのフルスクリーン HUD

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-04
**Updated**: 2026-09-05（Claude Design での試作を反映後に再判定）
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
  - 例外を1つ許容: FR-032 で Google Maps の帰属表示に言及。これは実装選択ではなく外部の利用規約由来の制約であり、要件として明示しないと守られないため残す。
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification
  - Assumptions 末尾に「プレイ中を別ルートに分割しない」という構成上の前提を残している。plan の選択肢を1つ閉じるための記述であり、意図的。

## Notes

### 初版で合意した内容

- 端配置（中間領域に常時表示を置かない）、プレイ中はヘッダー/ボトムナビ非表示、下端にお題と A の確定、HUD は現行より小さく、4択のみのセッション・設定は対象外。

### 設計レビューで確定した内容（初版からの差分）

1. **画面ごとの効果差を明記**（前提セクション）。全国 SVG 地図（A・都道府県）は縦横比が固定で、縦に広げても地図は大きくならない。HUD の意匠は3画面で統一し、地図の拡大は D でのみ達成する。全国地図の縦画面最適化は B026 に分離。
2. **レイアウト切替はセッション単位**（FR-004）。復習セッションの A/B/C/D 混在（`lib/quiz/review-questions.ts`）と、D の地図読込失敗による4択フォールバック（FR-005）を同じルールで解決。US4 と SC-009 を追加。
3. **帰属表示**: Google Maps のロゴ・著作権表記を隠さない（FR-032）。国土数値情報 / e-Stat の出典はプレイ中は非表示とし、常設ページへの移設を本 spec のスコープに含める（FR-041）。
4. **既存の地図コントロールとの衝突**: ズームボタンを右側面の垂直中央へ（FR-033）。
5. **自動フォーカス（016）の可視領域**を HUD とセーフエリアを除いた矩形に限定（FR-034）。既存の固定 padding をそのまま流用させないため要件化。
6. **情報要素の棚卸し表**（FR-040）。正解数と難易度バッジは廃止、残り時間（D）と経過タイム（都道府県 TA）は別要件として書き分け（FR-011 / FR-012）、選択中バッジ列は件数1行に集約（FR-028）。
7. **下端 HUD の高さ固定**（FR-027 / SC-008）。親指の直下でレイアウトが動くことによる次問の誤タップを防ぐ。
8. **中断の誤爆対策**（FR-014）。プレイ中は出口が中断1つに減るため、44px 以上＋確認1段。
9. **HUD 背景の不透明度**（FR-035）。地図の塗り色によらず可読にする。
10. **横向きは対象外**と明記（FR-008）。
11. **Success Criteria を数値化**。SC-001（HUD 合計高さ ≤ 25%）、SC-002（16px / 44px）、SC-006（HUD 外でのパン・ピンチ）、SC-007（D の地図面積 130% 以上）、SC-008、SC-009 を追加。SC-007 は前提のとおり D のみに適用する。

### Claude Design での試作で確定した内容（第2ラウンド）

claude.ai/design 上で geo-dojo のデザインシステムを使って実際に画面を組み、
数値を測りながら決めた。プロジェクト: https://claude.ai/design/p/3486da18-8598-4fd5-a7c3-5bd7f642b821

1. **下端の帯が大きすぎる**という指摘から、3案（現行の不透明帯／グラデーション／浮かせカード）を
   比較。デスクトップ 1440px では現行の厚い帯が破綻する（中身が左端に残り右に 1200px の空白）ことが
   分かり、案A は脱落。
2. **透過は不採用**。すりガラス（不透明度 66% + blur 18px）を試したが、下地の地図の明度を拾うため
   明るい Google Maps タイルの上でコントラストが 4.7〜5.2:1 まで低下。暗い SVG 地図との間で挙動が
   安定せず、弱視向けの 7:1 を数値で保証できない。FR-035 を完全不透明に改めた。
3. **お題の導入表示**（中央・大 → 下端・小）を採用。読む必要があるのは出題直後だけという整理から、
   定常状態を 1行 16px・帯 44px まで縮小。上下の帯の合計が 96〜104px（11.8〜12.8%）となり、
   SC-001 を 25% から 15% に引き上げた。透過に頼らずサイズで解決した形。
4. **再表示（FR-022）と reduced-motion（FR-023）は導入表示とセット**。導入表示だけだと難読地名や
   弱視の利用者が読み取れないため、この2つが揃って初めて成立する。
5. **導入表示の完了後に開始するのは場所当ての制限時間だけ**（FR-024）。当初は都道府県タイムアタックの
   経過タイムも同様にする案だったが、コードを確認して取り下げた。`answerTimeMs` は
   `use-quiz-state.ts` の `startTimeRef` が `qIdx` 変化時にリセットされる形で計測され、
   `lib/quiz/srs/quality.ts` の 10 秒判定を経て SM-2 の quality=5（EF 加速・早期卒業）に効く。
   起点を遅らせると速答の窓が実質 9 秒前後に縮み、FR-050（SRS の意味を変えない）に反する。
   タイムアタックの経過タイムも、localStorage の自己ベストと比較不能になるため現行どおりとする。
6. **よみがなの行が抜けていた**のを発見（FR-026）。`feedback-labels.ts` の3形のうち最長形は
   375px で折り返すため、フィードバック時の高さはその状態を基準に決める。
7. **正否は色付きアイコン、文字は白**（FR-037）。`#ef4444` を文字色にすると 5.02:1 で弱視向けの
   7:1 に届かないため。アイコンは非テキスト基準 3:1 で通る。地図の正解塗り `#4a7c59` は 3.88:1 で
   文字には使えない。
8. **確定ボタンの下にスクリムは不要**（FR-036）。ボタンは自前の塗りを持つ。当初これを見落として
   不透明域を 80px に広げさせたが、48px で足りる。
9. **帰属表示は場所当て（D）のみ**（FR-032）。県当て・都道府県は国土数値情報の SVG で Google Maps を
   使わないため不要。D では帯を最下端に密着させ、地図コンテナを帯のぶん縮めることで、帯の下に
   地図が覗く隙間をなくす。
10. **実装のない情報を出さない**（FR-052）。試作で「不正解 — 3.2km ずれ」が生成されたが、Mode D の
    判定は `isModeDTapCorrect` によるコード一致のみで距離を測っていない。

### 第3ラウンドで確定した内容

- **導入表示の長さは固定値**とする。将来ユーザー設定で短縮（例: 0.2 秒）できるようにする余地は
  spec に残したが、今回は設定項目を設けない。
- **027 と B026 は続けて実施する前提**とする。B026 を実施しないと、県当て・都道府県では地図が
  広がらず、Issue #82 の動機が3画面のうち2つで満たされないままになる。
- **FR 番号の参照ずれを 4 箇所修正**（PR #83 のレビュー指摘）。下端 HUD を FR-020〜029 に振り直した
  際、棚卸し表と本 Notes からの参照が旧番号のまま残っていた。

### 未決

- なし。実装時に実機の Google Maps タイル上でコントラストを再確認すること（試作の明るい地図は
  CSS による近似であり、実タイルではない）。
