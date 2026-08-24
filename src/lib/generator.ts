import { buildCluePool, clueFamily } from './clues';
import { generateMap, validateMap } from './mapgen';
import { hashString, mulberry32, shuffle, type Rng } from './rng';
import type { ClueInstance, GameMap } from './types';

export interface PuzzleOptions {
  players: number;
  width: number;
  height: number;
  seed: string;
  maxAttempts?: number;
  /** Чёрный маяк + чёрная лачуга (как у любой другой фракции). */
  blackBuildings?: boolean;
  /** Территории Черноборода. */
  blackTerritory?: boolean;
}

export interface PuzzleStats {
  attempts: number;
  timeMs: number;
  poolSize: number;
  solutionTile: number;
  clueShares: number[];
  pairShares: number[][];
  /** размер пересечения всех подсказок, КРОМЕ одной (для каждой из N) */
  minusOneIntersections: number[];
  mapIssues: string[];
  balanceScore: number;
}

/**
 * Допуск для свойства «зная N−1 подсказок, сокровище не найти»: пересечение
 * любых N−1 подсказок обязано оставлять ≥2 тайла, а остатки всех таких наборов
 * должны отличаться не более чем на MINUS_ONE_TOLERANCE (80%).
 */
export const MINUS_ONE_TOLERANCE = 0.8;

export interface PuzzleResult {
  map: GameMap;
  clues: ClueInstance[];
  solution: number;
  stats: PuzzleStats;
  ok: boolean;
  warnings: string[];
}

/**
 * Маски тайлов хранятся упакованными в 32-битные слова — так пересечение
 * двух подсказок считается за несколько тактов даже на карте 16×14.
 */
const POP = new Uint8Array(256);
for (let i = 1; i < 256; i++) POP[i] = POP[i >> 1] + (i & 1);

function pc32(x: number): number {
  return POP[x & 255] + POP[(x >>> 8) & 255] + POP[(x >>> 16) & 255] + POP[(x >>> 24) & 255];
}

function sizeOf(a: Uint32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += pc32(a[i]);
  return s;
}

function interSize(a: Uint32Array, b: Uint32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += pc32(a[i] & b[i]);
  return s;
}

function andWords(a: Uint32Array, b: Uint32Array): Uint32Array {
  const out = new Uint32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] & b[i];
  return out;
}

function wordsFromTiles(tiles: number[], words: number): Uint32Array {
  const w = new Uint32Array(words);
  for (const t of tiles) w[t >>> 5] |= 1 << (t & 31);
  return w;
}

function hasBit(w: Uint32Array, i: number): boolean {
  return ((w[i >>> 5] >>> (i & 31)) & 1) === 1;
}

interface Item {
  inst: ClueInstance;
  words: Uint32Array;
  size: number;
}

interface RoundCfg {
  min: number;
  max: number;
  sizeSpread: number;
  pairSpread: number;
  pairMin: number;
  pairMax: number;
  ideal: number;
  /** ожидаемый остаток при знании N−1 подсказок: count * ideal^(N−1) */
  subIdeal: number;
}

/**
 * Коридор размеров подсказок зависит от числа игроков: если пересечение N
 * подсказок должно дать ровно 1 тайл из `count`, то «идеальная» доля одной
 * подсказки ≈ (1.5 / count)^(1/N). Для 5 пиратов это ~43% карты, для 2 — ~12%.
 * Раньше порог был фиксированным (42%), поэтому подсказки про территории
 * пиратов (5 тайлов «на территории» и 95% карты «не на территории») и почти
 * все фракционные подсказки не проходили фильтр.
 */
const PHASES = [
  { lo: 0.72, hi: 1.45, spreadK: 0.30, pairK: 0.32, pairLo: 0.45, pairHi: 2.1 },
  { lo: 0.60, hi: 1.65, spreadK: 0.50, pairK: 0.52, pairLo: 0.32, pairHi: 2.6 },
  { lo: 0.45, hi: 1.95, spreadK: 0.80, pairK: 0.80, pairLo: 0.18, pairHi: 3.4 },
];

