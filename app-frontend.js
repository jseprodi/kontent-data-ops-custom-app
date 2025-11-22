// Frontend application code (separated from SDK initialization)
// This runs in the browser context within Kontent.ai

// ============================================================================
// UTILITY FUNCTIONS (Integrated from src/utils/)
// ============================================================================

/**
 * Performance Utilities
 */
function debounce(func, wait = 300, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func(...args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func(...args);
    };
}

function throttle(func, limit = 100) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => {
                inThrottle = false;
            }, limit);
        }
    };
}

/**
 * Storage Utilities
 */
function getStorageItem(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        if (item === null) return defaultValue;
        return JSON.parse(item);
    } catch (error) {
        console.error(`Error reading from localStorage (${key}):`, error);
        return defaultValue;
    }
}

function setStorageItem(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error(`Error writing to localStorage (${key}):`, error);
        if (error.name === 'QuotaExceededError') {
            console.warn('localStorage quota exceeded. Consider clearing old data.');
        }
        return false;
    }
}

function removeStorageItem(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        console.error(`Error removing from localStorage (${key}):`, error);
        return false;
    }
}

/**
 * Validation Utilities
 */
function isValidUUID(uuid) {
    if (!uuid || typeof uuid !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid.trim());
}

function isValidApiKey(apiKey, minLength = 10) {
    if (!apiKey || typeof apiKey !== 'string') return false;
    return apiKey.trim().length >= minLength;
}

function sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    return input.trim().replace(/[<>]/g, '');
}

/**
 * Error Handling Utilities
 */
const ErrorCodes = {
    NETWORK_ERROR: 'NETWORK_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    API_ERROR: 'API_ERROR',
    COMMAND_ERROR: 'COMMAND_ERROR',
    STORAGE_ERROR: 'STORAGE_ERROR',
    PERMISSION_ERROR: 'PERMISSION_ERROR',
    TIMEOUT_ERROR: 'TIMEOUT_ERROR',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

function getErrorMessage(error) {
    const errorMessage = error.message || 'An unexpected error occurred';
    let solution = 'Please try again. If the problem persists, check the console for details.';
    
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        solution = 'Please check your internet connection and try again.';
    } else if (errorMessage.includes('timeout')) {
        solution = 'The operation is taking longer than expected. Please try again.';
    } else if (errorMessage.includes('permission') || errorMessage.includes('401')) {
        solution = 'Please check your API keys and permissions.';
    } else if (errorMessage.includes('not found') || errorMessage.includes('404')) {
        solution = 'The requested resource was not found. Please verify your configuration.';
    }
    
    return { message: errorMessage, solution };
}

// ============================================================================
// APPLICATION STATE
// ============================================================================

// Application State
const state = {
    command: '',
    sourceEnv: null,
    targetEnv: null,
    commandOptions: {},
    isRunning: false,
    logs: [],
    output: [],
    serverUrl: window.location.origin, // Adjust if server is on different port
    abortController: null, // For command cancellation
    progress: {
        current: 0,
        total: 100,
        message: '',
        stage: ''
    },
    outputFilter: {
        searchTerm: '',
        logLevel: 'all', // all, info, error, success, warning
        showLineNumbers: true
    },
    outputSections: {
        currentSection: null,
        sections: new Map() // Map of sectionId -> { type, count, element }
    },
    virtualScroll: {
        enabled: false,
        visibleStart: 0,
        visibleEnd: 0,
        itemHeight: VIRTUAL_SCROLL_ITEM_HEIGHT,
        containerHeight: 0,
        totalHeight: 0,
        scrollTop: 0
    }
};

// Storage keys
const STORAGE_KEYS = {
    COMMAND: 'dataOps_command',
    SOURCE_ENV: 'dataOps_sourceEnv',
    TARGET_ENV: 'dataOps_targetEnv',
    COMMAND_OPTIONS: 'dataOps_commandOptions',
    ENTITY_CACHE: 'dataOps_entityCache',
    TEMPLATES: 'dataOps_templates',
    COMMAND_HISTORY: 'dataOps_commandHistory',
    ENVIRONMENT_PROFILES: 'dataOps_environmentProfiles',
    SETTINGS: 'dataOps_settings',
    WORKFLOWS: 'dataOps_workflows'
};

// Default settings
const DEFAULT_SETTINGS = {
    autoSave: true,
    showLineNumbers: true,
    notifications: false,
    soundAlerts: false,
    maxHistory: 100,
    cacheExpiry: 1,
    theme: 'light',
    fontSize: 'medium'
};

// Maximum history entries to keep
const MAX_HISTORY_ENTRIES = 100;

// Entity cache with expiration (1 hour)
const ENTITY_CACHE_EXPIRY = 60 * 60 * 1000; // 1 hour in milliseconds

// Output performance limits
const MAX_OUTPUT_LINES = 10000; // Maximum output lines to prevent memory issues
const OUTPUT_BATCH_SIZE = 100; // Render output in batches
const VIRTUAL_SCROLL_THRESHOLD = 1000; // Use virtual scrolling for outputs > 1000 lines
const VIRTUAL_SCROLL_ITEM_HEIGHT = 24; // Estimated height per output line in pixels
const VIRTUAL_SCROLL_BUFFER = 10; // Number of items to render outside viewport

// Command Definitions - will be loaded from server
const commands = {};

// Logger
class Logger {
    constructor() {
        this.logs = [];
    }

    log(level, message, data = null) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = {
            timestamp,
            level,
            message,
            data
        };
        this.logs.push(logEntry);
        this.renderLog(logEntry);
        
        // Also log to console for debugging
        const consoleMethod = console[level.toLowerCase()] || console.log;
        consoleMethod(`[${timestamp}] ${level}: ${message}`, data || '');
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

    success(message, data = null) {
        this.log('SUCCESS', message, data);
    }

    renderLog(logEntry) {
        const logsContainer = document.getElementById('logs-container');
        if (!logsContainer) return;
        
        const logElement = document.createElement('div');
        logElement.className = `log-entry log-${logEntry.level.toLowerCase()}`;
        logElement.innerHTML = `
            <span class="log-time">[${logEntry.timestamp}]</span>
            <span class="log-level">${logEntry.level}</span>
            <span class="log-message">${this.escapeHtml(logEntry.message)}</span>
        `;
        logsContainer.appendChild(logElement);
        logsContainer.scrollTop = logsContainer.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getLogs() {
        return this.logs;
    }

    clear() {
        this.logs = [];
        const logsContainer = document.getElementById('logs-container');
        if (logsContainer) {
            logsContainer.innerHTML = '';
        }
    }
}

const logger = new Logger();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    init();
});

// Save form state to localStorage (using storage utilities)
function saveFormState() {
    if (state.command) {
        setStorageItem(STORAGE_KEYS.COMMAND, state.command);
    }
    if (state.sourceEnv) {
        setStorageItem(STORAGE_KEYS.SOURCE_ENV, state.sourceEnv);
    }
    if (state.targetEnv) {
        setStorageItem(STORAGE_KEYS.TARGET_ENV, state.targetEnv);
    }
    if (Object.keys(state.commandOptions).length > 0) {
        // Don't save API keys to localStorage for security
        const safeOptions = { ...state.commandOptions };
        Object.keys(safeOptions).forEach(key => {
            if (key.toLowerCase().includes('apikey') || key.toLowerCase().includes('key')) {
                delete safeOptions[key];
            }
        });
        setStorageItem(STORAGE_KEYS.COMMAND_OPTIONS, safeOptions);
    }
}

// Restore form state from localStorage (using storage utilities)
function restoreFormState() {
    const savedCommand = getStorageItem(STORAGE_KEYS.COMMAND);
    const savedSourceEnv = getStorageItem(STORAGE_KEYS.SOURCE_ENV);
    const savedTargetEnv = getStorageItem(STORAGE_KEYS.TARGET_ENV);
    const savedOptions = getStorageItem(STORAGE_KEYS.COMMAND_OPTIONS);
    
    if (savedCommand) {
        state.command = savedCommand;
        elements.commandSelect.value = savedCommand;
        if (commands[savedCommand]) {
            renderCommandOptions(savedCommand);
        }
    }
    
    if (savedSourceEnv) {
        state.sourceEnv = savedSourceEnv;
        elements.sourceEnv.value = savedSourceEnv;
    }
    
    if (savedTargetEnv) {
        state.targetEnv = savedTargetEnv;
        elements.targetEnv.value = savedTargetEnv;
    }
    
    if (savedOptions) {
        // Restore options after form is rendered
        setTimeout(() => {
            Object.entries(savedOptions).forEach(([key, value]) => {
                const element = document.getElementById(`opt-${key}`);
                if (element) {
                    if (element.type === 'checkbox') {
                        element.checked = value;
                    } else {
                        element.value = value;
                    }
                }
            });
            updateCommandOptions();
            updateRunButtonState();
        }, 100);
    }
}

// Clear saved form state (using storage utilities)
function clearFormState() {
    Object.values(STORAGE_KEYS).forEach(key => {
        removeStorageItem(key);
    });
}

// DOM Elements
let elements = {};

// Initialize
async function init() {
    logger.info('Initializing Data-Ops Custom App');
    
    // Get DOM elements
    elements = {
        commandSelect: document.getElementById('command-select'),
        sourceEnv: document.getElementById('source-env'),
        targetEnv: document.getElementById('target-env'),
        commandOptions: document.getElementById('command-options'),
        runButton: document.getElementById('run-command'),
        cancelButton: document.getElementById('cancel-command'),
        clearOutput: document.getElementById('clear-output'),
        downloadLogs: document.getElementById('download-logs'),
        copyOutput: document.getElementById('copy-output'),
        exportOutput: document.getElementById('export-output'),
        copyLogs: document.getElementById('copy-logs'),
        outputContainer: document.getElementById('output-container'),
        outputControls: document.getElementById('output-controls'),
        outputSearch: document.getElementById('output-search'),
        outputLevelFilter: document.getElementById('output-level-filter'),
        outputLineNumbers: document.getElementById('output-line-numbers'),
        clearOutputFilters: document.getElementById('clear-output-filters'),
        templatesSection: document.getElementById('templates-section'),
        templateSelect: document.getElementById('template-select'),
        saveTemplate: document.getElementById('save-template'),
        loadTemplate: document.getElementById('load-template'),
        deleteTemplate: document.getElementById('delete-template'),
        exportTemplate: document.getElementById('export-template'),
        importTemplate: document.getElementById('import-template'),
        profilesSection: document.getElementById('profiles-section'),
        profileSelect: document.getElementById('profile-select'),
        saveProfile: document.getElementById('save-profile'),
        loadProfile: document.getElementById('load-profile'),
        deleteProfile: document.getElementById('delete-profile'),
        exportProfiles: document.getElementById('export-profiles'),
        importProfiles: document.getElementById('import-profiles'),
        sourceEnvProfile: document.getElementById('source-env-profile'),
        targetEnvProfile: document.getElementById('target-env-profile'),
        historyContainer: document.getElementById('history-container'),
        historySearch: document.getElementById('history-search'),
        historyFilter: document.getElementById('history-filter'),
        clearHistory: document.getElementById('clear-history'),
        exportHistory: document.getElementById('export-history'),
        toggleHistory: document.getElementById('toggle-history'),
        expandAllSections: document.getElementById('expand-all-sections'),
        collapseAllSections: document.getElementById('collapse-all-sections'),
        btnStatistics: document.getElementById('btn-statistics'),
        btnSettings: document.getElementById('btn-settings'),
        statisticsModal: document.getElementById('statistics-modal'),
        statisticsContent: document.getElementById('statistics-content'),
        refreshStatistics: document.getElementById('refresh-statistics'),
        settingsModal: document.getElementById('settings-modal'),
        settingsContent: document.getElementById('settings-content'),
        saveSettings: document.getElementById('save-settings'),
        resetSettings: document.getElementById('reset-settings'),
        clearAllData: document.getElementById('clear-all-data'),
        exportAllData: document.getElementById('export-all-data'),
        importAllData: document.getElementById('import-all-data'),
        logsContainer: document.getElementById('logs-container'),
        btnWorkflows: document.getElementById('btn-workflows'),
        btnHelp: document.getElementById('btn-help'),
        workflowsModal: document.getElementById('workflows-modal'),
        helpModal: document.getElementById('help-modal'),
        toggleLogs: document.getElementById('toggle-logs'),
        statusIcon: document.getElementById('status-icon'),
        statusText: document.getElementById('status-text'),
        errorModal: document.getElementById('error-modal'),
        errorMessage: document.getElementById('error-message'),
        errorSolution: document.getElementById('error-solution'),
        progressContainer: document.getElementById('progress-container'),
        progressBar: document.getElementById('progress-bar'),
        progressText: document.getElementById('progress-text'),
        progressPercent: document.getElementById('progress-percent'),
        shortcutsModal: document.getElementById('shortcuts-modal')
    };
    
    // Load commands and environments
    try {
        await loadCommands();
        await loadEnvironments();
        logger.info('Environments loaded successfully');
        
        // Restore form state after commands are loaded
        restoreFormState();
    } catch (error) {
        logger.error('Failed to load initial data', error);
        showError('Initialization Error', getErrorSolution(error));
    }

    // Event Listeners
    setupEventListeners();
    
    // Auto-save form state on changes
    setupAutoSave();
    
    // Setup keyboard shortcuts
    setupKeyboardShortcuts();
    
    // Load initial data
    loadProfiles();
    loadCommandHistory();

    logger.info('Application initialized successfully');
}

// Setup auto-save for form state
function setupAutoSave() {
    // Debounced save function for better performance
    const debouncedSave = debounce(() => {
        saveFormState();
    }, 300);
    
    // Save on command change
    elements.commandSelect.addEventListener('change', () => {
        saveFormState();
    });
    
    // Save on environment change
    elements.sourceEnv.addEventListener('change', () => {
        saveFormState();
    });
    
    elements.targetEnv.addEventListener('change', () => {
        saveFormState();
    });
    
    // Save on any input change (debounced)
    let saveTimeout;
    document.addEventListener('input', (e) => {
        if (e.target?.id?.startsWith('opt-')) {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                updateCommandOptions();
                saveFormState();
            }, 500);
        }
    });
    
    // Save on checkbox changes
    document.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox' && e.target.id && e.target.id.startsWith('opt-')) {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                updateCommandOptions();
                saveFormState();
            }, 300);
        }
    });
}

// Load commands from server
async function loadCommands() {
    try {
        const response = await fetch(`${state.serverUrl}/api/commands`);
        if (!response.ok) {
            throw new Error(`Failed to load commands: ${response.statusText}`);
        }
        const serverCommands = await response.json();
        
        // Replace commands with server definitions
        Object.assign(commands, serverCommands);
        
        populateCommandSelect();
        logger.info('Commands loaded successfully');
    } catch (error) {
        logger.error('Could not load commands from server', error);
        showError('Failed to Load Commands', 'Could not load command definitions from the server. Please ensure the server is running.');
    }
}

// Populate command select
function populateCommandSelect() {
    const select = elements.commandSelect;
    select.innerHTML = '<option value="">Select a command...</option>';
    
    Object.entries(commands).forEach(([key, cmd]) => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = cmd.name || key;
        option.title = cmd.description || cmd.tooltip || '';
        select.appendChild(option);
    });
}

// Load environments
async function loadEnvironments() {
    // In a real Kontent.ai custom app, this would fetch from SDK
    // For now, we'll provide manual input option
    const sourceSelect = elements.sourceEnv;
    const targetSelect = elements.targetEnv;
    
    // Add manual input option
    const manualOption = document.createElement('option');
    manualOption.value = 'manual';
    manualOption.textContent = 'Manual Input (Enter Project ID)';
    
    if (!sourceSelect.querySelector('option[value="manual"]')) {
        sourceSelect.appendChild(manualOption.cloneNode(true));
        targetSelect.appendChild(manualOption);
    }
}

// Setup event listeners
function setupEventListeners() {
    elements.commandSelect.addEventListener('change', handleCommandChange);
    elements.sourceEnv.addEventListener('change', handleEnvironmentChange);
    elements.targetEnv.addEventListener('change', handleEnvironmentChange);
    elements.runButton.addEventListener('click', handleRunCommand);
    elements.cancelButton.addEventListener('click', cancelCommand);
    elements.clearOutput.addEventListener('click', handleClearOutput);
    elements.downloadLogs.addEventListener('click', handleDownloadLogs);
    elements.copyOutput.addEventListener('click', handleCopyOutput);
    elements.exportOutput.addEventListener('click', handleExportOutput);
    elements.copyLogs.addEventListener('click', handleCopyLogs);
    elements.toggleLogs.addEventListener('click', handleToggleLogs);
    
    // Output filter controls (with debouncing for performance)
    if (elements.outputSearch) {
        elements.outputSearch.addEventListener('input', debounce(() => {
            state.outputFilter.searchTerm = elements.outputSearch.value;
            filterOutput();
        }, 300));
    }
    
    if (elements.outputLevelFilter) {
        elements.outputLevelFilter.addEventListener('change', () => {
            state.outputFilter.logLevel = elements.outputLevelFilter.value;
            filterOutput();
        });
    }
    
    if (elements.outputLineNumbers) {
        elements.outputLineNumbers.addEventListener('change', () => {
            state.outputFilter.showLineNumbers = elements.outputLineNumbers.checked;
            updateOutputLineNumbers();
        });
    }
    
    if (elements.clearOutputFilters) {
        elements.clearOutputFilters.addEventListener('click', () => {
            state.outputFilter = { searchTerm: '', logLevel: 'all', showLineNumbers: true };
            if (elements.outputSearch) elements.outputSearch.value = '';
            if (elements.outputLevelFilter) elements.outputLevelFilter.value = 'all';
            if (elements.outputLineNumbers) elements.outputLineNumbers.checked = true;
            filterOutput();
        });
    }
    
    if (elements.expandAllSections) {
        elements.expandAllSections.addEventListener('click', () => {
            expandAllOutputSections();
        });
    }
    
    if (elements.collapseAllSections) {
        elements.collapseAllSections.addEventListener('click', () => {
            collapseAllOutputSections();
        });
    }
    
    // Template controls
    if (elements.saveTemplate) {
        elements.saveTemplate.addEventListener('click', handleSaveTemplate);
    }
    if (elements.loadTemplate) {
        elements.loadTemplate.addEventListener('click', handleLoadTemplate);
    }
    if (elements.deleteTemplate) {
        elements.deleteTemplate.addEventListener('click', handleDeleteTemplate);
    }
    if (elements.exportTemplate) {
        elements.exportTemplate.addEventListener('click', handleExportTemplate);
    }
    if (elements.importTemplate) {
        elements.importTemplate.addEventListener('click', handleImportTemplate);
    }
    
    // Modal close handlers
    document.querySelectorAll('.modal-close, [data-modal]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modalId = btn.dataset.modal || btn.closest('.modal')?.id || 'error-modal';
            closeModal(modalId);
        });
    });
    
    if (elements.errorModal) {
        elements.errorModal.addEventListener('click', (e) => {
            if (e.target === elements.errorModal) {
                closeErrorModal();
            }
        });
    }
    
    if (elements.shortcutsModal) {
        elements.shortcutsModal.addEventListener('click', (e) => {
            if (e.target === elements.shortcutsModal) {
                elements.shortcutsModal.classList.remove('active');
            }
        });
    }
    
    // Environment profile controls
    if (elements.saveProfile) {
        elements.saveProfile.addEventListener('click', handleSaveProfile);
    }
    if (elements.loadProfile) {
        elements.loadProfile.addEventListener('click', handleLoadProfile);
    }
    if (elements.deleteProfile) {
        elements.deleteProfile.addEventListener('click', handleDeleteProfile);
    }
    if (elements.exportProfiles) {
        elements.exportProfiles.addEventListener('click', handleExportProfiles);
    }
    if (elements.importProfiles) {
        elements.importProfiles.addEventListener('click', handleImportProfiles);
    }
    if (elements.sourceEnvProfile) {
        elements.sourceEnvProfile.addEventListener('click', () => showProfileSelector('source'));
    }
    if (elements.targetEnvProfile) {
        elements.targetEnvProfile.addEventListener('click', () => showProfileSelector('target'));
    }
    
    // Command history controls (with debouncing for performance)
    if (elements.historySearch) {
        elements.historySearch.addEventListener('input', debounce(filterHistory, 300));
    }
    if (elements.historyFilter) {
        elements.historyFilter.addEventListener('change', filterHistory);
    }
    if (elements.clearHistory) {
        elements.clearHistory.addEventListener('click', handleClearHistory);
    }
    if (elements.exportHistory) {
        elements.exportHistory.addEventListener('click', handleExportHistory);
    }
    if (elements.toggleHistory) {
        elements.toggleHistory.addEventListener('click', handleToggleHistory);
    }
    
    // Workflows and Help buttons
    if (elements.btnWorkflows) {
        elements.btnWorkflows.addEventListener('click', () => openModal('workflows-modal'));
    }
    if (elements.btnHelp) {
        elements.btnHelp.addEventListener('click', () => openModal('help-modal'));
    }
    
    // Setup workflows functionality
    setupWorkflows();
    
    // Setup help functionality
    setupHelp();
    
    // Setup accessibility features
    setupAccessibility();
}

