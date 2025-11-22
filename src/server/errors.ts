/**
 * Error handling utilities
 */

/**
 * Get user-friendly error solution based on error message
 */
export function getErrorSolution(error: unknown): string {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes('not found') || errorMessage.includes('ENOENT')) {
        return 'Please ensure the data-ops CLI is installed and accessible in your PATH, or set the DATA_OPS_CLI_PATH environment variable.';
    }
    
    if (errorMessage.includes('required')) {
        return 'Please ensure all required fields are filled in correctly.';
    }
    
    if (errorMessage.includes('permission')) {
        return 'Please check file permissions and ensure you have the necessary access rights.';
    }
    
    return 'Please check the error message and try again. If the issue persists, review the logs for more details.';
}

