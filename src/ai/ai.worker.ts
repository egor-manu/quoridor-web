/// <reference lib="webworker" />
import { calculateMove, type Difficulty } from './search'
import type { GameState } from '../game/types'

interface Request {
  type: 'calculateMove'
  requestId: number
  state: GameState
  difficulty: Difficulty
  adaptiveStrength: number
}

self.onmessage = (event: MessageEvent<Request>) => {
  const request = event.data
  if (request.type !== 'calculateMove') return
  const result = calculateMove(request.state, request.difficulty, request.adaptiveStrength)
  self.postMessage({ type: 'move', requestId: request.requestId, ...result })
}

export {}
