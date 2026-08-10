import { describe, expect, it } from 'vitest'
import { getWallForSwipe } from './Board'
import type { Wall } from '../game/types'

const legalWalls: Wall[] = [
  { row: 2, col: 3, orientation: 'horizontal' },
  { row: 2, col: 3, orientation: 'vertical' },
]

describe('wall swipe gestures', () => {
  it('infers a horizontal wall from a horizontal swipe', () => {
    expect(getWallForSwipe(legalWalls, { x: 310, y: 300 }, { x: 490, y: 300 })).toEqual(legalWalls[0])
  })

  it('infers a vertical wall from a vertical swipe', () => {
    expect(getWallForSwipe(legalWalls, { x: 400, y: 220 }, { x: 400, y: 380 })).toEqual(legalWalls[1])
  })

  it('does not turn a tap or small finger wobble into a wall', () => {
    expect(getWallForSwipe(legalWalls, { x: 390, y: 300 }, { x: 405, y: 300 })).toBeNull()
  })

  it('cancels a swipe that travels too far', () => {
    expect(getWallForSwipe(legalWalls, { x: 250, y: 300 }, { x: 550, y: 300 })).toBeNull()
  })

  it('rejects a diagonal swipe and unavailable wall slots', () => {
    expect(getWallForSwipe(legalWalls, { x: 340, y: 240 }, { x: 460, y: 360 })).toBeNull()
    expect(getWallForSwipe([], { x: 310, y: 300 }, { x: 490, y: 300 })).toBeNull()
  })
})
