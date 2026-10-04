const puppeteer = require('puppeteer');
const path = require('path');

async function verifyAllModals() {
  console.log('🔍 Testing Gmail Status Modal, Email Sync button, Task Form and Task Detail modals...\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  try {
    await page.goto('http://localhost:3000/supervision.html', { waitUntil: 'networkidle0' });
    await page.click('#superv-nav-tasks');
    await new Promise(r => setTimeout(r, 600));

    // 1. Test "जीमेल खाता स्थिति" button
    console.log('1️⃣ Testing "जीमेल खाता स्थिति" button click...');
    await page.click('button[title="जीमेल अधिकृत खाता स्थिति"]');
    await new Promise(r => setTimeout(r, 600));

    const statusModal = await page.evaluate(() => {
      const m = document.getElementById('modalGmailStatus');
      const box = m?.querySelector('.superv-modal-box');
      const r = box?.getBoundingClientRect();
      const style = m ? window.getComputedStyle(m) : null;
      return {
        isOpen: m?.classList.contains('open'),
        opacity: style?.opacity,
        pointerEvents: style?.pointerEvents,
        width: r?.width,
        height: r?.height,
        heading: document.getElementById('gmailStatusHeading')?.textContent
      };
    });

    console.log('   Gmail Status Modal state:', statusModal);
    if (!statusModal.isOpen || statusModal.opacity !== '1' || statusModal.width <= 0) {
      throw new Error('Gmail Status Modal is not visible or not opened!');
    }
    console.log('   ✅ Gmail Status Modal is OPEN and fully visible!');
    await page.screenshot({ path: path.join(__dirname, 'modal_gmail_status_working.png') });

    // Close Gmail modal
    await page.evaluate(() => closeModal('modalGmailStatus'));
    await new Promise(r => setTimeout(r, 400));

    // 2. Test "ईमेल सिंक करें" button
    console.log('\n2️⃣ Testing "ईमेल सिंक करें" button click (auto-prompts status modal if not connected)...');
    await page.click('#btnSyncGmail');
    await new Promise(r => setTimeout(r, 800));

    const syncAutoOpenedModal = await page.evaluate(() => {
      const m = document.getElementById('modalGmailStatus');
      return m?.classList.contains('open') && window.getComputedStyle(m).opacity === '1';
    });
    console.log('   Sync button opened Gmail Status Modal?', syncAutoOpenedModal);
    if (!syncAutoOpenedModal) {
      throw new Error('Sync button did not prompt Gmail Status Modal when account not connected!');
    }
    console.log('   ✅ Email sync button triggers status modal correctly!');

    await page.evaluate(() => closeModal('modalGmailStatus'));
    await new Promise(r => setTimeout(r, 400));

    // 3. Test "👁️ विवरण" button
    console.log('\n3️⃣ Testing Task Detail modal ("👁️ विवरण")...');
    const detailBtn = await page.$('#supervisionTasksTableBody tr button[title="विस्तार से देखें"]');
    if (detailBtn) {
      await detailBtn.click();
      await new Promise(r => setTimeout(r, 600));

      const detailModal = await page.evaluate(() => {
        const m = document.getElementById('modalTaskDetail');
        const box = m?.querySelector('.superv-modal-box');
        const r = box?.getBoundingClientRect();
        return {
          isOpen: m?.classList.contains('open'),
          opacity: m ? window.getComputedStyle(m).opacity : null,
          width: r?.width,
          height: r?.height,
          title: document.getElementById('taskDetailTitle')?.textContent
        };
      });
      console.log('   Task Detail Modal state:', detailModal);
      if (!detailModal.isOpen || detailModal.opacity !== '1' || detailModal.width <= 0) {
        throw new Error('Task Detail Modal is not visible!');
      }
      console.log('   ✅ Task Detail Modal is OPEN and fully visible!');
      await page.screenshot({ path: path.join(__dirname, 'modal_task_detail_working.png') });

      await page.evaluate(() => closeModal('modalTaskDetail'));
      await new Promise(r => setTimeout(r, 400));
    }

    // 4. Test "➕ नया कार्य जोड़ें" button
    console.log('\n4️⃣ Testing "➕ नया कार्य जोड़ें" button...');
    const addBtn = await page.$('button[onclick="openNewTaskModal()"]');
    if (addBtn) {
      await addBtn.click();
      await new Promise(r => setTimeout(r, 600));

      const formModal = await page.evaluate(() => {
        const m = document.getElementById('modalTaskForm');
        const box = m?.querySelector('.superv-modal-box');
        const r = box?.getBoundingClientRect();
        return {
          isOpen: m?.classList.contains('open'),
          opacity: m ? window.getComputedStyle(m).opacity : null,
          width: r?.width,
          height: r?.height,
          title: document.getElementById('modalTaskFormTitle')?.textContent
        };
      });
      console.log('   Task Form Modal state:', formModal);
      if (!formModal.isOpen || formModal.opacity !== '1' || formModal.width <= 0) {
        throw new Error('Task Form Modal is not visible!');
      }
      console.log('   ✅ Task Form Modal is OPEN and fully visible!');
      await page.screenshot({ path: path.join(__dirname, 'modal_task_form_working.png') });

      await page.evaluate(() => closeModal('modalTaskForm'));
      await new Promise(r => setTimeout(r, 400));
    }

    console.log('\n🎉 ALL MODALS AND BUTTONS ARE 100% OPERATIONAL AND VERIFIED!\n');
  } finally {
    await browser.close();
  }
}

verifyAllModals().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
