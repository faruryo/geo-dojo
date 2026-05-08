interface MarkerPinProps {
  label: string;
  active?: boolean;
}

export function MarkerPin({ label, active = false }: MarkerPinProps) {
  return (
    <g>
      <circle
        r={10}
        fill={active ? '#4a7c59' : '#ef4444'}
        stroke="white"
        strokeWidth={2}
      />
      {active && (
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fill="white"
          fontSize={10}
          fontWeight="bold"
        >
          !
        </text>
      )}
      <title>{label}</title>
    </g>
  );
}
