export type Player = 0 | 1

export interface Position {
  row: number
  col: number
}

export type Orientation = 'horizontal' | 'vertical'

export interface Wall {
  row: number
  col: number
  orientation: Orientation
}

export type Move =
  | { type: 'pawn'; to: Position }
  | { type: 'wall'; wall: Wall }

export interface GameState {
  size: number
  pawns: [Position, Position]
  wallsRemaining: [number, number]
  walls: Wall[]
  currentPlayer: Player
  winner: Player | null
  turn: number
}

export interface AiResult {
  move: Move | null
  depth: number
  nodes: number
  elapsed: number
}
