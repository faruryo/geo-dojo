# Research: 復習セッションの同日ガード条件適正化

## 調査背景

復習セッション完了後に「続けて復習する」ボタンの残り件数が減らず、全く同じ問題が繰り返し出題される無限ループ不具合が発生した。

## 課題の分析と意思決定

### 1. 同日ガード（`alreadyAdvancedToday`）のスキップ判定

- **問題点**:
  - `alreadyAdvancedToday` は `formatJSTDate(lastReviewedAt) === formatJSTDate(now)` のみで判定していた。
  - 今日回答履歴がある（または今日作成された）が、復習期日（`dueDate < JST翌日開始`）を迎えているアイテムに正解しても、`{ kind: 'skip' }` が返り DB の更新がスキップされていた。
- **決定**:
  - `alreadyAdvancedToday` に `dueDate` を含め、「`lastReviewedAt` が今日（JST）かつ `dueDate >= JST翌日開始`（すでに前進済み）」の場合のみ `true`（スキップ）を返すようにする。
  - `dueDate < JST翌日開始`（期日到来中）の場合は、今日回答履歴があっても正解で前進させる。
- **代替案の検討**:
  - *代替案A: 復習セッション専用の flag（`isReviewSession: boolean`）を渡し、復習セッション時は同日ガードをバイパスする*
    - 却下理由: FR-005a（どのクイズでも期日・前進ルールは一貫）の設計原則に反し、通常クイズで期日到来中の問題に正解した場合に前進しなくなってしまう。
  - *採択案: ドメイン状態（`dueDate` が期日到来中かどうか）で一貫して判断する*
    - クイズ種別によらず、期日到来中のアイテムは正解で前進し、前進済みのアイテムは同日中の重複前進を防ぐ。

### 2. `everWrong` の論理反転修正

- **問題点**:
  - `upsertSrsRecord` 内で `let everWrong = true; if (input.isCorrect) { ... everWrong = !wrongRow; }` と記述されていた。
  - `wrongRow`（誤答レコード）が存在する場合、`!wrongRow` は `false` になり、誤答履歴があるのに「誤答なし」として早期卒業判定されてしまっていた。
- **決定**:
  - `everWrong = Boolean(wrongRow)`（または `!!wrongRow`）に修正し、誤答履歴がある場合は `everWrong = true`、ない場合は `everWrong = false` とする。
