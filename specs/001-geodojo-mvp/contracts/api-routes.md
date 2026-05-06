# API Routes Contract: GeoDojo MVP

**Generated**: 2026-05-06
**Note**: 書き込み操作は Server Actions を使用する（`server-actions.md` 参照）。
REST API ルートは外部呼び出し・プロキシ・非同期トリガーのみ。

---

## GET /api/image-proxy

Street View 画像をプロキシする（APIキー隠蔽、憲法 I 条）。

**Auth**: `Authorization: Bearer <supabase_access_token>` （必須）

**Query Parameters**:

| パラメータ | 型 | 必須 | デフォルト | 説明 |
|-----------|-----|------|----------|------|
| `pano_id` | string | ✅ | — | Street View パノラマ ID |
| `width`   | number | — | 640 | 画像幅（px） |
| `height`  | number | — | 480 | 画像高さ（px） |

**Response**:
```
200 OK
Content-Type: image/jpeg
Cache-Control: public, max-age=3600

[JPEG binary stream]
```

**Errors**:

| Status | Condition |
|--------|-----------|
| 400 Bad Request | `pano_id` が指定されていない |
| 401 Unauthorized | Authorization ヘッダーなし |
| 502 Bad Gateway | Google Maps API への接続失敗 |

**Client usage**:
```tsx
// pano_id を持つカードの画像表示
<img src={`/api/image-proxy?pano_id=${card.panoId}&width=640&height=480`} />
```

---

## GET /api/cards/due

当日の学習対象カードを取得する（TanStack Query が使用）。

**Auth**: Cookie ベースの Supabase セッション（必須）

**Response**:
```json
{
  "cards": [
    {
      "id": "uuid",
      "notes": "電柱が細く木製。東北か北海道の特徴。",
      "tags": ["東北", "電柱"],
      "imageUrl": "https://xxx.supabase.co/storage/v1/object/public/...",
      "panoId": "panoIdString",
      "annotations": [
        { "id": "uuid", "xRatio": 0.32, "yRatio": 0.45, "label": "木製電柱" }
      ],
      "srsRecord": {
        "dueDate": "2026-05-06T00:00:00Z",
        "interval": 3,
        "reps": 5
      }
    }
  ],
  "totalDue": 12
}
```

**Errors**:

| Status | Condition |
|--------|-----------|
| 401 | 未認証 |
| 500 | DB エラー |

---

## POST /api/ai-generate

Gemini による非同期カード生成を開始する。

**Auth**: Cookie ベースの Supabase セッション（必須）

**Request Body**:
```json
{
  "imageUrl": "https://xxx.supabase.co/storage/v1/object/public/...",
  "panoId": "optional-pano-id"
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `imageUrl` | string | △ | Supabase Storage の画像 URL（imageUrl か panoId のどちらか必須） |
| `panoId`   | string | △ | Street View pano_id（imageUrl か panoId のどちらか必須） |

**Response**:
```json
{
  "candidateId": "uuid",
  "status": "processing"
}
```

生成は非同期。完了は Supabase Realtime または画面リロードで確認。

**Errors**:

| Status | Condition |
|--------|-----------|
| 400 | `imageUrl` と `panoId` の両方が未指定 |
| 401 | 未認証 |
| 429 | レート制限超過（ユーザーあたり1分あたり5件） |
| 500 | Gemini API エラー |
