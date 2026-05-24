import Link from 'next/link';
import { Map, MapPin } from 'lucide-react';

export default function QuizSelectPage() {
  return (
    <div className="flex flex-col gap-3 p-4 max-w-md mx-auto">
      <h1 className="text-xl font-semibold mb-1">クイズを選ぶ</h1>

      <Link
        href="/quiz/prefecture"
        className="flex items-center gap-4 rounded-xl border border-border p-4 hover:border-primary/50 transition-colors"
      >
        <Map size={28} className="text-primary shrink-0" />
        <div>
          <p className="text-base font-medium">都道府県クイズ</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            日本地図から都道府県の位置を当てる
          </p>
        </div>
      </Link>

      <Link
        href="/quiz/municipality"
        className="flex items-center gap-4 rounded-xl border border-border p-4 hover:border-primary/50 transition-colors"
      >
        <MapPin size={28} className="text-primary shrink-0" />
        <div>
          <p className="text-base font-medium">市区町村クイズ</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            4 モード × 難易度フィルターで市区町村を学ぶ
          </p>
        </div>
      </Link>
    </div>
  );
}
