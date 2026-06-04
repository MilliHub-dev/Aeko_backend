// Patches @aeko-chain/web3.js dist/*.js to add .js extensions to bare
// relative imports, which are required for Node.js ESM strict resolution.
// The published package omits them, causing ERR_MODULE_NOT_FOUND on Railway.
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'node_modules', '@aeko-chain', 'web3.js', 'dist');

if (!fs.existsSync(distDir)) {
  console.log('[fix-aeko-chain] package not found, skipping');
  process.exit(0);
}

const files = fs.readdirSync(distDir).filter(f => f.endsWith('.js'));
let patchedCount = 0;

for (const file of files) {
  const filePath = path.join(distDir, file);
  const content = fs.readFileSync(filePath, 'utf8');

  // Add .js to bare relative imports/exports that don't already have an extension
  const patched = content
    .replace(/from '(\.[^']+)(?<!\.js)'/g, "from '$1.js'")
    .replace(/export \* from '(\.[^']+)(?<!\.js)'/g, "export * from '$1.js'");

  if (patched !== content) {
    fs.writeFileSync(filePath, patched, 'utf8');
    console.log(`[fix-aeko-chain] patched ${file}`);
    patchedCount++;
  }
}

if (patchedCount === 0) {
  console.log('[fix-aeko-chain] all files already patched, nothing to do');
} else {
  console.log(`[fix-aeko-chain] patched ${patchedCount} file(s) in @aeko-chain/web3.js/dist`);
}
