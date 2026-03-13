/**
 * esbuild configuration for standalone executable
 */

const esbuild = require('esbuild');
const path = require('path');

const production = process.argv.includes('--production');

async function main() {
  try {
    const result = await esbuild.build({
      entryPoints: ['src/index.ts'],
      bundle: true,
      platform: 'node',
      target: 'node18',
      format: 'cjs',
      outfile: 'dist/standalone.js',
      external: [],
      sourcemap: !production,
      minify: production,
      treeShaking: true,
      logLevel: 'info',
      // Keep console logs for debugging
      drop: production ? [] : [],
    });

    console.log('✓ Build completed successfully');

    // Make executable on Unix systems
    if (process.platform !== 'win32') {
      const fs = require('fs');
      const outputPath = path.resolve(__dirname, 'dist', 'standalone.js');
      try {
        fs.chmodSync(outputPath, 0o755);
        console.log('✓ Made executable');
      } catch (err) {
        console.warn('Warning: Could not make file executable:', err.message);
      }
    }
  } catch (error) {
    console.error('✗ Build failed:', error);
    process.exit(1);
  }
}

main();
