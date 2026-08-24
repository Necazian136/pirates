import { useMemo } from 'react';
import { hexCenter, hexCorners } from '../lib/hex';
import {
  BUILDING_KIND_INFO,
  FACTION_INFO,
  PIRATE_INFO,
  TERRAIN_INFO,
  type GameMap,
  type Tile,
} from '../lib/types';

export const PLAYER_COLORS = ['#fbbf24', '#38bdf8', '#f472b6', '#a3e635', '#c084fc'];

interface Props {
  map: GameMap;
  solution: number | null;
  showSolution: boolean;
  selectedClues: { tiles: number[]; color: string }[];
  hoverTile: number | null;
  selectedTile: number | null;
  onHover: (i: number | null, pos?: { x: number; y: number }) => void;
  onSelect: (i: number) => void;
}

const COLS = 'ABCDEFGHIJKLMNO';

function TerrainDeco({ tile, cx, cy, size }: { tile: Tile; cx: number; cy: number; size: number }) {
  const s = size;
  switch (tile.terrain) {
    case 'sea':
      return (
        <g stroke="rgba(255,255,255,.28)" strokeWidth={s * 0.06} fill="none" strokeLinecap="round">
          <path d={`M${cx - s * 0.42},${cy - s * 0.05} q${s * 0.18},${-s * 0.16} ${s * 0.36},0`} />
          <path d={`M${cx - s * 0.18},${cy + s * 0.28} q${s * 0.18},${-s * 0.16} ${s * 0.36},0`} />
        </g>
      );
    case 'reef':
      return (
        <g fill="rgba(0,0,0,.22)">
          <polygon points={`${cx - s * 0.34},${cy + s * 0.18} ${cx - s * 0.1},${cy - s * 0.2} ${cx + s * 0.12},${cy + s * 0.18}`} />
          <polygon points={`${cx + s * 0.06},${cy + s * 0.22} ${cx + s * 0.28},${cy - s * 0.04} ${cx + s * 0.4},${cy + s * 0.22}`} />
        </g>
      );
    case 'sand':
      return (
        <g fill="rgba(120,90,40,.28)">
          <circle cx={cx - s * 0.22} cy={cy + s * 0.12} r={s * 0.05} />
          <circle cx={cx + s * 0.12} cy={cy - s * 0.16} r={s * 0.05} />
          <circle cx={cx + s * 0.28} cy={cy + s * 0.2} r={s * 0.05} />
        </g>
      );
    case 'swamp':
      return (
        <g stroke="rgba(20,40,20,.32)" strokeWidth={s * 0.07} strokeLinecap="round">
          <path d={`M${cx - s * 0.3},${cy + s * 0.02} h${s * 0.26}`} />
          <path d={`M${cx - s * 0.02},${cy + s * 0.26} h${s * 0.3}`} />
        </g>
      );
    case 'vegetation':
      return (
        <g>
          <circle cx={cx - s * 0.18} cy={cy + s * 0.05} r={s * 0.16} fill="rgba(10,50,25,.35)" />
          <circle cx={cx + s * 0.16} cy={cy - s * 0.12} r={s * 0.13} fill="rgba(10,50,25,.28)" />
        </g>
      );
  }
}

