import { useMemo } from 'react'
import { getLegalPawnMoves, getLegalWalls, samePosition } from '../game/engine'
import type { GameState, Orientation, Position, Wall } from '../game/types'

interface Props {
  state: GameState
  wallMode: boolean
  orientation: Orientation
  disabled: boolean
  onPawnMove: (position: Position) => void
  onWallMove: (wall: Wall) => void
}

const PITCH = 100
const CELL = 82
const INSET = 9

export function Board({ state, wallMode, orientation, disabled, onPawnMove, onWallMove }: Props) {
  const dimension = state.size * PITCH
  const legalPawnMoves = useMemo(
    () => (!disabled && !wallMode ? getLegalPawnMoves(state) : []),
    [disabled, state, wallMode],
  )
  const legalWalls = useMemo(
    () => (!disabled && wallMode ? getLegalWalls(state, orientation) : []),
    [disabled, orientation, state, wallMode],
  )

  return (
    <div className="board-frame">
      <svg
        className="board"
        viewBox={`0 0 ${dimension} ${dimension}`}
        role="group"
        aria-label={`${state.size} by ${state.size} Quoridor board`}
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

        {wallMode && legalWalls.map((wall) => (
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
