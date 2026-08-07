# AGENT.md — Quoridor

## Project goal

Build a polished, browser-based implementation of **Quoridor** designed primarily for a 4-year-old child who already knows and plays the game.

The game must:

* run entirely in the browser;
* require no backend, account, login, database, or external API;
* work well on phones, iPads/tablets, laptops, and desktop browsers;
* be deployable as a static site using GitHub Pages;
* support play against a local AI;
* support 7×7, 9×9, and 11×11 boards;
* provide Easy, Medium, Hard, and Adaptive AI;
* use standard Quoridor movement and wall-placement rules;
* be largely text-free during gameplay;
* have large, forgiving touch targets suitable for a young child;
* store preferences and adaptive-AI progress locally in the browser.

The working name is simply:

**Quoridor**

Do not overcomplicate the product with accounts, multiplayer networking, tutorials, backend services, analytics, adverts, or unnecessary menus.

---

# 1. Product philosophy

This is primarily a real game, not an educational tutorial.

The child already understands Quoridor and plays it physically against a parent.

Therefore:

* do not explain the rules during normal gameplay;
* do not interrupt play with instructional text;
* do not use speech;
* do not treat the child like a first-time player;
* prioritize immediate interaction and clear visual feedback.

The interface should feel like a polished physical board game adapted for touchscreens.

The visual style should sit between:

1. a clean wooden/tabletop board game; and
2. a colourful children's game.

Avoid either extreme.

It should look attractive and slightly playful without looking like a preschool app.

---

# 2. Technical constraints

Use a modern static frontend stack.

Preferred:

* TypeScript
* React
* Vite
* CSS
* Web Worker for AI calculations
* localStorage for persistence
* GitHub Actions + GitHub Pages for deployment

Avoid unnecessary frameworks and dependencies.

The final production build must be completely static.

There must be:

* no Node server;
* no server-side rendering requirement;
* no API;
* no database;
* no authentication;
* no cloud AI;
* no telemetry requirement.

After loading, a game should be capable of running entirely locally.

---

# 3. PWA / offline support

Make the game installable as a lightweight Progressive Web App.

Provide:

* manifest;
* icons;
* appropriate mobile viewport configuration;
* service-worker-based caching if straightforward;
* offline loading after the initial visit.

This is secondary to game correctness.

Do not allow PWA complexity to delay the core game.

---

# 4. Supported devices

Explicitly optimise and test for:

* modern Android phones;
* iPhone-sized displays;
* iPad/tablet;
* laptop browser;
* desktop browser.

The UI must work in both portrait and landscape orientations.

Portrait mobile use is particularly important.

The game must not depend on:

* hover;
* right-click;
* keyboard;
* precise mouse positioning.

Every action must work naturally by touch.

---

# 5. Core game modes

Initially implement:

**Human vs AI**

Do not prioritise online multiplayer.

Optionally retain a clean internal architecture that could later support:

* human vs human on the same device;
* AI vs AI;

but these are not required for v1.

---

# 6. Board sizes

Support:

* 7 × 7
* 9 × 9
* 11 × 11

Recommended number of walls per player:

* 7×7: 8 walls
* 9×9: 10 walls
* 11×11: 12 walls

The 9×9 mode must correspond to standard Quoridor.

Do not hard-code the engine around 9×9.

Board dimensions, wall coordinates, goals, starting positions, pathfinding and AI evaluation must derive from board configuration.

---

# 7. Standard Quoridor rules

Implement the normal two-player Quoridor rules.

Each player starts on the centre square of their respective edge.

The goal is to reach any square on the opposite edge.

Implement correctly:

* orthogonal pawn movement;
* jumping over the opponent;
* diagonal movement around the opponent when a straight jump is blocked;
* horizontal walls;
* vertical walls;
* walls occupying two adjacent edge segments;
* prevention of overlapping walls;
* prevention of intersecting/crossing walls;
* prevention of any wall placement that completely blocks either player's path to the goal.

Every legal wall placement must preserve at least one route to the goal for both players.

Use automated tests for these rules.

