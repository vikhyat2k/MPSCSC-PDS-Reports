const puppeteer = require('puppeteer');
const path = require('path');

async function testModalPreview() {
    console.log('🌐 Launching browser to test Advanced Analytics Preview Modal...');
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    console.log('Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

    console.log('Opening Advanced Analytics modal for report 572...');
    await page.evaluate(() => {
        if (typeof showAdvancedAnalyticsModal === 'function') {
            showAdvancedAnalyticsModal(572);
        } else {
            console.error('showAdvancedAnalyticsModal not found!');
        }
    });

    // Wait for iframe to load and fit zoom to apply
    await new Promise(r => setTimeout(r, 2000));

    const modalFitPath = path.join(__dirname, 'modal_preview_fit.png');
    await page.screenshot({ path: modalFitPath });
    console.log('📸 Saved fit-width modal screenshot to:', modalFitPath);

    // Now test switching to 100% view
    console.log('Clicking 100% view...');
    await page.evaluate(() => {
        if (typeof setAdvPreviewZoom === 'function') {
            setAdvPreviewZoom('100');
        }
    });
    await new Promise(r => setTimeout(r, 800));

    const modal100Path = path.join(__dirname, 'modal_preview_100.png');
    await page.screenshot({ path: modal100Path });
    console.log('📸 Saved 100% view modal screenshot to:', modal100Path);

    await browser.close();
    console.log('🎉 Modal Preview Test Complete!');
}

testModalPreview().catch(err => console.error('Error testing modal:', err));
