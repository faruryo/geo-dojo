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

## saveMunicipalityQuizResult

市区町村クイズの回答結果を記録する（US5）。

**File**: `app/(app)/quiz/municipality/actions.ts`

**Signature**:
```typescript
export async function saveMunicipalityQuizResult(input: {
  municipalityCode: string;
  municipalityName: string;
  prefecture: string;
  mode: 'A' | 'B' | 'C' | 'D';
  isCorrect: boolean;
}): Promise<void>
```

**Business rules**:
- 認証必須
- 同名市区町村の全選択モードでは、各選択（各 code）ごとに個別に呼び出す
- `municipality_quiz_results` テーブルに INSERT（累積記録）

**Server-side input validation（必須）**:
1. `mode` が `'A' | 'B' | 'C' | 'D'` のいずれかであること（ホワイトリスト検証）
2. `municipalityCode` が `public/municipalities.json` に存在する有効な団体コードであること
   - 起動時にサーバー側でロードした `Set<string>` に対して `has()` で検証
   - これにより spam・苦手データ汚染（架空のコードで weight を歪める攻撃）を防ぐ
3. `municipalityName` と `prefecture` が `code` に対応するマスタデータと一致すること（不一致なら警告ログのみ、保存は code を信頼）
4. `isCorrect` は boolean 型に厳格化（truthy 値の暗黙変換を許可しない）

**Rate limiting（必須）**:
- 既存の `app/api/image-proxy/route.ts` と同じインメモリレート制限を適用
- ユーザーあたり 60 件/分（クイズの自然な回答ペースを大きく超える値を遮断）
- 超過時は `Error("Rate limit exceeded")` をスロー
- レート超過は警告ログ出力（DoS 兆候の検出用）

**Error cases**:
- 未認証 → `Error("Unauthorized")`
- `mode` が A/B/C/D 以外 → `Error("Invalid mode")`
- `municipalityCode` がマスタに存在しない → `Error("Invalid municipality code")`
- レート制限超過 → `Error("Rate limit exceeded")`

**Note（MVPの設計判断）**: `isCorrect` の真正性はクライアント任せ。自分のデータを偽装しても自分の学習データが歪むだけで他者への影響はない。将来ランキング機能を追加する場合はサーバー側で正解判定する設計に変更する必要がある。

---

## getMunicipalityWeakness

苦手な市区町村リストを取得する（苦手優先モード用）。

**File**: `app/(app)/quiz/municipality/actions.ts`

**Signature**:
```typescript
export async function getMunicipalityWeakness(): Promise<Array<{
  municipalityCode: string;
  municipalityName: string;
  prefecture: string;
  errorRate: number;  // 0.0〜1.0
}>>
```

**Business rules**:
- 直近 100 件の結果から不正解率を計算
- 認証必須・自分の結果のみ
- errorRate > 0 の市区町村のみ返す（空の場合は []）

---

## getMunicipalityMaster

市区町村マスタ（難易度バケット付き）を取得する（US6 設定画面・出題プール構築で使用）。

**File**: `app/(app)/quiz/municipality/actions.ts`（既存ファイルに追加）

**Signature**:
```typescript
export async function getMunicipalityMaster(): Promise<MunicipalityMaster[]>
```

**Business rules**:
- 認証必須（個人データではないが未認証アクセスは弾く）
- 全件返却（約1,900件、JSON 約 300KB）
- レスポンスはサーバー側で 1 時間キャッシュ可能（`unstable_cache` または HTTP `Cache-Control`）
- `municipality_master` テーブルが空の場合は空配列を返し、クライアント側で「データ準備中」表示

**Error cases**:
- 未認証 → `Error("Unauthorized")`

**Client usage**:
```ts
// lib/hooks/useMunicipalityMaster.ts
'use client';
import { useQuery } from '@tanstack/react-query';
import { getMunicipalityMaster } from '@/app/(app)/quiz/municipality/actions';

export function useMunicipalityMaster() {
  return useQuery({
    queryKey: ['municipality-master'],
    queryFn: getMunicipalityMaster,
    staleTime: 60 * 60 * 1000, // 1h
  });
}
```

---

## バッチスクリプト契約: scripts/sync-municipality-master.ts

server action ではなく **Node.js スタンドアロンスクリプト**として実装する。開発者のローカル PC で手動実行する想定（Vercel・Supabase 上では動かない）。

**実行コマンド**:
```bash
pnpm tsx scripts/sync-municipality-master.ts
```

**実行頻度**: 国勢調査公表時（5年に1回）+ 自治体合併・改称があった都度（年数件）

**前提環境変数**（`.env.local` から読む）:
- `DATABASE_URL`: Supabase Pooler 接続文字列（Server Action と同一）
- `SUPABASE_SECRET_KEY`: service_role キー（RLS バイパス用、書き込みに必須）
- `E_STAT_APP_ID`: e-Stat API キー（**NEXT_PUBLIC_ 厳禁**、server-side のみ）

**処理フロー**:
1. 起動時に接続先 URL を `console.log` して 3 秒待機（本番 DB 誤実行防止のため）
2. `public/municipalities.json` を読み込み、全 code リストを取得
3. e-Stat API から人口データをチャンク取得（50 code/req、200ms throttle）
4. 各市区町村に対し `calculateDifficulty()` で difficulty を算出
5. `municipality_master` テーブルに `INSERT ... ON CONFLICT (code) DO UPDATE` で upsert
6. 失敗時はエラーをログに出し、終了コード 1 で終了（部分成功は許容しない）

**冪等性**: 同じ国勢調査年・同じ入力データで何度実行しても結果が変わらないこと。

**自動スケジュール化は MVP 外**: 国勢調査が 5 年周期で更新ニーズが低いため、Vercel Cron や Supabase pg_cron 等のインフラは導入しない。将来必要になったら共通ロジックを `lib/batch/` に切り出して別 spec として追加する。

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
