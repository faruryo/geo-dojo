'use client';

interface Session {
  sessionIndex: number;
  mode: string;
  startedAt: string;
  questionCount: number;
  correctCount: number;
  accuracy: number;
}

export function SessionComparison({ sessions }: { sessions: Session[] }) {
  if (sessions.length === 0) return null;

  if (sessions.length === 1) {
    return (
      <div className="text-sm text-muted-foreground">
        直近セッション: {(sessions[0].accuracy * 100).toFixed(1)}%
      </div>
    );
  }

  // sessions are ordered by startedAt DESC, so [0] is latest, [1] is previous
  const latest = sessions[0];
  const previous = sessions[1];
  const diff = (latest.accuracy - previous.accuracy) * 100;
  const improved = diff >= 0;

  return (
    <div className="text-sm">
      {improved ? (
        <span className="text-green-400">
          前回より +{diff.toFixed(1)}% 改善
        </span>
      ) : (
        <div className="flex flex-col gap-0.5">
          <span className="text-red-400">前回より {diff.toFixed(1)}%</span>
          <span className="text-muted-foreground">
            次回はリベンジしましょう！
          </span>
        </div>
      )}
    </div>
  );
}
