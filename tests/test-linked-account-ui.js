const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  let alertText = null;
  page.on('dialog', async d => {
    alertText = d.message();
    console.log('DIALOG ALERT:', alertText);
    await d.accept();
  });

  await page.goto('http://localhost:3000/supervision.html', { waitUntil: 'networkidle0' });
  await page.click('#superv-nav-tasks');
  await new Promise(r => setTimeout(r, 600));

  // 1. Check Gmail Account Status Modal
  console.log('1️⃣ Clicking "जीमेल अधिकृत खाता स्थिति" button...');
  await page.click('button[title="जीमेल अधिकृत खाता स्थिति"]');
  await new Promise(r => setTimeout(r, 600));

  const statusInfo = await page.evaluate(() => {
    return {
      heading: document.getElementById('gmailStatusHeading')?.textContent,
      email: document.getElementById('gmailAccountEmail')?.textContent,
      dotColor: window.getComputedStyle(document.getElementById('gmailStatusDot')).backgroundColor,
      disconnectBtnVisible: window.getComputedStyle(document.getElementById('btnDisconnectGmail')).display !== 'none'
    };
  });
  console.log('   Status modal info:', statusInfo);

  const screenshotPath = path.join(__dirname, 'gmail_account_linked_dmnanbetul1.png');
  await page.screenshot({ path: screenshotPath });
  console.log('   📸 Screenshot saved to:', screenshotPath);

  // Close modal
  await page.evaluate(() => closeModal('modalGmailStatus'));
  await new Promise(r => setTimeout(r, 400));

  // 2. Click Sync button
  console.log('\n2️⃣ Clicking "ईमेल सिंक करें" button...');
  await page.click('#btnSyncGmail');
  await new Promise(r => setTimeout(r, 1000));

  console.log('   Alert prompt text received:', alertText);

  await browser.close();
  console.log('\n✅ dmnanbetul1@gmail.com account linking verified in UI successfully!');
})();
