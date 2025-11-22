/**
 * Validation utilities
 * Provides common validation functions for inputs
 */

/**
 * Validate UUID format
 * @param {string} uuid - UUID string to validate
 * @returns {boolean} True if valid UUID
 */
export function isValidUUID(uuid) {
    if (!uuid || typeof uuid !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid.trim());
}

/**
 * Validate API key format (basic check)
 * @param {string} apiKey - API key to validate
 * @param {number} minLength - Minimum length (default: 10)
 * @returns {boolean} True if valid format
 */
export function isValidApiKey(apiKey, minLength = 10) {
    if (!apiKey || typeof apiKey !== 'string') return false;
    return apiKey.trim().length >= minLength;
}

/**
 * Validate file path (prevent directory traversal)
 * @param {string} filePath - File path to validate
 * @param {number} maxLength - Maximum path length (default: 500)
 * @returns {boolean} True if valid path
 */
export function isValidFilePath(filePath, maxLength = 500) {
    if (!filePath || typeof filePath !== 'string') return false;
    const normalized = filePath.trim();
    return normalized.length > 0 && 
           normalized.length < maxLength && 
           !normalized.includes('..') &&
           !normalized.includes('\0');
}

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid URL
 */
export function isValidUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * Sanitize input string
 * @param {string} input - Input to sanitize
 * @returns {string} Sanitized string
 */
export function sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    return input.trim().replace(/[<>]/g, ''); // Remove potential HTML tags
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email
 */
export function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
}

/**
 * Validate command structure
 * @param {string} command - Command string to validate
 * @returns {boolean} True if valid command format
 */
export function isValidCommand(command) {
    if (!command || typeof command !== 'string') return false;
    const parts = command.trim().split(' ');
    return parts.length >= 2 && parts.length <= 3;
}

/**
 * Validate environment ID
 * @param {string} envId - Environment ID to validate
 * @returns {Object} { valid: boolean, error?: string }
 */
export function validateEnvironmentId(envId) {
    if (!envId) {
        return { valid: false, error: 'Environment ID is required' };
    }
    if (!isValidUUID(envId)) {
        return { valid: false, error: 'Environment ID must be a valid UUID' };
    }
    return { valid: true };
}

/**
 * Validate API key
 * @param {string} apiKey - API key to validate
 * @returns {Object} { valid: boolean, error?: string }
 */
export function validateApiKey(apiKey) {
    if (!apiKey) {
        return { valid: false, error: 'API key is required' };
    }
    if (!isValidApiKey(apiKey)) {
        return { valid: false, error: 'API key appears to be invalid' };
    }
    return { valid: true };
}

