/**
 * Command execution utilities
 */

import { execa } from 'execa';
import type { ExecaChildProcess } from 'execa';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { CommandOptions } from '../types/index.js';
import { buildDataOpsArgs } from './commands.js';
import { validateAndSanitizeOptions, validateCommandOptions } from './validation.js';
import { ServerLogger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

// Data-Ops CLI path - use the built version from local repo
const DATA_OPS_CLI = process.env.DATA_OPS_CLI_PATH || 
    path.join(PROJECT_ROOT, 'data-ops', 'build', 'src', 'index.js');

const logger = new ServerLogger();

/**
 * Execute data-ops command using Node.js
 */
export async function executeDataOpsCommand(
    command: string, 
    options: CommandOptions
): Promise<ExecaChildProcess<string> & { stdout: NodeJS.ReadableStream; stderr: NodeJS.ReadableStream }> {
    try {
        // Validate and sanitize options
        const sanitizedOptions = validateAndSanitizeOptions(command, options);
        
        // Validate command structure
        const validation = validateCommandOptions(command, sanitizedOptions);
        if (!validation.valid) {
            throw new Error(validation.message || 'Invalid command options');
        }
        
        // Verify CLI exists
        try {
            await fs.access(DATA_OPS_CLI);
        } catch (error) {
            throw new Error(
                `Data-ops CLI not found at ${DATA_OPS_CLI}. ` +
                `Please ensure the data-ops repository is built. Run: cd data-ops && npm run build`
            );
        }
        
        // Build command arguments
        const args = buildDataOpsArgs(command, sanitizedOptions);
        
        logger.info(`Executing: node ${DATA_OPS_CLI} ${args.join(' ')}`);
        
        // Execute command with streaming output using node to run the built JS file
        // When buffer: false, stdout and stderr are ReadableStreams
        const childProcess = execa('node', [DATA_OPS_CLI, ...args], {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: PROJECT_ROOT, // Run from project root
            timeout: 3600000, // 1 hour timeout for long-running operations
            killSignal: 'SIGTERM',
            buffer: false // Enable streaming - this makes stdout/stderr streams
        });
        
        // Type assertion: when buffer is false, stdout/stderr are streams and childProcess has EventEmitter methods
        return childProcess as ExecaChildProcess<string> & { 
            stdout: NodeJS.ReadableStream; 
            stderr: NodeJS.ReadableStream;
            on: (event: string, listener: (...args: unknown[]) => void) => void;
            kill: (signal?: string) => void;
            killed: boolean;
        };
    } catch (error) {
        logger.error('Failed to execute data-ops command', error);
        
        // Provide user-friendly error messages
        const err = error as NodeJS.ErrnoException;
        if (err.code === 'ENOENT' || (err.message && err.message.includes('not found'))) {
            throw new Error(
                `Data-ops CLI not found at ${DATA_OPS_CLI}. ` +
                `Please ensure the data-ops repository is built. Run: cd data-ops && npm run build`
            );
        }
        
        if (err.code === 'ETIMEDOUT') {
            throw new Error('Command execution timed out. The operation may be taking longer than expected.');
        }
        
        throw error;
    }
}

