'use client';

import { PRECISIONS } from '@/lib/geo';
import { useAppStore } from '@/lib/store';

/** Always-visible zoom control: block / hood / city / region. */
export function PrecisionSelector() {
  const precision = useAppStore((s) => s.precision);
  const setPrecision = useAppStore((s) => s.setPrecision);

  return (
    <div className="flex gap-1 px-4 py-2">
      {PRECISIONS.map((p) => (
        <button
          key={p.value}
          onClick={() => setPrecision(p.value)}
          title={p.hint}
          className={`flex-1 rounded-full px-2 py-1 text-xs font-medium transition-colors ${
            precision === p.value
              ? 'bg-accent-dim text-white'
              : 'bg-white/5 text-gray-400 hover:bg-white/10'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
