export enum PieceType {
  EMPTY = 0,
  KING = 1,
  PRISM = 2,
  BLOCK = 3,
  SHOOTER = 4
}

export enum Owner {
  NONE = 0,
  PLAYER = 1,
  AI = 2
}

export enum Phase {
  ROLL = 'ROLL',
  ACTION = 'ACTION',
  SHOOT = 'SHOOT',
  ANIMATING = 'ANIMATING'
}

export interface Position {
  x: number;
  y: number;
}

export interface Piece {
  type: PieceType;
  owner: Owner;
  rotation: number;
  health?: number;
}

export interface BoardCell extends Piece, Position {}

export interface GameConfig {
  prismCount: number;
  blockCount: number;
}

export interface LeaderboardEntry {
  id?: string;
  player: string;
  score: number;
  date: string;
}

export const GRID_SIZE = 8;