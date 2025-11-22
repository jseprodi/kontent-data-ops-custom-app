/**
 * Performance optimization utilities
 * Provides debouncing, throttling, and lazy loading helpers
 */

/**
 * Debounce function - delays execution until after wait time has passed
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @param {boolean} immediate - Execute immediately on first call
 * @returns {Function} Debounced function
 */
export function debounce(func, wait = 300, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func(...args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func(...args);
    };
}

/**
 * Throttle function - limits execution to once per wait time
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(func, limit = 100) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Batch processor - processes items in batches to avoid blocking
 * @param {Array} items - Items to process
 * @param {Function} processor - Function to process each item
 * @param {number} batchSize - Number of items per batch
 * @param {Function} onProgress - Callback for progress updates
 * @returns {Promise} Promise that resolves when all items are processed
 */
export async function processBatch(items, processor, batchSize = 100, onProgress = null) {
    const results = [];
    const total = items.length;
    let processed = 0;
    
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(processor));
        results.push(...batchResults);
        processed += batch.length;
        
        if (onProgress) {
            onProgress(processed, total);
        }
        
        // Yield to browser to prevent blocking
        await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    return results;
}

/**
 * Lazy load images or other resources
 * @param {string} selector - CSS selector for elements to lazy load
 * @param {Object} options - Intersection Observer options
 */
export function setupLazyLoading(selector = 'img[data-src]', options = {}) {
    if (!('IntersectionObserver' in window)) {
        // Fallback for browsers without IntersectionObserver
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            if (el.dataset.src) {
                el.src = el.dataset.src;
            }
        });
        return;
    }
    
    const defaultOptions = {
        root: null,
        rootMargin: '50px',
        threshold: 0.01
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const element = entry.target;
                if (element.dataset.src) {
                    element.src = element.dataset.src;
                    element.removeAttribute('data-src');
                }
                observer.unobserve(element);
            }
        });
    }, { ...defaultOptions, ...options });
    
    document.querySelectorAll(selector).forEach(el => observer.observe(el));
}

/**
 * Virtual scrolling helper - calculates visible range
 * @param {number} scrollTop - Current scroll position
 * @param {number} itemHeight - Height of each item
 * @param {number} containerHeight - Height of container
 * @param {number} totalItems - Total number of items
 * @param {number} buffer - Buffer items to render outside viewport
 * @returns {Object} { start, end, offset }
 */
export function calculateVisibleRange(scrollTop, itemHeight, containerHeight, totalItems, buffer = 5) {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
    const end = Math.min(totalItems, Math.ceil((scrollTop + containerHeight) / itemHeight) + buffer);
    const offset = start * itemHeight;
    
    return { start, end, offset };
}

/**
 * Request animation frame wrapper for smooth animations
 * @param {Function} callback - Function to call on next frame
 * @returns {number} Request ID for cancellation
 */
export function requestAnimationFrame(callback) {
    if (window.requestAnimationFrame) {
        return window.requestAnimationFrame(callback);
    }
    // Fallback for older browsers
    return setTimeout(callback, 16);
}

/**
 * Cancel animation frame
 * @param {number} id - Request ID from requestAnimationFrame
 */
export function cancelAnimationFrame(id) {
    if (window.cancelAnimationFrame) {
        window.cancelAnimationFrame(id);
    } else {
        clearTimeout(id);
    }
}

