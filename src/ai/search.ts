import { applyMove, getLegalPawnMoves, getShortestPath, isLegalWall, shortestPathLength } from '../game/engine'
import type { AiResult, GameState, Move, Player, Wall } from '../game/types'

export type Difficulty = 'easy' | 'medium' | 'hard' | 'adaptive'

interface SearchOptions {
  budget: number
  maxDepth: number
  wallCandidates: number
  mistakeChance: number
  noise: number
}

const PRESETS: Record<Exclude<Difficulty, 'adaptive'>, SearchOptions> = {
  easy: { budget: 90, maxDepth: 1, wallCandidates: 5, mistakeChance: 0.5, noise: 42 },
  medium: { budget: 320, maxDepth: 2, wallCandidates: 9, mistakeChance: 0.1, noise: 8 },
  hard: { budget: 900, maxDepth: 4, wallCandidates: 16, mistakeChance: 0, noise: 0 },
}

function optionsFor(difficulty: Difficulty, strength: number): SearchOptions {
  if (difficulty !== 'adaptive') return PRESETS[difficulty]
  const value = Math.max(0, Math.min(1, strength))
  return {
    budget: Math.round(90 + value * 710),
    maxDepth: value > 0.78 ? 4 : value > 0.34 ? 2 : 1,
    wallCandidates: Math.round(5 + value * 10),
    mistakeChance: 0.5 * (1 - value),
    noise: 38 * (1 - value),
  }
}

function addWall(pool: Map<string, Wall>, state: GameState, wall: Wall): void {
  if (wall.row < 0 || wall.col < 0 || wall.row >= state.size - 1 || wall.col >= state.size - 1) return
  pool.set(`${wall.orientation}:${wall.row}:${wall.col}`, wall)
}

function wallPool(state: GameState): Wall[] {
  const pool = new Map<string, Wall>()
  for (const player of [0, 1] as Player[]) {
    const path = getShortestPath(state, player)
    for (let index = 0; index < path.length - 1; index += 1) {
      const a = path[index]
      const b = path[index + 1]
      if (a.row !== b.row) {
        const row = Math.min(a.row, b.row)
        addWall(pool, state, { row, col: a.col, orientation: 'horizontal' })
        addWall(pool, state, { row, col: a.col - 1, orientation: 'horizontal' })
      } else {
        const col = Math.min(a.col, b.col)
        addWall(pool, state, { row: a.row, col, orientation: 'vertical' })
        addWall(pool, state, { row: a.row - 1, col, orientation: 'vertical' })
      }
    }
    const pawn = state.pawns[player]
    for (let row = pawn.row - 2; row <= pawn.row + 1; row += 1) {
      for (let col = pawn.col - 2; col <= pawn.col + 1; col += 1) {
        addWall(pool, state, { row, col, orientation: 'horizontal' })
        addWall(pool, state, { row, col, orientation: 'vertical' })
      }
    }
  }
  return [...pool.values()].filter((wall) => isLegalWall(state, wall))
}

function candidateMoves(state: GameState, limit: number): Move[] {
  const pawnMoves: Move[] = getLegalPawnMoves(state).map((to) => ({ type: 'pawn', to }))
  if (state.wallsRemaining[state.currentPlayer] === 0) return pawnMoves
  const player = state.currentPlayer
  const opponent: Player = player === 0 ? 1 : 0
  const ownBefore = shortestPathLength(state, player)
  const opponentBefore = shortestPathLength(state, opponent)
  const ranked = wallPool(state).map((wall) => {
    const trial: GameState = { ...state, walls: [...state.walls, wall] }
    const opponentDelay = shortestPathLength(trial, opponent) - opponentBefore
    const ownDelay = shortestPathLength(trial, player) - ownBefore
    const pawn = state.pawns[opponent]
    const proximity = state.size - Math.abs(wall.row + 0.5 - pawn.row) - Math.abs(wall.col + 0.5 - pawn.col)
    return { wall, score: opponentDelay * 40 - ownDelay * 28 + proximity }
  })
  ranked.sort((a, b) => b.score - a.score)
  return [...pawnMoves, ...ranked.slice(0, limit).map(({ wall }): Move => ({ type: 'wall', wall }))]
}

