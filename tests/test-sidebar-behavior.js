const puppeteer = require('puppeteer');

async function run() {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1400, height: 900 });
        await page.goto('http://localhost:3000/supervision.html', { waitUntil: 'networkidle0' });

        const initWidth = await page.evaluate(() => document.getElementById('appSidebar').offsetWidth);
        const initWrapperClass = await page.evaluate(() => document.getElementById('appWrapper').className);
        console.log('Supervision - Initial sidebar width:', initWidth, 'wrapper class:', initWrapperClass);

        // Click toggle
        await page.click('.header-toggle-btn');
        await new Promise(r => setTimeout(r, 600));

        const postToggleWidth = await page.evaluate(() => document.getElementById('appSidebar').offsetWidth);
        const postToggleWrapperClass = await page.evaluate(() => document.getElementById('appWrapper').className);
        const postToggleSbClass = await page.evaluate(() => document.getElementById('appSidebar').className);
        console.log('Supervision - After toggle width:', postToggleWidth, 'wrapper class:', postToggleWrapperClass, 'sb class:', postToggleSbClass);

        // Now test index.html as well
        await page.goto('http://localhost:3000/index.html', { waitUntil: 'networkidle0' });
        const idxInitWidth = await page.evaluate(() => document.getElementById('appSidebar').offsetWidth);
        console.log('Index - Initial sidebar width:', idxInitWidth);
        await page.click('.header-toggle-btn');
        await new Promise(r => setTimeout(r, 600));
        const idxPostToggleWidth = await page.evaluate(() => document.getElementById('appSidebar').offsetWidth);
        const idxPostWrapperClass = await page.evaluate(() => document.getElementById('appWrapper').className);
        console.log('Index - After toggle width:', idxPostToggleWidth, 'wrapper class:', idxPostWrapperClass);

    } finally {
        await browser.close();
    }
}

run().catch(console.error);
