import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Board } from './components/Board'
import { applyMove, createGame, isLegalMove, shortestPathLength } from './game/engine'
import type { AiResult, GameState, Orientation, Position, Wall } from './game/types'
import type { Difficulty } from './ai/search'

interface Preferences {
  size: 7 | 9 | 11
  difficulty: Difficulty
  sound: boolean
  showPathLengths: boolean
  manualBoth: boolean
  dragWalls: boolean
  adaptiveRating: number
  games: number
  wins: number
  losses: number
}

const STORAGE_KEY = 'quoridor-preferences-v1'
const DEFAULTS: Preferences = {
  size: 9,
  difficulty: 'medium',
  sound: true,
  showPathLengths: false,
  manualBoth: false,
  dragWalls: false,
  adaptiveRating: 1000,
  games: 0,
  wins: 0,
  losses: 0,
}

function loadPreferences(): Preferences {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Preferences>
    return { ...DEFAULTS, ...saved }
  } catch {
    return DEFAULTS
  }
}

function strengthFromRating(rating: number): number {
  return Math.max(0.08, Math.min(0.95, (rating - 700) / 700))
}

function playTone(kind: 'move' | 'wall' | 'win' | 'undo', enabled: boolean) {
  if (!enabled) return
  const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return
  const context = new AudioContextClass()
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = kind === 'wall' ? 'triangle' : 'sine'
  oscillator.frequency.value = kind === 'win' ? 660 : kind === 'wall' ? 190 : kind === 'undo' ? 270 : 360
  gain.gain.setValueAtTime(0.0001, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + (kind === 'win' ? 0.28 : 0.1))
  oscillator.connect(gain).connect(context.destination)
  oscillator.start()
  oscillator.stop(context.currentTime + (kind === 'win' ? 0.3 : 0.12))
  oscillator.onended = () => void context.close()
}

