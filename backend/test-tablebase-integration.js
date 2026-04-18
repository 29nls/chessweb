/**
 * Tablebase Integration Tests
 * Run with: npm test (from backend directory)
 */

const tablebaseModule = require('./lichessTablebase');
const tablebaseUtils = require('./tablebaseUtils');

// Test FENs - endgame positions
const TEST_POSITIONS = {
  'KPvK': {
    fen: '4k3/6KP/8/8/8/8/8/8 w - - 0 1',
    expected: 'win',
    description: 'King and Pawn vs King - should be winning'
  },
  'KQvK': {
    fen: '4k3/8/8/8/8/8/8/3QK3 w - - 0 1',
    expected: 'win',
    description: 'Queen and King vs King - should be winning'
  },
  'Draw': {
    fen: '8/8/3k4/8/3K4/8/8/8 w - - 0 1',
    expected: 'draw',
    description: 'Kings only - should be draw'
  },
  'KRvK': {
    fen: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1',
    expected: 'win',
    description: 'Rook and King vs King'
  }
};

/**
 * Run all tests
 */
async function runTests() {
  console.log('🧪 Starting Tablebase Integration Tests\n');
  console.log('━'.repeat(60));

  let passed = 0;
  let failed = 0;

  for (const [name, test] of Object.entries(TEST_POSITIONS)) {
    try {
      console.log(`\n📋 Test: ${name}`);
      console.log(`   Description: ${test.description}`);
      console.log(`   FEN: ${test.fen.substring(0, 40)}...`);

      const result = await tablebaseModule.queryTablebase(test.fen, 'standard');

      if (result.error) {
        console.log(`   ❌ FAILED: ${result.error}`);
        failed++;
        continue;
      }

      // Verify response structure
      const hasRequiredFields = 
        'dtz' in result &&
        'dtm' in result &&
        'checkmate' in result &&
        'stalemate' in result &&
        'category' in result &&
        Array.isArray(result.moves) &&
        Array.isArray(result.mainline);

      if (!hasRequiredFields) {
        console.log('   ❌ FAILED: Missing required fields');
        failed++;
        continue;
      }

      console.log(`   ✓ Response structure valid`);
      console.log(`   ✓ Category: ${result.category}`);
      console.log(`   ✓ DTZ: ${result.dtz}`);
      console.log(`   ✓ DTM: ${result.dtm}`);
      console.log(`   ✓ Moves available: ${result.moves.length}`);

      if (result.moves.length > 0) {
        const bestMove = result.moves[0];
        console.log(`   ✓ Best move: ${bestMove.san} (${bestMove.uci})`);
        if (bestMove.wdl) {
          console.log(`     WDL: W=${bestMove.wdl.wins} D=${bestMove.wdl.draws} L=${bestMove.wdl.losses}`);
        }
      }

      // Analyze position
      const analysis = tablebaseUtils.analyzePosition(result);
      console.log(`   ✓ Analysis: ${JSON.stringify(analysis, null, 2).split('\n').join('\n     ')}`);

      passed++;
      console.log('   ✅ PASSED');

    } catch (error) {
      console.log(`   ❌ FAILED: ${error.message}`);
      failed++;
    }
  }

  console.log('\n' + '━'.repeat(60));
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed out of ${Object.keys(TEST_POSITIONS).length} tests\n`);

  // Cache stats
  console.log('💾 Backend Cache Statistics:');
  const cacheStats = tablebaseModule.getCacheStats();
  console.log(`   Size: ${cacheStats.size}/${cacheStats.maxSize}`);
  console.log(`   TTL: ${cacheStats.ttlSeconds} seconds\n`);

  if (failed === 0) {
    console.log('✨ All tests passed!\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed\n');
    process.exit(1);
  }
}

// Run tests
runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
