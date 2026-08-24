import { FACTIONS, FACTION_INFO, PIRATE_INFO, TERRAINS, TERRAIN_INFO, type ClueInstance, type GameMap, type Tile } from '../lib/types';
import { PLAYER_COLORS } from './HexMap';

const COLS = 'ABCDEFGHIJKLMNO';

export function Legend({ map }: { map: GameMap }) {
  return (
    <div className="grid gap-4 rounded-2xl border border-amber-200/15 bg-[#111c33]/70 p-4 text-sm shadow-xl backdrop-blur sm:grid-cols-2">
      <div>
        <p className="mb-2 text-[11px] uppercase tracking-wider text-amber-200/60">Ландшафт (равные доли ±3%)</p>
        <ul className="space-y-1.5">
          {TERRAINS.map((t) => (
            <li key={t} className="flex items-center gap-2">
              <span
                className="h-4 w-6 rounded-sm border border-black/40"
                style={{ background: `linear-gradient(135deg,${TERRAIN_INFO[t].color},${TERRAIN_INFO[t].color2})` }}
              />
              <span className="text-amber-50/90">
                {TERRAIN_INFO[t].icon} {TERRAIN_INFO[t].name}
              </span>
              <span className="ml-auto font-mono text-[11px] text-amber-200/60">
                {(map.terrainShares[t] * 100).toFixed(1)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="mb-2 text-[11px] uppercase tracking-wider text-amber-200/60">
          Строения: 1 маяк + 1 лачуга на фракцию
          {map.extras.blackBuildings ? ' · включая Чёрных' : ''}
        </p>
        <ul className="space-y-1.5">
          {FACTIONS.filter((f) => f !== 'black' || map.extras.blackBuildings).map((f) => {
            const info = FACTION_INFO[f];
            return (
              <li key={f} className="flex items-center gap-2">
                <span
                  className="grid h-4 w-4 place-items-center rounded-full border border-white/60 text-[9px]"
                  style={{ background: info.color }}
                />
                <span className="text-amber-50/90">
                  🗼🛖 {info.name}
                </span>
              </li>
            );
          })}
          <li className="mt-2 flex flex-wrap gap-2 border-t border-amber-200/10 pt-2">
            {(Object.keys(PIRATE_INFO) as Array<keyof typeof PIRATE_INFO>)
              .filter((p) => (map.pirateTiles[p] ?? []).length > 0)
              .map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px]"
                  style={{
                    background: `repeating-linear-gradient(45deg, ${PIRATE_INFO[p].color}55 0 5px, transparent 5px 10px)`,
                    border: `1px dashed ${PIRATE_INFO[p].color}`,
                    color: '#fde68a',
                  }}
                >
                  🏴 территории {PIRATE_INFO[p].name} ({map.pirateTiles[p].length})
                </span>
              ))}
          </li>
        </ul>
      </div>
    </div>
  );
}

export function TileInspector({
  tile,
  map,
  clues,
  selected,
}: {
  tile: Tile | null;
  map: GameMap;
  clues: ClueInstance[];
  selected: number[];
}) {
  if (!tile) {
    return (
      <div className="rounded-2xl border border-amber-200/15 bg-[#111c33]/70 p-4 text-sm text-amber-200/60 shadow-xl backdrop-blur">
        Наведи курсор на тайл — здесь появится его разбор: ландшафт, строение, хозяин территории и то, каким подсказкам
        он соответствует.
      </div>
    );
  }
  const info = TERRAIN_INFO[tile.terrain];
  const satisfied = clues.map((c, i) => (c.tiles.includes(tile.index) ? i : -1)).filter((i) => i >= 0);
  return (
    <div className="rounded-2xl border border-amber-200/15 bg-[#111c33]/70 p-4 text-sm shadow-xl backdrop-blur">
      <div className="flex items-center justify-between">
        <span className="font-mono text-lg text-amber-100">
          {COLS[tile.col] ?? tile.col + 1}
          {tile.row + 1}
        </span>
        <span className="rounded-md px-2 py-0.5 text-[11px]" style={{ background: info.color, color: '#0b1220' }}>
          {info.icon} {info.name}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px] text-amber-100/80">
        <div>
          <dt className="text-amber-200/50">Строение</dt>
          <dd>
            {tile.building
              ? `${FACTION_INFO[tile.building.faction].icon} ${FACTION_INFO[tile.building.faction].name}`
              : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-amber-200/50">Тип строения</dt>
          <dd>{tile.building ? (tile.building.kind === 'lighthouse' ? '🗼 маяк' : '🛖 лачуга') : '—'}</dd>
        </div>
        <div>
          <dt className="text-amber-200/50">Территория</dt>
          <dd>{tile.pirate ? `🏴 ${PIRATE_INFO[tile.pirate].name}` : 'ничейная'}</dd>
        </div>
        <div>
          <dt className="text-amber-200/50">Подсказки «да»</dt>
          <dd className="flex flex-wrap gap-1 pt-0.5">
            {satisfied.length ? (
              satisfied.map((i) => (
                <span
                  key={i}
                  className={`grid h-4 w-4 place-items-center rounded text-[10px] font-bold text-[#10182b] ${
                    selected.includes(i) ? 'ring-2 ring-amber-300' : ''
                  }`}
                  style={{ background: PLAYER_COLORS[i % PLAYER_COLORS.length] }}
                >
                  {i + 1}
                </span>
              ))
            ) : (
              <span className="text-amber-200/50">ни одной</span>
            )}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-[11px] leading-relaxed text-amber-200/50">
        Всего тайлов на карте: {map.grid.count} · строений: {map.tiles.filter((t) => t.building).length} · захвачено:{' '}
        {map.tiles.filter((t) => t.pirate).length}
      </p>
    </div>
  );
}

export function StatsBar({
  ok,
  attempts,
  timeMs,
  poolSize,
  intersectionSize,
  solutionLabel,
  mapIssues,
  warnings,
}: {
  ok: boolean;
  attempts: number;
  timeMs: number;
  poolSize: number;
  intersectionSize: number;
  solutionLabel: string;
  mapIssues: string[];
  warnings: string[];
}) {
  const items = [
    { k: 'Пересечение всех подсказок', v: `${intersectionSize} тайл`, good: intersectionSize === 1 },
    { k: 'Точка сокровища', v: solutionLabel },
    { k: 'Попыток генерации', v: String(attempts) },
    { k: 'Кандидатов-подсказок', v: String(poolSize) },
    { k: 'Время', v: `${timeMs} мс` },
  ];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {items.map((it) => (
          <div key={it.k} className="rounded-xl border border-amber-200/10 bg-[#0d1526]/70 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-amber-200/50">{it.k}</p>
            <p className={`font-mono text-sm ${it.good === false ? 'text-rose-300' : 'text-amber-100'}`}>{it.v}</p>
          </div>
        ))}
      </div>
      {!ok && warnings.length > 0 && (
        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-200">
          {warnings.map((w, i) => (
            <p key={i}>⚠ {w}</p>
          ))}
        </div>
      )}
      {ok && mapIssues.length > 0 && (
        <div className="rounded-xl border border-amber-300/20 bg-amber-300/5 px-3 py-2 text-[11px] text-amber-200/70">
          {mapIssues.map((w, i) => (
            <p key={i}>• {w}</p>
          ))}
        </div>
      )}
    </div>
  );
}
