const puppeteer = require('puppeteer');

async function testSidebar() {
    console.log('🧪 Starting Sidebar Auto-Shrink Test...');
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1400, height: 900 });

        console.log('1. Loading supervision page...');
        await page.goto('http://localhost:3000/supervision.html', { waitUntil: 'domcontentloaded' });
        await new Promise(r => setTimeout(r, 1000));

        let initialWidth = await page.evaluate(() => document.getElementById('appSidebar').offsetWidth);
        console.log('   Initial width:', initialWidth, '(Expected ~260px)');

        console.log('2. Clicking toggle button...');
        await page.click('.header-toggle-btn');
        await new Promise(r => setTimeout(r, 500));

        let collapsedWidth = await page.evaluate(() => document.getElementById('appSidebar').offsetWidth);
        let wrapperClass = await page.evaluate(() => document.getElementById('appWrapper').className);
        console.log('   Collapsed width:', collapsedWidth, 'Wrapper class:', wrapperClass);

        console.log('3. Hovering over sidebar...');
        await page.hover('#appSidebar');
        await new Promise(r => setTimeout(r, 500));
        let hoveredWidth = await page.evaluate(() => document.getElementById('appSidebar').offsetWidth);
        console.log('   Hovered width:', hoveredWidth, '(Expected ~260px on hover-expansion)');

        console.log('4. Moving mouse away (testing auto-shrink)...');
        await page.mouse.move(800, 300);
        await new Promise(r => setTimeout(r, 500));
        let autoShrunkWidth = await page.evaluate(() => document.getElementById('appSidebar').offsetWidth);
        console.log('   Auto-shrunk width after mouse-out:', autoShrunkWidth, '(Expected ~72px)');

    } finally {
        await browser.close();
    }
}

testSidebar().catch(console.error);
