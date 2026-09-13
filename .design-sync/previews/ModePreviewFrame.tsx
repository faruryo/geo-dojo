import { ModePreviewFrame } from 'geo-dojo';

const frame: React.CSSProperties = { background: '#111111', padding: 12, width: 351 };

const card: React.CSSProperties = {
  borderRadius: 14,
  background: '#262626',
  border: '1px solid rgba(255,255,255,0.1)',
  padding: 12,
  textAlign: 'center',
};

/** 4択モード（B / C）の中身。地図系は topojson の fetch シムが要るので preview では使わない */
function ChoiceSample() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={card}>
        <p style={{ fontSize: 12, lineHeight: '16px', color: '#a1a1a1', marginBottom: 4 }}>
          この市区町村はどの都道府県？
        </p>
        <p style={{ fontSize: 20, lineHeight: '28px', fontWeight: 700 }}>東京駅</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
        {[
          { label: '東京都', correct: true },
          { label: '大阪府', correct: false },
          { label: '神奈川県', correct: false },
          { label: '千葉県', correct: false },
        ].map((c) => (
          <div
            key={c.label}
            style={{
              borderRadius: 10,
              border: `2px solid ${c.correct ? '#e5e5e5' : 'rgba(255,255,255,0.1)'}`,
              background: c.correct ? 'rgba(229,229,229,0.1)' : '#262626',
              color: c.correct ? '#e5e5e5' : '#fafafa',
              padding: '10px 0',
              textAlign: 'center',
              fontSize: 14,
              lineHeight: '20px',
              fontWeight: 500,
            }}
          >
            {c.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Default() {
  return (
    <div style={frame}>
      <ModePreviewFrame>
        <ChoiceSample />
      </ModePreviewFrame>
    </div>
  );
}

/** 枠の外に本番の操作要素が並ぶときの見え方。サンプルと本物が区別できているか */
export function BesideRealButton() {
  return (
    <div style={{ ...frame, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{
          width: '100%',
          minHeight: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 10,
          background: '#e5e5e5',
          color: '#262626',
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        このモードで遊ぶ
      </div>
      <ModePreviewFrame>
        <ChoiceSample />
      </ModePreviewFrame>
    </div>
  );
}
