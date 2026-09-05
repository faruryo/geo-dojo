import { MuteToggle } from 'geo-dojo';

export function Default() {
  return (
    <div style={{ background: '#111111', padding: 24, width: 240, display: 'flex', alignItems: 'center', gap: 12, color: '#a1a1a1', fontSize: 12 }}>
      <MuteToggle />
      <span>効果音のオンオフ</span>
    </div>
  );
}
