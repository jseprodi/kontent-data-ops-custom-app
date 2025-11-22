# Kontent.ai Data-Ops Custom App

A GUI custom app for Kontent.ai that provides a user-friendly interface for running data-ops commands. This app serves as a graphical wrapper around the [kontent-ai/data-ops](https://github.com/kontent-ai/data-ops) command-line tool.

## Features

- **Command Selection**: Choose from all available data-ops commands
- **Environment Management**: Select source and target environments with manual input options
- **Real-time Output**: View command execution output in real-time with color-coded messages
- **Batch Operations**: Create and run multi-step workflows
- **Command Templates**: Save and reuse command configurations
- **Command History**: Track and re-run past commands
- **Statistics Dashboard**: View execution statistics and insights
- **Help & Documentation**: Comprehensive in-app help system
- **Accessibility**: Full keyboard navigation and screen reader support

> 📖 **For complete documentation**, see [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md)

## Prerequisites

- Node.js 18+ installed
- The `@kontent-ai/data-ops` CLI tool installed globally or accessible in PATH
- Kontent.ai Management API keys for your projects

## Installation

1. Clone or download this repository

2. Install dependencies:
```bash
npm install
```

3. Install the data-ops CLI tool (if not already installed):
```bash
npm install -g @kontent-ai/data-ops
```

4. Build the app:
```bash
npm run build
```

5. Deploy to Kontent.ai:
   - Zip the contents of the `dist/` directory
   - Upload to Kontent.ai as a custom app
   - Configure the app in your Kontent.ai project

## Development

Run in development mode:
```bash
npm run dev
```

This will start the development server on `http://localhost:3000`

## Usage

### Basic Workflow

1. **Select Command**: Choose a data-ops command from the dropdown menu
2. **Configure Environments**: 
   - Select source environment (or choose "Manual Input" to enter Project ID)
   - Select target environment (for transfer/compare commands)
3. **Set Options**: Fill in command-specific options:
   - Project IDs and API keys
   - File paths for input/output
   - Format preferences (JSON/YAML)
   - Additional options specific to each command
4. **Run Command**: Click "Run Command" to execute
5. **Monitor Progress**: 
   - View real-time output in the Output section
   - Check logs in the Logs section
   - Watch status indicator for command state

### Commands Supported

The app supports all data-ops CLI commands. The actual command structure follows the pattern: `<command> <subcommand>`.

#### Environment Commands

##### `environment backup`
Creates a complete backup of your Kontent.ai environment into a `.zip` file.

**Required Options:**
- Environment ID
- Management API Key

**Optional Options:**
- Backup File Name (auto-generated if omitted)
- Secure Asset Delivery Key (for secure assets)
- Include/Exclude specific entities
- Custom Kontent URL

##### `environment restore`
Restores your Kontent.ai environment from a previously created backup.

**Required Options:**
- Environment ID
- Management API Key
- Backup File Name

**Optional Options:**
- Include/Exclude specific entities
- Exclude Inactive Languages
- Custom Kontent URL

##### `environment clean`
⚠️ **WARNING**: Removes all content, assets and configuration from a Kontent.ai environment. Use with caution!

**Required Options:**
- Environment ID
- Management API Key

**Optional Options:**
- Include/Exclude specific entities
- Skip Warning
- Custom Kontent URL

#### Sync Commands

##### `sync run`
Synchronizes content model between two Kontent.ai environments.

**Required Options:**
- Target Environment ID
- Target Management API Key
- Entities to Sync (contentTypes, contentTypeSnippets, taxonomies, etc.)

**Source Options (choose one):**
- Source Environment ID + Source API Key, OR
- Folder Name (containing a snapshot)

**Optional Options:**
- Skip Confirmation
- Custom Kontent URL

##### `sync snapshot`
Creates a snapshot of the content model from an environment for syncing.

**Required Options:**
- Environment ID
- Management API Key
- Entities to Snapshot

**Optional Options:**
- Output Folder Name
- Custom Kontent URL

##### `sync diff`
Compares content models from two Kontent.ai environments or between an environment and a snapshot.

**Required Options:**
- Target Environment ID
- Target Management API Key

**Source Options (choose one):**
- Source Environment ID + Source API Key, OR
- Folder Name (containing a snapshot)

**Optional Options:**
- Entities to Diff
- Generate Advanced Diff HTML (requires output path)
- Output Path (required with advanced option)
- Don't Open Automatically
- Custom Kontent URL

#### Migrate Content Commands

##### `migrate-content snapshot`
Creates a local snapshot from selected content items and assets.

##### `migrate-content run`
Migrates content items across environments.

#### Migrations Commands

##### `migrations add`
Adds a new migration script.

##### `migrations run`
Executes migration scripts.

> 📖 For detailed information about each command, see the [data-ops documentation](https://github.com/kontent-ai/data-ops) or use the in-app help system.

## Features Explained

### Tooltips
Hover over the info icon (ℹ️) next to the Command field to see detailed explanations of all available commands.

### Error Handling
When errors occur, the app displays:
- A clear error message
- Possible solutions and troubleshooting steps
- Links to relevant documentation (when applicable)

### Logging
The app maintains comprehensive logs of:
- Application initialization
- Command execution steps
- Errors and warnings
- Success messages

Logs can be downloaded as a text file for offline analysis.

### Status Indicators
- ⚪ **Ready**: No command running
- 🔄 **Running**: Command in progress
- ✅ **Success**: Command completed successfully
- ❌ **Error**: Command failed

## Configuration

### Environment Variables

- `PORT`: Server port (default: 3000)
- `DATA_OPS_CLI_PATH`: Path to data-ops CLI executable (optional, defaults to 'data-ops' in PATH)

### Server Configuration

The server runs on port 3000 by default. Change it by setting the `PORT` environment variable:

```bash
PORT=8080 npm run dev
```

## Troubleshooting

### Command Not Found
If you see "Command not found" errors:
1. Ensure the data-ops CLI is installed: `npm install -g @kontent-ai/data-ops`
2. Verify it's in your PATH: `which data-ops` (Linux/Mac) or `where data-ops` (Windows)
3. Or set the `DATA_OPS_CLI_PATH` environment variable

### API Key Issues
- Ensure you're using Management API keys, not Delivery API keys
- Verify the keys have the required permissions
- Check if the keys are valid and not expired

### Network Errors
- Verify your internet connection
- Check firewall settings
- Ensure the Kontent.ai API endpoints are accessible

## Project Structure

```
.
├── index.html              # Main HTML file
├── styles.css              # Application styles
├── app-frontend.js         # Frontend application logic (~5,100 lines)
├── server.js               # Backend server for executing commands
├── manifest.json           # Kontent.ai custom app manifest
├── package.json            # Node.js dependencies and scripts
├── build.js                # Build script with minification
├── tests/                  # Test files
│   └── server.test.js      # Integration and unit tests
├── src/                    # Source utilities (reference)
│   └── utils/              # Utility modules (integrated into app-frontend.js)
├── README.md               # This file
├── PROJECT_DOCUMENTATION.md # Complete project documentation
├── IMPROVEMENTS.md         # Improvements summary
├── CHANGELOG.md            # Changelog
├── CONTRIBUTING.md         # Contribution guidelines
└── JSDOC.md                # JSDoc standards
```

## Documentation

- **[PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md)** - Complete project documentation including setup, features, architecture, and development history
- **[IMPROVEMENTS.md](IMPROVEMENTS.md)** - Summary of all improvements and enhancements made to the project
- **[CHANGELOG.md](CHANGELOG.md)** - Detailed changelog of all changes
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Contribution guidelines
- **[JSDOC.md](JSDOC.md)** - JSDoc documentation standards

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on contributing to this project.

## License

MIT

## Related Projects

- [kontent-ai/data-ops](https://github.com/kontent-ai/data-ops) - The underlying CLI tool
- [kontent-ai/custom-app-sdk-js](https://github.com/kontent-ai/custom-app-sdk-js) - Custom app SDK
- [kontent-ai/stylesheet-generator](https://github.com/kontent-ai/stylesheet-generator) - Stylesheet utilities
