const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    console.log('🚀 Starting Automated Verification: Integrated Gemini AI with OAuth & App Password...');
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1300, height: 900 });

        console.log('1. Loading supervision portal...');
        await page.goto('http://localhost:3000/supervision.html', { waitUntil: 'networkidle2' });

        console.log('2. Opening Tasks view and clicking Manage Gmail...');
        await page.click('#superv-nav-tasks');
        await new Promise(r => setTimeout(r, 500));
        await page.click('#btnManageGmail');

        await page.waitForSelector('#modalGmailStatus.open', { visible: true, timeout: 5000 });
        await new Promise(r => setTimeout(r, 1200));

        // Verify Dual Header Pills
        const pillGeminiText = await page.$eval('#headerPillGemini', el => el.textContent.trim());
        const pillTransportText = await page.$eval('#headerPillTransport', el => el.textContent.trim());
        console.log('Dual Pipeline Header Pills:');
        console.log(' - Transport:', pillTransportText);
        console.log(' - Gemini AI:', pillGeminiText);

        // Tab 2: OAuth 2.0 with Integrated Gemini AI
        console.log('3. Testing OAuth 2.0 Tab with Integrated Gemini AI...');
        await page.click('#btnTabOAuth');
        await new Promise(r => setTimeout(r, 500));
        const oauthGeminiBadge = await page.$eval('#oauthGeminiStatusBadge', el => el.textContent.trim());
        const oauthGeminiKey = await page.$eval('#oauthGeminiKeyMasked', el => el.textContent.trim());
        console.log(' - OAuth Tab Gemini Badge:', oauthGeminiBadge);
        console.log(' - OAuth Tab Gemini Key:', oauthGeminiKey);
        await page.screenshot({ path: path.join(__dirname, 'gemini_integrated_oauth_verified.png') });

        // Tab 3: App Password with Integrated Gemini AI
        console.log('4. Testing App Password Tab with Integrated Gemini AI...');
        await page.click('#btnTabAppPassword');
        await new Promise(r => setTimeout(r, 500));
        const appPwGeminiBadge = await page.$eval('#appPwGeminiStatusBadge', el => el.textContent.trim());
        const appPwGeminiKey = await page.$eval('#appPwGeminiKeyMasked', el => el.textContent.trim());
        console.log(' - App PW Tab Gemini Badge:', appPwGeminiBadge);
        console.log(' - App PW Tab Gemini Key:', appPwGeminiKey);
        await page.screenshot({ path: path.join(__dirname, 'gemini_integrated_apppw_verified.png') });

        // Tab 4: Gemini AI Management Tab with Dual Protocol Diagram
        console.log('5. Testing Gemini AI Tab with Architecture Diagram...');
        await page.click('#btnTabGemini');
        await new Promise(r => setTimeout(r, 500));
        await page.screenshot({ path: path.join(__dirname, 'gemini_integrated_diagram_verified.png') });

        console.log('🎉 Verification SUCCESSFUL! All 3 screenshots saved.');
    } catch (err) {
        console.error('❌ Verification failed:', err);
        process.exitCode = 1;
    } finally {
        await browser.close();
    }
})();
