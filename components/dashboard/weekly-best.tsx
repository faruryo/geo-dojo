'use client';

import { useRecentSessions } from '@/lib/hooks/useRecentSessions';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/** Get JST Monday 00:00 of the current week */
function getJSTWeekStart(): Date {
  const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const now = new Date();
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  const day = jst.getUTCDay(); // 0=Sun
  const diff = day === 0 ? 6 : day - 1; // days since Monday
  const monday = new Date(
    Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate() - diff),
  );
  // Convert back to UTC
  return new Date(monday.getTime() - JST_OFFSET_MS);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCMonth() + 1}/${jst.getUTCDate()}`;
}

interface Session {
  sessionIndex: number;
  mode: string;
  startedAt: string;
  questionCount: number;
  correctCount: number;
  accuracy: number;
}

interface SessionComparisonInlineProps {
  sessions: Session[];
}

function SessionComparisonInline({ sessions }: SessionComparisonInlineProps) {
  if (sessions.length === 0) return null;

  if (sessions.length === 1) {
    return (
      <p className="text-xs text-muted-foreground">
        直近セッション: {(sessions[0].accuracy * 100).toFixed(1)}%
      </p>
    );
  }

  const latest = sessions[0];
  const previous = sessions[1];
  const diff = (latest.accuracy - previous.accuracy) * 100;
  const improved = diff >= 0;

  return (
    <p className="text-xs">
      {improved ? (
        <span className="text-green-400">
          前回より +{diff.toFixed(1)}% 改善
        </span>
      ) : (
        <span className="text-red-400">前回より {diff.toFixed(1)}%</span>
      )}
    </p>
  );
}

export function WeeklyBest({ sessions: externalSessions }: { sessions?: Session[] }) {
  const { data: fetchedSessions, isLoading } = useRecentSessions(50);
  const sessions = externalSessions ?? fetchedSessions;

  if (isLoading && !externalSessions) {
    return (
      <Card size="sm">
        <CardContent className="p-3">
          <h2 className="text-sm font-semibold">今週のベスト</h2>
          <Skeleton className="mt-2 h-10 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <Card size="sm">
        <CardContent className="p-3">
          <h2 className="text-sm font-semibold">今週のベスト</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            今週はまだクイズを受けていません
          </p>
        </CardContent>
      </Card>
    );
  }

  const weekStart = getJSTWeekStart();
  const thisWeekSessions = sessions.filter(
    (s) => new Date(s.startedAt) >= weekStart,
  );

  if (thisWeekSessions.length === 0) {
    return (
      <Card size="sm">
        <CardContent className="p-3">
          <h2 className="text-sm font-semibold">今週のベスト</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            今週はまだクイズを受けていません
          </p>
        </CardContent>
      </Card>
    );
  }

  const best = thisWeekSessions.reduce((a, b) =>
    a.accuracy >= b.accuracy ? a : b,
  );

  // Check if this is the all-time best
  const allTimeBest = sessions.reduce((a, b) =>
    a.accuracy >= b.accuracy ? a : b,
  );
  const isAllTimeBest =
    best.accuracy > 0 && best.accuracy >= allTimeBest.accuracy;

  return (
    <Card size="sm">
      <CardContent className="p-3">
        <h2 className="text-sm font-semibold">今週のベスト</h2>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-2xl font-bold">
            {(best.accuracy * 100).toFixed(1)}%
          </span>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="text-[10px]">
                {best.mode}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatDate(best.startedAt)}
              </span>
            </div>
            {isAllTimeBest && (
              <span className="text-xs font-medium text-primary">
                自己ベスト更新！
              </span>
            )}
          </div>
        </div>
        {sessions.length > 0 && (
          <div className="mt-2 border-t border-border pt-2">
            <SessionComparisonInline sessions={sessions} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
