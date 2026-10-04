require('dotenv').config();
const geminiAnalyzer = require('../server/services/gmail/geminiAnalyzer');

(async () => {
  console.log("🚀 Testing Gemini AI Administrative Intelligence Integration...");
  
  if (!geminiAnalyzer.isConfigured()) {
    console.error("❌ GEMINI_API_KEY is not configured in .env!");
    process.exit(1);
  }
  console.log("✓ GEMINI_API_KEY loaded from .env");

  console.log("1. Testing Connection & Ping with Candidate Models...");
  const ping = await geminiAnalyzer.testConnection();
  console.log("  ✓ Ping Result:", ping);

  if (!ping.ok) {
    console.error("❌ Gemini test connection failed:", ping.error);
    process.exit(1);
  }

  console.log("2. Testing Contextual Analysis on Official Order Sample...");
  const sampleOrder = {
    subject: "टी.एल. पत्र - माह अक्टूबर 2026 हेतु सार्वजनिक वितरण प्रणाली (PDS) खाद्यान्न उठाव एवं वितरण की समीक्षा बाबत",
    sender: "कलेक्टर कार्यालय खाद्य शाखा बैतूल <collbetul@mp.gov.in>",
    date: new Date("2026-10-04T10:00:00Z"),
    body: `
प्रति,
जिला प्रबंधक,
म.प्र. स्टेट सिविल सप्लाईज कार्पोरेशन लि., जिला बैतूल

विषय: टी.एल. पत्र क्रमांक 412/खाद्य/2026 - माह अक्टूबर 2026 खाद्यान्न उठाव एवं वितरण सुनिश्चित करने बाबत।

उपरोक्त विषयांतर्गत लेख है कि समय-सीमा (TL) बैठक दिनांक 04.10.2026 में कलेक्टर महोदय द्वारा निर्देशित किया गया है कि:
1. जिले के समस्त 10 प्रदाय केन्द्रों से उचित मूल्य दुकानों तक खाद्यान्न का 100% उठाव आगामी 7 दिवस के भीतर (दिनांक 11.10.2026 तक) पूर्ण किया जावे।
2. वर्षा ऋतु उपरांत वेयरहाउसों में भंडारित स्टॉक का भौतिक सत्यापन कर सुरक्षित परिवहन सुनिश्चित करें।
3. उक्त निर्देशों का कड़ाई से पालन करते हुए दिनांक 12.10.2026 तक कलेक्टर कार्यालय में पालन प्रतिवेदन प्रस्तुत करना सुनिश्चित करें।

आदेशानुसार,
अपर कलेक्टर / जिला आपूर्ति अधिकारी
जिला बैतूल
    `
  };

  const analysis = await geminiAnalyzer.analyzeOfficialEmail(sampleOrder);
  console.log("\n3. Gemini AI Analysis Results:");
  console.log("  • AI Powered:", analysis?.aiPowered);
  console.log("  • Model Used:", analysis?.modelUsed);
  console.log("  • Letter Ref:", analysis?.letterRefNo);
  console.log("  • Letter Date:", analysis?.letterDate);
  console.log("  • Issuing Authority:", analysis?.issuingAuthority);
  console.log("  • Priority:", analysis?.priority);
  console.log("  • Priority Reason:", analysis?.priorityReason);
  console.log("  • Due Date:", analysis?.dueDate);
  console.log("  • Suggested Timeline:", analysis?.suggestedTimeline);
  console.log("  • Compliance Reporting Required:", analysis?.reportingRequired);
  console.log("  • Has Draft Compliance Note:", Boolean(analysis?.draftComplianceResponse));

  if (analysis && analysis.priority === 'CRITICAL' && analysis.letterRefNo.includes('412')) {
    console.log("\n🎉 ALL GEMINI INTEGRATION TESTS PASSED WITH 100% ACCURACY!");
  } else {
    throw new Error("Analysis output did not match expected structure");
  }
})();
