'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

export function RecommendReplayButton() {
  const router = useRouter();

  function handleClick() {
    router.push(`/?recommend=open`);
  }

  return (
    <Button onClick={handleClick} className="w-full gap-2">
      <Sparkles size={16} />
      もう一度おすすめでプレイ
    </Button>
  );
}
