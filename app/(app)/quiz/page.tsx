'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Map } from 'lucide-react';

// 地図コンポーネントは SSR 不要（TopoJSON fetch はブラウザ側）
const JapanMap = dynamic(
  () => import('@/components/map/JapanMap').then((m) => m.JapanMap),
  { ssr: false, loading: () => <div className="w-full aspect-square bg-muted rounded-xl animate-pulse" /> },
);

// 日本47都道府県リスト（TopoJSON の properties.name と一致させること）
const PREFECTURES = [
  '北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県',
  '茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
  '新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県',
  '静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県',
  '奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県',
  '徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県',
  '熊本県','大分県','宮崎県','鹿児島県','沖縄県',
];

type QuizState = 'question' | 'correct' | 'wrong' | 'result';

interface QuizResult {
  prefecture: string;
  correct: boolean;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const TOTAL_ROUNDS = 10;

function newQueue(): string[] {
  return shuffle(PREFECTURES).slice(0, TOTAL_ROUNDS);
}

export default function QuizPage() {
  const [queue, setQueue] = useState<string[]>([]);
  const [target, setTarget] = useState(PREFECTURES[0]);
  const [state, setState] = useState<QuizState>('question');

  // クライアントのみで初期化（hydration ミスマッチ回避）
  useEffect(() => {
    const q = newQueue();
    setQueue(q.slice(1));
    setTarget(q[0]);
  }, []);

  const [selected, setSelected] = useState<string | null>(null);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [round, setRound] = useState(1);

  const handleTap = useCallback(
    (name: string) => {
      if (state !== 'question') return;
      const isCorrect = name === target;
      setSelected(name);
      setState(isCorrect ? 'correct' : 'wrong');
      setResults((prev) => [...prev, { prefecture: target, correct: isCorrect }]);

      setTimeout(() => {
        if (round >= TOTAL_ROUNDS) {
          setState('result');
        } else {
          setTarget(queue[0]);
          setQueue((q) => q.slice(1));
          setSelected(null);
          setState('question');
          setRound((r) => r + 1);
        }
      }, 1200);
    },
    [state, target, round],
  );

  function restart() {
    const q = newQueue();
    setQueue(q.slice(1));
    setTarget(q[0]);
    setResults([]);
    setRound(1);
    setSelected(null);
    setState('question');
  }

  if (state === 'result') {
    const correct = results.filter((r) => r.correct).length;
    const wrong = results.filter((r) => !r.correct);
    return (
      <div className="flex flex-col gap-4 p-4">
        <h2 className="text-xl font-semibold text-center">結果</h2>
        <div className="text-center text-4xl font-bold text-primary">
          {correct} / {TOTAL_ROUNDS}
        </div>
        <p className="text-center text-muted-foreground text-sm">正答率 {Math.round(correct / TOTAL_ROUNDS * 100)}%</p>
        {wrong.length > 0 && (
          <div className="rounded-xl bg-card p-4">
            <p className="text-sm font-medium mb-2">苦手な都道府県：</p>
            <div className="flex flex-wrap gap-1.5">
              {wrong.map((r) => (
                <span key={r.prefecture} className="text-xs px-2 py-0.5 rounded-full bg-destructive/20 text-destructive">
                  {r.prefecture}
                </span>
              ))}
            </div>
          </div>
        )}
        <Button onClick={restart} className="w-full">もう一度</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{round} / {TOTAL_ROUNDS}</span>
        <span>{results.filter((r) => r.correct).length} 正解</span>
      </div>

      {/* 問題 */}
      <div className="rounded-xl bg-card p-4 text-center">
        <p className="text-xs text-muted-foreground mb-1">どこにある？</p>
        <p className="text-2xl font-bold">{target}</p>
      </div>

      {/* フィードバック */}
      {state !== 'question' && (
        <div className={`text-center text-lg font-semibold ${state === 'correct' ? 'text-green-500' : 'text-red-500'}`}>
          {state === 'correct' ? '✓ 正解！' : `✗ 不正解（${target}）`}
        </div>
      )}

      <div className="w-full max-w-lg mx-auto self-center">
        <JapanMap
          onPrefectureClick={handleTap}
          highlightCorrect={state !== 'question' ? target : undefined}
          highlightWrong={state === 'wrong' && selected ? selected : undefined}
        />
      </div>
    </div>
  );
}
