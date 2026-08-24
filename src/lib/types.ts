export type Terrain = 'sea' | 'swamp' | 'reef' | 'sand' | 'vegetation';

export const TERRAINS: Terrain[] = ['sea', 'swamp', 'reef', 'sand', 'vegetation'];

export interface TerrainInfo {
  id: Terrain;
  name: string;
  /** родительный падеж: «внутри одного тайла от ...» */
  gen: string;
  /** предложный падеж: «сокровище находится на ...» */
  loc: string;
  color: string;
  color2: string;
  icon: string;
}

export const TERRAIN_INFO: Record<Terrain, TerrainInfo> = {
  sea: { id: 'sea', name: 'Море', gen: 'моря', loc: 'на море', color: '#1668a8', color2: '#0d4c7d', icon: '🌊' },
  swamp: { id: 'swamp', name: 'Болота', gen: 'болота', loc: 'на болоте', color: '#5d7a34', color2: '#3f5522', icon: '🪵' },
  reef: { id: 'reef', name: 'Рифы', gen: 'рифов', loc: 'на рифах', color: '#0f8f93', color2: '#0a6669', icon: '🪨' },
  sand: { id: 'sand', name: 'Песок', gen: 'песка', loc: 'на песке', color: '#dfc27c', color2: '#bfa05a', icon: '🏖️' },
  vegetation: {
    id: 'vegetation',
    name: 'Растительность',
    gen: 'растительности',
    loc: 'в зарослях',
    color: '#2f7d4f',
    color2: '#1d5635',
    icon: '🌴',
  },
};

export type Faction = 'blue' | 'purple' | 'yellow' | 'red' | 'white' | 'black';

export interface FactionInfo {
  id: Faction;
  name: string;
  /** родительный падеж: «внутри двух тайлов от зданий ...» */
  gen: string;
  color: string;
  icon: string;
}

export const FACTIONS: Faction[] = ['blue', 'purple', 'yellow', 'red', 'white', 'black'];

export const FACTION_INFO: Record<Faction, FactionInfo> = {
  blue: { id: 'blue', name: 'Голубые торговцы', gen: 'Голубых торговцев', color: '#3b82f6', icon: '⚓' },
  purple: { id: 'purple', name: 'Культ Черепа', gen: 'Культа Черепа', color: '#a855f7', icon: '🔮' },
  yellow: { id: 'yellow', name: 'Золотоискатели', gen: 'Золотоискателей', color: '#facc15', icon: '⛏️' },
  red: { id: 'red', name: 'Охотники', gen: 'Охотников', color: '#ef4444', icon: '🏹' },
  white: { id: 'white', name: 'Рыболовы', gen: 'Рыболовов', color: '#f1f5f9', icon: '🐟' },
  black: { id: 'black', name: 'Чёрные', gen: 'Чёрных', color: '#111827', icon: '💀' },
};

export const CORE_FACTIONS: Faction[] = ['blue', 'purple', 'yellow', 'red', 'white'];

export type BuildingKind = 'lighthouse' | 'shack';

export const BUILDING_KIND_INFO: Record<BuildingKind, { name: string; gen: string; icon: string }> = {
  lighthouse: { name: 'Маяк', gen: 'маяков', icon: '🗼' },
  shack: { name: 'Лачуга', gen: 'лачуг', icon: '🛖' },
};

export interface Building {
  kind: BuildingKind;
  faction: Faction;
}

export type Pirate = 'bronzebeard' | 'green' | 'blackbeard';

export const PIRATES: Pirate[] = ['bronzebeard', 'green', 'blackbeard'];
export const CORE_PIRATES: Pirate[] = ['bronzebeard', 'green'];

export const PIRATE_INFO: Record<Pirate, { name: string; gen: string; color: string; icon: string }> = {
  bronzebeard: { name: 'Бронзобород', gen: 'Бронзоборода', color: '#c98a3c', icon: '🦱' },
  green: { name: 'капитан Грин', gen: 'капитана Грина', color: '#22c55e', icon: '🧭' },
  blackbeard: { name: 'Чернобород', gen: 'Черноборода', color: '#6b7280', icon: '☠️' },
};

export interface Tile {
  index: number;
  col: number;
  row: number;
  terrain: Terrain;
  building: Building | null;
  pirate: Pirate | null;
}

export interface MapExtras {
  /** Чёрный маяк + чёрная лачуга (работают как обычные здания фракции). */
  blackBuildings: boolean;
  /** Захваченные территории Черноборода. */
  blackTerritory: boolean;
}

export interface GameMap {
  grid: { width: number; height: number; count: number };
  tiles: Tile[];
  terrainShares: Record<Terrain, number>;
  pirateTiles: Record<Pirate, number[]>;
  extras: MapExtras;
}

/* ------------------------------- Подсказки ------------------------------- */

export type ClueOp = 'within' | 'outside';

export type ClueTarget =
  | { type: 'terrain'; terrains: Terrain[] }
  | { type: 'faction'; faction: Faction }
  | { type: 'kind'; kind: BuildingKind }
  | { type: 'pirate'; pirate: Pirate | 'any' };

export type Clue =
  | { kind: 'terrain-dist'; op: ClueOp; n: number; terrains: Terrain[] }
  | { kind: 'terrain-on'; terrains: Terrain[] }
  | { kind: 'building-dist'; op: ClueOp; n: number; target: ClueTarget }
  | { kind: 'pirate-dist'; op: ClueOp; n: number; pirate: Pirate | 'any' }
  | { kind: 'pirate-territory'; on: boolean; pirate: Pirate | 'any' };

export interface ClueInstance {
  clue: Clue;
  text: string;
  short: string;
  /** индексы тайлов, где сокровище МОЖЕТ находиться по этой подсказке */
  tiles: number[];
}
