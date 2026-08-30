import { buildGrid, type HexGrid } from './hex';
import {
  BUILDING_KIND_INFO,
  FACTIONS,
  FACTION_INFO,
  PIRATE_INFO,
  PIRATES,
  TERRAINS,
  TERRAIN_INFO,
  type Clue,
  type ClueInstance,
  type Faction,
  type GameMap,
  type Pirate,
  type Terrain,
} from './types';

export const N_WORDS: Record<number, string> = {
  0: 'тайлов',
  1: 'одного тайла',
  2: 'двух тайлов',
  3: 'трёх тайлов',
  4: 'четырёх тайлов',
};

function terrainGenList(ts: Terrain[]): string {
  return ts.map((t) => TERRAIN_INFO[t].gen).join(' или ');
}

export function describeClue(clue: Clue): string {
  switch (clue.kind) {
    case 'terrain-dist':
      return clue.op === 'within'
        ? `Сокровище находится ВНУТРИ ${N_WORDS[clue.n]} от ${terrainGenList(clue.terrains)}`
        : `Сокровище находится ЗА пределами ${N_WORDS[clue.n]} от ${terrainGenList(clue.terrains)}`;
    case 'terrain-on':
      return `Сокровище находится ${clue.terrains.map((t) => TERRAIN_INFO[t].loc).join(' или ')}`;
    case 'building-dist': {
      const target = clue.target;
      let label: string;
      if (target.type === 'faction') {
        label = `зданий ${FACTION_INFO[target.faction].gen}`;
      } else if (target.type === 'kind') {
        label = BUILDING_KIND_INFO[target.kind].gen;
      } else {
        label = 'строений';
      }
      return clue.op === 'within'
        ? `Сокровище находится ВНУТРИ ${N_WORDS[clue.n]} от ${label}`
        : `Сокровище находится ЗА пределами ${N_WORDS[clue.n]} от ${label}`;
    }
    case 'pirate-dist': {
      const who = clue.pirate === 'any' ? 'захваченных территорий' : `территорий ${PIRATE_INFO[clue.pirate as Pirate].gen}`;
      return clue.op === 'within'
        ? `Сокровище находится ВНУТРИ ${N_WORDS[clue.n]} от ${who}`
        : `Сокровище находится ЗА пределами ${N_WORDS[clue.n]} от ${who}`;
    }
    case 'pirate-territory': {
      const who = clue.pirate === 'any' ? 'пиратов' : PIRATE_INFO[clue.pirate as Pirate].gen;
      return clue.on
        ? `Сокровище находится НА территориях ${who}`
        : `Сокровище НЕ находится на территориях ${who}`;
    }
  }
}

export function clueShortLabel(clue: Clue): string {
  const tIcon = (t: Terrain) => TERRAIN_INFO[t].icon;
  switch (clue.kind) {
    case 'terrain-dist':
      return `${clue.op === 'within' ? '≤' : '>'} ${clue.n} ${clue.terrains.map(tIcon).join('/')}`;
    case 'terrain-on':
      return `= ${clue.terrains.map(tIcon).join('/')}`;
    case 'building-dist': {
      const icon =
        clue.target.type === 'faction'
          ? FACTION_INFO[clue.target.faction as Faction].icon
          : BUILDING_KIND_INFO[clue.target.type === 'kind' ? clue.target.kind : 'lighthouse'].icon;
      return `${clue.op === 'within' ? '≤' : '>'} ${clue.n} ${icon}`;
    }
    case 'pirate-dist':
      return `${clue.op === 'within' ? '≤' : '>'} ${clue.n} 🏴`;
    case 'pirate-territory':
      return clue.on ? '🏴 на терр.' : '🏴 не на терр.';
  }
}

export function clueFamily(clue: Clue): string {
  switch (clue.kind) {
    case 'terrain-dist':
      return 'terrain-dist';
    case 'terrain-on':
      return 'terrain-on';
    case 'building-dist':
      return `building-${clue.target.type}`;
    case 'pirate-dist':
    case 'pirate-territory':
      return 'pirate';
  }
}

/* --------------------------- вычисление множеств --------------------------- */

export interface ClueContext {
  grid: HexGrid;
  terrainTiles: Record<Terrain, number[]>;
  buildingTiles: Record<string, number[]>;
  pirateTiles: Record<Pirate, number[]>;
  /** минимальное расстояние от каждой клетки до группы тайлов */
  distTo: (tiles: number[]) => Uint8Array;
}

