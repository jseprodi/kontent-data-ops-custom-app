/**
 * Server-side logger for the Data-Ops Custom App
 */

export class ServerLogger {
    log(level: string, message: string, data: unknown = null): void {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${level}] ${message}`, data || '');
    }
    
    info(message: string, data: unknown = null): void {
        this.log('INFO', message, data);
    }
    
    error(message: string, data: unknown = null): void {
        this.log('ERROR', message, data);
    }
    
    warning(message: string, data: unknown = null): void {
        this.log('WARNING', message, data);
    }
}

