import type { GameState, Move, Orientation, Player, Position, Wall } from './types'

export const WALLS_BY_SIZE: Record<number, number> = { 7: 8, 9: 10, 11: 12 }
const DIRECTIONS: Position[] = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
]

export function createGame(size = 9): GameState {
  if (![7, 9, 11].includes(size)) throw new Error('Unsupported board size')
  const middle = Math.floor(size / 2)
  const supply = WALLS_BY_SIZE[size]
  return {
    size,
    pawns: [{ row: size - 1, col: middle }, { row: 0, col: middle }],
    wallsRemaining: [supply, supply],
    walls: [],
    currentPlayer: 0,
    winner: null,
    turn: 0,
  }
}

export function samePosition(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col
}

export function inBounds(state: GameState, p: Position): boolean {
  return p.row >= 0 && p.col >= 0 && p.row < state.size && p.col < state.size
}

export function isEdgeBlocked(state: GameState, a: Position, b: Position): boolean {
  if (a.row === b.row) {
    const col = Math.min(a.col, b.col)
    return state.walls.some(
      (w) => w.orientation === 'vertical' && w.col === col && (w.row === a.row || w.row === a.row - 1),
    )
  }
  const row = Math.min(a.row, b.row)
  return state.walls.some(
    (w) => w.orientation === 'horizontal' && w.row === row && (w.col === a.col || w.col === a.col - 1),
  )
}

function step(p: Position, d: Position): Position {
  return { row: p.row + d.row, col: p.col + d.col }
}

export function getLegalPawnMoves(state: GameState, player = state.currentPlayer): Position[] {
  if (state.winner !== null) return []
  const from = state.pawns[player]
  const opponent = state.pawns[player === 0 ? 1 : 0]
  const legal: Position[] = []

  for (const direction of DIRECTIONS) {
    const adjacent = step(from, direction)
    if (!inBounds(state, adjacent) || isEdgeBlocked(state, from, adjacent)) continue
    if (!samePosition(adjacent, opponent)) {
      legal.push(adjacent)
      continue
    }

    const jump = step(opponent, direction)
    if (inBounds(state, jump) && !isEdgeBlocked(state, opponent, jump)) {
      legal.push(jump)
      continue
    }

    const sides = direction.row !== 0
      ? [{ row: 0, col: -1 }, { row: 0, col: 1 }]
      : [{ row: -1, col: 0 }, { row: 1, col: 0 }]
    for (const side of sides) {
      const diagonal = step(opponent, side)
      if (inBounds(state, diagonal) && !isEdgeBlocked(state, opponent, diagonal)) legal.push(diagonal)
    }
  }
  return legal
}

function wallConflicts(state: GameState, wall: Wall): boolean {
  return state.walls.some((placed) => {
    if (placed.orientation !== wall.orientation) {
      return placed.row === wall.row && placed.col === wall.col
    }
    if (wall.orientation === 'horizontal') {
      return placed.row === wall.row && Math.abs(placed.col - wall.col) <= 1
    }
    return placed.col === wall.col && Math.abs(placed.row - wall.row) <= 1
  })
}

export function pathExists(state: GameState, player: Player): boolean {
  return shortestPathLength(state, player) < Infinity
}

export function shortestPathLength(state: GameState, player: Player): number {
  const start = state.pawns[player]
  const goalRow = player === 0 ? 0 : state.size - 1
  const queue: Array<{ position: Position; distance: number }> = [{ position: start, distance: 0 }]
  const seen = new Set([`${start.row},${start.col}`])

  for (let index = 0; index < queue.length; index += 1) {
    const { position, distance } = queue[index]
    if (position.row === goalRow) return distance
    for (const direction of DIRECTIONS) {
      const next = step(position, direction)
      const key = `${next.row},${next.col}`
      if (!inBounds(state, next) || seen.has(key) || isEdgeBlocked(state, position, next)) continue
      seen.add(key)
      queue.push({ position: next, distance: distance + 1 })
    }
  }
  return Infinity
}

export function getShortestPath(state: GameState, player: Player): Position[] {
  const start = state.pawns[player]
  const goalRow = player === 0 ? 0 : state.size - 1
  const queue: Position[] = [start]
  const parent = new Map<string, Position | null>([[`${start.row},${start.col}`, null]])
  let end: Position | null = null
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index]
    if (current.row === goalRow) { end = current; break }
    for (const direction of DIRECTIONS) {
      const next = step(current, direction)
      const key = `${next.row},${next.col}`
      if (!inBounds(state, next) || parent.has(key) || isEdgeBlocked(state, current, next)) continue
      parent.set(key, current)
      queue.push(next)
    }
  }
  if (!end) return []
  const path: Position[] = []
  let cursor: Position | null = end
  while (cursor) {
    path.unshift(cursor)
    cursor = parent.get(`${cursor.row},${cursor.col}`) ?? null
  }
  return path
}

export function isLegalWall(state: GameState, wall: Wall, player = state.currentPlayer): boolean {
  if (state.winner !== null || state.wallsRemaining[player] <= 0) return false
  if (!['horizontal', 'vertical'].includes(wall.orientation)) return false
  if (wall.row < 0 || wall.col < 0 || wall.row >= state.size - 1 || wall.col >= state.size - 1) return false
  if (wallConflicts(state, wall)) return false
  const trial = { ...state, walls: [...state.walls, wall] }
  return pathExists(trial, 0) && pathExists(trial, 1)
}

export function getLegalWalls(state: GameState, orientation?: Orientation): Wall[] {
  const walls: Wall[] = []
  if (state.wallsRemaining[state.currentPlayer] <= 0 || state.winner !== null) return walls
  const orientations: Orientation[] = orientation ? [orientation] : ['horizontal', 'vertical']
  for (const value of orientations) {
    for (let row = 0; row < state.size - 1; row += 1) {
      for (let col = 0; col < state.size - 1; col += 1) {
        const wall = { row, col, orientation: value }
        if (isLegalWall(state, wall)) walls.push(wall)
      }
    }
  }
  return walls
}

export function isLegalMove(state: GameState, move: Move): boolean {
  if (state.winner !== null) return false
  if (move.type === 'pawn') return getLegalPawnMoves(state).some((p) => samePosition(p, move.to))
  return isLegalWall(state, move.wall)
}

export function applyMove(state: GameState, move: Move): GameState {
  if (!isLegalMove(state, move)) throw new Error('Illegal move')
  const player = state.currentPlayer
  const nextPlayer: Player = player === 0 ? 1 : 0
  const next: GameState = {
    ...state,
    pawns: [{ ...state.pawns[0] }, { ...state.pawns[1] }],
    wallsRemaining: [...state.wallsRemaining],
    walls: [...state.walls],
    currentPlayer: nextPlayer,
    turn: state.turn + 1,
  }
  if (move.type === 'pawn') {
    next.pawns[player] = { ...move.to }
    const goal = player === 0 ? 0 : state.size - 1
    if (move.to.row === goal) next.winner = player
  } else {
    next.walls.push({ ...move.wall })
    next.wallsRemaining[player] -= 1
  }
  return next
}

export function getAllLegalMoves(state: GameState): Move[] {
  return [
    ...getLegalPawnMoves(state).map((to): Move => ({ type: 'pawn', to })),
    ...getLegalWalls(state).map((wall): Move => ({ type: 'wall', wall })),
  ]
}
