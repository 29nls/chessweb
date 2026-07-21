# ChessWeb

ChessWeb is a web-based chess application that allows users to play against a powerful chess engine (Stockfish 18 WASM), analyze positions, play online multiplayer, and explore game variations. It features a clean, modern interface built with React.

## Features

- **Interactive Chessboard:** Play moves, undo/redo, and reset games with drag-and-drop support.
- **Engine Integration:** Stockfish 18 WASM runs entirely in the browser — no server needed.
- **Move Classification:** Real-time classification of moves (Brilliant, Great, Best, Excellent, Good, Inaccuracy, Miss, Mistake, Blunder).
- **Opening Explorer:** Explore common opening lines with evaluation.
- **Online Multiplayer:** Play against friends via Supabase Realtime (websockets).
- **Spectator Mode:** Watch live games and synchronize state in real-time.
- **In-Game Chat & Reactions:** Communicate with opponents during online matches.
- **Takeback & Draw Offers:** Request takebacks, offer/accept draws in online games.
- **Configurable Engine Settings:** Adjust analysis depth, movetime, CPU threads, hash size, and MultiPV lines.
- **FEN/PGN Support:** Import and export game positions using FEN and PGN.
- **Auto-Move Opponent:** Enable the engine to automatically make moves for the opposing side.
- **Board Orientation:** Flip the board to view from White's or Black's perspective.
- **Real-time Evaluation Bar:** Visual representation of the engine's evaluation with multi-line analysis.
- **Dark Mode:** Theme support via `data-theme='dark'` attribute on the root element.

## Technologies Used

- **Frontend:** React 19, JavaScript (ES6+)
- **Chess Logic:** `chess.js` library
- **Chess Engine:** Stockfish 18 (WASM, runs in-browser)
- **Online Multiplayer:** Supabase Realtime (websockets + presence)
- **Styling:** Custom CSS with CSS variables for theming
- **Deployment:** Vercel (including Speed Insights & Web Analytics)

## Setup and Installation

### Prerequisites

- Node.js (LTS version recommended)
- npm (Node Package Manager)

### Quick Start

```bash
git clone https://github.com/29nls/chessweb.git
cd chessweb
npm install
npm start
```

The application will open in your browser at `http://localhost:3000`.

### Online Multiplayer Setup

Online multiplayer requires Supabase. Create a `.env` file in the project root:

```env
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Backend Engine Mode (Optional)

By default, the app uses Stockfish WASM in the browser. If you prefer a backend-based engine:

1. Set `REACT_APP_ENGINE_MODE=backend` in your `.env`
2. Set `REACT_APP_BACKEND_URL=http://localhost:3001`
3. Place UCI-compatible engine binaries in the `chessengines/` directory
4. Start the backend: `cd backend && node server.js`

## Usage

- **Playing Moves:** Drag and drop pieces on the board, or click source square then target square.
- **Analysis:** The evaluation bar and move classification provide real feedback on each move.
- **Online Play:** Click the Online button, create or join a game using a 6-character code.
- **Engine Settings:** Adjust analysis parameters using the controls panel.
- **FEN/PGN:** Import/export game data via the FEN and PGN buttons.
- **Shortcuts:** `R` = New Game, `F` = Flip Board, `←`/`→` = Undo/Redo.

## Project Structure

```
src/
├── components/       # Reusable UI components (OpeningExplorer, SkeletonLoader)
├── engine/           # Engine abstraction (browser WASM, backend adapter)
├── hooks/            # Custom React hooks (useChessEngine, useGameHistory, useOnlineGame, etc.)
├── lib/              # Utilities (sound effects, opening book)
├── pages/            # Page components (AnalysisPage, OnlinePage)
├── App.js            # Root app with routing
├── ChessboardContainer.js  # Chessboard wrapper with react-chessboard
├── Controls.js       # Engine settings and game controls
├── EvaluationSection.js    # Evaluation bar and engine stats
├── LandingScreen.js  # Landing page with navigation
├── Modal.js          # Reusable modal component
├── MoveClassification.js  # Move classification logic
├── MoveHistory.js    # Move history display with classifications
├── OnlineLobby.js    # Lobby UI + OnlineStatusBar + ChatPanel
└── supabaseClient.js # Supabase client configuration
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `REACT_APP_ENGINE_MODE` | `browser` | Engine mode: `browser` (WASM) or `backend` |
| `REACT_APP_BACKEND_URL` | `http://localhost:3001` | Backend server URL (backend mode only) |
| `REACT_APP_SUPABASE_URL` | — | Supabase project URL (online multiplayer) |
| `REACT_APP_SUPABASE_ANON_KEY` | — | Supabase anonymous key (online multiplayer) |

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT License
