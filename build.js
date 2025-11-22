// Build script for Kontent.ai custom app
// This prepares the app for deployment

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get file size in human-readable format
function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Basic minification helpers (for production builds)
function minifyJS(content) {
    // Basic minification: remove comments and extra whitespace
    // For production, consider using a proper minifier like terser
    return content
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
        .replace(/\/\/.*$/gm, '') // Remove line comments
        .replace(/\s+/g, ' ') // Collapse whitespace
        .replace(/;\s*}/g, ';}') // Remove space before closing braces
        .trim();
}

function minifyCSS(content) {
    // Basic CSS minification
    return content
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
        .replace(/\s+/g, ' ') // Collapse whitespace
        .replace(/;\s*}/g, ';}') // Remove space before closing braces
        .replace(/\s*{\s*/g, '{') // Remove spaces around braces
        .replace(/\s*}\s*/g, '}')
        .replace(/\s*:\s*/g, ':') // Remove spaces around colons
        .replace(/\s*;\s*/g, ';') // Remove spaces around semicolons
        .trim();
}

async function build() {
    console.log('Building Kontent.ai Data-Ops Custom App...');
    
    const distDir = path.join(__dirname, 'dist');
    const isProduction = process.env.NODE_ENV === 'production';
    const buildErrors = [];
    let totalSize = 0;
    
    try {
        // Create dist directory if it doesn't exist
        await fs.mkdir(distDir, { recursive: true });
        console.log('✓ Created dist directory');
    } catch (error) {
        buildErrors.push(`Failed to create dist directory: ${error.message}`);
    }
    
    // Copy necessary files to dist
    const filesToCopy = [
        'index.html',
        'styles.css',
        'app-frontend.js',
        'manifest.json'
    ];
    
    for (const file of filesToCopy) {
        try {
            const source = path.join(__dirname, file);
            const dest = path.join(distDir, file);
            
            // Check if source file exists
            try {
                await fs.access(source);
            } catch {
                throw new Error(`Source file not found: ${file}`);
            }
            
            // Read file content
            let content = await fs.readFile(source, 'utf8');
            const originalSize = Buffer.byteLength(content, 'utf8');
            
            // Apply minification in production mode
            if (isProduction) {
                if (file.endsWith('.js')) {
                    // Basic minification (for better results, consider using terser or esbuild)
                    content = minifyJS(content);
                    console.log(`  ✓ Minified JS`);
                } else if (file.endsWith('.css')) {
                    // Basic CSS minification (for better results, consider using cssnano)
                    content = minifyCSS(content);
                    console.log(`  ✓ Minified CSS`);
                }
            }
            
            // Write file
            await fs.writeFile(dest, content, 'utf8');
            const finalSize = Buffer.byteLength(content, 'utf8');
            totalSize += finalSize;
            
            const sizeInfo = finalSize !== originalSize 
                ? ` (${formatFileSize(originalSize)} → ${formatFileSize(finalSize)})`
                : ` (${formatFileSize(finalSize)})`;
            console.log(`✓ Copied ${file}${sizeInfo}`);
        } catch (error) {
            const errorMsg = `Failed to copy ${file}: ${error.message}`;
            console.error(`✗ ${errorMsg}`);
            buildErrors.push(errorMsg);
        }
    }
    
    // Verify all required files were copied
    if (buildErrors.length > 0) {
        console.error('\n✗ Build completed with errors:');
        buildErrors.forEach(error => {
            console.error(`  - ${error}`);
        });
        throw new Error('Build failed due to errors');
    }
    
    // Note: server.js and package.json are NOT copied to dist/
    // Custom apps are static HTML/JS/CSS files and don't need a server
    // The server is only used for local development
    
    console.log('\n✓ Build complete!');
    console.log(`📦 Total build size: ${formatFileSize(totalSize)}`);
    console.log('The app is ready in the dist/ directory.');
    console.log('\nTo deploy:');
    console.log('1. Zip the contents of the dist/ directory');
    console.log('2. Upload to Kontent.ai as a custom app');
    
    if (!isProduction) {
        console.log('\n💡 Tip: Set NODE_ENV=production for minified builds');
    }
}

build().catch(error => {
    console.error('Build failed:', error);
    process.exit(1);
});
