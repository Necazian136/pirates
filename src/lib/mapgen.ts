import { buildGrid, components, type HexGrid } from './hex';
import { pick, randInt, shuffle, weightedPick, type Rng } from './rng';
import {
  BUILDING_KIND_INFO,
  CORE_FACTIONS,
  CORE_PIRATES,
  FACTION_INFO,
  PIRATE_INFO,
  PIRATES,
  TERRAINS,
  TERRAIN_INFO,
  type Building,
  type BuildingKind,
  type GameMap,
  type Pirate,
  type Terrain,
  type Tile,
} from './types';

export interface MapGenOptions {
  width: number;
  height: number;
  /** доля карты под захваченные территории; по умолчанию по 0.09 на каждого пирата */
  pirateShare?: number;
  /** минимальная дистанция между строениями */
  minBuildingDist?: number;
  /** Чёрный маяк + чёрная лачуга (как у любой другой фракции). */
  blackBuildings?: boolean;
  /** Территории Черноборода. */
  blackTerritory?: boolean;
}

const LAND_LIKE: Terrain[] = ['sand', 'vegetation', 'swamp'];

function quotasFor(count: number): Record<Terrain, number> {
  const base = Math.floor(count / TERRAINS.length);
  const rest = count - base * TERRAINS.length;
  const q = {} as Record<Terrain, number>;
  TERRAINS.forEach((t, i) => (q[t] = base + (i < rest ? 1 : 0)));
  return q;
}

/**
 * «Схлопнутый» Wave Function Collapse: у каждой клетки есть домен из 5 ландшафтов,
 * жёсткое ограничение — квоты (равные доли ландшафтов), мягкое — кластеризация
 * (лучшая гипотеза клетки та, что совпадает с уже схлопнутыми соседями).
 */
function collapseTerrain(grid: HexGrid, rng: Rng, clusterBias = 1.35): Terrain[] {
  const { count, neighbors } = grid;
  const quotas = quotasFor(count);
  const remaining: Record<Terrain, number> = { ...quotas };
  const collapsed: (Terrain | null)[] = new Array(count).fill(null);
  const open = new Array(count).fill(true).map((_, i) => i);
  const placed = new Array(count).fill(0);

  const domainOf = (): Terrain[] => {
    const dom = TERRAINS.filter((t) => remaining[t] > 0);
    return dom.length ? dom : TERRAINS.slice();
  };

  while (open.length) {
    // минимальная энтропия => минимум доступных ландшафтов, при равенстве — максимум соседей
    let bestIdx = -1;
    let bestKey = null as null | [number, number, number];
    for (const i of open) {
      const dom = domainOf();
      const key: [number, number, number] = [dom.length, -placed[i], rng() * 0.5];
      if (
        bestKey === null ||
        key[0] < bestKey[0] ||
        (key[0] === bestKey[0] && key[1] < bestKey[1]) ||
        (key[0] === bestKey[0] && key[1] === bestKey[1] && key[2] < bestKey[2])
      ) {
        bestKey = key;
        bestIdx = i;
      }
    }
    const cell = bestIdx;
    const dom = domainOf();
    const neighbourCount: Record<string, number> = {};
    for (const nb of neighbors[cell]) {
      const t = collapsed[nb];
      if (t) neighbourCount[t] = (neighbourCount[t] ?? 0) + 1;
    }
    const totalLeft = TERRAINS.reduce((s, t) => s + remaining[t], 0) || 1;
    const terrain = weightedPick(rng, dom, (t) => {
      const nb = neighbourCount[t] ?? 0;
      const edge = isEdge(grid, cell) && (t === 'sea' || t === 'reef') ? 1.6 : 1;
      return (0.25 + (remaining[t] / totalLeft) * 2.5) * (1 + clusterBias * nb) * edge;
    });

    collapsed[cell] = terrain;
    remaining[terrain] -= 1;
    for (const nb of neighbors[cell]) placed[nb] += 1;
    open.splice(open.indexOf(cell), 1);
  }

  return collapsed as Terrain[];
}

function isEdge(grid: HexGrid, i: number): boolean {
  const { width, height } = grid;
  const col = i % width;
  const row = Math.floor(i / width);
  return col === 0 || col === width - 1 || row === 0 || row === height - 1;
}

