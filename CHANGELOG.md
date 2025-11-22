# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Virtual Scrolling**
  - Virtual scrolling implementation for large outputs (>1000 lines)
  - Automatic activation when output exceeds threshold
  - Dynamic DOM updates (only visible lines rendered)
  - Spacer elements maintain scroll height
  - Scroll event throttling (~60fps)
  - ResizeObserver for container height changes
  - Memory efficient rendering for very large outputs

- **Testing**
  - Comprehensive integration tests for API endpoints
  - 15+ new test cases covering health, commands, fetch-entities, execute endpoints
  - Server detection and graceful test skipping
  - Error handling and validation tests

- **Utility Integration & Performance**
  - Integrated all utility modules into `app-frontend.js`
  - Replaced all direct `localStorage` calls with safe utility functions
  - Added debouncing to search/filter inputs for better performance
  - Added throttled scroll updates for smoother output rendering
  - Added output size limits (10,000 lines) to prevent memory issues
  - Automatic cleanup of oldest output entries when limit reached
  - Added `appendOutput` alias for backward compatibility

- **Build Process**
  - File size reporting in build output
  - Minification enabled for production builds
  - Production mode detection (`NODE_ENV=production`)
  - Enhanced build feedback with size information

### Changed
- **Performance**
  - Search and filter inputs now use debouncing (300ms delay)
  - Output rendering uses throttled scroll updates via `requestAnimationFrame`
  - Form auto-save uses debounced function for better performance
  - History search uses debounced filtering

- **Code Quality**
  - All `localStorage` operations now use safe utility wrappers
  - Better error handling with utility functions
  - Improved code organization with integrated utilities

### Added (Previous)
- **Security Enhancements**
  - Input validation and sanitization
  - Rate limiting (30 requests/minute per IP)
  - CORS restrictions (localhost only in development)
  - Path traversal prevention
  - UUID and API key format validation
  - Command timeout handling (1 hour limit)

- **Error Handling**
  - Comprehensive error handling throughout server.js
  - User-friendly error messages with actionable solutions
  - Error logging with context
  - Graceful error recovery
  - Custom error classes and error codes

- **Build Process**
  - Improved build script with file validation
  - Better error reporting
  - Server files excluded from dist/ (security)

- **Utility Modules** (`src/utils/`)
  - Configuration management (`config.js`)
  - Performance optimizations (`performance.js`)
  - Input validation (`validation.js`)
  - Storage utilities (`storage.js`)
  - Error handling (`errors.js`)
  - *Note: These utilities were later integrated into `app-frontend.js` and the directory was removed.*

- **CI/CD**
  - GitHub Actions workflow for automated testing
  - Multi-version Node.js testing (18.x, 20.x)
  - Security checks (npm audit, sensitive data detection)
  - Build verification

- **Documentation**
  - JSDoc standards guide
  - Source code organization guide
  - Comprehensive improvements documentation
  - Updated README with correct command structure

- **Testing Infrastructure**
  - Basic test structure with Vitest
  - Example test cases
  - Test scripts in package.json

### Changed
- **Documentation**
  - Updated README.md with correct CLI command structure
  - Fixed PROJECT_DOCUMENTATION.md (removed non-existent file references)
  - Enhanced CONTRIBUTING.md

- **Configuration**
  - Created .env.example template
  - Updated .gitignore to track .env.example
  - Enhanced package.json with metadata and test scripts

- **Security**
  - Restricted CORS to localhost in development
  - Disabled CORS in production
  - Removed server.js from build output

### Fixed
- Documentation inconsistencies (commands now match actual CLI)
- Build process (server files no longer included in dist/)
- Manifest.json (removed non-existent icon reference)
- PROJECT_DOCUMENTATION.md (removed references to non-existent files)

## [1.0.0] - Initial Release

### Features
- GUI for Kontent.ai data-ops CLI
- Command selection and execution
- Real-time output streaming
- Environment management
- Command templates
- Command history
- Workflows and batch operations
- Statistics dashboard
- Help and documentation
- Accessibility features

