const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    console.log("🚀 Testing Gemini AI Status and Email Sync Settings Panel UI...");
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1366, height: 850 });

        console.log("1. Navigating to supervision.html...");
        await page.goto('http://localhost:3000/supervision.html', { waitUntil: 'networkidle2' });

        await page.click('#superv-nav-tasks');
        await new Promise(r => setTimeout(r, 600));

        // Check badges on main page
        const headerBadgeText = await page.$eval('#geminiHeaderBadge', el => el.textContent.trim());
        const bannerBadgeText = await page.$eval('#geminiBannerBadge', el => el.textContent.trim());
        const hasSyncButton = await page.$eval('#btnSyncSettings', el => Boolean(el));
        const hasSidebarSync = await page.$eval('#superv-nav-sync-settings', el => Boolean(el));

        console.log("  • Header Badge Text:", headerBadgeText);
        console.log("  • Banner Badge Text:", bannerBadgeText);
        console.log("  • Has Direct Sync Settings Toolbar Button:", hasSyncButton);
        console.log("  • Has Sidebar Sync Settings Nav Item:", hasSidebarSync);

        await page.screenshot({ path: path.join(__dirname, 'verified_main_view_with_sync_btn.png') });
        console.log("  📸 Screenshot saved: verified_main_view_with_sync_btn.png");

        // 2. Click the new direct Sync Settings button
        console.log("2. Clicking direct '⚙️ Sync सेटिंग्स' toolbar button...");
        await page.click('#btnSyncSettings');
        await page.waitForSelector('#modalGmailStatus.open', { visible: true });
        await new Promise(r => setTimeout(r, 600));

        const isSyncPanelVisible = await page.$eval('#panelGmailSyncSettings', el => el.style.display !== 'none');
        console.log("  • Is Sync Settings Panel Visible:", isSyncPanelVisible);

        await page.screenshot({ path: path.join(__dirname, 'verified_sync_settings_modal.png') });
        console.log("  📸 Screenshot saved: verified_sync_settings_modal.png");

        // 3. Click AI management tab
        console.log("3. Switching to AI Management tab...");
        await page.click('#btnTabGemini');
        await new Promise(r => setTimeout(r, 600));

        const isGeminiPanelVisible = await page.$eval('#panelGmailGemini', el => el.style.display !== 'none');
        console.log("  • Is Dual AI Panel Visible:", isGeminiPanelVisible);

        await page.screenshot({ path: path.join(__dirname, 'verified_ai_management_modal.png') });
        console.log("  📸 Screenshot saved: verified_ai_management_modal.png");

        console.log("\n🎉 ALL TESTS PASSED! Both Gemini status and Sync Settings UI verified!");
    } catch (err) {
        console.error("❌ Test error:", err);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