// Setup keyboard shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Don't trigger shortcuts when user is typing in inputs, textareas, or contenteditable
        const isInputFocused = document.activeElement && (
            document.activeElement.tagName === 'INPUT' ||
            document.activeElement.tagName === 'TEXTAREA' ||
            document.activeElement.isContentEditable
        );
        
        const ctrlOrCmd = e.ctrlKey || e.metaKey;
        
        // Ctrl/Cmd + Enter: Run command
        if (ctrlOrCmd && e.key === 'Enter' && !e.shiftKey) {
            if (!state.isRunning && elements.runButton && !elements.runButton.disabled) {
                e.preventDefault();
                handleRunCommand();
                logger.info('Command triggered via keyboard shortcut (Ctrl+Enter)');
            }
        }
        
        // Esc: Cancel command or close modals
        if (e.key === 'Escape') {
            if (state.isRunning) {
                e.preventDefault();
                cancelCommand();
                logger.info('Command cancelled via keyboard shortcut (Esc)');
            } else {
                // Close any open modals
                document.querySelectorAll('.modal.active').forEach(modal => {
                    modal.classList.remove('active');
                });
            }
        }
        
        // Ctrl/Cmd + K: Focus command selector
        if (ctrlOrCmd && e.key === 'k' && !isInputFocused) {
            e.preventDefault();
            if (elements.commandSelect) {
                elements.commandSelect.focus();
                logger.info('Command selector focused via keyboard shortcut (Ctrl+K)');
            }
        }
        
        // Ctrl/Cmd + /: Show keyboard shortcuts
        if (ctrlOrCmd && e.key === '/' && !isInputFocused) {
            e.preventDefault();
            if (elements.shortcutsModal) {
                elements.shortcutsModal.classList.add('active');
                logger.info('Keyboard shortcuts help shown');
            }
        }
    });
}

// Handle command selection change
function handleCommandChange() {
    state.command = elements.commandSelect.value;
    
    if (state.command && commands[state.command]) {
        renderCommandOptions(state.command);
        updateTooltip(state.command);
        logger.info(`Command selected: ${state.command}`);
        
        // Show templates section
        if (elements.templatesSection) {
            elements.templatesSection.style.display = '';
            loadTemplates();
        }
    } else {
        elements.commandOptions.innerHTML = '';
        // Clear tooltip
        const tooltipContent = document.getElementById('command-tooltip');
        if (tooltipContent) {
            tooltipContent.innerHTML = '<strong>Select a command</strong> to see its description and options.';
        }
        
        // Hide templates section
        if (elements.templatesSection) {
            elements.templatesSection.style.display = 'none';
        }
    }
    
    updateRunButtonState();
}

// Update tooltip for selected command
function updateTooltip(commandName) {
    const command = commands[commandName];
    if (!command) return;
    
    const tooltipContent = document.getElementById('command-tooltip');
    if (tooltipContent) {
        const tooltip = command.tooltip || command.description || '';
        tooltipContent.innerHTML = `<strong>${command.name}:</strong> ${tooltip}`;
    }
}

// Render command-specific options
function renderCommandOptions(commandName) {
    const command = commands[commandName];
    if (!command) return;
    
    let html = '<h3>Command Options</h3>';
    
    command.options.forEach(option => {
        // Check if this option depends on another field
        const dependsOn = option.dependsOn;
        const isHidden = dependsOn ? true : false; // Initially hide if depends on another field
        
        html += `<div class="option-group" id="opt-group-${option.id}" ${isHidden ? 'style="display: none;"' : ''} data-depends-on="${dependsOn || ''}">`;
        html += `<label for="opt-${option.id}">${option.label}${option.required ? ' <span style="color: red;">*</span>' : ''}</label>`;
        
        if (option.type === 'text') {
            const placeholder = option.placeholder || `Enter ${option.label.toLowerCase()}`;
            const fieldType = getFieldType(option.id);
            const isFileField = fieldType === 'filepath' && (option.id.includes('fileName') || option.id.includes('file_name'));
            
            html += `<div class="field-wrapper">`;
            html += `<div class="input-with-file-picker">`;
            html += `<input type="text" id="opt-${option.id}" class="form-control" value="${option.default || ''}" ${option.required ? 'required' : ''} placeholder="${placeholder}" data-field-type="${fieldType}" />`;
            
            // Add file picker button for file fields
            if (isFileField) {
                html += `<input type="file" id="opt-${option.id}-file" class="file-input-hidden" accept=".zip" style="display: none;" />`;
                html += `<button type="button" class="btn-file-picker" data-target="opt-${option.id}" title="Browse for file">📁</button>`;
            }
            
            html += `</div>`;
            html += `<span class="field-validation-icon"></span>`;
            html += `<div class="field-error-message"></div>`;
            if (isFileField) {
                html += `<div class="file-info" id="opt-${option.id}-fileinfo" style="display: none;"></div>`;
            }
            html += `</div>`;
        } else if (option.type === 'password') {
            const placeholder = option.placeholder || `Enter ${option.label.toLowerCase()}`;
            html += `<div class="field-wrapper">`;
            html += `<div class="password-input-wrapper">`;
            html += `<input type="password" id="opt-${option.id}" class="form-control password-input" value="${option.default || ''}" ${option.required ? 'required' : ''} placeholder="${placeholder}" autocomplete="off" data-field-type="${getFieldType(option.id)}" />`;
            html += `<button type="button" class="btn-toggle-password" data-target="opt-${option.id}" aria-label="Toggle password visibility">👁️</button>`;
            html += `</div>`;
            html += `<span class="field-validation-icon"></span>`;
            html += `<div class="field-error-message"></div>`;
            html += `</div>`;
        } else if (option.type === 'number') {
            html += `<div class="field-wrapper">`;
            html += `<input type="number" id="opt-${option.id}" class="form-control" value="${option.default || ''}" ${option.required ? 'required' : ''} data-field-type="number" />`;
            html += `<span class="field-validation-icon"></span>`;
            html += `<div class="field-error-message"></div>`;
            html += `</div>`;
        } else if (option.type === 'select') {
            html += `<select id="opt-${option.id}" class="form-control" ${option.required ? 'required' : ''}>`;
            if (!option.required) {
                html += `<option value="">-- Select --</option>`;
            }
            option.options.forEach(opt => {
                html += `<option value="${opt}" ${opt === option.default ? 'selected' : ''}>${opt}</option>`;
            });
            html += `</select>`;
        } else if (option.type === 'multiselect') {
            html += `<div id="opt-${option.id}-container" class="multiselect-container">`;
            option.options.forEach(opt => {
                html += `<label class="checkbox-label">`;
                html += `<input type="checkbox" value="${opt}" class="multiselect-checkbox" data-option-id="${option.id}" />`;
                html += `<span>${opt}</span>`;
                html += `</label>`;
            });
            html += `</div>`;
        } else if (option.type === 'entity-multiselect' && option.fetchable) {
            // Entity multiselect that fetches from API - collapsible dropdown
            html += `<div class="entity-multiselect-wrapper">`;
            html += `<button type="button" class="btn-toggle-entities" data-option-id="${option.id}">`;
            html += `<span class="toggle-icon">▼</span> Select ${option.label.toLowerCase()}...`;
            html += `</button>`;
            html += `<div id="opt-${option.id}-container" class="entity-multiselect-container collapsed">`;
            html += `<div class="entity-loading" id="opt-${option.id}-loading" style="display: none;">Loading entities...</div>`;
            html += `<div class="entity-error" id="opt-${option.id}-error" style="display: none;"></div>`;
            html += `<div class="entity-categories" id="opt-${option.id}-categories"></div>`;
            html += `<div class="entity-fetch-info">`;
            html += `<small>Enter Environment ID and Management API Key above, then click "Fetch Entities" to see available items from your project.</small>`;
            html += `<button type="button" class="btn-fetch-entities" data-option-id="${option.id}">Fetch Entities</button>`;
            html += `</div>`;
            html += `</div>`;
            html += `<div class="selected-entities" id="opt-${option.id}-selected"></div>`;
            html += `</div>`;
        } else if (option.type === 'checkbox') {
            html += `<label><input type="checkbox" id="opt-${option.id}" ${option.default ? 'checked' : ''} /> Enable ${option.label}</label>`;
        } else if (option.type === 'textarea') {
            html += `<div class="field-wrapper">`;
            html += `<textarea id="opt-${option.id}" class="form-control" ${option.required ? 'required' : ''} placeholder="Enter ${option.label.toLowerCase()}" data-field-type="text">${option.default || ''}</textarea>`;
            html += `<span class="field-validation-icon"></span>`;
            html += `<div class="field-error-message"></div>`;
            html += `</div>`;
        }
        
        html += `</div>`;
    });
    
    elements.commandOptions.innerHTML = html;
    
    // Store initial values and add listeners
    updateCommandOptions();
    
    // Set up dependency visibility and listeners
    command.options.forEach(option => {
        const element = document.getElementById(`opt-${option.id}`);
        if (element) {
            element.addEventListener('change', () => {
                updateCommandOptions();
                updateDependentFieldsVisibility(command);
            });
            element.addEventListener('input', () => {
                updateCommandOptions();
                updateDependentFieldsVisibility(command);
            });
        }
        
        // Handle entity multiselect toggle and fetch buttons
        if (option.type === 'entity-multiselect' && option.fetchable) {
            const toggleBtn = document.querySelector(`.btn-toggle-entities[data-option-id="${option.id}"]`);
            const fetchBtn = document.querySelector(`.btn-fetch-entities[data-option-id="${option.id}"]`);
            
            if (toggleBtn) {
                toggleBtn.addEventListener('click', () => toggleEntityMultiselect(option.id));
            }
            
            if (fetchBtn) {
                fetchBtn.addEventListener('click', () => fetchEntitiesForOption(option.id, commandName));
            }
        }
    });
    
    // Initial visibility update
    updateDependentFieldsVisibility(command);
    
    // Setup password toggle buttons
    setupPasswordToggles();
    
    // Setup file picker buttons
    setupFilePickers(command);
    
    // Setup inline validation
    setupInlineValidation(command);
}

// Setup file picker buttons
function setupFilePickers(command) {
    if (!command || !command.options) return;
    
    command.options.forEach(option => {
        const fieldType = getFieldType(option.id);
        const isFileField = fieldType === 'filepath' && (option.id.includes('fileName') || option.id.includes('file_name'));
        
        if (isFileField) {
            const fileInput = document.getElementById(`opt-${option.id}-file`);
            const fileButton = document.querySelector(`.btn-file-picker[data-target="opt-${option.id}"]`);
            const textInput = document.getElementById(`opt-${option.id}`);
            const fileInfo = document.getElementById(`opt-${option.id}-fileinfo`);
            
            if (fileInput && fileButton && textInput) {
                fileButton.addEventListener('click', () => {
                    fileInput.click();
                });
                
                fileInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        textInput.value = file.name;
                        updateFileInfo(option.id, file, fileInfo);
                        validateField(option.id, option);
                        updateCommandOptions();
                        saveFormState();
                    }
                });
                
                // Also allow drag and drop
                textInput.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    textInput.classList.add('drag-over');
                });
                
                textInput.addEventListener('dragleave', () => {
                    textInput.classList.remove('drag-over');
                });
                
                textInput.addEventListener('drop', (e) => {
                    e.preventDefault();
                    textInput.classList.remove('drag-over');
                    
                    const file = e.dataTransfer.files[0];
                    if (file) {
                        textInput.value = file.name;
                        updateFileInfo(option.id, file, fileInfo);
                        validateField(option.id, option);
                        updateCommandOptions();
                        saveFormState();
                    }
                });
            }
        }
    });
}

// Update file info display
function updateFileInfo(fieldId, file, fileInfoElement) {
    if (!fileInfoElement || !file) return;
    
    const fileSize = formatFileSize(file.size);
    const lastModified = new Date(file.lastModified).toLocaleString();
    
    fileInfoElement.innerHTML = `
        <small style="color: var(--text-muted);">
            <strong>File:</strong> ${file.name}<br>
            <strong>Size:</strong> ${fileSize}<br>
            <strong>Modified:</strong> ${lastModified}
        </small>
    `;
    fileInfoElement.style.display = 'block';
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Get field type for validation
function getFieldType(fieldId) {
    const lowerId = fieldId.toLowerCase();
    if (lowerId.includes('environmentid') || lowerId.includes('environment_id')) {
        return 'guid';
    }
    if (lowerId.includes('filename') || lowerId.includes('file_name') || lowerId.includes('outpath') || lowerId.includes('folder')) {
        return 'filepath';
    }
    if (lowerId.includes('apikey') || lowerId.includes('api_key') || lowerId.includes('key')) {
        return 'apikey';
    }
    if (lowerId.includes('url')) {
        return 'url';
    }
    return 'text';
}

// Setup inline validation for command options
function setupInlineValidation(command) {
    if (!command || !command.options) return;
    
    command.options.forEach(option => {
        const element = document.getElementById(`opt-${option.id}`);
        if (!element) return;
        
        // Add validation on input/change
        element.addEventListener('input', () => {
            validateField(option.id, option);
            updateCommandOptions();
        });
        
        element.addEventListener('blur', () => {
            validateField(option.id, option);
        });
        
        // Initial validation if field has value
        if (element.value) {
            validateField(option.id, option);
        }
    });
}

// Validate individual field
function validateField(fieldId, option) {
    const element = document.getElementById(`opt-${fieldId}`);
    if (!element) return;
    
    const fieldType = element.dataset.fieldType || 'text';
    const value = element.value.trim();
    const wrapper = element.closest('.field-wrapper') || element.parentElement;
    const icon = wrapper?.querySelector('.field-validation-icon');
    const errorMsg = wrapper?.querySelector('.field-error-message');
    
    // Remove previous validation state
    element.classList.remove('field-valid', 'field-invalid');
    if (icon) icon.textContent = '';
    if (errorMsg) errorMsg.textContent = '';
    
    // Skip validation if field is hidden
    const dependentGroup = document.getElementById(`opt-group-${fieldId}`);
    if (dependentGroup && dependentGroup.style.display === 'none') {
        return;
    }
    
    // Required field validation
    if (option.required && !value) {
        element.classList.add('field-invalid');
        if (icon) icon.textContent = '❌';
        if (errorMsg) errorMsg.textContent = `${option.label} is required`;
        return;
    }
    
    // Skip further validation if field is empty and not required
    if (!value && !option.required) {
        return;
    }
    
    // Type-specific validation
    let isValid = true;
    let errorMessage = '';
    
    switch (fieldType) {
        case 'guid': {
            // GUID format: 8-4-4-4-12 hexadecimal characters
            const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (value && !guidPattern.test(value)) {
                isValid = false;
                errorMessage = 'Invalid Environment ID format. Expected GUID format (e.g., 00000000-0000-0000-0000-000000000000)';
            }
            break;
        }
            
        case 'apikey':
            // API keys are typically long strings, at least 20 characters
            if (value && value.length < 20) {
                isValid = false;
                errorMessage = 'API key appears to be too short. Please verify it\'s correct.';
            }
            break;
            
        case 'filepath':
            // File path validation
            if (value) {
                // Check for invalid characters (control characters 0x00-0x1F)
                const invalidChars = /[<>:"|?*]/;
                // Check for control characters separately to avoid regex issues
                const hasControlChars = value.split('').some(char => {
                    const code = char.charCodeAt(0);
                    return code >= 0 && code <= 31;
                });
                if (invalidChars.test(value) || hasControlChars) {
                    isValid = false;
                    errorMessage = 'File path contains invalid characters';
                } else if (fieldId.includes('fileName') && !value.toLowerCase().endsWith('.zip')) {
                    // Warn if backup file doesn't end with .zip
                    isValid = true; // Not invalid, just a warning
                    if (errorMsg) {
                        errorMsg.textContent = '⚠ Backup files should typically be .zip files';
                        errorMsg.className = 'field-error-message field-warning';
                    }
                }
            }
            break;
            
        case 'url':
            // URL validation
            if (value) {
                try {
                    // Try to create a URL object (allows relative URLs)
                    if (value.includes('://')) {
                        new URL(value);
                    }
                } catch {
                    isValid = false;
                    errorMessage = 'Invalid URL format';
                }
            }
            break;
    }
    
    // Update visual state
    if (isValid && value) {
        element.classList.add('field-valid');
        if (icon) icon.textContent = '✅';
    } else if (!isValid) {
        element.classList.add('field-invalid');
        if (icon) icon.textContent = '❌';
        if (errorMsg) {
            errorMsg.textContent = errorMessage;
            errorMsg.className = 'field-error-message';
        }
    }
}

// Setup password visibility toggles
function setupPasswordToggles() {
    document.querySelectorAll('.btn-toggle-password').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            const input = document.getElementById(targetId);
            if (input) {
                if (input.type === 'password') {
                    input.type = 'text';
                    btn.textContent = '🙈';
                    btn.setAttribute('aria-label', 'Hide password');
                } else {
                    input.type = 'password';
                    btn.textContent = '👁️';
                    btn.setAttribute('aria-label', 'Show password');
                }
            }
        });
    });
}

