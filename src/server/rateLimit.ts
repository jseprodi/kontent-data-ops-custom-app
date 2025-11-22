/**
 * Rate limiting utilities
 */

import type { Request, Response, NextFunction } from 'express';

// Simple rate limiting (in-memory, for development)
// In production, use a proper rate limiting library like express-rate-limit
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute per IP

/**
 * Check if request is within rate limit
 */
function checkRateLimit(ip: string): boolean {
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

/**
 * Rate limiting middleware
 */
export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    // Skip rate limiting in development for localhost
    if (process.env.NODE_ENV === 'development' && (req.ip === '127.0.0.1' || req.ip === '::1')) {
        return next();
    }
    
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    if (!checkRateLimit(ip)) {
        res.status(429).json({
            error: 'Too many requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000)
        });
        return;
    }
    next();
}