function roundCfg(players: number, count: number, phase: number): RoundCfg {
  const p = PHASES[phase];
  const ideal = Math.pow(1.5 / count, 1 / players);
  const pairIdeal = ideal * ideal;
  return {
    ideal,
    subIdeal: Math.pow(ideal, players - 1) * count,
    min: Math.max(0.045, ideal * p.lo),
    max: Math.min(0.9, ideal * p.hi),
    sizeSpread: ideal * p.spreadK,
    pairSpread: Math.max(0.02, pairIdeal * p.pairK),
    pairMin: Math.max(0.008, pairIdeal * p.pairLo),
    pairMax: Math.min(0.85, pairIdeal * p.pairHi),
  };
}

function stdev(a: number[]): number {
  if (!a.length) return 0;
  const m = a.reduce((s, x) => s + x, 0) / a.length;
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length);
}

interface Candidate {
  items: Item[];
  sol: number;
  score: number;
  pairShares: number[][];
  minusOne: number[];
  interSize: number;
}

/**
 * Жёсткие правила отбора: равная «ширина поиска», ни одна подсказка не является
 * подмножеством другой, парные пересечения сужают поиск примерно одинаково,
 * а пересечение любых N−1 подсказок оставляет ≥2 тайла — причём у всех таких
 * наборов остаток примерно один и тот же (допуск MINUS_ONE_TOLERANCE).
 */
function assess(items: Item[], sol: number, count: number, cfg: RoundCfg): Candidate | null {
  const shares = items.map((i) => i.size / count);
  for (const s of shares) if (s < cfg.min || s > cfg.max) return null;
  if (Math.max(...shares) - Math.min(...shares) > cfg.sizeSpread) return null;

  const pairShares: number[][] = [];
  const pairs: number[] = [];
  for (let i = 0; i < items.length; i++) {
    pairShares.push([]);
    for (let j = 0; j < items.length; j++) {
      if (i === j) {
        pairShares[i].push(0);
        continue;
      }
      const v = interSize(items[i].words, items[j].words) / count;
      pairShares[i].push(v);
      if (j > i) pairs.push(v);
    }
  }
  for (const p of pairs) if (p < cfg.pairMin || p > cfg.pairMax) return null;
  if (pairs.length > 1 && Math.max(...pairs) - Math.min(...pairs) > cfg.pairSpread) return null;

  for (let i = 0; i < items.length; i++) {
    for (let j = 0; j < items.length; j++) {
      if (i !== j && interSize(items[i].words, items[j].words) === items[i].size) return null;
    }
  }

  // свойство «N−1 подсказок недостаточно»: считаем пересечение всех наборов
  // «все подсказки, кроме одной»; каждый остаток обязан содержать ≥2 тайла
  // (иначе последняя подсказка избыточна и сокровище можно найти раньше времени),
  // а разброс остатков не должен превышать MINUS_ONE_TOLERANCE (80%).
  const minusOne: number[] = [];
  for (let skip = 0; skip < items.length; skip++) {
    let acc: Uint32Array | null = null;
    for (let j = 0; j < items.length; j++) {
      if (j === skip) continue;
      acc = acc === null ? items[j].words : andWords(acc, items[j].words);
    }
    const s = acc ? sizeOf(acc) : 0;
    if (s < 2) return null;
    minusOne.push(s);
  }
  const moMin = Math.min(...minusOne);
  const moMax = Math.max(...minusOne);
  if (moMax / moMin > 1 + MINUS_ONE_TOLERANCE) return null;

  let score = 0;
  for (const s of shares) score += Math.abs(s - cfg.ideal) * 1.1;
  score += stdev(shares) * 3.2;
  score += stdev(pairs) * 3.0;
  for (const p of pairs) score += Math.abs(p - cfg.ideal * cfg.ideal) * 0.45;
  // остатки N−1: тянем их к ожидаемому значению count·ideal^(N−1) и к равенству
  for (const m of minusOne) score += Math.abs(m - cfg.subIdeal) * 0.25;
  score += stdev(minusOne) * 2.6;
  const families = new Set(items.map((i) => clueFamily(i.inst.clue)));
  if (families.size < Math.min(items.length, 3)) score += 0.35;
  if (items.length > 2 && families.size === 1) score += 0.5;
  // поощряем разнообразие типов: ландшафт + фракции + территории пиратов
  score -= 0.05 * (families.size - 1);

  return { items, sol, score, pairShares, minusOne, interSize: 1 };
}