/** Ни один ландшафтный регион не должен состоять из одного тайла. */
function repairTinyPatches(grid: HexGrid, rng: Rng, terrains: Terrain[]): { changed: number } {
  let changed = 0;
  let guard = 0;

  const patchOf = (t: Terrain) => components(grid.count, grid.neighbors, (i) => terrains[i] === t);

  let unstable = true;
  while (unstable && guard++ < 12) {
    unstable = false;
    for (const t of TERRAINS) {
      const patches = patchOf(t);
      const tiny = patches.filter((p) => p.length < 2);
      if (!tiny.length) continue;
      for (const patch of tiny) {
        // самый частый ландшафт среди соседей
        const votes: Record<string, number> = {};
        for (const i of patch) {
          for (const nb of grid.neighbors[i]) {
            if (terrains[nb] === t) continue;
            votes[terrains[nb]] = (votes[terrains[nb]] ?? 0) + 1;
          }
        }
        const winner = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
        if (!winner) continue;
        const newTerrain = winner[0] as Terrain;
        for (const i of patch) terrains[i] = newTerrain;
        changed += patch.length;
        unstable = true;

        // восстанавливаем квоту: перекидываем один тайл нового ландшафта в старый
        const candidates = shuffle(
          rng,
          terrains
            .map((tt, i) => ({ tt, i }))
            .filter(({ tt, i }) => tt === newTerrain && !patch.includes(i)),
        );
        for (const c of candidates) {
          const touchesOld = grid.neighbors[c.i].some((nb) => terrains[nb] === t);
          if (!touchesOld) continue;
          const after = patchOf(newTerrain).find((p) => p.includes(c.i));
          if (after && after.length <= 2) continue;
          terrains[c.i] = t;
          break;
        }
      }
    }
  }
  return { changed };
}

function terrainPreference(kind: BuildingKind, terrain: Terrain): number {
  if (kind === 'lighthouse') {
    return terrain === 'sea' ? 3 : terrain === 'reef' ? 2.4 : terrain === 'sand' ? 1.8 : 0.8;
  }
  if (kind === 'shack') {
    return LAND_LIKE.includes(terrain) ? 2.2 : terrain === 'reef' ? 1.0 : 0.5;
  }
  return terrain === 'reef' ? 2 : terrain === 'swamp' ? 1.8 : 1.2;
}

/** Ровно один маяк и одна лачуга на каждую активную фракцию. */
function placeBuildings(grid: HexGrid, rng: Rng, tiles: Tile[], minDist: number, blackBuildings: boolean) {
  const factions = blackBuildings ? [...CORE_FACTIONS, 'black' as const] : CORE_FACTIONS;
  const required: Building[] = [];
  for (const f of factions) {
    required.push({ kind: 'lighthouse', faction: f });
    required.push({ kind: 'shack', faction: f });
  }

  let dist = minDist;
  const placedIdx: number[] = [];
  for (const b of shuffle(rng, required)) {
    let cell = -1;
    while (dist >= 1) {
      const candidates: number[] = [];
      for (let i = 0; i < grid.count; i++) {
        if (tiles[i].building) continue;
        if (placedIdx.some((p) => grid.dist[i * grid.count + p] < dist)) continue;
        candidates.push(i);
      }
      if (candidates.length) {
        cell = weightedPick(rng, candidates, (i) => {
          const t = tiles[i].terrain;
          let w = terrainPreference(b.kind, t);
          if (tiles[i].pirate) w *= 0.35;
          const neighboursBuilt = grid.neighbors[i].some((nb) => tiles[nb].building) ? 0.4 : 1;
          return w * neighboursBuilt;
        });
        break;
      }
      dist -= 1;
    }
    if (cell < 0) {
      const free: number[] = [];
      for (let i = 0; i < grid.count; i++) if (!tiles[i].building) free.push(i);
      cell = pick(rng, free);
    }
    tiles[cell].building = b;
    placedIdx.push(cell);
  }
}

/** Захваченные территории: по pirateShare карты на КАЖДОГО пирата, минимум по 2 тайла, возможна дробь на чанки. */
function placePirateTerritories(grid: HexGrid, rng: Rng, tiles: Tile[], share: number, pirates: Pirate[]) {
  const n = Math.max(1, pirates.length);
  const total = Math.max(n * 2, Math.round(grid.count * share));
  const base = Math.floor(total / n);
  const rest = total - base * n;
  const sizes = {} as Record<Pirate, number>;
  pirates.forEach((p, i) => {
    sizes[p] = Math.max(2, base + (i < rest ? 1 : 0));
  });

  const occupied = new Set<number>();
  const result = {} as Record<Pirate, number[]>;
  for (const p of PIRATES) result[p] = [];

  const growChunk = (pirate: Pirate, size: number) => {
    const startCandidates = shuffle(
      rng,
      tiles
        .map((t) => t.index)
        .filter(
          (i) =>
            !occupied.has(i) &&
            !tiles[i].building &&
            (LAND_LIKE.includes(tiles[i].terrain) || tiles[i].terrain === 'reef'),
        ),
    );
    const start = startCandidates[0];
    if (start === undefined) return;
    const blob = [start];
    occupied.add(start);
    result[pirate].push(start);
    while (blob.length < size) {
      const frontier: number[] = [];
      for (const i of blob) {
        for (const nb of grid.neighbors[i]) {
          if (occupied.has(nb) || tiles[nb].building || result[pirate].includes(nb)) continue;
          frontier.push(nb);
        }
      }
      if (!frontier.length) break;
      const next = weightedPick(rng, frontier, (i) => (LAND_LIKE.includes(tiles[i].terrain) ? 2.4 : 1));
      occupied.add(next);
      blob.push(next);
      result[pirate].push(next);
    }
  };

  (Object.keys(sizes) as Pirate[]).forEach((pirate) => {
    let left = sizes[pirate];
    let guard = 0;
    while (left > 0 && guard++ < 8) {
      const chunk = left <= 3 ? left : randInt(rng, Math.max(2, left - 2), left);
      const before = result[pirate].length;
      growChunk(pirate, chunk);
      const grown = result[pirate].length - before;
      if (grown === 0) break;
      left -= grown;
    }
    tiles.forEach((t) => {
      if (result[pirate].includes(t.index)) t.pirate = pirate;
    });
  });

  return result;
}