function evaluate(state: GameState, ai: Player): number {
  if (state.winner === ai) return 100_000 - state.turn
  if (state.winner !== null) return -100_000 + state.turn
  const opponent: Player = ai === 0 ? 1 : 0
  const ownPath = shortestPathLength(state, ai)
  const opponentPath = shortestPathLength(state, opponent)
  const wallBalance = state.wallsRemaining[ai] - state.wallsRemaining[opponent]
  return opponentPath * 108 - ownPath * 116 + wallBalance * 5
}

function hashState(state: GameState, depth: number): string {
  const walls = state.walls.map((w) => `${w.orientation[0]}${w.row},${w.col}`).sort().join(';')
  return `${depth}|${state.currentPlayer}|${state.pawns[0].row},${state.pawns[0].col}|${state.pawns[1].row},${state.pawns[1].col}|${state.wallsRemaining.join(',')}|${walls}`
}

export function calculateMove(
  state: GameState,
  difficulty: Difficulty,
  adaptiveStrength = 0.45,
): AiResult {
  const started = performance.now()
  const options = optionsFor(difficulty, adaptiveStrength)
  const deadline = started + options.budget
  const ai = state.currentPlayer
  let nodes = 0
  let completedDepth = 0
  let ranking: Array<{ move: Move; score: number }> = []
  const table = new Map<string, number>()

  const search = (position: GameState, depth: number, alpha: number, beta: number): number => {
    nodes += 1
    if ((nodes & 31) === 0 && performance.now() >= deadline) throw new Error('timeout')
    if (depth === 0 || position.winner !== null) return evaluate(position, ai)
    const key = hashState(position, depth)
    const cached = table.get(key)
    if (cached !== undefined) return cached
    const maximizing = position.currentPlayer === ai
    let best = maximizing ? -Infinity : Infinity
    const moves = candidateMoves(position, Math.max(3, options.wallCandidates - (options.maxDepth - depth) * 3))
    for (const move of moves) {
      const value = search(applyMove(position, move), depth - 1, alpha, beta)
      if (maximizing) {
        best = Math.max(best, value)
        alpha = Math.max(alpha, best)
      } else {
        best = Math.min(best, value)
        beta = Math.min(beta, best)
      }
      if (beta <= alpha) break
    }
    table.set(key, best)
    return best
  }

  for (let depth = 1; depth <= options.maxDepth; depth += 1) {
    try {
      const nextRanking = candidateMoves(state, options.wallCandidates).map((move) => ({
        move,
        score: search(applyMove(state, move), depth - 1, -Infinity, Infinity),
      }))
      nextRanking.sort((a, b) => b.score - a.score)
      ranking = nextRanking
      completedDepth = depth
      if (performance.now() >= deadline) break
    } catch {
      break
    }
  }

  if (!ranking.length) {
    ranking = candidateMoves(state, options.wallCandidates).map((move) => ({ move, score: 0 }))
  }
  let chosen = 0
  const seed = (state.turn * 17 + state.walls.length * 31 + state.pawns[0].col * 7) % 100
  const hasForcedWin = ranking[0]?.score > 99_000
  if (!hasForcedWin && ranking.length > 1 && seed / 100 < options.mistakeChance) {
    chosen = 1 + (seed % Math.min(4, ranking.length - 1))
  } else if (options.noise > 0) {
    ranking = ranking
      .map((item, index) => ({ ...item, score: item.score + (((seed + index * 37) % 21) - 10) * options.noise / 10 }))
      .sort((a, b) => b.score - a.score)
  }
  return {
    move: ranking[chosen]?.move ?? null,
    depth: completedDepth,
    nodes,
    elapsed: Math.round(performance.now() - started),
  }
}
