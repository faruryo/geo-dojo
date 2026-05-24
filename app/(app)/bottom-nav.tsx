'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Map, MapPin } from 'lucide-react';

const navItems = [
  { href: '/quiz/prefecture', label: '都道府県', icon: Map },
  { href: '/quiz/municipality', label: '市区町村', icon: MapPin },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] border-t border-border bg-background pb-[env(safe-area-inset-bottom)]">
      <div className="flex">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center flex-1 py-2 gap-1 text-xs transition-colors ${
                active ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon size={22} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