The game engine must be deterministic and separate from rendering.

---

# 8. Architecture

Separate the project into clear layers.

Recommended structure:

```text
src/
  game/
    types.ts
    state.ts
    rules.ts
    movement.ts
    walls.ts
    pathfinding.ts
    reducer.ts

  ai/
    evaluation.ts
    moveGeneration.ts
    search.ts
    difficulty.ts
    adaptive.ts
    ai.worker.ts

  components/
    Board/
    Pawn/
    Wall/
    WallSupply/
    GameControls/
    Settings/

  audio/
  storage/
  styles/
  utils/
```

Exact names may change, but preserve the separation between:

1. game rules;
2. AI;
3. UI;
4. persistence.

The UI must never contain authoritative rule logic.

---

# 9. Game-state representation

Define an efficient, serialisable game state.

It should include at minimum:

* board size;
* player pawn positions;
* walls remaining;
* placed horizontal walls;
* placed vertical walls;
* current player;
* game result;
* move history.

Represent wall positions canonically so that legality checking and AI hashing are reliable.

Consider compact integer coordinates rather than DOM-oriented representations.

Do not use mutable global state.

---

# 10. Pathfinding

Shortest-path computation is central to Quoridor.

Implement efficient BFS initially.

Given the board sizes are small, correctness is more important than premature optimisation.

Expose operations similar to:

```ts
shortestPathLength(state, player)
pathExists(state, player)
getShortestPath(state, player)
```

These functions should be reusable by:

* rule validation;
* AI evaluation;
* debugging;
* testing.

Cache results where useful during AI search.

---

# 11. Touch-first interaction

This is extremely important.

Do NOT rely primarily on dragging walls into narrow gaps.

For wall placement use:

1. child taps a wall in their wall supply;
2. game enters wall-placement mode;
3. valid wall positions become visibly interactive;
4. child taps a position;
5. wall is placed.

Touch targets should be larger than the visual wall itself.

Allow slight imprecision.

For pawn movement:

* tap the pawn if necessary, or simply expose legal destination squares;
* legal moves should be visually obvious;
* tap a destination square to move.

Avoid requiring double taps.

Avoid modal confirmation dialogs for normal moves.

---

# 12. Visual interaction

The board should be immediately understandable without text.

Use visual states for:

* current player's turn;
* selected pawn;
* legal pawn destinations;
* selected wall;
* valid wall positions;
* invalid attempted placement;
* AI thinking;
* game won;
* undo available.

Animations should be short.

Suggested animation durations:

* pawn move: ~150–250 ms;
* wall placement: ~150–250 ms;
* winner celebration: short and restrained.

Avoid animations that slow repeated gameplay.

---

# 13. Text-free gameplay

The main game screen should contain very little text.

Prefer:

* icons;
* board geometry;
* wall counters represented graphically;
* obvious player colours/shapes;
* gear icon;
* undo icon;
* new-game/restart icon;
* sound icon.

Settings may contain brief text labels because those are primarily for the parent.

Do not use voice prompts.

---

# 14. Audio

Audio is optional but the architecture should support it.

If added, use simple local sound effects such as:

* pawn movement;
* wall placement;
* invalid action;
* win.

Music is optional.

If music is implemented:

* keep it subtle;
* provide a clear mute control;
* default behaviour should respect previous local preference.

No speech.

Do not make audio essential to understanding the game.

---

# 15. Settings

Use a small gear icon.

Opening the gear reveals the parent-oriented settings screen/panel.

Settings should include:

### Board size

* 7×7
* 9×9
* 11×11

### AI difficulty

* Easy
* Medium
* Hard
* Adaptive

### Sound

* On
* Off

Potentially:

* music on/off separately if music is introduced.

Keep the settings visually simple.

Changing board size or difficulty during an active game should require deliberate confirmation only if it would reset the current game.

The confirmation can use icons and minimal text.

---

# 16. AI requirements

AI must run locally.

AI computation must not freeze or noticeably block the UI.

Run significant AI search inside a Web Worker.

The main thread should remain responsive while the AI thinks.

