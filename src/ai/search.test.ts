import { describe, expect, it } from 'vitest'
import { calculateMove } from './search'
import { createGame, isLegalMove } from '../game/engine'
import type { GameState } from '../game/types'

describe('local AI', () => {
  it.each(['easy', 'medium', 'hard', 'adaptive'] as const)('returns a legal %s move', (difficulty) => {
    const state: GameState = { ...createGame(7), currentPlayer: 1 }
    const result = calculateMove(state, difficulty, 0.5)
    expect(result.move).not.toBeNull()
    expect(result.move && isLegalMove(state, result.move)).toBe(true)
  }, 4000)

  it('takes an immediate win', () => {
    const state: GameState = {
      ...createGame(7),
      pawns: [{ row: 5, col: 5 }, { row: 5, col: 3 }],
      currentPlayer: 1,
    }
    const result = calculateMove(state, 'easy')
    expect(result.move).toEqual({ type: 'pawn', to: { row: 6, col: 3 } })
  })
})
