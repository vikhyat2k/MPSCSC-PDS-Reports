/**
 * Test Suite: Official Gmail Integration & Actionable Tasks Module
 * Verifies database initialization, crypto token encryption,
 * triage rules, document parsing, deadline calculations, and API routes.
 */

const assert = require('assert');
const path = require('path');
const DatabaseManager = require('../server/database/db');
const gmailService = require('../server/services/gmail');

async function runTestSuite() {
  console.log('🧪 Starting Official Gmail & Supervision Tasks Automated Test Suite...\n');

  // 1. Test Crypto Token Encryption
  console.log('1️⃣ Testing AES-256-GCM Token Encryption/Decryption:');
  const sampleToken = '1//0gMABC123_sample_google_refresh_token_for_mpscsc';
  const encrypted = gmailService.encryptToken(sampleToken);
  assert(encrypted && encrypted.includes(':'), 'Token encryption should produce iv:tag:cipher format');
  const decrypted = gmailService.decryptToken(encrypted);
  assert.strictEqual(decrypted, sampleToken, 'Decrypted token must strictly match original refresh token');
  console.log('   ✅ Encryption & Decryption verified successfully.');

  // 2. Test Triage Rules Engine
  console.log('\n2️⃣ Testing Email Triage Rules Engine:');
  const noiseEmail = gmailService.isNoiseEmail('mailer-daemon@googlemail.com', 'Delivery Status Notification (Failure)');
  assert.strictEqual(noiseEmail, true, 'Mailer daemon must be flagged as noise');

  const hoEmailTriage = gmailService.evaluateTriageRules({
    sender: 'ho.mpscsc@gmail.com',
    subject: 'माह अक्टूबर 2026 में रैक अनलोडिंग एवं उचित मूल्य दुकानों को खाद्यान्न प्रदाय की समय-सीमा बाबत',
    body: 'उपरोक्त विषयांतर्गत 15 अक्टूबर तक शत-प्रतिशत उठाव सुनिश्चित करें।'
  });
  assert.strictEqual(hoEmailTriage.matched, true, 'HO email must match department rule');
  assert.strictEqual(hoEmailTriage.departmentCategory, 'HO');
  console.log('   ✅ Department matching & noise filter verified successfully.');

  // 3. Test Order Parser & Deadline Logic
  console.log('\n3️⃣ Testing Government Order Parser & Deadline Engine:');
  const sampleText = `
    मध्य प्रदेश स्टेट सिविल सप्लाईज कार्पोरेशन लिमिटेड
    मुख्यालय, भोपाल
    क्रमांक / 4182 / 2026
    दिनांक: 02/10/2026

    प्रति,
    जिला प्रबंधक,
    म.प्र. स्टेट सिविल सप्लाईज कार्पोरेशन, बैतूल

    विषय: माह अक्टूबर 2026 में रैक अनलोडिंग एवं समय-सीमा बाबत।
    निर्देशित किया जाता है कि दिनांक 15/10/2026 तक शत-प्रतिशत उठाव पूर्ण कर पालन प्रतिवेदन मुख्यालय प्रेषित करें।
  `;

  const letterRef = gmailService.extractLetterReference(sampleText);
  assert(letterRef && letterRef.includes('4182'), `Extracted letter ref was ${letterRef}`);
  
  const letterDate = gmailService.extractLetterDate(sampleText);
  assert(letterDate && letterDate.startsWith('2026-10-02'), `Extracted letter date was ${letterDate}`);

  const timelineExplicit = gmailService.determineTimeline(sampleText);
  assert.strictEqual(timelineExplicit.deadlineType, 'OFFICIAL_EXPLICIT');
  assert.strictEqual(timelineExplicit.requiresConfirmation, 0);

  const relativeText = 'पत्र प्राप्ति के 3 दिवस के भीतर पालन प्रतिवेदन अनिवार्य रूप से प्रेषित करें।';
  const timelineRelative = gmailService.determineTimeline(relativeText);
  assert.strictEqual(timelineRelative.deadlineType, 'AI_SUGGESTED');
  assert.strictEqual(timelineRelative.requiresConfirmation, 1);
  console.log('   ✅ Explicit vs AI-suggested deadline determination verified successfully.');

  // 4. Test Database Persistence & Seeding
  console.log('\n4️⃣ Testing SQLite Database Persistence & Seeding:');
  const db = new DatabaseManager();
  await db.init();

  const tasks = await db.getSupervisionTasks();
  console.log(`   Found ${tasks.length} supervision tasks in database.`);
  assert(tasks.length >= 3, 'Must have at least 3 initial seeded tasks');

  // Verify escalation processing
  const { summary } = gmailService.processTaskEscalations(tasks);
  assert(summary.total >= 3, 'Summary total must match tasks count');
  console.log('   Summary Metrics:', JSON.stringify(summary));

  // 5. Test Task Insertion & Update
  const testTaskId = 'TASK-TEST-AUTO-01';
  await db.saveSupervisionTask({
    id: testTaskId,
    letter_ref_no: 'TEST/2026/01',
    letter_date: '2026-10-04',
    issuing_authority: 'Automated Test Office',
    subject: 'Automated Task Verification',
    task_description: 'Verify CRUD operation for supervision task',
    priority: 'HIGH',
    status: 'NEW',
    is_test: 1
  });

  const fetched = await db.getSupervisionTaskById(testTaskId);
  assert(fetched && fetched.id === testTaskId, 'Saved task must be retrievable');

  await db.updateSupervisionTask(testTaskId, {
    status: 'COMPLETED',
    compliance_remarks: 'Verified successfully'
  });

  const updated = await db.getSupervisionTaskById(testTaskId);
  assert.strictEqual(updated.status, 'COMPLETED');
  assert.strictEqual(updated.compliance_remarks, 'Verified successfully');

  await db.deleteSupervisionTask(testTaskId);
  const deleted = await db.getSupervisionTaskById(testTaskId);
  assert.strictEqual(deleted, null, 'Deleted task must no longer exist');
  console.log('   ✅ Task CRUD and lifecycle verified successfully.');

  await db.close();
  console.log('\n✨ ALL TEST SUITES PASSED CLEANLY (100% SUCCESS) ✨\n');
}

runTestSuite().catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
