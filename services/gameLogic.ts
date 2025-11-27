
import { PieceType, Owner, GRID_SIZE, Piece, Position } from '../types';

export const DIRS = {
  UP: { x: 0, y: -1, label: 'UP' },
  RIGHT: { x: 1, y: 0, label: 'RIGHT' },
  DOWN: { x: 0, y: 1, label: 'DOWN' },
  LEFT: { x: -1, y: 0, label: 'LEFT' },
  NE: { x: 1, y: -1, label: 'NE' },
  SE: { x: 1, y: 1, label: 'SE' },
  SW: { x: -1, y: 1, label: 'SW' },
  NW: { x: -1, y: -1, label: 'NW' }
};

export const createBoard = (config: { prismCount: number; blockCount: number }): Piece[][] => {
  // Use Array.from to ensure unique object references for each cell
  const board: Piece[][] = Array.from({ length: GRID_SIZE }, () => 
    Array.from({ length: GRID_SIZE }, () => ({ type: PieceType.EMPTY, owner: Owner.NONE, rotation: 0 }))
  );

  // Place Shooters
  board[0][0] = { type: PieceType.SHOOTER, owner: Owner.AI, rotation: 180 }; 
  board[GRID_SIZE - 1][7] = { type: PieceType.SHOOTER, owner: Owner.PLAYER, rotation: 0 };

  // Place Kings
  board[0][3] = { type: PieceType.KING, owner: Owner.AI, rotation: 180 }; 
  board[GRID_SIZE - 1][4] = { type: PieceType.KING, owner: Owner.PLAYER, rotation: 0 };

  const placeRandom = (count: number, type: PieceType, owner: Owner, validRows: number[]) => {
    let placed = 0;
    let attempts = 0;
    while (placed < count && attempts < 100) {
      const r = validRows[Math.floor(Math.random() * validRows.length)];
      const c = Math.floor(Math.random() * GRID_SIZE);
      if (board[r][c].type === PieceType.EMPTY) {
        board[r][c] = { 
          type, 
          owner, 
          rotation: type === PieceType.PRISM ? Math.floor(Math.random() * 4) * 90 : 0,
          health: type === PieceType.BLOCK ? 2 : undefined
        };
        placed++;
      }
      attempts++;
    }
  };

  // Prisms are Neutral (Owner.NONE)
  placeRandom(config.prismCount, PieceType.PRISM, Owner.NONE, [4, 5, 6]);
  
  // Blocks are now Neutral (Owner.NONE) as per new rules
  placeRandom(config.blockCount, PieceType.BLOCK, Owner.NONE, [4, 5, 6]);
  
  placeRandom(config.prismCount, PieceType.PRISM, Owner.NONE, [1, 2, 3]);
  placeRandom(config.blockCount, PieceType.BLOCK, Owner.NONE, [1, 2, 3]);

  return board;
};

export const findPiece = (board: Piece[][], type: PieceType, owner: Owner): Position | null => {
  for(let y=0; y<GRID_SIZE; y++) 
    for(let x=0; x<GRID_SIZE; x++) 
      if (board[y][x].type === type && board[y][x].owner === owner) return {x, y};
  return null;
};

export const calculateLaserPath = (board: Piece[][], shooterPos: Position | null, owner: Owner): { path: Position[], prismHits: number } => {
  if (!shooterPos) return { path: [], prismHits: 0 };

  let path: Position[] = [];
  let currX = shooterPos.x;
  let currY = shooterPos.y;
  let dir = owner === Owner.PLAYER ? DIRS.UP : DIRS.DOWN;
  let prismHits = 0;

  path.push({ x: currX, y: currY });
  currX += dir.x;
  currY += dir.y;

  let alive = true;
  let steps = 0;
  const MAX_STEPS = 50;
  let stopNext = false; 

  while (alive && steps < MAX_STEPS) {
    if (currX < 0 || currX >= GRID_SIZE || currY < 0 || currY >= GRID_SIZE) {
      path.push({ x: currX, y: currY });
      break;
    }

    path.push({ x: currX, y: currY });
    
    if (stopNext) {
      alive = false;
      break;
    }

    const cell = board[currY][currX];

    if (cell.type === PieceType.BLOCK || cell.type === PieceType.SHOOTER) {
      alive = false;
    } else if (cell.type === PieceType.KING) {
      alive = false;
    } else if (cell.type === PieceType.PRISM) {
      const rot = cell.rotation;
      let newDir = null;
      let action = 'absorb';

      // Physics Logic (45-45-90 Triangle Prism)
      if (rot === 0) { 
        if (dir === DIRS.UP) { newDir = DIRS.LEFT; action = 'reflect'; }
        else if (dir === DIRS.RIGHT) { newDir = DIRS.DOWN; action = 'reflect'; }
        else if (dir === DIRS.DOWN || dir === DIRS.LEFT || dir === DIRS.SW) { newDir = DIRS.SW; action = 'refract'; }
      } 
      else if (rot === 90) { 
        if (dir === DIRS.DOWN) { newDir = DIRS.LEFT; action = 'reflect'; }
        else if (dir === DIRS.RIGHT) { newDir = DIRS.UP; action = 'reflect'; }
        else if (dir === DIRS.UP || dir === DIRS.LEFT || dir === DIRS.NW) { newDir = DIRS.NW; action = 'refract'; }
      } 
      else if (rot === 180) { 
        if (dir === DIRS.DOWN) { newDir = DIRS.RIGHT; action = 'reflect'; }
        else if (dir === DIRS.LEFT) { newDir = DIRS.UP; action = 'reflect'; }
        else if (dir === DIRS.UP || dir === DIRS.RIGHT || dir === DIRS.NE) { newDir = DIRS.NE; action = 'refract'; }
      } 
      else if (rot === 270) { 
        if (dir === DIRS.UP) { newDir = DIRS.RIGHT; action = 'reflect'; }
        else if (dir === DIRS.LEFT) { newDir = DIRS.DOWN; action = 'reflect'; }
        else if (dir === DIRS.DOWN || dir === DIRS.RIGHT || dir === DIRS.SE) { newDir = DIRS.SE; action = 'refract'; }
      }

      if (newDir) {
        dir = newDir;
        prismHits++; // Count successful prism interactions
        if (action === 'refract') stopNext = true; 
      } else if (action === 'absorb') {
        alive = false;
      }
    }

    if (alive) {
      currX += dir.x;
      currY += dir.y;
    }
    steps++;
  }

  return { path, prismHits };
};