function searchSolutions(
  items: Item[],
  players: number,
  count: number,
  rng: Rng,
  cfg: RoundCfg,
  blocked: Set<number>,
  words: number,
): { exact: Candidate[]; near: Candidate[] } {
  const ALL = new Uint32Array(words);
  for (let i = 0; i < count; i++) ALL[i >>> 5] |= 1 << (i & 31);

  const budget = { left: 26000 };
  const exact: Candidate[] = [];
  const near: Candidate[] = [];
  const branch = players <= 2 ? 14 : players === 3 ? 9 : 7;
  const branchFirst = players <= 2 ? 14 : 11;
  const maxSolutions = 40;

  const tiles = shuffle(
    rng,
    Array.from({ length: count }, (_, i) => i),
  );

  for (const sol of tiles) {
    if (blocked.has(sol)) continue;
    const cand = items.filter((it) => hasBit(it.words, sol));
    if (cand.length < players) continue;
    const order = shuffle(rng, cand.slice()).sort((a, b) => b.size - a.size);

    const dfs = (cur: Uint32Array, chosen: Item[], startIdx: number, depth: number): void => {
      if (budget.left-- <= 0) return;
      if (chosen.length === players) {
        const c = sizeOf(cur);
        if (c === 1) {
          const res = assess(chosen, sol, count, cfg);
          if (res) exact.push(res);
        } else if (c <= 4) {
          near.push({ items: chosen.slice(), sol, score: 10 + c, pairShares: [], minusOne: [], interSize: c });
        }
        return;
      }
      const curSize = sizeOf(cur);
      const scored: { idx: number; size: number }[] = [];
      for (let i = startIdx; i < order.length; i++) {
        const s = interSize(cur, order[i].words);
        if (s === 0 || s >= curSize) continue;
        scored.push({ idx: i, size: s });
      }
      // для двух пиратов пересечение двух множеств должно сразу дать один тайл,
      // поэтому начинаем с более «узких» подсказок; для 3+ — с широких
      const wideFirst = depth === 0 && players > 2;
      scored.sort((a, b) => (wideFirst ? b.size - a.size : a.size - b.size));
      const limit = Math.min(depth === 0 ? branchFirst : branch, scored.length);
      for (let k = 0; k < limit; k++) {
        const idx = scored[k].idx;
        dfs(andWords(cur, order[idx].words), [...chosen, order[idx]], idx + 1, depth + 1);
        if (exact.length >= maxSolutions || budget.left <= 0) break;
      }
    };

    dfs(ALL, [], 0, 0);
    if (exact.length >= maxSolutions || budget.left <= 0) break;
  }

  exact.sort((a, b) => a.score - b.score);
  near.sort((a, b) => a.interSize - b.interSize || a.score - b.score);
  return { exact, near };
}

