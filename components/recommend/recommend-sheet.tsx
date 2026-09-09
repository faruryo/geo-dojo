'use client';

import { Sheet, SheetContent } from '@/components/ui/sheet';
import { RecommendContent } from './recommend-content';

interface Props {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function RecommendSheet({ open, onOpenChange }: Readonly<Props>) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl pb-safe">
        <RecommendContent onClose={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}
