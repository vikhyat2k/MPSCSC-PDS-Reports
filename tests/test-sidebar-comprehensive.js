const puppeteer = require('puppeteer');
const path = require('path');

async function testComprehensiveSidebar() {
    console.log('🚀 Running Comprehensive Sidebar Auto-Shrink Test Suite...\n');
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1400, height: 900 });

        // 1. Load supervision page
        console.log('1️⃣ Loading http://localhost:3000/supervision.html...');
        await page.goto('http://localhost:3000/supervision.html', { waitUntil: 'domcontentloaded' });
        await new Promise(r => setTimeout(r, 800));

        // Clear any stored state for clean test run
        await page.evaluate(() => localStorage.removeItem('sidebar-collapsed'));
        await page.reload({ waitUntil: 'domcontentloaded' });
        await new Promise(r => setTimeout(r, 600));

        // Initial check: 260px wide
        const initialWidth = await page.evaluate(() => document.getElementById('appSidebar').offsetWidth);
        const initialShellMargin = await page.evaluate(() => window.getComputedStyle(document.querySelector('.app-shell')).marginLeft);
        console.log(`   Initial State: Sidebar Width = ${initialWidth}px, AppShell MarginLeft = ${initialShellMargin}`);
        if (initialWidth !== 260) throw new Error(`Expected initial width 260, got ${initialWidth}`);

        // 2. Click toggle button to collapse and move mouse away into main content
        console.log('2️⃣ Toggling sidebar to collapsed mode and moving cursor into main shell...');
        await page.click('.header-toggle-btn');
        await page.mouse.move(600, 300); // move away so hover is NOT triggered
        await new Promise(r => setTimeout(r, 500));

        const collapsedWidth = await page.evaluate(() => document.getElementById('appSidebar').offsetWidth);
        const collapsedShellMargin = await page.evaluate(() => window.getComputedStyle(document.querySelector('.app-shell')).marginLeft);
        const isCollapsedClass = await page.evaluate(() => document.getElementById('appWrapper').classList.contains('sidebar-collapsed'));
        console.log(`   Collapsed State: Sidebar Width = ${collapsedWidth}px, AppShell MarginLeft = ${collapsedShellMargin}, HasClass = ${isCollapsedClass}`);

        if (collapsedWidth !== 72) throw new Error(`Expected collapsed width 72px, got ${collapsedWidth}px`);
        if (collapsedShellMargin !== '72px') throw new Error(`Expected shell margin 72px, got ${collapsedShellMargin}`);

        // Save collapsed screenshot
        const ssCollapsed = path.join(__dirname, 'supervision_sidebar_collapsed.png');
        await page.screenshot({ path: ssCollapsed, fullPage: false });
        console.log(`📸 Collapsed screenshot saved to: ${ssCollapsed}`);

        // 3. Hover over collapsed sidebar
        console.log('3️⃣ Hovering over collapsed sidebar to test auto-expansion...');
        await page.mouse.move(30, 200); // hover over sidebar icon area
        await new Promise(r => setTimeout(r, 500));

        const hoverWidth = await page.evaluate(() => document.getElementById('appSidebar').offsetWidth);
        console.log(`   Hover Expansion: Sidebar Width = ${hoverWidth}px`);
        if (hoverWidth !== 260) throw new Error(`Expected hover expanded width 260px, got ${hoverWidth}px`);

        // 4. Move mouse away to test auto-shrink
        console.log('4️⃣ Moving cursor away into page content to test AUTO-SHRINK...');
        await page.mouse.move(700, 400);
        await new Promise(r => setTimeout(r, 500));

        const autoShrunkWidth = await page.evaluate(() => document.getElementById('appSidebar').offsetWidth);
        console.log(`   Auto-Shrunk State: Sidebar Width = ${autoShrunkWidth}px`);
        if (autoShrunkWidth !== 72) throw new Error(`Expected auto-shrunk width 72px, got ${autoShrunkWidth}px`);

        // 5. Test localStorage restoration
        console.log('5️⃣ Testing persistence across page reload...');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await new Promise(r => setTimeout(r, 500));
        const reloadedWidth = await page.evaluate(() => document.getElementById('appSidebar').offsetWidth);
        console.log(`   Restored State: Sidebar Width = ${reloadedWidth}px (Expected 72px)`);
        if (reloadedWidth !== 72) throw new Error(`Expected persisted width 72px, got ${reloadedWidth}px`);

        // 6. Click toggle button again to expand back to normal
        console.log('6️⃣ Toggling sidebar back to expanded full mode...');
        await page.click('.header-toggle-btn');
        await page.mouse.move(600, 300);
        await new Promise(r => setTimeout(r, 500));

        const expandedWidth = await page.evaluate(() => document.getElementById('appSidebar').offsetWidth);
        console.log(`   Expanded State: Sidebar Width = ${expandedWidth}px (Expected 260px)`);
        if (expandedWidth !== 260) throw new Error(`Expected expanded width 260px, got ${expandedWidth}px`);

        // 7. Test responsive auto-shrink on viewport resize to laptop/tablet (1024px)
        console.log('7️⃣ Testing responsive auto-shrink on 1024px viewport...');
        await page.evaluate(() => localStorage.removeItem('sidebar-collapsed')); // clear preference to test auto-shrink
        await page.setViewport({ width: 1024, height: 768 });
        await page.evaluate(() => window.dispatchEvent(new Event('resize')));
        await new Promise(r => setTimeout(r, 500));

        const responsiveWidth = await page.evaluate(() => document.getElementById('appSidebar').offsetWidth);
        console.log(`   1024px Viewport State: Sidebar Width = ${responsiveWidth}px (Expected 72px auto-shrunk)`);
        if (responsiveWidth !== 72) throw new Error(`Expected auto-shrunk 72px on 1024px, got ${responsiveWidth}px`);

        console.log('\n🎉 ALL SIDEBAR AUTO-SHRINK TESTS PASSED PERFECTLY!\n');
    } finally {
        await browser.close();
    }
}

testComprehensiveSidebar().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