// Update visibility of fields based on dependencies
function updateDependentFieldsVisibility(command) {
    command.options.forEach(option => {
        if (option.dependsOn) {
            const dependsOnElement = document.getElementById(`opt-${option.dependsOn}`);
            const dependentGroup = document.getElementById(`opt-group-${option.id}`);
            
            if (dependsOnElement && dependentGroup) {
                let shouldShow = false;
                
                // Check if the dependency is met
                if (dependsOnElement.type === 'checkbox') {
                    shouldShow = dependsOnElement.checked;
                } else {
                    shouldShow = dependsOnElement.value && dependsOnElement.value.trim() !== '';
                }
                
                // Show/hide the dependent field
                if (shouldShow) {
                    dependentGroup.style.display = '';
                    // Make required fields actually required when visible
                    const dependentElement = document.getElementById(`opt-${option.id}`);
                    if (dependentElement && option.required) {
                        dependentElement.required = true;
                    }
                } else {
                    dependentGroup.style.display = 'none';
                    // Clear value and remove required when hidden
                    const dependentElement = document.getElementById(`opt-${option.id}`);
                    if (dependentElement) {
                        if (dependentElement.type === 'checkbox') {
                            dependentElement.checked = false;
                        } else {
                            dependentElement.value = '';
                        }
                        dependentElement.required = false;
                    }
                }
            }
        }
    });
}

// Toggle entity multiselect container
function toggleEntityMultiselect(optionId) {
    const container = document.getElementById(`opt-${optionId}-container`);
    const toggleBtn = document.querySelector(`.btn-toggle-entities[data-option-id="${optionId}"]`);
    const icon = toggleBtn?.querySelector('.toggle-icon');
    
    if (container) {
        const isCollapsed = container.classList.contains('collapsed');
        if (isCollapsed) {
            container.classList.remove('collapsed');
            if (icon) icon.textContent = '▲';
        } else {
            container.classList.add('collapsed');
            if (icon) icon.textContent = '▼';
        }
    }
}

// Get cached entities (using storage utilities)
function getCachedEntities(environmentId) {
    const cacheKey = `${STORAGE_KEYS.ENTITY_CACHE}_${environmentId}`;
    const cached = getStorageItem(cacheKey);
    if (!cached) return null;
    
    const now = Date.now();
    
    // Check if cache is expired
    if (now - cached.timestamp > ENTITY_CACHE_EXPIRY) {
        removeStorageItem(cacheKey);
        return null;
    }
    
    return cached.entities;
}

// Cache entities (using storage utilities)
function cacheEntities(environmentId, entities) {
    const cacheKey = `${STORAGE_KEYS.ENTITY_CACHE}_${environmentId}`;
    const cacheData = {
        timestamp: Date.now(),
        entities: entities
    };
    setStorageItem(cacheKey, cacheData);
}

// Clear entity cache for an environment (using storage utilities)
function clearEntityCache(environmentId) {
    const cacheKey = `${STORAGE_KEYS.ENTITY_CACHE}_${environmentId}`;
    removeStorageItem(cacheKey);
}

// Fetch entities from API for a specific option
async function fetchEntitiesForOption(optionId, commandName) {
    const command = commands[commandName];
    if (!command) return;
    
    // Get environment credentials from the form
    const environmentId = getEnvironmentIdFromForm(command);
    const apiKey = getApiKeyFromForm(command);
    
    if (!environmentId || !apiKey) {
        showError('Missing Credentials', 'Please enter Environment ID and Management API Key before fetching entities.');
        return;
    }
    
    const loadingEl = document.getElementById(`opt-${optionId}-loading`);
    const errorEl = document.getElementById(`opt-${optionId}-error`);
    const categoriesEl = document.getElementById(`opt-${optionId}-categories`);
    const fetchInfoEl = document.querySelector(`[data-option-id="${optionId}"]`).closest('.entity-multiselect-wrapper')?.querySelector('.entity-fetch-info');
    
    try {
        if (loadingEl) loadingEl.style.display = 'block';
        if (errorEl) errorEl.style.display = 'none';
        if (categoriesEl) categoriesEl.innerHTML = '';
        
        // Check cache first
        let entities = getCachedEntities(environmentId);
        let fromCache = false;
        
        if (entities) {
            logger.info(`Using cached entities for environment ${environmentId}`);
            fromCache = true;
        } else {
            // Fetch entities from server
            const response = await fetch(`${state.serverUrl}/api/fetch-entities`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    environmentId: environmentId,
                    apiKey: apiKey
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to fetch entities');
            }
            
            entities = await response.json();
            
            // Cache the entities
            cacheEntities(environmentId, entities);
        }
        
        // Render entities by category
        if (categoriesEl) {
            renderEntityCategories(categoriesEl, entities, optionId, fromCache);
            // Expand the container when entities are loaded
            const container = document.getElementById(`opt-${optionId}-container`);
            if (container?.classList.contains('collapsed')) {
                container.classList.remove('collapsed');
                const toggleBtn = document.querySelector(`.btn-toggle-entities[data-option-id="${optionId}"]`);
                const icon = toggleBtn?.querySelector('.toggle-icon');
                if (icon) icon.textContent = '▲';
            }
        }
        
        if (loadingEl) loadingEl.style.display = 'none';
        if (fetchInfoEl) fetchInfoEl.style.display = 'none';
        
        logger.info(`Successfully ${fromCache ? 'loaded cached' : 'fetched'} entities for ${optionId}`);
        
    } catch (error) {
        if (loadingEl) loadingEl.style.display = 'none';
        if (errorEl) {
            errorEl.textContent = error.message || 'Failed to fetch entities';
            errorEl.style.display = 'block';
        }
        logger.error(`Failed to fetch entities for ${optionId}`, error);
    }
}

// Get environment ID from form based on command
// eslint-disable-next-line no-unused-vars
function getEnvironmentIdFromForm(command) {
    // Try to get from various possible field names
    const envIdField = document.getElementById('opt-environmentId') || 
                      document.getElementById('opt-sourceEnvironmentId') || 
                      document.getElementById('opt-targetEnvironmentId');
    return envIdField?.value || '';
}

// Get API key from form based on command
// eslint-disable-next-line no-unused-vars
function getApiKeyFromForm(command) {
    // Try to get from various possible field names
    const apiKeyField = document.getElementById('opt-apiKey') || 
                       document.getElementById('opt-sourceApiKey') || 
                       document.getElementById('opt-targetApiKey');
    return apiKeyField?.value || '';
}

// Render entity categories with checkboxes
// The CLI uses entity type names (contentTypes, taxonomies, etc.), so we show entity types
// with their actual items underneath for reference
function renderEntityCategories(container, entities, optionId, fromCache = false) {
    let html = '';
    
    // Add search and cache controls
    html += `<div class="entity-controls">`;
    html += `<div class="entity-search-wrapper">`;
    html += `<input type="text" id="opt-${optionId}-search" class="entity-search-input" placeholder="Search entities..." />`;
    html += `<button type="button" class="btn-refresh-entities" data-option-id="${optionId}" title="Refresh entities (clear cache)">🔄</button>`;
    if (fromCache) {
        html += `<span class="cache-indicator" title="Using cached data">💾</span>`;
    }
    html += `</div>`;
    html += `</div>`;
    
    // Define entity categories that can be fetched - these map to CLI entity type names
    const entityCategories = [
        { key: 'contentTypes', label: 'Content Types', items: entities.contentTypes || [] },
        { key: 'contentTypeSnippets', label: 'Content Type Snippets', items: entities.contentTypeSnippets || [] },
        { key: 'taxonomies', label: 'Taxonomies', items: entities.taxonomies || [] },
        { key: 'collections', label: 'Collections', items: entities.collections || [] },
        { key: 'spaces', label: 'Spaces', items: entities.spaces || [] },
        { key: 'languages', label: 'Languages', items: entities.languages || [] },
        { key: 'workflows', label: 'Workflows', items: entities.workflows || [] }
    ];
    
    // Also include entity types that don't need fetching (no specific items list)
    const staticEntityTypes = [
        { key: 'contentItems', label: 'Content Items', items: [] },
        { key: 'languageVariants', label: 'Language Variants', items: [] },
        { key: 'assets', label: 'Assets', items: [] },
        { key: 'assetFolders', label: 'Asset Folders', items: [] },
        { key: 'previewUrls', label: 'Preview URLs', items: [] },
        { key: 'roles', label: 'Roles', items: [] },
        { key: 'webhooks', label: 'Webhooks', items: [] },
        { key: 'webSpotlight', label: 'Web Spotlight', items: [] }
    ];
    
    [...entityCategories, ...staticEntityTypes].forEach(category => {
        const itemCount = category.items ? category.items.length : 0;
        // Show entity type checkbox and items list for reference
        html += `<div class="entity-category" data-category-key="${category.key}">`;
        html += `<label class="entity-type-checkbox-label">`;
        html += `<input type="checkbox" value="${category.key}" class="entity-type-checkbox" data-option-id="${optionId}" data-category="${category.key}" />`;
        html += `<strong class="category-header">${category.label}</strong>`;
        if (itemCount > 0) {
            html += `<span class="category-count">(${itemCount})</span>`;
        }
        html += `</label>`;
        
        // Show actual items from project if available
        if (category.items && category.items.length > 0) {
            html += `<div class="entity-items" data-category="${category.key}" style="margin-left: 30px; margin-top: 5px; max-height: 150px; overflow-y: auto;">`;
            html += `<small style="color: var(--text-muted); display: block; margin-bottom: 5px;">Items in your project (for reference):</small>`;
            category.items.forEach(item => {
                const displayName = item.name || item.codename || item.id;
                html += `<div class="entity-item-ref" data-item-name="${displayName.toLowerCase()}" style="padding: 2px 0; font-size: 0.85rem; color: var(--text-muted);">`;
                html += `<span>• ${displayName}</span>`;
                html += `</div>`;
            });
            html += `</div>`;
        } else if (category.key === 'contentItems' || category.key === 'languageVariants' || category.key === 'assets') {
            // These are general entity types without specific lists
            html += `<div style="margin-left: 30px; margin-top: 5px;">`;
            html += `<small style="color: var(--text-muted);">All ${category.label.toLowerCase()} in the project</small>`;
            html += `</div>`;
        }
        
        html += `</div>`;
    });
    
    container.innerHTML = html;
    
    // Add event listeners for checkboxes
    container.querySelectorAll(`.entity-type-checkbox[data-option-id="${optionId}"]`).forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            updateEntitySelection(optionId);
            updateCommandOptions();
        });
    });
    
    // Setup search functionality
    const searchInput = document.getElementById(`opt-${optionId}-search`);
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterEntities(optionId, e.target.value);
        });
    }
    
    // Setup refresh button
    const refreshBtn = container.querySelector(`.btn-refresh-entities[data-option-id="${optionId}"]`);
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            const environmentId = getEnvironmentIdFromForm(command);
            if (environmentId) {
                clearEntityCache(environmentId);
            }
            fetchEntitiesForOption(optionId, commandName);
        });
    }
}

// Filter entities by search term
function filterEntities(optionId, searchTerm) {
    const container = document.getElementById(`opt-${optionId}-container`);
    if (!container) return;
    
    const searchLower = searchTerm.toLowerCase().trim();
    
    if (!searchLower) {
        // Show all when search is empty
        container.querySelectorAll('.entity-category, .entity-item-ref').forEach(el => {
            el.style.display = '';
        });
        return;
    }
    
    // Filter categories and items
    container.querySelectorAll('.entity-category').forEach(category => {
        const categoryKey = category.dataset.categoryKey;
        const categoryLabel = category.querySelector('.category-header')?.textContent || '';
        const matchesCategory = categoryLabel.toLowerCase().includes(searchLower);
        
        // Filter items within this category
        let hasVisibleItems = false;
        category.querySelectorAll('.entity-item-ref').forEach(item => {
            const itemName = item.dataset.itemName || '';
            const matchesItem = itemName.includes(searchLower);
            
            if (matchesItem) {
                item.style.display = '';
                hasVisibleItems = true;
            } else {
                item.style.display = 'none';
            }
        });
        
        // Show category if it matches or has visible items
        if (matchesCategory || hasVisibleItems) {
            category.style.display = '';
        } else {
            category.style.display = 'none';
        }
    });
}

// Update entity selection display
function updateEntitySelection(optionId) {
    const checkboxes = document.querySelectorAll(`.entity-type-checkbox[data-option-id="${optionId}"]:checked`);
    const selectedContainer = document.getElementById(`opt-${optionId}-selected`);
    
    if (!selectedContainer) return;
    
    if (checkboxes.length === 0) {
        selectedContainer.innerHTML = '';
        return;
    }
    
    // Get selected entity types
    const selected = Array.from(checkboxes).map(cb => {
        const category = cb.dataset.category;
        const label = cb.closest('.entity-category')?.querySelector('.category-header')?.textContent || category;
        return { key: category, label: label };
    });
    
    let html = '<div class="selected-entities-list"><strong>Selected Entity Types:</strong> ';
    html += selected.map(s => s.label).join(', ');
    html += ` <button type="button" class="btn-clear-selection" data-option-id="${optionId}">Clear</button>`;
    html += '</div>';
    
    selectedContainer.innerHTML = html;
    
    // Add clear button listener
    selectedContainer.querySelector('.btn-clear-selection')?.addEventListener('click', () => {
        checkboxes.forEach(cb => {
            cb.checked = false;
        });
        updateEntitySelection(optionId);
        updateCommandOptions();
    });
}

// Update command options to include entity selections
function updateCommandOptions() {
    if (!state.command) return;
    
    const command = commands[state.command];
    if (!command || !command.options) return;
    
    state.commandOptions = {};
    
    command.options.forEach(option => {
        if (option.type === 'entity-multiselect') {
            // Get selected entity types (CLI uses entity type names like 'contentTypes', 'taxonomies')
            const selected = Array.from(document.querySelectorAll(`.entity-type-checkbox[data-option-id="${option.id}"]:checked`))
                .map(cb => cb.value); // value is already the entity type name (contentTypes, taxonomies, etc.)
            
            if (selected.length > 0) {
                state.commandOptions[option.id] = selected;
            }
        } else if (option.type === 'multiselect') {
            // Get all checked checkboxes for this multiselect
            const checked = Array.from(document.querySelectorAll(`.multiselect-checkbox[data-option-id="${option.id}"]:checked`))
                .map(cb => cb.value);
            if (checked.length > 0) {
                state.commandOptions[option.id] = checked;
            }
        } else {
            const element = document.getElementById(`opt-${option.id}`);
            if (element) {
                if (option.type === 'checkbox') {
                    state.commandOptions[option.id] = element.checked;
                } else {
                    const value = element.value;
                    if (value && value.trim() !== '') {
                        state.commandOptions[option.id] = value;
                    }
                }
            }
        }
    });
    
        // Add listeners for multiselect changes
        command.options.forEach(option => {
            if (option.type === 'multiselect') {
                const checkboxes = document.querySelectorAll(`.multiselect-checkbox[data-option-id="${option.id}"]`);
                checkboxes.forEach(cb => {
                    cb.addEventListener('change', () => updateCommandOptions());
                });
            }
        });
}

// Handle environment change
function handleEnvironmentChange() {
    state.sourceEnv = elements.sourceEnv.value;
    state.targetEnv = elements.targetEnv.value;
    updateRunButtonState();
}

// Update run button state
function updateRunButtonState() {
    const canRun = state.command && 
                   !state.isRunning &&
                   validateCanRun();
    
    elements.runButton.disabled = !canRun;
    elements.runButton.style.display = state.isRunning ? 'none' : '';
    elements.cancelButton.style.display = state.isRunning ? '' : 'none';
}

// Validate if command can run
function validateCanRun() {
    if (!state.command) return false;
    
    const command = commands[state.command];
    if (!command || !command.options) return false;
    
    // Check required options
    for (const option of command.options) {
        // Check if this field is visible (not hidden by dependency)
        const dependentGroup = document.getElementById(`opt-group-${option.id}`);
        const isVisible = !dependentGroup || dependentGroup.style.display !== 'none';
        
        // Only validate if field is visible
        if (isVisible && option.required) {
            const value = state.commandOptions[option.id];
            if (option.type === 'multiselect' || option.type === 'entity-multiselect') {
                if (!value || !Array.isArray(value) || value.length === 0) {
                    return false;
                }
            } else {
                if (!value || (typeof value === 'string' && value.trim() === '')) {
                    return false;
                }
            }
        }
        
        // Check conditional requirements
        if (option.dependsOn) {
            const dependsOnElement = document.getElementById(`opt-${option.dependsOn}`);
            if (dependsOnElement) {
                let dependencyMet = false;
                if (dependsOnElement.type === 'checkbox') {
                    dependencyMet = dependsOnElement.checked;
                } else {
                    dependencyMet = dependsOnElement.value && dependsOnElement.value.trim() !== '';
                }
                
                // If dependency is met and field is required, validate it
                if (dependencyMet && option.required) {
                    const value = state.commandOptions[option.id];
                    if (option.type === 'multiselect' || option.type === 'entity-multiselect') {
                        if (!value || !Array.isArray(value) || value.length === 0) {
                            return false;
                        }
                    } else {
                        if (!value || (typeof value === 'string' && value.trim() === '')) {
                            return false;
                        }
                    }
                }
            }
        }
    }
    
    return true;
}

