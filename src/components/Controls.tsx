import { useEffect, useState } from 'react';
import { DEFAULT_CLUE_POOL_LIMITS, type CluePoolLimits, type NumRange } from '../lib/clues';
import type { PuzzleOptions } from '../lib/generator';

interface Props {
  options: PuzzleOptions;
  onChange: (o: PuzzleOptions) => void;
  onGenerate: (seed: string) => void;
  onRandom: () => void;
  busy: boolean;
  showSolution: boolean;
  onToggleSolution: (v: boolean) => void;
  onExport: () => void;
}

const label = 'text-[11px] uppercase tracking-wider text-amber-200/60';
const field =
  'w-full rounded-lg border border-amber-200/15 bg-[#0d1526]/80 px-3 py-2 text-sm text-amber-50 outline-none focus:border-amber-300/60';
const numField =
  'w-full min-w-0 rounded-md border border-amber-200/15 bg-[#0d1526]/80 px-2 py-1 text-center text-xs text-amber-50 outline-none focus:border-amber-300/60';

const LIMIT_FIELDS: Array<{ key: keyof CluePoolLimits; title: string }> = [
  { key: 'terrainSingleWithin', title: 'Ландшафт, ВНУТРИ' },
  { key: 'terrainSingleOutside', title: 'Ландшафт, ЗА предел.' },
  { key: 'terrainPairWithin', title: 'Пара ландшафтов, ВНУТРИ' },
  { key: 'terrainPairOutside', title: 'Пара ландшафтов, ЗА предел.' },
  { key: 'buildingWithin', title: 'Здания, ВНУТРИ' },
  { key: 'buildingOutside', title: 'Здания, ЗА предел.' },
  { key: 'pirateWithin', title: 'Пираты, ВНУТРИ' },
  { key: 'pirateOutside', title: 'Пираты, ЗА предел.' },
];

const clampN = (v: string): number => Math.max(0, Math.min(4, Number(v) || 0));

