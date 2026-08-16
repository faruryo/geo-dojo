'use client';

export interface SessionCountOption<T extends string | number> {
  readonly label: string;
  readonly value: T;
}

interface SessionCountSelectorProps<T extends string | number> {
  readonly options: readonly SessionCountOption<T>[];
  readonly selectedValue: T;
  readonly onSelect: (value: T) => void;
  readonly title?: string;
}

export function SessionCountSelector<T extends string | number>({
  options,
  selectedValue,
  onSelect,
  title = '出題数',
}: Readonly<SessionCountSelectorProps<T>>) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {title}
      </h2>
      <div className="flex gap-2">
        {options.map((opt) => {
          const isSelected = selectedValue === opt.value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => onSelect(opt.value)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                isSelected
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-foreground border-foreground/10 hover:border-foreground/30'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