// Handle run command
async function handleRunCommand() {
    if (state.isRunning) {
        logger.warning('Command already running');
        return;
    }
    
    state.isRunning = true;
    state.commandStartTime = Date.now();
    updateRunButtonState();
    updateStatus('running', 'Running command...');
    updateProgress(0, 'Initializing command...', 'Starting');
    
    // Clear previous output
    elements.outputContainer.innerHTML = '';
    
    // Update command options
    updateCommandOptions();
    
    // Validate required options
    const validation = validateCommandOptions();
    if (!validation.valid) {
        showError('Validation Error', validation.message);
        state.isRunning = false;
        updateRunButtonState();
        updateStatus('ready', 'Ready');
        return;
    }
    
    logger.info(`Starting command: ${state.command}`);
    addOutput('info', `Starting command: ${state.command}`);
    
    try {
        // Execute command via server
        await executeCommandViaServer();
        
        updateProgress(100, 'Command completed successfully', 'Complete');
        updateStatus('success', 'Command completed successfully');
        logger.success(`Command ${state.command} completed successfully`);
        
        // Save to command history
        saveCommandToHistory(true, 'Command completed successfully');
        
        // Show notification if enabled
        const settings = getSettings();
        if (settings.notifications) {
            showBrowserNotification('Command Completed', `Command "${state.command}" completed successfully!`);
        }
        if (settings.soundAlerts) {
            playSoundAlert('success');
        }
        
        // Hide progress after a short delay
        setTimeout(() => {
            hideProgress();
        }, 2000);
    } catch (error) {
        updateProgress(0, 'Command failed', 'Error');
        updateStatus('error', 'Command failed');
        logger.error(`Command ${state.command} failed`, error);
        
        // Save to command history
        saveCommandToHistory(false, error?.message || 'Command failed');
        
        // Show notification if enabled
        const settings = getSettings();
        if (settings.notifications) {
            showBrowserNotification('Command Failed', `Command "${state.command}" failed. Check output for details.`);
        }
        if (settings.soundAlerts) {
            playSoundAlert('error');
        }
        
        // Parse and display enhanced error information
        const parsedError = parseError(error);
        showError(parsedError.title, parsedError.solution, parsedError.details);
        
        // Hide progress on error
        setTimeout(() => {
            hideProgress();
        }, 1000);
    } finally {
        state.isRunning = false;
        state.abortController = null;
        updateRunButtonState();
    }
}

// Validate command options
function validateCommandOptions() {
    if (!state.command) {
        return { valid: false, message: 'No command selected' };
    }
    
    const command = commands[state.command];
    if (!command || !command.options) {
        return { valid: false, message: 'Invalid command configuration' };
    }
    
    for (const option of command.options) {
        // Check if this field is visible (not hidden by dependency)
        const dependentGroup = document.getElementById(`opt-group-${option.id}`);
        const isVisible = !dependentGroup || dependentGroup.style.display !== 'none';
        
        // Only validate if field is visible
        if (isVisible && option.required) {
            const value = state.commandOptions[option.id];
            if (option.type === 'multiselect' || option.type === 'entity-multiselect') {
                if (!value || !Array.isArray(value) || value.length === 0) {
                    return { 
                        valid: false, 
                        message: `Required option "${option.label}" must have at least one item selected` 
                    };
                }
            } else {
                if (!value || (typeof value === 'string' && value.trim() === '')) {
                    return { 
                        valid: false, 
                        message: `Required option "${option.label}" is missing or empty` 
                    };
                }
            }
        }
        
        // Check conditional requirements (e.g., outPath required when advanced is checked)
        if (option.dependsOn) {
            const dependsOnElement = document.getElementById(`opt-${option.dependsOn}`);
            if (dependsOnElement) {
                let dependencyMet = false;
                if (dependsOnElement.type === 'checkbox') {
                    dependencyMet = dependsOnElement.checked;
                } else {
                    dependencyMet = dependsOnElement.value && dependsOnElement.value.trim() !== '';
                }
                
                // If dependency is met and field is required, validate it
                if (dependencyMet && option.required) {
                    const value = state.commandOptions[option.id];
                    if (option.type === 'multiselect' || option.type === 'entity-multiselect') {
                        if (!value || !Array.isArray(value) || value.length === 0) {
                            return { 
                                valid: false, 
                                message: `Required option "${option.label}" must have at least one item selected (required when "${option.dependsOn}" is enabled)` 
                            };
                        }
                    } else {
                        if (!value || (typeof value === 'string' && value.trim() === '')) {
                            return { 
                                valid: false, 
                                message: `Required option "${option.label}" is missing or empty (required when "${option.dependsOn}" is enabled)` 
                            };
                        }
                    }
                }
            }
        }
    }
    
    return { valid: true };
}

// Execute command via server
async function executeCommandViaServer() {
    return new Promise((resolve, reject) => {
        // Create abort controller for cancellation
        state.abortController = new AbortController();
        const signal = state.abortController.signal;
        
        // Use the command as-is (it's already in format like "environment backup")
        const command = state.command;
        const options = { ...state.commandOptions };
        
        // The options are already in the correct format from the form
        // Arrays are already arrays, booleans are booleans, etc.
        
        // Use fetch with streaming response for Server-Sent Events
        fetch(`${state.serverUrl}/api/execute`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                command: command,
                options: options
            }),
            signal: signal
        })
        .then(async (response) => {
            if (!response.ok) {
                try {
                    const error = await response.json();
                    throw new Error(error.error || 'Command execution failed');
                } catch {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
            }
            
            // Handle streaming response (Server-Sent Events format)
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    
                    if (done) {
                        // Check if we have any remaining data in buffer
                        if (buffer.trim()) {
                            processBuffer(buffer, resolve, reject);
                        }
                        // If we got here without a complete/error, assume success
                        resolve();
                        break;
                    }
                    
                    buffer += decoder.decode(value, { stream: true });
                    
                    // Process complete lines
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || ''; // Keep incomplete line in buffer
                    
                    for (const line of lines) {
                        if (line.trim().startsWith('data: ')) {
                            try {
                                const jsonStr = line.slice(6).trim();
                                if (!jsonStr) continue;
                                
                                const data = JSON.parse(jsonStr);
                                
                                if (data.type === 'output') {
                                    addOutput(data.level || 'info', data.message);
                                } else if (data.type === 'connected') {
                                    addOutput('info', data.message);
                                    updateProgress(5, 'Connected to command stream', 'Initializing');
                                } else if (data.type === 'progress') {
                                    // Handle explicit progress updates from server
                                    updateProgress(data.percent || 0, data.message || '', data.stage || '');
                                } else if (data.type === 'complete') {
                                    if (data.success) {
                                        updateProgress(100, 'Command completed successfully', 'Complete');
                                        addOutput('success', data.message);
                                        resolve();
                                        return;
                                    } else {
                                        updateProgress(0, 'Command failed', 'Error');
                                        addOutput('error', data.message);
                                        reject(new Error(data.message));
                                        return;
                                    }
                                } else if (data.type === 'error') {
                                    updateProgress(0, 'Error occurred', 'Error');
                                    addOutput('error', data.message);
                                    reject(new Error(data.message));
                                    return;
                                }
                            } catch {
                                // Invalid JSON, skip this line
                                console.warn('Failed to parse SSE data:', line);
                            }
                        }
                    }
                }
            } catch (error) {
                // Don't reject if it was an abort
                if (error.name === 'AbortError') {
                    addOutput('warning', 'Command cancelled by user');
                    resolve(); // Resolve instead of reject for cancellation
                    return;
                }
                reject(error);
            }
        })
        .catch(error => {
            // Handle abort errors gracefully
            if (error.name === 'AbortError') {
                addOutput('warning', 'Command cancelled by user');
                resolve();
            } else {
                reject(error);
            }
        });
    });
}

// Cancel running command
function cancelCommand() {
    if (state.abortController) {
        state.abortController.abort();
        state.abortController = null;
        state.isRunning = false;
        updateRunButtonState();
        updateStatus('ready', 'Command cancelled');
        updateProgress(0, 'Command cancelled', 'Cancelled');
        hideProgress();
        logger.warning('Command cancelled by user');
    }
}

// Process remaining buffer
function processBuffer(buffer, resolve, reject) {
    const lines = buffer.split('\n');
    for (const line of lines) {
        if (line.trim().startsWith('data: ')) {
            try {
                const jsonStr = line.slice(6).trim();
                if (!jsonStr) continue;
                
                const data = JSON.parse(jsonStr);
                if (data.type === 'complete' || data.type === 'error') {
                    if (data.type === 'complete' && data.success) {
                        resolve();
                        return;
                    } else {
                        reject(new Error(data.message));
                        return;
                    }
                }
            } catch {
                // Skip invalid JSON
            }
        }
    }
}

// Get or create output section
function getOrCreateOutputSection(sectionType, sectionLabel) {
    if (!elements.outputContainer) return null;
    
    const sectionId = `output-section-${sectionType}`;
    let section = state.outputSections.sections.get(sectionId);
    
    if (!section) {
        // Create new section
        const sectionElement = document.createElement('div');
        sectionElement.className = 'output-section-group';
        sectionElement.dataset.sectionId = sectionId;
        sectionElement.dataset.sectionType = sectionType;
        
        const sectionHeader = document.createElement('div');
        sectionHeader.className = 'output-section-header';
        sectionHeader.innerHTML = `
            <button class="section-toggle" data-section-id="${sectionId}" aria-label="Toggle section">
                <span class="section-toggle-icon">▼</span>
            </button>
            <span class="section-label">${sectionLabel}</span>
            <span class="section-count" data-section-id="${sectionId}">0</span>
        `;
        
        const sectionContent = document.createElement('div');
        sectionContent.className = 'output-section-content';
        sectionContent.dataset.sectionId = sectionId;
        
        sectionElement.appendChild(sectionHeader);
        sectionElement.appendChild(sectionContent);
        
        // Add click handler for toggle
        sectionHeader.querySelector('.section-toggle').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleOutputSection(sectionId);
        });
        
        elements.outputContainer.appendChild(sectionElement);
        
        section = {
            id: sectionId,
            type: sectionType,
            label: sectionLabel,
            count: 0,
            element: sectionElement,
            content: sectionContent,
            header: sectionHeader
        };
        
        state.outputSections.sections.set(sectionId, section);
    }
    
    return section;
}

// Toggle output section
function toggleOutputSection(sectionId) {
    const section = state.outputSections.sections.get(sectionId);
    if (!section) return;
    
    const isExpanded = !section.content.classList.contains('collapsed');
    section.content.classList.toggle('collapsed', isExpanded);
    
    const toggleIcon = section.header.querySelector('.section-toggle-icon');
    if (toggleIcon) {
        toggleIcon.textContent = isExpanded ? '▶' : '▼';
    }
}

// Expand all output sections
function expandAllOutputSections() {
    state.outputSections.sections.forEach(section => {
        section.content.classList.remove('collapsed');
        const toggleIcon = section.header.querySelector('.section-toggle-icon');
        if (toggleIcon) toggleIcon.textContent = '▼';
    });
}

// Collapse all output sections
function collapseAllOutputSections() {
    state.outputSections.sections.forEach(section => {
        section.content.classList.add('collapsed');
        const toggleIcon = section.header.querySelector('.section-toggle-icon');
        if (toggleIcon) toggleIcon.textContent = '▶';
    });
}

// Determine section type from message
function getSectionTypeFromMessage(type, message) {
    const lowerMessage = message.toLowerCase();
    
    // Error section
    if (type === 'error' || lowerMessage.includes('error') || lowerMessage.includes('failed') || lowerMessage.includes('exception')) {
        return 'error';
    }
    
    // Warning section
    if (type === 'warning' || lowerMessage.includes('warning') || lowerMessage.includes('warn')) {
        return 'warning';
    }
    
    // Success section
    if (type === 'success' || lowerMessage.includes('success') || lowerMessage.includes('completed') || lowerMessage.includes('finished')) {
        return 'success';
    }
    
    // Stage-based sections
    if (lowerMessage.includes('backing up') || lowerMessage.includes('backup')) {
        return 'backup';
    }
    if (lowerMessage.includes('restoring') || lowerMessage.includes('restore')) {
        return 'restore';
    }
    if (lowerMessage.includes('syncing') || lowerMessage.includes('sync')) {
        return 'sync';
    }
    if (lowerMessage.includes('fetching') || lowerMessage.includes('fetch')) {
        return 'fetch';
    }
    if (lowerMessage.includes('processing') || lowerMessage.includes('process')) {
        return 'process';
    }
    
    // Default to info
    return 'info';
}

// Get section label
function getSectionLabel(sectionType) {
    const labels = {
        'error': 'Errors',
        'warning': 'Warnings',
        'success': 'Success Messages',
        'backup': 'Backup Operations',
        'restore': 'Restore Operations',
        'sync': 'Sync Operations',
        'fetch': 'Fetching Data',
        'process': 'Processing',
        'info': 'Information'
    };
    return labels[sectionType] || 'Output';
}

// Add output line
function addOutput(type, message) {
    if (!elements.outputContainer) return;
    
    // Try to parse progress from output
    if (state.isRunning && type === 'info') {
        const progressInfo = parseProgressFromOutput(message);
        if (progressInfo) {
            if (progressInfo.percent !== null) {
                updateProgress(progressInfo.percent, progressInfo.message, progressInfo.stage);
            } else if (progressInfo.stage) {
                // Update stage without changing percent
                if (elements.progressText) {
                    elements.progressText.textContent = progressInfo.stage;
                }
            }
        }
    }
    
    // Store output in state (with size limit to prevent memory issues)
    // Limit output array size to prevent memory problems with long-running commands
    if (state.output.length >= MAX_OUTPUT_LINES) {
        // Remove oldest entries (keep most recent)
        const removeCount = Math.floor(MAX_OUTPUT_LINES * 0.1); // Remove 10% when limit reached
        state.output = state.output.slice(removeCount);
        
        // Update line numbers for remaining entries
        state.output.forEach((entry, index) => {
            entry.lineNumber = index + 1;
        });
        
        // Remove old DOM elements to free memory
        const outputLines = elements.outputContainer.querySelectorAll('.output-line');
        if (outputLines.length > MAX_OUTPUT_LINES * 0.9) {
            const linesToRemove = outputLines.length - Math.floor(MAX_OUTPUT_LINES * 0.9);
            for (let i = 0; i < linesToRemove; i++) {
                if (outputLines[i] && outputLines[i].parentNode) {
                    outputLines[i].parentNode.removeChild(outputLines[i]);
                }
            }
        }
        
        logger.warning(`Output limit reached (${MAX_OUTPUT_LINES} lines). Oldest entries removed.`);
    }
    
    const outputEntry = {
        type: type,
        message: message,
        timestamp: new Date().toISOString(),
        lineNumber: state.output.length + 1
    };
    state.output.push(outputEntry);
    
    // Determine section
    const sectionType = getSectionTypeFromMessage(type, message);
    const section = getOrCreateOutputSection(sectionType, getSectionLabel(sectionType));
    
    if (!section) return;
    
    // Update section count
    section.count++;
    const countElement = section.header.querySelector('.section-count');
    if (countElement) {
        countElement.textContent = section.count;
    }
    
    // Create output line
    const outputLine = document.createElement('div');
    outputLine.className = `output-line output-line-${type}`;
    outputLine.dataset.outputType = type;
    outputLine.dataset.lineNumber = outputEntry.lineNumber;
    
    // Add line number if enabled
    if (state.outputFilter.showLineNumbers) {
        const lineNum = document.createElement('span');
        lineNum.className = 'output-line-number';
        lineNum.textContent = `${outputEntry.lineNumber}: `;
        outputLine.appendChild(lineNum);
    }
    
    // Try to detect and format JSON/YAML
    const formattedMessage = formatOutputMessage(message, type);
    if (formattedMessage.isFormatted) {
        outputLine.innerHTML += formattedMessage.html;
    } else {
        outputLine.appendChild(document.createTextNode(message));
    }
    
    const placeholder = elements.outputContainer.querySelector('.output-placeholder');
    if (placeholder) {
        placeholder.remove();
    }
    
    // Show controls when there's output
    if (elements.copyOutput) {
        elements.copyOutput.style.display = '';
    }
    if (elements.exportOutput) {
        elements.exportOutput.style.display = '';
    }
    if (elements.outputControls) {
        elements.outputControls.style.display = '';
    }
    
    // Append to section content
    section.content.appendChild(outputLine);
    
    // Apply current filters
    applyOutputFilters(outputLine);
    
    // Check if virtual scrolling should be enabled
    if (state.output.length >= VIRTUAL_SCROLL_THRESHOLD && !state.virtualScroll.enabled) {
        enableVirtualScrolling();
    }
    
    // If virtual scrolling is enabled, update visible range
    if (state.virtualScroll.enabled) {
        updateVirtualScroll();
    } else {
        // Throttle scroll updates for better performance with large outputs
        throttleScrollUpdate();
    }
}

// Throttled scroll update for better performance
let scrollUpdatePending = false;
function throttleScrollUpdate() {
    if (!scrollUpdatePending && elements.outputContainer) {
        scrollUpdatePending = true;
        requestAnimationFrame(() => {
            if (elements.outputContainer) {
                elements.outputContainer.scrollTop = elements.outputContainer.scrollHeight;
            }
            scrollUpdatePending = false;
        });
    }
}

// Virtual scrolling implementation
function enableVirtualScrolling() {
    if (!elements.outputContainer || state.virtualScroll.enabled) return;
    
    state.virtualScroll.enabled = true;
    state.virtualScroll.containerHeight = elements.outputContainer.clientHeight;
    state.virtualScroll.totalHeight = state.output.length * state.virtualScroll.itemHeight;
    
    // Add scroll listener
    elements.outputContainer.addEventListener('scroll', throttle(() => {
        updateVirtualScroll();
    }, 16)); // ~60fps
    
    // Add resize observer for container height changes
    if (window.ResizeObserver) {
        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                state.virtualScroll.containerHeight = entry.contentRect.height;
                updateVirtualScroll();
            }
        });
        resizeObserver.observe(elements.outputContainer);
    }
    
    logger.info('Virtual scrolling enabled for large output');
    updateVirtualScroll();
}

function updateVirtualScroll() {
    if (!state.virtualScroll.enabled || !elements.outputContainer) return;
    
    const scrollTop = elements.outputContainer.scrollTop;
    const containerHeight = elements.outputContainer.clientHeight || state.virtualScroll.containerHeight;
    const itemHeight = state.virtualScroll.itemHeight;
    const totalItems = state.output.length;
    
    // Calculate visible range
    const visibleRange = calculateVisibleRange(
        scrollTop,
        itemHeight,
        containerHeight,
        totalItems,
        VIRTUAL_SCROLL_BUFFER
    );
    
    state.virtualScroll.visibleStart = visibleRange.start;
    state.virtualScroll.visibleEnd = visibleRange.end;
    state.virtualScroll.scrollTop = scrollTop;
    
    // Update DOM visibility
    updateOutputVisibility();
}

function calculateVisibleRange(scrollTop, itemHeight, containerHeight, totalItems, buffer = 5) {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
    const end = Math.min(totalItems, Math.ceil((scrollTop + containerHeight) / itemHeight) + buffer);
    const offset = start * itemHeight;
    
    return { start, end, offset };
}

function updateOutputVisibility() {
    if (!elements.outputContainer) return;
    
    const { visibleStart, visibleEnd } = state.virtualScroll;
    let lineIndex = 0;
    
    // Update visibility for all output lines
    state.outputSections.sections.forEach(section => {
        const lines = section.content.querySelectorAll('.output-line');
        lines.forEach(line => {
            const shouldBeVisible = lineIndex >= visibleStart && lineIndex < visibleEnd;
            
            // Only update if visibility changed
            if (line.dataset.virtualVisible !== String(shouldBeVisible)) {
                if (shouldBeVisible) {
                    line.style.display = '';
                    line.dataset.virtualVisible = 'true';
                } else {
                    // Keep element but make it invisible and zero-height
                    line.style.display = 'none';
                    line.style.height = '0';
                    line.style.overflow = 'hidden';
                    line.dataset.virtualVisible = 'false';
                }
            }
            
            lineIndex++;
        });
    });
    
    // Update spacer height for non-visible items
    updateVirtualScrollSpacer();
}

