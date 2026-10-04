/**
 * Automated UI Test: Orders & Tasks (आदेश एवं कार्य) Subsystem in Supervision Portal
 * Verifies navigation, metric cards, table rendering, filters, modals, and Gmail deep-links.
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function testSupervisionTasksUI() {
  console.log('📬 Starting Orders & Tasks (आदेश एवं कार्य) UI Automated Test Suite...\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  try {
    // 1. Navigate to Supervision Portal
    console.log('1️⃣ Navigating to http://localhost:3000/supervision.html...');
    await page.goto('http://localhost:3000/supervision.html', { waitUntil: 'networkidle0' });

    // 2. Click Orders & Tasks Tab in Sidebar
    console.log('2️⃣ Clicking "आदेश एवं कार्य (Orders & Tasks)" in sidebar...');
    await page.click('#superv-nav-tasks');
    await new Promise(r => setTimeout(r, 600));

    // Verify #view-tasks is active and visible
    const isTasksViewVisible = await page.evaluate(() => {
      const el = document.getElementById('view-tasks');
      if (!el) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && el.classList.contains('active');
    });

    if (!isTasksViewVisible) {
      throw new Error('#view-tasks is not visible or active after clicking navigation tab!');
    }
    console.log('   ✅ #view-tasks is active and visible (display: block).');

    // 3. Verify Metric Counters
    console.log('\n3️⃣ Verifying KPI Metric Counters...');
    const stats = await page.evaluate(() => {
      return {
        total: document.getElementById('taskStatTotal')?.textContent?.trim(),
        overdue: document.getElementById('taskStatOverdue')?.textContent?.trim(),
        dueToday: document.getElementById('taskStatDueToday')?.textContent?.trim(),
        due3Days: document.getElementById('taskStatDue3Days')?.textContent?.trim(),
        requiresConfirm: document.getElementById('taskStatRequiresConfirm')?.textContent?.trim(),
        completed: document.getElementById('taskStatCompleted')?.textContent?.trim()
      };
    });

    console.log(`   • Total Orders: ${stats.total}`);
    console.log(`   • Overdue: ${stats.overdue}`);
    console.log(`   • Due Today: ${stats.dueToday}`);
    console.log(`   • Due 3 Days: ${stats.due3Days}`);
    console.log(`   • Requires Confirmation: ${stats.requiresConfirm}`);
    console.log(`   • Completed: ${stats.completed}`);

    if (parseInt(stats.total, 10) < 3) {
      throw new Error(`Expected at least 3 tasks, found ${stats.total}`);
    }
    console.log('   ✅ Metric counters verified.');

    // 4. Verify Task Rows in Table
    console.log('\n4️⃣ Verifying Task Table Rows...');
    const rows = await page.evaluate(() => {
      const trs = document.querySelectorAll('#supervisionTasksTableBody tr');
      return Array.from(trs).map(tr => {
        const text = tr.innerText;
        return text;
      });
    });

    console.log(`   Found ${rows.length} rows in tasks table.`);
    if (rows.length < 3) {
      throw new Error(`Expected at least 3 rows in tasks table, found ${rows.length}`);
    }
    console.log('   ✅ Tasks table rendered with accurate rows.');

    // Screenshot of Tasks Matrix View
    const screenshotPath1 = path.join(__dirname, 'supervision_tasks_view.png');
    await page.screenshot({ path: screenshotPath1, fullPage: false });
    console.log(`   📸 Tasks matrix screenshot saved: ${screenshotPath1}`);

    // 5. Test Department Filter: Collectorate (TL)
    console.log('\n5️⃣ Testing Department Filter: Collectorate (TL)...');
    await page.click('#btnFilterDeptDist');
    await new Promise(r => setTimeout(r, 500));

    const distRowCount = await page.evaluate(() => {
      return document.querySelectorAll('#supervisionTasksTableBody tr').length;
    });
    console.log(`   Filtered rows for Collectorate TL: ${distRowCount}`);
    if (distRowCount < 1) {
      throw new Error('Expected at least 1 row for Collectorate TL filter');
    }
    console.log('   ✅ Collectorate filter verified.');

    // Reset filter to All
    await page.click('#btnFilterDeptAll');
    await new Promise(r => setTimeout(r, 400));

    // 6. Test Task Detail Modal & Gmail Deep-Link
    console.log('\n6️⃣ Testing Task Detail Modal & Gmail Deep-Link...');
    // Click the first detail button
    const detailBtn = await page.$('#supervisionTasksTableBody tr button[title="विस्तार से देखें"]');
    if (!detailBtn) {
      throw new Error('Could not find detail button in task table row');
    }
    await detailBtn.click();
    await new Promise(r => setTimeout(r, 500));

    const modalData = await page.evaluate(() => {
      const modal = document.getElementById('modalTaskDetail');
      const isVisible = modal && window.getComputedStyle(modal).display !== 'none';
      const title = document.getElementById('taskDetailTitle')?.textContent;
      const linkEl = document.querySelector('#taskDetailEmailLinkContainer a');
      const linkHref = linkEl ? linkEl.getAttribute('href') : null;
      return { isVisible, title, linkHref };
    });

    console.log(`   • Modal Visible: ${modalData.isVisible}`);
    console.log(`   • Task ID: ${modalData.title}`);
    console.log(`   • Gmail Deep-Link: ${modalData.linkHref}`);

    if (!modalData.isVisible) {
      throw new Error('Task detail modal did not open!');
    }
    if (!modalData.linkHref || !modalData.linkHref.includes('mail.google.com')) {
      throw new Error('Gmail deep-link is missing or does not point to mail.google.com');
    }
    console.log('   ✅ Task detail modal and permanent Gmail deep-link verified.');

    const screenshotPath2 = path.join(__dirname, 'supervision_task_detail_modal.png');
    await page.screenshot({ path: screenshotPath2, fullPage: false });
    console.log(`   📸 Task detail modal screenshot saved: ${screenshotPath2}`);

    // Close detail modal
    await page.evaluate(() => closeModal('modalTaskDetail'));
    await new Promise(r => setTimeout(r, 300));

    // 7. Test Gmail Account Configuration Modal
    console.log('\n7️⃣ Testing Gmail Account Configuration Modal...');
    await page.click('button[title="जीमेल अधिकृत खाता स्थिति"]');
    await new Promise(r => setTimeout(r, 500));

    const gmailModalVisible = await page.evaluate(() => {
      const modal = document.getElementById('modalGmailStatus');
      return modal && window.getComputedStyle(modal).display !== 'none';
    });

    if (!gmailModalVisible) {
      throw new Error('Gmail status modal did not open!');
    }
    console.log('   ✅ Gmail status modal opened cleanly.');

    const screenshotPath3 = path.join(__dirname, 'supervision_gmail_status_modal.png');
    await page.screenshot({ path: screenshotPath3, fullPage: false });
    console.log(`   📸 Gmail status modal screenshot saved: ${screenshotPath3}`);

    await page.evaluate(() => closeModal('modalGmailStatus'));

    console.log('\n🎉 ALL ORDERS & TASKS UI TESTS PASSED SUCCESSFULLY! (100% SUCCESS)\n');
  } finally {
    await browser.close();
  }
}

testSupervisionTasksUI().catch(err => {
  console.error('\n❌ TEST RUNNER FAILED:', err);
  process.exit(1);
});
