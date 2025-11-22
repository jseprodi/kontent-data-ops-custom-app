import express from 'express';
import { execa } from 'execa';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { ManagementClient } from '@kontent-ai/management-sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// CORS configuration - restrict to localhost for development
const corsOptions = {
    origin: process.env.NODE_ENV === 'production' 
        ? false // Disable CORS in production (custom apps don't use CORS)
        : ['http://localhost:3000', 'http://127.0.0.1:3000'], // Allow localhost for dev
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

// Serve static files only in development
// In production, custom apps are served by Kontent.ai
if (process.env.NODE_ENV !== 'production') {
    app.use(express.static(__dirname));
}

// Data-Ops CLI path - use the built version from local repo
const DATA_OPS_CLI = process.env.DATA_OPS_CLI_PATH || path.join(__dirname, 'data-ops', 'build', 'src', 'index.js');

// Logger for server-side logging
class ServerLogger {
    log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${level}] ${message}`, data || '');
    }
    
    info(message, data = null) {
        this.log('INFO', message, data);
    }
    
    error(message, data = null) {
        this.log('ERROR', message, data);
    }
    
    warning(message, data = null) {
        this.log('WARNING', message, data);
    }
}

const logger = new ServerLogger();

// Build arguments for data-ops CLI
// Commands are structured as: data-ops <command> <subcommand> [options]
function buildDataOpsArgs(command, options) {
    // Commands are structured like: "environment backup", "sync run", etc.
    // Split the command into parts
    const commandParts = command.split(' ');
    const args = [...commandParts];
    
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

// Validate command options based on actual data-ops CLI structure
function validateCommandOptions(command, options) {
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
            if (options.advanced && (!options.outPath || options.outPath.trim() === '')) {
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

// Input validation and sanitization
function sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    // Remove potentially dangerous characters but allow valid paths and UUIDs
    return input.trim();
}

function validateEnvironmentId(envId) {
    if (!envId || typeof envId !== 'string') return false;
    // UUID format validation (basic)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(envId.trim());
}

function validateApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') return false;
    // API keys are typically long strings, check minimum length
    return apiKey.trim().length >= 10;
}

function validateFilePath(filePath) {
    if (!filePath || typeof filePath !== 'string') return false;
    // Basic path validation - no directory traversal
    const normalized = path.normalize(filePath);
    return !normalized.includes('..') && normalized.length > 0 && normalized.length < 500;
}

// Enhanced validation for command options
function validateAndSanitizeOptions(command, options) {
    const sanitized = {};
    const errors = [];
    
    for (const [key, value] of Object.entries(options)) {
        // Skip internal options
        if (key.startsWith('_')) {
            sanitized[key] = value;
            continue;
        }
        
        // Sanitize string values
        if (typeof value === 'string') {
            sanitized[key] = sanitizeInput(value);
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

// Execute data-ops command using Node.js
async function executeDataOpsCommand(command, options) {
    try {
        // Validate and sanitize options
        const sanitizedOptions = validateAndSanitizeOptions(command, options);
        
        // Validate command structure
        const validation = validateCommandOptions(command, sanitizedOptions);
        if (!validation.valid) {
            throw new Error(validation.message);
        }
        
        // Verify CLI exists
        try {
            await fs.access(DATA_OPS_CLI);
        } catch (error) {
            throw new Error(`Data-ops CLI not found at ${DATA_OPS_CLI}. Please ensure the data-ops repository is built. Run: cd data-ops && npm run build`);
        }
        
        // Build command arguments
        const args = buildDataOpsArgs(command, sanitizedOptions);
        
        logger.info(`Executing: node ${DATA_OPS_CLI} ${args.join(' ')}`);
        
        // Execute command with streaming output using node to run the built JS file
        const childProcess = execa('node', [DATA_OPS_CLI, ...args], {
            stdio: ['pipe', 'pipe', 'pipe'],
            encoding: 'utf8',
            cwd: __dirname, // Run from project root
            timeout: 3600000, // 1 hour timeout for long-running operations
            killSignal: 'SIGTERM'
        });
        
        return childProcess;
    } catch (error) {
        logger.error('Failed to execute data-ops command', error);
        
        // Provide user-friendly error messages
        if (error.code === 'ENOENT' || error.message.includes('not found')) {
            throw new Error(`Data-ops CLI not found at ${DATA_OPS_CLI}. Please ensure the data-ops repository is built. Run: cd data-ops && npm run build`);
        }
        
        if (error.code === 'ETIMEDOUT') {
            throw new Error('Command execution timed out. The operation may be taking longer than expected.');
        }
        
        throw error;
    }
}

// API Routes

// Health check
app.get('/health', (req, res) => {
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

// Get available commands matching actual data-ops CLI structure
app.get('/api/commands', rateLimitMiddleware, (req, res) => {
    const commands = {
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
    
    res.json(commands);
});

// Simple rate limiting (in-memory, for development)
// In production, use a proper rate limiting library like express-rate-limit
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute per IP

function checkRateLimit(ip) {
    const now = Date.now();
    const userRequests = rateLimitMap.get(ip) || [];
    
    // Remove old requests outside the window
    const recentRequests = userRequests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
    
    if (recentRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
        return false;
    }
    
    recentRequests.push(now);
    rateLimitMap.set(ip, recentRequests);
    return true;
}

// Rate limiting middleware
function rateLimitMiddleware(req, res, next) {
    // Skip rate limiting in development for localhost
    if (process.env.NODE_ENV === 'development' && (req.ip === '127.0.0.1' || req.ip === '::1')) {
        return next();
    }
    
    const ip = req.ip || req.connection.remoteAddress;
    if (!checkRateLimit(ip)) {
        return res.status(429).json({
            error: 'Too many requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000)
        });
    }
    next();
}

// Fetch entities endpoint (content types, taxonomies, etc.)
app.post('/api/fetch-entities', rateLimitMiddleware, async (req, res) => {
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
            environmentId: environmentId,
            apiKey: apiKey
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
            client.listContentTypes().toAllPromise().then(r => r.data.items.map(t => ({ id: t.id, codename: t.codename, name: t.name }))).catch(() => []),
            client.listContentTypeSnippets().toAllPromise().then(r => r.data.items.map(t => ({ id: t.id, codename: t.codename, name: t.name }))).catch(() => []),
            client.listTaxonomies().toAllPromise().then(r => r.data.items.map(t => ({ id: t.id, codename: t.codename, name: t.name }))).catch(() => []),
            client.listCollections().toAllPromise().then(r => r.data.items.map(c => ({ id: c.id, codename: c.codename, name: c.name }))).catch(() => []),
            client.listSpaces().toAllPromise().then(r => r.data.items.map(s => ({ id: s.id, codename: s.codename, name: s.name }))).catch(() => []),
            client.listLanguages().toAllPromise().then(r => r.data.items.map(l => ({ id: l.id, codename: l.codename, name: l.name }))).catch(() => []),
            client.listWorkflows().toAllPromise().then(r => r.data.items.map(w => ({ id: w.id, codename: w.codename, name: w.name }))).catch(() => [])
        ]).then(results => results.map(result => result.status === 'fulfilled' ? result.value : []));
        
        // Organize entities by type
        const entities = {
            contentTypes: contentTypes,
            contentTypeSnippets: contentTypeSnippets,
            taxonomies: taxonomies,
            collections: collections,
            spaces: spaces,
            languages: languages,
            workflows: workflows,
            assetFolders: [], // Asset folders would need special handling
            webSpotlight: [] // Web Spotlight would need special handling
        };
        
        logger.info(`Successfully fetched entities for environment: ${environmentId}`);
        res.json(entities);
        
    } catch (error) {
        logger.error('Failed to fetch entities', error);
        
        // Provide user-friendly error messages
        let errorMessage = 'Failed to fetch entities';
        let solution = 'Please verify your environment ID and Management API key are correct.';
        
        if (error.response) {
            if (error.response.status === 401) {
                errorMessage = 'Authentication failed';
                solution = 'Please check that your Management API key is correct and has the required permissions.';
            } else if (error.response.status === 404) {
                errorMessage = 'Environment not found';
                solution = 'Please verify that the environment ID is correct.';
            }
        }
        
        res.status(500).json({
            error: errorMessage,
            solution: solution,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Execute command endpoint
app.post('/api/execute', rateLimitMiddleware, async (req, res) => {
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
        
        const childProcess = await executeDataOpsCommand(command, options || {});
        
        // Set up response for streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        // CORS headers already set by cors middleware
        
        // Send initial connection message
        res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Connected to command stream' })}\n\n`);
        
        // Track progress stages
        let lastProgressUpdate = 0;
        const progressStages = {
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
        
        // Stream stdout
        childProcess.stdout.on('data', (data) => {
            const output = data.toString();
            const lines = output.split('\n').filter(line => line.trim());
            lines.forEach(line => {
                // Check for progress indicators
                let progressSent = false;
                for (const stage of commandStages) {
                    if (stage.pattern.test(line) && Date.now() - lastProgressUpdate > 500) {
                        res.write(`data: ${JSON.stringify({ type: 'progress', percent: stage.percent, message: line, stage: stage.stage })}\n\n`);
                        lastProgressUpdate = Date.now();
                        progressSent = true;
                        break;
                    }
                }
                
                // Always send as output too
                res.write(`data: ${JSON.stringify({ type: 'output', level: 'info', message: line })}\n\n`);
            });
        });
        
        // Stream stderr
        childProcess.stderr.on('data', (data) => {
            const output = data.toString();
            const lines = output.split('\n').filter(line => line.trim());
            lines.forEach(line => {
                res.write(`data: ${JSON.stringify({ type: 'output', level: 'error', message: line })}\n\n`);
            });
        });
        
        // Handle completion
        childProcess.on('close', (code) => {
            if (code === 0) {
                res.write(`data: ${JSON.stringify({ type: 'complete', success: true, message: 'Command completed successfully' })}\n\n`);
            } else {
                res.write(`data: ${JSON.stringify({ type: 'complete', success: false, message: `Command exited with code ${code}` })}\n\n`);
            }
            res.end();
        });
        
        // Handle errors
        childProcess.on('error', (error) => {
            logger.error('Command execution error', error);
            res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
            res.end();
        });
        
        // Handle client disconnect or cancellation
        req.on('close', () => {
            if (!childProcess.killed) {
                childProcess.kill('SIGTERM');
                logger.info('Client disconnected, terminating command');
            }
        });
        
        // Handle abort signal (for cancellation)
        if (req.signal && req.signal.aborted) {
            if (!childProcess.killed) {
                childProcess.kill('SIGTERM');
                logger.info('Command cancelled by client');
            }
            res.end();
            return;
        }
        
    } catch (error) {
        logger.error('Failed to execute command', error);
        
        // Provide user-friendly error messages
        let errorMessage = error.message || 'Failed to execute command';
        let solution = getErrorSolution(error);
        
        // Handle specific error types
        if (error.message && error.message.includes('Validation errors')) {
            errorMessage = error.message;
            solution = 'Please correct the validation errors and try again.';
        } else if (error.message && error.message.includes('not found')) {
            errorMessage = 'Data-ops CLI not found';
            solution = 'Please ensure the data-ops repository is built. Run: cd data-ops && npm run build';
        } else if (error.code === 'ETIMEDOUT') {
            errorMessage = 'Command execution timed out';
            solution = 'The operation is taking longer than expected. Please try again or check if the operation completed.';
        }
        
        if (!res.headersSent) {
            res.status(500).json({
                error: errorMessage,
                solution: solution,
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        } else {
            res.write(`data: ${JSON.stringify({ type: 'error', message: errorMessage, solution: solution })}\n\n`);
            res.end();
        }
    }
});

// Get error solution
function getErrorSolution(error) {
    const errorMessage = error?.message || String(error);
    
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

// Error handling middleware (must be last)
app.use((err, req, res, next) => {
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
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        message: `Route ${req.path} not found`,
        solution: 'Please check the API endpoint and try again.'
    });
});

// Serve the app (only in development)
if (process.env.NODE_ENV !== 'production') {
    app.get('/', (req, res) => {
        try {
            res.sendFile(path.join(__dirname, 'index.html'));
        } catch (error) {
            logger.error('Failed to serve index.html', error);
            res.status(500).json({ error: 'Failed to serve application' });
        }
    });
}

// Start server
app.listen(PORT, () => {
    logger.info(`Data-Ops Custom App server running on port ${PORT}`);
    logger.info(`Health check: http://localhost:${PORT}/health`);
});
