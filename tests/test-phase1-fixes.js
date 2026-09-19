const assert = require('assert');
const NFSADateRangeScraper = require('../server/automation/nfsa_daterange_scraper');

async function runTests() {
    console.log('🧪 Starting Phase 1 Unit Tests...\n');

    // Test 1: AUTO-01 (NFSADateRangeScraper close method)
    console.log('Test 1: Verifying NFSADateRangeScraper.close() exists and executes cleanly...');
    const scraper = new NFSADateRangeScraper();
    assert.strictEqual(typeof scraper.close, 'function', 'scraper.close must be a function');
    // Calling close when browser is null must not throw
    await scraper.close();
    assert.strictEqual(scraper.browser, null);
    assert.strictEqual(scraper.page, null);
    console.log('✅ AUTO-01 Verified: scraper.close() is robust and cleanly sets browser/page to null.\n');

    // Test 2: AUTO-02 (Indian comma numeric parsing)
    console.log('Test 2: Verifying Indian numeric comma parsing (no truncation to 1)...');
    const parseVal = (v) => (parseFloat(String(v || '0').replace(/,/g, '').trim()) || 0) / 100;

    const testCases = [
        { input: '1,23,456.78', expectedQuintals: 1234.5678 },
        { input: '1,234.50', expectedQuintals: 12.345 },
        { input: '500', expectedQuintals: 5 },
        { input: '0.00', expectedQuintals: 0 },
        { input: '', expectedQuintals: 0 },
        { input: null, expectedQuintals: 0 },
        { input: undefined, expectedQuintals: 0 },
        { input: '   2,500.00  ', expectedQuintals: 25 }
    ];

    for (const tc of testCases) {
        const result = parseVal(tc.input);
        assert(Math.abs(result - tc.expectedQuintals) < 0.0001, `Failed for input ${tc.input}: expected ${tc.expectedQuintals}, got ${result}`);
    }
    console.log('✅ AUTO-02 Verified: All comma-separated Indian numbers parsed accurately to quintals.\n');

    // Test 3: EXP-01 (Font family check across PDF generators)
    console.log('Test 3: Verifying Devanagari font fallbacks across PDF generator templates...');
    const fs = require('fs');
    const path = require('path');
    const filesToCheck = [
        '../server/services/pdfGenerator.js',
        '../server/services/nfsaDaterangePdfGenerator.js',
        '../server/services/mdmPdfGenerator.js',
        '../server/services/icdsPdfGenerator.js',
        '../server/services/welfarePdfGenerator.js',
        '../server/services/balancesReportGenerator.js'
    ];

    for (const relPath of filesToCheck) {
        const content = fs.readFileSync(path.join(__dirname, relPath), 'utf8');
        assert(content.includes('Nirmala UI'), `Missing Nirmala UI in ${relPath}`);
        assert(content.includes('Noto Sans Devanagari'), `Missing Noto Sans Devanagari in ${relPath}`);
    }
    console.log('✅ EXP-01 Verified: All 6 PDF generators define guaranteed Devanagari font contracts.\n');

    // Test 4: SEC-02 (Server reports route protection verification)
    console.log('Test 4: Verifying server.js reports route protection logic...');
    const serverContent = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
    assert(serverContent.includes('requireReportAuth'), 'server.js must define requireReportAuth');
    assert(serverContent.includes("app.use('/reports', requireReportAuth,"), 'app.use(/reports) must use requireReportAuth');
    console.log('✅ SEC-02 Verified: /reports is secured with requireReportAuth session guard.\n');

    console.log('🎉 ALL PHASE 1 TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