export default function Controls({
  options,
  onChange,
  onGenerate,
  onRandom,
  busy,
  showSolution,
  onToggleSolution,
  onExport,
}: Props) {
  const [seedDraft, setSeedDraft] = useState(options.seed);

  useEffect(() => setSeedDraft(options.seed), [options.seed]);

  const limits: CluePoolLimits = { ...DEFAULT_CLUE_POOL_LIMITS, ...options.cluePoolLimits };
  const setLimit = (key: keyof CluePoolLimits, next: NumRange) =>
    onChange({
      ...options,
      cluePoolLimits: { ...DEFAULT_CLUE_POOL_LIMITS, ...options.cluePoolLimits, [key]: next },
    });

  return (
    <div className="space-y-4 rounded-2xl border border-amber-200/15 bg-[#111c33]/70 p-4 shadow-xl backdrop-blur">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg text-amber-100">Штурманская</h2>
        <span className="text-[11px] text-amber-200/50">генерация карты и подсказок</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className={label}>Пираты: {options.players}</span>
          <input
            type="range"
            min={2}
            max={5}
            value={options.players}
            onChange={(e) => onChange({ ...options, players: Number(e.target.value) })}
            className="w-full accent-amber-400"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className={label}>Ширина</span>
            <input
              type="number"
              min={8}
              max={16}
              value={options.width}
              onChange={(e) => onChange({ ...options, width: Math.max(8, Math.min(16, Number(e.target.value) || 12)) })}
              className={field}
            />
          </label>
          <label className="space-y-1">
            <span className={label}>Высота</span>
            <input
              type="number"
              min={6}
              max={14}
              value={options.height}
              onChange={(e) => onChange({ ...options, height: Math.max(6, Math.min(14, Number(e.target.value) || 9)) })}
              className={field}
            />
          </label>
        </div>
      </div>

      <label className="block space-y-1">
        <span className={label}>Seed (одинаково — одинаковая карта)</span>
        <div className="flex gap-2">
          <input value={seedDraft} onChange={(e) => setSeedDraft(e.target.value)} className={field} />
          <button
            onClick={() => onChange({ ...options, seed: seedDraft })}
            className="rounded-lg border border-amber-200/20 px-3 text-xs text-amber-100 hover:bg-amber-200/10"
          >
            ↵
          </button>
        </div>
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onGenerate(seedDraft)}
          disabled={busy}
          className="flex-1 rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 px-4 py-2.5 font-semibold text-[#241704] shadow-lg shadow-amber-900/30 transition hover:brightness-110 disabled:opacity-60"
        >
          {busy ? 'Считаем карту…' : '⚓ Сгенерировать карту'}
        </button>
        <button
          onClick={onRandom}
          disabled={busy}
          className="rounded-xl border border-amber-200/25 px-3 py-2.5 text-sm text-amber-100 hover:bg-amber-200/10 disabled:opacity-60"
          title="Случайный seed и новая карта"
        >
          🎲
        </button>
        <button
          onClick={onExport}
          className="rounded-xl border border-amber-200/25 px-3 py-2.5 text-sm text-amber-100 hover:bg-amber-200/10"
          title="Скачать карту и подсказки в JSON"
        >
          ⤓ JSON
        </button>
      </div>

      <div className="space-y-2">
        <p className={label}>Опциональные модули</p>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200/15 bg-[#0d1526]/60 px-3 py-2">
          <input
            type="checkbox"
            checked={!!options.blackBuildings}
            onChange={(e) => onChange({ ...options, blackBuildings: e.target.checked })}
            className="mt-0.5 h-4 w-4 accent-amber-400"
          />
          <span>
            <span className="block text-sm text-amber-100/90">💀 Чёрные здания</span>
            <span className="block text-[11px] text-amber-200/50">Чёрный маяк и чёрная лачуга — как у любой другой фракции</span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200/15 bg-[#0d1526]/60 px-3 py-2">
          <input
            type="checkbox"
            checked={!!options.blackTerritory}
            onChange={(e) => onChange({ ...options, blackTerritory: e.target.checked })}
            className="mt-0.5 h-4 w-4 accent-amber-400"
          />
          <span>
            <span className="block text-sm text-amber-100/90">☠️ Территория Черноборода</span>
            <span className="block text-[11px] text-amber-200/50">Третья захваченная зона, подсказки про неё входят в пул</span>
          </span>
        </label>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-amber-200/15 bg-[#0d1526]/60 px-3 py-2">
          <input
            type="checkbox"
            checked={showSolution}
            onChange={(e) => onToggleSolution(e.target.checked)}
            className="h-4 w-4 accent-amber-400"
          />
          <span className="text-sm text-amber-100/90">Показать сокровище 💎</span>
        </label>
      </div>

      <details className="rounded-xl border border-amber-200/15 bg-[#0d1526]/60 px-3 py-2">
        <summary className={`${label} cursor-pointer select-none`}>Границы пула подсказок (n: от … до)</summary>
        <div className="mt-2 space-y-1.5">
          {LIMIT_FIELDS.map(({ key, title }) => {
            const r = limits[key];
            return (
              <label key={key} className="flex items-center gap-2">
                <span className="w-[150px] shrink-0 truncate text-[11px] text-amber-200/60" title={title}>
                  {title}
                </span>
                <input
                  type="number"
                  min={0}
                  max={4}
                  value={r.min}
                  onChange={(e) => {
                    const v = clampN(e.target.value);
                    setLimit(key, { min: v, max: Math.max(v, r.max) });
                  }}
                  className={numField}
                />
                <span className="text-[11px] text-amber-200/40">…</span>
                <input
                  type="number"
                  min={0}
                  max={4}
                  value={r.max}
                  onChange={(e) => {
                    const v = clampN(e.target.value);
                    setLimit(key, { min: Math.min(r.min, v), max: v });
                  }}
                  className={numField}
                />
              </label>
            );
          })}
        </div>
      </details>
    </div>
  );
}