The AI must work for:

* 7×7;
* 9×9;
* 11×11.

Do not implement separate AI engines for each size.

---

# 17. AI move representation

AI moves should include:

```ts
type Move =
  | { type: "pawn"; to: Position }
  | { type: "wall"; orientation: "horizontal" | "vertical"; position: WallPosition }
```

Game rules must validate AI moves exactly as human moves are validated.

Never allow the AI to bypass the normal game engine.

---

# 18. Candidate move generation

Naively searching every possible wall placement becomes expensive.

Use intelligent candidate generation.

Pawn moves:

* always include all legal pawn moves.

Wall moves:

prioritise walls that:

* lie near either pawn;
* intersect or influence either player's shortest path;
* extend existing local wall structures;
* substantially change shortest-path length;
* block an immediately dangerous route.

Do not permanently forbid unusual wall placements.

For higher difficulty, broaden the candidate set when necessary.

This concept is inspired by successful existing browser Quoridor engines, but implement the code independently.

---

# 19. Evaluation function

Start with an interpretable heuristic.

Example structure:

```text
score =
    A * opponentShortestPath
  - B * ownShortestPath
  + C * ownWallsRemaining
  - D * opponentWallsRemaining
  + E * positionalFactors
```

However, the shortest-path race should dominate.

Also consider:

* immediate win/loss;
* ability to jump;
* tempo;
* wall efficiency;
* opponent threats;
* pawn proximity to goal;
* forced routes.

Evaluate everything from the current AI player's perspective.

Avoid hand-tuning dozens of arbitrary parameters initially.

Build tests and simple AI-vs-AI simulations to tune them.

---

# 20. Search strategy

Preferred initial approach:

**iterative-deepening minimax / negamax with alpha-beta pruning**

Add:

* move ordering;
* transposition table;
* terminal-state detection;
* shortest-path caching;
* bounded wall candidate generation.

Potentially add:

* aspiration windows;
* killer/history move ordering;

only if useful.

A pure MCTS implementation is also acceptable if benchmarking demonstrates clearly better behaviour.

Do not use neural networks.

Do not require downloaded models.

The final AI should remain understandable, maintainable and fully browser-local.

---

# 21. AI thinking time

Use time budgets rather than relying solely on fixed search depth.

Approximate goals on a normal contemporary phone/tablet:

Easy:

* almost immediate;
* roughly 50–150 ms where practical.

Medium:

* roughly 200–500 ms.

Hard:

* roughly 500–1500 ms.

Adaptive:

* based on its internally selected strength.

These are guidance rather than strict timing requirements.

Do not make the child wait several seconds for routine moves.

On weaker devices, prioritise responsiveness.

---

# 22. Easy AI

Easy should remain recognisably sensible but deliberately forgiving.

It should:

* understand the goal;
* obey all rules;
* occasionally make poor strategic decisions;
* not immediately exploit every mistake;
* not endlessly place random walls.

Possible implementation:

1. evaluate several candidate moves;
2. rank them;
3. probabilistically choose among the top-but-not-always-best moves.

For example:

* sometimes choose 2nd–5th ranked action;
* reduce search depth/time;
* introduce controlled evaluation noise.

Do NOT simply select random legal moves.

The opponent should still look as though it is playing Quoridor.

---

# 23. Medium AI

Medium should:

* play competently;
* block obvious threats;
* use walls purposefully;
* make occasional strategic mistakes;
* be beatable by a child who is improving.

Use moderate search budget and candidate pruning.

This should probably become the baseline against which Adaptive is calibrated.

---

# 24. Hard AI

Hard should attempt to play genuinely well.

Use:

* longest permitted search budget;
* strong move ordering;
* larger wall candidate set;
* deeper iterative search;
* transposition table;
* good shortest-path evaluation.

Hard does not need to be competitive with specialist tournament Quoridor engines, but it should be challenging for an ordinary adult player.

Correctness and mobile responsiveness remain more important than maximum strength.

---

# 25. Adaptive AI

Adaptive is an important feature.

Its objective is not simply to win.

