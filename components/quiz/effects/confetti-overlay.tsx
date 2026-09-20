'use client';

import React, { useEffect, useState } from 'react';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';

export interface ConfettiOverlayProps {
  /** 連続正解数 */
  readonly streak: number;
}

const COLORS = [
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#ec4899', // pink
  '#8b5cf6', // purple
  '#ef4444', // red
];

interface Particle {
  readonly id: number;
  readonly left: number; // 0〜100%
  readonly color: string;
  readonly size: number; // px
  readonly delayMs: number;
  readonly durationMs: number;
  readonly rotate: number; // deg
}

function generateParticles(count = 20): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      id: i,
      left: 5 + ((i * 90) / count) + (i % 3) * 2,
      color: COLORS[i % COLORS.length],
      size: 6 + (i % 4) * 2,
      delayMs: (i % 5) * 60,
      durationMs: 1200 + (i % 3) * 150,
      rotate: (i * 45) % 360,
    });
  }
  return particles;
}

const PARTICLES = generateParticles(20);

/**
 * FR-006b: 5連続正解時のみ発火する軽量CSS紙吹雪演出（外部ライブラリ不使用）。
 * - streak === 5 のみ描画（6連続以降は非表示）
 * - prefers-reduced-motion 有効時は非表示（FR-006d）
 * - 1.5秒で自然フェードアウト
 */
export function ConfettiOverlay({ streak }: Readonly<ConfettiOverlayProps>) {
  const reducedMotion = usePrefersReducedMotion();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  if (streak !== 5 || reducedMotion || !visible) {
    return null;
  }

  return (
    <div
      data-testid="confetti-overlay"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-30 overflow-hidden"
    >
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(-20px) rotate(0deg);
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            transform: translateY(350px) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
      {PARTICLES.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            top: 0,
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size * 0.6}px`,
            backgroundColor: p.color,
            borderRadius: '2px',
            transform: `rotate(${p.rotate}deg)`,
            animation: `confetti-fall ${p.durationMs}ms ease-out ${p.delayMs}ms forwards`,
          }}
        />
      ))}
    </div>
  );
}
