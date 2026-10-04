const puppeteer = require('puppeteer');

(async () => {
  console.log("=== Testing Milling & Procurement Section Feature ===");

  // 1. Test Backend API: Create test tasks in Milling and Procurement
  console.log("1. Creating test tasks for Milling and Procurement...");
  const millingTaskPayload = {
    letter_ref_no: 'मुख्या/मिलिंग/2026/891',
    letter_date: '2026-10-04',
    issuing_authority: 'प्रबंध संचालक, म.प्र. स्टेट सिविल सप्लाईज कार्पोरेशन, भोपाल',
    department_category: 'HO',
    subject: 'खरीफ विपणन वर्ष 2026-27 अंतर्गत कस्टम मिलिंग अनुबंध एवं CMR चावल जमा बाबत',
    task_description: 'जिले के समस्त पंजीकृत राइस मिलरों से मिलिंग अनुबंध निष्पादित कर समय-सीमा में फोर्टिफाइड चावल (CMR) नागरिक आपूर्ति निगम के वेयरहाउसों में जमा कराना सुनिश्चित करें।',
    assigned_section: 'Milling',
    responsible_person: 'मिलिंग प्रभारी / डीएम बैतूल',
    priority: 'HIGH',
    due_date: new Date('2026-10-25T18:00:00Z').toISOString(),
    deadline_type: 'OFFICIAL_EXPLICIT',
    status: 'NEW'
  };

  const procTaskPayload = {
    letter_ref_no: 'मुख्या/उपार्जन/2026/142',
    letter_date: '2026-10-04',
    issuing_authority: 'कलेक्टर एवं जिला दण्डाधिकारी, जिला बैतूल',
    department_category: 'DISTRICT_ADMIN',
    subject: 'समर्थन मूल्य (MSP) धान उपार्जन केंद्र तैयारी एवं बारदाना सत्यापन बाबत',
    task_description: 'जिले के 42 उपार्जन केंद्रों पर बारदाना, तौल कांटे, नमी मापक यंत्र एवं किसान छाया-पानी व्यवस्था का भौतिक सत्यापन कर रिपोर्ट प्रस्तुत करें।',
    assigned_section: 'Procurement',
    responsible_person: 'उपार्जन प्रभारी बैतूल',
    priority: 'CRITICAL',
    due_date: new Date('2026-10-15T18:00:00Z').toISOString(),
    deadline_type: 'OFFICIAL_EXPLICIT',
    status: 'NEW'
  };

  const res1 = await fetch('http://localhost:3000/api/supervision/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(millingTaskPayload)
  });
  const data1 = await res1.json();
  console.log("Milling Task created:", data1.taskId);

  const res2 = await fetch('http://localhost:3000/api/supervision/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(procTaskPayload)
  });
  const data2 = await res2.json();
  console.log("Procurement Task created:", data2.taskId);

  // 2. Test Section Filtering in Backend API
  console.log("\n2. Testing /api/supervision/tasks?section=Milling...");
  const fResMilling = await fetch('http://localhost:3000/api/supervision/tasks?section=Milling');
  const fDataMilling = await fResMilling.json();
  const foundMilling = fDataMilling.tasks.some(t => t.id === data1.taskId && t.assigned_section === 'Milling');
  console.log(`Milling filter match: ${foundMilling} (Total found: ${fDataMilling.tasks.length})`);

  console.log("Testing /api/supervision/tasks?section=Procurement...");
  const fResProc = await fetch('http://localhost:3000/api/supervision/tasks?section=Procurement');
  const fDataProc = await fResProc.json();
  const foundProc = fDataProc.tasks.some(t => t.id === data2.taskId && t.assigned_section === 'Procurement');
  console.log(`Procurement filter match: ${foundProc} (Total found: ${fDataProc.tasks.length})`);

  if (!foundMilling || !foundProc) {
    console.error("❌ Failed API section filter verification!");
    process.exit(1);
  }

  // 3. Test Front-End in Headless Browser
  console.log("\n3. Testing Front-End UI with Puppeteer...");
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  await page.goto('http://localhost:3000/supervision.html', { waitUntil: 'networkidle2' });

  // Navigate to Tasks tab
  await page.evaluate(() => {
    switchSupervTab('tasks');
  });
  await new Promise(r => setTimeout(r, 1000));

  // Check section filter dropdown presence and options
  const filterOptions = await page.evaluate(() => {
    const sel = document.getElementById('taskSectionFilter');
    if (!sel) return null;
    return Array.from(sel.options).map(o => ({ value: o.value, text: o.text }));
  });
  console.log("Section Filter Options in UI:", filterOptions);

  // Check Task Form modal dropdown options
  const modalOptions = await page.evaluate(() => {
    const sel = document.getElementById('taskFormSection');
    if (!sel) return null;
    return Array.from(sel.options).map(o => ({ value: o.value, text: o.text }));
  });
  console.log("Modal Task Form Section Options:", modalOptions);

  // Filter UI by 'Milling'
  await page.select('#taskSectionFilter', 'Milling');
  await new Promise(r => setTimeout(r, 1000));

  // Capture screenshot of filtered view
  await page.screenshot({ path: 'tests/sections_milling_procurement_verified.png' });
  console.log("📸 Screenshot saved to tests/sections_milling_procurement_verified.png");

  // Cleanup test tasks
  console.log("\n4. Cleaning up test tasks...");
  await fetch(`http://localhost:3000/api/supervision/tasks/${data1.taskId}`, { method: 'DELETE' });
  await fetch(`http://localhost:3000/api/supervision/tasks/${data2.taskId}`, { method: 'DELETE' });
  console.log("Cleanup complete.");

  await browser.close();
  console.log("🎉 All Milling & Procurement section tests PASSED successfully!");
})();
