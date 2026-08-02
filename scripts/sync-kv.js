#!/usr/bin/env node

/**
 * scripts/sync-kv.js
 * 
 * Syncs JSON content from /content directory to Cloudflare KV storage.
 * Runs on every git push to main when /content changes.
 * 
 * Environment Variables Required:
 * - CLOUDFLARE_API_TOKEN: Cloudflare API token with KV edit permissions
 * - CLOUDFLARE_ACCOUNT_ID: Your Cloudflare account ID
 * - CLOUDFLARE_KV_NAMESPACE_ID: The KV namespace ID to sync to (CONTENT_KV)
 */

const fs = require('fs');
const path = require('path');

// Validate environment variables
const requiredEnvVars = [
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_KV_NAMESPACE_ID'
];

const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_KV_NAMESPACE_ID = process.env.CLOUDFLARE_KV_NAMESPACE_ID;

const CONTENT_DIR = path.join(__dirname, '../content');
const API_BASE = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}`;

/**
 * Recursively read all JSON and markdown files from a directory
 */
function readContentDirectory(dir, basePath = '') {
  const files = [];
  
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.join(basePath, entry.name);
      
      if (entry.isDirectory()) {
        // Recurse into subdirectories
        files.push(...readContentDirectory(fullPath, relativePath));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        // Include JSON and markdown files
        if (['.json', '.md'].includes(ext)) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          files.push({
            key: relativePath.replace(/\\/g, '/'), // Normalize path separators
            path: relativePath,
            content,
            ext
          });
        }
      }
    }
  } catch (err) {
    console.error(`❌ Error reading directory ${dir}:`, err.message);
  }
  
  return files;
}

/**
 * Upload a single key-value pair to Cloudflare KV
 */
async function uploadToKV(key, value) {
  const url = `${API_BASE}/values/${encodeURIComponent(key)}`;
  
  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value })
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorData}`);
    }
    
    return true;
  } catch (err) {
    console.error(`❌ Failed to upload key "${key}" to KV:`, err.message);
    return false;
  }
}

/**
 * Main sync function
 */
async function syncContent() {
  console.log('🔄 Starting Cloudflare KV sync...\n');
  
  if (!fs.existsSync(CONTENT_DIR)) {
    console.warn(`⚠️  Content directory not found at ${CONTENT_DIR}. Skipping sync.`);
    process.exit(0);
  }
  
  // Read all content files
  const files = readContentDirectory(CONTENT_DIR);
  
  if (files.length === 0) {
    console.warn('⚠️  No JSON or markdown files found in /content directory.');
    process.exit(0);
  }
  
  console.log(`📦 Found ${files.length} file(s) to sync:\n`);
  
  let successCount = 0;
  let failureCount = 0;
  
  // Upload each file to KV
  for (const file of files) {
    process.stdout.write(`  Syncing: ${file.key}... `);
    
    const success = await uploadToKV(file.key, file.content);
    
    if (success) {
      console.log('✅');
      successCount++;
    } else {
      console.log('❌');
      failureCount++;
    }
  }
  
  // Summary
  console.log(`\n📊 Sync Summary:`);
  console.log(`   ✅ Succeeded: ${successCount}`);
  console.log(`   ❌ Failed: ${failureCount}`);
  console.log(`   📁 Total: ${files.length}`);
  
  if (failureCount > 0) {
    console.error('\n❌ Sync completed with errors.');
    process.exit(1);
  } else {
    console.log('\n✅ All content successfully synced to Cloudflare KV!');
    process.exit(0);
  }
}

// Run sync
syncContent().catch(err => {
  console.error('💥 Fatal error during sync:', err);
  process.exit(1);
});
