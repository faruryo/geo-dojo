<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at specs/007-random-review-order/plan.md

Backlog（将来の spec 候補）は specs/backlog.md に管理
<!-- SPECKIT END -->

プロジェクト全体（技術スタック・コマンド・DB・本番障害の教訓など）は AGENTS.md を参照。

## 実装の進め方

実装にあたってはトークンを節約するために Opus/Sonnet を適切にサブエージェントとして切り出して実行し、このメインセッションは設計と監査、レビューに専念してください。実装難易度が特に高いところはこのセッションでやってよいです。
