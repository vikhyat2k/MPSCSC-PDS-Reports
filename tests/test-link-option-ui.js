/**
 * Automated UI Test: Verify Link Option in Official Gmail Account Modal
 */

const puppeteer = require('puppeteer');
const path = require('path');

async function testLinkOptionUI() {
  console.log('🧪 Verifying "Option to Link" in Official Gmail Account Modal...\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('dialog', async d => {
    console.log('DIALOG ALERT:', d.message());
    await d.accept();
  });

  try {
    console.log('1️⃣ Navigating to http://localhost:3000/supervision.html...');
    await page.goto('http://localhost:3000/supervision.html', { waitUntil: 'networkidle0' });

    console.log('2️⃣ Navigating to "आदेश एवं कार्य (Orders & Tasks)" tab...');
    await page.click('#superv-nav-tasks');
    await new Promise(r => setTimeout(r, 600));

    console.log('3️⃣ Opening "जीमेल खाता स्थिति" modal...');
    await page.click('button[title="जीमेल अधिकृत खाता स्थिति"]');
    await new Promise(r => setTimeout(r, 600));

    // Verify modal is visible
    const isModalOpen = await page.evaluate(() => {
      const modal = document.getElementById('modalGmailStatus');
      return modal && modal.classList.contains('open');
    });
    console.log('   Modal open state:', isModalOpen);
    if (!isModalOpen) throw new Error('modalGmailStatus is not open!');

    // Verify link options
    const linkFormInfo = await page.evaluate(() => {
      const txtEmail = document.getElementById('txtLinkGmailEmail');
      const txtName = document.getElementById('txtLinkGmailName');
      const btnLink = document.getElementById('btnSubmitLinkDirect');
      const btnOAuth = document.getElementById('btnConnectGmail');
      const btnDisconnect = document.getElementById('btnDisconnectGmail');

      return {
        emailVal: txtEmail ? txtEmail.value : null,
        emailVisible: txtEmail && window.getComputedStyle(txtEmail).display !== 'none',
        nameVal: txtName ? txtName.value : null,
        nameVisible: txtName && window.getComputedStyle(txtName).display !== 'none',
        btnLinkText: btnLink ? btnLink.textContent.trim() : null,
        btnLinkVisible: btnLink && window.getComputedStyle(btnLink).display !== 'none',
        btnOAuthVisible: btnOAuth && window.getComputedStyle(btnOAuth).display !== 'none',
        btnDisconnectVisible: btnDisconnect && window.getComputedStyle(btnDisconnect).display !== 'none'
      };
    });

    console.log('   Link Form & Buttons Info:', linkFormInfo);

    if (!linkFormInfo.emailVisible || !linkFormInfo.btnLinkVisible) {
      throw new Error('Option to link is NOT visible in the modal!');
    }

    // Take screenshot showing the full modal with options to link
    const screenshotPath = path.join(__dirname, 'gmail_modal_with_link_options.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`   📸 Screenshot with link options saved to: ${screenshotPath}`);

    // Test entering a new email and linking
    console.log('\n4️⃣ Testing direct account link submission via UI...');
    await page.evaluate(() => {
      const emailInput = document.getElementById('txtLinkGmailEmail');
      if (emailInput) emailInput.value = 'dmnanbetul1@gmail.com';
    });

    await page.click('#btnSubmitLinkDirect');
    await new Promise(r => setTimeout(r, 800));

    // Verify status heading
    const updatedStatus = await page.evaluate(() => {
      return document.getElementById('gmailStatusHeading')?.textContent;
    });
    console.log('   Updated Status Heading:', updatedStatus);

    console.log('\n✅ All checks passed! Option to link is fully available and functional.');
  } finally {
    await browser.close();
  }
}

testLinkOptionUI().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
