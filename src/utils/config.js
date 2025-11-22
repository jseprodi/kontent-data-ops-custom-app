/**
 * Configuration management for the application
 * Centralizes all configuration constants and environment-based settings
 */

/**
 * Application configuration
 * @type {Object}
 */
export const config = {
    // API Configuration
    api: {
        baseUrl: window.location.origin,
        timeout: 3600000, // 1 hour in milliseconds
        retryAttempts: 3,
        retryDelay: 1000 // 1 second
    },
    
    // Storage Configuration
    storage: {
        keys: {
            COMMAND: 'dataOps_command',
            SOURCE_ENV: 'dataOps_sourceEnv',
            TARGET_ENV: 'dataOps_targetEnv',
            COMMAND_OPTIONS: 'dataOps_commandOptions',
            ENTITY_CACHE: 'dataOps_entityCache',
            TEMPLATES: 'dataOps_templates',
            COMMAND_HISTORY: 'dataOps_commandHistory',
            ENVIRONMENT_PROFILES: 'dataOps_environmentProfiles',
            SETTINGS: 'dataOps_settings',
            WORKFLOWS: 'dataOps_workflows'
        },
        entityCacheExpiry: 60 * 60 * 1000, // 1 hour
        maxHistoryEntries: 100
    },
    
    // UI Configuration
    ui: {
        debounceDelay: 300, // milliseconds for input debouncing
        animationDuration: 200,
        toastDuration: 5000,
        maxOutputLines: 10000, // Limit output to prevent memory issues
        virtualScrollThreshold: 1000 // Use virtual scrolling for large outputs
    },
    
    // Default Settings
    defaults: {
        autoSave: true,
        showLineNumbers: true,
        notifications: false,
        soundAlerts: false,
        maxHistory: 100,
        cacheExpiry: 1,
        theme: 'light',
        fontSize: 'medium'
    },
    
    // Performance Configuration
    performance: {
        enableLazyLoading: true,
        enableVirtualScrolling: true,
        batchSize: 100, // Process items in batches
        throttleDelay: 100 // Throttle frequent updates
    },
    
    // Feature Flags
    features: {
        enableWorkflows: true,
        enableStatistics: true,
        enableTemplates: true,
        enableHistory: true
    }
};

/**
 * Get configuration value by path
 * @param {string} path - Dot-separated path to config value (e.g., 'api.timeout')
 * @param {*} defaultValue - Default value if path not found
 * @returns {*} Configuration value
 */
export function getConfig(path, defaultValue = undefined) {
    const keys = path.split('.');
    let value = config;
    
    for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
            value = value[key];
        } else {
            return defaultValue;
        }
    }
    
    return value;
}

/**
 * Set configuration value by path
 * @param {string} path - Dot-separated path to config value
 * @param {*} value - Value to set
 */
export function setConfig(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let target = config;
    
    for (const key of keys) {
        if (!target[key] || typeof target[key] !== 'object') {
            target[key] = {};
        }
        target = target[key];
    }
    
    target[lastKey] = value;
}

/**
 * Check if a feature is enabled
 * @param {string} featureName - Name of the feature
 * @returns {boolean} True if feature is enabled
 */
export function isFeatureEnabled(featureName) {
    return getConfig(`features.${featureName}`, false);
}

