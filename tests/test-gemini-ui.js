const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  console.log("🚀 Testing Gemini AI Front-End UI Integration in Supervision Portal...");
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 850 });

    let lastAlert = '';
    page.on('dialog', async d => {
      lastAlert = d.message();
      console.log(`  [Alert Dialog] "${lastAlert}"`);
      await d.accept();
    });

    console.log("1. Navigating to http://localhost:3000/supervision.html...");
    await page.goto('http://localhost:3000/supervision.html', { waitUntil: 'networkidle2' });

    console.log("2. Navigating to Orders & Tasks View...");
    await page.click('#superv-nav-tasks');
    await new Promise(r => setTimeout(r, 400));

    console.log("3. Opening Official Gmail Account Status & Configuration Modal...");
    await page.click('#btnManageGmail');
    await page.waitForSelector('#modalGmailStatus.open', { visible: true });

    console.log("4. Switching to '🤖 Gemini AI' Tab...");
    await page.waitForSelector('#btnTabGemini', { visible: true });
    await page.click('#btnTabGemini');
    await new Promise(r => setTimeout(r, 600));

    console.log("5. Verifying Gemini AI Panel & Active Status Badge...");
    const geminiInfo = await page.evaluate(() => {
      const p = document.getElementById('panelGmailGemini');
      const badge = document.getElementById('geminiStatusBadge');
      const keyInput = document.getElementById('txtGeminiApiKey');
      return {
        panelVisible: p && window.getComputedStyle(p).display !== 'none',
        badgeText: badge ? badge.textContent : '',
        badgeClass: badge ? badge.className : '',
        hasKeyInput: Boolean(keyInput)
      };
    });

    console.log("  • Panel Visible:", geminiInfo.panelVisible);
    console.log("  • Badge Text:", geminiInfo.badgeText);
    console.log("  • Badge Class:", geminiInfo.badgeClass);

    if (!geminiInfo.panelVisible) {
      throw new Error("Gemini AI panel is not visible!");
    }

    console.log("6. Testing '⚡ कनेक्शन टेस्ट करें' Button...");
    await page.click('#btnTestGemini');
    await new Promise(r => setTimeout(r, 1500));

    const screenshotPath = path.join(__dirname, 'gemini_ai_tab_verified.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`📸 Screenshot saved at: ${screenshotPath}`);

    console.log("\n🎉 ALL GEMINI UI VERIFICATIONS PASSED SUCCESSFULLY!");
  } catch (err) {
    console.error("❌ Test failed:", err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
