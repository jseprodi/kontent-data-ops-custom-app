# Kontent.ai Data-Ops Custom App - Complete Project Documentation

This document combines all project documentation, setup instructions, implementation details, and conversation history to provide a comprehensive guide for future development.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Original Requirements](#original-requirements)
3. [Setup Instructions](#setup-instructions)
4. [Implementation Summary](#implementation-summary)
5. [Feature List](#feature-list)
6. [Architecture & Technical Details](#architecture--technical-details)
7. [Development History](#development-history)
8. [File Structure](#file-structure)
9. [Usage Guide](#usage-guide)
10. [Troubleshooting](#troubleshooting)
11. [Future Improvements](#future-improvements)

---

## Project Overview

The Kontent.ai Data-Ops Custom App is a GUI wrapper around the [kontent-ai/data-ops](https://github.com/kontent-ai/data-ops) command-line tool. It provides a user-friendly web interface for running data-ops commands within the Kontent.ai platform.

### Key Technologies

- **Backend**: Node.js/Express server
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **CLI Integration**: Uses local build of `@kontent-ai/data-ops`
- **SDK**: Kontent.ai Custom App SDK (`custom-app-sdk-js`)
- **Styling**: Custom CSS with `stylesheet-generator` utilities

### Core Purpose

The app allows users to:
- Execute data-ops commands through a graphical interface
- Manage multiple Kontent.ai environments
- Automate workflows with batch operations
- Track command history and statistics
- Access comprehensive help and documentation

---

## Original Requirements

From `instructions.md`:

Build a custom app for use in Kontent.ai with the following features:

- **GUI for Data-Ops CLI**: Users should be able to select which data-ops command they want to run, select the target environment and the source environment, and then run the command.
- **Command Execution**: The app should be able to run the command and display the output.
- **Complete Command Support**: The app should implement all the data-ops commands that are available in the command line tool.
- **Tooltips**: The app's GUI should have tooltips for each command to explain what it does.
- **Error Handling**: The app should present a robust error handling mechanism for the user to understand what went wrong and how to fix it.
- **Logging**: The app should have a comprehensive logging mechanism to help the user troubleshoot issues.

**Technologies to Use:**
- https://github.com/kontent-ai/data-ops
- https://github.com/kontent-ai/custom-app-sdk-js
- https://github.com/kontent-ai/stylesheet-generator

**Design Philosophy**: Take as many liberties as needed to make the app easy to use and visually appealing. Take as long as needed to make the app robust and complete.

---

## Setup Instructions

### Repository Structure

The project includes three sub-repositories:

- `data-ops/` - The Kontent.ai data-ops CLI tool (built and ready)
- `custom-app-sdk-js/` - The Kontent.ai Custom App SDK (built and ready)
- `stylesheet-generator/` - Stylesheet utilities (SCSS-based)

### Prerequisites

1. **Node.js 18+** installed
2. **Data-Ops CLI** installed globally (optional, uses local build):
   ```bash
   npm install -g @kontent-ai/data-ops
   ```
3. **Kontent.ai Management API Key** - Get this from your Kontent.ai project settings

### Installation Steps

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start Development Server**:
   ```bash
   npm run dev
   ```

3. **Access the App**:
   - Development: `http://localhost:3000`
   - Production: Build and deploy to Kontent.ai as a custom app

### Environment Variables

- `PORT`: Server port (default: 3000)
- `DATA_OPS_CLI_PATH`: Path to data-ops CLI executable (optional, defaults to local build)

### Building for Production

```bash
npm run build
```

This creates a `dist/` directory that can be zipped and uploaded to Kontent.ai as a custom app.

---

## Implementation Summary

### Repository Integration

✅ **Completed:**
- Cloned `data-ops` repository
- Cloned `custom-app-sdk-js` repository
- Cloned `stylesheet-generator` repository
- Built all repositories (TypeScript → JavaScript)
- Configured package.json to use local repositories

### Command Structure

The app supports the following data-ops commands:

#### Environment Commands
1. **`environment backup`** - Backup an environment
   - Required: `environmentId`, `apiKey`
   - Optional: `fileName`, `include`, `exclude`, `secureAssetDeliveryKey`, `kontentUrl`

2. **`environment restore`** - Restore from backup
   - Required: `environmentId`, `apiKey`, `fileName`
   - Optional: `include`, `exclude`, `excludeInactiveLanguages`, `kontentUrl`

3. **`environment clean`** - Clean an environment
   - Required: `environmentId`, `apiKey`
   - Optional: `kontentUrl`

#### Sync Commands
4. **`sync run`** - Synchronize content model between environments
   - Required: `targetEnvironmentId`, `targetApiKey`, `entities`
   - Source: Either (`sourceEnvironmentId` + `sourceApiKey`) OR `folderName`
   - Optional: `skipConfirmation`, `kontentUrl`

5. **`sync snapshot`** - Create a snapshot of content model
   - Required: `environmentId`, `apiKey`, `folderName`
   - Optional: `entities`, `kontentUrl`

6. **`sync diff`** - Compare content models
   - Required: `targetEnvironmentId`, `targetApiKey`
   - Source: Either (`sourceEnvironmentId` + `sourceApiKey`) OR `folderName`
   - Optional: `entities`, `advanced`, `outPath`, `noOpen`, `kontentUrl`

### Server Implementation

✅ **Completed:**
- Uses built CLI from `data-ops/build/src/index.js`
- Proper command argument building
- Array handling for entities (multiple `--entity` flags)
- Validation matching actual CLI requirements
- Streaming output via Server-Sent Events (SSE)
- Command cancellation support
- Progress stage detection

### Frontend Implementation

✅ **Completed:**
- Commands loaded dynamically from server
- Support for multiselect input (for entities)
- Proper validation for required fields
- Tooltips loaded from server definitions
- Real-time command execution with streaming output
- Conditional field rendering (dependsOn, implies, conflicts)
- Form state persistence
- Entity caching and search

---

## Feature List

### Core Features

1. **Command Selection & Execution**
   - Dynamic command loading from server
   - Real-time output streaming
   - Command cancellation
   - Progress indicators

2. **Environment Management**
   - Source/target environment selection
   - Manual input option
   - Environment profiles (save/load/delete)
   - Profile import/export

3. **Form Management**
   - Dynamic form rendering based on command
   - Conditional field visibility
   - Inline validation
   - Form state persistence (localStorage)
   - Auto-save functionality

4. **Output & Logging**
   - Real-time output display
   - Color-coded log levels
   - Output filtering (search, log level)
   - Syntax highlighting (JSON/YAML)
   - Collapsible output sections
   - Line numbers toggle
   - Copy to clipboard
   - Export output to file

5. **Error Handling**
   - Enhanced error parsing
   - Structured error messages
   - Field highlighting for errors
   - Actionable solutions
   - Error modal with details

### Advanced Features

6. **Command Templates**
   - Save command configurations
   - Load saved templates
   - Delete templates
   - Export/import templates

7. **Command History**
   - Track all executed commands
   - View execution details
   - Re-run past commands
   - Search and filter history
   - Export history

8. **Batch Operations & Workflows**
   - Create multi-step workflows
   - Sequential or parallel execution
   - Stop on error option
   - Workflow templates
   - Save/load/export workflows
   - Real-time workflow progress

9. **Statistics Dashboard**
   - Overall statistics (total commands, success rate)
   - Command breakdown
   - Most used commands
   - Recent activity (7 days)
   - Average execution times

10. **Settings & Preferences**
    - Auto-save toggle
    - Line numbers default
    - Browser notifications
    - Sound alerts
    - History limits
    - Cache expiration
    - Theme selection (Light/Dark/Auto)
    - Font size options
    - Storage management
    - Data export/import

11. **Help & Documentation**
    - In-app help panel
    - Command documentation
    - Workflow guides
    - Troubleshooting section
    - FAQ
    - Keyboard shortcuts reference

12. **Accessibility**
    - ARIA labels and roles
    - Keyboard navigation
    - Focus management
    - Screen reader support
    - Skip links
    - Modal focus trapping

### User Experience Features

13. **Visual Feedback**
    - Progress bars with stages
    - Status indicators
    - Toast notifications
    - Loading states
    - Color-coded output

14. **File Management**
    - File picker for backup files
    - Drag-and-drop support
    - File info display

15. **Entity Management**
    - Entity caching (1-hour TTL)
    - Entity search/filter
    - Entity multiselect
    - Cache management

16. **Keyboard Shortcuts**
    - `Ctrl/Cmd + Enter`: Run command
    - `Esc`: Cancel/Close modals
    - `Ctrl/Cmd + K`: Focus command selector
    - `Ctrl/Cmd + /`: Show shortcuts help

---

## Architecture & Technical Details

### Frontend Architecture

**File: `app-frontend.js`** (4,867 lines)

#### State Management
```javascript
const state = {
    command: '',
    sourceEnv: null,
    targetEnv: null,
    commandOptions: {},
    isRunning: false,
    logs: [],
    output: [],
    serverUrl: window.location.origin,
    abortController: null,
    progress: { current: 0, total: 100, message: '', stage: '' },
    outputFilter: { searchTerm: '', logLevel: 'all', showLineNumbers: true },
    outputSections: { currentSection: null, sections: new Map() }
};
```

#### Storage Keys
```javascript
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
```

#### Key Functions

- **Command Management**: `loadCommands()`, `renderCommandOptions()`, `updateCommandOptions()`
- **Form State**: `saveFormState()`, `loadFormState()`, `clearFormState()`
- **Validation**: `validateCanRun()`, `validateCommandOptions()`, `validateField()`
- **Command Execution**: `handleRunCommand()`, `executeCommand()`, `cancelCommand()`
- **Output Management**: `appendOutput()`, `filterOutput()`, `formatOutputMessage()`
- **Workflows**: `setupWorkflows()`, `runWorkflow()`, `executeWorkflowStep()`
- **Help**: `setupHelp()`, `loadCommandDocumentation()`, `showHelpSection()`
- **Accessibility**: `setupAccessibility()`, `setupKeyboardNavigation()`, `announceToScreenReader()`

### Backend Architecture

**File: `server.js`**

#### Key Endpoints

- `GET /api/commands` - Get available commands and their definitions
- `POST /api/execute` - Execute a data-ops command
- `POST /api/cancel` - Cancel a running command
- `GET /api/entities/:envId` - Fetch entities for an environment

#### Command Execution

- Uses `execa` to spawn child processes
- Streams output via Server-Sent Events (SSE)
- Tracks child processes in `childProcessMap` for cancellation
- Validates command options before execution
- Handles progress stage detection

#### Progress Stages

The server maps CLI output patterns to progress percentages:
- `environment backup`: 0-100% based on backup stages
- `environment restore`: 0-100% based on restore stages
- `sync run`: 0-100% based on sync operations

### Styling

**File: `styles.css`** (1,820+ lines)

- CSS custom properties for theming
- Responsive design
- Dark mode support
- Accessibility-focused styles
- Workflow and help panel styles
- Modal and overlay styles
- Animation and transitions

---

## Development History

### Phase 1: Initial Implementation
- Basic command execution
- Environment selection
- Real-time output streaming
- Error handling

### Phase 2: UI Improvements
- Form persistence with localStorage
- Show/hide toggle for API keys
- Command cancellation
- Copy-to-clipboard buttons
- Toast notifications

### Phase 3: Enhanced User Experience
- Progress indicators and loading states
- Enhanced error parsing and display
- Keyboard shortcuts
- Inline field validation
- File browser/picker for backup files

### Phase 4: Advanced Features
- Entity caching and search
- Enhanced output features (filtering, syntax highlighting)
- Command templates/presets
- Command history
- Environment profiles

### Phase 5: Output Improvements
- Collapsible output sections
- Enhanced output color coding
- Command execution statistics dashboard
- Settings/Preferences panel

### Phase 6: Workflows & Accessibility
- Batch operations and workflows
- Accessibility improvements (ARIA, keyboard navigation)
- In-app help and documentation

---

## File Structure

```
.
├── index.html              # Main HTML file
├── styles.css              # Application styles (1,820+ lines)
├── app-frontend.js         # Frontend application logic (4,867 lines)
├── server.js              # Backend server for executing commands
├── manifest.json          # Kontent.ai custom app manifest
├── package.json           # Node.js dependencies
├── build.js               # Build script
│
├── data-ops/              # Sub-repository: data-ops CLI
│   └── build/             # Built CLI files
│
├── custom-app-sdk-js/     # Sub-repository: Custom App SDK
│
├── stylesheet-generator/  # Sub-repository: Stylesheet utilities
│
├── README.md              # Project README
├── CONTRIBUTING.md        # Contribution guidelines
├── PROJECT_DOCUMENTATION.md # This file (comprehensive documentation)
├── .env.example           # Environment variables template
└── .gitignore            # Git ignore rules
```

---

## Usage Guide

### Basic Workflow

1. **Select Command**: Choose a data-ops command from the dropdown
2. **Configure Environments**: 
   - Select source environment (or "Manual Input")
   - Select target environment (if needed)
3. **Set Options**: Fill in command-specific options
4. **Run Command**: Click "Run Command" or press `Ctrl+Enter`
5. **Monitor Progress**: 
   - View real-time output
   - Check progress bar
   - Review logs

### Using Workflows

1. Click "Workflows" button in header
2. Click "New Workflow" or load a template
3. Add steps by clicking "+ Add Step"
4. Configure each step with command and options
5. Choose execution mode (Sequential/Parallel)
6. Set "Stop on error" if desired
7. Save and run the workflow

### Using Templates

1. Configure a command with desired options
2. Click "Save" in Templates section
3. Enter a template name
4. Load later from the template dropdown

### Using Environment Profiles

1. Enter environment details (ID, API key)
2. Click "Save" in Environment Profiles section
3. Enter a profile name
4. Load later from the profile dropdown

### Keyboard Shortcuts

- `Ctrl/Cmd + Enter`: Run command
- `Esc`: Cancel command / Close modals
- `Ctrl/Cmd + K`: Focus command selector
- `Ctrl/Cmd + /`: Show keyboard shortcuts
- `Tab`: Navigate between fields
- `Shift + Tab`: Navigate backwards

---

## Troubleshooting

### Command Not Found

**Problem**: "Command not found" errors

**Solutions**:
1. Ensure data-ops CLI is installed: `npm install -g @kontent-ai/data-ops`
2. Verify it's in your PATH: `which data-ops` (Linux/Mac) or `where data-ops` (Windows)
3. Or set the `DATA_OPS_CLI_PATH` environment variable
4. The app uses the local build by default, so this should rarely occur

### API Key Issues

**Problem**: Authentication failures

**Solutions**:
- Ensure you're using Management API keys (not Delivery keys)
- Verify the keys have the required permissions
- Check if the keys are valid and not expired
- Ensure environment ID matches the API key

### Network Errors

**Problem**: Connection failures

**Solutions**:
- Verify your internet connection
- Check firewall settings
- Ensure the Kontent.ai API endpoints are accessible
- Check if the Kontent.ai service is operational

### Server Won't Start

**Problem**: Port already in use

**Solutions**:
```bash
# Windows
netstat -ano | findstr :3000

# Linux/Mac
lsof -i :3000
```

Change the port if needed:
```bash
PORT=8080 npm run dev
```

### Form Not Saving

**Problem**: Form state not persisting

**Solutions**:
- Check browser localStorage is enabled
- Clear browser cache and try again
- Check browser console for errors
- Verify Settings > Auto-save is enabled

### Workflow Execution Fails

**Problem**: Workflow steps fail

**Solutions**:
- Check each step's configuration
- Verify environment IDs and API keys are correct
- Review error messages in output
- Try running steps individually to isolate issues
- Check "Stop on error" setting

---

## Future Improvements

### Potential Enhancements

1. **Command Scheduling**
   - Schedule commands for later execution
   - Recurring schedules (daily/weekly backups)
   - Timezone support

2. **Undo/Redo Functionality**
   - Undo last command execution (where applicable)
   - Command rollback support
   - Safety confirmations

3. **Advanced Search**
   - Global search across history, templates, profiles
   - Full-text search in command outputs
   - Advanced filters (date ranges, status, command type)

4. **Command Output Comparison**
   - Compare outputs from different runs
   - Diff view for command results
   - Side-by-side comparison

5. **Performance Optimizations**
   - Virtual scrolling for large outputs
   - Lazy loading for history
   - Debounced search
   - Web Workers for heavy processing

6. **Internationalization (i18n)**
   - Multi-language support
   - Localized date/time formats
   - RTL language support

7. **Advanced Export/Import**
   - Export specific data types
   - Import with conflict resolution
   - Scheduled backups
   - Cloud storage integration

8. **Real-time Collaboration**
   - Share workflows with team
   - Collaborative editing
   - Activity feed

9. **Webhook Integration**
   - Trigger commands via webhooks
   - External system integration
   - API endpoints for automation

10. **Enhanced Analytics**
    - Usage patterns
    - Performance metrics
    - Error rate tracking
    - Command success/failure trends

---

## Code Quality & Standards

### Linting

The project uses ESLint for code quality. All linter errors have been resolved.

### Best Practices

- **Error Handling**: Comprehensive try-catch blocks
- **Validation**: Client and server-side validation
- **Accessibility**: ARIA labels, keyboard navigation, screen reader support
- **Performance**: Efficient DOM manipulation, debounced inputs
- **Security**: API keys hidden by default, secure storage
- **User Experience**: Clear feedback, helpful error messages, intuitive UI

### Testing Considerations

While no automated tests are currently in place, the following areas would benefit from testing:

- Command execution flow
- Form validation
- Workflow execution
- Error handling
- State persistence
- Accessibility features

---

## Related Projects

- [kontent-ai/data-ops](https://github.com/kontent-ai/data-ops) - The underlying CLI tool
- [kontent-ai/custom-app-sdk-js](https://github.com/kontent-ai/custom-app-sdk-js) - Custom app SDK
- [kontent-ai/stylesheet-generator](https://github.com/kontent-ai/stylesheet-generator) - Stylesheet utilities

---

## License

MIT

---

## Notes for Next Developer

### Key Areas to Understand

1. **Command Definitions**: Commands are loaded from the server (`/api/commands`). The server reads from the actual data-ops CLI structure.

2. **State Management**: The app uses a combination of:
   - Global `state` object for runtime state
   - `localStorage` for persistence
   - DOM state for UI

3. **Command Execution Flow**:
   - User fills form → `handleRunCommand()` → `executeCommand()` → Server API → CLI execution → SSE streaming → Frontend display

4. **Workflow Execution**:
   - Workflows are stored in localStorage
   - Each step executes via the same command execution flow
   - Sequential mode: waits for each step
   - Parallel mode: runs all steps simultaneously

5. **Accessibility**: 
   - All interactive elements have ARIA labels
   - Keyboard navigation is fully supported
   - Screen reader announcements for important events

6. **Error Handling**:
   - Client-side validation before submission
   - Server-side validation before execution
   - Enhanced error parsing for user-friendly messages
   - Field highlighting for validation errors

### Common Patterns

- **Modal Management**: Use `openModal()` and `closeModal()` helpers
- **Toast Notifications**: Use `showToast(message, type)`
- **Output Display**: Use `appendOutput(message, level)`
- **Form Persistence**: Automatic via `saveFormState()` on input changes
- **Validation**: Use `validateField()` for inline validation, `validateCanRun()` for form submission

### Debugging Tips

- Check browser console for JavaScript errors
- Check server logs for command execution issues
- Use browser DevTools to inspect localStorage
- Check Network tab for API call issues
- Review Logs section in the app for detailed information

### When Adding New Features

1. Update this documentation
2. Add appropriate ARIA labels
3. Ensure keyboard navigation works
4. Add to help documentation if user-facing
5. Consider form persistence if applicable
6. Add error handling
7. Update settings if needed

---

**Last Updated**: Based on conversation history up to implementation of Workflows, Accessibility, and Help features.

**Status**: All planned features implemented. App is fully functional and ready for use.

