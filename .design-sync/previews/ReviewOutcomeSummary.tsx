import { ReviewOutcomeSummary } from 'geo-dojo';

const frame: React.CSSProperties = { background: '#111111', padding: 12, width: 351 };

export function Loaded() {
  return (
    <div style={frame}>
      <ReviewOutcomeSummary
        summary={{ graduated: 1, continuing: 14, saveFailed: 0 }}
        graduatedNames={['館山市']}
      />
    </div>
  );
}

export function ManyGraduated() {
  return (
    <div style={frame}>
      <ReviewOutcomeSummary
        summary={{ graduated: 5, continuing: 10, saveFailed: 0 }}
        graduatedNames={['館山市', '伊達市', '小樽市', '室蘭市', '釧路市']}
      />
    </div>
  );
}

export function NoneGraduated() {
  return (
    <div style={frame}>
      <ReviewOutcomeSummary summary={{ graduated: 0, continuing: 15, saveFailed: 0 }} />
    </div>
  );
}

export function WithSaveFailed() {
  return (
    <div style={frame}>
      <ReviewOutcomeSummary
        summary={{ graduated: 3, continuing: 15, saveFailed: 2 }}
        graduatedNames={['館山市', '伊達市', '小樽市']}
      />
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
