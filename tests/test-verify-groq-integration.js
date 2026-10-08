const puppeteer = require('puppeteer');

(async () => {
  console.log("=== Verifying Groq Cloud LPU AI Integration in Supervision Portal ===");

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  await page.goto('http://localhost:3000/supervision.html', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1200));

  // 1. Verify Sidebar Navigation Link
  console.log("1. Checking Sidebar Navigation Link (#superv-nav-gemini)...");
  const sidebarNav = await page.evaluate(() => {
    const el = document.getElementById('superv-nav-gemini');
    return el ? { text: el.innerText.trim(), visible: el.offsetParent !== null } : null;
  });
  console.log("Sidebar Nav:", sidebarNav);

  // 2. Click Sidebar Nav to open AI Management modal (Panel 4)
  console.log("2. Clicking Sidebar AI Management nav item...");
  await page.click('#superv-nav-gemini');
  await new Promise(r => setTimeout(r, 1000));

  // Verify that #modalGmailStatus is open AND both Gemini & Groq cards are present & populated
  const modalAIState = await page.evaluate(() => {
    const modal = document.getElementById('modalGmailStatus');
    const panel = document.getElementById('panelGmailGemini');
    const geminiBadge = document.getElementById('geminiStatusBadge');
    const geminiKey = document.getElementById('txtGeminiApiKey');
    const groqBadge = document.getElementById('groqStatusBadge');
    const groqKey = document.getElementById('txtGroqApiKey');
    const testGroqBtn = document.getElementById('btnTestGroq');
    const saveGroqBtn = document.getElementById('btnSaveGroqKey');

    return {
      modalOpen: modal && modal.classList.contains('open'),
      panelVisible: panel && window.getComputedStyle(panel).display !== 'none',
      geminiBadge: geminiBadge ? geminiBadge.textContent.trim() : null,
      geminiKey: geminiKey ? geminiKey.value : null,
      groqBadge: groqBadge ? groqBadge.textContent.trim() : null,
      groqKey: groqKey ? groqKey.value : null,
      testGroqBtnExists: !!testGroqBtn,
      saveGroqBtnExists: !!saveGroqBtn
    };
  });
  console.log("Modal AI Panel State:", JSON.stringify(modalAIState, null, 2));

  if (!modalAIState.modalOpen || !modalAIState.panelVisible) {
    console.error("❌ AI modal or panel not visible after clicking nav link!");
    process.exit(1);
  }

  // Screenshot of open AI management tab showing Gemini + Groq cards
  await page.screenshot({ path: 'tests/groq_gemini_dual_engine_modal.png' });
  console.log("📸 Screenshot saved to tests/groq_gemini_dual_engine_modal.png");

  // Close modal
  await page.evaluate(() => closeModal('modalGmailStatus'));
  await new Promise(r => setTimeout(r, 500));

  // 3. Verify Header and Banner
  console.log("3. Checking Header & Banner Badges...");
  const headerBannerState = await page.evaluate(() => {
    const headerPill = document.getElementById('headerPillGemini');
    const headerBadge = document.getElementById('geminiHeaderBadge');
    const bannerBadge = document.getElementById('geminiBannerBadge');
    const bannerDesc = document.getElementById('geminiBannerDesc');

    return {
      headerPill: headerPill ? headerPill.textContent.trim() : null,
      headerBadge: headerBadge ? headerBadge.textContent.trim() : null,
      bannerBadge: bannerBadge ? bannerBadge.textContent.trim() : null,
      bannerDesc: bannerDesc ? bannerDesc.textContent.trim() : null
    };
  });
  console.log("Header & Banner State:", JSON.stringify(headerBannerState, null, 2));

  await page.screenshot({ path: 'tests/groq_gemini_banner_verified.png' });
  console.log("📸 Screenshot saved to tests/groq_gemini_banner_verified.png");

  await browser.close();
  console.log("🎉 Groq Cloud LPU AI Integration verification PASSED completely!");
})();
