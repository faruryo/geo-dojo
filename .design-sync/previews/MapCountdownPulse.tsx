import { MapCountdownPulse } from 'geo-dojo';

const container: React.CSSProperties = {
  position: 'relative',
  width: 351,
  height: 240,
  background: '#1a1a1a',
  borderRadius: 8,
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid rgba(255, 255, 255, 0.1)',
};

const label: React.CSSProperties = {
  fontSize: 13,
  color: '#888888',
  textAlign: 'center',
  userSelect: 'none',
};

export function Danger() {
  return (
    <div style={container}>
      <p style={label}>マップ探索エリア（残り5秒 / 危険パルス）</p>
      <MapCountdownPulse secondsLeft={5} feedback="idle" />
    </div>
  );
}

export function Warning() {
  return (
    <div style={container}>
      <p style={label}>マップ探索エリア（残り6秒 / 警告パルス）</p>
      <MapCountdownPulse secondsLeft={6} feedback="idle" />
    </div>
  );
}

export function Idle() {
  return (
    <div style={container}>
      <p style={label}>マップ探索エリア（通常時 / パルスなし）</p>
      <MapCountdownPulse secondsLeft={10} feedback="idle" />
    </div>
  );
}
