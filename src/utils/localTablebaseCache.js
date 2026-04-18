/**
 * Local Tablebase Cache - Enables offline tablebase support
 * Stores queried tablebase results locally for offline access
 */

const LOCAL_CACHE_KEY = 'chessweb_tablebase_cache';
const MAX_CACHE_SIZE = 200; // Maximum positions to cache

/**
 * Get cached tablebase result
 * @param {string} fen - Chess position
 * @param {string} variant - Tablebase variant
 * @returns {Object|null} Cached result or null
 */
export function getCachedResult(fen, variant = 'standard') {
  try {
    const cache = JSON.parse(localStorage.getItem(LOCAL_CACHE_KEY) || '{}');
    const key = `${variant}:${fen}`;
    return cache[key] || null;
  } catch (e) {
    console.error('[LocalTablebase] Error reading cache:', e);
    return null;
  }
}

/**
 * Cache a tablebase result locally
 * @param {string} fen - Chess position
 * @param {string} variant - Tablebase variant
 * @param {Object} result - Tablebase result to cache
 */
export function cacheResult(fen, variant = 'standard', result) {
  try {
    const cache = JSON.parse(localStorage.getItem(LOCAL_CACHE_KEY) || '{}');
    const key = `${variant}:${fen}`;

    // Implement simple LRU: if cache is full, remove oldest entry
    const entries = Object.entries(cache);
    if (entries.length >= MAX_CACHE_SIZE && !cache[key]) {
      // Remove first entry
      delete cache[Object.keys(cache)[0]];
    }

    cache[key] = {
      ...result,
      cachedAt: new Date().toISOString(),
      source: 'local'
    };

    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.error('[LocalTablebase] Error caching result:', e);
  }
}

/**
 * Clear all local cache
 */
export function clearLocalCache() {
  try {
    localStorage.removeItem(LOCAL_CACHE_KEY);
  } catch (e) {
    console.error('[LocalTablebase] Error clearing cache:', e);
  }
}

/**
 * Get cache statistics
 * @returns {Object} Cache statistics
 */
export function getCacheStats() {
  try {
    const cache = JSON.parse(localStorage.getItem(LOCAL_CACHE_KEY) || '{}');
    const entries = Object.entries(cache);
    return {
      totalCached: entries.length,
      maxSize: MAX_CACHE_SIZE,
      percentFull: ((entries.length / MAX_CACHE_SIZE) * 100).toFixed(1),
      cacheSize: new Blob([JSON.stringify(cache)]).size,
    };
  } catch (e) {
    return {
      totalCached: 0,
      maxSize: MAX_CACHE_SIZE,
      percentFull: 0,
      cacheSize: 0,
    };
  }
}

/**
 * Export cache as JSON
 * @returns {string} JSON string of cache
 */
export function exportLocalCache() {
  try {
    const cache = localStorage.getItem(LOCAL_CACHE_KEY) || '{}';
    return cache;
  } catch (e) {
    console.error('[LocalTablebase] Error exporting cache:', e);
    return '{}';
  }
}

/**
 * Import cache from JSON
 * @param {string} jsonData - JSON string of cache
 * @returns {boolean} Success status
 */
export function importLocalCache(jsonData) {
  try {
    const cache = JSON.parse(jsonData);
    if (typeof cache !== 'object') return false;
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(cache));
    return true;
  } catch (e) {
    console.error('[LocalTablebase] Error importing cache:', e);
    return false;
  }
}
