#!/usr/bin/env node
/**
 * Verification Script for Lichess Tablebase Implementation
 * Run: node verify-implementation.js
 */

const fs = require('fs');
const path = require('path');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[36m';
const RESET = '\x1b[0m';

const checks = [];
let passCount = 0;
let failCount = 0;

function checkFile(filePath, description) {
  const exists = fs.existsSync(filePath);
  const status = exists ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
  console.log(`${status} ${description}`);
  if (!exists) failCount++;
  else passCount++;
  return exists;
}

function checkContent(filePath, searchString, description) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const exists = content.includes(searchString);
    const status = exists ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
    console.log(`${status} ${description}`);
    if (!exists) failCount++;
    else passCount++;
    return exists;
  } catch (e) {
    console.log(`${RED}✗${RESET} ${description} (File error: ${e.message})`);
    failCount++;
    return false;
  }
}

console.log(`\n${BLUE}╔════════════════════════════════════════════════════════╗${RESET}`);
console.log(`${BLUE}║   ChessWeb Tablebase Implementation Verification       ║${RESET}`);
console.log(`${BLUE}╚════════════════════════════════════════════════════════╝${RESET}\n`);

console.log(`${YELLOW}Backend Files:${RESET}`);
checkFile('backend/lichessTablebase.js', 'Enhanced Lichess API wrapper');
checkFile('backend/tablebaseUtils.js', 'Analysis utilities');
checkFile('backend/test-tablebase-integration.js', 'Integration tests');
checkFile('backend/server.js', 'Express server');

console.log(`\n${YELLOW}Frontend Files:${RESET}`);
checkFile('src/services/tablebaseService.js', 'Client tablebase service');
checkFile('src/utils/localTablebaseCache.js', 'Enhanced frontend cache');
checkFile('src/utils/tablebaseStatsManager.js', 'Stats manager');

console.log(`\n${YELLOW}Documentation:${RESET}`);
checkFile('TABLEBASE_GUIDE.md', 'Comprehensive guide');
checkFile('TABLEBASE_SETUP.md', 'Setup instructions');
checkFile('IMPLEMENTATION_SUMMARY.md', 'Summary document');

console.log(`\n${YELLOW}Backend Implementation Checks:${RESET}`);
checkContent('backend/lichessTablebase.js', 'EnhancedLRUCache', 'LRU cache implementation');
checkContent('backend/lichessTablebase.js', 'queryTablebaseMainline', 'Mainline query support');
checkContent('backend/lichessTablebase.js', 'VALID_VARIANTS', 'Variant support');
checkContent('backend/lichessTablebase.js', 'normalizeResponse', 'Response normalization');
checkContent('backend/lichessTablebase.js', 'QUERY_TIMEOUT_MS', 'Timeout protection');

console.log(`\n${YELLOW}Server Endpoint Checks:${RESET}`);
checkContent('backend/server.js', '/api/tablebase', 'Tablebase endpoint');
checkContent('backend/server.js', '/api/tablebase/mainline', 'Mainline endpoint');
checkContent('backend/server.js', '/api/tablebase/cache/stats', 'Cache stats endpoint');
checkContent('backend/server.js', 'queryTablebaseMainline', 'Mainline socket handler');

console.log(`\n${YELLOW}Frontend Service Checks:${RESET}`);
checkContent('src/services/tablebaseService.js', 'queryTablebase', 'Query function');
checkContent('src/services/tablebaseService.js', 'queryTablebaseMainline', 'Mainline function');
checkContent('src/services/tablebaseService.js', 'getBestMoveUCI', 'Move extraction');
checkContent('src/services/tablebaseService.js', 'getWDLPercentages', 'WDL calculation');
checkContent('src/services/tablebaseService.js', 'getWinningMoves', 'Move filtering');

console.log(`\n${YELLOW}Cache Implementation Checks:${RESET}`);
checkContent('backend/lichessTablebase.js', 'cache.size >= this.maxSize', 'Backend LRU eviction');
checkContent('src/utils/localTablebaseCache.js', 'lastAccessed', 'Frontend LRU tracking');
checkContent('src/utils/localTablebaseCache.js', 'QuotaExceededError', 'Quota handling');
checkContent('backend/lichessTablebase.js', 'getCacheStats', 'Cache stats function');

console.log(`\n${YELLOW}Documentation Quality:${RESET}`);
checkContent('TABLEBASE_GUIDE.md', 'Architecture', 'Architecture explanation');
checkContent('TABLEBASE_GUIDE.md', '/api/tablebase', 'API documentation');
checkContent('TABLEBASE_GUIDE.md', 'Example', 'Code examples');
checkContent('TABLEBASE_SETUP.md', 'Quick Start', 'Setup guide');
checkContent('TABLEBASE_SETUP.md', 'curl -X POST', 'API examples');

console.log(`\n${YELLOW}Features Check:${RESET}`);
checkContent('backend/lichessTablebase.js', 'standard', 'Standard variant');
checkContent('backend/lichessTablebase.js', 'atomic', 'Atomic variant');
checkContent('backend/lichessTablebase.js', 'antichess', 'Antichess variant');
checkContent('backend/lichessTablebase.js', 'dtz', 'DTZ metric');
checkContent('backend/lichessTablebase.js', 'dtm', 'DTM metric');
checkContent('backend/tablebaseUtils.js', 'analyzePosition', 'Position analysis');

console.log(`\n${YELLOW}Test Suite:${RESET}`);
checkContent('backend/test-tablebase-integration.js', 'KPvK', 'KPvK test');
checkContent('backend/test-tablebase-integration.js', 'analyzePosition', 'Analysis test');
checkContent('backend/test-tablebase-integration.js', 'tablebaseModule.getCacheStats', 'Cache test');

console.log(`\n${BLUE}═══════════════════════════════════════════════════════${RESET}`);
console.log(`\n${BLUE}Summary:${RESET}`);
console.log(`${GREEN}✓ Passed: ${passCount}${RESET}`);
console.log(`${RED}✗ Failed: ${failCount}${RESET}`);
console.log(`Total Checks: ${passCount + failCount}\n`);

if (failCount === 0) {
  console.log(`${GREEN}✨ All verification checks passed! Implementation complete.${RESET}\n`);
  process.exit(0);
} else {
  console.log(`${RED}⚠️  Some checks failed. Review the items marked with ✗${RESET}\n`);
  process.exit(1);
}
