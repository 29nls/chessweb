# ChessWeb Tablebase Implementation Guide

> **Fully aligned with Lichess Tablebase API** (https://github.com/lichess-org/lila-tablebase)

## Overview

This implementation replaces the static Syzygy tablebase files approach with a **dynamic, efficient HTTP API integration** based on Lichess's official tablebase server. The system includes:

- ✅ Full Lichess API compatibility
- ✅ Enhanced caching (backend + frontend)
- ✅ Support for 3 variants (standard, atomic, antichess)
- ✅ Mainline queries for faster analysis
- ✅ Proper error handling & timeouts
- ✅ Offline caching support
- ✅ Comprehensive statistics

## Architecture

```
Frontend (React)
    ↓
tablebaseService.js (Client API)
    ↓
Backend (Node.js)
    ├─ Express REST API (/api/tablebase*)
    ├─ Socket.IO Events
    └─ lichessTablebase.js (Lichess API wrapper)
    ↓
Lichess Tablebase API
https://tablebase.lichess.ovh/{variant}?fen=...
```

## Backend API Endpoints

### POST `/api/tablebase`
Full tablebase analysis with all moves and metrics.

**Request:**
```json
{
  "fen": "4k3/6KP/8/8/8/8/7p/8 w - - 0 1",
  "variant": "standard"
}
```

**Response:**
```json
{
  "fen": "4k3/6KP/8/8/8/8/7p/8 w - - 0 1",
  "variant": "standard",
  "dtz": 1,
  "precise_dtz": 1,
  "dtc": null,
  "dtm": 17,
  "dtw": null,
  "checkmate": false,
  "stalemate": false,
  "insufficient_material": false,
  "category": "win",
  "variant_win": false,
  "variant_loss": false,
  "moves": [
    {
      "uci": "h7h8q",
      "san": "h8=Q+",
      "dtz": -2,
      "precise_dtz": -2,
      "dtm": -16,
      "category": "loss",
      "wdl": { "wins": 100, "draws": 0, "losses": 0 }
    }
  ],
  "mainline": [],
  "error": null
}
```

### POST `/api/tablebase/mainline`
Faster query returning only the best variation.

**Request:**
```json
{
  "fen": "4k3/6KP/8/8/8/8/7p/8 w - - 0 1",
  "variant": "standard"
}
```

**Response:**
```json
{
  "fen": "4k3/6KP/8/8/8/8/7p/8 w - - 0 1",
  "variant": "standard",
  "dtz": 1,
  "mainline": [
    { "uci": "h7h8q", "san": "h8=Q+", "dtz": -2 },
    { "uci": "e8d7", "san": "Kd7", "dtz": 1 }
  ],
  "winner": "w",
  "error": null
}
```

### GET `/api/tablebase/cache/stats`
Get backend cache statistics.

**Response:**
```json
{
  "size": 245,
  "maxSize": 1000,
  "ttlSeconds": 3600
}
```

### POST `/api/tablebase/cache/clear`
Clear backend cache.

## Socket.IO Events

### `queryTablebase` Event
Query tablebase via WebSocket connection.

**Emit:**
```javascript
socket.emit('queryTablebase', {
  fen: '4k3/6KP/8/8/8/8/7p/8 w - - 0 1',
  variant: 'standard',
  mainlineOnly: false  // Optional
});
```

**Receive:**
```javascript
socket.on('tablebase_response', (result) => {
  console.log(result);
});
```

### `queryTablebaseMainline` Event
Query mainline only via WebSocket.

**Emit:**
```javascript
socket.emit('queryTablebaseMainline', {
  fen: '4k3/6KP/8/8/8/8/7p/8 w - - 0 1',
  variant: 'standard'
});
```

**Receive:**
```javascript
socket.on('tablebase_mainline_response', (result) => {
  console.log(result);
});
```

## Frontend Service (`tablebaseService.js`)

### Core Functions

```javascript
// Query full analysis
const result = await queryTablebase(fen, variant, useCache);

// Query mainline only (faster)
const mainline = await queryTablebaseMainline(fen, variant, useCache);

// Get cache stats
const stats = getLocalCacheStats();

// Clear local cache
clearLocalCacheData();

// Check if endgame position (≤7 pieces)
const isEndgame = isEndgamePosition(fen);

// Get best move UCI
const bestUCI = getBestMoveUCI(result);

// Get best move SAN
const bestSAN = getBestMoveSAN(result);

// Get WDL percentages
const wdl = getWDLPercentages(result);

// Get top N moves
const topMoves = getTopMoves(result, 3);

// Filter winning moves
const wins = getWinningMoves(result);

// Filter drawing moves
const draws = getDrawingMoves(result);

// Filter losing moves
const losses = getLosingMoves(result);
```

## Tablebase Metrics Explained

| Metric | Meaning | Example |
|--------|---------|---------|
| **DTZ** | Depth to Zeroing (50-move rule) | 1 = nearest 50-move reset |
| **Precise DTZ** | DTZ without rounding | Guaranteed not rounded |
| **DTC** | Depth to Conversion | Mate into a position |
| **DTM** | Depth to Mate | Number of moves to checkmate |
| **DTW** | Depth to Antichess Win | For antichess variant only |
| **Category** | Position classification | win/loss/draw/unknown |
| **WDL** | Win/Draw/Loss statistics | { wins: N, draws: N, losses: N } |

## Response Categories

```javascript
const CATEGORIES = {
  'win': 'Winning position (with optimal play)',
  'syzygy-win': 'Winning in Syzygy table',
  'cursed-win': 'Position marked as cursed win',
  'blessed-loss': 'Position marked as blessed loss',
  'draw': 'Drawn position',
  'maybe-loss': 'Maybe lost (not in table)',
  'syzygy-loss': 'Losing in Syzygy table',
  'loss': 'Lost position',
  'maybe-win': 'Maybe won (not in table)',
  'unknown': 'Position not in tablebase'
};
```

## Usage Examples

### Example 1: React Component with Tablebase Analysis

```jsx
import React, { useState } from 'react';
import { queryTablebase, getWDLPercentages, getBestMoveSAN } from '../services/tablebaseService';

function TablebaseAnalysis({ fen, variant = 'standard' }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    setLoading(true);
    const result = await queryTablebase(fen, variant);
    setAnalysis(result);
    setLoading(false);
  };

  return (
    <div>
      <button onClick={analyze} disabled={loading}>
        {loading ? 'Analyzing...' : 'Analyze Position'}
      </button>

      {analysis && (
        <div>
          <p>Evaluation: {analysis.category}</p>
          <p>Best Move: {getBestMoveSAN(analysis)}</p>
          <p>WDL: {JSON.stringify(getWDLPercentages(analysis))}</p>
        </div>
      )}
    </div>
  );
}
```

### Example 2: Backend Route for Custom Analysis

```javascript
const { queryTablebase } = require('./lichessTablebase');
const tablebaseUtils = require('./tablebaseUtils');

app.post('/api/analyze', async (req, res) => {
  const { fen, variant } = req.body;

  const result = await queryTablebase(fen, variant);
  
  // Get insights
  const analysis = tablebaseUtils.analyzePosition(result);
  const recommendations = tablebaseUtils.getRecommendations(result);
  const eval = tablebaseUtils.getEvaluation(result);

  res.json({ analysis, recommendations, eval });
});
```

### Example 3: Offline Caching

```javascript
import { cacheResult, getCachedResult } from '../utils/localTablebaseCache';

// Results are automatically cached
const result = await queryTablebase(fen, variant, useCache = true);

// Later, retrieve from cache
const cached = getCachedResult(fen, variant); // Fast!

// Export cache for backup
import { exportLocalCache } from '../utils/localTablebaseCache';
const jsonData = exportLocalCache();
console.log(jsonData);
```

## Migration from Static Syzygy Files

### Old Approach (Static Files)
- Files stored in `/syzygy_tablebases/3-4-5 2022/`
- Required gigabytes of disk space
- Limited to local files
- No network fallback

### New Approach (Lichess API)
- **Dynamic API queries** to Lichess servers
- **Minimal disk space** (only cache)
- **Worldwide availability** via CDN
- **Automatic failover** with local cache
- **No file size limitations**
- **All variants supported** (standard, atomic, antichess)

## Performance Tips

1. **Use mainline queries for speed:**
   ```javascript
   const fast = await queryTablebaseMainline(fen, variant);
   ```

2. **Cache aggressively:**
   ```javascript
   const result = await queryTablebase(fen, variant, true); // useCache=true
   ```

3. **Batch queries efficiently:**
   ```javascript
   const results = await Promise.all([
     queryTablebase(fen1, 'standard'),
     queryTablebase(fen2, 'standard'),
     queryTablebase(fen3, 'standard'),
   ]);
   ```

4. **Check endgame status first:**
   ```javascript
   if (!isEndgamePosition(fen)) return; // Skip query
   const result = await queryTablebase(fen);
   ```

## Error Handling

All API responses include an `error` field:

```javascript
const result = await queryTablebase(fen, variant);

if (result.error) {
  console.error(`Tablebase error: ${result.error}`);
  // Handle gracefully
}
```

## Caching Strategy

### Backend Cache
- **Size:** 1000 positions
- **TTL:** 1 hour
- **Algorithm:** LRU (Least Recently Used)
- **Location:** Node.js memory

### Frontend Cache
- **Size:** 500 entries
- **Storage:** Browser localStorage
- **Algorithm:** LRU with timestamp
- **Max Size:** ~10MB

### Fallback Order
1. Frontend localStorage cache
2. Backend memory cache
3. Lichess HTTP API
4. Return error

## Configuration

### Backend (`lichessTablebase.js`)
```javascript
const LICHESS_TABLEBASE_URL = 'https://tablebase.lichess.ovh';
const VALID_VARIANTS = ['standard', 'atomic', 'antichess'];
const QUERY_TIMEOUT_MS = 5000; // 5 seconds
```

### Frontend (`localTablebaseCache.js`)
```javascript
const MAX_CACHE_ENTRIES = 500;
const MAX_CACHE_SIZE_MB = 10;
```

## Troubleshooting

### "Tablebase position not found"
- Position has >7 pieces (not in 7-man tablebase)
- Position is illegal
- Network error (check Lichess API status)

### "Cache quota exceeded"
- Frontend cache is full
- LocalStorage is near limit
- Call `clearLocalCache()` to reset

### Slow queries
- Use `queryTablebaseMainline()` instead
- Check network latency
- Verify backend cache is working

## References

- **Lichess Tablebase:** https://github.com/lichess-org/lila-tablebase
- **API Documentation:** https://tablebase.lichess.ovh/
- **Syzygy Format:** https://syzygy-tables.info/
- **UCI Protocol:** http://wbec-ridderkerk.nl/html/UCIProtocol.html

## License

This implementation follows Lichess's AGPL-3.0 license for tablebase access.
