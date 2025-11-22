/**
 * Storage utilities
 * Provides safe localStorage operations with error handling
 */

/**
 * Get item from localStorage with error handling
 * @param {string} key - Storage key
 * @param {*} defaultValue - Default value if key doesn't exist
 * @returns {*} Stored value or default
 */
export function getStorageItem(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        if (item === null) return defaultValue;
        return JSON.parse(item);
    } catch (error) {
        console.error(`Error reading from localStorage (${key}):`, error);
        return defaultValue;
    }
}

/**
 * Set item in localStorage with error handling
 * @param {string} key - Storage key
 * @param {*} value - Value to store
 * @returns {boolean} True if successful
 */
export function setStorageItem(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error(`Error writing to localStorage (${key}):`, error);
        // Handle quota exceeded error
        if (error.name === 'QuotaExceededError') {
            console.warn('localStorage quota exceeded. Clearing old data...');
            // Could implement LRU cache cleanup here
        }
        return false;
    }
}

/**
 * Remove item from localStorage
 * @param {string} key - Storage key
 * @returns {boolean} True if successful
 */
export function removeStorageItem(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        console.error(`Error removing from localStorage (${key}):`, error);
        return false;
    }
}

/**
 * Clear all localStorage items with a specific prefix
 * @param {string} prefix - Key prefix
 * @returns {number} Number of items removed
 */
export function clearStorageByPrefix(prefix) {
    let count = 0;
    try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && key.startsWith(prefix)) {
                localStorage.removeItem(key);
                count++;
            }
        }
    } catch (error) {
        console.error(`Error clearing storage with prefix (${prefix}):`, error);
    }
    return count;
}

/**
 * Get storage size estimate
 * @returns {Object} { used: number, available: number, percentage: number }
 */
export function getStorageSize() {
    try {
        let used = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                used += localStorage[key].length + key.length;
            }
        }
        
        // Estimate available (most browsers have ~5-10MB limit)
        const estimatedLimit = 5 * 1024 * 1024; // 5MB
        const available = Math.max(0, estimatedLimit - used);
        const percentage = (used / estimatedLimit) * 100;
        
        return {
            used,
            available,
            percentage: Math.min(100, percentage),
            usedFormatted: formatBytes(used),
            availableFormatted: formatBytes(available)
        };
    } catch (error) {
        console.error('Error calculating storage size:', error);
        return { used: 0, available: 0, percentage: 0 };
    }
}

/**
 * Format bytes to human-readable string
 * @param {number} bytes - Bytes to format
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

