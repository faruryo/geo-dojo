import { ReviewOutcomeSummary } from 'geo-dojo';

const frame: React.CSSProperties = { background: '#111111', padding: 12, width: 351 };

export function Loaded() {
  return (
    <div style={frame}>
      <ReviewOutcomeSummary summary={{ graduated: 3, continuing: 17, saveFailed: 0 }} />
    </div>
  );
}

export function WithSaveFailed() {
  return (
    <div style={frame}>
      <ReviewOutcomeSummary summary={{ graduated: 3, continuing: 15, saveFailed: 2 }} />
    </div>
  );
}

export function Loading() {
  return (
    <div style={frame}>
      <ReviewOutcomeSummary summary={null} />
    </div>
  );
}