export function generatePuzzle(options: PuzzleOptions): PuzzleResult {
  const started = Date.now();
  const players = Math.max(2, Math.min(5, options.players));
  const maxAttempts = options.maxAttempts ?? 50;
  const warnings: string[] = [];

  let bestNear: { map: GameMap; items: Item[]; interSize: number; poolSize: number; attempt: number } | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const rng = mulberry32(hashString(`${options.seed}#${attempt}`));
    const phase = attempt <= Math.ceil(maxAttempts / 3) ? 0 : attempt <= Math.ceil((2 * maxAttempts) / 3) ? 1 : 2;

    const map = generateMap(
      {
        width: options.width,
        height: options.height,
        blackBuildings: options.blackBuildings,
        blackTerritory: options.blackTerritory,
      },
      rng,
    );
    const cfg = roundCfg(players, map.grid.count, phase);
    const minShare = cfg.min;
    const { ok: mapOk, issues } = validateMap(map);
    if (!mapOk && attempt <= maxAttempts - 4) continue;

    const pool = buildCluePool(map);
    const count = map.grid.count;
    const words = Math.ceil(count / 32);
    const items: Item[] = pool
      .map((inst) => ({ inst, words: wordsFromTiles(inst.tiles, words), size: inst.tiles.length }))
      .filter((it) => it.size >= 3 && it.size / count >= minShare && it.size / count <= cfg.max);

    if (items.length < players * 2) continue;

    const blocked = new Set<number>(map.tiles.filter((t) => t.building).map((t) => t.index));
    const { exact, near } = searchSolutions(items, players, count, rng, cfg, blocked, words);

    if (near.length && (!bestNear || near[0].interSize < bestNear.interSize)) {
      bestNear = { map, items: near[0].items, interSize: near[0].interSize, poolSize: pool.length, attempt };
    }

    if (exact.length) {
      const best = exact[0];
      const solution = best.sol;
      const clues = best.items.map((i) => i.inst);
      // контрольная проверка: пересечение всех подсказок — ровно один тайл
      const inter = clues.reduce<number[]>(
        (acc, c) => {
          const set = new Set(c.tiles);
          return acc.filter((i) => set.has(i));
        },
        clues[0].tiles.slice(),
      );
      if (inter.length !== 1 || inter[0] !== solution) {
        warnings.push('Контрольная проверка пересечения не прошла — карта перегенерирована');
        continue;
      }
      // контрольная проверка «N−1 недостаточно»: считаем остатки по спискам тайлов
      const minusOne = clues.map((_, skip) => {
        let acc: number[] | null = null;
        for (let j = 0; j < clues.length; j++) {
          if (j === skip) continue;
          const set = new Set(clues[j].tiles);
          acc = acc ? acc.filter((i) => set.has(i)) : clues[j].tiles.slice();
        }
        return acc ? acc.length : 0;
      });
      const moMin = Math.min(...minusOne);
      if (
        moMin < 2 ||
        Math.max(...minusOne) / moMin > 1 + MINUS_ONE_TOLERANCE
      ) {
        warnings.push('Условие «N−1 подсказок недостаточно» не выполнено — карта перегенерирована');
        continue;
      }
      return {
        map,
        clues,
        solution,
        ok: true,
        warnings: issues,
        stats: {
          attempts: attempt,
          timeMs: Date.now() - started,
          poolSize: pool.length,
          solutionTile: solution,
          clueShares: clues.map((c) => c.tiles.length / count),
          pairShares: best.pairShares,
          minusOneIntersections: best.minusOne,
          mapIssues: issues,
          balanceScore: best.score,
        },
      };
    }
  }

  if (bestNear) {
    const clues = bestNear.items.map((i) => i.inst);
    const inter = clues.reduce<number[]>(
      (acc, c) => {
        const set = new Set(c.tiles);
        return acc.filter((i) => set.has(i));
      },
      clues[0].tiles.slice(),
    );
    return {
      map: bestNear.map,
      clues,
      solution: inter[0] ?? 0,
      ok: false,
      warnings: [
        `Не удалось подобрать подсказки с пересечением ровно в 1 тайл (лучший вариант — ${inter.length}). Нажмите «случайный seed».`,
        ...warnings,
      ],
      stats: {
        attempts: maxAttempts,
        timeMs: Date.now() - started,
        poolSize: bestNear.poolSize,
        solutionTile: inter[0] ?? -1,
        clueShares: clues.map((c) => c.tiles.length / bestNear.map.grid.count),
        pairShares: [],
        minusOneIntersections: [],
        mapIssues: [],
        balanceScore: -1,
      },
    };
  }

  const map = generateMap(
    {
      width: options.width,
      height: options.height,
      blackBuildings: options.blackBuildings,
      blackTerritory: options.blackTerritory,
    },
    mulberry32(hashString(options.seed)),
  );
  return {
    map,
    clues: [],
    solution: -1,
    ok: false,
    warnings: ['Генерация не удалась: попробуйте другой seed или карту побольше.', ...warnings],
    stats: {
      attempts: maxAttempts,
      timeMs: Date.now() - started,
      poolSize: 0,
      solutionTile: -1,
      clueShares: [],
      pairShares: [],
      minusOneIntersections: [],
      mapIssues: [],
      balanceScore: -1,
    },
  };
}