Its objective is to keep the child playing against an opponent that gradually tracks his ability.

Target approximately:

**50–65% child win rate**

over a reasonable moving window.

Do not cheat.

The AI must always play legal moves using information available normally in the game.

Adapt AI strength through:

* search time;
* effective search depth;
* number of wall candidates;
* evaluation noise;
* probability of choosing a non-best move.

Do not manipulate the game state or secretly change rules.

---

# 26. Adaptive rating

Maintain a lightweight local player-skill estimate.

Store it only in localStorage.

A simple Elo-like system is sufficient.

Example concept:

```text
playerRating
AI difficulty rating
expectedResult
rating adjustment
```

The exact rating values are not important.

What matters is that repeated good performance gradually creates a stronger opponent.

Avoid large difficulty jumps.

Use smoothing.

A few lucky wins or losses should not radically change the AI.

---

# 27. Additional adaptive signals

Win/loss should be the primary signal.

Optional secondary signals can include:

* game length;
* shortest-path disadvantage during the game;
* number of obviously inefficient wall placements;
* whether the child repeatedly allows immediate threats.

Do not over-engineer this.

Do not attempt psychological profiling.

Do not upload any information.

Everything remains local.

---

# 28. Difficulty progression

Adaptive difficulty should feel continuous rather than switching visibly between Easy/Medium/Hard.

Internally define a strength value such as:

```text
0.0 → very easy
1.0 → hard
```

Map this continuously onto AI parameters.

For example:

```text
strength
→ search time
→ candidate wall count
→ evaluation noise
→ suboptimal-move probability
```

Persist the strength/rating locally.

---

# 29. Local persistence

Use localStorage.

Persist:

* preferred board size;
* selected difficulty;
* sound setting;
* music setting if applicable;
* adaptive rating;
* number of games;
* wins;
* losses;
* optionally win statistics by board size.

Do not require a user name.

Do not collect personal information.

Provide a parent-accessible way to reset stored progress.

---

# 30. Undo

Provide an Undo button.

Behaviour:

### Easy

Allow undo.

Undo should normally restore the position before the child's previous move, including undoing the AI response.

### Adaptive

Allow undo with the same behaviour.

Do not punish adaptive rating for a game state that has been undone.

### Medium

Undo may remain available.

### Hard

Undo may either be disabled or available depending on final UX.

Prefer consistency initially: allow undo everywhere.

This is a learning/family game, not a tournament platform.

---

# 31. New game / reset

Provide a prominent but non-intrusive new-game control.

A reset should:

* preserve settings;
* preserve adaptive rating;
* reset the board;
* alternate or intelligently manage first-player choice if desired.

Initially it is acceptable for the child always to move first.

---

# 32. AI thinking state

While the AI is calculating:

* prevent illegal additional input;
* visually indicate that the opponent is thinking;
* keep the interface responsive.

Use a simple animated indication on the AI pawn or player indicator.

Avoid text like:

"AI IS CALCULATING..."

A subtle animated ellipsis/bounce/glow is enough.

---

# 33. Board rendering

Use either:

* semantic HTML/CSS; or
* SVG;

depending on which gives the cleanest responsive implementation.

SVG may be particularly suitable because:

* board geometry is scalable;
* wall positions can be precise;
* touch hit regions can be larger than visuals;
* rendering remains sharp at all screen densities.

Canvas is acceptable only if it clearly improves implementation.

Do not use WebGL.

---

# 34. Responsive board sizing

The board should consume most of the available screen.

Calculate cell size from:

```text
min(available width, available height)
```

Account for:

* wall supply;
* top controls;
* safe-area insets;
* portrait screens.

An 11×11 board must remain playable on a phone.

For smaller screens:

* reduce decorative margins;
* keep hit areas large;
* prioritise board size over labels.

---

# 35. Colour and accessibility

Use strongly differentiated players.

Do not rely solely on colour.

Also differentiate pawns using:

* shape;
* outline;
* subtle symbol;
* dimensional styling.

Ensure reasonable contrast.

Avoid overly saturated preschool colours.

