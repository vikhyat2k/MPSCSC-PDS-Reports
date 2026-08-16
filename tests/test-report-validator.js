const reportValidator = require('../server/services/reportValidator');
const assert = require('assert');

async function runTests() {
    console.log('🧪 Testing ReportValidator unit labels and tolerance logic...');

    // Test 1: Successful validation with matched totals
    const mockValidResult = {
        sectors: [{ shops: [{ shopCode: '101' }] }],
        totals: { totalAllocation: 1000.0, totalDispatch: 800.0 },
        verification: {
            alloted: { wheat: 600.0, rice: 400.0 },
            dispatched: { wheat: 500.0, rice: 300.0 }
        }
    };

    const res = await reportValidator.validate(mockValidResult, 'nfsa', 8, 2026, null);
    assert.strictEqual(res, true, 'Valid result should pass');
    console.log('✅ Test 1 Passed: Valid result verified');

    // Test 2: Allocation discrepancy throws error with "Qt" (not "MT")
    const mockMismatchedResult = {
        sectors: [{ shops: [{ shopCode: '101' }] }],
        totals: { totalAllocation: 120465.98, totalDispatch: 66143.13 },
        verification: {
            alloted: { wheat: 66143.13 },
            dispatched: { wheat: 66143.13 }
        }
    };

    let errorThrown = false;
    try {
        await reportValidator.validate(mockMismatchedResult, 'nfsa', 8, 2026, null);
    } catch (err) {
        errorThrown = true;
        console.log(`Caught expected error: "${err.message}"`);
        assert.ok(err.message.includes('Qt'), 'Error message must contain Qt');
        assert.ok(!err.message.includes('MT'), 'Error message must NOT contain MT');
    }
    assert.ok(errorThrown, 'Error should be thrown on allocation discrepancy');
    console.log('✅ Test 2 Passed: Error correctly uses Qt instead of MT');

    console.log('🎉 All ReportValidator unit tests passed successfully!');
}

runTests().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
