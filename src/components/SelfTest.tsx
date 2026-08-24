import { useState } from 'react';
import { clueFamily } from '../lib/clues';
import { generatePuzzle } from '../lib/generator';

const FAMILY_LABEL: Record<string, string> = {
  'terrain-dist': 'ландшафт (дист.)',
  'terrain-on': 'ландшафт (на)',
  'building-faction': 'фракции',
  'building-kind': 'маяки/лачуги',
  pirate: 'территории пиратов',
};

interface Row {
  players: number;
  seed: string;
  ok: boolean;
  inter: number;
  minShare: number;
  maxShare: number;
  attempts: number;
  ms: number;
  issues: number;
  families: string[];
}

export default function SelfTest() {
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);

  const run = () => {
    setRunning(true);
    setRows([]);
    const jobs: { players: number; seed: string }[] = [];
    for (const p of [2, 3, 4, 5]) {
      for (let i = 0; i < 2; i++) jobs.push({ players: p, seed: `проверка-${p}-${i}` });
    }
    const out: Row[] = [];
    let idx = 0;
    const step = () => {
      if (idx >= jobs.length) {
        setRunning(false);
        return;
      }
      const job = jobs[idx++];
      const res = generatePuzzle({ ...job, width: 12, height: 9, maxAttempts: 24 });
      const inter = res.clues.reduce<number[]>((acc, c) => {
        const s = new Set(c.tiles);
        return acc.filter((i) => s.has(i));
      }, res.clues[0]?.tiles.slice() ?? []);
      const shares = res.clues.map((c) => c.tiles.length / res.map.grid.count);
      out.push({
        players: job.players,
        seed: job.seed,
        ok: res.ok && inter.length === 1,
        inter: inter.length,
        minShare: shares.length ? Math.min(...shares) : 0,
        maxShare: shares.length ? Math.max(...shares) : 0,
        attempts: res.stats.attempts,
        ms: res.stats.timeMs,
        issues: res.stats.mapIssues.length,
        families: res.clues.map((c) => clueFamily(c.clue)),
      });
      setRows([...out]);
      window.setTimeout(step, 0);
    };
    window.setTimeout(step, 0);
  };

  const good = rows.filter((r) => r.ok).length;

  return (
    <div className="rounded-2xl border border-amber-200/15 bg-[#111c33]/70 p-4 shadow-xl backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg text-amber-100">Самопроверка генератора</h2>
          <p className="text-[11px] text-amber-200/50">
            8 прогонов (2–5 пиратов, карта 12×9): пересечение всех подсказок = 1 тайл, разброс долей, попытки и время.
          </p>
        </div>
        <button
          onClick={run}
          disabled={running}
          className="rounded-xl border border-amber-200/30 px-4 py-2 text-sm text-amber-100 hover:bg-amber-200/10 disabled:opacity-50"
        >
          {running ? `Проверяем… ${rows.length}/8` : '▶ Запустить проверку'}
        </button>
      </div>

      {rows.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse font-mono text-[11px]">
            <thead>
              <tr className="text-amber-200/60">
                {['пираты', 'seed', 'пересечение', 'доля min', 'доля max', 'попыток', 'мс', 'нарушений'].map((h) => (
                  <th key={h} className="border-b border-amber-200/15 px-2 py-1.5 text-left font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="text-amber-100/90">
                  <td className="border-b border-amber-200/10 px-2 py-1.5">{r.players}</td>
                  <td className="border-b border-amber-200/10 px-2 py-1.5">{r.seed}</td>
                  <td className={`border-b border-amber-200/10 px-2 py-1.5 ${r.ok ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {r.inter} {r.ok ? '✓' : '✗'}
                  </td>
                  <td className="border-b border-amber-200/10 px-2 py-1.5">{(r.minShare * 100).toFixed(0)}%</td>
                  <td className="border-b border-amber-200/10 px-2 py-1.5">{(r.maxShare * 100).toFixed(0)}%</td>
                  <td className="border-b border-amber-200/10 px-2 py-1.5">{r.attempts}</td>
                  <td className="border-b border-amber-200/10 px-2 py-1.5">{r.ms}</td>
                  <td className="border-b border-amber-200/10 px-2 py-1.5">{r.issues}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-amber-200/50">
            Успешно: {good}/{rows.length}. «Нарушений» — количество замечаний валидатора карты (доли ландшафта, размеры
            регионов, по одному строению на фракцию, минимум 2 тайла территории).
          </p>

          <div className="mt-3 space-y-1">
            <p className="text-[11px] uppercase tracking-wider text-amber-200/60">Какие типы подсказок выпали</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(
                rows
                  .flatMap((r) => r.families)
                  .reduce<Record<string, number>>((acc, f) => ({ ...acc, [f]: (acc[f] ?? 0) + 1 }), {}),
              )
                .sort((a, b) => b[1] - a[1])
                .map(([f, n]) => (
                  <span
                    key={f}
                    className={`rounded-md border px-2 py-1 text-[11px] ${
                      f === 'pirate'
                        ? 'border-emerald-300/40 bg-emerald-400/10 text-emerald-200'
                        : 'border-amber-200/20 bg-amber-200/5 text-amber-100/80'
                    }`}
                  >
                    {FAMILY_LABEL[f] ?? f}: {n}
                  </span>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