export function buildContext(map: GameMap): ClueContext {
  const grid = buildGrid(map.grid.width, map.grid.height);
  const terrainTiles = {} as Record<Terrain, number[]>;
  for (const t of TERRAINS) terrainTiles[t] = map.tiles.filter((x) => x.terrain === t).map((x) => x.index);

  const buildingTiles: Record<string, number[]> = {};
  for (const f of FACTIONS) {
    buildingTiles[`faction:${f}`] = map.tiles.filter((t) => t.building?.faction === f).map((t) => t.index);
  }
  buildingTiles['kind:lighthouse'] = map.tiles.filter((t) => t.building?.kind === 'lighthouse').map((t) => t.index);
  buildingTiles['kind:shack'] = map.tiles.filter((t) => t.building?.kind === 'shack').map((t) => t.index);

  const pirateTiles = {} as Record<Pirate, number[]>;
  for (const p of PIRATES) {
    pirateTiles[p] = map.tiles.filter((t) => t.pirate === p).map((t) => t.index);
  }

  const cache = new Map<string, Uint8Array>();
  const distTo = (tiles: number[]): Uint8Array => {
    const key = tiles.join(',');
    const hit = cache.get(key);
    if (hit) return hit;
    const out = new Uint8Array(grid.count).fill(255);
    if (!tiles.length) {
      cache.set(key, out);
      return out;
    }
    for (let i = 0; i < grid.count; i++) {
      let best = 255;
      for (const t of tiles) {
        const d = grid.dist[i * grid.count + t];
        if (d < best) best = d;
      }
      out[i] = best;
    }
    cache.set(key, out);
    return out;
  };

  return { grid, terrainTiles, buildingTiles, pirateTiles, distTo };
}

export function evaluateClue(clue: Clue, ctx: ClueContext): number[] {
  const { grid } = ctx;
  const out: number[] = [];
  const keep = (test: (i: number) => boolean) => {
    for (let i = 0; i < grid.count; i++) if (test(i)) out.push(i);
  };

  switch (clue.kind) {
    case 'terrain-dist': {
      const set = new Set<number>();
      for (const t of clue.terrains) ctx.terrainTiles[t].forEach((i) => set.add(i));
      const d = ctx.distTo([...set]);
      keep((i) => (clue.op === 'within' ? d[i] <= clue.n : d[i] > clue.n));
      break;
    }
    case 'terrain-on': {
      const set = new Set(clue.terrains);
      for (const t of set) ctx.terrainTiles[t].forEach((i) => out.push(i));
      out.sort((a, b) => a - b);
      break;
    }
    case 'building-dist': {
      const key =
        clue.target.type === 'faction'
          ? `faction:${clue.target.faction}`
          : clue.target.type === 'kind'
            ? `kind:${clue.target.kind}`
            : 'kind:lighthouse';
      const d = ctx.distTo(ctx.buildingTiles[key] ?? []);
      keep((i) => (clue.op === 'within' ? d[i] <= clue.n : d[i] > clue.n));
      break;
    }
    case 'pirate-dist': {
      const tiles =
        clue.pirate === 'any'
          ? PIRATES.flatMap((p) => ctx.pirateTiles[p] ?? [])
          : ctx.pirateTiles[clue.pirate as Pirate] ?? [];
      const d = ctx.distTo(tiles);
      keep((i) => (clue.op === 'within' ? d[i] <= clue.n : d[i] > clue.n));
      break;
    }
    case 'pirate-territory': {
      const set = new Set<number>(
        clue.pirate === 'any'
          ? PIRATES.flatMap((p) => ctx.pirateTiles[p] ?? [])
          : ctx.pirateTiles[clue.pirate as Pirate] ?? [],
      );
      keep((i) => (clue.on ? set.has(i) : !set.has(i)));
      break;
    }
  }
  return out;
}



export interface NumRange {
  min: number;
  max: number;
}

/** Границы итераторов n для каждого цикла генерации подсказок в buildCluePool. */
export interface CluePoolLimits {
  /** terrain-dist within для одиночных ландшафтов */
  terrainSingleWithin: NumRange;
  /** terrain-dist outside для одиночных ландшафтов */
  terrainSingleOutside: NumRange;
  /** terrain-dist within для пар ландшафтов */
  terrainPairWithin: NumRange;
  /** terrain-dist outside для пар ландшафтов */
  terrainPairOutside: NumRange;
  /** building-dist within (фракции и типы строений) */
  buildingWithin: NumRange;
  /** building-dist outside (фракции и типы строений) */
  buildingOutside: NumRange;
  /** pirate-dist within */
  pirateWithin: NumRange;
  /** pirate-dist outside */
  pirateOutside: NumRange;
}

