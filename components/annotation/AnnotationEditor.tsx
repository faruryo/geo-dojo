'use client';

import { useState, useRef } from 'react';
import { MarkerPin } from './MarkerPin';
import { Button } from '@/components/ui/button';

export interface AnnotationDraft {
  xRatio: number;
  yRatio: number;
  label: string;
}

interface AnnotationEditorProps {
  imageUrl: string;
  annotations: AnnotationDraft[];
  onChange: (annotations: AnnotationDraft[]) => void;
}

export function AnnotationEditor({ imageUrl, annotations, onChange }: AnnotationEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pendingLabel, setPendingLabel] = useState('');
  const [pendingCoords, setPendingCoords] = useState<{ x: number; y: number } | null>(null);

  function handleImageClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setPendingCoords({ x, y });
    setPendingLabel('');
  }

  function addAnnotation() {
    if (!pendingCoords || !pendingLabel.trim()) return;
    onChange([
      ...annotations,
      { xRatio: pendingCoords.x, yRatio: pendingCoords.y, label: pendingLabel.trim() },
    ]);
    setPendingCoords(null);
    setPendingLabel('');
  }

  function removeAnnotation(index: number) {
    onChange(annotations.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 画像 + SVGオーバーレイ */}
      <div
        ref={containerRef}
        className="relative w-full aspect-video bg-muted rounded-xl overflow-hidden cursor-crosshair"
        onClick={handleImageClick}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="アノテーション対象" className="w-full h-full object-cover" />
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {annotations.map((ann, i) => (
            <g key={i} transform={`translate(${ann.xRatio * 100}, ${ann.yRatio * 100})`}>
              <MarkerPin label={ann.label} active />
            </g>
          ))}
          {pendingCoords && (
            <g transform={`translate(${pendingCoords.x * 100}, ${pendingCoords.y * 100})`}>
              <circle r={10} fill="#888" stroke="white" strokeWidth={2} strokeDasharray="3 2" />
            </g>
          )}
        </svg>
        <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-white/60">
          タップでマーカーを追加
        </p>
      </div>

      {/* ラベル入力（座標選択後に表示） */}
      {pendingCoords && (
        <div className="flex gap-2">
          <input
            autoFocus
            value={pendingLabel}
            onChange={(e) => setPendingLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addAnnotation()}
            placeholder="マーカーのラベルを入力"
            className="flex-1 h-10 rounded-lg border border-input bg-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <Button size="sm" onClick={addAnnotation} disabled={!pendingLabel.trim()}>
            追加
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPendingCoords(null)}>
            ✕
          </Button>
        </div>
      )}

      {/* 追加済みマーカー一覧 */}
      {annotations.length > 0 && (
        <ul className="flex flex-col gap-1">
          {annotations.map((ann, i) => (
            <li key={i} className="flex items-center justify-between text-sm px-3 py-1.5 rounded-lg bg-card">
              <span>{ann.label}</span>
              <button
                onClick={() => removeAnnotation(i)}
                className="text-muted-foreground hover:text-destructive text-xs"
              >
                削除
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
