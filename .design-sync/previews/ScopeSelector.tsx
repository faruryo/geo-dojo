import { ScopeSelector } from 'geo-dojo';

const frame: React.CSSProperties = { background: '#111111', padding: 12, width: 351 };

export function ByRegion() {
  return (
    <div style={frame}>
      <ScopeSelector
        mode="A"
        scope={{ type: 'region', regions: ['東北', '関東'] }}
        onScopeChange={() => {}}
        totalPrefectureCount={13}
      />
    </div>
  );
}

export function Nationwide() {
  return (
    <div style={frame}>
      <ScopeSelector
        mode="D"
        scope={{ type: 'region', regions: ['全国'] }}
        onScopeChange={() => {}}
        totalPrefectureCount={47}
      />
    </div>
  );
}

export function SinglePrefecture() {
  return (
    <div style={frame}>
      <ScopeSelector
        mode="D"
        scope={{ type: 'prefecture', prefecture: '山形県', selectedCodes: ['06203', '06204'] }}
        onScopeChange={() => {}}
        onOpenMunicipalityPicker={() => {}}
        selectedCount={2}
        totalPrefectureCount={35}
      />
    </div>
  );
}
