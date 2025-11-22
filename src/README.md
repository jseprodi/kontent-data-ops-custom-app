# Source Code Organization

This directory contains modular utility functions and helpers that can be used throughout the application.

## ⚠️ Status: Utilities Integrated

**All utility functions have been integrated directly into `app-frontend.js`** since the custom app needs to work as a single file when deployed.

The modules in this directory now serve as:
- **Reference documentation** - See how utilities are structured
- **Source of truth** - Original implementations before integration  
- **Future bundling** - Could be used if we set up a bundling process
- **Development reference** - Useful for understanding the utility structure

## Structure

```
src/
├── utils/
│   ├── config.js       # Configuration management (not integrated)
│   ├── performance.js  # Performance optimization utilities ✅ Integrated
│   ├── validation.js   # Input validation functions ✅ Integrated
│   ├── storage.js      # localStorage utilities ✅ Integrated
│   └── errors.js        # Error handling utilities ✅ Integrated
└── README.md           # This file
```

## Integration Status

- ✅ **Storage utilities** (`storage.js`) - Fully integrated, all `localStorage` calls replaced
- ✅ **Performance utilities** (`performance.js`) - Fully integrated, debounce/throttle in active use
- ✅ **Validation utilities** (`validation.js`) - Integrated, functions available for use
- ✅ **Error handling utilities** (`errors.js`) - Integrated, available for use
- ⚠️ **Config utilities** (`config.js`) - Not integrated (can be added if needed)

## Current Implementation

The utility functions are embedded in `app-frontend.js` at the top of the file (lines ~8-110). They are:
- Used throughout the application
- Replacing direct browser API calls
- Providing consistent error handling
- Improving performance with debouncing/throttling

## Future Considerations

If you want to use these as separate modules in the future:
1. Set up a bundler (rollup, esbuild, webpack)
2. Import utilities as ES modules
3. Bundle into single file for deployment

For now, the integrated approach works well for the single-file deployment requirement.

## Modules

### config.js
Centralized configuration management:
- Application settings
- API configuration
- Storage keys
- Feature flags
- Default values

### performance.js
Performance optimization utilities:
- `debounce()` - Delay function execution
- `throttle()` - Limit function execution rate
- `processBatch()` - Process items in batches
- `setupLazyLoading()` - Lazy load images/resources
- `calculateVisibleRange()` - Virtual scrolling helper

### validation.js
Input validation functions:
- `isValidUUID()` - Validate UUID format
- `isValidApiKey()` - Validate API key format
- `isValidFilePath()` - Validate file paths (prevent traversal)
- `isValidUrl()` - Validate URL format
- `sanitizeInput()` - Sanitize user input

### storage.js
localStorage utilities with error handling:
- `getStorageItem()` - Safe get from localStorage
- `setStorageItem()` - Safe set to localStorage
- `removeStorageItem()` - Remove from localStorage
- `clearStorageByPrefix()` - Clear items by prefix
- `getStorageSize()` - Get storage usage statistics

### errors.js
Error handling utilities:
- `AppError` - Custom error class
- `ErrorCodes` - Standard error codes
- `getErrorMessage()` - User-friendly error messages
- `logError()` - Error logging with context
- `handlePromiseRejection()` - Promise error handling

## Example Usage

```javascript
// Import utilities (if using modules)
import { debounce, throttle } from './utils/performance.js';
import { isValidUUID, validateEnvironmentId } from './utils/validation.js';
import { getStorageItem, setStorageItem } from './utils/storage.js';
import { AppError, ErrorCodes } from './utils/errors.js';

// Or copy functions directly into app-frontend.js
```

## Best Practices

1. **Use validation** - Always validate user input before processing
2. **Handle errors** - Use error utilities for consistent error handling
3. **Optimize performance** - Use debounce/throttle for frequent operations
4. **Safe storage** - Always use storage utilities instead of direct localStorage access
5. **Configuration** - Use config module for all configuration values

## Future Improvements

- TypeScript migration for type safety
- Automated bundling process
- Unit tests for each utility module
- Performance benchmarks

