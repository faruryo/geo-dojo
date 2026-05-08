'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { useCards } from '@/lib/hooks/useCards';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';

export default function CardsPage() {
  const queryClient = useQueryClient();
  const [filterTag, setFilterTag] = useState<string | undefined>();
  const { data: cards = [], isLoading } = useCards(filterTag ? [filterTag] : undefined);

  async function handleDelete(cardId: string) {
    if (!confirm('このカードを削除しますか？')) return;

    await fetch(`/api/cards/${cardId}`, { method: 'DELETE' });
    await queryClient.invalidateQueries({ queryKey: ['cards'] });
  }

  // 全タグ収集
  const allTags = [...new Set(cards.flatMap((c) => c.tags))].sort();

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">カード一覧</h1>
        <Link href="/cards/new">
          <Button size="sm" className="gap-1">
            <Plus size={16} /> 追加
          </Button>
        </Link>
      </div>

      {/* タグフィルタ */}
      {allTags.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setFilterTag(undefined)}
            className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap border transition-colors ${
              !filterTag ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'
            }`}
          >
            すべて
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setFilterTag(tag === filterTag ? undefined : tag)}
              className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap border transition-colors ${
                tag === filterTag ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : cards.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <p>カードがありません</p>
          <Link href="/cards/new" className="text-primary underline mt-2 inline-block">
            最初のカードを作成
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {cards.map((card) => (
            <div key={card.id} className="rounded-xl bg-card p-4 flex gap-3">
              {card.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={card.imageUrl}
                  alt=""
                  className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm line-clamp-2 text-foreground">{card.notes ?? '（メモなし）'}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {card.tags.map((tag) => (
                    <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => handleDelete(card.id)}
                className="text-muted-foreground hover:text-destructive flex-shrink-0 self-start p-1"
                aria-label="削除"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
