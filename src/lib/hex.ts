/**
 * Математика гексагональной сетки (pointy-top, "odd-r" смещение:
 * нечётные строки сдвинуты вправо на полгекса).
 */

export interface HexGrid {
  width: number;
  height: number;
  count: number;
  /** индексы соседей для каждой клетки */
  neighbors: number[][];
  /** матрица расстояний (hex distance) между всеми клетками */
  dist: Uint8Array;
  index: (col: number, row: number) => number;
}

const EVEN = [
  [1, 0],
  [0, -1],
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];
const ODD = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [0, 1],
  [1, 1],
];

function toCube(col: number, row: number): [number, number, number] {
  const x = col - (row - (row & 1)) / 2;
  const z = row;
  return [x, -x - z, z];
}

export function hexDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
}

export function buildGrid(width: number, height: number): HexGrid {
  const count = width * height;
  const index = (col: number, row: number) => row * width + col;
  const neighbors: number[][] = [];
  const cubes: [number, number, number][] = [];

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const deltas = row & 1 ? ODD : EVEN;
      const nb: number[] = [];
      for (const [dc, dr] of deltas) {
        const c = col + dc;
        const r = row + dr;
        if (c >= 0 && c < width && r >= 0 && r < height) nb.push(index(c, r));
      }
      neighbors.push(nb);
      cubes.push(toCube(col, row));
    }
  }

  const dist = new Uint8Array(count * count);
  for (let i = 0; i < count; i++) {
    for (let j = 0; j < count; j++) {
      dist[i * count + j] = hexDistance(cubes[i], cubes[j]);
    }
  }

  return { width, height, count, neighbors, dist, index };
}

/** Пиксельные координаты центра гекса (pointy-top). */
export function hexCenter(col: number, row: number, size: number): { x: number; y: number } {
  return {
    x: size * Math.sqrt(3) * (col + 0.5 * (row & 1)),
    y: size * 1.5 * row,
  };
}

export function hexCorners(cx: number, cy: number, size: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30); // pointy-top
    pts.push(`${(cx + size * Math.cos(angle)).toFixed(2)},${(cy + size * Math.sin(angle)).toFixed(2)}`);
  }
  return pts.join(' ');
}

/** Связные компоненты по предикату. */
export function components(count: number, neighbors: number[][], belongs: (i: number) => boolean): number[][] {
  const seen = new Uint8Array(count);
  const out: number[][] = [];
  for (let start = 0; start < count; start++) {
    if (seen[start] || !belongs(start)) continue;
    const comp: number[] = [];
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const cur = stack.pop()!;
      comp.push(cur);
      for (const nb of neighbors[cur]) {
        if (!seen[nb] && belongs(nb)) {
          seen[nb] = 1;
          stack.push(nb);
        }
      }
    }
    out.push(comp);
  }
  return out;
}