function updateVirtualScrollSpacer() {
    if (!elements.outputContainer) return;
    
    const { visibleStart, visibleEnd, itemHeight } = state.virtualScroll;
    const totalItems = state.output.length;
    
    // Calculate spacer heights
    const topSpacerHeight = visibleStart * itemHeight;
    const bottomSpacerHeight = Math.max(0, (totalItems - visibleEnd) * itemHeight);
    
    // Get or create spacer elements
    let topSpacer = elements.outputContainer.querySelector('.virtual-scroll-spacer-top');
    let bottomSpacer = elements.outputContainer.querySelector('.virtual-scroll-spacer-bottom');
    
    if (topSpacerHeight > 0) {
        if (!topSpacer) {
            topSpacer = document.createElement('div');
            topSpacer.className = 'virtual-scroll-spacer-top';
            elements.outputContainer.insertBefore(topSpacer, elements.outputContainer.firstChild);
        }
        topSpacer.style.height = `${topSpacerHeight}px`;
    } else if (topSpacer) {
        topSpacer.remove();
    }
    
    if (bottomSpacerHeight > 0) {
        if (!bottomSpacer) {
            bottomSpacer = document.createElement('div');
            bottomSpacer.className = 'virtual-scroll-spacer-bottom';
            elements.outputContainer.appendChild(bottomSpacer);
        }
        bottomSpacer.style.height = `${bottomSpacerHeight}px`;
    } else if (bottomSpacer) {
        bottomSpacer.remove();
    }
}

// Alias for addOutput (for backward compatibility with workflow functions)
const appendOutput = addOutput;

// Format output message (detect JSON/YAML and format)
function formatOutputMessage(message, type) {
    // Try to detect JSON
    const jsonMatch = message.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
        try {
            const jsonObj = JSON.parse(jsonMatch[0]);
            const formatted = JSON.stringify(jsonObj, null, 2);
            return {
                isFormatted: true,
                html: `<pre class="output-json"><code>${escapeHtml(formatted)}</code></pre>`
            };
        } catch {
            // Not valid JSON, continue
        }
    }
    
    // Try to detect YAML-like structure
    if (message.includes(':') && (message.includes('-') || message.includes('|'))) {
        return {
            isFormatted: true,
            html: `<pre class="output-yaml"><code>${escapeHtml(message)}</code></pre>`
        };
    }
    
    return { isFormatted: false, html: message };
}

// Escape HTML for safe display
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Filter output based on current filters
function filterOutput() {
    if (!elements.outputContainer) return;
    
    const searchTerm = state.outputFilter.searchTerm.toLowerCase();
    const logLevel = state.outputFilter.logLevel;
    
    // Filter lines and update section visibility
    state.outputSections.sections.forEach(section => {
        let visibleCount = 0;
        
        section.content.querySelectorAll('.output-line').forEach(line => {
            const lineType = line.dataset.outputType;
            const lineText = line.textContent.toLowerCase();
            
            let shouldShow = true;
            
            // Filter by log level
            if (logLevel !== 'all' && lineType !== logLevel) {
                shouldShow = false;
            }
            
            // Filter by search term
            if (shouldShow && searchTerm && !lineText.includes(searchTerm)) {
                shouldShow = false;
            }
            
            line.style.display = shouldShow ? '' : 'none';
            if (shouldShow) visibleCount++;
        });
        
        // Hide section if no visible lines
        section.element.style.display = visibleCount > 0 ? '' : 'none';
    });
}

// Apply filters to a single output line
function applyOutputFilters(outputLine) {
    const searchTerm = state.outputFilter.searchTerm.toLowerCase();
    const logLevel = state.outputFilter.logLevel;
    const lineType = outputLine.dataset.outputType;
    const lineText = outputLine.textContent.toLowerCase();
    
    let shouldShow = true;
    
    if (logLevel !== 'all' && lineType !== logLevel) {
        shouldShow = false;
    }
    
    if (shouldShow && searchTerm && !lineText.includes(searchTerm)) {
        shouldShow = false;
    }
    
    outputLine.style.display = shouldShow ? '' : 'none';
}

// Update line numbers visibility
function updateOutputLineNumbers() {
    if (!elements.outputContainer) return;
    
    elements.outputContainer.querySelectorAll('.output-line').forEach(line => {
        let lineNum = line.querySelector('.output-line-number');
        
        if (state.outputFilter.showLineNumbers) {
            if (!lineNum) {
                lineNum = document.createElement('span');
                lineNum.className = 'output-line-number';
                line.insertBefore(lineNum, line.firstChild);
            }
            lineNum.textContent = `${line.dataset.lineNumber}: `;
        } else {
            if (lineNum) {
                lineNum.remove();
            }
        }
    });
}

// Copy output to clipboard
async function handleCopyOutput() {
    if (!elements.outputContainer) return;
    
    const outputLines = Array.from(elements.outputContainer.querySelectorAll('.output-line'))
        .map(line => line.textContent)
        .join('\n');
    
    if (!outputLines.trim()) {
        showToast('No output to copy', 'warning');
        return;
    }
    
    try {
        await navigator.clipboard.writeText(outputLines);
        showToast('Output copied to clipboard!', 'success');
        logger.info('Output copied to clipboard');
    } catch {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = outputLines;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showToast('Output copied to clipboard!', 'success');
            logger.info('Output copied to clipboard (fallback method)');
        } catch (e) {
            showToast('Failed to copy output', 'error');
            logger.error('Failed to copy output', e);
        }
        document.body.removeChild(textArea);
    }
}

// Copy logs to clipboard
async function handleCopyLogs() {
    const logs = logger.getLogs();
    const logText = logs.map(log => 
        `[${log.timestamp}] ${log.level}: ${log.message}${log.data ? ' ' + JSON.stringify(log.data, null, 2) : ''}`
    ).join('\n');
    
    if (!logText.trim()) {
        showToast('No logs to copy', 'warning');
        return;
    }
    
    try {
        await navigator.clipboard.writeText(logText);
        showToast('Logs copied to clipboard!', 'success');
        logger.info('Logs copied to clipboard');
    } catch {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = logText;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showToast('Logs copied to clipboard!', 'success');
            logger.info('Logs copied to clipboard (fallback method)');
        } catch (e) {
            showToast('Failed to copy logs', 'error');
            logger.error('Failed to copy logs', e);
        }
        document.body.removeChild(textArea);
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 3000);
}

// Show browser notification
function showBrowserNotification(title, message) {
    if (!('Notification' in window)) {
        return;
    }
    
    if (Notification.permission === 'granted') {
        new Notification(title, {
            body: message,
            icon: '/favicon.ico'
        });
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                new Notification(title, {
                    body: message,
                    icon: '/favicon.ico'
                });
            }
        });
    }
}

// Play sound alert
function playSoundAlert(type) {
    // Create audio context for simple beep sounds
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        if (type === 'success') {
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
        } else if (type === 'error') {
            oscillator.frequency.value = 400;
            oscillator.type = 'sawtooth';
        } else {
            oscillator.frequency.value = 600;
            oscillator.type = 'sine';
        }
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
        // Silently fail if audio context is not available
        console.warn('Could not play sound alert:', error);
    }
}

// Statistics Functions

// Calculate and render statistics
function renderStatistics() {
    if (!elements.statisticsContent) return;
    
    const history = getCommandHistory();
    
    if (history.length === 0) {
        elements.statisticsContent.innerHTML = '<div class="statistics-empty">No command history available. Run some commands to see statistics.</div>';
        return;
    }
    
    // Calculate statistics
    const stats = calculateStatistics(history);
    
    let html = '<div class="statistics-grid">';
    
    // Overall Statistics
    html += '<div class="stat-card">';
    html += '<h3>Overall Statistics</h3>';
    html += `<div class="stat-item"><span class="stat-label">Total Commands:</span><span class="stat-value">${stats.totalCommands}</span></div>`;
    html += `<div class="stat-item"><span class="stat-label">Success Rate:</span><span class="stat-value">${stats.successRate}%</span></div>`;
    html += `<div class="stat-item"><span class="stat-label">Average Execution Time:</span><span class="stat-value">${stats.avgExecutionTime}</span></div>`;
    html += `<div class="stat-item"><span class="stat-label">Total Execution Time:</span><span class="stat-value">${stats.totalExecutionTime}</span></div>`;
    html += '</div>';
    
    // Command Breakdown
    html += '<div class="stat-card">';
    html += '<h3>Command Breakdown</h3>';
    html += '<div class="command-stats">';
    stats.commandBreakdown.forEach(cmd => {
        const successPercent = cmd.total > 0 ? Math.round((cmd.success / cmd.total) * 100) : 0;
        html += '<div class="command-stat-item">';
        html += `<div class="command-stat-header">`;
        html += `<span class="command-name">${cmd.name}</span>`;
        html += `<span class="command-count">${cmd.total} executions</span>`;
        html += `</div>`;
        html += `<div class="command-stat-details">`;
        html += `<span class="stat-badge success">${cmd.success} success</span>`;
        html += `<span class="stat-badge error">${cmd.failure} failed</span>`;
        html += `<span class="stat-badge info">${successPercent}% success rate</span>`;
        html += `<span class="stat-badge">Avg: ${cmd.avgTime}</span>`;
        html += `</div>`;
        html += '</div>';
    });
    html += '</div>';
    html += '</div>';
    
    // Most Used Commands
    html += '<div class="stat-card">';
    html += '<h3>Most Used Commands</h3>';
    html += '<div class="most-used-list">';
    stats.mostUsed.slice(0, 5).forEach((cmd, index) => {
        html += `<div class="most-used-item">`;
        html += `<span class="rank">#${index + 1}</span>`;
        html += `<span class="command-name">${cmd.name}</span>`;
        html += `<span class="usage-count">${cmd.count} times</span>`;
        html += `</div>`;
    });
    html += '</div>';
    html += '</div>';
    
    // Recent Activity
    html += '<div class="stat-card">';
    html += '<h3>Recent Activity (Last 7 Days)</h3>';
    html += '<div class="recent-activity">';
    const recentCommands = history.filter(entry => {
        const entryDate = new Date(entry.timestamp);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return entryDate >= sevenDaysAgo;
    });
    
    if (recentCommands.length === 0) {
        html += '<div class="no-activity">No commands executed in the last 7 days</div>';
    } else {
        const recentStats = calculateStatistics(recentCommands);
        html += `<div class="stat-item"><span class="stat-label">Commands Executed:</span><span class="stat-value">${recentStats.totalCommands}</span></div>`;
        html += `<div class="stat-item"><span class="stat-label">Success Rate:</span><span class="stat-value">${recentStats.successRate}%</span></div>`;
    }
    html += '</div>';
    html += '</div>';
    
    html += '</div>';
    
    elements.statisticsContent.innerHTML = html;
}

// Calculate statistics from history
function calculateStatistics(history) {
    const stats = {
        totalCommands: history.length,
        successCount: 0,
        failureCount: 0,
        totalExecutionTime: 0,
        commandBreakdown: {},
        mostUsed: []
    };
    
    // Process each history entry
    history.forEach(entry => {
        if (entry.success) {
            stats.successCount++;
        } else {
            stats.failureCount++;
        }
        
        if (entry.executionTime) {
            stats.totalExecutionTime += entry.executionTime;
        }
        
        // Command breakdown
        if (!stats.commandBreakdown[entry.command]) {
            stats.commandBreakdown[entry.command] = {
                name: entry.command,
                total: 0,
                success: 0,
                failure: 0,
                totalTime: 0
            };
        }
        
        const cmd = stats.commandBreakdown[entry.command];
        cmd.total++;
        if (entry.success) {
            cmd.success++;
        } else {
            cmd.failure++;
        }
        if (entry.executionTime) {
            cmd.totalTime += entry.executionTime;
        }
    });
    
    // Calculate success rate
    stats.successRate = stats.totalCommands > 0 
        ? Math.round((stats.successCount / stats.totalCommands) * 100) 
        : 0;
    
    // Calculate average execution time
    const avgTimeMs = stats.totalCommands > 0 
        ? stats.totalExecutionTime / stats.totalCommands 
        : 0;
    stats.avgExecutionTime = formatExecutionTime(avgTimeMs);
    stats.totalExecutionTime = formatExecutionTime(stats.totalExecutionTime);
    
    // Convert command breakdown to array and calculate averages
    stats.commandBreakdown = Object.values(stats.commandBreakdown).map(cmd => ({
        ...cmd,
        avgTime: cmd.total > 0 ? formatExecutionTime(cmd.totalTime / cmd.total) : '0s'
    })).sort((a, b) => b.total - a.total);
    
    // Most used commands
    stats.mostUsed = Object.values(stats.commandBreakdown)
        .map(cmd => ({ name: cmd.name, count: cmd.total }))
        .sort((a, b) => b.count - a.count);
    
    return stats;
}

// Format execution time
function formatExecutionTime(ms) {
    if (ms < 1000) {
        return `${Math.round(ms)}ms`;
    } else if (ms < 60000) {
        return `${(ms / 1000).toFixed(1)}s`;
    } else {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
    }
}

// Settings Functions

// Get settings from storage (using storage utilities)
function getSettings() {
    const settings = getStorageItem(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
    return { ...DEFAULT_SETTINGS, ...settings };
}

// Save settings to storage (using storage utilities)
function saveSettingsToStorage() {
    const settings = {
        autoSave: document.getElementById('setting-auto-save')?.checked ?? DEFAULT_SETTINGS.autoSave,
        showLineNumbers: document.getElementById('setting-show-line-numbers')?.checked ?? DEFAULT_SETTINGS.showLineNumbers,
        notifications: document.getElementById('setting-notifications')?.checked ?? DEFAULT_SETTINGS.notifications,
        soundAlerts: document.getElementById('setting-sound-alerts')?.checked ?? DEFAULT_SETTINGS.soundAlerts,
        maxHistory: parseInt(document.getElementById('setting-max-history')?.value || DEFAULT_SETTINGS.maxHistory, 10),
        cacheExpiry: parseInt(document.getElementById('setting-cache-expiry')?.value || DEFAULT_SETTINGS.cacheExpiry, 10),
        theme: document.getElementById('setting-theme')?.value || DEFAULT_SETTINGS.theme,
        fontSize: document.getElementById('setting-font-size')?.value || DEFAULT_SETTINGS.fontSize
    };
    
    if (setStorageItem(STORAGE_KEYS.SETTINGS, settings)) {
        applySettings(settings);
        showToast('Settings saved successfully!', 'success');
        logger.info('Settings saved');
    } else {
        showToast('Failed to save settings', 'error');
        logger.error('Failed to save settings');
    }
}

// Load settings into UI
function loadSettings() {
    const settings = getSettings();
    
    if (document.getElementById('setting-auto-save')) {
        document.getElementById('setting-auto-save').checked = settings.autoSave;
    }
    if (document.getElementById('setting-show-line-numbers')) {
        document.getElementById('setting-show-line-numbers').checked = settings.showLineNumbers;
    }
    if (document.getElementById('setting-notifications')) {
        document.getElementById('setting-notifications').checked = settings.notifications;
    }
    if (document.getElementById('setting-sound-alerts')) {
        document.getElementById('setting-sound-alerts').checked = settings.soundAlerts;
    }
    if (document.getElementById('setting-max-history')) {
        document.getElementById('setting-max-history').value = settings.maxHistory;
    }
    if (document.getElementById('setting-cache-expiry')) {
        document.getElementById('setting-cache-expiry').value = settings.cacheExpiry;
    }
    if (document.getElementById('setting-theme')) {
        document.getElementById('setting-theme').value = settings.theme;
    }
    if (document.getElementById('setting-font-size')) {
        document.getElementById('setting-font-size').value = settings.fontSize;
    }
    
    applySettings(settings);
}

// Apply settings to app
function applySettings(settings) {
    // Apply theme
    if (settings.theme === 'dark') {
        document.body.classList.add('theme-dark');
    } else if (settings.theme === 'light') {
        document.body.classList.remove('theme-dark');
    } else {
        // Auto theme based on system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
            document.body.classList.add('theme-dark');
        } else {
            document.body.classList.remove('theme-dark');
        }
    }
    
    // Apply font size
    document.body.className = document.body.className.replace(/font-size-\w+/g, '');
    document.body.classList.add(`font-size-${settings.fontSize}`);
    
    // Update line numbers default
    if (elements.outputLineNumbers) {
        elements.outputLineNumbers.checked = settings.showLineNumbers;
        state.outputFilter.showLineNumbers = settings.showLineNumbers;
        updateOutputLineNumbers();
    }
}

// Reset settings to defaults
function resetSettingsToDefaults() {
    if (!confirm('Are you sure you want to reset all settings to defaults?')) {
        return;
    }
    
    removeStorageItem(STORAGE_KEYS.SETTINGS);
    loadSettings();
    showToast('Settings reset to defaults', 'success');
}

// Update storage used display (using storage utilities)
function updateStorageUsed() {
    if (!document.getElementById('storage-used')) return;
    
    try {
        let totalSize = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('dataOps_')) {
                const value = getStorageItem(key);
                if (value) {
                    // Estimate size (JSON stringified)
                    totalSize += JSON.stringify(value).length + key.length;
                }
            }
        }
        
        const sizeStr = formatStorageSize(totalSize);
        document.getElementById('storage-used').textContent = sizeStr;
    } catch (error) {
        document.getElementById('storage-used').textContent = 'Unknown';
    }
}

// Format storage size
function formatStorageSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Clear all data
function handleClearAllData() {
    if (!confirm('Are you sure you want to clear ALL app data? This includes:\n- Command history\n- Templates\n- Environment profiles\n- Entity cache\n- Form state\n\nThis action cannot be undone!')) {
        return;
    }
    
    try {
        Object.values(STORAGE_KEYS).forEach(key => {
            // Clear all keys that start with the storage key prefix
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const storageKey = localStorage.key(i);
                if (storageKey && (storageKey === key || storageKey.startsWith(key + '_'))) {
                    removeStorageItem(storageKey);
                }
            }
        });
        
        // Reload page to reset state
        location.reload();
    } catch (error) {
        showToast('Failed to clear data', 'error');
        logger.error('Failed to clear all data', error);
    }
}

