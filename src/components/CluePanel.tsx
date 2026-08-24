import { PLAYER_COLORS } from './HexMap';
import type { ClueInstance } from '../lib/types';

interface Props {
  clues: ClueInstance[];
  selected: number[];
  onToggle: (i: number) => void;
  tileCount: number;
  pairShares: number[][];
}

export default function CluePanel({ clues, selected, onToggle, tileCount, pairShares }: Props) {
  return (
    <div className="space-y-3 rounded-2xl border border-amber-200/15 bg-[#111c33]/70 p-4 shadow-xl backdrop-blur">
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-lg text-amber-100">Подсказки пиратов</h2>
        <span className="text-[11px] text-amber-200/50">нажми, чтобы подсветить на карте</span>
      </div>

      <div className="space-y-2">
        {clues.map((c, i) => {
          const active = selected.includes(i);
          const color = PLAYER_COLORS[i % PLAYER_COLORS.length];
          const share = c.tiles.length / tileCount;
          return (
            <button
              key={i}
              onClick={() => onToggle(i)}
              className={`w-full rounded-xl border p-3 text-left transition ${
                active ? 'border-amber-300/70 bg-amber-300/10' : 'border-amber-200/10 bg-[#0d1526]/60 hover:border-amber-200/30'
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-sm font-bold text-[#10182b]"
                  style={{ background: color }}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug text-amber-50">{c.text}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/40">
                      <div className="h-full rounded-full" style={{ width: `${share * 100}%`, background: color }} />
                    </div>
                    <span className="w-24 shrink-0 text-right font-mono text-[11px] text-amber-200/70">
                      {c.tiles.length} кл. · {(share * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {pairShares.length > 1 && (
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-amber-200/60">
            Насколько сужает пересечение пар (в % карты)
          </p>
          <div className="overflow-hidden rounded-xl border border-amber-200/10">
            <table className="w-full table-fixed border-collapse font-mono text-[11px]">
              <tbody>
                {pairShares.map((row, i) => (
                  <tr key={i} className="border-b border-amber-200/10 last:border-0">
                    {row.map((v, j) => (
                      <td
                        key={j}
                        className="p-1.5 text-center"
                        style={{
                          background:
                            i === j
                              ? 'rgba(0,0,0,.35)'
                              : `rgba(251,191,36,${Math.max(0.05, Math.min(0.55, v * 1.8))})`,
                          color: i === j ? 'rgba(253,230,138,.35)' : '#fde68a',
                        }}
                      >
                        {i === j ? '—' : Math.round(v * 100)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] leading-relaxed text-amber-200/50">
            Значения близки друг к другу — значит, узнав подсказку любого пирата, игрок сужает поиск примерно одинаково.
          </p>
        </div>
      )}
    </div>
  );
}
