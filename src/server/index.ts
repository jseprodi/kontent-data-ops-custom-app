/**
 * Main server entry point
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupRoutes } from './routes.js';
import { ServerLogger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const logger = new ServerLogger();

// Middleware
// CORS configuration - restrict to localhost for development
const corsOptions: cors.CorsOptions = {
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
    app.use(express.static(PROJECT_ROOT));
}

// Setup routes
setupRoutes(app);

// Start server
app.listen(PORT, () => {
    logger.info(`Data-Ops Custom App server running on port ${PORT}`);
    logger.info(`Health check: http://localhost:${PORT}/health`);
});

