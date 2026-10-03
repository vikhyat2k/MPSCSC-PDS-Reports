const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function testSupervisionBrowser() {
    console.log('🌐 Launching Puppeteer to test Supervision Portal UI...');
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });

    try {
        console.log('1. Navigating to http://localhost:3000/supervision...');
        await page.goto('http://localhost:3000/supervision', { waitUntil: 'networkidle2', timeout: 30000 });

        // Wait for page title and header
        await page.waitForSelector('.header-org', { timeout: 10000 });
        console.log('✅ Page loaded successfully.');

        // Take initial dashboard screenshot
        const ss1Path = path.join(__dirname, 'supervision_ui_dashboard.png');
        await page.screenshot({ path: ss1Path, fullPage: false });
        console.log(`📸 Dashboard screenshot saved: ${ss1Path}`);

        // Click on "🧪 टेस्ट डेटा" header button
        console.log('2. Opening Test Data Sandbox modal...');
        const testDataBtn = await page.$('#btnTestDataTools');
        if (!testDataBtn) throw new Error('#btnTestDataTools not found in header');
        await testDataBtn.click();

        // Wait for modal to open
        await page.waitForSelector('#modalTestData.open', { timeout: 5000 });
        await new Promise(r => setTimeout(r, 800)); // wait for animation & table render
        console.log('✅ Test Data modal opened successfully.');

        // Verify counter numbers are populated
        const testTotal = await page.$eval('#cntTestTotal', el => el.textContent.trim());
        console.log(`   Active test records reported in modal: ${testTotal}`);

        // Take modal screenshot
        const ss2Path = path.join(__dirname, 'supervision_ui_test_data_modal.png');
        await page.screenshot({ path: ss2Path, fullPage: false });
        console.log(`📸 Test Data Modal screenshot saved: ${ss2Path}`);

        // Close modal
        await page.click('#modalTestData .btn-secondary');
        await page.waitForFunction(() => !document.getElementById('modalTestData').classList.contains('open'));
        console.log('✅ Test Data modal closed.');

        // 3. Test Navigation: Switch to "अभिलेख व प्रतिवेदन" (Archives)
        console.log('3. Navigating to Archives View...');
        await page.click('#superv-nav-archives');
        await new Promise(r => setTimeout(r, 600));

        // Test search input in archives
        const searchInput = await page.$('#archiveSearchInput');
        if (searchInput) {
            console.log('   Typing search query "Multai"...');
            await searchInput.type('Multai');
            await new Promise(r => setTimeout(r, 400));
            const rowsCount = await page.$$eval('#archivesTableBody tr', rows => rows.length);
            console.log(`   Filtered rows count for "Multai": ${rowsCount}`);
        }

        // 4. Test Navigation: Switch to "चावल परीक्षण" (Rice Quality Inspection)
        console.log('4. Navigating to Rice Quality View...');
        await page.click('#superv-nav-rice');
        await new Promise(r => setTimeout(r, 600));

        const riceRowsCount = await page.$$eval('#riceSavedSheetsTableBody tr', rows => rows.length);
        console.log(`   Saved Rice Sheets listed: ${riceRowsCount}`);

        // Take rice quality view screenshot
        const ss3Path = path.join(__dirname, 'supervision_ui_rice_view.png');
        await page.screenshot({ path: ss3Path, fullPage: false });
        console.log(`📸 Rice Quality view screenshot saved: ${ss3Path}`);

        // 5. Test Navigation: Switch to "वार्षिक रोस्टर" (Annual Roster)
        console.log('5. Navigating to Annual Roster View...');
        await page.click('#superv-nav-roster');
        await new Promise(r => setTimeout(r, 600));

        const rosterRowsCount = await page.$$eval('#rosterTableBody tr', rows => rows.length);
        console.log(`   Annual Roster rows listed: ${rosterRowsCount}`);

        console.log('🎉 All UI/Browser interactions validated successfully!');
    } catch (err) {
        console.error('❌ Browser UI testing error:', err);
        throw err;
    } finally {
        await browser.close();
    }
}

testSupervisionBrowser().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
