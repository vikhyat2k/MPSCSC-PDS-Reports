const puppeteer = require('puppeteer');

(async () => {
  console.log("=== Verifying 'AI Analysis of Mails' Buttons & Functionality ===");

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 950 });

  await page.goto('http://localhost:3000/supervision.html', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 800));

  // Switch to Orders & Tasks View (#view-tasks)
  console.log("Switching to Orders & Tasks view...");
  await page.evaluate(() => {
    const navTasks = document.getElementById('superv-nav-tasks');
    showSupervView('tasks', navTasks);
  });
  await new Promise(r => setTimeout(r, 600));

  // 1. Verify Header Button: #btnHeaderAiAnalysis
  console.log("1. Checking Header 'AI Analysis of Mails' Button...");
  const headerBtn = await page.evaluate(() => {
    const el = document.getElementById('btnHeaderAiAnalysis');
    return el ? { text: el.innerText.trim(), visible: el.offsetParent !== null } : null;
  });
  console.log("Header AI Button:", headerBtn);

  if (!headerBtn || !headerBtn.visible) {
    console.error("❌ #btnHeaderAiAnalysis not found or not visible!");
    process.exit(1);
  }

  // 2. Verify AI Status Banner Button: #btnBannerAiAnalysis
  console.log("2. Checking Banner 'AI Analysis of Mails' Button...");
  const bannerBtn = await page.evaluate(() => {
    const el = document.getElementById('btnBannerAiAnalysis');
    return el ? { text: el.innerText.trim(), visible: el.offsetParent !== null } : null;
  });
  console.log("Banner AI Button:", bannerBtn);

  if (!bannerBtn || !bannerBtn.visible) {
    console.error("❌ #btnBannerAiAnalysis not found or not visible!");
    process.exit(1);
  }

  // Capture screenshot of Header & Banner showing AI Analysis buttons
  await page.screenshot({ path: 'tests/ai_analysis_buttons_header_and_banner.png' });
  console.log("📸 Screenshot saved to tests/ai_analysis_buttons_header_and_banner.png");

  // 3. Open AI Management Modal to verify #btnModalTriggerAi in Panel 4
  console.log("3. Checking Modal Panel 4 'AI Analysis of Mails' Button...");
  await page.click('#btnHeaderGemini');
  await new Promise(r => setTimeout(r, 800));

  const modalBtn = await page.evaluate(() => {
    const el = document.getElementById('btnModalTriggerAi');
    return el ? { text: el.innerText.trim(), visible: el.offsetParent !== null } : null;
  });
  console.log("Modal Panel 4 AI Button:", modalBtn);

  if (!modalBtn || !modalBtn.visible) {
    console.error("❌ #btnModalTriggerAi not found or not visible in Panel 4!");
    process.exit(1);
  }

  await page.screenshot({ path: 'tests/ai_analysis_button_modal_panel4.png' });
  console.log("📸 Screenshot saved to tests/ai_analysis_button_modal_panel4.png");

  // Close modal
  await page.evaluate(() => closeModal('modalGmailStatus'));
  await new Promise(r => setTimeout(r, 400));

  // 4. Test API endpoint POST /api/gmail/analyze-ai
  console.log("4. Testing POST /api/gmail/analyze-ai endpoint directly...");
  const apiResult = await page.evaluate(async () => {
    const res = await fetch('/api/gmail/analyze-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force: false })
    });
    return await res.json();
  });
  console.log("POST /api/gmail/analyze-ai Result:", apiResult);

  if (!apiResult.success) {
    console.error("❌ /api/gmail/analyze-ai did not return success!");
    process.exit(1);
  }

  await browser.close();
  console.log("🎉 All 'AI Analysis of Mails' buttons & endpoints VERIFIED SUCCESSFULLY!");
})();
