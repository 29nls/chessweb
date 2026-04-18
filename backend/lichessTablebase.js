const https = require('https');
const http = require('http');
const { URL } = require('url');

/**
 * Enhanced LRU Cache with better memory management
 * Implements proper Least Recently Used eviction policy
 */
class EnhancedLRUCache {
  constructor(maxSize = 1000, ttlSeconds = 3600) {
    this.maxSize = maxSize;
    this.ttlSeconds = ttlSeconds;
    this.cache = new Map();
    this.timestamps = new Map();
    this.accessOrder = [];
  }

  set(key, value) {
    // Remove from access order if exists
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }

    // Add to end (most recently used)
    this.accessOrder.push(key);

    // Evict least recently used if at capacity
    while (this.cache.size >= this.maxSize && this.accessOrder.length > 0) {
      const lruKey = this.accessOrder.shift();
      this.cache.delete(lruKey);
      this.timestamps.delete(lruKey);
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
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
      return null;
    }

    // Move to end (most recently used)
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);

    return this.cache.get(key);
  }

  clear() {
    this.cache.clear();
    this.timestamps.clear();
    this.accessOrder = [];
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlSeconds: this.ttlSeconds,
    };
  }
}

const cache = new EnhancedLRUCache(1000, 3600); // 1000 positions, 1 hour TTL

const LICHESS_TABLEBASE_URL = 'https://tablebase.lichess.ovh';
const VALID_VARIANTS = ['standard', 'atomic', 'antichess'];
const QUERY_TIMEOUT_MS = 5000; // 5 second timeout

/**
 * Validate and normalize FEN string (replace underscores with spaces)
 * @param {string} fen - FEN notation (spaces or underscores)
 * @returns {string} Normalized FEN with spaces
 */
function normalizeFEN(fen) {
  if (!fen || typeof fen !== 'string') return '';
  return fen.replace(/_/g, ' ').trim();
}

/**
 * Validate FEN format - basic structure check
 * @param {string} fen - FEN to validate
 * @returns {boolean} True if valid FEN format
 */
function isValidFEN(fen) {
  if (!fen || typeof fen !== 'string') return false;
  const parts = fen.split(' ');
  // FEN has 6 parts: position, turn, castling, enpassant, halfmove, fullmove
  return parts.length === 6;
}

/**
 * Fetch with timeout support (both HTTP and HTTPS)
 * @param {string} url - URL to fetch
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<string>} Response body
 */
function fetchWithTimeout(url, timeoutMs = QUERY_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const timeout = setTimeout(() => {
      req.destroy();
      reject(new Error(`Request timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    const req = protocol.get(url, (res) => {
      clearTimeout(timeout);

      let data = '';

      if (res.statusCode !== 200) {
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        });
        return;
      }

      res.on('data', (chunk) => {
        data += chunk;
        // Prevent excessive memory usage
        if (data.length > 1024 * 1024) {
          req.destroy();
          reject(new Error('Response too large'));
        }
      });

      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Invalid JSON response: ${e.message}`));
        }
      });
    });

    req.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

/**
 * Query Lichess tablebase API for position analysis
 * Returns full move analysis with all metrics
 * 
 * @param {string} fen - Chess position in FEN notation
 * @param {string} variant - Variant: 'standard', 'atomic', 'antichess'
 * @returns {Promise<Object>} Full tablebase analysis
 */
