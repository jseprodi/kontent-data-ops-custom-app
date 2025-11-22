/**
 * API route handlers
 */

import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { ManagementClient } from '@kontent-ai/management-sdk';
import type { CommandDefinition, EntityResponse, StreamMessage, ProgressStages } from '../types/index.js';
import { rateLimitMiddleware } from './rateLimit.js';
import { executeDataOpsCommand } from './executor.js';
import { validateEnvironmentId, validateApiKey } from './validation.js';
import { getErrorSolution } from './errors.js';
import { ServerLogger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

const logger = new ServerLogger();

// Sync entity choices from data-ops CLI
const syncEntityChoices = [
    'contentTypes',
    'contentTypeSnippets',
    'taxonomies',
    'collections',
    'assetFolders',
    'spaces',
    'languages',
    'webSpotlight',
    'workflows'
];

/**
 * Get available commands
 */
export function getCommands(): Record<string, CommandDefinition> {
    return {
        'environment backup': {
            name: 'Environment Backup',
            description: 'Backs up data from the specified Kontent.ai project into a .zip file.',
            tooltip: 'Creates a complete backup of your Kontent.ai environment including all content items, types, taxonomies, assets, and configuration.',
            options: [
                { id: 'environmentId', label: 'Environment ID', type: 'text', required: true, placeholder: 'Enter environment ID' },
                { id: 'apiKey', label: 'Management API Key', type: 'password', required: true, placeholder: 'Enter Management API key (not Delivery API key)' },
                { id: 'fileName', label: 'Backup File Name', type: 'text', required: false, placeholder: 'Optional: backup.zip (auto-generated if omitted)' },
                { id: 'secureAssetDeliveryKey', label: 'Secure Asset Delivery Key', type: 'password', required: false, placeholder: 'Delivery API key for secure assets (required if secure asset delivery is enabled)' },
                { id: 'include', label: 'Include Entities', type: 'entity-multiselect', fetchable: true, required: false },
                { id: 'exclude', label: 'Exclude Entities', type: 'entity-multiselect', fetchable: true, required: false },
                { id: 'kontentUrl', label: 'Custom Kontent URL', type: 'text', required: false, placeholder: 'Optional: Custom URL for Kontent.ai endpoints (defaults to kontent.ai)' }
            ]
        },
        'environment restore': {
            name: 'Environment Restore',
            description: 'Restores data into the specified Kontent.ai project from a backup zip file.',
            tooltip: 'Restores your Kontent.ai environment from a previously created backup. Can restore content, types, taxonomies, and assets.',
            options: [
                { id: 'environmentId', label: 'Environment ID', type: 'text', required: true, placeholder: 'Enter environment ID' },
                { id: 'apiKey', label: 'Management API Key', type: 'password', required: true, placeholder: 'Enter Management API key (not Delivery API key)' },
                { id: 'fileName', label: 'Backup File Name', type: 'text', required: true, placeholder: 'backup.zip' },
                { id: 'include', label: 'Include Entities', type: 'entity-multiselect', fetchable: true, required: false },
                { id: 'exclude', label: 'Exclude Entities', type: 'entity-multiselect', fetchable: true, required: false },
                { id: 'excludeInactiveLanguages', label: 'Exclude Inactive Languages', type: 'checkbox', required: false },
                { id: 'kontentUrl', label: 'Custom Kontent URL', type: 'text', required: false, placeholder: 'Optional: Custom URL for Kontent.ai endpoints (defaults to kontent.ai)' }
            ]
        },
        'environment clean': {
            name: 'Environment Clean',
            description: 'Removes all content, assets and configuration from a Kontent.ai environment.',
            tooltip: '⚠️ WARNING: This permanently removes all content from your environment. Use with caution!',
            options: [
                { id: 'environmentId', label: 'Environment ID', type: 'text', required: true, placeholder: 'Enter environment ID' },
                { id: 'apiKey', label: 'Management API Key', type: 'password', required: true, placeholder: 'Enter Management API key (not Delivery API key)' },
                { id: 'include', label: 'Include Entities', type: 'entity-multiselect', fetchable: true, required: false },
                { id: 'exclude', label: 'Exclude Entities', type: 'entity-multiselect', fetchable: true, required: false },
                { id: 'skipWarning', label: 'Skip Warning', type: 'checkbox', required: false },
                { id: 'kontentUrl', label: 'Custom Kontent URL', type: 'text', required: false, placeholder: 'Optional: Custom URL for Kontent.ai endpoints (defaults to kontent.ai)' }
            ]
        },
        'sync run': {
            name: 'Sync Run',
            description: 'Synchronize content model between two Kontent.ai environments.',
            tooltip: 'Syncs content model elements (types, taxonomies, workflows, etc.) from a source environment to a target environment.',
            options: [
                { id: 'targetEnvironmentId', label: 'Target Environment ID', type: 'text', required: true, placeholder: 'Enter target environment ID' },
                { id: 'targetApiKey', label: 'Target Management API Key', type: 'password', required: true, placeholder: 'Enter target Management API key (not Delivery API key)' },
                { id: 'entities', label: 'Entities to Sync', type: 'multiselect', options: syncEntityChoices, required: true },
                { id: 'sourceEnvironmentId', label: 'Source Environment ID', type: 'text', required: false, placeholder: 'Enter source environment ID' },
                { id: 'sourceApiKey', label: 'Source Management API Key', type: 'password', required: false, placeholder: 'Enter source Management API key (not Delivery API key)' },
                { id: 'folderName', label: 'Source Folder Name', type: 'text', required: false, placeholder: 'Or use folder with snapshot' },
                { id: 'skipConfirmation', label: 'Skip Confirmation', type: 'checkbox', required: false },
                { id: 'kontentUrl', label: 'Custom Kontent URL', type: 'text', required: false, placeholder: 'Optional: Custom URL for Kontent.ai endpoints (defaults to kontent.ai)' }
            ]
        },
        'sync snapshot': {
            name: 'Sync Snapshot',
            description: 'Generates content model json files used for sync from Kontent.ai environment.',
            tooltip: 'Creates a snapshot of the content model from an environment that can be used for syncing.',
            options: [
                { id: 'environmentId', label: 'Environment ID', type: 'text', required: true, placeholder: 'Enter environment ID' },
                { id: 'apiKey', label: 'Management API Key', type: 'password', required: true, placeholder: 'Enter Management API key (not Delivery API key)' },
                { id: 'entities', label: 'Entities to Snapshot', type: 'multiselect', options: syncEntityChoices, required: true },
                { id: 'folderName', label: 'Output Folder Name', type: 'text', required: false, placeholder: 'Optional: snapshot folder name' },
                { id: 'kontentUrl', label: 'Custom Kontent URL', type: 'text', required: false, placeholder: 'Optional: Custom URL for Kontent.ai endpoints (defaults to kontent.ai)' }
            ]
        },
        'sync diff': {
            name: 'Sync Diff',
            description: 'Compares content models from two Kontent.ai environments.',
            tooltip: 'Generates a diff report showing differences between two environments or between an environment and a snapshot folder.',
            options: [
                { id: 'targetEnvironmentId', label: 'Target Environment ID', type: 'text', required: true, placeholder: 'Enter target environment ID' },
                { id: 'targetApiKey', label: 'Target Management API Key', type: 'password', required: true, placeholder: 'Enter target Management API key (not Delivery API key)' },
                { id: 'sourceEnvironmentId', label: 'Source Environment ID', type: 'text', required: false, placeholder: 'Enter source environment ID' },
                { id: 'sourceApiKey', label: 'Source Management API Key', type: 'password', required: false, placeholder: 'Enter source Management API key (not Delivery API key)' },
                { id: 'folderName', label: 'Source Folder Name', type: 'text', required: false, placeholder: 'Or use folder with snapshot' },
                { id: 'entities', label: 'Entities to Diff', type: 'multiselect', options: syncEntityChoices, required: false },
                { id: 'advanced', label: 'Generate Advanced Diff HTML', type: 'checkbox', required: false, implies: ['outPath'] },
                { id: 'outPath', label: 'Output Path', type: 'text', required: false, placeholder: 'Path for diff output (required with advanced)', dependsOn: 'advanced' },
                { id: 'noOpen', label: 'Don\'t Open Automatically', type: 'checkbox', required: false, dependsOn: 'advanced' },
                { id: 'kontentUrl', label: 'Custom Kontent URL', type: 'text', required: false, placeholder: 'Optional: Custom URL for Kontent.ai endpoints (defaults to kontent.ai)' }
            ]
        }
    };
}

/**
 * Setup API routes
 */
export function setupRoutes(app: express.Application): void {
    // Health check
    app.get('/health', (_req: Request, res: Response) => {
        try {
            res.json({ 
                status: 'ok', 
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                environment: process.env.NODE_ENV || 'development'
            });
        } catch (error) {
            logger.error('Health check failed', error);
            res.status(500).json({ status: 'error', message: 'Health check failed' });
        }
    });

    // Get available commands
    app.get('/api/commands', rateLimitMiddleware, (_req: Request, res: Response) => {
        res.json(getCommands());
    });

    // Fetch entities endpoint (content types, taxonomies, etc.)
    app.post('/api/fetch-entities', rateLimitMiddleware, async (req: Request, res: Response) => {
        try {
            const { environmentId, apiKey } = req.body;
            
            // Validate input
            if (!environmentId || !apiKey) {
                return res.status(400).json({
                    error: 'environmentId and apiKey are required',
                    solution: 'Please provide both environment ID and API key.'
                });
            }
            
            // Validate format
            if (!validateEnvironmentId(environmentId)) {
                return res.status(400).json({
                    error: 'Invalid environment ID format',
                    solution: 'Environment ID must be a valid UUID.'
                });
            }
            
            if (!validateApiKey(apiKey)) {
                return res.status(400).json({
                    error: 'Invalid API key format',
                    solution: 'API key appears to be invalid. Please check your Management API key.'
                });
            }
            
            logger.info(`Fetching entities for environment: ${environmentId}`);
            
            // Create Management API client with timeout
            const client = new ManagementClient({
                environmentId: environmentId as string,
                apiKey: apiKey as string
            });
            
            // Fetch all entities in parallel with error handling
            const [
                contentTypes,
                contentTypeSnippets,
                taxonomies,
                collections,
                spaces,
                languages,
                workflows
            ] = await Promise.allSettled([
                client.listContentTypes().toAllPromise().then((r: { data: { items: Array<{ id: string; codename: string; name: string }> } }) => 
                    r.data.items.map((t: { id: string; codename: string; name: string }) => ({ id: t.id, codename: t.codename, name: t.name }))
                ).catch(() => []),
                client.listContentTypeSnippets().toAllPromise().then((r: { data: { items: Array<{ id: string; codename: string; name: string }> } }) => 
                    r.data.items.map((t: { id: string; codename: string; name: string }) => ({ id: t.id, codename: t.codename, name: t.name }))
                ).catch(() => []),
                client.listTaxonomies().toAllPromise().then((r: { data: { items: Array<{ id: string; codename: string; name: string }> } }) => 
                    r.data.items.map((t: { id: string; codename: string; name: string }) => ({ id: t.id, codename: t.codename, name: t.name }))
                ).catch(() => []),
                client.listCollections().toPromise().then((r) => 
                    r.rawData.collections.map((c) => ({ id: c.id, codename: c.codename, name: c.name }))
                ).catch(() => []),
                client.listSpaces().toPromise().then((r) => 
                    r.rawData.map((s) => ({ id: s.id, codename: s.codename, name: s.name }))
                ).catch(() => []),
                client.listLanguages().toAllPromise().then((r) => 
                    r.data.items.map((l) => ({ id: l.id, codename: l.codename, name: l.name }))
                ).catch(() => []),
                client.listWorkflows().toPromise().then((r) => 
                    r.rawData.map((w) => ({ id: w.id, codename: w.codename, name: w.name }))
                ).catch(() => [])
            ]).then(results => results.map(result => result.status === 'fulfilled' ? result.value : []));
            
            // Organize entities by type
            const entities: EntityResponse = {
                contentTypes: contentTypes as EntityResponse['contentTypes'],
                contentTypeSnippets: contentTypeSnippets as EntityResponse['contentTypeSnippets'],
                taxonomies: taxonomies as EntityResponse['taxonomies'],
                collections: collections as EntityResponse['collections'],
                spaces: spaces as EntityResponse['spaces'],
                languages: languages as EntityResponse['languages'],
                workflows: workflows as EntityResponse['workflows'],
                assetFolders: [], // Asset folders would need special handling
                webSpotlight: [] // Web Spotlight would need special handling
            };
            
            logger.info(`Successfully fetched entities for environment: ${environmentId}`);
            res.json(entities);
            return;
            
        } catch (error) {
            logger.error('Failed to fetch entities', error);
            
            // Provide user-friendly error messages
            let errorMessage = 'Failed to fetch entities';
            let solution = 'Please verify your environment ID and Management API key are correct.';
            
            const err = error as { response?: { status: number } };
            if (err.response) {
                if (err.response.status === 401) {
                    errorMessage = 'Authentication failed';
                    solution = 'Please check that your Management API key is correct and has the required permissions.';
                } else if (err.response.status === 404) {
                    errorMessage = 'Environment not found';
                    solution = 'Please verify that the environment ID is correct.';
                }
            }
            
            res.status(500).json({
                error: errorMessage,
                solution: solution,
                details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
            });
            return;
        }
    });

    // Execute command endpoint
    app.post('/api/execute', rateLimitMiddleware, async (req: Request, res: Response) => {
        try {
            const { command, options } = req.body;
            
            // Validate input
            if (!command || typeof command !== 'string') {
                return res.status(400).json({ 
                    error: 'Command is required',
                    solution: 'Please select a command to execute'
                });
            }
            
            // Validate command format
            const commandParts = command.split(' ');
            if (commandParts.length < 2 || commandParts.length > 3) {
                return res.status(400).json({
                    error: 'Invalid command format',
                    solution: 'Command must be in the format: <command> <subcommand>'
                });
            }
            
            // Validate options
            if (options && typeof options !== 'object') {
                return res.status(400).json({
                    error: 'Invalid options format',
                    solution: 'Options must be an object'
                });
            }
            
            logger.info(`Command execution requested: ${command}`);
            
            // Get child process with proper typing for streaming
            const childProcess = await executeDataOpsCommand(command, options || {});
            
            // Set up response for streaming
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            // CORS headers already set by cors middleware
            
            // Send initial connection message
            const connectedMsg: StreamMessage = { type: 'connected', message: 'Connected to command stream' };
            res.write(`data: ${JSON.stringify(connectedMsg)}\n\n`);
            
            // Track progress stages
            let lastProgressUpdate = 0;
            const progressStages: ProgressStages = {
                'environment backup': [
                    { pattern: /backing up|starting backup/i, percent: 10, stage: 'Starting backup...' },
                    { pattern: /fetching.*content|retrieving/i, percent: 30, stage: 'Fetching content...' },
                    { pattern: /processing.*assets|downloading.*assets/i, percent: 50, stage: 'Processing assets...' },
                    { pattern: /creating.*zip|compressing/i, percent: 80, stage: 'Creating backup file...' },
                    { pattern: /backup.*complete|finished/i, percent: 100, stage: 'Backup complete!' }
                ],
                'environment restore': [
                    { pattern: /restoring|starting restore/i, percent: 10, stage: 'Starting restore...' },
                    { pattern: /extracting|unzipping/i, percent: 20, stage: 'Extracting backup...' },
                    { pattern: /uploading|importing/i, percent: 50, stage: 'Importing data...' },
                    { pattern: /restore.*complete|finished/i, percent: 100, stage: 'Restore complete!' }
                ],
                'sync run': [
                    { pattern: /syncing|starting sync/i, percent: 10, stage: 'Starting sync...' },
                    { pattern: /comparing|analyzing/i, percent: 30, stage: 'Comparing environments...' },
                    { pattern: /applying.*changes|updating/i, percent: 60, stage: 'Applying changes...' },
                    { pattern: /sync.*complete|finished/i, percent: 100, stage: 'Sync complete!' }
                ]
            };
            
            const commandStages = progressStages[command] || [];
            
            // Stream stdout - childProcess.stdout is a Readable stream when stdio is 'pipe'
            const stdout = childProcess.stdout;
            if (stdout && typeof stdout === 'object' && 'on' in stdout) {
                (stdout as NodeJS.ReadableStream).on('data', (data: Buffer) => {
                    const output = data.toString();
                    const lines = output.split('\n').filter(line => line.trim());
                    lines.forEach(line => {
                        // Check for progress indicators
                        for (const stage of commandStages) {
                            if (stage.pattern.test(line) && Date.now() - lastProgressUpdate > 500) {
                                const progressMsg: StreamMessage = { 
                                    type: 'progress', 
                                    percent: stage.percent, 
                                    message: line, 
                                    stage: stage.stage 
                                };
                                res.write(`data: ${JSON.stringify(progressMsg)}\n\n`);
                                lastProgressUpdate = Date.now();
                                break;
                            }
                        }
                        
                        // Always send as output too
                        const outputMsg: StreamMessage = { type: 'output', level: 'info', message: line };
                        res.write(`data: ${JSON.stringify(outputMsg)}\n\n`);
                    });
                });
            }
            
            // Stream stderr - childProcess.stderr is a Readable stream when stdio is 'pipe'
            const stderr = childProcess.stderr;
            if (stderr && typeof stderr === 'object' && 'on' in stderr) {
                (stderr as NodeJS.ReadableStream).on('data', (data: Buffer) => {
                    const output = data.toString();
                    const lines = output.split('\n').filter(line => line.trim());
                    lines.forEach(line => {
                        const errorMsg: StreamMessage = { type: 'output', level: 'error', message: line };
                        res.write(`data: ${JSON.stringify(errorMsg)}\n\n`);
                    });
                });
            }
            
            // Type assertion needed because TypeScript doesn't recognize the extended type from executor
            const cp = childProcess as unknown as NodeJS.EventEmitter & { killed: boolean; kill: (signal: string) => void };
            
            // Handle completion - childProcess is an EventEmitter
            cp.on('close', (code: number | null) => {
                if (code === 0) {
                    const completeMsg: StreamMessage = { 
                        type: 'complete', 
                        success: true, 
                        message: 'Command completed successfully' 
                    };
                    res.write(`data: ${JSON.stringify(completeMsg)}\n\n`);
                } else {
                    const completeMsg: StreamMessage = { 
                        type: 'complete', 
                        success: false, 
                        message: `Command exited with code ${code}` 
                    };
                    res.write(`data: ${JSON.stringify(completeMsg)}\n\n`);
                }
                res.end();
            });
            
            // Handle errors
            cp.on('error', (error: Error) => {
                logger.error('Command execution error', error);
                const errorMsg: StreamMessage = { type: 'error', message: error.message };
                res.write(`data: ${JSON.stringify(errorMsg)}\n\n`);
                res.end();
            });
            
            // Handle client disconnect or cancellation
            req.on('close', () => {
                if (!cp.killed) {
                    cp.kill('SIGTERM');
                    logger.info('Client disconnected, terminating command');
                }
            });
            
            // Note: This endpoint uses Server-Sent Events, response is kept open for streaming
            // The response is handled asynchronously via event listeners
            return;
            
        } catch (error) {
            logger.error('Failed to execute command', error);
            
            // Provide user-friendly error messages
            const err = error as Error;
            let errorMessage = err.message || 'Failed to execute command';
            let solution = getErrorSolution(error);
            
            // Handle specific error types
            if (err.message && err.message.includes('Validation errors')) {
                errorMessage = err.message;
                solution = 'Please correct the validation errors and try again.';
            } else if (err.message && err.message.includes('not found')) {
                errorMessage = 'Data-ops CLI not found';
                solution = 'Please ensure the data-ops repository is built. Run: cd data-ops && npm run build';
            } else if ((err as NodeJS.ErrnoException).code === 'ETIMEDOUT') {
                errorMessage = 'Command execution timed out';
                solution = 'The operation is taking longer than expected. Please try again or check if the operation completed.';
            }
            
            if (!res.headersSent) {
                res.status(500).json({
                    error: errorMessage,
                    solution: solution,
                    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
                });
                return;
            } else {
                const errorMsg: StreamMessage = { type: 'error', message: errorMessage, solution: solution };
                res.write(`data: ${JSON.stringify(errorMsg)}\n\n`);
                res.end();
                return;
            }
        }
    });

    // Error handling middleware (must be last)
    app.use((err: Error, _req: Request, res: Response, _next: express.NextFunction) => {
        logger.error('Unhandled error', err);
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Internal server error',
                message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
                solution: 'Please try again. If the problem persists, check the server logs.'
            });
        }
    });

    // 404 handler
    app.use((_req: Request, res: Response) => {
        res.status(404).json({
            error: 'Not found',
            message: `Route ${_req.path} not found`,
            solution: 'Please check the API endpoint and try again.'
        });
    });

    // Serve the app (only in development)
    if (process.env.NODE_ENV !== 'production') {
        app.get('/', (_req: Request, res: Response) => {
            try {
                res.sendFile(path.join(PROJECT_ROOT, 'index.html'));
            } catch (error) {
                logger.error('Failed to serve index.html', error);
                res.status(500).json({ error: 'Failed to serve application' });
            }
        });
    }
}

