// Centralized API cache utility
class APICache {
    constructor() {
        this.cache = new Map();
        this.defaultTTL = 5 * 60 * 1000; // 5 minutes
    }

    // Generate cache key from URL and options
    generateKey(url, options = {}) {
        return url + JSON.stringify(options);
    }

    // Get cached data if valid
    get(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < cached.ttl) {
            return cached.data;
        }
        if (cached) {
            this.cache.delete(key); // Remove expired entry
        }
        return null;
    }

    // Set cache entry
    set(key, data, ttl = this.defaultTTL) {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl
        });
    }

    // Clear cache by pattern
    clear(pattern) {
        for (const [key] of this.cache) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
            }
        }
    }

    // Clear all cache
    clearAll() {
        this.cache.clear();
    }

    // Get cache stats
    getStats() {
        const now = Date.now();
        let valid = 0;
        let expired = 0;
        
        for (const [key, value] of this.cache) {
            if (now - value.timestamp < value.ttl) {
                valid++;
            } else {
                expired++;
            }
        }
        
        return { valid, expired, total: this.cache.size };
    }
}

// Global cache instance
const apiCache = new APICache();

// Cached fetch function
async function cachedFetch(url, options = {}) {
    const key = apiCache.generateKey(url, options);
    const cached = apiCache.get(key);
    
    if (cached) {
        console.log(`Cache hit for ${url}`);
        return cached;
    }
    
    try {
        console.log(`Cache miss for ${url}, fetching...`);
        const response = await fetch(url, options);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Cache successful responses
        apiCache.set(key, data);
        
        return data;
    } catch (error) {
        console.error(`API call failed for ${url}:`, error);
        throw error;
    }
}

// Export for global use
window.apiCache = apiCache;
window.cachedFetch = cachedFetch; 