// Export all data
function handleExportAllData() {
    try {
        const allData = {
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            data: {}
        };
        
        Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
            const value = getStorageItem(key);
            if (value !== null) {
                allData.data[name] = value;
            }
        });
        
        // Also export all keys that start with storage key prefixes
        for (let i = 0; i < localStorage.length; i++) {
            const storageKey = localStorage.key(i);
            if (storageKey && storageKey.startsWith('dataOps_')) {
                const value = getStorageItem(storageKey);
                if (value !== null && !allData.data[storageKey]) {
                    allData.data[storageKey] = value;
                }
            }
        }
        
        const dataJson = JSON.stringify(allData, null, 2);
        const blob = new Blob([dataJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `data-ops-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast('All data exported successfully!', 'success');
    } catch (error) {
        showToast('Failed to export data', 'error');
        logger.error('Failed to export all data', error);
    }
}

// Import all data
function handleImportAllData() {
    if (!confirm('Importing data will replace all current app data. Are you sure?')) {
        return;
    }
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                
                if (!importedData.data) {
                    showToast('Invalid data format', 'error');
                    return;
                }
                
                // Import data (using storage utilities)
                Object.entries(importedData.data).forEach(([key, value]) => {
                    setStorageItem(key, value);
                });
                
                showToast('Data imported successfully! Reloading page...', 'success');
                setTimeout(() => {
                    location.reload();
                }, 1500);
            } catch (error) {
                showToast('Failed to parse import file', 'error');
                logger.error('Failed to import data', error);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// Template Management Functions

// Get all templates
function getTemplates() {
    return getStorageItem(STORAGE_KEYS.TEMPLATES, {});
}

// Save templates (using storage utilities)
function saveTemplates(templates) {
    setStorageItem(STORAGE_KEYS.TEMPLATES, templates);
}

// Load templates into dropdown
function loadTemplates() {
    if (!elements.templateSelect) return;
    
    const templates = getTemplates();
    const commandTemplates = templates[state.command] || [];
    
    elements.templateSelect.innerHTML = '<option value="">No template selected</option>';
    
    commandTemplates.forEach((template, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = template.name || `Template ${index + 1}`;
        elements.templateSelect.appendChild(option);
    });
}

// Save current configuration as template
function handleSaveTemplate() {
    if (!state.command) {
        showToast('Please select a command first', 'warning');
        return;
    }
    
    const templateName = prompt('Enter a name for this template:');
    if (!templateName || !templateName.trim()) {
        return;
    }
    
    // Get current configuration (excluding API keys for security)
    const safeOptions = { ...state.commandOptions };
    Object.keys(safeOptions).forEach(key => {
        if (key.toLowerCase().includes('apikey') || key.toLowerCase().includes('key')) {
            delete safeOptions[key];
        }
    });
    
    const template = {
        name: templateName.trim(),
        command: state.command,
        sourceEnv: state.sourceEnv,
        targetEnv: state.targetEnv,
        options: safeOptions,
        createdAt: new Date().toISOString()
    };
    
    const templates = getTemplates();
    if (!templates[state.command]) {
        templates[state.command] = [];
    }
    templates[state.command].push(template);
    saveTemplates(templates);
    
    loadTemplates();
    showToast('Template saved successfully!', 'success');
    logger.info(`Template "${templateName}" saved`);
}

// Load selected template
function handleLoadTemplate() {
    if (!elements.templateSelect || !elements.templateSelect.value) {
        showToast('Please select a template to load', 'warning');
        return;
    }
    
    const templates = getTemplates();
    const commandTemplates = templates[state.command] || [];
    const templateIndex = parseInt(elements.templateSelect.value, 10);
    const template = commandTemplates[templateIndex];
    
    if (!template) {
        showToast('Template not found', 'error');
        return;
    }
    
    // Load template configuration
    if (template.command === state.command) {
        if (template.sourceEnv) {
            state.sourceEnv = template.sourceEnv;
            if (elements.sourceEnv) elements.sourceEnv.value = template.sourceEnv;
        }
        if (template.targetEnv) {
            state.targetEnv = template.targetEnv;
            if (elements.targetEnv) elements.targetEnv.value = template.targetEnv;
        }
        
        // Load options after form is rendered
        setTimeout(() => {
            if (template.options) {
                Object.entries(template.options).forEach(([key, value]) => {
                    const element = document.getElementById(`opt-${key}`);
                    if (element) {
                        if (element.type === 'checkbox') {
                            element.checked = value;
                        } else if (Array.isArray(value)) {
                            // Handle multiselect/entity-multiselect
                            if (element.type === 'checkbox') {
                                // This is handled by entity multiselect
                            } else {
                                // For regular multiselects
                                value.forEach(val => {
                                    const checkbox = document.querySelector(`.multiselect-checkbox[data-option-id="${key}"][value="${val}"]`);
                                    if (checkbox) checkbox.checked = true;
                                });
                            }
                        } else {
                            element.value = value;
                        }
                    }
                });
            }
            updateCommandOptions();
            updateRunButtonState();
            saveFormState();
        }, 100);
        
        showToast(`Template "${template.name}" loaded successfully!`, 'success');
        logger.info(`Template "${template.name}" loaded`);
    } else {
        showToast('Template command does not match current command', 'error');
    }
}

// Delete selected template
function handleDeleteTemplate() {
    if (!elements.templateSelect || !elements.templateSelect.value) {
        showToast('Please select a template to delete', 'warning');
        return;
    }
    
    const templateName = elements.templateSelect.options[elements.templateSelect.selectedIndex].textContent;
    if (!confirm(`Are you sure you want to delete template "${templateName}"?`)) {
        return;
    }
    
    const templates = getTemplates();
    const commandTemplates = templates[state.command] || [];
    const templateIndex = parseInt(elements.templateSelect.value, 10);
    
    commandTemplates.splice(templateIndex, 1);
    templates[state.command] = commandTemplates;
    saveTemplates(templates);
    
    loadTemplates();
    showToast('Template deleted successfully', 'success');
    logger.info(`Template "${templateName}" deleted`);
}

// Export template as JSON
function handleExportTemplate() {
    if (!elements.templateSelect || !elements.templateSelect.value) {
        showToast('Please select a template to export', 'warning');
        return;
    }
    
    const templates = getTemplates();
    const commandTemplates = templates[state.command] || [];
    const templateIndex = parseInt(elements.templateSelect.value, 10);
    const template = commandTemplates[templateIndex];
    
    if (!template) {
        showToast('Template not found', 'error');
        return;
    }
    
    const templateJson = JSON.stringify(template, null, 2);
    const blob = new Blob([templateJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.name || 'template'}-${state.command.replace(/\s+/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('Template exported successfully!', 'success');
    logger.info(`Template "${template.name}" exported`);
}

// Import template from JSON
function handleImportTemplate() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const template = JSON.parse(event.target.result);
                
                // Validate template structure
                if (!template.command || !template.name) {
                    showToast('Invalid template format', 'error');
                    return;
                }
                
                // If template is for current command, add it
                if (template.command === state.command) {
                    const templates = getTemplates();
                    if (!templates[state.command]) {
                        templates[state.command] = [];
                    }
                    templates[state.command].push(template);
                    saveTemplates(templates);
                    loadTemplates();
                    showToast(`Template "${template.name}" imported successfully!`, 'success');
                    logger.info(`Template "${template.name}" imported`);
                } else {
                    showToast(`Template is for command "${template.command}", but current command is "${state.command}"`, 'warning');
                }
            } catch (error) {
                showToast('Failed to parse template file', 'error');
                logger.error('Failed to import template', error);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// Command History Functions

// Save command to history
function saveCommandToHistory(success, resultMessage) {
    try {
        const history = getCommandHistory();
        
        // Get current command configuration (excluding API keys for security)
        const safeOptions = { ...state.commandOptions };
        Object.keys(safeOptions).forEach(key => {
            if (key.toLowerCase().includes('apikey') || key.toLowerCase().includes('key')) {
                delete safeOptions[key];
            }
        });
        
        const historyEntry = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            command: state.command,
            sourceEnv: state.sourceEnv,
            targetEnv: state.targetEnv,
            options: safeOptions,
            success: success,
            resultMessage: resultMessage,
            executionTime: Date.now() - (state.commandStartTime || Date.now())
        };
        
        history.unshift(historyEntry);
        
        // Keep only last MAX_HISTORY_ENTRIES
        if (history.length > MAX_HISTORY_ENTRIES) {
            history.splice(MAX_HISTORY_ENTRIES);
        }
        
        setStorageItem(STORAGE_KEYS.COMMAND_HISTORY, history);
        renderCommandHistory();
    } catch (error) {
        console.warn('Failed to save command history:', error);
    }
}

// Get command history
function getCommandHistory() {
    return getStorageItem(STORAGE_KEYS.COMMAND_HISTORY, []);
}

// Render command history
function renderCommandHistory() {
    if (!elements.historyContainer) return;
    
    const history = getCommandHistory();
    const searchTerm = elements.historySearch?.value.toLowerCase() || '';
    const filterCommand = elements.historyFilter?.value || 'all';
    
    if (history.length === 0) {
        elements.historyContainer.innerHTML = '<div class="history-placeholder">No command history yet. Run a command to see it here.</div>';
        return;
    }
    
    // Filter history
    const filteredHistory = history.filter(entry => {
        const matchesSearch = !searchTerm || 
            entry.command.toLowerCase().includes(searchTerm) ||
            entry.resultMessage?.toLowerCase().includes(searchTerm);
        const matchesFilter = filterCommand === 'all' || entry.command === filterCommand;
        return matchesSearch && matchesFilter;
    });
    
    if (filteredHistory.length === 0) {
        elements.historyContainer.innerHTML = '<div class="history-placeholder">No matching history entries found.</div>';
        return;
    }
    
    let html = '';
    filteredHistory.forEach(entry => {
        const date = new Date(entry.timestamp);
        const dateStr = date.toLocaleString();
        const statusIcon = entry.success ? '✅' : '❌';
        const statusClass = entry.success ? 'success' : 'error';
        
        html += `<div class="history-entry ${statusClass}" data-history-id="${entry.id}">`;
        html += `<div class="history-entry-header">`;
        html += `<span class="history-status">${statusIcon}</span>`;
        html += `<span class="history-command">${entry.command}</span>`;
        html += `<span class="history-date">${dateStr}</span>`;
        html += `<button class="btn-rerun" data-history-id="${entry.id}" title="Re-run this command">🔄</button>`;
        html += `</div>`;
        html += `<div class="history-entry-details">`;
        html += `<div class="history-result">${entry.resultMessage || (entry.success ? 'Success' : 'Failed')}</div>`;
        if (entry.executionTime) {
            const seconds = (entry.executionTime / 1000).toFixed(2);
            html += `<div class="history-time">Execution time: ${seconds}s</div>`;
        }
        html += `<button class="btn-view-details" data-history-id="${entry.id}">View Details</button>`;
        html += `</div>`;
        html += `</div>`;
    });
    
    elements.historyContainer.innerHTML = html;
    
    // Add event listeners
    elements.historyContainer.querySelectorAll('.btn-rerun').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const historyId = e.target.dataset.historyId;
            rerunCommandFromHistory(historyId);
        });
    });
    
    elements.historyContainer.querySelectorAll('.btn-view-details').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const historyId = e.target.dataset.historyId;
            showHistoryDetails(historyId);
        });
    });
}

// Re-run command from history
function rerunCommandFromHistory(historyId) {
    const history = getCommandHistory();
    const entry = history.find(e => e.id === historyId);
    
    if (!entry) {
        showToast('History entry not found', 'error');
        return;
    }
    
    // Load command configuration
    state.command = entry.command;
    if (elements.commandSelect) {
        elements.commandSelect.value = entry.command;
    }
    
    // Load environments
    if (entry.sourceEnv) {
        state.sourceEnv = entry.sourceEnv;
        if (elements.sourceEnv) {
            elements.sourceEnv.value = entry.sourceEnv;
        }
    }
    if (entry.targetEnv) {
        state.targetEnv = entry.targetEnv;
        if (elements.targetEnv) {
            elements.targetEnv.value = entry.targetEnv;
        }
    }
    
    // Render command options and load them
    if (commands[entry.command]) {
        renderCommandOptions(entry.command);
        setTimeout(() => {
            if (entry.options) {
                Object.entries(entry.options).forEach(([key, value]) => {
                    const element = document.getElementById(`opt-${key}`);
                    if (element) {
                        if (element.type === 'checkbox') {
                            element.checked = value;
                        } else if (Array.isArray(value)) {
                            // Handle multiselect
                            value.forEach(val => {
                                const checkbox = document.querySelector(`.multiselect-checkbox[data-option-id="${key}"][value="${val}"]`);
                                if (checkbox) checkbox.checked = true;
                            });
                        } else {
                            element.value = value;
                        }
                    }
                });
            }
            updateCommandOptions();
            updateRunButtonState();
            showToast('Command configuration loaded. Click "Run Command" to execute.', 'info');
        }, 100);
    }
}

// Show history entry details
function showHistoryDetails(historyId) {
    const history = getCommandHistory();
    const entry = history.find(e => e.id === historyId);
    
    if (!entry) {
        showToast('History entry not found', 'error');
        return;
    }
    
    const details = `
        <strong>Command:</strong> ${entry.command}<br>
        <strong>Timestamp:</strong> ${new Date(entry.timestamp).toLocaleString()}<br>
        <strong>Status:</strong> ${entry.success ? 'Success' : 'Failed'}<br>
        <strong>Result:</strong> ${entry.resultMessage || 'N/A'}<br>
        <strong>Source Environment:</strong> ${entry.sourceEnv || 'N/A'}<br>
        <strong>Target Environment:</strong> ${entry.targetEnv || 'N/A'}<br>
        <strong>Options:</strong><pre>${JSON.stringify(entry.options, null, 2)}</pre>
    `;
    
    showError('Command History Details', details);
}

// Filter history
function filterHistory() {
    renderCommandHistory();
}

// Clear command history
function handleClearHistory() {
    if (!confirm('Are you sure you want to clear all command history?')) {
        return;
    }
    
    removeStorageItem(STORAGE_KEYS.COMMAND_HISTORY);
    renderCommandHistory();
    showToast('Command history cleared', 'success');
}

// Export command history
function handleExportHistory() {
    const history = getCommandHistory();
    if (history.length === 0) {
        showToast('No history to export', 'warning');
        return;
    }
    
    const historyJson = JSON.stringify(history, null, 2);
    const blob = new Blob([historyJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `data-ops-history-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('History exported successfully!', 'success');
}

// Toggle history section
function handleToggleHistory() {
    const container = elements.historyContainer?.closest('.history-section');
    if (!container) return;
    
    const isHidden = container.style.display === 'none';
    container.style.display = isHidden ? '' : 'none';
    if (elements.toggleHistory) {
        elements.toggleHistory.textContent = isHidden ? 'Hide History' : 'Show History';
    }
}

// Load command history on init
function loadCommandHistory() {
    renderCommandHistory();
}

// Environment Profile Functions

// Get environment profiles
function getProfiles() {
    return getStorageItem(STORAGE_KEYS.ENVIRONMENT_PROFILES, []);
}

// Save environment profiles (using storage utilities)
function saveProfiles(profiles) {
    setStorageItem(STORAGE_KEYS.ENVIRONMENT_PROFILES, profiles);
}

// Load profiles into dropdown
function loadProfiles() {
    if (!elements.profileSelect) return;
    
    const profiles = getProfiles();
    elements.profileSelect.innerHTML = '<option value="">No profile selected</option>';
    
    profiles.forEach((profile, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = profile.name;
        elements.profileSelect.appendChild(option);
    });
    
    // Show profiles section if there are profiles or when saving
    if (profiles.length > 0 && elements.profilesSection) {
        elements.profilesSection.style.display = '';
    }
}

// Save current environment as profile
function handleSaveProfile() {
    // Get environment ID and API key from form
    const command = commands[state.command];
    if (!command) {
        showToast('Please select a command first', 'warning');
        return;
    }
    
    const environmentId = getEnvironmentIdFromForm(command);
    const apiKey = getApiKeyFromForm(command);
    
    if (!environmentId || !apiKey) {
        showToast('Please enter Environment ID and API Key first', 'warning');
        return;
    }
    
    const profileName = prompt('Enter a name for this environment profile:');
    if (!profileName || !profileName.trim()) {
        return;
    }
    
    // Note: In a real app, you'd want to encrypt API keys
    // For now, we'll store them (user is aware of security implications)
    const profile = {
        name: profileName.trim(),
        environmentId: environmentId,
        apiKey: apiKey, // In production, encrypt this
        createdAt: new Date().toISOString()
    };
    
    const profiles = getProfiles();
    profiles.push(profile);
    saveProfiles(profiles);
    
    loadProfiles();
    showToast('Profile saved successfully!', 'success');
    logger.info(`Profile "${profileName}" saved`);
}

// Load selected profile
function handleLoadProfile() {
    if (!elements.profileSelect || !elements.profileSelect.value) {
        showToast('Please select a profile to load', 'warning');
        return;
    }
    
    const profiles = getProfiles();
    const profileIndex = parseInt(elements.profileSelect.value, 10);
    const profile = profiles[profileIndex];
    
    if (!profile) {
        showToast('Profile not found', 'error');
        return;
    }
    
    // Fill in environment ID and API key fields
    const command = commands[state.command];
    if (command) {
        const envIdField = document.getElementById('opt-environmentId') || 
                          document.getElementById('opt-sourceEnvironmentId') || 
                          document.getElementById('opt-targetEnvironmentId');
        const apiKeyField = document.getElementById('opt-apiKey') || 
                           document.getElementById('opt-sourceApiKey') || 
                           document.getElementById('opt-targetApiKey');
        
        if (envIdField) envIdField.value = profile.environmentId;
        if (apiKeyField) apiKeyField.value = profile.apiKey;
        
        updateCommandOptions();
        saveFormState();
        showToast(`Profile "${profile.name}" loaded successfully!`, 'success');
        logger.info(`Profile "${profile.name}" loaded`);
    }
}

// Delete selected profile
function handleDeleteProfile() {
    if (!elements.profileSelect || !elements.profileSelect.value) {
        showToast('Please select a profile to delete', 'warning');
        return;
    }
    
    const profileName = elements.profileSelect.options[elements.profileSelect.selectedIndex].textContent;
    if (!confirm(`Are you sure you want to delete profile "${profileName}"?`)) {
        return;
    }
    
    const profiles = getProfiles();
    const profileIndex = parseInt(elements.profileSelect.value, 10);
    profiles.splice(profileIndex, 1);
    saveProfiles(profiles);
    
    loadProfiles();
    showToast('Profile deleted successfully', 'success');
    logger.info(`Profile "${profileName}" deleted`);
}

// Export profiles
function handleExportProfiles() {
    const profiles = getProfiles();
    if (profiles.length === 0) {
        showToast('No profiles to export', 'warning');
        return;
    }
    
    // Remove API keys for export (security)
    const safeProfiles = profiles.map(p => ({
        name: p.name,
        environmentId: p.environmentId,
        createdAt: p.createdAt
    }));
    
    const profilesJson = JSON.stringify(safeProfiles, null, 2);
    const blob = new Blob([profilesJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `data-ops-profiles-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('Profiles exported successfully! (API keys excluded for security)', 'success');
}

// Import profiles
function handleImportProfiles() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedProfiles = JSON.parse(event.target.result);
                
                if (!Array.isArray(importedProfiles)) {
                    showToast('Invalid profile format', 'error');
                    return;
                }
                
                // Note: Imported profiles won't have API keys (they were excluded in export)
                // User will need to re-enter them
                const profiles = getProfiles();
                importedProfiles.forEach(profile => {
                    if (!profiles.find(p => p.name === profile.name && p.environmentId === profile.environmentId)) {
                        profiles.push({
                            ...profile,
                            apiKey: '' // User needs to enter API key
                        });
                    }
                });
                saveProfiles(profiles);
                loadProfiles();
                showToast(`${importedProfiles.length} profile(s) imported. Note: API keys need to be entered manually.`, 'info');
            } catch (error) {
                showToast('Failed to parse profile file', 'error');
                logger.error('Failed to import profiles', error);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// Show profile selector
function showProfileSelector(type) {
    const profiles = getProfiles();
    if (profiles.length === 0) {
        showToast('No profiles available. Save a profile first.', 'warning');
        return;
    }
    
    const profileList = profiles.map((p, i) => `${i + 1}. ${p.name} (${p.environmentId})`).join('\n');
    const selection = prompt(`Select a profile (1-${profiles.length}):\n\n${profileList}`);
    const index = parseInt(selection, 10) - 1;
    
    if (index >= 0 && index < profiles.length) {
        const profile = profiles[index];
        const envField = type === 'source' ? elements.sourceEnv : elements.targetEnv;
        if (envField) {
            envField.value = profile.environmentId;
            handleEnvironmentChange();
        }
        
        // Also fill in API key if command options are visible
        const command = commands[state.command];
        if (command) {
            const apiKeyField = document.getElementById('opt-apiKey') || 
                               document.getElementById('opt-sourceApiKey') || 
                               document.getElementById('opt-targetApiKey');
            if (apiKeyField) {
                apiKeyField.value = profile.apiKey;
                updateCommandOptions();
            }
        }
        
        showToast(`Profile "${profile.name}" applied`, 'success');
    }
}

// Update status
function updateStatus(status, text) {
    if (!elements.statusIcon || !elements.statusText) return;
    
    elements.statusIcon.textContent = 
        status === 'running' ? '🔄' :
        status === 'success' ? '✅' :
        status === 'error' ? '❌' : '⚪';
    
    elements.statusIcon.className = `status-icon status-${status}`;
    elements.statusText.textContent = text;
}

// Update progress indicator
function updateProgress(percent, message = '', stage = '') {
    if (!elements.progressContainer || !elements.progressBar) return;
    
    const clampedPercent = Math.min(100, Math.max(0, percent));
    state.progress.current = clampedPercent;
    state.progress.message = message;
    state.progress.stage = stage;
    
    elements.progressBar.style.width = `${clampedPercent}%`;
    
    if (elements.progressPercent) {
        elements.progressPercent.textContent = `${Math.round(clampedPercent)}%`;
    }
    
    if (elements.progressText) {
        const displayMessage = message || stage || 'Processing...';
        elements.progressText.textContent = displayMessage;
    }
    
    // Show progress container when command is running
    if (state.isRunning && elements.progressContainer) {
        elements.progressContainer.style.display = '';
    }
}

// Hide progress indicator
function hideProgress() {
    if (elements.progressContainer) {
        elements.progressContainer.style.display = 'none';
    }
    state.progress = { current: 0, total: 100, message: '', stage: '' };
}

// Parse progress from CLI output
function parseProgressFromOutput(message) {
    // Look for common progress patterns in CLI output
    const progressPatterns = [
        /(\d+)%\s*[\/\\]\s*(\d+)/, // "50% / 100"
        /(\d+)\s*of\s*(\d+)/i, // "50 of 100"
        /progress[:\s]+(\d+)%/i, // "Progress: 50%"
        /(\d+)\/(\d+)/, // "50/100"
        /\[(\d+)%\]/, // "[50%]"
        /backing up|restoring|syncing|processing/i // Stage indicators
    ];
    
    for (const pattern of progressPatterns) {
        const match = message.match(pattern);
        if (match) {
            if (match[1] && match[2]) {
                // Percentage calculation
                const current = parseInt(match[1], 10);
                const total = parseInt(match[2], 10);
                if (!isNaN(current) && !isNaN(total) && total > 0) {
                    return { percent: (current / total) * 100, message, stage: '' };
                }
            } else if (match[1]) {
                // Direct percentage
                const percent = parseInt(match[1], 10);
                if (!isNaN(percent)) {
                    return { percent, message, stage: '' };
                }
            }
        }
    }
    
    // Check for stage indicators
    const stagePatterns = [
        { pattern: /backing up/i, stage: 'Backing up data...' },
        { pattern: /restoring/i, stage: 'Restoring data...' },
        { pattern: /syncing/i, stage: 'Synchronizing...' },
        { pattern: /processing/i, stage: 'Processing...' },
        { pattern: /validating/i, stage: 'Validating...' },
        { pattern: /fetching/i, stage: 'Fetching data...' },
        { pattern: /uploading/i, stage: 'Uploading...' },
        { pattern: /downloading/i, stage: 'Downloading...' }
    ];
    
    for (const { pattern, stage } of stagePatterns) {
        if (pattern.test(message)) {
            return { percent: null, message, stage };
        }
    }
    
    return null;
}

// Show error modal
function showError(title, solution = null, details = null) {
    if (!elements.errorModal || !elements.errorMessage) return;
    
    // Update error message with title
    elements.errorMessage.innerHTML = `<strong>${title}</strong>`;
    
    // Add details if provided
    if (details) {
        elements.errorMessage.innerHTML += details;
    }
    
    if (solution) {
        elements.errorSolution.innerHTML = solution;
        elements.errorSolution.style.display = 'block';
    } else {
        elements.errorSolution.style.display = 'none';
    }
    
    elements.errorModal.classList.add('active');
    
    // Highlight the problematic field if identified
    if (details && details.field) {
        const fieldElement = document.getElementById(`opt-${details.field}`);
        if (fieldElement) {
            fieldElement.classList.add('error-field');
            fieldElement.focus();
            setTimeout(() => {
                fieldElement.classList.remove('error-field');
            }, 3000);
        }
    }
}

// Close error modal
function closeErrorModal() {
    if (elements.errorModal) {
        elements.errorModal.classList.remove('active');
    }
}

// Parse error to extract actionable information
function parseError(error) {
    const errorMessage = error?.message || String(error);
    const lowerError = errorMessage.toLowerCase();
    
    // Extract error details from CLI output
    const errorDetails = {
        title: 'Command Execution Error',
        message: errorMessage,
        solution: '',
        details: '',
        field: null,
        errorType: 'unknown'
    };
    
    // Parse specific error patterns
    const errorPatterns = [
        {
            pattern: /environment[_\s]?id|environmentId/i,
            type: 'environment_id',
            title: 'Invalid Environment ID',
            solution: `
                <h3>Possible Solutions:</h3>
                <ul>
                    <li>Verify the Environment ID is correct (format: GUID)</li>
                    <li>Check that the environment exists in your Kontent.ai project</li>
                    <li>Ensure you have access to the specified environment</li>
                </ul>
            `,
            field: 'environmentId'
        },
        {
            pattern: /api[_\s]?key|apikey|unauthorized|401|403/i,
            type: 'authentication',
            title: 'Authentication Error',
            solution: `
                <h3>Possible Solutions:</h3>
                <ul>
                    <li>Verify your Management API key is correct</li>
                    <li>Ensure you're using Management API keys, not Delivery API keys</li>
                    <li>Check if the API key has the required permissions</li>
                    <li>Regenerate API keys if necessary from Kontent.ai project settings</li>
                    <li>Verify the API key hasn't expired</li>
                </ul>
            `,
            field: 'apiKey'
        },
        {
            pattern: /file.*not found|file.*does not exist|cannot find.*file|enoent/i,
            type: 'file_not_found',
            title: 'File Not Found',
            solution: `
                <h3>Possible Solutions:</h3>
                <ul>
                    <li>Verify the file path is correct</li>
                    <li>Check that the file exists at the specified location</li>
                    <li>Ensure you have read permissions for the file</li>
                    <li>For backup files, verify the file name and extension (.zip)</li>
                    <li>Use absolute paths if relative paths don't work</li>
                </ul>
            `,
            field: 'fileName'
        },
        {
            pattern: /network|connection|timeout|econnrefused|fetch failed/i,
            type: 'network',
            title: 'Network Error',
            solution: `
                <h3>Possible Solutions:</h3>
                <ul>
                    <li>Check your internet connection</li>
                    <li>Verify the server is running and accessible</li>
                    <li>Check firewall settings</li>
                    <li>Verify Kontent.ai API endpoints are accessible</li>
                    <li>Try again after a few moments</li>
                </ul>
            `
        },
        {
            pattern: /required|missing|validation|invalid.*parameter/i,
            type: 'validation',
            title: 'Validation Error',
            solution: `
                <h3>Possible Solutions:</h3>
                <ul>
                    <li>Ensure all required fields are filled</li>
                    <li>Check that file paths are valid</li>
                    <li>Verify environment IDs are in the correct format</li>
                    <li>Ensure input files exist if importing/restoring</li>
                    <li>Check that selected entities are valid</li>
                </ul>
            `
        },
        {
            pattern: /permission|access denied|forbidden|403/i,
            type: 'permission',
            title: 'Permission Error',
            solution: `
                <h3>Possible Solutions:</h3>
                <ul>
                    <li>Check that your API key has the required permissions</li>
                    <li>Verify you have access to the specified environment</li>
                    <li>Ensure your user role has the necessary permissions</li>
                    <li>Contact your Kontent.ai administrator if needed</li>
                </ul>
            `
        },
        {
            pattern: /not found|404|does not exist/i,
            type: 'not_found',
            title: 'Resource Not Found',
            solution: `
                <h3>Possible Solutions:</h3>
                <ul>
                    <li>Verify the resource (environment, file, etc.) exists</li>
                    <li>Check that IDs and names are correct</li>
                    <li>Ensure you have access to the resource</li>
                </ul>
            `
        },
        {
            pattern: /data-ops|cli|command not found|enoent/i,
            type: 'cli_not_found',
            title: 'Data-Ops CLI Not Found',
            solution: `
                <h3>Possible Solutions:</h3>
                <ul>
                    <li>Ensure the data-ops CLI is installed: <code>npm install -g @kontent-ai/data-ops</code></li>
                    <li>Verify it's in your PATH</li>
                    <li>Or set the DATA_OPS_CLI_PATH environment variable</li>
                    <li>Restart the server after installation</li>
                </ul>
            `
        }
    ];
    
    // Match error patterns
    for (const pattern of errorPatterns) {
        if (pattern.pattern.test(errorMessage)) {
            errorDetails.errorType = pattern.type;
            errorDetails.title = pattern.title;
            errorDetails.solution = pattern.solution;
            if (pattern.field) {
                errorDetails.field = pattern.field;
            }
            break;
        }
    }
    
    // Extract specific details from error message
    const detailPatterns = [
        { pattern: /environment[_\s]?id[:\s]+([^\s,]+)/i, label: 'Environment ID' },
        { pattern: /file[:\s]+([^\n]+)/i, label: 'File' },
        { pattern: /path[:\s]+([^\n]+)/i, label: 'Path' },
        { pattern: /code[:\s]+(\d+)/i, label: 'Error Code' }
    ];
    
    const extractedDetails = [];
    for (const { pattern, label } of detailPatterns) {
        const match = errorMessage.match(pattern);
        if (match && match[1]) {
            extractedDetails.push(`${label}: ${match[1].trim()}`);
        }
    }
    
    if (extractedDetails.length > 0) {
        errorDetails.details = `<p><strong>Error Details:</strong></p><ul>${extractedDetails.map(d => `<li>${d}</li>`).join('')}</ul>`;
    }
    
    // If no specific pattern matched, use generic solution
    if (!errorDetails.solution) {
        errorDetails.solution = `
            <h3>Possible Solutions:</h3>
            <ul>
                <li>Check the error message above for specific details</li>
                <li>Review the logs section for more information</li>
                <li>Verify all inputs are correct</li>
                <li>Ensure the data-ops CLI is installed and accessible</li>
                <li>Try the operation again</li>
                <li>Check the <a href="https://github.com/kontent-ai/data-ops" target="_blank">data-ops documentation</a> for more help</li>
            </ul>
        `;
    }
    
    return errorDetails;
}

// Get error solution (backward compatibility)
function getErrorSolution(error) {
    const parsed = parseError(error);
    return parsed.solution + (parsed.details || '');
}

// Handle clear output
function handleClearOutput() {
    // Reset output state
    state.output = [];
    state.outputSections.sections.clear();
    state.virtualScroll.enabled = false;
    state.virtualScroll.visibleStart = 0;
    state.virtualScroll.visibleEnd = 0;
    
    if (elements.outputContainer) {
        elements.outputContainer.innerHTML = '<div class="output-placeholder">Output will appear here...</div>';
        if (elements.copyOutput) {
            elements.copyOutput.style.display = 'none';
        }
        if (elements.exportOutput) {
            elements.exportOutput.style.display = 'none';
        }
        if (elements.outputControls) {
            elements.outputControls.style.display = 'none';
        }
    }
    state.output = [];
    state.outputSections.sections.clear();
    state.virtualScroll.enabled = false;
    state.virtualScroll.visibleStart = 0;
    state.virtualScroll.visibleEnd = 0;
    state.outputFilter = { searchTerm: '', logLevel: 'all', showLineNumbers: true };
    if (elements.outputSearch) elements.outputSearch.value = '';
    if (elements.outputLevelFilter) elements.outputLevelFilter.value = 'all';
    if (elements.outputLineNumbers) elements.outputLineNumbers.checked = true;
    logger.info('Output cleared');
}

// Export output as file
async function handleExportOutput() {
    if (!elements.outputContainer) return;
    
    const outputLines = Array.from(elements.outputContainer.querySelectorAll('.output-line'))
        .filter(line => line.style.display !== 'none')
        .map(line => line.textContent)
        .join('\n');
    
    if (!outputLines.trim()) {
        showToast('No output to export', 'warning');
        return;
    }
    
    // Create file with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `data-ops-output-${timestamp}.txt`;
    
    const blob = new Blob([outputLines], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('Output exported successfully!', 'success');
    logger.info('Output exported to file');
}

// Handle download logs
function handleDownloadLogs() {
    const logs = logger.getLogs();
    const logText = logs.map(log => 
        `[${log.timestamp}] ${log.level}: ${log.message}${log.data ? ' ' + JSON.stringify(log.data, null, 2) : ''}`
    ).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `data-ops-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    logger.info('Logs downloaded');
}

// Handle toggle logs
function handleToggleLogs() {
    const logsSection = document.querySelector('.logs-section');
    if (!logsSection) return;
    
    const isCollapsed = logsSection.classList.contains('collapsed');
    
    if (isCollapsed) {
        logsSection.classList.remove('collapsed');
        elements.toggleLogs.textContent = 'Hide Logs';
    } else {
        logsSection.classList.add('collapsed');
        elements.toggleLogs.textContent = 'Show Logs';
    }
}

// ============================================
// WORKFLOWS / BATCH OPERATIONS
// ============================================

// Workflow state
const workflowState = {
    workflows: {},
    currentWorkflow: null,
    isRunning: false
};

// Setup workflows
function setupWorkflows() {
    // Load saved workflows
    loadWorkflows();
    
    // Event listeners for workflow UI
    const newWorkflowBtn = document.getElementById('new-workflow');
    const saveWorkflowBtn = document.getElementById('save-workflow');
    const deleteWorkflowBtn = document.getElementById('delete-workflow');
    const exportWorkflowBtn = document.getElementById('export-workflow');
    const runWorkflowBtn = document.getElementById('run-workflow');
    const addStepBtn = document.getElementById('add-workflow-step');
    const loadTemplateBtn = document.getElementById('load-workflow-template');
    
    if (newWorkflowBtn) {
        newWorkflowBtn.addEventListener('click', createNewWorkflow);
    }
    if (saveWorkflowBtn) {
        saveWorkflowBtn.addEventListener('click', saveCurrentWorkflow);
    }
    if (deleteWorkflowBtn) {
        deleteWorkflowBtn.addEventListener('click', deleteCurrentWorkflow);
    }
    if (exportWorkflowBtn) {
        exportWorkflowBtn.addEventListener('click', exportCurrentWorkflow);
    }
    if (runWorkflowBtn) {
        runWorkflowBtn.addEventListener('click', runWorkflow);
    }
    if (addStepBtn) {
        addStepBtn.addEventListener('click', addWorkflowStep);
    }
    if (loadTemplateBtn) {
        loadTemplateBtn.addEventListener('click', loadWorkflowTemplate);
    }
    
    // Workflow list container
    const workflowListContainer = document.getElementById('workflow-list-container');
    if (workflowListContainer) {
        renderWorkflowList();
    }
}

// Load workflows from storage
function loadWorkflows() {
    workflowState.workflows = getStorageItem(STORAGE_KEYS.WORKFLOWS, {});
}

// Save workflows to storage
function saveWorkflows() {
    setStorageItem(STORAGE_KEYS.WORKFLOWS, workflowState.workflows);
}

// Render workflow list
function renderWorkflowList() {
    const container = document.getElementById('workflow-list-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    Object.entries(workflowState.workflows).forEach(([id, workflow]) => {
        const item = document.createElement('div');
        item.className = `workflow-list-item ${workflowState.currentWorkflow === id ? 'active' : ''}`;
        item.innerHTML = `
            <span class="workflow-list-name">${workflow.name || 'Unnamed Workflow'}</span>
            <span class="workflow-list-steps">${workflow.steps?.length || 0} steps</span>
        `;
        item.addEventListener('click', () => loadWorkflow(id));
        item.setAttribute('role', 'button');
        item.setAttribute('tabindex', '0');
        item.setAttribute('aria-label', `Load workflow: ${workflow.name || 'Unnamed'}`);
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                loadWorkflow(id);
            }
        });
        container.appendChild(item);
    });
}

