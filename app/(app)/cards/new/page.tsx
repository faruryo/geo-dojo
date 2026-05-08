'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { AnnotationEditor, type AnnotationDraft } from '@/components/annotation/AnnotationEditor';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase/client';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function NewCardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [annotations, setAnnotations] = useState<AnnotationDraft[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fileError, setFileError] = useState('');

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setFileError('JPEG・PNG・WebP 形式のみ対応しています');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileError('ファイルサイズは 10MB 以下にしてください');
      return;
    }

    setFileError('');
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
  }

  async function uploadImage(): Promise<string | null> {
    if (!imageFile) return null;
    setUploading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const path = `${session.user.id}/${Date.now()}-${imageFile.name}`;
    const { error } = await supabase.storage
      .from('card-images')
      .upload(path, imageFile, { contentType: imageFile.type });

    setUploading(false);
    if (error) return null;

    const { data } = supabase.storage.from('card-images').getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSave() {
    if (!notes.trim() && annotations.length === 0) {
      alert('メモかマーカーのどちらかを入力してください');
      return;
    }
    setSaving(true);

    let storedImageUrl: string | undefined;
    if (imageFile) {
      storedImageUrl = (await uploadImage()) ?? undefined;
    }

    const tagList = tags.split(/[,、\s]+/).map((t) => t.trim()).filter(Boolean);

    const res = await fetch('/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notes: notes.trim() || undefined,
        tags: tagList,
        imageUrl: storedImageUrl,
        annotations,
      }),
    });

    setSaving(false);
    if (res.ok) {
      await queryClient.invalidateQueries({ queryKey: ['cards'] });
      router.push('/cards');
    } else {
      alert('保存に失敗しました');
    }
  }

  return (
    <div className="flex flex-col gap-5 p-4 pb-28">
      <h1 className="text-lg font-semibold">カードを作成</h1>

      {/* 画像アップロード */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">画像（任意）</label>
        {imageUrl ? (
          <div className="relative">
            <AnnotationEditor
              imageUrl={imageUrl}
              annotations={annotations}
              onChange={setAnnotations}
            />
            <button
              className="absolute top-2 right-2 bg-background/80 text-xs px-2 py-1 rounded border border-border"
              onClick={() => { setImageUrl(''); setImageFile(null); setAnnotations([]); }}
            >
              変更
            </button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center h-36 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors">
            <span className="text-muted-foreground text-sm">タップして画像を選択</span>
            <span className="text-xs text-muted-foreground mt-1">JPEG / PNG / WebP, 最大10MB</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />
          </label>
        )}
        {fileError && <p className="text-destructive text-xs">{fileError}</p>}
      </div>

      {/* メモ */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="notes">特徴メモ</label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="例：電柱が木製で細い。東北・北海道の特徴。看板に東北方言が見られる。"
          className="rounded-xl border border-input bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      {/* タグ */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="tags">タグ（カンマ区切り）</label>
        <input
          id="tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="例：東北, 電柱, 看板"
          className="h-11 rounded-xl border border-input bg-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <Button
        onClick={handleSave}
        disabled={saving || uploading}
        className="w-full"
      >
        {saving || uploading ? '保存中...' : 'カードを保存'}
      </Button>
    </div>
  );
}
