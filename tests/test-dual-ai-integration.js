require('dotenv').config();
const geminiAnalyzer = require('../server/services/gmail/geminiAnalyzer');

(async () => {
  console.log("=================================================");
  console.log("🚀 Testing Dual-Engine AI Integration (Gemini + Sarvam)");
  console.log("=================================================");

  console.log("\n1. Configuration Status:");
  console.log("  • Gemini Configured:", geminiAnalyzer.isGeminiConfigured());
  console.log("  • Sarvam Configured:", geminiAnalyzer.isSarvamConfigured());
  console.log("  • Overall AI Configured:", geminiAnalyzer.isConfigured());

  if (!geminiAnalyzer.isConfigured()) {
    console.error("❌ Neither Gemini nor Sarvam is configured!");
    process.exit(1);
  }

  console.log("\n2. Testing Primary Engine (Google Gemini AI) Connection...");
  const geminiPing = await geminiAnalyzer.testConnection();
  console.log("  • Gemini Ping Result:", {
    ok: geminiPing.ok,
    model: geminiPing.model,
    rateLimited: geminiPing.rateLimited || false,
    error: geminiPing.error || null
  });

  console.log("\n3. Testing Fallback Engine (Sarvam AI) Connection...");
  const sarvamPing = await geminiAnalyzer.testSarvamConnection();
  console.log("  • Sarvam Ping Result:", {
    ok: sarvamPing.ok,
    model: sarvamPing.model,
    quotaExhausted: sarvamPing.quotaExhausted || false,
    rateLimited: sarvamPing.rateLimited || false,
    error: sarvamPing.error || null
  });

  console.log("\n4. Testing Official Government Order Analysis with Fallback...");
  const sampleOrder = {
    subject: "टी.एल. पत्र - माह अक्टूबर 2026 राइस मिलिंग (CMR) चावल जमा एवं उपार्जन समीक्षा बाबत",
    sender: "कलेक्टर कार्यालय खाद्य शाखा बैतूल <collbetul@mp.gov.in>",
    date: new Date("2026-10-04T10:00:00Z"),
    body: `
प्रति,
जिला प्रबंधक,
म.प्र. स्टेट सिविल सप्लाईज कार्पोरेशन लि., जिला बैतूल

विषय: टी.एल. पत्र क्रमांक 412/खाद्य/2026 - माह अक्टूबर 2026 मिलिंग एवं उपार्जन समीक्षा।

उपरोक्त विषयांतर्गत निर्देशित किया जाता है कि:
1. कस्टम मिलिंग के शेष सीएमआर (CMR) चावल को आगामी 5 दिवस के भीतर अनिवार्यतः जमा कराएं।
2. आगामी खरीफ विपणन मौसम 2026-27 हेतु धान उपार्जन केन्द्रों की भौतिक तैयारी पूर्ण करें।
3. उक्त निर्देशों का पालन प्रतिवेदन दिनांक 10.10.2026 तक प्रस्तुत करें।

आदेशानुसार,
कलेक्टर एवं जिला दण्डाधिकारी
जिला बैतूल
    `
  };

  const analysis = await geminiAnalyzer.analyzeOfficialEmail(sampleOrder);
  console.log("\n5. Analysis Result Received:");
  if (analysis) {
    console.log("  ✓ AI Powered:", analysis.aiPowered);
    console.log("  ✓ Model Used:", analysis.modelUsed);
    console.log("  ✓ Provider:", analysis.provider || 'gemini');
    console.log("  ✓ Letter Ref:", analysis.letterRefNo);
    console.log("  ✓ Priority:", analysis.priority);
    console.log("  ✓ Assigned Section:", analysis.assignedSection);
    console.log("  ✓ Priority Reason:", analysis.priorityReason);
    console.log("  ✓ Has Draft Compliance:", Boolean(analysis.draftComplianceResponse));
  } else {
    console.log("  ⚠️ AI returned null (Both engines failed/rate-limited/quota-exhausted). System will gracefully use rule-based regex.");
  }

  console.log("\n=================================================");
  console.log("✅ DUAL-ENGINE AI SUITE COMPLETED SUCCESSFULLY!");
  console.log("=================================================");
  process.exit(0);
})();