async function queryTablebase(fen, variant = 'standard') {
  try {
    // Validate and normalize inputs
    fen = normalizeFEN(fen);
    if (!isValidFEN(fen)) {
      return createErrorResponse(fen, variant, 'Invalid FEN format');
    }

    // Validate variant
    if (!VALID_VARIANTS.includes(variant)) {
      variant = 'standard';
    }

    // Check cache first
    const cacheKey = `${variant}:${fen}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log(`[Tablebase] Cache hit: ${variant} - ${fen.substring(0, 20)}...`);
      return cached;
    }

    console.log(`[Tablebase] Querying ${variant} - ${fen.substring(0, 20)}...`);

    // Build query URL
    const url = new URL(`${LICHESS_TABLEBASE_URL}/${variant}`);
    url.searchParams.append('fen', fen);

    // Fetch from Lichess API
    const apiResponse = await fetchWithTimeout(url.toString(), QUERY_TIMEOUT_MS);

    // Normalize response to Lichess API format
    const result = normalizeResponse(apiResponse, fen, variant);

    // Cache successful result
    cache.set(cacheKey, result);
    console.log(`[Tablebase] Cached: ${variant} - ${fen.substring(0, 20)}...`);

    return result;
  } catch (error) {
    console.error(`[Tablebase] Error:`, error.message);
    return createErrorResponse(fen, variant, error.message);
  }
}

/**
 * Query mainline (best variation) from tablebase
 * Faster than full query, useful for quick analysis
 * 
 * @param {string} fen - Chess position in FEN notation
 * @param {string} variant - Variant: 'standard', 'atomic', 'antichess'
 * @returns {Promise<Object>} Mainline analysis
 */
async function queryTablebaseMainline(fen, variant = 'standard') {
  try {
    fen = normalizeFEN(fen);
    if (!isValidFEN(fen)) {
      return createErrorResponse(fen, variant, 'Invalid FEN format');
    }

    if (!VALID_VARIANTS.includes(variant)) {
      variant = 'standard';
    }

    // Check cache
    const cacheKey = `mainline:${variant}:${fen}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log(`[Tablebase] Mainline cache hit: ${variant}`);
      return cached;
    }

    console.log(`[Tablebase] Querying mainline: ${variant}`);

    // Query mainline endpoint
    const url = new URL(`${LICHESS_TABLEBASE_URL}/${variant}/mainline`);
    url.searchParams.append('fen', fen);

    const apiResponse = await fetchWithTimeout(url.toString(), QUERY_TIMEOUT_MS);

    const result = {
      fen,
      variant,
      dtz: apiResponse.dtz || null,
      mainline: apiResponse.mainline || [],
      winner: apiResponse.winner || null,
      error: null,
    };

    cache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error(`[Tablebase] Mainline error:`, error.message);
    return {
      fen,
      variant,
      mainline: [],
      error: error.message,
    };
  }
}

/**
 * Normalize Lichess API response to consistent format
 * @param {Object} apiResponse - Raw API response
 * @param {string} fen - Original FEN
 * @param {string} variant - Variant
 * @returns {Object} Normalized response
 */
function normalizeResponse(apiResponse, fen, variant) {
  return {
    fen,
    variant,
    dtz: apiResponse.dtz || null,
    precise_dtz: apiResponse.precise_dtz || null,
    dtc: apiResponse.dtc || null,
    dtm: apiResponse.dtm || null,
    dtw: apiResponse.dtw || null,
    checkmate: apiResponse.checkmate || false,
    stalemate: apiResponse.stalemate || false,
    insufficient_material: apiResponse.insufficient_material || false,
    category: apiResponse.category || null,
    variant_win: apiResponse.variant_win || false,
    variant_loss: apiResponse.variant_loss || false,
    moves: (apiResponse.moves || []).map((move) => ({
      uci: move.uci,
      san: move.san,
      dtz: move.dtz || null,
      precise_dtz: move.precise_dtz || null,
      dtc: move.dtc || null,
      dtm: move.dtm || null,
      dtw: move.dtw || null,
      zeroing: move.zeroing || false,
      checkmate: move.checkmate || false,
      stalemate: move.stalemate || false,
      variant_win: move.variant_win || false,
      variant_loss: move.variant_loss || false,
      insufficient_material: move.insufficient_material || false,
      category: move.category || null,
      wdl: move.wdl ? {
        wins: move.wdl.wins || 0,
        draws: move.wdl.draws || 0,
        losses: move.wdl.losses || 0,
      } : null,
    })),
    mainline: apiResponse.mainline || [],
    error: null,
  };
}

/**
 * Create error response object
 * @param {string} fen - FEN
 * @param {string} variant - Variant
 * @param {string} message - Error message
 * @returns {Object} Error response
 */
function createErrorResponse(fen, variant, message) {
  return {
    fen,
    variant,
    dtz: null,
    precise_dtz: null,
    dtc: null,
    dtm: null,
    dtw: null,
    checkmate: false,
    stalemate: false,
    insufficient_material: false,
    category: null,
    variant_win: false,
    variant_loss: false,
    moves: [],
    mainline: [],
    error: message,
  };
}

/**
 * Check if a position is endgame (≤7 pieces)
 * @param {string} fen - Chess position in FEN notation
 * @returns {boolean} True if endgame position
 */
function isEndgamePosition(fen) {
  if (!fen || typeof fen !== 'string') return false;

  const piecesMatch = fen.split(' ')[0].match(/[a-zA-Z]/g);
  const piecesCount = piecesMatch ? piecesMatch.length : 0;

  return piecesCount <= 7;
}

/**
 * Get cache statistics
 * @returns {Object} Cache stats
 */
function getCacheStats() {
  return cache.getStats();
}

/**
 * Clear all cache
 */
function clearCache() {
  cache.clear();
  console.log('[Tablebase] Cache cleared');
}

module.exports = {
  queryTablebase,
  queryTablebaseMainline,
  isEndgamePosition,
  cache,
  getCacheStats,
  clearCache,
  VALID_VARIANTS,
};
