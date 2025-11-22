/**
 * Error handling utilities
 * Provides consistent error handling and user-friendly error messages
 */

/**
 * Custom error class for application errors
 */
export class AppError extends Error {
    constructor(message, code = 'UNKNOWN_ERROR', details = null) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.details = details;
        this.timestamp = new Date().toISOString();
    }
}

/**
 * Error codes
 */
export const ErrorCodes = {
    NETWORK_ERROR: 'NETWORK_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    API_ERROR: 'API_ERROR',
    COMMAND_ERROR: 'COMMAND_ERROR',
    STORAGE_ERROR: 'STORAGE_ERROR',
    PERMISSION_ERROR: 'PERMISSION_ERROR',
    TIMEOUT_ERROR: 'TIMEOUT_ERROR',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

/**
 * Get user-friendly error message
 * @param {Error|AppError} error - Error object
 * @returns {Object} { message: string, solution: string }
 */
export function getErrorMessage(error) {
    if (error instanceof AppError) {
        return {
            message: error.message,
            solution: getErrorSolution(error.code),
            code: error.code,
            details: error.details
        };
    }
    
    // Handle standard errors
    const errorMessage = error.message || 'An unexpected error occurred';
    let solution = 'Please try again. If the problem persists, check the console for details.';
    
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        solution = 'Please check your internet connection and try again.';
    } else if (errorMessage.includes('timeout')) {
        solution = 'The operation is taking longer than expected. Please try again.';
    } else if (errorMessage.includes('permission') || errorMessage.includes('401')) {
        solution = 'Please check your API keys and permissions.';
    } else if (errorMessage.includes('not found') || errorMessage.includes('404')) {
        solution = 'The requested resource was not found. Please verify your configuration.';
    }
    
    return {
        message: errorMessage,
        solution: solution,
        code: ErrorCodes.UNKNOWN_ERROR
    };
}

/**
 * Get solution for error code
 * @param {string} code - Error code
 * @returns {string} Solution message
 */
function getErrorSolution(code) {
    const solutions = {
        [ErrorCodes.NETWORK_ERROR]: 'Please check your internet connection and try again.',
        [ErrorCodes.VALIDATION_ERROR]: 'Please check your input and try again.',
        [ErrorCodes.API_ERROR]: 'There was an error communicating with the API. Please verify your API keys and try again.',
        [ErrorCodes.COMMAND_ERROR]: 'The command execution failed. Please check the error details and try again.',
        [ErrorCodes.STORAGE_ERROR]: 'There was an error accessing local storage. Please check your browser settings.',
        [ErrorCodes.PERMISSION_ERROR]: 'You do not have permission to perform this action. Please check your API keys.',
        [ErrorCodes.TIMEOUT_ERROR]: 'The operation timed out. Please try again or check if the operation completed.',
        [ErrorCodes.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again or contact support.'
    };
    
    return solutions[code] || solutions[ErrorCodes.UNKNOWN_ERROR];
}

/**
 * Log error with context
 * @param {Error|AppError} error - Error to log
 * @param {Object} context - Additional context
 */
export function logError(error, context = {}) {
    const errorInfo = {
        message: error.message,
        stack: error.stack,
        code: error.code || ErrorCodes.UNKNOWN_ERROR,
        timestamp: new Date().toISOString(),
        context: context
    };
    
    console.error('Application Error:', errorInfo);
    
    // Could send to error tracking service here
    // Example: errorTrackingService.log(errorInfo);
}

/**
 * Handle promise rejection
 * @param {Promise} promise - Promise to handle
 * @param {Function} onError - Error handler
 * @returns {Promise} Handled promise
 */
export function handlePromiseRejection(promise, onError = null) {
    return promise.catch(error => {
        logError(error);
        if (onError) {
            onError(error);
        }
        throw error;
    });
}

