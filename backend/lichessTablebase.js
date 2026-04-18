const https = require('https');
const { URL } = require('url');

/**
 * Simple in-memory LRU cache for tablebase queries
 * Prevents hammering Lichess API with same positions
 */
class SimpleCache {
  constructor(maxSize = 500, ttlSeconds = 3600) {
    this.maxSize = maxSize;
    this.ttlSeconds = ttlSeconds;
    this.cache = new Map();
    this.timestamps = new Map();
  }

  set(key, value) {
    // Remove oldest entry if at max size
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      this.timestamps.delete(firstKey);
    }

    this.cache.set(key, value);
    this.timestamps.set(key, Date.now());
  }

  get(key) {
    if (!this.cache.has(key)) return null;

    const timestamp = this.timestamps.get(key);
    const age = (Date.now() - timestamp) / 1000;

    // Check if expired
    if (age > this.ttlSeconds) {
      this.cache.delete(key);
      this.timestamps.delete(key);
      return null;
    }

    return this.cache.get(key);
  }

  clear() {
    this.cache.clear();
    this.timestamps.clear();
  }
}

const cache = new SimpleCache(500, 3600); // 500 positions, 1 hour TTL

/**
 * Fetch tablebase data from Lichess API with variant support
 * @param {string} fen - Chess position in FEN notation
 * @param {string} variant - Tablebase variant ('standard', 'atomic', 'antichess')
 * @returns {Promise<Object>} Tablebase data with moves, mainline, WDL stats
 */
async function queryTablebase(fen, variant = 'standard') {
  try {
    // Validate FEN format (basic check)
    if (!fen || typeof fen !== 'string') {
      return {
        fen: fen || '',
        variant: variant,
        error: 'Invalid FEN format',
        moves: [],
        mainline: [],
        checkmate: false,
        stalemate: false,
      };
    }

    // Validate variant
    const validVariants = ['standard', 'atomic', 'antichess'];
    if (!validVariants.includes(variant)) {
      variant = 'standard';
    }

    // Check cache first (key includes variant for separation)
    const cacheKey = `${variant}:${fen}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log(`[Tablebase] Cache hit for ${variant}:${fen.substring(0, 30)}...`);
      return cached;
    }

    console.log(`[Tablebase] Querying Lichess API for ${variant}:${fen.substring(0, 30)}...`);

    // Construct URL with variant
    const url = new URL(`https://tablebase.lichess.ovh/${variant}`);
    url.searchParams.append('fen', fen);

    const result = await fetchWithTimeout(url.toString(), 2000);
    result.variant = variant;

    // Cache successful result
    cache.set(cacheKey, result);
    console.log(`[Tablebase] Cached result for ${variant}:${fen.substring(0, 30)}...`);

    return result;
  } catch (error) {
    console.error(`[Tablebase] Error querying tablebase:`, error.message);
    return {
      fen: fen || '',
      variant: variant,
      error: error.message,
      moves: [],
      mainline: [],
      checkmate: false,
      stalemate: false,
    };
  }
}

/**
 * Fetch with timeout
 * @param {string} url - URL to fetch
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<Object>} Parsed JSON response
 */
function fetchWithTimeout(url, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Tablebase API request timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    https
      .get(url, (res) => {
        clearTimeout(timeout);

        // Handle non-200 status codes
        if (res.statusCode !== 200) {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            reject(
              new Error(`Tablebase API returned status ${res.statusCode}: ${data}`)
            );
          });
          return;
        }

        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);

            // Transform response to our format
            const result = {
              fen: url.split('fen=')[1] ? decodeURIComponent(url.split('fen=')[1]) : '',
              checkmate: parsed.checkmate || false,
              stalemate: parsed.stalemate || false,
              moves: (parsed.moves || []).map((move) => ({
                uci: move.uci,
                san: move.san,
                wdl: {
                  wins: move.wdl?.wins || 0,
                  draws: move.wdl?.draws || 0,
                  losses: move.wdl?.losses || 0,
                },
                dtm: move.dtm || null,
                dtz: move.dtz || null,
              })),
              mainline: parsed.mainline || [],
              error: null,
            };

            resolve(result);
          } catch (parseError) {
            reject(new Error(`Failed to parse Tablebase API response: ${parseError.message}`));
          }
        });
      })
      .on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`HTTP request failed: ${error.message}`));
      });
  });
}

/**
 * Check if a position is an endgame (≤7 pieces)
 * @param {string} fen - Chess position in FEN notation
 * @returns {boolean} True if position is endgame, false otherwise
 */
function isEndgamePosition(fen) {
  if (!fen || typeof fen !== 'string') return false;

  // Count pieces from FEN (everything except spaces)
  const piecesMatch = fen.split(' ')[0].match(/[a-zA-Z]/g);
  const piecesCount = piecesMatch ? piecesMatch.length : 0;

  return piecesCount <= 7;
}

module.exports = {
  queryTablebase,
  isEndgamePosition,
  cache,
};
