import { MilestoneBanner } from 'geo-dojo';

const frame: React.CSSProperties = { background: '#111111', padding: 16, width: 351 };

export function Early() {
  return (
    <div style={frame}>
      <MilestoneBanner totalCorrect={100} coverageRate={0.12} />
    </div>
  );
}

export function HalfWay() {
  return (
    <div style={frame}>
      <MilestoneBanner totalCorrect={1000} coverageRate={0.5} />
    </div>
  );
}
