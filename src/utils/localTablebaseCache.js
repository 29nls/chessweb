/**
 * Local Tablebase Cache - Enables offline tablebase support
 * Stores queried tablebase results locally for offline access
 * Implements LRU eviction when storage quota exceeded
 */

const LOCAL_CACHE_KEY = 'chessweb_tablebase_cache';
const LOCAL_METADATA_KEY = 'chessweb_tablebase_metadata';
const MAX_CACHE_ENTRIES = 500; // Maximum positions to cache
const MAX_CACHE_SIZE_MB = 10; // Maximum cache size in MB

/**
 * Get storage quota information
 * @returns {Promise<Object>} Storage quota info
 */
export async function getStorageQuota() {
  try {
    if (!navigator.storage || !navigator.storage.estimate) {
      return { available: false, usage: 0, quota: 0 };
    }
    const estimate = await navigator.storage.estimate();
    return {
      available: true,
      usage: estimate.usage,
      quota: estimate.quota,
      percentUsed: ((estimate.usage / estimate.quota) * 100).toFixed(1),
    };
  } catch (e) {
    console.error('[LocalTablebase] Error getting storage quota:', e);
    return { available: false, usage: 0, quota: 0 };
  }
}

/**
 * Normalize cache key
 * @param {string} fen - Chess position
 * @param {string} variant - Tablebase variant
 * @returns {string} Cache key
 */
function getCacheKey(fen, variant = 'standard') {
  return `${variant}:${fen}`;
}

/**
 * Get cached tablebase result
 * @param {string} fen - Chess position
 * @param {string} variant - Tablebase variant
 * @returns {Object|null} Cached result or null
 */
export function getCachedResult(fen, variant = 'standard') {
  try {
    const cache = JSON.parse(localStorage.getItem(LOCAL_CACHE_KEY) || '{}');
    const key = getCacheKey(fen, variant);
    const entry = cache[key];

    if (!entry) return null;

    // Update access time (for LRU)
    entry.lastAccessed = Date.now();
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(cache));

    return entry.data;
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
 * @returns {boolean} Success indicator
 */
export function cacheResult(fen, variant = 'standard', result) {
  try {
    const cache = JSON.parse(localStorage.getItem(LOCAL_CACHE_KEY) || '{}');
    const key = getCacheKey(fen, variant);

    // Skip caching errors
    if (result && result.error) {
      console.log(`[LocalTablebase] Skipping cache for error result: ${result.error}`);
      return false;
    }

    // Implement LRU eviction if needed
    const entries = Object.entries(cache);
    if (entries.length >= MAX_CACHE_ENTRIES && !cache[key]) {
      // Find least recently used entry
      let lruKey = null;
      let lruTime = Infinity;
      entries.forEach(([k, v]) => {
        if ((v.lastAccessed || 0) < lruTime) {
          lruTime = v.lastAccessed || 0;
          lruKey = k;
        }
      });
      if (lruKey) {
        delete cache[lruKey];
      }
    }

    // Store with metadata
    cache[key] = {
      data: result,
      cachedAt: new Date().toISOString(),
      lastAccessed: Date.now(),
      source: 'local',
    };

    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(cache));
    return true;
  } catch (e) {
    // Handle quota exceeded
    if (e.name === 'QuotaExceededError') {
      console.warn('[LocalTablebase] LocalStorage quota exceeded, clearing oldest entries');
      clearOldestEntries(Math.ceil(MAX_CACHE_ENTRIES * 0.2)); // Clear 20%
      return cacheResult(fen, variant, result); // Retry
    }
    console.error('[LocalTablebase] Error caching result:', e);
    return false;
  }
}

/**
 * Clear oldest cache entries
 * @param {number} count - Number of entries to remove
 */
function clearOldestEntries(count = 50) {
  try {
    const cache = JSON.parse(localStorage.getItem(LOCAL_CACHE_KEY) || '{}');
    const entries = Object.entries(cache)
      .sort(([, a], [, b]) => (a.lastAccessed || 0) - (b.lastAccessed || 0))
      .slice(count);
    
    const newCache = Object.fromEntries(entries);
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(newCache));
    console.log(`[LocalTablebase] Cleared ${count} oldest entries`);
  } catch (e) {
    console.error('[LocalTablebase] Error clearing entries:', e);
  }
}

/**
 * Clear all local cache
 */
export function clearLocalCache() {
  try {
    localStorage.removeItem(LOCAL_CACHE_KEY);
    localStorage.removeItem(LOCAL_METADATA_KEY);
    console.log('[LocalTablebase] Cache cleared');
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
    const cacheSize = new Blob([JSON.stringify(cache)]).size;
    
    return {
      totalCached: entries.length,
      maxEntries: MAX_CACHE_ENTRIES,
      percentFull: ((entries.length / MAX_CACHE_ENTRIES) * 100).toFixed(1),
      cacheSizeKB: (cacheSize / 1024).toFixed(2),
      maxSizeMB: MAX_CACHE_SIZE_MB,
      variants: [...new Set(entries.map(([k]) => k.split(':')[0]))],
    };
  } catch (e) {
    return {
      totalCached: 0,
      maxEntries: MAX_CACHE_ENTRIES,
      percentFull: 0,
      cacheSizeKB: 0,
      maxSizeMB: MAX_CACHE_SIZE_MB,
      variants: [],
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
    const stats = getCacheStats();
    return JSON.stringify({
      exported: new Date().toISOString(),
      stats,
      data: JSON.parse(cache),
    }, null, 2);
  } catch (e) {
    console.error('[LocalTablebase] Error exporting cache:', e);
    return '{}';
  }
}

/**
 * Import cache from JSON
 * @param {string} jsonData - JSON cache data
 * @returns {boolean} Success indicator
 */
export function importLocalCache(jsonData) {
  try {
    const imported = JSON.parse(jsonData);
    const data = imported.data || imported;
    
    if (typeof data !== 'object') {
      throw new Error('Invalid cache format');
    }

    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(data));
    console.log('[LocalTablebase] Cache imported successfully');
    return true;
  } catch (e) {
    console.error('[LocalTablebase] Error importing cache:', e);
    return false;
  }
}

/**
 * Get cache by variant
 * @param {string} variant - Tablebase variant
 * @returns {Array} Array of cached results for variant
 */
export function getCacheByVariant(variant = 'standard') {
  try {
    const cache = JSON.parse(localStorage.getItem(LOCAL_CACHE_KEY) || '{}');
    return Object.entries(cache)
      .filter(([k]) => k.startsWith(`${variant}:`))
      .map(([, v]) => v.data);
  } catch (e) {
    console.error('[LocalTablebase] Error getting variant cache:', e);
    return [];
  }
}
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
