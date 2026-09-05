import { MiniJapanMap } from 'geo-dojo';
import { serveTopology } from './_topology';

serveTopology();

const frame: React.CSSProperties = { background: '#111111', width: 200, height: 250, padding: 8 };

export function Default() {
  return (
    <div style={frame}>
      <MiniJapanMap />
    </div>
  );
}

export function Highlighted() {
  return (
    <div style={frame}>
      <MiniJapanMap highlight="山形県" showZoomFrame />
    </div>
  );
}
