# Server Actions Contract: GeoDojo MVP

**Generated**: 2026-05-06
**Note**: 全ての書き込み操作は Next.js Server Actions で実装する（憲法 II 条 — Write = Server Actions）。

---

## submitRating

SRS 評価を送信し、次回出題日を更新する。

**File**: `app/(app)/study/actions.ts`

**Signature**:
```typescript
export async function submitRating(
  cardId: string,
  rating: 1 | 3 | 5
): Promise<{ nextDueDate: Date; interval: number }>
```

**Business rules**:
- SM-2 簡略化アルゴリズムで interval・dueDate を計算（research.md R-001 参照）
- `srs_records` が存在しない場合は INSERT、存在する場合は UPDATE
- 認証必須（未認証の場合は Error をスロー）

**Error cases**:
- `cardId` が存在しない → `Error("Card not found")`
- `rating` が 1/3/5 以外 → `Error("Invalid rating")`
- 未認証 → `Error("Unauthorized")`

---

## createCard

手動でカードを作成する（US3）。

**File**: `app/(app)/cards/new/actions.ts`

**Signature**:
```typescript
export async function createCard(input: {
  notes: string;
  tags: string[];
  imageUrl?: string;    // Supabase Storage にアップロード済みの URL
  panoId?: string;      // Street View pano_id（任意）
  annotations: Array<{
    xRatio: number;     // 0.0〜1.0
    yRatio: number;     // 0.0〜1.0
    label: string;
  }>;
}): Promise<{ cardId: string }>
```

**Business rules**:
- `imageUrl` と `panoId` の両方が未指定でも作成可能（テキストカード）
- annotations は 0 件以上（上限なし）
- カード作成と同時に srs_records を初期状態（interval=1, dueDate=今日）で INSERT
- 認証必須

**Error cases**:
- `notes` が空かつ annotations が 0 件 → `Error("Card must have notes or annotations")`
- `xRatio` または `yRatio` が 0.0〜1.0 の範囲外 → `Error("Annotation coordinates out of range")`
- 未認証 → `Error("Unauthorized")`

---

## deleteCard

カードを削除する（CASCADE で annotations と srs_records も削除）。

**File**: `app/(app)/cards/actions.ts`

**Signature**:
```typescript
export async function deleteCard(cardId: string): Promise<void>
```

**Business rules**:
- 自分のカードのみ削除可能（RLS で強制）

---

## approveCandidate

AI生成候補を承認してカード化する（US4）。

**File**: `app/(app)/ai-review/actions.ts`

**Signature**:
```typescript
export async function approveCandidate(
  candidateId: string,
  edits?: {
    notes?: string;
    tags?: string[];
  }
): Promise<{ cardId: string }>
```

**Business rules**:
- `ai_candidates.status` を `'approved'` に更新
- `edits` がある場合は上書き、ない場合は suggested 値をそのまま使用
- 新しい `cards` レコードを INSERT（`imageUrl` と `panoId` は候補から引き継ぐ）
- 新しい `srs_records` を初期状態で INSERT
- 認証必須・自分の候補のみ

**Error cases**:
- 候補が存在しない → `Error("Candidate not found")`
- 既に approved/rejected → `Error("Candidate already processed")`

---

## rejectCandidate

AI生成候補を却下する（US4）。

**File**: `app/(app)/ai-review/actions.ts`

**Signature**:
```typescript
export async function rejectCandidate(candidateId: string): Promise<void>
```

**Business rules**:
- `ai_candidates.status` を `'rejected'` に更新（物理削除しない）
- 認証必須・自分の候補のみ

---

## updateCardTags

カードのタグを更新する。

**File**: `app/(app)/cards/actions.ts`

**Signature**:
```typescript
export async function updateCardTags(
  cardId: string,
  tags: string[]
): Promise<void>
```

**Business rules**:
- タグは最大 20 件まで
- 空配列で全タグ削除可能
- システムタグ（都道府県・地方・特徴カテゴリ）とユーザータグの区別はクライアント側で行う
