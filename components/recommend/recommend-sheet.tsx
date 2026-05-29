'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { RecommendContent } from './recommend-content';

export function RecommendSheet() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const isOpen = searchParams.get('recommend') === 'open';

  function handleOpenChange(open: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (open) {
      params.set('recommend', 'open');
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    } else {
      // Replace (not push) so closing doesn't leave a back-button entry that
      // re-opens the sheet; an open sheet is still closable via the back button.
      params.delete('recommend');
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl pb-safe">
        <RecommendContent onClose={() => handleOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}
