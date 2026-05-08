'use client';

import { useState } from 'react';
import { AnnotationOverlay } from './AnnotationOverlay';
import type { CardWithDetails } from '@/lib/hooks/useDueCards';

interface FlashCardProps {
  card: CardWithDetails;
}

export function FlashCard({ card }: FlashCardProps) {
  const [revealed, setRevealed] = useState(false);

  const imageSrc = card.panoId
    ? `/api/image-proxy?pano_id=${card.panoId}&width=640&height=480`
    : card.imageUrl ?? null;

  return (
    <div className="flex flex-col gap-4">
      {/* 画像エリア */}
      <div
        className="relative w-full max-w-2xl mx-auto self-center aspect-video bg-muted rounded-xl overflow-hidden cursor-pointer"
        onClick={() => setRevealed((v) => !v)}
      >
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageSrc}
            alt="学習カード画像"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            画像なし
          </div>
        )}
        <AnnotationOverlay annotations={card.annotations} revealed={revealed} />
        {!revealed && card.annotations.length > 0 && (
          <div className="absolute bottom-2 right-2 text-xs bg-background/70 px-2 py-1 rounded">
            タップでマーカー表示
          </div>
        )}
      </div>

      {/* メモ */}
      {card.notes && (
        <div
          className={`rounded-xl p-4 bg-card text-sm leading-relaxed transition-all ${
            revealed ? 'opacity-100' : 'opacity-0 select-none'
          }`}
        >
          {card.notes}
        </div>
      )}

      {/* タグ */}
      {card.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {card.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
