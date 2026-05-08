'use client';

import { useState } from 'react';
import { MarkerPin } from '@/components/annotation/MarkerPin';
import type { Annotation } from '@/lib/db/schema';

interface AnnotationOverlayProps {
  annotations: Annotation[];
  revealed: boolean;
}

export function AnnotationOverlay({ annotations, revealed }: AnnotationOverlayProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  if (!revealed || annotations.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {annotations.map((ann) => (
        <g
          key={ann.id}
          transform={`translate(${ann.xRatio * 100}, ${ann.yRatio * 100})`}
          className="pointer-events-auto cursor-pointer"
          onClick={() => setActiveId(activeId === ann.id ? null : ann.id)}
        >
          <MarkerPin label={ann.label} active={activeId === ann.id} />
        </g>
      ))}
      {/* ラベルポップアップ */}
      {activeId && (() => {
        const ann = annotations.find((a) => a.id === activeId);
        if (!ann) return null;
        return (
          <foreignObject
            x={Math.min(ann.xRatio * 100 + 2, 60)}
            y={Math.max(ann.yRatio * 100 - 12, 2)}
            width={36}
            height={10}
          >
            <div className="bg-background/90 text-foreground text-xs px-1 py-0.5 rounded border border-border truncate">
              {ann.label}
            </div>
          </foreignObject>
        );
      })()}
    </svg>
  );
}