export default function App() {
  const [preferences, setPreferences] = useState(loadPreferences)
  const [state, setState] = useState<GameState>(() => createGame(preferences.size))
  const [history, setHistory] = useState<GameState[]>([])
  const [wallMode, setWallMode] = useState(false)
  const [orientation, setOrientation] = useState<Orientation>('horizontal')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [diagnostics, setDiagnostics] = useState<Omit<AiResult, 'move'> | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const requestRef = useRef(0)
  const stateRef = useRef(state)
  const scoredGameRef = useRef<number | null>(null)
  const preScorePreferencesRef = useRef<Preferences | null>(null)
  const manualSetupRef = useRef(preferences.manualBoth)
  const debug = useMemo(() => new URLSearchParams(location.search).get('debug') === '1', [])

  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)) }, [preferences])

  useEffect(() => {
    const worker = new Worker(new URL('./ai/ai.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker
    worker.onmessage = (event: MessageEvent<{ type: string; requestId: number } & AiResult>) => {
      if (event.data.type !== 'move' || event.data.requestId !== requestRef.current) return
      const current = stateRef.current
      setThinking(false)
      setDiagnostics({ depth: event.data.depth, nodes: event.data.nodes, elapsed: event.data.elapsed })
      if (preferences.manualBoth || current.currentPlayer !== 1 || current.winner !== null || !event.data.move || !isLegalMove(current, event.data.move)) return
      playTone(event.data.move.type === 'wall' ? 'wall' : 'move', preferences.sound)
      setState(applyMove(current, event.data.move))
    }
    return () => {
      requestRef.current += 1
      worker.terminate()
    }
  }, [preferences.manualBoth, preferences.sound])

  useEffect(() => {
    if (preferences.manualBoth || state.currentPlayer !== 1 || state.winner !== null) return
    const requestId = ++requestRef.current
    setThinking(true)
    const timer = window.setTimeout(() => {
      workerRef.current?.postMessage({
        type: 'calculateMove',
        requestId,
        state,
        difficulty: preferences.difficulty,
        adaptiveStrength: strengthFromRating(preferences.adaptiveRating),
      })
    }, 220)
    return () => window.clearTimeout(timer)
  }, [preferences.adaptiveRating, preferences.difficulty, preferences.manualBoth, state])

  useEffect(() => {
    if (state.winner === null || scoredGameRef.current === state.turn) return
    scoredGameRef.current = state.turn
    preScorePreferencesRef.current = preferences
    playTone('win', preferences.sound)
    if (manualSetupRef.current) return
    setPreferences((current) => {
      const won = state.winner === 0
      const expected = 1 / (1 + 10 ** ((1050 - current.adaptiveRating) / 400))
      const adjusted = current.adaptiveRating + 20 * ((won ? 1 : 0) - expected)
      return {
        ...current,
        adaptiveRating: Math.round(Math.max(700, Math.min(1400, adjusted))),
        games: current.games + 1,
        wins: current.wins + (won ? 1 : 0),
        losses: current.losses + (won ? 0 : 1),
      }
    })
  }, [preferences.sound, state.turn, state.winner])

  const cancelThinking = useCallback(() => {
    requestRef.current += 1
    setThinking(false)
  }, [])

  const newGame = useCallback((size = preferences.size) => {
    cancelThinking()
    scoredGameRef.current = null
    preScorePreferencesRef.current = null
    manualSetupRef.current = preferences.manualBoth
    setState(createGame(size))
    setHistory([])
    setWallMode(false)
    setSettingsOpen(false)
  }, [cancelThinking, preferences.manualBoth, preferences.size])

  const humanMove = useCallback((move: { type: 'pawn'; to: Position } | { type: 'wall'; wall: Wall }) => {
    if (thinking || (!preferences.manualBoth && state.currentPlayer !== 0) || state.winner !== null || !isLegalMove(state, move)) return
    setHistory((items) => [...items, state])
    setState(applyMove(state, move))
    setWallMode(false)
    playTone(move.type === 'wall' ? 'wall' : 'move', preferences.sound)
  }, [preferences.manualBoth, preferences.sound, state, thinking])

  const undo = useCallback(() => {
    const previous = history.at(-1)
    if (!previous) return
    cancelThinking()
    if (state.winner !== null && scoredGameRef.current === state.turn && preScorePreferencesRef.current) {
      setPreferences(preScorePreferencesRef.current)
      preScorePreferencesRef.current = null
    }
    scoredGameRef.current = null
    setState(previous)
    setHistory((items) => items.slice(0, -1))
    setWallMode(false)
    playTone('undo', preferences.sound)
  }, [cancelThinking, history, preferences.sound, state.turn, state.winner])

  const updateSize = (size: Preferences['size']) => {
    if (size === preferences.size) return
    if (state.turn > 0 && state.winner === null && !window.confirm('Start a new game with this board size?')) return
    setPreferences((current) => ({ ...current, size }))
    newGame(size)
  }

  const updateDifficulty = (difficulty: Difficulty) => {
    if (difficulty === preferences.difficulty) return
    if (state.turn > 0 && state.winner === null && !window.confirm('Start a new game with this opponent?')) return
    setPreferences((current) => ({ ...current, difficulty }))
    newGame(preferences.size)
  }

  const resetProgress = () => {
    if (!window.confirm('Reset adaptive progress and game totals?')) return
    setPreferences((current) => ({ ...current, adaptiveRating: DEFAULTS.adaptiveRating, games: 0, wins: 0, losses: 0 }))
  }

  const updateManualBoth = () => {
    if (!preferences.manualBoth) {
      cancelThinking()
      manualSetupRef.current = true
    }
    setWallMode(false)
    setPreferences((current) => ({ ...current, manualBoth: !current.manualBoth }))
  }

  const manualTurn = (preferences.manualBoth || state.currentPlayer === 0) && state.winner === null && !thinking
  const controlledPlayer = preferences.manualBoth ? state.currentPlayer : 0
  const canPlaceWall = manualTurn && state.wallsRemaining[controlledPlayer] > 0
  const pathLengths = useMemo(
    () => [shortestPathLength(state, 0), shortestPathLength(state, 1)] as const,
    [state],
  )

  return (
    <main className="game-shell">
      <header className="topbar">
        <div className={`turn-orb turn-orb-${state.currentPlayer} ${thinking ? 'thinking' : ''}`} aria-live="polite">
          <span className="turn-orb-core" />
          <span className="thinking-dots"><i /><i /><i /></span>
        </div>
        <div className="brand" aria-label="Quoridor">
          <span className="brand-wall" /><span className="brand-word">QUORIDOR</span>
        </div>
        <nav className="controls" aria-label="Game controls">
          <button className="icon-button" onClick={undo} disabled={!history.length} aria-label="Undo last turn" title="Undo">↶</button>
          <button className="icon-button" onClick={() => newGame()} aria-label="New game" title="New game">↻</button>
          <button className="icon-button gear" onClick={() => setSettingsOpen(true)} aria-label="Settings" title="Settings">⚙</button>
        </nav>
      </header>

      <section className="play-area">
        <WallSupply
          player={1}
          remaining={state.wallsRemaining[1]}
          pathLength={preferences.showPathLengths ? pathLengths[1] : undefined}
        />
        <Board
          state={state}
          wallMode={wallMode}
          orientation={orientation}
          dragWalls={preferences.dragWalls}
          disabled={!manualTurn}
          onPawnMove={(to) => humanMove({ type: 'pawn', to })}
          onWallMove={(wall) => humanMove({ type: 'wall', wall })}
        />
        <div className="human-tools">
          {preferences.showPathLengths && <PathBadge player={0} length={pathLengths[0]} />}
          <WallButtons
            remaining={state.wallsRemaining[controlledPlayer]}
            orientation={orientation}
            wallMode={wallMode}
            dragMode={preferences.dragWalls}
            disabled={!canPlaceWall}
            onSelect={(nextOrientation) => {
              if (wallMode && orientation === nextOrientation) {
                setWallMode(false)
                return
              }
              setOrientation(nextOrientation)
              setWallMode(true)
            }}
          />
        </div>
      </section>

      {state.winner !== null && (
        <div className={`result-card result-${state.winner}`} role="dialog" aria-label={preferences.manualBoth ? `Player ${state.winner + 1} won` : state.winner === 0 ? 'You won!' : 'Opponent won'}>
          <div className="confetti" aria-hidden="true"><i /><i /><i /><i /><i /></div>
          <div className={`result-pawn result-pawn-${state.winner}`}><span /></div>
          <p>{preferences.manualBoth ? `Player ${state.winner + 1} wins!` : state.winner === 0 ? 'Brilliant!' : 'Good game!'}</p>
          <button onClick={() => newGame()}><span>↻</span> Play again</button>
        </div>
      )}

      {settingsOpen && (
        <div className="modal-backdrop" onMouseDown={() => setSettingsOpen(false)}>
          <section className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="settings-heading">
              <div><span className="eyebrow">For grown-ups</span><h2 id="settings-title">Game settings</h2></div>
              <button className="close-button" onClick={() => setSettingsOpen(false)} aria-label="Close settings">×</button>
            </div>
            <SettingGroup label="Board size">
              {([7, 9, 11] as const).map((size) => (
                <button key={size} className={preferences.size === size ? 'choice active' : 'choice'} onClick={() => updateSize(size)}>{size} × {size}</button>
              ))}
            </SettingGroup>
            <SettingGroup label="Opponent">
              {(['easy', 'medium', 'hard', 'adaptive'] as Difficulty[]).map((difficulty) => (
                <button key={difficulty} className={preferences.difficulty === difficulty ? 'choice active' : 'choice'} onClick={() => updateDifficulty(difficulty)}>{difficulty}</button>
              ))}
            </SettingGroup>
            <div className="setting-row">
              <div><strong>Control both</strong><small>Move both players to set up a position</small></div>
              <button
                className={preferences.manualBoth ? 'switch on' : 'switch'}
                onClick={updateManualBoth}
                role="switch"
                aria-checked={preferences.manualBoth}
              ><span /></button>
            </div>
            <div className="setting-row">
              <div><strong>Path lengths</strong><small>Show both players’ shortest routes</small></div>
              <button
                className={preferences.showPathLengths ? 'switch on' : 'switch'}
                onClick={() => setPreferences((current) => ({ ...current, showPathLengths: !current.showPathLengths }))}
                role="switch"
                aria-checked={preferences.showPathLengths}
              ><span /></button>
            </div>
            <div className="setting-row">
              <div><strong>Drag walls</strong><small>Slide to aim, then release to place</small></div>
              <button
                className={preferences.dragWalls ? 'switch on' : 'switch'}
                onClick={() => {
                  setWallMode(false)
                  setPreferences((current) => ({ ...current, dragWalls: !current.dragWalls }))
                }}
                role="switch"
                aria-checked={preferences.dragWalls}
              ><span /></button>
            </div>
            <div className="setting-row">
              <div><strong>Sound</strong><small>Moves and celebrations</small></div>
              <button
                className={preferences.sound ? 'switch on' : 'switch'}
                onClick={() => setPreferences((current) => ({ ...current, sound: !current.sound }))}
                role="switch"
                aria-checked={preferences.sound}
              ><span /></button>
            </div>
            <div className="progress-row">
              <div><strong>Adaptive progress</strong><small>{preferences.games} games · {preferences.wins} wins</small></div>
              <button className="text-button" onClick={resetProgress}>Reset</button>
            </div>
          </section>
        </div>
      )}

      {debug && diagnostics && (
        <aside className="debug-panel">depth {diagnostics.depth} · {diagnostics.nodes} nodes · {diagnostics.elapsed} ms · strength {strengthFromRating(preferences.adaptiveRating).toFixed(2)}</aside>
      )}
    </main>
  )
}

function WallSupply({ player, remaining, pathLength }: {
  player: 0 | 1
  remaining: number
  pathLength?: number
}) {
  const content = (
    <>
      <span className={`supply-avatar supply-avatar-${player}`}><i /></span>
      <span className="wall-rack" aria-hidden="true">
        {Array.from({ length: Math.min(remaining, 6) }, (_, index) => <i key={index} style={{ '--piece': index } as React.CSSProperties} />)}
      </span>
      <strong>{remaining}</strong>
      {pathLength !== undefined && <PathBadge player={player} length={pathLength} compact />}
    </>
  )
  return <div className={`wall-supply wall-supply-${player} ${pathLength !== undefined ? 'with-path' : ''}`} aria-label={`Player ${player + 1} has ${remaining} walls`}>{content}</div>
}

function WallButtons({ remaining, orientation, wallMode, dragMode, disabled, onSelect }: {
  remaining: number
  orientation: Orientation
  wallMode: boolean
  dragMode: boolean
  disabled: boolean
  onSelect: (orientation: Orientation) => void
}) {
  if (dragMode) {
    return (
      <div className="wall-buttons wall-buttons-drag" role="group" aria-label={`${remaining} walls remaining`}>
        <button
          className={`wall-button wall-button-drag ${wallMode ? 'active' : ''}`}
          disabled={disabled}
          onClick={() => onSelect(orientation)}
          aria-label={`${wallMode ? 'Cancel wall placement' : 'Select a wall to drag'}, ${remaining} remaining`}
          aria-pressed={wallMode}
        >
          <span className="wall-button-piece" aria-hidden="true" />
          <span className="wall-button-arrow" aria-hidden="true">✥</span>
          <strong>{remaining}</strong>
        </button>
      </div>
    )
  }

  return (
    <div className="wall-buttons" role="group" aria-label={`${remaining} walls remaining`}>
      {(['horizontal', 'vertical'] as Orientation[]).map((direction) => {
        const active = wallMode && orientation === direction
        return (
          <button
            key={direction}
            className={`wall-button wall-button-${direction} ${active ? 'active' : ''}`}
            disabled={disabled}
            onClick={() => onSelect(direction)}
            aria-label={`${active ? 'Cancel' : 'Place'} ${direction} wall, ${remaining} remaining`}
            aria-pressed={active}
          >
            <span className={`wall-button-piece wall-button-piece-${direction}`} aria-hidden="true" />
            <span className="wall-button-arrow" aria-hidden="true">{direction === 'horizontal' ? '↔' : '↕'}</span>
            <strong>{remaining}</strong>
          </button>
        )
      })}
    </div>
  )
}

function PathBadge({ player, length, compact = false }: { player: 0 | 1; length: number; compact?: boolean }) {
  return (
    <span className={`path-badge path-badge-${player} ${compact ? 'compact' : ''}`} aria-label={`Player ${player + 1} shortest path: ${length} moves`} title={`Shortest path: ${length}`}>
      <i aria-hidden="true" />
      <strong>{length}</strong>
    </span>
  )
}

function SettingGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="setting-group"><strong>{label}</strong><div className="choices">{children}</div></div>
}
