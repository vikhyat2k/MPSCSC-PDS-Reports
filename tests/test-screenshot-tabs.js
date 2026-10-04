const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 850 });

        await page.goto('http://localhost:3000/supervision.html', { waitUntil: 'networkidle2' });
        await page.click('#superv-nav-tasks');
        await new Promise(r => setTimeout(r, 400));
        await page.click('#btnManageGmail');
        await page.waitForSelector('#modalGmailStatus.open', { visible: true });

        // Screenshot OAuth tab
        await page.click('#btnTabOAuth');
        await new Promise(r => setTimeout(r, 400));
        await page.screenshot({ path: path.join(__dirname, 'gmail_modal_tab_oauth.png') });

        // Screenshot App Password tab
        await page.click('#btnTabAppPassword');
        await new Promise(r => setTimeout(r, 400));
        await page.screenshot({ path: path.join(__dirname, 'gmail_modal_tab_apppw.png') });

        console.log('✅ Both tab screenshots saved!');
    } catch (err) {
        console.error(err);
    } finally {
        await browser.close();
    }
})();
