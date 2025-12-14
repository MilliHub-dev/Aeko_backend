#!/usr/bin/env node

/**
 * Railway Deployment Fix Script
 * Run this to quickly switch between minimal and full server
 */

import fs from 'fs';
import { execSync } from 'child_process';

const args = process.argv.slice(2);
const mode = args[0] || 'help';

console.log('🚀 Railway Deployment Fix Tool\n');

switch (mode) {
  case 'minimal':
    console.log('📦 Switching to minimal server...');
    updatePackageJson('minimal');
    console.log('✅ Updated package.json to use minimal server');
    console.log('🚀 Deploy with: railway up');
    console.log('🔗 Test: https://your-app.railway.app/health');
    break;

  case 'full':
    console.log('📦 Switching to full server...');
    updatePackageJson('full');
    console.log('✅ Updated package.json to use full server');
    console.log('🚀 Deploy with: railway up');
    console.log('🔗 Admin: https://your-app.railway.app/admin');
    console.log('🔗 Swagger: https://your-app.railway.app/api-docs');
    break;

  case 'debug':
    console.log('🔍 Switching to debug server...');
    updatePackageJson('debug');
    console.log('✅ Updated package.json to use debug server');
    console.log('🚀 Deploy with: railway up');
    console.log('🔗 Debug: https://your-app.railway.app/env-check');
    break;

  case 'test':
    console.log('🧪 Testing current configuration...');
    testLocalServer();
    break;

  case 'help':
  default:
    showHelp();
    break;
}

function updatePackageJson(mode) {
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    switch (mode) {
      case 'minimal':
        packageJson.scripts.start = 'node server-minimal.js';
        break;
      case 'debug':
        packageJson.scripts.start = 'node railway-debug.js';
        break;
      case 'full':
      default:
        packageJson.scripts.start = 'node server.js';
        break;
    }
    
    fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
    console.log(`📝 Start script updated to: ${packageJson.scripts.start}`);
  } catch (error) {
    console.error('❌ Error updating package.json:', error.message);
  }
}

function testLocalServer() {
  try {
    console.log('🔍 Testing minimal server locally...');
    execSync('node server-minimal.js &', { stdio: 'inherit' });
    
    setTimeout(() => {
      try {
        console.log('🧪 Testing endpoints...');
        execSync('curl -s http://localhost:9876/health', { stdio: 'inherit' });
      } catch (error) {
        console.log('❌ Local test failed:', error.message);
      }
    }, 2000);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

function showHelp() {
  console.log(`Usage: node fix-railway.js [command]

Commands:
  minimal   Switch to minimal server (for debugging)
  debug     Switch to debug server (detailed diagnostics)  
  full      Switch to full server (production mode)
  test      Test current server locally
  help      Show this help message

Examples:
  node fix-railway.js minimal    # Use minimal server
  node fix-railway.js full       # Use full server
  node fix-railway.js test       # Test locally

After switching modes, deploy with:
  railway up

Check Railway logs with:
  railway logs
`);
}