---

# 36. Wall supply

Represent remaining walls visually.

A stack/rack of small wall pieces is preferable to a large numeric label.

A small number may accompany the visual stack if helpful.

The wall supply itself should function as the wall-selection button.

When no walls remain, visually disable it.

---

# 37. Game end

When the child wins:

* clearly indicate victory;
* use a short visual celebration;
* optionally play a small sound;
* provide an obvious "play again" control.

When the AI wins:

* indicate the result without negative/error styling;
* provide play again immediately.

Avoid verbose messages.

---

# 38. Automated testing

Game logic requires strong test coverage.

Use Vitest or equivalent.

Test at least:

### Movement

* normal movement;
* edge constraints;
* opponent blocking;
* straight jump;
* blocked jump;
* diagonal jump left/right;
* multiple boundary cases.

### Walls

* legal horizontal wall;
* legal vertical wall;
* overlap rejection;
* crossing rejection;
* edge rejection;
* path-blocking rejection;
* difficult maze configurations.

### Win state

* each player reaching target edge.

### Board sizes

Run equivalent core tests for:

* 7×7;
* 9×9;
* 11×11.

### Undo

Verify complete state restoration.

### AI

Verify:

* every generated AI move is legal;
* AI takes an immediate win;
* AI avoids an immediate loss when a legal defence exists;
* AI does not hang;
* search respects its time budget reasonably.

---

# 39. Property / fuzz testing

Where practical, generate random legal game states.

For each:

* enumerate legal moves;
* make a move;
* verify state validity;
* verify both players retain a valid path;
* verify AI never returns an illegal action.

This will be especially useful for finding rare wall/pathfinding bugs.

---

# 40. AI benchmarking

Build a simple development-only benchmark harness.

It should allow:

```text
Easy vs Medium
Medium vs Hard
Easy vs Hard
Hard vs Hard
```

over multiple games.

Results do not need to appear in production UI.

Use this to confirm:

```text
Hard > Medium > Easy
```

statistically.

Also record approximate AI think times.

The purpose is to tune difficulty rationally rather than by intuition alone.

---

# 41. Existing public repositories as references

Before finalising the AI, inspect existing public Quoridor implementations, especially browser-based ones.

Particularly useful concepts include:

* minimax / alpha-beta Quoridor implementations;
* Monte-Carlo-tree-search Quoridor implementations;
* shortest-path-based evaluation;
* candidate-wall filtering;
* browser-local AI.

Use them for architectural and algorithmic understanding.

Do not blindly port another project's source.

Before copying any code:

1. verify its licence;
2. confirm reuse is compatible with this repository;
3. preserve attribution where required.

Prefer independent implementation.

---

# 42. Performance

The target is smooth interaction on an ordinary mobile device.

Requirements:

* touch response should feel immediate;
* animations should remain near 60 fps;
* AI search must run off the main thread;
* no significant memory growth across repeated games;
* avoid exhaustive enumeration of every wall at every deep search node.

Profile Hard mode on:

* 7×7;
* 9×9;
* 11×11.

11×11 must remain usable.

---

# 43. Web Worker protocol

Keep communication between UI and AI explicit.

Example:

Main → worker:

```ts
{
  type: "calculateMove",
  state,
  difficulty,
  adaptiveStrength
}
```

Worker → main:

```ts
{
  type: "move",
  move,
  diagnostics?
}
```

Support cancellation using a request/game ID.

If the user:

* starts a new game;
* changes settings;
* undoes;

ignore stale AI responses.

---

# 44. Development diagnostics

In development mode only, optionally expose:

* current evaluation;
* shortest-path lengths;
* search depth;
* nodes evaluated;
* transposition-table hits;
* AI think time;
* adaptive strength.

Do not expose this in the normal child-facing UI.

A URL flag such as:

```text
?debug=1
```

is acceptable.

---

# 45. Privacy

This application is for a child.

Therefore:

* no analytics;
* no behavioural tracking;
* no third-party advertising;
* no external user profiling;
* no account;
* no child's name required;
* no data sent remotely.

