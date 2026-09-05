import { QuizPoolProgress } from 'geo-dojo';

const frame: React.CSSProperties = { background: '#111111', padding: 12, width: 351 };

export function InProgress() {
  return (
    <div style={frame}>
      <QuizPoolProgress stats={{ totalCount: 1741, clearedCount: 412, percentage: 24 }} isLoading={false} isError={false} />
    </div>
  );
}

export function Complete() {
  return (
    <div style={frame}>
      <QuizPoolProgress stats={{ totalCount: 179, clearedCount: 179, percentage: 100 }} isLoading={false} isError={false} />
    </div>
  );
}

export function Loading() {
  return (
    <div style={frame}>
      <QuizPoolProgress stats={{ totalCount: 0, clearedCount: 0, percentage: 0 }} isLoading isError={false} />
    </div>
  );
}

export function Failed() {
  return (
    <div style={frame}>
      <QuizPoolProgress stats={{ totalCount: 0, clearedCount: 0, percentage: 0 }} isLoading={false} isError onRetry={() => {}} />
    </div>
  );
}