export const DEFAULT_CLUE_POOL_LIMITS: CluePoolLimits = {
  terrainSingleWithin: { min: 1, max: 2 },
  terrainSingleOutside: { min: 0, max: 1 },
  terrainPairWithin: { min: 1, max: 1 },
  terrainPairOutside: { min: 0, max: 0 },
  buildingWithin: { min: 1, max: 2 },
  buildingOutside: { min: 0, max: 1 },
  pirateWithin: { min: 1, max: 2 },
  pirateOutside: { min: 0, max: 1 },
};

/** Все возможные подсказки для данной карты. */
export function buildCluePool(
  map: GameMap,
  limits: CluePoolLimits = DEFAULT_CLUE_POOL_LIMITS,
): ClueInstance[] {
  const ctx = buildContext(map);
  const specs: Clue[] = [];

  const singles = TERRAINS.map((t) => [t] as Terrain[]);
  const pairs: Terrain[][] = [];
  for (let i = 0; i < TERRAINS.length; i++) {
    for (let j = i + 1; j < TERRAINS.length; j++) pairs.push([TERRAINS[i], TERRAINS[j]]);
  }

  for (const ts of singles) {
    for (let n = limits.terrainSingleWithin.min; n <= limits.terrainSingleWithin.max; n++)
      specs.push({ kind: 'terrain-dist', op: 'within', n, terrains: ts });
    for (let n = limits.terrainSingleOutside.min; n <= limits.terrainSingleOutside.max; n++)
      specs.push({ kind: 'terrain-dist', op: 'outside', n, terrains: ts });
    specs.push({ kind: 'terrain-on', terrains: ts });
  }

  for (const ts of pairs) {
    for (let n = limits.terrainPairWithin.min; n <= limits.terrainPairWithin.max; n++)
      specs.push({ kind: 'terrain-dist', op: 'within', n, terrains: ts });
    for (let n = limits.terrainPairOutside.min; n <= limits.terrainPairOutside.max; n++)
      specs.push({ kind: 'terrain-dist', op: 'outside', n, terrains: ts });
    specs.push({ kind: 'terrain-on', terrains: ts });
  }

  const presentFactions = FACTIONS.filter((f) => (ctx.buildingTiles[`faction:${f}`] ?? []).length > 0);
  for (const f of presentFactions) {
    for (let n = limits.buildingWithin.min; n <= limits.buildingWithin.max; n++)
      specs.push({ kind: 'building-dist', op: 'within', n, target: { type: 'faction', faction: f } });
    for (let n = limits.buildingOutside.min; n <= limits.buildingOutside.max; n++)
      specs.push({ kind: 'building-dist', op: 'outside', n, target: { type: 'faction', faction: f } });
  }
  for (const kind of ['lighthouse', 'shack'] as const) {
    for (let n = limits.buildingWithin.min; n <= limits.buildingWithin.max; n++)
      specs.push({ kind: 'building-dist', op: 'within', n, target: { type: 'kind', kind } });
    for (let n = limits.buildingOutside.min; n <= limits.buildingOutside.max; n++)
      specs.push({ kind: 'building-dist', op: 'outside', n, target: { type: 'kind', kind } });
  }

  const presentPirates = PIRATES.filter((p) => (ctx.pirateTiles[p] ?? []).length > 0);
  const pirateTargets: Array<Pirate | 'any'> = [...presentPirates, 'any'];
  for (const p of pirateTargets) {
    specs.push({ kind: 'pirate-territory', on: false, pirate: p });
    specs.push({ kind: 'pirate-territory', on: true, pirate: p });
    for (let n = limits.pirateWithin.min; n <= limits.pirateWithin.max; n++)
      specs.push({ kind: 'pirate-dist', op: 'within', n, pirate: p });
    for (let n = limits.pirateOutside.min; n <= limits.pirateOutside.max; n++)
      specs.push({ kind: 'pirate-dist', op: 'outside', n, pirate: p });
  }

  const seen = new Set<string>();
  const pool: ClueInstance[] = [];
  for (const clue of specs) {
    const tiles = evaluateClue(clue, ctx);
    if (tiles.length < 2) continue;
    const sig = `${tiles.length}:${tiles.join(',')}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    pool.push({ clue, text: describeClue(clue), short: clueShortLabel(clue), tiles });
  }
  return pool;
}
