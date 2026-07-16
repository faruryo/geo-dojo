'use client';

import { Volume2, VolumeX } from 'lucide-react';
import { useSoundMuted } from '@/lib/hooks/useSoundMuted';

export function MuteToggle() {
  const [muted, setMuted] = useSoundMuted();

  return (
    <button
      onClick={() => setMuted(!muted)}
      aria-label={muted ? 'ミュートを解除' : '効果音をミュート'}
      className="inline-flex items-center hover:text-foreground transition-colors"
    >
      {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
    </button>
  );
}
