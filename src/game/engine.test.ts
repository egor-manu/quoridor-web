import { describe, expect, it } from 'vitest'
import {
  applyMove,
  createGame,
  getLegalPawnMoves,
  isLegalMove,
  isLegalWall,
  pathExists,
  shortestPathLength,
} from './engine'
import type { GameState, Wall } from './types'

function withPositions(state: GameState, human: [number, number], opponent: [number, number]): GameState {
  return {
    ...state,
    pawns: [
      { row: human[0], col: human[1] },
      { row: opponent[0], col: opponent[1] },
    ],
  }
}

describe.each([7, 9, 11])('%i×%i game engine', (size) => {
  it('starts in the centre with the configured wall supply', () => {
    const state = createGame(size)
    expect(state.pawns[0]).toEqual({ row: size - 1, col: Math.floor(size / 2) })
    expect(state.pawns[1]).toEqual({ row: 0, col: Math.floor(size / 2) })
    expect(shortestPathLength(state, 0)).toBe(size - 1)
    expect(pathExists(state, 1)).toBe(true)
  })

  it('keeps normal movement inside the board', () => {
    const state = createGame(size)
    const moves = getLegalPawnMoves(state)
    expect(moves).toHaveLength(3)
    expect(moves.every((move) => move.row >= 0 && move.col >= 0 && move.row < size && move.col < size)).toBe(true)
  })

  it('recognises a win on the opposite edge', () => {
    const state = withPositions(createGame(size), [1, 2], [0, 4])
    const won = applyMove(state, { type: 'pawn', to: { row: 0, col: 2 } })
    expect(won.winner).toBe(0)
    expect(getLegalPawnMoves(won)).toEqual([])
  })

  it('accepts in-range walls and preserves both routes', () => {
    const state = createGame(size)
    const wall: Wall = { row: 1, col: 1, orientation: 'horizontal' }
    expect(isLegalWall(state, wall)).toBe(true)
    const next = applyMove(state, { type: 'wall', wall })
    expect(next.wallsRemaining[0]).toBe(state.wallsRemaining[0] - 1)
    expect(pathExists(next, 0)).toBe(true)
    expect(pathExists(next, 1)).toBe(true)
  })
})

describe('pawn jumps', () => {
  it('jumps straight over an adjacent opponent', () => {
    const state = withPositions(createGame(9), [4, 4], [3, 4])
    expect(getLegalPawnMoves(state)).toContainEqual({ row: 2, col: 4 })
    expect(getLegalPawnMoves(state)).not.toContainEqual({ row: 3, col: 4 })
  })

  it('allows both diagonals when the straight jump is blocked', () => {
    const state: GameState = {
      ...withPositions(createGame(9), [4, 4], [3, 4]),
      walls: [{ row: 2, col: 4, orientation: 'horizontal' }],
    }
    const moves = getLegalPawnMoves(state)
    expect(moves).toContainEqual({ row: 3, col: 3 })
    expect(moves).toContainEqual({ row: 3, col: 5 })
    expect(moves).not.toContainEqual({ row: 2, col: 4 })
  })

  it('uses diagonal movement at the board edge', () => {
    const state = withPositions(createGame(9), [1, 4], [0, 4])
    const moves = getLegalPawnMoves(state)
    expect(moves).toContainEqual({ row: 0, col: 3 })
    expect(moves).toContainEqual({ row: 0, col: 5 })
  })
})

describe('wall rules', () => {
  it('rejects edge overflow', () => {
    const state = createGame(9)
    expect(isLegalWall(state, { row: 8, col: 0, orientation: 'horizontal' })).toBe(false)
    expect(isLegalWall(state, { row: 0, col: -1, orientation: 'vertical' })).toBe(false)
  })

  it('rejects overlapping and crossing walls', () => {
    const state: GameState = { ...createGame(9), walls: [{ row: 3, col: 3, orientation: 'horizontal' }] }
    expect(isLegalWall(state, { row: 3, col: 3, orientation: 'horizontal' })).toBe(false)
    expect(isLegalWall(state, { row: 3, col: 4, orientation: 'horizontal' })).toBe(false)
    expect(isLegalWall(state, { row: 3, col: 3, orientation: 'vertical' })).toBe(false)
    expect(isLegalWall(state, { row: 4, col: 3, orientation: 'vertical' })).toBe(true)
  })

  it('blocks movement across both segments', () => {
    const state: GameState = {
      ...withPositions(createGame(9), [4, 4], [0, 4]),
      walls: [{ row: 3, col: 3, orientation: 'horizontal' }],
    }
    expect(getLegalPawnMoves(state)).not.toContainEqual({ row: 3, col: 4 })
    expect(getLegalPawnMoves(state)).toContainEqual({ row: 4, col: 3 })
  })

  it('never applies an illegal move', () => {
    const state = createGame(9)
    const illegal = { type: 'pawn' as const, to: { row: 0, col: 0 } }
    expect(isLegalMove(state, illegal)).toBe(false)
    expect(() => applyMove(state, illegal)).toThrow('Illegal move')
  })
})
