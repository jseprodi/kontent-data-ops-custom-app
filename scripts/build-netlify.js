// Simplified build script for Netlify deployment
// This skips TypeScript compilation since frontend files are already JavaScript

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Terser will be imported dynamically if available
let terserModule = null;

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
    // Try to import terser if not already imported
    if (!terserModule) {
        try {
            terserModule = await import('terser');
        } catch (error) {
            console.warn('⚠️  terser not available, skipping minification');
            return {
                code: content,
                map: null
            };
        }
    }
    
    try {
        const result = await terserModule.minify(content, {
            compress: {
                drop_console: false,
                drop_debugger: true,
                pure_funcs: ['console.debug']
            },
            mangle: {
                reserved: ['state', 'elements', 'logger']
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
    return content
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s+/g, ' ')
        .replace(/;\s*}/g, ';}')
        .replace(/\s*{\s*/g, '{')
        .replace(/\s*}\s*/g, '}')
        .replace(/\s*:\s*/g, ':')
        .replace(/\s*;\s*/g, ';')
        .trim();
}

async function build() {
    console.log('Building Kontent.ai Data-Ops Custom App for Netlify...');
    
    const projectRoot = path.resolve(__dirname, '..');
    const distDir = path.join(projectRoot, 'dist');
    const frontendDir = path.join(projectRoot, 'frontend');
    const isProduction = process.env.NODE_ENV === 'production';
    const buildErrors = [];
    let totalSize = 0;
    
    try {
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
                    const minified = await minifyJS(content, source, dest, true);
                    content = minified.code;
                    sourceMapContent = minified.map;
                    console.log(`  ✓ Minified JS${sourceMapContent ? ' (with source map)' : ''}`);
                } else if (file.name.endsWith('.css')) {
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
    
    if (buildErrors.length > 0) {
        console.error('\n✗ Build completed with errors:');
        buildErrors.forEach(error => {
            console.error(`  - ${error}`);
        });
        throw new Error('Build failed due to errors');
    }
    
    console.log('\n✓ Build complete!');
    console.log(`📦 Total build size: ${formatFileSize(totalSize)}`);
    console.log('The app is ready in the dist/ directory.');
}

build().catch(error => {
    console.error('Build failed:', error);
    process.exit(1);
});

