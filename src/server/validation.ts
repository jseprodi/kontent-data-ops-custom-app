/**
 * Validation utilities for server-side operations
 */

import path from 'path';
import type { CommandOptions, ValidationResult } from '../types/index.js';

/**
 * Sanitize input string
 */
export function sanitizeInput(input: unknown): unknown {
    if (typeof input !== 'string') return input;
    // Remove potentially dangerous characters but allow valid paths and UUIDs
    return input.trim();
}

/**
 * Validate environment ID (UUID format)
 */
export function validateEnvironmentId(envId: unknown): boolean {
    if (!envId || typeof envId !== 'string') return false;
    // UUID format validation (basic)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(envId.trim());
}

/**
 * Validate API key format
 */
export function validateApiKey(apiKey: unknown, minLength = 10): boolean {
    if (!apiKey || typeof apiKey !== 'string') return false;
    // API keys are typically long strings, check minimum length
    return apiKey.trim().length >= minLength;
}

/**
 * Validate file path (prevent directory traversal)
 */
export function validateFilePath(filePath: unknown, maxLength = 500): boolean {
    if (!filePath || typeof filePath !== 'string') return false;
    // Basic path validation - no directory traversal
    const normalized = path.normalize(filePath);
    return !normalized.includes('..') && normalized.length > 0 && normalized.length < maxLength;
}

/**
 * Validate command options structure
 */
export function validateCommandOptions(command: string, options: CommandOptions): ValidationResult {
    // Commands are structured as "environment backup", "sync run", etc.
    const commandParts = command.split(' ');
    const mainCommand = commandParts[0];
    const subCommand = commandParts[1];
    
    // Validate based on command structure
    if (mainCommand === 'environment') {
        if (subCommand === 'backup') {
            if (!options.environmentId || !options.apiKey) {
                return { valid: false, message: 'environmentId and apiKey are required for environment backup' };
            }
        } else if (subCommand === 'restore') {
            if (!options.environmentId || !options.apiKey || !options.fileName) {
                return { valid: false, message: 'environmentId, apiKey, and fileName are required for environment restore' };
            }
        } else if (subCommand === 'clean') {
            if (!options.environmentId || !options.apiKey) {
                return { valid: false, message: 'environmentId and apiKey are required for environment clean' };
            }
        }
    } else if (mainCommand === 'sync') {
        if (subCommand === 'run') {
            if (!options.targetEnvironmentId || !options.targetApiKey || !options.entities || !Array.isArray(options.entities) || options.entities.length === 0) {
                return { valid: false, message: 'targetEnvironmentId, targetApiKey, and entities are required for sync run' };
            }
            if (!options.sourceEnvironmentId && !options.folderName) {
                return { valid: false, message: 'Either sourceEnvironmentId+sourceApiKey or folderName is required for sync run' };
            }
            if (options.sourceEnvironmentId && !options.sourceApiKey) {
                return { valid: false, message: 'sourceApiKey is required when using sourceEnvironmentId' };
            }
        } else if (subCommand === 'snapshot') {
            if (!options.environmentId || !options.apiKey || !options.entities || !Array.isArray(options.entities) || options.entities.length === 0) {
                return { valid: false, message: 'environmentId, apiKey, and entities are required for sync snapshot' };
            }
        } else if (subCommand === 'diff') {
            if (!options.targetEnvironmentId || !options.targetApiKey) {
                return { valid: false, message: 'targetEnvironmentId and targetApiKey are required for sync diff' };
            }
            if (!options.sourceEnvironmentId && !options.folderName) {
                return { valid: false, message: 'Either sourceEnvironmentId+sourceApiKey or folderName is required for sync diff' };
            }
            if (options.sourceEnvironmentId && !options.sourceApiKey) {
                return { valid: false, message: 'sourceApiKey is required when using sourceEnvironmentId' };
            }
            // If advanced is enabled, outPath is required
            if (options.advanced && (!options.outPath || (typeof options.outPath === 'string' && options.outPath.trim() === ''))) {
                return { valid: false, message: 'outPath is required when advanced option is enabled' };
            }
        }
    } else if (mainCommand === 'migrate-content' || mainCommand === 'migrations') {
        // Migration commands validation would go here
        // For now, we'll be lenient and let the CLI validate
        return { valid: true };
    } else {
        return { valid: false, message: `Unknown command: ${command}` };
    }
    
    return { valid: true };
}

/**
 * Enhanced validation for command options
 */
export function validateAndSanitizeOptions(_command: string, options: CommandOptions): CommandOptions {
    const sanitized: CommandOptions = {};
    const errors: string[] = [];
    
    for (const [key, value] of Object.entries(options)) {
        // Skip internal options
        if (key.startsWith('_')) {
            sanitized[key] = value;
            continue;
        }
        
        // Sanitize string values
        if (typeof value === 'string') {
            sanitized[key] = sanitizeInput(value) as string;
        } else {
            sanitized[key] = value;
        }
        
        // Validate specific field types
        if (key.toLowerCase().includes('environmentid') || key.toLowerCase().includes('environment_id')) {
            if (value && !validateEnvironmentId(value)) {
                errors.push(`${key} must be a valid UUID format`);
            }
        }
        
        if (key.toLowerCase().includes('apikey') || key.toLowerCase().includes('api_key')) {
            if (value && !validateApiKey(value)) {
                errors.push(`${key} appears to be invalid`);
            }
        }
        
        if (key.toLowerCase().includes('filename') || key.toLowerCase().includes('file_name') || 
            key.toLowerCase().includes('outpath') || key.toLowerCase().includes('folder')) {
            if (value && !validateFilePath(value)) {
                errors.push(`${key} contains invalid characters or path traversal attempt`);
            }
        }
    }
    
    if (errors.length > 0) {
        throw new Error(`Validation errors: ${errors.join(', ')}`);
    }
    
    return sanitized;
}

