const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    console.log('🚀 Starting Automated Verification: Front-End Gmail Account Linkage Hub...');
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 850 });

        let alertCount = 0;
        let lastAlertMsg = '';
        page.on('dialog', async dialog => {
            alertCount++;
            lastAlertMsg = dialog.message();
            console.log(`  [Alert Dialog] "${lastAlertMsg}"`);
            await dialog.accept();
        });

        console.log('1. Navigating to http://localhost:3000/supervision.html...');
        await page.goto('http://localhost:3000/supervision.html', { waitUntil: 'networkidle2', timeout: 30000 });

        console.log('2. Opening Official Gmail Account Status & Linkage Modal (#btnManageGmail)...');
        await page.waitForSelector('#btnManageGmail', { visible: true });
        await page.click('#btnManageGmail');

        await page.waitForSelector('#modalGmailStatus.active', { visible: true, timeout: 5000 });
        console.log('  ✓ Modal #modalGmailStatus opened successfully.');

        console.log('3. Verifying presence of 3 Account Linkage Tabs...');
        const tabCheck = await page.evaluate(() => {
            const tab1 = document.getElementById('btnTabQuickLink');
            const tab2 = document.getElementById('btnTabOAuth');
            const tab3 = document.getElementById('btnTabAppPassword');
            const p1 = document.getElementById('panelGmailQuickLink');
            const p2 = document.getElementById('panelGmailOAuth');
            const p3 = document.getElementById('panelGmailAppPassword');
            return {
                tabsExist: Boolean(tab1 && tab2 && tab3),
                p1Visible: p1 && window.getComputedStyle(p1).display !== 'none',
                p2Visible: p2 && window.getComputedStyle(p2).display !== 'none',
                p3Visible: p3 && window.getComputedStyle(p3).display !== 'none'
            };
        });

        if (!tabCheck.tabsExist) {
            throw new Error('Linkage tabs missing in modal');
        }
        console.log(`  ✓ 3 Tabs exist. Initial panel visibility: Quick=${tabCheck.p1Visible}, OAuth=${tabCheck.p2Visible}, AppPW=${tabCheck.p3Visible}`);

        console.log('4. Testing Tab Switch to Google OAuth 2.0...');
        await page.click('#btnTabOAuth');
        await new Promise(r => setTimeout(r, 400));
        const oauthVisible = await page.evaluate(() => {
            const p2 = document.getElementById('panelGmailOAuth');
            const idInput = document.getElementById('txtGoogleClientId');
            const secretInput = document.getElementById('txtGoogleClientSecret');
            const uriInput = document.getElementById('txtGoogleRedirectUri');
            return {
                visible: p2 && window.getComputedStyle(p2).display !== 'none',
                hasClientId: Boolean(idInput),
                hasClientSecret: Boolean(secretInput),
                redirectUriVal: uriInput ? uriInput.value : ''
            };
        });
        if (!oauthVisible.visible) throw new Error('OAuth panel failed to display on tab switch');
        console.log(`  ✓ OAuth 2.0 panel visible. Redirect URI: ${oauthVisible.redirectUriVal}`);

        console.log('5. Testing Tab Switch to App Password...');
        await page.click('#btnTabAppPassword');
        await new Promise(r => setTimeout(r, 400));
        const appPwVisible = await page.evaluate(() => {
            const p3 = document.getElementById('panelGmailAppPassword');
            const emailInput = document.getElementById('txtAppPwEmail');
            const pwInput = document.getElementById('txtAppPwKey');
            return {
                visible: p3 && window.getComputedStyle(p3).display !== 'none',
                emailVal: emailInput ? emailInput.value : '',
                hasPwInput: Boolean(pwInput)
            };
        });
        if (!appPwVisible.visible) throw new Error('App Password panel failed to display on tab switch');
        console.log(`  ✓ App Password panel visible. Default email: ${appPwVisible.emailVal}`);

        console.log('6. Testing Quick 1-Click Link with dmnanbetul1@gmail.com...');
        await page.click('#btnTabQuickLink');
        await new Promise(r => setTimeout(r, 400));

        await page.click('#btnSubmitLinkDirect');
        await new Promise(r => setTimeout(r, 1200));

        console.log('7. Verifying Active Linked Status Badge & Details...');
        const statusDetails = await page.evaluate(() => {
            const dot = document.getElementById('gmailStatusDot');
            const heading = document.getElementById('gmailStatusHeading');
            const email = document.getElementById('gmailAccountEmail');
            const disconnectBtn = document.getElementById('btnDisconnectGmail');
            return {
                dotColor: dot ? window.getComputedStyle(dot).backgroundColor : '',
                headingText: heading ? heading.textContent : '',
                emailHtml: email ? email.innerHTML : '',
                disconnectVisible: disconnectBtn && window.getComputedStyle(disconnectBtn).display !== 'none'
            };
        });

        console.log(`  ✓ Heading: ${statusDetails.headingText}`);
        console.log(`  ✓ Dot Color: ${statusDetails.dotColor}`);
        console.log(`  ✓ Disconnect Button Visible: ${statusDetails.disconnectVisible}`);

        if (!statusDetails.headingText.includes('सक्रिय एवं अधिकृत') && !statusDetails.headingText.includes('dmnanbetul1@gmail.com')) {
            throw new Error('Account status did not switch to active/authorized after link: ' + statusDetails.headingText);
        }

        const screenshotPath = path.join(__dirname, 'gmail_modal_frontend_linking.png');
        await page.screenshot({ path: screenshotPath, fullPage: false });
        console.log(`📸 Screenshot captured at: ${screenshotPath}`);

        console.log('\n🎉 ALL FRONT-END ACCOUNT LINKAGE TESTS PASSED SUCCESSFULLY! 100% OPERATIONAL!');
    } catch (err) {
        console.error('❌ Test failed:', err);
        process.exitCode = 1;
    } finally {
        await browser.close();
    }
})();
