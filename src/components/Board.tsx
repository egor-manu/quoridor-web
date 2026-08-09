import { useEffect, useMemo, useRef, useState } from 'react'
import { getLegalPawnMoves, getLegalWalls, samePosition } from '../game/engine'
import type { GameState, Orientation, Position, Wall } from '../game/types'

interface Props {
  state: GameState
  wallMode: boolean
  orientation: Orientation
  dragWalls: boolean
  disabled: boolean
  onPawnMove: (position: Position) => void
  onWallMove: (wall: Wall) => void
}

const PITCH = 100
const CELL = 82
const INSET = 9

export function Board({ state, wallMode, orientation, dragWalls, disabled, onPawnMove, onWallMove }: Props) {
  const dimension = state.size * PITCH
  const [dragWall, setDragWall] = useState<Wall | null>(null)
  const activePointer = useRef<number | null>(null)
  const dragStart = useRef<{ x: number; y: number } | null>(null)
  const legalPawnMoves = useMemo(
    () => (!disabled && !wallMode ? getLegalPawnMoves(state) : []),
    [disabled, state, wallMode],
  )
  const legalWalls = useMemo(
    () => (!disabled && wallMode ? getLegalWalls(state, dragWalls ? undefined : orientation) : []),
    [disabled, dragWalls, orientation, state, wallMode],
  )

  useEffect(() => {
    setDragWall(null)
    activePointer.current = null
    dragStart.current = null
  }, [disabled, dragWalls, state, wallMode])

  const wallFromPointer = (event: React.PointerEvent<SVGSVGElement>): Wall | null => {
    const start = dragStart.current
    if (!start) return null
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.hypot(dx, dy) < 8) return null

    const bounds = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - bounds.left) * dimension / bounds.width
    const y = (event.clientY - bounds.top) * dimension / bounds.height
    if (x < 0 || y < 0 || x > dimension || y > dimension) return null

    const inferredOrientation: Orientation = Math.abs(dx) >= Math.abs(dy) ? 'horizontal' : 'vertical'
    let nearest: Wall | null = null
    let nearestDistance = Infinity
    for (const wall of legalWalls) {
      if (wall.orientation !== inferredOrientation) continue
      const wallX = (wall.col + 1) * PITCH
      const wallY = (wall.row + 1) * PITCH
      const distance = (wallX - x) ** 2 + (wallY - y) ** 2
      if (distance < nearestDistance) {
        nearest = wall
        nearestDistance = distance
      }
    }
    return nearestDistance <= (PITCH * .78) ** 2 ? nearest : null
  }

  const finishDrag = (event: React.PointerEvent<SVGSVGElement>, place: boolean) => {
    if (activePointer.current !== event.pointerId) return
    const selected = place ? wallFromPointer(event) : null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    activePointer.current = null
    dragStart.current = null
    setDragWall(null)
    if (selected) onWallMove(selected)
  }

  return (
    <div className="board-frame">
      <svg
        className={`board ${wallMode && dragWalls ? 'wall-dragging' : ''}`}
        viewBox={`0 0 ${dimension} ${dimension}`}
        role="group"
        aria-label={`${state.size} by ${state.size} Quoridor board`}
        onPointerDown={(event) => {
          if (disabled || !wallMode || !dragWalls || (event.pointerType === 'mouse' && event.button !== 0)) return
          event.preventDefault()
          activePointer.current = event.pointerId
          dragStart.current = { x: event.clientX, y: event.clientY }
          setDragWall(null)
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          if (activePointer.current !== event.pointerId) return
          event.preventDefault()
          setDragWall(wallFromPointer(event))
        }}
        onPointerUp={(event) => finishDrag(event, true)}
        onPointerCancel={(event) => finishDrag(event, false)}
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
            onClick={() => onPawnMove(position)}
            role="button"
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

        {wallMode && !dragWalls && legalWalls.map((wall) => (
          <g
            key={`slot-${wall.orientation}-${wall.row}-${wall.col}`}
            className="wall-target"
            onClick={() => onWallMove(wall)}
            role="button"
            aria-label={`Place ${wall.orientation} wall at row ${wall.row + 1}, column ${wall.col + 1}`}
          >
            <rect
              x={wall.orientation === 'horizontal' ? wall.col * PITCH + 2 : (wall.col + 1) * PITCH - 19}
              y={wall.orientation === 'horizontal' ? (wall.row + 1) * PITCH - 19 : wall.row * PITCH + 2}
              width={wall.orientation === 'horizontal' ? PITCH * 2 - 4 : 38}
              height={wall.orientation === 'horizontal' ? 38 : PITCH * 2 - 4}
              rx="13"
              className="wall-hit"
            />
            <rect
              x={wall.orientation === 'horizontal' ? wall.col * PITCH + INSET : (wall.col + 1) * PITCH - 7}
              y={wall.orientation === 'horizontal' ? (wall.row + 1) * PITCH - 7 : wall.row * PITCH + INSET}
              width={wall.orientation === 'horizontal' ? PITCH * 2 - INSET * 2 : 14}
              height={wall.orientation === 'horizontal' ? 14 : PITCH * 2 - INSET * 2}
              rx="7"
              className="wall-preview"
            />
          </g>
        ))}

        {wallMode && dragWalls && dragWall && (
          <rect
            x={dragWall.orientation === 'horizontal' ? dragWall.col * PITCH + INSET : (dragWall.col + 1) * PITCH - 7}
            y={dragWall.orientation === 'horizontal' ? (dragWall.row + 1) * PITCH - 7 : dragWall.row * PITCH + INSET}
            width={dragWall.orientation === 'horizontal' ? PITCH * 2 - INSET * 2 : 14}
            height={dragWall.orientation === 'horizontal' ? 14 : PITCH * 2 - INSET * 2}
            rx="7"
            className="wall-preview wall-preview-drag"
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

export function isWallInList(wall: Wall, walls: Wall[]): boolean {
  return walls.some((item) => item.orientation === wall.orientation && samePosition(item, wall))
}