export function generateMap(opts: MapGenOptions, rng: Rng): GameMap {
  const grid = buildGrid(opts.width, opts.height);
  const terrains = collapseTerrain(grid, rng);
  repairTinyPatches(grid, rng, terrains);

  const tiles: Tile[] = terrains.map((terrain, index) => ({
    index,
    col: index % opts.width,
    row: Math.floor(index / opts.width),
    terrain,
    building: null,
    pirate: null,
  }));

  const extras = {
    blackBuildings: !!opts.blackBuildings,
    blackTerritory: !!opts.blackTerritory,
  };
  const pirates: Pirate[] = extras.blackTerritory ? [...CORE_PIRATES, 'blackbeard'] : [...CORE_PIRATES];
  // по 9% карты на каждую территорию пирата (не суммарно)
  const share = opts.pirateShare ?? 0.09 * pirates.length;

  placePirateTerritories(grid, rng, tiles, share, pirates);
  placeBuildings(grid, rng, tiles, opts.minBuildingDist ?? 3, extras.blackBuildings);

  const terrainShares = {} as Record<Terrain, number>;
  for (const t of TERRAINS) terrainShares[t] = terrains.filter((x) => x === t).length / grid.count;

  const pirateTiles = {} as Record<Pirate, number[]>;
  for (const p of PIRATES) pirateTiles[p] = [];
  tiles.forEach((t) => {
    if (t.pirate) pirateTiles[t.pirate].push(t.index);
  });

  return {
    grid: { width: grid.width, height: grid.height, count: grid.count },
    tiles,
    terrainShares,
    pirateTiles,
    extras,
  };
}

/** Проверка правил генерации карты. */
export function validateMap(map: GameMap): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  const { tiles, grid } = map;
  const counts = {} as Record<Terrain, number>;
  for (const t of TERRAINS) counts[t] = 0;
  tiles.forEach((t) => counts[t.terrain]++);

  for (const t of TERRAINS) {
    const share = counts[t] / grid.count;
    if (Math.abs(share - 1 / TERRAINS.length) > 0.03 + 1 / grid.count) {
      issues.push(`Ландшафт «${TERRAIN_INFO[t].name}» занимает ${(share * 100).toFixed(1)}% (допуск ±3%)`);
    }
  }

  const g = buildGrid(grid.width, grid.height);
  for (const t of TERRAINS) {
    const patches = components(g.count, g.neighbors, (i) => tiles[i].terrain === t);
    if (patches.some((p) => p.length < 2)) issues.push(`У «${TERRAIN_INFO[t].name}» есть регион из 1 тайла`);
  }

  const factions = map.extras.blackBuildings ? [...CORE_FACTIONS, 'black' as const] : CORE_FACTIONS;
  for (const f of factions) {
    const lights = tiles.filter((t) => t.building?.faction === f && t.building?.kind === 'lighthouse').length;
    const shacks = tiles.filter((t) => t.building?.faction === f && t.building?.kind === 'shack').length;
    if (lights !== 1) issues.push(`${FACTION_INFO[f].name}: маяков ${lights} (нужно ровно 1)`);
    if (shacks !== 1) issues.push(`${FACTION_INFO[f].name}: лачуг ${shacks} (нужно ровно 1)`);
  }
  if (!map.extras.blackBuildings) {
    const n = tiles.filter((t) => t.building?.faction === 'black').length;
    if (n) issues.push(`Чёрных зданий на карте: ${n} (опция выключена)`);
  }

  const pirates: Pirate[] = map.extras.blackTerritory ? [...CORE_PIRATES, 'blackbeard'] : [...CORE_PIRATES];
  const total = tiles.filter((t) => t.pirate).length;
  const expected = Math.max(pirates.length * 2, Math.round(grid.count * 0.09 * pirates.length));
  if (Math.abs(total - expected) > 2) {
    issues.push(`Захваченные территории: ${total} тайлов вместо ~${expected}`);
  }
  for (const p of pirates) {
    if (map.pirateTiles[p].length < 2) issues.push(`Территория ${PIRATE_INFO[p].name} меньше 2 тайлов`);
  }
  if (!map.extras.blackTerritory && map.pirateTiles.blackbeard.length) {
    issues.push('Территория Черноборода появилась при выключенной опции');
  }

  const buildings = tiles.filter((t) => t.building);
  for (let i = 0; i < buildings.length; i++) {
    for (let j = i + 1; j < buildings.length; j++) {
      if (g.dist[buildings[i].index * g.count + buildings[j].index] < 2) {
        issues.push(`Строения стоят вплотную друг к другу: ${BUILDING_KIND_INFO[buildings[i].building!.kind].name} и ${BUILDING_KIND_INFO[buildings[j].building!.kind].name}`);
      }
    }
  }

  return { ok: issues.length === 0, issues };
}
