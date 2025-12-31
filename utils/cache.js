const NodeCache = require('node-cache');

// Create cache instance with TTL from env or default 1 hour
const cache = new NodeCache({
    stdTTL: parseInt(process.env.CACHE_TTL) || 3600,
    checkperiod: 600, // Check for expired entries every 10 minutes
    useClones: false // Better performance
});

/**
 * Get value from cache
 * @param {string} key - Cache key
 * @returns {any} Cached value or undefined
 */
function getCache(key) {
    return cache.get(key);
}

/**
 * Set value in cache
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in seconds (optional)
 * @returns {boolean} Success status
 */
function setCache(key, value, ttl) {
    return cache.set(key, value, ttl);
}

/**
 * Delete value from cache
 * @param {string} key - Cache key
 * @returns {number} Number of deleted entries
 */
function deleteCache(key) {
    return cache.del(key);
}

/**
 * Clear all cache
 * @returns {void}
 */
function clearCache() {
    cache.flushAll();
}

/**
 * Get cache stats
 * @returns {Object} Cache statistics
 */
function getCacheStats() {
    return cache.getStats();
}

// Log cache stats every 5 minutes
setInterval(() => {
    const stats = getCacheStats();
    console.log('📊 Cache Stats:', {
        keys: stats.keys,
        hits: stats.hits,
        misses: stats.misses,
        hitRate: stats.hits > 0 ? ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(2) + '%' : '0%'
    });
}, 5 * 60 * 1000);

module.exports = {
    getCache,
    setCache,
    deleteCache,
    clearCache,
    getCacheStats
};