// Create new workflow
function createNewWorkflow() {
    const id = `workflow_${Date.now()}`;
    const workflow = {
        id,
        name: 'New Workflow',
        steps: [],
        stopOnError: true,
        executionMode: 'sequential'
    };
    
    workflowState.workflows[id] = workflow;
    workflowState.currentWorkflow = id;
    saveWorkflows();
    renderWorkflowList();
    renderWorkflowEditor();
}

// Load workflow
function loadWorkflow(id) {
    if (!workflowState.workflows[id]) return;
    
    workflowState.currentWorkflow = id;
    renderWorkflowList();
    renderWorkflowEditor();
}

// Render workflow editor
function renderWorkflowEditor() {
    const editor = document.getElementById('workflow-editor');
    const empty = document.getElementById('workflow-empty');
    
    if (!workflowState.currentWorkflow || !workflowState.workflows[workflowState.currentWorkflow]) {
        if (editor) editor.style.display = 'none';
        if (empty) empty.style.display = 'block';
        return;
    }
    
    if (empty) empty.style.display = 'none';
    if (editor) editor.style.display = 'block';
    
    const workflow = workflowState.workflows[workflowState.currentWorkflow];
    
    // Update workflow name input
    const nameInput = document.getElementById('workflow-name');
    if (nameInput) {
        nameInput.value = workflow.name || '';
    }
    
    // Update settings
    const stopOnError = document.getElementById('workflow-stop-on-error');
    if (stopOnError) {
        stopOnError.checked = workflow.stopOnError !== false;
    }
    
    const executionMode = document.querySelector(`input[name="workflow-execution"][value="${workflow.executionMode || 'sequential'}"]`);
    if (executionMode) {
        executionMode.checked = true;
    }
    
    // Render steps
    renderWorkflowSteps();
    
    // Update run button
    const runBtn = document.getElementById('run-workflow');
    if (runBtn) {
        runBtn.disabled = !workflow.steps || workflow.steps.length === 0 || workflowState.isRunning;
    }
}

