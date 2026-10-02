import { ReviewOutcomeDetails } from 'geo-dojo';

const frame: React.CSSProperties = { background: '#111111', padding: 12, width: 351 };

const questions = [
  {
    name: '館山市',
    kana: 'たてやまし',
    mode: 'B' as const,
    isCorrect: true,
    category: 'graduated' as const,
    rows: [{ code: '12205', prefecture: '千葉県', label: { kind: 'graduated' as const }, graduated: true }],
  },
  {
    name: '銚子市',
    kana: 'ちょうしし',
    mode: 'C' as const,
    isCorrect: true,
    category: 'continuing' as const,
    rows: [
      { code: '12202', prefecture: '千葉県', label: { kind: 'scheduled' as const, daysUntil: 13 }, graduated: false, remainingSteps: 2 },
    ],
  },
  {
    name: '伊達市',
    kana: 'だてし',
    mode: 'A' as const,
    isCorrect: false,
    category: 'continuing' as const,
    rows: [
      { code: '01233', prefecture: '北海道', label: { kind: 'relapsed' as const }, graduated: false, remainingSteps: 5 },
      { code: '07213', prefecture: '福島県', label: { kind: 'retryTomorrow' as const }, graduated: false, remainingSteps: 5 },
    ],
  },
  {
    name: '池田町',
    mode: 'A' as const,
    isCorrect: true,
    category: 'continuing' as const,
    rows: [
      { code: '01395', prefecture: '北海道', label: { kind: 'kept' as const }, graduated: true },
      { code: '18382', prefecture: '福井県', label: { kind: 'graduated' as const }, graduated: true },
      { code: '20481', prefecture: '長野県', label: { kind: 'sameDay' as const }, graduated: false, remainingSteps: 1 },
      { code: '33423', prefecture: '岡山県', label: { kind: 'scheduled' as const, daysUntil: 1 }, graduated: false, remainingSteps: null },
    ],
  },
  {
    name: '京都市北区',
    mode: 'D' as const,
    isCorrect: true,
    category: 'saveFailed' as const,
    rows: [{ code: '26101', prefecture: '京都府', label: { kind: 'saveFailed' as const }, graduated: false }],
  },
];

export function Open() {
  return (
    <div style={frame}>
      <ReviewOutcomeDetails questions={questions} defaultOpen />
    </div>
  );
}

export function Collapsed() {
  return (
    <div style={frame}>
      <ReviewOutcomeDetails questions={questions} />
    </div>
  );
}
