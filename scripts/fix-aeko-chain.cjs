// Patches @aeko-chain/web3.js dist/index.js to add .js extensions to bare
// relative imports, which are required for Node.js ESM strict resolution.
// The published package omits them, causing ERR_MODULE_NOT_FOUND on Railway.
const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'node_modules', '@aeko-chain', 'web3.js', 'dist', 'index.js');

if (!fs.existsSync(target)) {
  console.log('[fix-aeko-chain] package not found, skipping');
  process.exit(0);
}

let content = fs.readFileSync(target, 'utf8');

// Add .js to bare relative imports that don't already have an extension
const patched = content.replace(/from '(\.[^']+)(?<!\.js)'/g, "from '$1.js'");

if (patched === content) {
  console.log('[fix-aeko-chain] already patched, nothing to do');
} else {
  fs.writeFileSync(target, patched, 'utf8');
  console.log('[fix-aeko-chain] patched @aeko-chain/web3.js/dist/index.js');
}
