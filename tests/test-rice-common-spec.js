const puppeteer = require('puppeteer');
const path = require('path');
const assert = require('assert');

async function testRiceCommonSpec() {
    console.log('🌾 Testing Common Rice KMS 2025-26 Uniform Specification in UI...');
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1500,950']
    });

    const page = await browser.newPage();
    await page.setCacheEnabled(false);
    await page.setViewport({ width: 1500, height: 950 });

    try {
        console.log('1. Navigating to http://localhost:3000/supervision.html...');
        await page.goto('http://localhost:3000/supervision.html?t=' + Date.now(), { waitUntil: 'networkidle2', timeout: 30000 });

        // Navigate to Rice view
        console.log('2. Switching to Rice Quality Inspection view...');
        await page.click('#superv-nav-rice');
        await new Promise(r => setTimeout(r, 600));

        // Check Table headers
        const headerText = await page.$eval('#riceLotsTable thead', el => el.innerText);
        assert(headerText.includes('(≤3.0%)'), 'Expected Damaged header to show (≤3.0%)');
        assert(headerText.includes('(NA)'), 'Expected Admixture header to show (NA)');
        assert(headerText.includes('(≤1.0%)'), 'Expected Small Broken header to show (≤1.0%)');
        assert(headerText.includes('(≤25.0%)'), 'Expected Total Broken header to show (≤25.0%)');
        console.log('✅ Column headers accurately reflect Common Rice KMS 2025-26 limits.');

        // Test Interactive Validation: Enter out-of-spec Damaged value 3.50% in Row 1
        console.log('3. Testing interactive out-of-spec validation (Damaged 3.50% > 3.0%)...');
        await page.evaluate(() => {
            const input = document.querySelector('#riceLotsTableBody tr:nth-child(1) .rice-damaged');
            input.value = '3.50';
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await new Promise(r => setTimeout(r, 300));

        const valAfter = await page.$eval('#riceLotsTableBody tr:nth-child(1) .rice-damaged', el => el.value);
        console.log('   Input value after event:', valAfter);

        // Check if class spec-violation is present on the input
        const hasViolationClass = await page.$eval(
            '#riceLotsTableBody tr:nth-child(1) .rice-damaged',
            el => el.classList.contains('spec-violation')
        );
        assert.strictEqual(hasViolationClass, true, 'Input should have spec-violation class when exceeding 3.0%');

        // Check if row result select automatically updated to BRL
        const rowResult = await page.$eval(
            '#riceLotsTableBody tr:nth-child(1) .rice-result',
            el => el.value
        );
        assert.strictEqual(rowResult, 'BRL', 'Row result should automatically switch to BRL');
        console.log('✅ Violation highlighted in red and row result set to BRL!');

        // Capture screenshot of violation
        const ssViolationPath = path.join(__dirname, 'rice_common_spec_violation.png');
        await page.screenshot({ path: ssViolationPath, fullPage: false });
        console.log(`📸 Violation screenshot saved: ${ssViolationPath}`);

        // Revert to compliant value 2.20%
        console.log('4. Testing interactive restoration to compliant value (2.20% <= 3.0%)...');
        await page.evaluate(() => {
            const input = document.querySelector('#riceLotsTableBody tr:nth-child(1) .rice-damaged');
            input.value = '2.20';
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await new Promise(r => setTimeout(r, 300));

        const isViolationCleared = await page.$eval(
            '#riceLotsTableBody tr:nth-child(1) .rice-damaged',
            el => !el.classList.contains('spec-violation')
        );
        assert.strictEqual(isViolationCleared, true, 'spec-violation class should be removed for 2.20%');

        const rowResultRestored = await page.$eval(
            '#riceLotsTableBody tr:nth-child(1) .rice-result',
            el => el.value
        );
        assert.strictEqual(rowResultRestored, 'Within Specification', 'Row result should restore to Within Specification');
        console.log('✅ Violation cleared and result restored to Within Specification!');

        // 5. Test Print Modal Template
        console.log('5. Opening Official Print Document modal...');
        await page.click('button[onclick="printCurrentRiceSheet()"]');
        await page.waitForSelector('#modalRicePrintView.open', { timeout: 5000 });
        await new Promise(r => setTimeout(r, 600));

        const printContent = await page.$eval('#printableRiceSheetArea', el => el.innerText);
        assert(printContent.includes('Uniform Specification for Common Rice (KMS 2025-2026)'), 'Print layout missing Uniform Spec header');
        assert(printContent.includes('Damaged: Max 3.0%'), 'Print layout missing Damaged Max 3.0%');
        assert(printContent.includes('Admixture: NA'), 'Print layout missing Admixture NA');
        assert(printContent.includes('FRK Blending: 1.0%'), 'Print layout missing FRK 1.0%');
        console.log('✅ Print preview document contains full official Uniform Specification schedule!');

        const ssPrintPath = path.join(__dirname, 'rice_common_print_preview.png');
        await page.screenshot({ path: ssPrintPath, fullPage: false });
        console.log(`📸 Print preview screenshot saved: ${ssPrintPath}`);

        console.log('\n🎉 ALL COMMON RICE KMS 2025-26 SPECIFICATION TESTS PASSED SUCCESSFULLY!');
    } catch (err) {
        console.error('❌ Rice spec test failed:', err);
        throw err;
    } finally {
        await browser.close();
    }
}

testRiceCommonSpec().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
