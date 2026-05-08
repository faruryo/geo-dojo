'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Map, CreditCard, Sparkles } from 'lucide-react';

const navItems = [
  { href: '/study', label: '学習', icon: BookOpen },
  { href: '/quiz', label: 'クイズ', icon: Map },
  { href: '/cards', label: 'カード', icon: CreditCard },
  { href: '/ai-review', label: 'AI', icon: Sparkles },
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