Game progress remains local to the browser.

If external fonts/assets are unnecessary, bundle assets locally.

---

# 46. GitHub Pages deployment

Configure automated GitHub Pages deployment.

On push to the main branch:

1. install dependencies;
2. run lint;
3. run tests;
4. build;
5. deploy production static files.

Make sure the Vite base path works correctly for:

```text
https://USERNAME.github.io/REPOSITORY/
```

Do not assume deployment at `/`.

Also allow local development with:

```bash
npm install
npm run dev
```

and production verification with:

```bash
npm run build
npm run preview
```

---

# 47. README

Write a concise README containing:

* screenshot;
* live demo link;
* short description;
* development commands;
* build command;
* GitHub Pages deployment information;
* rules acknowledgement;
* licence;
* acknowledgements/references where relevant.

Do not make the README excessively long.

---

# 48. Suggested implementation sequence

Implement incrementally.

## Phase 1 — engine

Build:

* board representation;
* pawn movement;
* jumping;
* diagonal jumping;
* walls;
* path validation;
* victory;
* undo;
* tests.

Do not work on sophisticated graphics until this is reliable.

## Phase 2 — basic UI

Build:

* responsive board;
* pawn interaction;
* wall interaction;
* player turns;
* game reset.

Make it usable on a touchscreen.

## Phase 3 — baseline AI

Build:

* shortest-path evaluation;
* candidate moves;
* minimax/negamax;
* alpha-beta;
* Web Worker.

Establish a competent AI before introducing difficulty levels.

## Phase 4 — difficulty

Create:

* Easy;
* Medium;
* Hard.

Benchmark them against one another.

## Phase 5 — Adaptive

Add:

* local player rating;
* continuous strength parameter;
* persistence;
* tuning.

## Phase 6 — polish

Add:

* final visual theme;
* animations;
* sounds;
* settings;
* undo UX;
* winner animation;
* PWA.

## Phase 7 — deployment and device testing

Test actual mobile layouts.

Fix:

* touch targets;
* scrolling;
* safe areas;
* orientation;
* 11×11 readability;
* performance.

Deploy to GitHub Pages.

---

# 49. Acceptance criteria

Do not consider the initial release finished until all of the following are true.

### Core game

* [ ] Standard Quoridor rules are correctly implemented.
* [ ] Jump and diagonal-jump cases work.
* [ ] Illegal path-blocking walls cannot be placed.
* [ ] 7×7 works.
* [ ] 9×9 works.
* [ ] 11×11 works.
* [ ] Undo works reliably.

### AI

* [ ] Easy works.
* [ ] Medium works.
* [ ] Hard works.
* [ ] Adaptive works.
* [ ] AI cannot make illegal moves.
* [ ] AI calculations do not freeze the UI.
* [ ] Hard is measurably stronger than Medium.
* [ ] Medium is measurably stronger than Easy.

### Child UX

* [ ] A child familiar with Quoridor can start playing without instructions.
* [ ] Normal play requires almost no reading.
* [ ] Pawn moves are easy to tap.
* [ ] Wall positions are easy to tap.
* [ ] No precise dragging is required.
* [ ] 11×11 remains usable on a phone.
* [ ] Gear/settings are visually unobtrusive.

### Persistence

* [ ] Preferences survive reload.
* [ ] Adaptive level survives reload.
* [ ] Reset-progress functionality works.

### Deployment

* [ ] GitHub Pages deployment succeeds automatically.
* [ ] Site works from the repository subpath.
* [ ] Site works on phone.
* [ ] Site works on iPad/tablet.
* [ ] Site works on desktop.
* [ ] No backend is required.

---

# 50. Important implementation principle

At every stage favour:

**correct rules → responsive touch interaction → convincing AI → simplicity**

over additional features.

Do not add:

* user accounts;
* online multiplayer;
* chat;
* tutorials;
* voice;
* achievements systems;
* complex profiles;
* cloud services;

unless specifically requested later.

The intended experience is:

**open webpage → see board → play Quoridor against a good local opponent.**
