// Build script for Kontent.ai custom app
// This prepares the app for deployment

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { minify } from 'terser';
import { SourceMapConsumer, SourceMapGenerator } from 'source-map';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get file size in human-readable format
function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Minify JavaScript with source maps
async function minifyJS(content, sourcePath, outputPath, generateSourceMap = true) {
    try {
        const result = await minify(content, {
            compress: {
                drop_console: false, // Keep console for debugging
                drop_debugger: true,
                pure_funcs: ['console.debug']
            },
            mangle: {
                reserved: ['state', 'elements', 'logger'] // Preserve important globals
            },
            format: {
                comments: false
            },
            sourceMap: generateSourceMap ? {
                filename: path.basename(outputPath),
                url: path.basename(outputPath) + '.map',
                includeSources: true
            } : false
        });
        
        return {
            code: result.code || content,
            map: result.map || null
        };
    } catch (error) {
        console.warn(`⚠️  Minification failed for ${sourcePath}, using original:`, error.message);
        return {
            code: content,
            map: null
        };
    }
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
    
    // Build TypeScript first
    console.log('📦 Compiling TypeScript...');
    try {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);
        await execAsync('npm run build:ts');
        console.log('✓ TypeScript compilation complete');
    } catch (error) {
        console.error('✗ TypeScript compilation failed:', error.message);
        throw new Error('Build failed: TypeScript compilation error');
    }
    
    const projectRoot = path.resolve(__dirname, '..');
    const distDir = path.join(projectRoot, 'dist');
    const frontendDir = path.join(projectRoot, 'frontend');
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
        { name: 'index.html', source: frontendDir, dest: '' },
        { name: 'styles.css', source: frontendDir, dest: '' },
        { name: 'app-frontend.js', source: frontendDir, dest: '' },
        { name: 'manifest.json', source: projectRoot, dest: '' },
        { name: '_redirects', source: projectRoot, dest: '' }
    ];
    
    for (const file of filesToCopy) {
        try {
            const source = path.join(file.source, file.name);
            const dest = path.join(distDir, file.dest, file.name);
            
            // Check if source file exists
            try {
                await fs.access(source);
            } catch {
                throw new Error(`Source file not found: ${file.name}`);
            }
            
            // Read file content
            let content = await fs.readFile(source, 'utf8');
            const originalSize = Buffer.byteLength(content, 'utf8');
            
            let sourceMapContent = null;
            
            // Apply minification in production mode
            if (isProduction) {
                if (file.name.endsWith('.js')) {
                    // Minify with source maps
                    const minified = await minifyJS(content, source, dest, true);
                    content = minified.code;
                    sourceMapContent = minified.map;
                    console.log(`  ✓ Minified JS${sourceMapContent ? ' (with source map)' : ''}`);
                } else if (file.name.endsWith('.css')) {
                    // Basic CSS minification (for better results, consider using cssnano)
                    content = minifyCSS(content);
                    console.log(`  ✓ Minified CSS`);
                }
            }
            
            // Write file
            await fs.writeFile(dest, content, 'utf8');
            const finalSize = Buffer.byteLength(content, 'utf8');
            totalSize += finalSize;
            
            // Write source map if generated
            if (sourceMapContent) {
                const mapPath = dest + '.map';
                await fs.writeFile(mapPath, sourceMapContent, 'utf8');
                const mapSize = Buffer.byteLength(sourceMapContent, 'utf8');
                totalSize += mapSize;
                console.log(`  ✓ Generated source map: ${path.basename(mapPath)} (${formatFileSize(mapSize)})`);
                
                // Add source map comment to minified file
                const sourceMapComment = `\n//# sourceMappingURL=${path.basename(mapPath)}`;
                await fs.appendFile(dest, sourceMapComment, 'utf8');
            }
            
            const sizeInfo = finalSize !== originalSize 
                ? ` (${formatFileSize(originalSize)} → ${formatFileSize(finalSize)})`
                : ` (${formatFileSize(finalSize)})`;
            console.log(`✓ Copied ${file.name}${sizeInfo}`);
        } catch (error) {
            const errorMsg = `Failed to copy ${file.name}: ${error.message}`;
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
