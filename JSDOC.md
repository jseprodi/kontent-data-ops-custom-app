# JSDoc Documentation Standards

This document outlines the JSDoc standards used in this project.

## Basic Function Documentation

```javascript
/**
 * Brief description of what the function does
 * @param {string} paramName - Description of parameter
 * @param {number} [optionalParam] - Optional parameter
 * @returns {boolean} Description of return value
 * @throws {Error} When something goes wrong
 */
```

## Example Documentation

### Simple Function
```javascript
/**
 * Validates if a string is a valid UUID
 * @param {string} uuid - UUID string to validate
 * @returns {boolean} True if valid UUID format
 */
export function isValidUUID(uuid) {
    // implementation
}
```

### Complex Function
```javascript
/**
 * Processes items in batches to avoid blocking the UI
 * @param {Array} items - Items to process
 * @param {Function} processor - Function to process each item
 * @param {number} [batchSize=100] - Number of items per batch
 * @param {Function} [onProgress] - Callback for progress updates (processed, total)
 * @returns {Promise<Array>} Promise that resolves with all processed results
 * @throws {TypeError} If items is not an array
 */
export async function processBatch(items, processor, batchSize = 100, onProgress = null) {
    // implementation
}
```

### Class Documentation
```javascript
/**
 * Logger class for application logging
 * @class
 */
class Logger {
    /**
     * Creates a new Logger instance
     * @constructor
     */
    constructor() {
        // implementation
    }
    
    /**
     * Logs a message at the specified level
     * @param {string} level - Log level (INFO, ERROR, WARNING, SUCCESS)
     * @param {string} message - Log message
     * @param {*} [data] - Optional data to log
     */
    log(level, message, data = null) {
        // implementation
    }
}
```

## Type Definitions

### Object Types
```javascript
/**
 * @typedef {Object} ConfigOptions
 * @property {string} apiKey - API key for authentication
 * @property {number} [timeout=5000] - Request timeout in milliseconds
 * @property {boolean} [retry=true] - Whether to retry on failure
 */

/**
 * Initializes the API client
 * @param {ConfigOptions} options - Configuration options
 */
function initApiClient(options) {
    // implementation
}
```

## Best Practices

1. **Always document public functions** - Functions exported from modules should have JSDoc
2. **Describe parameters** - Include type and description for all parameters
3. **Document return values** - Always document what the function returns
4. **Note side effects** - Document if function modifies state or has side effects
5. **Include examples** - For complex functions, include usage examples
6. **Document errors** - Use @throws for functions that can throw errors

## Generating Documentation

To generate HTML documentation from JSDoc comments:

```bash
npm install -g jsdoc
jsdoc src/ -d docs/
```

Or use a tool like TypeDoc for TypeScript-style documentation.

