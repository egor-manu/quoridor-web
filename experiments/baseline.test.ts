import { describe, it } from 'vitest'
import { calculateMove } from '../src/ai/search'
import { applyMove, createGame } from '../src/game/engine'

describe('incumbent hard AI baseline', () => {
  it('records repeated responses from identical positions', () => {
    const opening = applyMove(createGame(9), { type: 'pawn', to: { row: 7, col: 4 } })
    const runs = Array.from({ length: 5 }, () => calculateMove(opening, 'hard'))
    console.log(JSON.stringify(runs))
  }, 10_000)
})
