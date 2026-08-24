import { useEffect, useMemo, useState } from 'react';
import Controls from './components/Controls';
import CluePanel from './components/CluePanel';
import { Legend, StatsBar, TileInspector } from './components/MapInfo';
import SelfTest from './components/SelfTest';
import HexMap, { PLAYER_COLORS } from './components/HexMap';
import { generatePuzzle, type PuzzleOptions, type PuzzleResult } from './lib/generator';
import { randomSeed } from './lib/rng';
import { FACTION_INFO, PIRATE_INFO, TERRAIN_INFO } from './lib/types';

const COLS = 'ABCDEFGHIJKLMNO';

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export default function App() {
  const [options, setOptions] = useState<PuzzleOptions>({
    players: 4,
    width: 12,
    height: 9,
    seed: randomSeed(),
    blackBuildings: false,
    blackTerritory: false,
  });
  const [result, setResult] = useState<PuzzleResult | null>(null);
  const [busy, setBusy] = useState(true);
  const [selected, setSelected] = useState<number[]>([0]);
  const [showSolution, setShowSolution] = useState(false);
  const [hover, setHover] = useState<{ tile: number; x: number; y: number } | null>(null);
  const [selectedTile, setSelectedTile] = useState<number | null>(null);
  const [showRules, setShowRules] = useState(false);

  const run = (opts: PuzzleOptions) => {
    setBusy(true);
    setSelected([0]);
    setShowSolution(false);
    setSelectedTile(null);
    window.setTimeout(() => {
      const res = generatePuzzle(opts);
      setResult(res);
      setBusy(false);
    }, 30);
  };

  useEffect(() => {
    run(options);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const map = result?.map ?? null;
  const clues = result?.clues ?? [];

  const intersectionAll = useMemo(() => {
    if (!clues.length) return [] as number[];
    return clues.reduce<number[]>((acc, c) => {
      const set = new Set(c.tiles);
      return acc.filter((i) => set.has(i));
    }, clues[0].tiles.slice());
  }, [clues]);

  const selectedClues = useMemo(
    () =>
      selected
        .filter((i) => i < clues.length)
        .map((i) => ({ tiles: clues[i].tiles, color: PLAYER_COLORS[i % PLAYER_COLORS.length] })),
    [selected, clues],
  );

  const hoverTile = hover && map ? map.tiles[hover.tile] : null;
  const inspectTile = map ? map.tiles[selectedTile ?? hover?.tile ?? -1] ?? null : null;

  const exportJson = () => {
    if (!result) return;
    const data = {
      seed: options.seed,
      players: options.players,
      extras: result.map.extras,
      map: {
        width: result.map.grid.width,
        height: result.map.grid.height,
        tiles: result.map.tiles.map((t) => ({
          cell: `${COLS[t.col] ?? t.col + 1}${t.row + 1}`,
          terrain: t.terrain,
          building: t.building ? { kind: t.building.kind, faction: t.building.faction } : null,
          pirate: t.pirate,
        })),
      },
      clues: clues.map((c, i) => ({ player: i + 1, clue: c.clue, text: c.text, candidates: c.tiles.length })),
      solution: {
        cell: `${COLS[result.solution % result.map.grid.width] ?? ''}${Math.floor(result.solution / result.map.grid.width) + 1}`,
        index: result.solution,
      },
      stats: result.stats,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cryptid-pirates-${options.seed}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const solutionLabel = map && result && result.solution >= 0
    ? `${COLS[result.solution % map.grid.width] ?? ''}${Math.floor(result.solution / map.grid.width) + 1}`
    : '—';

  return (
    <div className="min-h-screen bg-[#070d1b] text-amber-50">
      <div
        className="pointer-events-none fixed inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(1200px 600px at 15% -10%, rgba(56,189,248,.12), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(251,191,36,.12), transparent 60%), radial-gradient(1000px 800px at 50% 120%, rgba(16,185,129,.08), transparent 60%)',
        }}
      />

      <div className="relative mx-auto max-w-[1500px] px-4 py-6 lg:px-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-amber-300/60">Cryptid · пиратская версия</p>
            <h1 className="font-serif text-3xl text-amber-100 sm:text-4xl">
              🏴‍☠️ Остров сокровищ: генератор карты и подсказок
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-amber-100/60">
              Гексагональная карта из 5 ландшафтов, маяки и лачуги пяти фракций, захваченные территории
              Бронзоборода и капитана Грина. Опционально — чёрный маяк, чёрная лачуга и земли Черноборода.
              Пересечение всех подсказок указывает ровно на один тайл, а любых N−1 — оставляет несколько
              примерно равных кандидатов.
            </p>
          </div>
          <button
            onClick={() => setShowRules((v) => !v)}
            className="rounded-xl border border-amber-200/25 px-4 py-2 text-sm text-amber-100 hover:bg-amber-200/10"
          >
            {showRules ? 'Скрыть' : 'Как устроена генерация'}
          </button>
        </header>

        {showRules && (
          <div className="mb-6 grid gap-3 rounded-2xl border border-amber-200/15 bg-[#111c33]/70 p-5 text-[13px] leading-relaxed text-amber-100/80 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <h3 className="mb-1 font-serif text-amber-200">Карта</h3>
              <ul className="list-disc space-y-1 pl-4">
                <li>прямоугольник из гексов {options.width}×{options.height} (по умолчанию 12×9);</li>
                <li>ландшафт — Wave Function Collapse с жёсткими квотами: доли равны с допуском 3%;</li>
                <li>ни один регион ландшафта не бывает меньше 2 тайлов;</li>
                <li>
                  ровно один маяк и одна лачуга у каждой фракции, строения разнесены минимум на 3 гекса;
                  опционально — чёрный маяк и чёрная лачуга (работают так же);
                </li>
                <li>
                  захваченные территории Бронзоборода и капитана Грина — 9% карты (по умолчанию 8–10 тайлов),
                  минимум по 2 тайла, могут дробиться на чанки; опционально добавляется третья зона Черноборода.
                </li>
              </ul>
            </div>
            <div>
              <h3 className="mb-1 font-serif text-amber-200">Подсказки</h3>
              <ul className="list-disc space-y-1 pl-4">
                <li>
                  «внутри N тайлов от …», «за пределами N тайлов от …», «на болоте или на рифах», «на территориях
                  Бронзоборода», «не на территориях капитана Грина», «внутри двух тайлов от территорий пиратов»;
                </li>
                <li>
                  у каждого пирата примерно одинаковое число допустимых тайлов; целевая доля зависит от числа игроков —
                  ≈(1,5/клеток)^(1/N), то есть ~43% карты при пяти пиратах и ~12% при двух;
                </li>
                <li>подсказки не совпадают и ни одна не является подмножеством другой;</li>
                <li>пересечение любой пары сужает поиск примерно одинаково;</li>
                <li>
                  зная любые N−1 подсказок, сокровище найти НЕЛЬЗЯ: пересечение каждого такого набора оставляет
                  больше одного тайла, и все остатки примерно равны (допуск 80%);
                </li>
                <li>пересечение ВСЕХ подсказок — ровно один тайл, иначе карта перегенерируется.</li>
              </ul>
            </div>
            <div>
              <h3 className="mb-1 font-serif text-amber-200">Подбор</h3>
              <p>
                Все возможные подсказки (их ~150) превращаются в битовые маски тайлов. Затем поиск в глубину перебирает
                комбинации из N подсказок с общим тайлом-кандидатом, отсекая ветви, которые не сужают поиск. Найденные
                варианты ранжируются по «балансу»: близость долей к 50%, минимальный разброс размеров, парных
                пересечений и остатков N−1. Варианты, где N−1 подсказок уже указывают на сокровище или оставляют
                сильно разные остатки (допуск 80%), отбраковываются. Если ни одна комбинация не подходит — карта
                генерируется заново с новым сидом.
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-5">
            <div className="relative overflow-hidden rounded-2xl border border-amber-200/15 bg-gradient-to-b from-[#0f1c33]/90 to-[#0a1222]/90 p-3 shadow-2xl">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-2">
                <span className="font-serif text-amber-200">
                  Карта «{options.seed}» · {options.players}{' '}
                  {plural(options.players, 'пират', 'пирата', 'пиратов')} · подсказок: {clues.length}
                  {map?.extras.blackBuildings ? ' · 💀 Чёрные' : ''}
                  {map?.extras.blackTerritory ? ' · ☠️ Чернобород' : ''}
                </span>
                <span className="flex flex-wrap gap-2 text-[11px]">
                  {selected.map((i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-md border border-amber-200/25 px-2 py-0.5 font-mono"
                      style={{ color: PLAYER_COLORS[i % PLAYER_COLORS.length] }}
                    >
                      ● пират {i + 1}
                    </span>
                  ))}
                  {selected.length > 1 && (
                    <span className="rounded-md border border-slate-200/25 px-2 py-0.5 text-slate-200">
                      пересечение выбранных: ⭕
                    </span>
                  )}
                </span>
              </div>
              {busy || !map ? (
                <div className="grid h-[420px] place-items-center text-amber-200/60">
                  <div className="text-center">
                    <div className="mb-3 animate-bounce text-4xl">🧭</div>
                    Прокладываем маршрут, считаем подсказки…
                  </div>
                </div>
              ) : (
                <HexMap
                  map={map}
                  solution={result!.solution}
                  showSolution={showSolution}
                  selectedClues={selectedClues}
                  hoverTile={hover?.tile ?? null}
                  selectedTile={selectedTile}
                  onHover={(i, pos) => setHover(i === null || !pos ? null : { tile: i, x: pos.x, y: pos.y })}
                  onSelect={(i) => setSelectedTile((prev) => (prev === i ? null : i))}
                />
              )}
            </div>

            {result && (
              <StatsBar
                ok={result.ok}
                attempts={result.stats.attempts}
                timeMs={result.stats.timeMs}
                poolSize={result.stats.poolSize}
                intersectionSize={intersectionAll.length}
                minusOneIntersections={result.stats.minusOneIntersections}
                solutionLabel={solutionLabel}
                mapIssues={result.stats.mapIssues}
                warnings={result.warnings}
              />
            )}

            {map && <Legend map={map} />}
            <SelfTest />
          </div>

          <div className="space-y-5">
            <Controls
              options={options}
              onChange={(o) => setOptions(o)}
              onGenerate={(seed) => {
                setOptions({ ...options, seed });
                run({ ...options, seed });
              }}
              onRandom={() => {
                const seed = randomSeed();
                setOptions({ ...options, seed });
                run({ ...options, seed });
              }}
              busy={busy}
              showSolution={showSolution}
              onToggleSolution={setShowSolution}
              onExport={exportJson}
            />
            <CluePanel
              clues={clues}
              selected={selected}
              onToggle={(i) =>
                setSelected((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]))
              }
              tileCount={map?.grid.count ?? 1}
              pairShares={result?.stats.pairShares ?? []}
            />
            {map && <TileInspector tile={inspectTile} map={map} clues={clues} selected={selected} />}
          </div>
        </div>

        <footer className="mt-8 border-t border-amber-200/10 pt-4 text-[11px] text-amber-200/40">
          Генератор детерминирован: один и тот же seed и размер карты всегда дают одну и ту же карту и те же подсказки.
          Игровая логика (вопросы, флажки, раскопки) — за пределами этого генератора.
        </footer>
      </div>

      {hoverTile && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-[130%] rounded-lg border border-amber-200/25 bg-[#0b1220]/95 px-3 py-2 text-[12px] shadow-xl"
          style={{ left: hover!.x, top: hover!.y }}
        >
          <span className="font-mono text-amber-100">
            {COLS[hoverTile.col] ?? hoverTile.col + 1}
            {hoverTile.row + 1}
          </span>{' '}
          <span style={{ color: TERRAIN_INFO[hoverTile.terrain].color === '#dfc27c' ? '#f5e0a3' : '#cbd5e1' }}>
            · {TERRAIN_INFO[hoverTile.terrain].icon} {TERRAIN_INFO[hoverTile.terrain].name}
          </span>
          {hoverTile.building && (
            <span> · {FACTION_INFO[hoverTile.building.faction].icon} {FACTION_INFO[hoverTile.building.faction].name}</span>
          )}
          {hoverTile.pirate && <span> · 🏴 {PIRATE_INFO[hoverTile.pirate].name}</span>}
        </div>
      )}
    </div>
  );
}