// Render workflow steps
function renderWorkflowSteps() {
    const container = document.getElementById('workflow-steps-container');
    if (!container || !workflowState.currentWorkflow) return;
    
    const workflow = workflowState.workflows[workflowState.currentWorkflow];
    container.innerHTML = '';
    
    if (!workflow.steps || workflow.steps.length === 0) {
        container.innerHTML = '<p class="workflow-no-steps">No steps added yet. Click "+ Add Step" to add a command.</p>';
        return;
    }
    
    workflow.steps.forEach((step, index) => {
        const stepDiv = document.createElement('div');
        stepDiv.className = 'workflow-step';
        stepDiv.innerHTML = `
            <div class="workflow-step-header">
                <span class="workflow-step-number">${index + 1}</span>
                <select class="workflow-step-command" data-step-index="${index}">
                    <option value="">Select command...</option>
                    ${Object.keys(commands).map(cmd => 
                        `<option value="${cmd}" ${step.command === cmd ? 'selected' : ''}>${commands[cmd]?.name || cmd}</option>`
                    ).join('')}
                </select>
                <button class="btn-remove-step" data-step-index="${index}" aria-label="Remove step ${index + 1}">🗑️</button>
                <button class="btn-move-step-up" data-step-index="${index}" ${index === 0 ? 'disabled' : ''} aria-label="Move step up">⬆️</button>
                <button class="btn-move-step-down" data-step-index="${index}" ${index === workflow.steps.length - 1 ? 'disabled' : ''} aria-label="Move step down">⬇️</button>
            </div>
            <div class="workflow-step-options" data-step-index="${index}">
                ${step.command ? renderWorkflowStepOptions(step, index) : '<p class="workflow-step-placeholder">Select a command to configure options</p>'}
            </div>
        `;
        
        // Event listeners
        const commandSelect = stepDiv.querySelector('.workflow-step-command');
        commandSelect.addEventListener('change', (e) => {
            updateWorkflowStepCommand(index, e.target.value);
        });
        
        const removeBtn = stepDiv.querySelector('.btn-remove-step');
        removeBtn.addEventListener('click', () => removeWorkflowStep(index));
        
        const moveUpBtn = stepDiv.querySelector('.btn-move-step-up');
        moveUpBtn.addEventListener('click', () => moveWorkflowStep(index, -1));
        
        const moveDownBtn = stepDiv.querySelector('.btn-move-step-down');
        moveDownBtn.addEventListener('click', () => moveWorkflowStep(index, 1));
        
        container.appendChild(stepDiv);
    });
}

// Render workflow step options
function renderWorkflowStepOptions(step, index) {
    if (!step.command || !commands[step.command]) {
        return '<p>Command not found</p>';
    }
    
    const command = commands[step.command];
    let html = '<div class="workflow-step-options-form">';
    
    // Render options similar to main form
    command.options?.forEach(option => {
        const value = step.options?.[option.id] || '';
        html += renderWorkflowStepOption(option, value, index);
    });
    
    html += '</div>';
    return html;
}

// Render a single workflow step option
function renderWorkflowStepOption(option, value, stepIndex) {
    const inputId = `workflow-step-${stepIndex}-opt-${option.id}`;
    let html = `<div class="workflow-option-group" data-option-id="${option.id}">`;
    html += `<label for="${inputId}">${option.name}${option.required ? ' <span class="required">*</span>' : ''}</label>`;
    
    if (option.type === 'text' || option.type === 'password') {
        html += `<input type="${option.type}" id="${inputId}" class="form-control" value="${value || ''}" data-step-index="${stepIndex}" data-option-id="${option.id}" />`;
    } else if (option.type === 'checkbox') {
        html += `<input type="checkbox" id="${inputId}" ${value ? 'checked' : ''} data-step-index="${stepIndex}" data-option-id="${option.id}" />`;
    } else if (option.type === 'select') {
        html += `<select id="${inputId}" class="form-control" data-step-index="${stepIndex}" data-option-id="${option.id}">`;
        option.options?.forEach(opt => {
            html += `<option value="${opt.value}" ${value === opt.value ? 'selected' : ''}>${opt.label}</option>`;
        });
        html += `</select>`;
    }
    
    html += `</div>`;
    
    return html;
}

// Update workflow step command
function updateWorkflowStepCommand(stepIndex, commandName) {
    if (!workflowState.currentWorkflow) return;
    
    const workflow = workflowState.workflows[workflowState.currentWorkflow];
    if (!workflow.steps[stepIndex]) return;
    
    workflow.steps[stepIndex].command = commandName;
    workflow.steps[stepIndex].options = {};
    
    saveWorkflows();
    renderWorkflowSteps();
}

// Add workflow step
function addWorkflowStep() {
    if (!workflowState.currentWorkflow) {
        createNewWorkflow();
    }
    
    const workflow = workflowState.workflows[workflowState.currentWorkflow];
    if (!workflow.steps) {
        workflow.steps = [];
    }
    
    workflow.steps.push({
        command: '',
        options: {}
    });
    
    saveWorkflows();
    renderWorkflowSteps();
}

// Remove workflow step
function removeWorkflowStep(stepIndex) {
    if (!workflowState.currentWorkflow) return;
    
    const workflow = workflowState.workflows[workflowState.currentWorkflow];
    if (workflow.steps && workflow.steps[stepIndex]) {
        workflow.steps.splice(stepIndex, 1);
        saveWorkflows();
        renderWorkflowSteps();
    }
}

// Move workflow step
function moveWorkflowStep(stepIndex, direction) {
    if (!workflowState.currentWorkflow) return;
    
    const workflow = workflowState.workflows[workflowState.currentWorkflow];
    if (!workflow.steps || !workflow.steps[stepIndex]) return;
    
    const newIndex = stepIndex + direction;
    if (newIndex < 0 || newIndex >= workflow.steps.length) return;
    
    const temp = workflow.steps[stepIndex];
    workflow.steps[stepIndex] = workflow.steps[newIndex];
    workflow.steps[newIndex] = temp;
    
    saveWorkflows();
    renderWorkflowSteps();
}

// Save current workflow
function saveCurrentWorkflow() {
    if (!workflowState.currentWorkflow) return;
    
    const workflow = workflowState.workflows[workflowState.currentWorkflow];
    const nameInput = document.getElementById('workflow-name');
    const stopOnError = document.getElementById('workflow-stop-on-error');
    const executionMode = document.querySelector('input[name="workflow-execution"]:checked');
    
    if (nameInput) {
        workflow.name = nameInput.value || 'Unnamed Workflow';
    }
    if (stopOnError) {
        workflow.stopOnError = stopOnError.checked;
    }
    if (executionMode) {
        workflow.executionMode = executionMode.value;
    }
    
    // Collect step options
    workflow.steps?.forEach((step, index) => {
        if (!step.options) step.options = {};
        
        const command = commands[step.command];
        if (command) {
            command.options?.forEach(option => {
                const input = document.getElementById(`workflow-step-${index}-opt-${option.id}`);
                if (input) {
                    if (option.type === 'checkbox') {
                        step.options[option.id] = input.checked;
                    } else {
                        step.options[option.id] = input.value;
                    }
                }
            });
        }
    });
    
    saveWorkflows();
    renderWorkflowList();
    showToast('Workflow saved successfully!', 'success');
}

// Delete current workflow
function deleteCurrentWorkflow() {
    if (!workflowState.currentWorkflow) return;
    
    if (!confirm(`Are you sure you want to delete "${workflowState.workflows[workflowState.currentWorkflow].name}"?`)) {
        return;
    }
    
    delete workflowState.workflows[workflowState.currentWorkflow];
    workflowState.currentWorkflow = null;
    saveWorkflows();
    renderWorkflowList();
    renderWorkflowEditor();
    showToast('Workflow deleted', 'success');
}

// Export current workflow
function exportCurrentWorkflow() {
    if (!workflowState.currentWorkflow) return;
    
    const workflow = workflowState.workflows[workflowState.currentWorkflow];
    const data = JSON.stringify(workflow, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workflow-${workflow.name || 'unnamed'}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Workflow exported!', 'success');
}

// Load workflow template
function loadWorkflowTemplate() {
    const templateSelect = document.getElementById('workflow-template-select');
    if (!templateSelect || !templateSelect.value) return;
    
    const template = getWorkflowTemplate(templateSelect.value);
    if (!template) {
        showToast('Template not found', 'error');
        return;
    }
    
    createNewWorkflow();
    const workflow = workflowState.workflows[workflowState.currentWorkflow];
    Object.assign(workflow, template);
    workflow.id = workflowState.currentWorkflow;
    
    saveWorkflows();
    renderWorkflowList();
    renderWorkflowEditor();
    showToast('Template loaded!', 'success');
}

// Get workflow template
function getWorkflowTemplate(templateId) {
    const templates = {
        'backup-sync': {
            name: 'Backup → Sync',
            steps: [
                { command: 'environment backup', options: {} },
                { command: 'sync run', options: {} }
            ],
            stopOnError: true,
            executionMode: 'sequential'
        },
        'backup-restore': {
            name: 'Backup → Restore',
            steps: [
                { command: 'environment backup', options: {} },
                { command: 'environment restore', options: {} }
            ],
            stopOnError: true,
            executionMode: 'sequential'
        },
        'sync-diff': {
            name: 'Sync → Diff',
            steps: [
                { command: 'sync run', options: {} },
                { command: 'sync diff', options: {} }
            ],
            stopOnError: true,
            executionMode: 'sequential'
        }
    };
    
    return templates[templateId];
}

// Run workflow
async function runWorkflow() {
    if (!workflowState.currentWorkflow || workflowState.isRunning) return;
    
    const workflow = workflowState.workflows[workflowState.currentWorkflow];
    if (!workflow.steps || workflow.steps.length === 0) {
        showToast('Workflow has no steps', 'error');
        return;
    }
    
    // Save current workflow state first
    saveCurrentWorkflow();
    
    workflowState.isRunning = true;
    const runBtn = document.getElementById('run-workflow');
    if (runBtn) runBtn.disabled = true;
    
    logger.info(`Starting workflow: ${workflow.name}`);
    appendOutput(`\n=== Starting Workflow: ${workflow.name} ===\n`, 'info');
    
    const executionMode = workflow.executionMode || 'sequential';
    let allSuccess = true;
    
    try {
        if (executionMode === 'parallel') {
            // Run all steps in parallel
            const promises = workflow.steps.map((step, index) => 
                executeWorkflowStep(step, index, workflow.steps.length)
            );
            const results = await Promise.allSettled(promises);
            allSuccess = results.every(r => r.status === 'fulfilled' && r.value);
        } else {
            // Run steps sequentially
            for (let i = 0; i < workflow.steps.length; i++) {
                const step = workflow.steps[i];
                const success = await executeWorkflowStep(step, i, workflow.steps.length);
                
                if (!success && workflow.stopOnError) {
                    allSuccess = false;
                    logger.error(`Workflow stopped at step ${i + 1} due to error`);
                    appendOutput(`\n⚠️ Workflow stopped at step ${i + 1} due to error\n`, 'error');
                    break;
                }
                
                if (!success) {
                    allSuccess = false;
                }
            }
        }
        
        if (allSuccess) {
            logger.success(`Workflow "${workflow.name}" completed successfully`);
            appendOutput(`\n✅ Workflow "${workflow.name}" completed successfully\n`, 'success');
            showToast('Workflow completed successfully!', 'success');
        } else {
            logger.warning(`Workflow "${workflow.name}" completed with errors`);
            appendOutput(`\n⚠️ Workflow "${workflow.name}" completed with errors\n`, 'warning');
            showToast('Workflow completed with errors', 'warning');
        }
    } catch (error) {
        logger.error('Workflow execution failed', error);
        appendOutput(`\n❌ Workflow execution failed: ${error.message}\n`, 'error');
        showToast('Workflow execution failed', 'error');
    } finally {
        workflowState.isRunning = false;
        if (runBtn) runBtn.disabled = false;
    }
}

// Execute a single workflow step
async function executeWorkflowStep(step, stepIndex, totalSteps) {
    if (!step.command) {
        logger.warning(`Step ${stepIndex + 1} has no command`);
        return false;
    }
    
    logger.info(`Executing step ${stepIndex + 1}/${totalSteps}: ${step.command}`);
    appendOutput(`\n--- Step ${stepIndex + 1}/${totalSteps}: ${step.command} ---\n`, 'info');
    
    try {
        // Build command options
        const options = {
            ...step.options,
            // Add environment info if not present
            environmentId: step.options.environmentId || state.sourceEnv,
            apiKey: step.options.apiKey || ''
        };
        
        // Execute command via API
        const response = await fetch(`${state.serverUrl}/api/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                command: step.command,
                options: options
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        // Stream output
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(line => line.trim());
            
            lines.forEach(line => {
                appendOutput(line, 'info');
            });
        }
        
        logger.success(`Step ${stepIndex + 1} completed successfully`);
        return true;
    } catch (error) {
        logger.error(`Step ${stepIndex + 1} failed:`, error);
        appendOutput(`\n❌ Step ${stepIndex + 1} failed: ${error.message}\n`, 'error');
        return false;
    }
}

// ============================================
// HELP & DOCUMENTATION
// ============================================

// Setup help functionality
function setupHelp() {
    // Help navigation
    const helpNavItems = document.querySelectorAll('.help-nav-item');
    helpNavItems.forEach(item => {
        item.addEventListener('click', () => {
            const section = item.getAttribute('data-help-section');
            showHelpSection(section);
        });
    });
    
    // Load command documentation
    loadCommandDocumentation();
}

// Show help section
function showHelpSection(sectionId) {
    // Update nav
    document.querySelectorAll('.help-nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-help-section') === sectionId) {
            item.classList.add('active');
        }
    });
    
    // Show section
    document.querySelectorAll('.help-section').forEach(section => {
        section.classList.remove('active');
        section.style.display = 'none';
    });
    
    const targetSection = document.getElementById(`help-${sectionId}`);
    if (targetSection) {
        targetSection.classList.add('active');
        targetSection.style.display = 'block';
    }
}

// Load command documentation
function loadCommandDocumentation() {
    const content = document.getElementById('help-commands-content');
    if (!content) return;
    
    let html = '<div class="help-commands-list">';
    
    Object.entries(commands).forEach(([key, cmd]) => {
        html += `
            <div class="help-command-item">
                <h3>${cmd.name || key}</h3>
                <p class="help-command-description">${cmd.description || cmd.tooltip || 'No description available'}</p>
                ${cmd.options && cmd.options.length > 0 ? `
                    <div class="help-command-options">
                        <h4>Options:</h4>
                        <ul>
                            ${cmd.options.map(opt => `
                                <li>
                                    <strong>${opt.name}</strong> ${opt.required ? '<span class="required">(required)</span>' : '(optional)'}
                                    ${opt.description ? `: ${opt.description}` : ''}
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `;
    });
    
    html += '</div>';
    content.innerHTML = html;
}

// ============================================
// ACCESSIBILITY
// ============================================

// Setup accessibility features
function setupAccessibility() {
    // Skip link functionality
    const skipLink = document.querySelector('.skip-link');
    if (skipLink) {
        skipLink.addEventListener('click', (e) => {
            e.preventDefault();
            const main = document.getElementById('main-content');
            if (main) {
                main.focus();
                main.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }
    
    // Modal accessibility
    setupModalAccessibility();
    
    // Keyboard navigation improvements
    setupKeyboardNavigation();
    
    // Screen reader announcements
    setupScreenReaderAnnouncements();
}

// Setup modal accessibility
function setupModalAccessibility() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        
        const closeButtons = modal.querySelectorAll('.modal-close, [data-modal]');
        closeButtons.forEach(btn => {
            btn.setAttribute('aria-label', 'Close dialog');
        });
    });
}

// Setup keyboard navigation
function setupKeyboardNavigation() {
    // Trap focus in modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            const modal = document.querySelector('.modal:not([style*="display: none"])');
            if (modal) {
                trapFocusInModal(modal, e);
            }
        }
    });
    
    // Escape to close modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const openModal = document.querySelector('.modal:not([style*="display: none"])');
            if (openModal) {
                closeModal(openModal.id);
            }
        }
    });
}

// Trap focus in modal
function trapFocusInModal(modal, e) {
    const focusableElements = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    if (e.shiftKey) {
        if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
        }
    } else {
        if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
        }
    }
}

// Setup screen reader announcements
function setupScreenReaderAnnouncements() {
    // Create live region for announcements
    let liveRegion = document.getElementById('sr-announcements');
    if (!liveRegion) {
        liveRegion = document.createElement('div');
        liveRegion.id = 'sr-announcements';
        liveRegion.className = 'sr-only';
        liveRegion.setAttribute('role', 'status');
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');
        document.body.appendChild(liveRegion);
    }
}

// Announce to screen readers
function announceToScreenReader(message) {
    const liveRegion = document.getElementById('sr-announcements');
    if (liveRegion) {
        liveRegion.textContent = message;
        // Clear after a delay to allow re-announcement
        setTimeout(() => {
            liveRegion.textContent = '';
        }, 1000);
    }
}

// Open modal helper
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
        
        // Focus first focusable element
        const firstFocusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (firstFocusable) {
            firstFocusable.focus();
        }
        
        // Initialize content if needed
        if (modalId === 'workflows-modal') {
            renderWorkflowList();
            renderWorkflowEditor();
        } else if (modalId === 'help-modal') {
            loadCommandDocumentation();
        } else if (modalId === 'statistics-modal') {
            renderStatistics();
        } else if (modalId === 'settings-modal') {
            loadSettings();
            updateStorageUsed();
        }
    }
}

// Close modal helper
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
    }
}
