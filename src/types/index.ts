/**
 * Type definitions for the Kontent.ai Data-Ops Custom App
 */

export interface CommandOptions {
    [key: string]: string | number | boolean | string[] | null | undefined;
}

export interface ValidationResult {
    valid: boolean;
    message?: string;
}

export interface CommandDefinition {
    name: string;
    description: string;
    tooltip: string;
    options: CommandOption[];
}

export interface CommandOption {
    id: string;
    label: string;
    type: 'text' | 'password' | 'number' | 'checkbox' | 'select' | 'multiselect' | 'entity-multiselect' | 'file';
    required: boolean;
    placeholder?: string;
    options?: string[];
    fetchable?: boolean;
    implies?: string[];
    dependsOn?: string;
}

export interface EntityResponse {
    contentTypes: Entity[];
    contentTypeSnippets: Entity[];
    taxonomies: Entity[];
    collections: Entity[];
    spaces: Entity[];
    languages: Entity[];
    workflows: Entity[];
    assetFolders: Entity[];
    webSpotlight: Entity[];
}

export interface Entity {
    id: string;
    codename: string;
    name: string;
}

export interface HealthResponse {
    status: string;
    timestamp: string;
    uptime: number;
    environment?: string;
}

export interface ErrorResponse {
    error: string;
    message?: string;
    solution?: string;
    details?: string;
    retryAfter?: number;
}

export interface RateLimitInfo {
    ip: string;
    requests: number[];
}

export interface ProgressStage {
    pattern: RegExp;
    percent: number;
    stage: string;
}

export interface ProgressStages {
    [command: string]: ProgressStage[];
}

export interface StreamMessage {
    type: 'connected' | 'output' | 'progress' | 'complete' | 'error';
    message?: string;
    level?: 'info' | 'error' | 'warning' | 'success';
    percent?: number;
    stage?: string;
    success?: boolean;
    solution?: string;
}

