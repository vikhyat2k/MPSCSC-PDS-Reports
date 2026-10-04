/**
 * Gemini AI Email & Administrative Task Analyzer
 * MPSCSC Supervision Portal — District Office Betul
 * 
 * Uses Google Gemini Generative AI to perform contextual analysis,
 * priority assessment, timeline determination, action point extraction,
 * and draft compliance note generation for government orders.
 */

const CANDIDATE_MODELS = ['gemini-flash-latest', 'gemini-3.5-flash', 'gemini-3.8-flash'];
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

function getApiKey() {
  return (process.env.GEMINI_API_KEY || '').trim();
}

function isConfigured() {
  const key = getApiKey();
  return Boolean(key && key.length > 10);
}

/**
 * Validates the Gemini API key with a fast ping
 * @param {string} testKey Optional key to test, defaults to process.env.GEMINI_API_KEY
 */
async function testConnection(testKey) {
  const key = (testKey || getApiKey()).trim();
  if (!key) {
    return { ok: false, error: 'Gemini API Key missing' };
  }

  for (const model of CANDIDATE_MODELS) {
    try {
      const url = `${GEMINI_API_URL}/${model}:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: "Respond in JSON: {\"status\":\"OK\"}" }]
          }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      const data = await res.json();
      if (res.ok && data.candidates && data.candidates[0]) {
        return { ok: true, model };
      }
    } catch (err) {
      // try next model
    }
  }

  return { ok: false, error: 'Failed to authenticate with Gemini API models' };
}

/**
 * Contextually analyzes an official email & attachments using Gemini
 * @param {object} param0 { subject, sender, date, body, pdfText, attachments }
 */
async function analyzeOfficialEmail({ subject = '', sender = '', date = new Date(), body = '', pdfText = '', attachments = [] }) {
  const key = getApiKey();
  if (!isConfigured()) {
    return null;
  }

  const receivedDate = date instanceof Date ? date : new Date(date || Date.now());
  const formattedDate = receivedDate.toISOString().split('T')[0];

  // Truncate input to avoid excessive token overhead while preserving key content
  const maxChars = 12000;
  let combinedDocument = `EMAIL SUBJECT: ${subject}\nFROM: ${sender}\nDATE RECEIVED: ${formattedDate}\n\nBODY TEXT:\n${body}`;
  if (pdfText) {
    combinedDocument += `\n\nATTACHED OFFICIAL ORDER PDF TEXT:\n${pdfText}`;
  }
  if (combinedDocument.length > maxChars) {
    combinedDocument = combinedDocument.substring(0, maxChars) + '\n\n[...Truncated for processing...]';
  }

  const systemInstruction = `
आप मध्य प्रदेश स्टेट सिविल सप्लाईज कार्पोरेशन (MPSCSC - नागरिक आपूर्ति निगम), जिला कार्यालय बैतूल के प्रशासनिक एवं तकनीकी एआई विश्लेषक (Government Order AI Specialist) हैं।
नीचे दिए गए शासकीय ईमेल, आदेश या परिपत्र का गहन अध्ययन करें और शुद्ध JSON प्रारूप में आउटपुट दें।

विश्लेषण के मानक:
1. "letterRefNo": पत्र क्रमांक/जावक क्रमांक (उदा. "क्र./खाद्य/2026/1420", "फा.क्र./उठाव/98", आदि)। यदि न मिले तो "उल्लेख नहीं"।
2. "letterDate": पत्र पर अंकित आधिकारिक दिनांक (YYYY-MM-DD प्रारूप)। यदि नहीं है तो प्राप्ति दिनांक ${formattedDate} दें।
3. "issuingAuthority": आदेश जारी करने वाले सक्षम अधिकारी का पदनाम व कार्यालय (उदा. "कलेक्टर एवं जिला दण्डाधिकारी, जिला बैतूल", "प्रबंध संचालक, म.प्र. स्टेट सिविल सप्लाईज कार्पोरेशन, भोपाल", "क्षेत्रीय प्रबंधक, भोपाल संभाग", "जिला आपूर्ति अधिकारी, बैतूल")।
4. "taskDescription": पत्र में दिए गए निर्देशों और आवश्यक कार्रवाइयों के स्पष्ट, सारगर्भित हिंदी बुलेट पॉइंट्स।
5. "summary": आदेश का 1-2 पंक्तियों का कार्यपालक सारांश (Executive Summary)।
6. "priority": निम्न में से केवल एक चुनें:
   - "CRITICAL": टी.एल. (TL/समय-सीमा) पत्र, कलेक्टर आदेश, जनसुनवाई, कोर्ट केस, उच्चस्तरीय जांच, अति महत्वपूर्ण बैठक।
   - "HIGH": खाद्यान्न उठाव (PDS Lifting) लक्ष्य, आवंटन निर्देश, मुख्यालय के समयबद्ध परिपत्र, अनिवार्य पालन प्रतिवेदन।
   - "MEDIUM": वेयरहाउसिंग/रेलवे रैक/FCI समन्वय, सामान्य समीक्षा, रूटीन शासकीय पत्राचार।
   - "LOW": केवल सूचनार्थ (Information only), सामान्य परिपत्र।
7. "priorityReason": प्राथमिकता निर्धारित करने का तार्किक हिंदी कारण (1 पंक्ति)।
8. "dueDate": कार्य पूर्ण करने की अंतिम तिथि (YYYY-MM-DD प्रारूप)। यदि स्पष्ट नहीं है तो सापेक्ष अवधि (उदा. 3 दिन, 7 दिन) के अनुसार गणना करें। यदि कोई समय-सीमा तय नहीं है तो null दें।
9. "suggestedTimeline": पठनीय हिंदी समय-सीमा (उदा. "राजकीय समय-सीमा: 20/10/2026" या "3 दिवस के भीतर" या "समय-सीमा अनिर्णित")।
10. "deadlineType": "OFFICIAL_EXPLICIT" (यदि पत्र में स्पष्ट तिथि है), "AI_SUGGESTED" (यदि AI ने सापेक्ष गणना की है), "UNDETERMINED" (यदि कोई समय-सीमा नहीं है)।
11. "requiresConfirmation": AI द्वारा सुझाई गई समय-सीमा के लिए 1, स्पष्ट के लिए 0।
12. "reportingRequired": यदि पालन प्रतिवेदन (Compliance Report) प्रस्तुत करना अनिवार्य है तो 1, अन्यथा 0।
13. "category": "LIFTING", "DISTRIBUTION", "STORAGE", "MEETING_TL", "INSPECTION", "GENERAL" में से एक।
14. "draftComplianceResponse": सक्षम अधिकारी को भेजने हेतु एक विनम्र, औपचारिक हिंदी "ड्राफ्ट पालन प्रतिवेदन / उत्तर पत्र" (Draft Compliance Note) का संक्षिप्त प्रारूप तैयार करें ताकि जिला प्रबंधक 1-क्लिक में इसे उपयोग कर सकें।

उत्तर केवल और केवल वैध JSON ब्लॉक में होना चाहिए। कोई अन्य टिप्पणी या मार्कडाउन न जोड़ें।
`;

  for (const model of CANDIDATE_MODELS) {
    try {
      const url = `${GEMINI_API_URL}/${model}:generateContent?key=${key}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 18000); // 18s safety timeout

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: systemInstruction },
              { text: combinedDocument }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json"
          }
        })
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        console.warn(`⚠️ Gemini API model ${model} HTTP ${res.status}, trying next fallback...`);
        continue;
      }

      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) continue;

      const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      const result = JSON.parse(cleanJson);

      return {
        aiPowered: true,
        modelUsed: model,
        letterRefNo: result.letterRefNo || 'उल्लेख नहीं',
        letterDate: result.letterDate || formattedDate,
        issuingAuthority: result.issuingAuthority || 'सक्षम प्राधिकारी',
        taskDescription: result.taskDescription || subject,
        summary: result.summary || subject,
        priority: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(result.priority) ? result.priority : 'MEDIUM',
        priorityReason: result.priorityReason || 'Gemini AI द्वारा शासकीय प्राथमिकीकरण',
        dueDate: result.dueDate || null,
        suggestedTimeline: result.suggestedTimeline || 'समय-सीमा अनिर्णित',
        deadlineType: result.deadlineType || 'AI_SUGGESTED',
        requiresConfirmation: result.requiresConfirmation ?? 1,
        reportingRequired: result.reportingRequired ?? 0,
        category: result.category || 'GENERAL',
        draftComplianceResponse: result.draftComplianceResponse || ''
      };
    } catch (err) {
      console.warn(`⚠️ Model ${model} analysis error:`, err.message);
    }
  }

  console.warn('⚠️ All Gemini models failed or timed out. Falling back to rules engine.');
  return null;
}

module.exports = {
  isConfigured,
  testConnection,
  analyzeOfficialEmail,
  CANDIDATE_MODELS
};
