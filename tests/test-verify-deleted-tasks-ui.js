/**
 * Automated UI Test: Verify Deletion of Dummy Data for Orders & Tasks
 */

const puppeteer = require('puppeteer');
const path = require('path');

async function testDeletedTasksUI() {
  console.log('🧪 Verifying Clean State of Orders & Tasks (आदेश एवं कार्य)...\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  try {
    console.log('1️⃣ Navigating to http://localhost:3000/supervision.html...');
    await page.goto('http://localhost:3000/supervision.html', { waitUntil: 'networkidle0' });

    console.log('2️⃣ Navigating to "आदेश एवं कार्य (Orders & Tasks)" tab...');
    await page.click('#superv-nav-tasks');
    await new Promise(r => setTimeout(r, 600));

    // Verify Metric Counters are 0
    console.log('3️⃣ Checking Metric Counters...');
    const stats = await page.evaluate(() => ({
      total: document.getElementById('taskStatTotal')?.textContent?.trim(),
      overdue: document.getElementById('taskStatOverdue')?.textContent?.trim(),
      dueToday: document.getElementById('taskStatDueToday')?.textContent?.trim(),
      due3Days: document.getElementById('taskStatDue3Days')?.textContent?.trim(),
      requiresConfirm: document.getElementById('taskStatRequiresConfirm')?.textContent?.trim(),
      completed: document.getElementById('taskStatCompleted')?.textContent?.trim()
    }));
    console.log('   Metrics:', stats);
    if (stats.total !== '0') {
      throw new Error(`Expected Total to be 0, found ${stats.total}`);
    }

    // Verify empty state message in table
    console.log('4️⃣ Checking Table Body Empty State...');
    const tableText = await page.evaluate(() => {
      const tbody = document.getElementById('supervisionTasksTableBody');
      return tbody ? tbody.innerText.trim() : '';
    });
    console.log('   Table Body Text:', tableText);
    if (!tableText.includes('कोई शासकीय आदेश या कार्य दर्ज नहीं है')) {
      throw new Error(`Empty state message missing in tasks table: ${tableText}`);
    }

    // Verify delete dummy button is present
    const hasDeleteDummyBtn = await page.evaluate(() => {
      const btn = document.getElementById('btnDeleteDummyTasks');
      return !!btn && btn.offsetParent !== null;
    });
    console.log('   "डमी डेटा हटाएं" button visible:', hasDeleteDummyBtn);
    if (!hasDeleteDummyBtn) {
      throw new Error('Button #btnDeleteDummyTasks is not visible!');
    }

    // Take screenshot
    const screenshotPath = path.join(__dirname, 'supervision_tasks_clean_empty.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`   📸 Screenshot saved to: ${screenshotPath}`);

    console.log('\n✅ All checks passed! Dummy data for Orders & Tasks successfully deleted.');
  } finally {
    await browser.close();
  }
}

testDeletedTasksUI().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
