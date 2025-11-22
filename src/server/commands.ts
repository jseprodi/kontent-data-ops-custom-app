/**
 * Command building and execution utilities
 */

import type { CommandOptions } from '../types/index.js';

/**
 * Build arguments for data-ops CLI
 * Commands are structured as: data-ops <command> <subcommand> [options]
 */
export function buildDataOpsArgs(command: string, options: CommandOptions): string[] {
    // Commands are structured like: "environment backup", "sync run", etc.
    // Split the command into parts
    const commandParts = command.split(' ');
    const args: string[] = [...commandParts];
    
    // Convert options to CLI arguments
    // Convert camelCase to kebab-case and handle special cases
    Object.entries(options).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
            // Skip internal options
            if (key.startsWith('_')) return;
            
            // Convert camelCase to kebab-case
            const kebabKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
            
            if (typeof value === 'boolean') {
                if (value) {
                    args.push(`--${kebabKey}`);
                }
            } else if (Array.isArray(value)) {
                // For arrays, repeat the flag for each value (data-ops CLI expects multiple --entity flags)
                value.forEach(v => {
                    args.push(`--${kebabKey}`, String(v));
                });
            } else if (typeof value === 'object') {
                // Skip objects, they're not valid CLI arguments
                return;
            } else {
                args.push(`--${kebabKey}`, String(value));
            }
        }
    });
    
    return args;
}

