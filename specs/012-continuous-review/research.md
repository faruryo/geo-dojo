# Research: 復習の連続プレイ

本ドキュメントでは、「復習の連続プレイ」機能を実現するための設計上の決定事項と技術的調査結果をまとめる。

## 調査した課題

1. **出題構築ロジックの再利用方法**
   - `app/(app)/quiz/review/page.tsx` の `useEffect` 内に、Mode A（同名グルーピング）・Mode B/C/D（選択肢生成）の出題構築ロジックが約65行インラインで書かれている。「続けて復習する」を実装するには、このロジックをもう一度呼ぶ必要がある。
2. **残り件数の取得方法**
   - US2（FR-009）は結果画面に期日を迎えている残数を表示する必要がある。新規クエリを追加すべきか、既存のダッシュボード用サマリクエリを再利用できるか。
3. **due 判定ロジックの重複**
   - JST 暦日境界での due 判定（`userId` + `status='reviewing'` + `dueDate < 明日0時`）が `getDueReviewItems`（review/actions.ts）と `getDueReviewSummaryData`（dashboard/queries.ts）の2箇所に重複している。B013（due 境界の不一致でダッシュボード表示矛盾）の再発リスクがある状態で、本機能がこの領域に触れる。
4. **バッチ間の成績非合算の担保方法**
   - 複数バッチを連続プレイしても、結果画面には常に直近バッチのみの成績を表示する必要がある（FR-005）。

---

## Technical Decisions

### Decision 1: 出題構築ロジックを純粋関数として抽出する

- **決定内容**: `buildReviewQuestions(items: DueReviewItem[], allMunicipalities: Municipality[]): Question[]` を `lib/quiz/review-questions.ts` に抽出する。`ReviewPage` はこの関数を `loadBatch()`（新設）から呼び出し、マウント時と「続ける」ボタンの両方で共有する。
- **理由**: AGENTS.md の `lib/quiz/` は「クイズ・推薦エンジン（純粋関数）」の置き場として既に確立されている（`municipality-data.ts` 等）。出題構築は入力（due items + マスタ）から出力（Question[]）が決定的に定まる純粋関数であり、抽出により単体テスト可能になる。65行の複製を避けるためにも構造的に必須。

### Decision 2: 残数表示は既存の `useDueReviewSummary`（TanStack Query）を再利用する

- **決定内容**: 新規の「件数専用」Server Action は追加しない。既存の `getDueReviewSummary()`（`app/(app)/dashboard/actions.ts` → `getDueReviewSummaryData`）が返す `dueCount` をそのまま使う。`ReviewPage` で `useDueReviewSummary()` フックを呼び出し、`onComplete` 時の `queryClient.invalidateQueries({ queryKey: ['dashboard', 'srs-summary'] })`（既存コード）による再フェッチ後の値を結果画面で表示する。
- **理由**:
  - `saveMunicipalityQuizResult`（`app/(app)/quiz/municipality/actions.ts`）がバッチ内の各回答ごとに `srsRecords` を upsert し `dueDate` を更新するため、バッチ完了時点で `dueCount` を再取得すれば「そのバッチで消化した分は自然に除外された」正しい残数が得られる。クライアント側で「セッション内で消化済みのcode」を別途トラッキングする必要がない。
  - 新規クエリを追加すると due 判定ロジックの重複箇所がさらに増える（Decision 3 と矛盾する）。
  - 憲法原則 II（Read は TanStack Query）にも合致する。
- **フォールバック**: `useDueReviewSummary` は `retry: false` のため、取得失敗時は `data` が `undefined` のままとなり、続行アクションを表示しない（FR-007 を自然に満たす）。

### Decision 3: due 判定 WHERE 句を `lib/db/srs-due.ts` に共通化する

- **決定内容**: `dueReviewCondition(userId: string)` を新設し、`and(eq(srsRecords.userId, userId), eq(srsRecords.status, 'reviewing'), lt(srsRecords.dueDate, getJSTStartOfTomorrow()))` を返す。`getDueReviewItems` と `getDueReviewSummaryData` の両方でこれを使うようリファクタする。
- **理由**: 本機能は「残数表示」（Decision 2）で `getDueReviewSummaryData` の due 判定結果に依存し、「続行バッチ取得」で `getDueReviewItems` の due 判定結果に依存する。両者の境界がずれると「残り13件と表示されたのに続けたら0件だった」といった不整合が起きやすくなる。B013 は正にこの種の境界不一致が原因だったため、本機能実装のこのタイミングで共通化しておくことがリスク低減になる。
- **範囲**: `getUpcomingReviewScheduleData`（明日以降のスケジュール、`gte(...)` 側の条件）は今回の重複対象ではないため変更しない。

### Decision 4: バッチ取得（`getDueReviewItems`）は TanStack Query 化しない

- **決定内容**: `loadBatch()` は素の `async` 関数のままとし、`useQuery`/`useMutation` でラップしない。既存実装（直接 `await` して state を更新するパターン）を踏襲する。
- **理由**: 出題構築はクライアント側で `shuffle()`（ランダム）を伴うため、呼ぶたびに異なる結果を生成する「一度きりの取得」であり、TanStack Query が想定する「同一キーでキャッシュ・再利用する表示データ」とは性質が異なる。`loadBatch()` は「続ける」ボタン押下のたびに明示的に再実行される必要があり、`phase` state による手動のローディング制御で十分にシンプルに実現できる。憲法原則 II の「Read は TanStack Query」は主にダッシュボード等のキャッシュ対象データを指しており、本フローの性質とは異なると判断した。

### Decision 5: バッチ間の成績非合算は既存の置き換えパターンをそのまま踏襲

- **決定内容**: `onComplete` 内の `setResults(completedResults)` は既存のまま（追記ではなく置き換え）。「続ける」を押した際に新たに `loadBatch()` を呼ぶだけで、次のバッチの `onComplete` が呼ばれるまで `results` は古い値を保持するが、表示は `phase === 'result'` のときのみなので実害はない。
- **理由**: 既存実装が既に「置き換え」であり、FR-005 を満たすための追加実装は不要。

---

## Alternatives Considered

### Alternative A: 残数取得専用の新規 Server Action を追加する

- **不採用理由**: Decision 2 の通り、既存の `getDueReviewSummary()` で必要な値（`dueCount`）がそのまま得られる。新規アクションは due 判定ロジックの重複を増やすだけで便益がない。

### Alternative B: 出題構築ロジックをカスタムフック（`useReviewBatch`）として抽出する

- **不採用理由**: 状態管理（`phase`/`questions`/`results`）は `ReviewPage` に閉じたままで十分にシンプルであり、フック化してもテスト容易性は変わらない（`buildReviewQuestions` を純粋関数として抽出すれば単体テストは書ける）。フック化は抽象化の追加コストに見合わないため、まずは純粋関数抽出に留める。

### Alternative C: due 判定の共通化を見送り、本機能はロジック重複を許容する

- **不採用理由**: 本機能は「残数表示」と「続行バッチ取得」という、due 判定に依存する2つの新しい参照ポイントを結果画面という同一UI上で並べて見せる。境界がずれた場合のユーザー影響（「残り13件と出たのに0件だった」）が直接可視化されるため、B013 と同種の不整合を作り込むリスクを見過ごせない。共通化のコストは小さい（WHERE句の抽出のみ）ため実施する。
