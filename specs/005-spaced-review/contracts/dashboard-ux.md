# Contract: Dashboard UX — 復習最上位配置 & 復習→おすすめクイズ誘導

spec FR-013/014/015 の UI レイヤー設計。
**research.md R9** が設計根拠。

---

## 1. ダッシュボードコンポーネント順序

### ファイル: `app/(app)/page.tsx`

```tsx
// ─── 常時表示 ─────────────────────────────────────────
<Title />            // "GeoDojo" + "日本地理クイズ"
<MilestoneBanner />  // summary.totalCorrect / coverageRate （条件付き）

// ─── 新規ユーザー（quiz 回答なし）────────────────────
{(!summary || summary.totalQuestions === 0) && (
  <RecommendHeroCard />   // おすすめクイズが最初のアクション
)}

<SummaryCards />  // 0件でも表示（総問題数 0 表示）

// ─── 返却ユーザー（quiz 回答あり）────────────────────
{summary && summary.totalQuestions > 0 && (
  <>
    {/* ★ 最優先アクション: 今日の復習 */}
    <ReviewRecommendations />

    {/* ★ 復習の直後: dueCount=0 で自然昇格 */}
    <RecommendHeroCard />

    <StreakDisplay />
    <AccuracyChart />
    <CompletionChart />
    <WeaknessRanking />
    <ReviewProgress />
  </>
)}
```

### 視覚的優先順の意図

| 状態 | `ReviewRecommendations` の表示 | `RecommendHeroCard` の役割 |
|------|-------------------------------|--------------------------|
| `dueCount > 0` | 「今日の復習 N件 / 復習を始める」ボタン（primary CTA） | セカンダリ（復習後のアクション） |
| `dueCount === 0` | 「今日の復習はありません 🎉 / 次の復習: X日後」 | **昇格してページ最初のアクション** |
| 新規ユーザー | 非表示（SRS レコードなし） | 唯一の CTA（現状維持） |

---

## 2. `ReviewRecommendations` コンポーネント仕様

**変更なし**。現実装（`components/dashboard/review-recommendations.tsx`）は要件を満たしている。

- `useDueReviewSummary()` で `{ dueCount, nextDueAt }` を取得
- `dueCount > 0`: カウント + 「復習を始める」ボタン → `/quiz/review` へ遷移（FR-014, SC-001）
- `dueCount === 0`: 「今日の復習はありません 🎉」+ `nextDueAt` 案内（FR-015）

---

## 3. 復習セッション結果画面の CTA

**変更対象**: `app/(app)/quiz/review/page.tsx`（`phase === 'result'` セクション）

### 現在（変更前）

```tsx
<Link href="/">
  <Button className="w-full">ダッシュボードへ</Button>
</Link>
```

### 変更後

```tsx
{/* primary: おすすめクイズへ */}
<Link href="/?recommend=open">
  <Button className="w-full">✨ 今日のおすすめクイズを試す</Button>
</Link>

{/* secondary: ダッシュボードへ戻るだけ */}
<Link href="/">
  <Button className="w-full" variant="outline">ダッシュボードへ</Button>
</Link>
```

### 動作フロー

1. 学習者が復習セッション完了 → 結果画面（`phase === 'result'`）
2. 「✨ 今日のおすすめクイズを試す」タップ
3. `/?recommend=open` へ遷移 → `RecommendHeroCard` が `useSearchParams` で `?recommend=open` を検知
4. `RecommendSheet` が自動開放（`recommend-hero-card.tsx:openSheet` 既存ロジック）
5. 学習者がおすすめクイズを確認して即開始

---

## 4. 要件との対応

| 本 contract | 充足する要件 |
|------------|-------------|
| ReviewRecommendations を最上位配置 | SC-001（3タップ以内で復習開始）、FR-013, FR-014 |
| `dueCount=0` 時に RecommendHeroCard が昇格 | FR-015（今日なし→次の案内）+ 復習後のおすすめクイズ誘導 |
| 結果画面の「おすすめクイズ」CTA | spec Assumptions「入口」、学習継続率向上 |
