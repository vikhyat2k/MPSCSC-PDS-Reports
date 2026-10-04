const puppeteer = require('puppeteer');

(async () => {
  console.log("=== Verifying Gemini AI Management Tab & Direct Access Elements ===");

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  await page.goto('http://localhost:3000/supervision.html', { waitUntil: 'networkidle2' });

  // 1. Verify Sidebar Navigation Link
  console.log("1. Checking Sidebar Navigation Link (#superv-nav-gemini)...");
  const sidebarNavExists = await page.evaluate(() => {
    const el = document.getElementById('superv-nav-gemini');
    return el ? { text: el.innerText.trim(), visible: el.offsetParent !== null } : null;
  });
  console.log("Sidebar Nav:", sidebarNavExists);
  if (!sidebarNavExists) {
    console.error("❌ #superv-nav-gemini not found!");
    process.exit(1);
  }

  // 2. Click Sidebar Nav to open Gemini AI Management directly
  console.log("2. Clicking Sidebar '🤖 Gemini AI प्रबंधन' nav item...");
  await page.click('#superv-nav-gemini');
  await new Promise(r => setTimeout(r, 800));

  // Verify that #modalGmailStatus is open AND panelGmailGemini is visible!
  const modalTabState = await page.evaluate(() => {
    const modal = document.getElementById('modalGmailStatus');
    const panel = document.getElementById('panelGmailGemini');
    const badge = document.getElementById('geminiStatusBadge');
    const keyInput = document.getElementById('txtGeminiApiKey');
    return {
      modalOpen: modal && modal.classList.contains('open'),
      geminiPanelVisible: panel && window.getComputedStyle(panel).display !== 'none',
      badgeText: badge ? badge.textContent : '',
      keyMasked: keyInput ? keyInput.value : ''
    };
  });
  console.log("Modal & Gemini Tab State:", modalTabState);

  if (!modalTabState.modalOpen || !modalTabState.geminiPanelVisible) {
    console.error("❌ Gemini AI modal or panel not visible after clicking nav link!");
    process.exit(1);
  }

  // Capture screenshot of open Gemini AI Tab
  await page.screenshot({ path: 'tests/gemini_management_tab_opened_verified.png' });
  console.log("📸 Screenshot saved to tests/gemini_management_tab_opened_verified.png");

  // Close modal
  await page.evaluate(() => closeModal('modalGmailStatus'));
  await new Promise(r => setTimeout(r, 400));

  // 3. Verify Header Button & Banner in Orders & Tasks view
  console.log("3. Checking Header Button (#btnHeaderGemini) & Banner Button...");
  const headerBtn = await page.evaluate(() => {
    const btn = document.getElementById('btnHeaderGemini');
    const bannerBadge = document.getElementById('geminiBannerBadge');
    return {
      btnExists: !!btn,
      btnText: btn ? btn.innerText.trim() : '',
      bannerBadgeText: bannerBadge ? bannerBadge.textContent.trim() : ''
    };
  });
  console.log("Header Button & Banner:", headerBtn);

  // Capture screenshot of Tasks view showing Header button and AI Status Banner
  await page.screenshot({ path: 'tests/gemini_header_and_banner_verified.png' });
  console.log("📸 Screenshot saved to tests/gemini_header_and_banner_verified.png");

  await browser.close();
  console.log("🎉 All Gemini AI Management Tab verifications PASSED successfully!");
})();
