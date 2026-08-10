import { useEffect, useMemo, useRef, useState } from 'react'
import { getLegalPawnMoves, getLegalWalls } from '../game/engine'
import type { GameState, Orientation, Position, Wall } from '../game/types'

interface Props {
  state: GameState
  disabled: boolean
  onPawnMove: (position: Position) => void
  onWallMove: (wall: Wall) => void
}

interface Point {
  x: number
  y: number
}

const PITCH = 100
const CELL = 82
const INSET = 9
const TAP_DISTANCE = PITCH * .2
const MIN_WALL_SWIPE = PITCH * .3
const MAX_WALL_SWIPE = PITCH * 2.35
const WALL_SNAP_DISTANCE = PITCH * .78

function distanceBetween(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

export function getWallForSwipe(legalWalls: Wall[], start: Point, end: Point): Wall | null {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const distance = Math.hypot(dx, dy)
  if (distance < MIN_WALL_SWIPE || distance > MAX_WALL_SWIPE) return null

  const major = Math.max(Math.abs(dx), Math.abs(dy))
  const minor = Math.min(Math.abs(dx), Math.abs(dy))
  if (major < minor * 1.4) return null

  const orientation: Orientation = Math.abs(dx) >= Math.abs(dy) ? 'horizontal' : 'vertical'
  const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
  let nearest: Wall | null = null
  let nearestDistance = Infinity
  for (const wall of legalWalls) {
    if (wall.orientation !== orientation) continue
    const wallX = (wall.col + 1) * PITCH
    const wallY = (wall.row + 1) * PITCH
    const distanceToWall = Math.hypot(wallX - midpoint.x, wallY - midpoint.y)
    if (distanceToWall < nearestDistance) {
      nearest = wall
      nearestDistance = distanceToWall
    }
  }
  return nearestDistance <= WALL_SNAP_DISTANCE ? nearest : null
}

export function Board({ state, disabled, onPawnMove, onWallMove }: Props) {
  const dimension = state.size * PITCH
  const [swipeWall, setSwipeWall] = useState<Wall | null>(null)
  const activePointer = useRef<number | null>(null)
  const gestureStart = useRef<Point | null>(null)
  const gestureCancelled = useRef(false)
  const legalPawnMoves = useMemo(
    () => (!disabled ? getLegalPawnMoves(state) : []),
    [disabled, state],
  )
  const legalWalls = useMemo(
    () => (!disabled ? getLegalWalls(state) : []),
    [disabled, state],
  )

  useEffect(() => {
    setSwipeWall(null)
    activePointer.current = null
    gestureStart.current = null
    gestureCancelled.current = false
  }, [disabled, state])

  const pointFromPointer = (event: React.PointerEvent<SVGSVGElement>): { point: Point; inside: boolean } => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const point = {
      x: (event.clientX - bounds.left) * dimension / bounds.width,
      y: (event.clientY - bounds.top) * dimension / bounds.height,
    }
    return { point, inside: point.x >= 0 && point.y >= 0 && point.x <= dimension && point.y <= dimension }
  }

  const finishGesture = (event: React.PointerEvent<SVGSVGElement>, cancelled: boolean) => {
    if (activePointer.current !== event.pointerId) return
    const start = gestureStart.current
    const { point, inside } = pointFromPointer(event)
    const distance = start ? distanceBetween(start, point) : Infinity
    const shouldCancel = cancelled || gestureCancelled.current || !inside
    const pawnMove = !shouldCancel && start && distance <= TAP_DISTANCE
      ? legalPawnMoves.find((move) => Math.hypot(move.col * PITCH + 50 - point.x, move.row * PITCH + 50 - point.y) <= CELL / 2) ?? null
      : null
    const wall = !shouldCancel && start && !pawnMove ? getWallForSwipe(legalWalls, start, point) : null

    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    activePointer.current = null
    gestureStart.current = null
    gestureCancelled.current = false
    setSwipeWall(null)
    if (pawnMove) onPawnMove(pawnMove)
    else if (wall) onWallMove(wall)
  }

  return (
    <div className="board-frame">
      <svg
        className={`board ${disabled ? '' : 'board-interactive'}`}
        viewBox={`0 0 ${dimension} ${dimension}`}
        role="group"
        aria-label={`${state.size} by ${state.size} Quoridor board. Tap a highlighted square to move, or swipe along a wall slot to place a wall.`}
        onPointerDown={(event) => {
          if (disabled || activePointer.current !== null || (event.pointerType === 'mouse' && event.button !== 0)) return
          event.preventDefault()
          const { point, inside } = pointFromPointer(event)
          if (!inside) return
          activePointer.current = event.pointerId
          gestureStart.current = point
          gestureCancelled.current = false
          setSwipeWall(null)
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          if (activePointer.current !== event.pointerId) return
          event.preventDefault()
          const start = gestureStart.current
          const { point, inside } = pointFromPointer(event)
          if (!start || !inside || distanceBetween(start, point) > MAX_WALL_SWIPE) {
            gestureCancelled.current = true
            setSwipeWall(null)
            return
          }
          if (!gestureCancelled.current) setSwipeWall(getWallForSwipe(legalWalls, start, point))
        }}
        onPointerUp={(event) => finishGesture(event, false)}
        onPointerCancel={(event) => finishGesture(event, true)}
      >
        <defs>
          <filter id="pawn-shadow" x="-30%" y="-30%" width="160%" height="180%">
            <feDropShadow dx="0" dy="5" stdDeviation="4" floodOpacity=".28" />
          </filter>
        </defs>
        <rect width={dimension} height={dimension} rx="20" className="board-bed" />
        {Array.from({ length: state.size }, (_, row) =>
          Array.from({ length: state.size }, (_, col) => (
            <rect
              key={`${row}-${col}`}
              x={col * PITCH + INSET}
              y={row * PITCH + INSET}
              width={CELL}
              height={CELL}
              rx="11"
              className={(row + col) % 2 ? 'board-cell board-cell-alt' : 'board-cell'}
            />
          )),
        )}

        {legalPawnMoves.map((position) => (
          <g
            key={`move-${position.row}-${position.col}`}
            className="move-target"
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              onPawnMove(position)
            }}
            aria-label={`Move to row ${position.row + 1}, column ${position.col + 1}`}
          >
            <circle cx={position.col * PITCH + 50} cy={position.row * PITCH + 50} r="34" className="move-hit" />
            <circle cx={position.col * PITCH + 50} cy={position.row * PITCH + 50} r="13" className="move-dot" />
          </g>
        ))}

        {state.walls.map((wall, index) => (
          <rect
            key={`wall-${index}`}
            x={wall.orientation === 'horizontal' ? wall.col * PITCH + INSET : (wall.col + 1) * PITCH - 7}
            y={wall.orientation === 'horizontal' ? (wall.row + 1) * PITCH - 7 : wall.row * PITCH + INSET}
            width={wall.orientation === 'horizontal' ? PITCH * 2 - INSET * 2 : 14}
            height={wall.orientation === 'horizontal' ? 14 : PITCH * 2 - INSET * 2}
            rx="7"
            className="placed-wall"
          />
        ))}

        {swipeWall && (
          <rect
            x={swipeWall.orientation === 'horizontal' ? swipeWall.col * PITCH + INSET : (swipeWall.col + 1) * PITCH - 7}
            y={swipeWall.orientation === 'horizontal' ? (swipeWall.row + 1) * PITCH - 7 : swipeWall.row * PITCH + INSET}
            width={swipeWall.orientation === 'horizontal' ? PITCH * 2 - INSET * 2 : 14}
            height={swipeWall.orientation === 'horizontal' ? 14 : PITCH * 2 - INSET * 2}
            rx="7"
            className="wall-preview wall-preview-swipe"
            pointerEvents="none"
          />
        )}

        {state.pawns.map((pawn, player) => {
          const active = state.currentPlayer === player && state.winner === null
          return (
            <g
              key={`pawn-${player}`}
              className={`pawn pawn-${player} ${active ? 'pawn-active' : ''}`}
              transform={`translate(${pawn.col * PITCH + 50} ${pawn.row * PITCH + 50})`}
              filter="url(#pawn-shadow)"
              aria-label={player === 0 ? 'Your pawn' : 'Opponent pawn'}
            >
              {player === 0 ? (
                <>
                  <circle cy="-13" r="19" />
                  <path d="M -28 32 Q -23 -4 0 -5 Q 23 -4 28 32 Z" />
                  <circle cy="-13" r="7" className="pawn-mark" />
                </>
              ) : (
                <>
                  <rect x="-18" y="-31" width="36" height="36" rx="12" />
                  <path d="M -29 32 Q -26 -1 0 -4 Q 26 -1 29 32 Z" />
                  <path d="M -7 -13 L 0 -20 L 7 -13 L 0 -6 Z" className="pawn-mark" />
                </>
              )}
            </g>
          )
        })}

        {state.winner !== null && (
          <circle
            cx={state.pawns[state.winner].col * PITCH + 50}
            cy={state.pawns[state.winner].row * PITCH + 50}
            r="43"
            className="winner-ring"
          />
        )}
      </svg>
    </div>
  )
}