export default function HexMap({
  map,
  solution,
  showSolution,
  selectedClues,
  hoverTile,
  selectedTile,
  onHover,
  onSelect,
}: Props) {
  const size = 26;
  const pad = 26;

  const geom = useMemo(() => {
    return map.tiles.map((t) => {
      const c = hexCenter(t.col, t.row, size);
      return { ...t, cx: c.x + pad, cy: c.y + pad, pts: hexCorners(c.x + pad, c.y + pad, size * 0.98) };
    });
  }, [map]);

  const coverCount = useMemo(() => {
    const counts = new Int8Array(map.grid.count);
    selectedClues.forEach((c) => c.tiles.forEach((i) => (counts[i] += 1)));
    return counts;
  }, [selectedClues, map.grid.count]);

  const clueSets = useMemo(() => selectedClues.map((c) => new Set(c.tiles)), [selectedClues]);

  const intersection = useMemo(() => {
    if (!selectedClues.length) return new Set<number>();
    const sets = selectedClues.map((c) => new Set(c.tiles));
    const out = new Set<number>();
    sets[0].forEach((i) => {
      if (sets.every((s) => s.has(i))) out.add(i);
    });
    return out;
  }, [selectedClues]);

  const width = Math.sqrt(3) * size * (map.grid.width + 0.5) + pad * 2;
  const height = size * (1.5 * map.grid.height + 0.5) + pad * 2;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full select-none"
      style={{ maxHeight: '72vh' }}
      onMouseLeave={() => onHover(null)}
    >
      <defs>
        <pattern id="terr-bronze" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="rgba(201,138,60,.30)" />
          <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(255,214,160,.75)" strokeWidth="3" />
        </pattern>
        <pattern id="terr-green" width="8" height="8" patternTransform="rotate(-45)" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="rgba(34,197,94,.28)" />
          <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(187,247,208,.7)" strokeWidth="3" />
        </pattern>
        <pattern id="terr-black" width="7" height="7" patternTransform="rotate(90)" patternUnits="userSpaceOnUse">
          <rect width="7" height="7" fill="rgba(17,24,39,.45)" />
          <line x1="0" y1="0" x2="0" y2="7" stroke="rgba(156,163,175,.85)" strokeWidth="3" />
        </pattern>
      </defs>

      {/* подписи координат */}
      <g fill="rgba(226,232,240,.45)" fontSize={11} fontFamily="ui-monospace, monospace">
        {Array.from({ length: map.grid.width }, (_, c) => (
          <text key={`c${c}`} x={hexCenter(c, 0, size).x + pad} y={pad - 12} textAnchor="middle">
            {COLS[c] ?? c + 1}
          </text>
        ))}
        {Array.from({ length: map.grid.height }, (_, r) => (
          <text key={`r${r}`} x={pad - 16} y={hexCenter(0, r, size).y + pad + 4} textAnchor="middle">
            {r + 1}
          </text>
        ))}
      </g>

      {/* тайлы */}
      <g>
        {geom.map((t) => {
          const info = TERRAIN_INFO[t.terrain];
          const isHover = hoverTile === t.index;
          const isSel = selectedTile === t.index;
          const isSolution = showSolution && solution === t.index;
          const inIntersection = intersection.has(t.index);
          return (
            <g
              key={t.index}
              onMouseEnter={(e) => onHover(t.index, { x: e.clientX, y: e.clientY })}
              onMouseMove={(e) => onHover(t.index, { x: e.clientX, y: e.clientY })}
              onClick={() => onSelect(t.index)}
              className="cursor-pointer"
            >
              <polygon
                points={t.pts}
                fill={info.color}
                stroke={isHover ? '#fff' : isSel ? '#fde68a' : 'rgba(4,10,20,.55)'}
                strokeWidth={isHover || isSel ? size * 0.14 : size * 0.07}
              />
              <TerrainDeco tile={t} cx={t.cx} cy={t.cy} size={size} />
              {t.pirate && (
                <polygon
                  points={t.pts}
                  fill={`url(#terr-${t.pirate === 'bronzebeard' ? 'bronze' : t.pirate === 'blackbeard' ? 'black' : 'green'})`}
                  stroke={PIRATE_INFO[t.pirate].color}
                  strokeWidth={size * 0.09}
                  strokeDasharray={`${size * 0.3} ${size * 0.22}`}
                  opacity={0.95}
                />
              )}
              {coverCount[t.index] > 0 && (
                <polygon
                  points={t.pts}
                  fill="#fff"
                  opacity={Math.min(0.06 + 0.11 * coverCount[t.index], 0.5)}
                />
              )}
              {clueSets.map((set, ci) =>
                set.has(t.index) ? (
                  <circle
                    key={ci}
                    cx={t.cx + size * 0.5 * Math.cos((ci / Math.max(1, selectedClues.length)) * Math.PI * 2 - Math.PI / 2)}
                    cy={t.cy + size * 0.5 * Math.sin((ci / Math.max(1, selectedClues.length)) * Math.PI * 2 - Math.PI / 2)}
                    r={size * 0.11}
                    fill={selectedClues[ci].color}
                    stroke="rgba(0,0,0,.5)"
                    strokeWidth={size * 0.03}
                  />
                ) : null,
              )}
              {inIntersection && (
                <circle
                  cx={t.cx}
                  cy={t.cy}
                  r={size * 0.62}
                  fill="none"
                  stroke="#f8fafc"
                  strokeWidth={size * 0.1}
                  className="animate-pulse"
                />
              )}
              {t.building && (
                <g>
                  <circle
                    cx={t.cx}
                    cy={t.cy - size * 0.02}
                    r={size * 0.46}
                    fill={
                      t.building.faction === 'white'
                        ? '#f8fafc'
                        : t.building.faction === 'black'
                          ? '#0b1020'
                          : FACTION_INFO[t.building.faction].color
                    }
                    stroke={t.building.faction === 'yellow' || t.building.faction === 'white' ? 'rgba(20,20,30,.75)' : 'rgba(255,255,255,.85)'}
                    strokeWidth={size * 0.08}
                  />
                  <text
                    x={t.cx}
                    y={t.cy + size * 0.16}
                    textAnchor="middle"
                    fontSize={size * 0.44}
                    style={{ pointerEvents: 'none' }}
                  >
                    {BUILDING_KIND_INFO[t.building.kind].icon}
                  </text>
                </g>
              )}
              {isSolution && (
                <g>
                  <circle cx={t.cx} cy={t.cy} r={size * 0.7} fill="rgba(253,224,71,.35)" stroke="#fde047" strokeWidth={size * 0.1} />
                  <text x={t.cx} y={t.cy + size * 0.22} textAnchor="middle" fontSize={size * 0.7}>
                    💎
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
