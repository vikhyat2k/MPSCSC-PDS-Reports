/**
 * Dual-Engine Administrative AI Intelligence (Google Gemini AI + Groq Cloud LPU AI)
 * MPSCSC Supervision Portal — District Office Betul
 * 
 * Primary Engine: Google Gemini Generative AI (gemini-flash-latest, gemini-3.5-flash, gemini-3.8-flash)
 * Ultra-Fast Failover Engine: Groq Cloud LPU AI (qwen/qwen3.8-27b, openai/gpt-oss-120b, openai/gpt-oss-20b)
 * 
 * Automatically failovers to Groq Cloud when Gemini hits HTTP 429 (Rate Limit) or quota exhaustion,
 * ensuring zero-downtime, sub-second administrative analysis of official Hindi government orders.
 */

const CANDIDATE_MODELS = ['gemini-flash-latest', 'gemini-3.5-flash', 'gemini-3.8-flash'];
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

const GROQ_CANDIDATE_MODELS = ['qwen/qwen3.8-27b', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b'];
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

function getApiKey() {
  return (process.env.GEMINI_API_KEY || '').trim();
}

function getGroqApiKey() {
  return (process.env.GROQ_API_KEY || '').trim();
}

function isGeminiConfigured() {
  const key = getApiKey();
  return Boolean(key && key.length > 10);
}

function isGroqConfigured() {
  const key = getGroqApiKey();
  return Boolean(key && key.length > 10);
}

function isConfigured() {
  return isGeminiConfigured() || isGroqConfigured();
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

  let lastError = 'Failed to authenticate with Gemini API models';
  let hitRateLimit = false;

  for (let i = 0; i < CANDIDATE_MODELS.length; i++) {
    const model = CANDIDATE_MODELS[i];
    // Small delay between retries to avoid cascading 429s
    if (i > 0) await new Promise(r => setTimeout(r, 500));

    try {
      const url = `${GEMINI_API_URL}/${model}:generateContent?key=${key}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{
            parts: [{ text: "Respond in JSON: {\"status\":\"OK\"}" }]
          }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      clearTimeout(timeoutId);

      if (res.status === 429) {
        hitRateLimit = true;
        lastError = 'Gemini API दर सीमा पहुँच गई (Rate Limit). कृपया कुछ मिनट बाद पुनः प्रयास करें या Groq LPU फॉलबैक का उपयोग करें।';
        console.warn(`⚠️ Gemini model ${model}: 429 Rate Limit — skipping`);
        continue;
      }

      if (res.status === 401 || res.status === 403) {
        lastError = 'Gemini API Key अमान्य है। कृपया सही API Key दर्ज करें।';
        console.warn(`⚠️ Gemini model ${model}: ${res.status} Auth failure`);
        break;
      }

      const data = await res.json();
      if (res.ok && data.candidates && data.candidates[0]) {
        return { ok: true, model, provider: 'gemini' };
      }

      console.warn(`⚠️ Gemini model ${model}: HTTP ${res.status}, no candidates — trying next`);
    } catch (err) {
      console.warn(`⚠️ Gemini model ${model} fetch error: ${err.message}`);
      lastError = `नेटवर्क त्रुटि: ${err.message}`;
    }
  }

  if (hitRateLimit) {
    return { ok: false, error: lastError, rateLimited: true, provider: 'gemini' };
  }

  return { ok: false, error: lastError, provider: 'gemini' };
}

/**
 * Validates the Groq Cloud API key with a fast ping
 * @param {string} testKey Optional key to test, defaults to process.env.GROQ_API_KEY
 */
async function testGroqConnection(testKey) {
  const key = (testKey || getGroqApiKey()).trim();
  if (!key) {
    return { ok: false, error: 'Groq Cloud API Key missing' };
  }

  for (let i = 0; i < GROQ_CANDIDATE_MODELS.length; i++) {
    const model = GROQ_CANDIDATE_MODELS[i];
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Respond with valid JSON: {"status":"OK"}' }],
          temperature: 0.1,
          response_format: { type: 'json_object' }
        })
      });
      clearTimeout(timeoutId);

      if (res.status === 200) {
        const data = await res.json();
        return { ok: true, model, provider: 'groq', data };
      }

      if (res.status === 401 || res.status === 403) {
        return {
          ok: false,
          model,
          provider: 'groq',
          error: 'Groq Cloud API Key अमान्य है। कृपया सही API Key दर्ज करें।'
        };
      }

      if (res.status === 429) {
        return {
          ok: false,
          rateLimited: true,
          model,
          provider: 'groq',
          error: 'Groq Cloud दर सीमा पहुँच गई (Rate Limit). कृपया कुछ मिनट बाद पुनः प्रयास करें।'
        };
      }

      const errText = await res.text();
      console.warn(`⚠️ Groq model ${model} HTTP ${res.status}: ${errText.substring(0, 100)}`);
    } catch (err) {
      console.warn(`⚠️ Groq model ${model} fetch error: ${err.message}`);
    }
  }

  return { ok: false, provider: 'groq', error: 'Groq Cloud API से संपर्क स्थापित नहीं हो सका।' };
}

/**
 * Builds the official administrative prompt for government orders
 */
function buildGovernmentOrderPrompt(formattedDate) {
  return `
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
14. "assignedSection": निम्न में से संबंधित प्रभारी शाखा चुनें:
    - "Milling": यदि पत्र राइस मिलिंग, कस्टम मिलिंग, सीएमआर (CMR), मिलर अनुबंध, चावल जमा या मिलिंग देयकों से संबंधित हो।
    - "Procurement": यदि पत्र समर्थन मूल्य (MSP) उपार्जन, धान/गेहूं उपार्जन केंद्र, किसान पंजीयन, स्लॉट बुकिंग, बारदाना या तौल से संबंधित हो।
    - "PDS": यदि खाद्यान्न उठाव (Lifting), उचित मूल्य दुकान (FPS), वितरण या मासिक आवंटन से संबंधित हो।
    - "Storage": यदि वेयरहाउस, साइलो, स्टॉक सुरक्षा, MPWLC/CWC या रैक अनलोडिंग से संबंधित हो।
    - "Quality": यदि खाद्यान्न गुणवत्ता, QC सैंपलिंग, अमानक स्टॉक या लैब रिपोर्ट से संबंधित हो।
    - "Finance": यदि लेखा, ऑडिट, बैंक गारंटी या वित्तीय दावों से संबंधित हो।
    - "Admin": यदि सामान्य प्रशासन, स्थापना, बैठक या विविध से संबंधित हो।
15. "draftComplianceResponse": सक्षम अधिकारी को भेजने हेतु एक विनम्र, औपचारिक हिंदी "ड्राफ्ट पालन प्रतिवेदन / उत्तर पत्र" (Draft Compliance Note) का संक्षिप्त प्रारूप तैयार करें ताकि जिला प्रबंधक 1-क्लिक में इसे उपयोग कर सकें।

उत्तर केवल और केवल वैध JSON ब्लॉक में होना चाहिए। कोई अन्य टिप्पणी या मार्कडाउन न जोड़ें।
`;
}

/**
 * Extracts and cleans JSON object from raw LLM output
 */
function parseJsonFromText(rawText) {
  if (!rawText) return null;
  const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    return JSON.parse(cleanJson);
  } catch (err) {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e) {}
    }
  }
  return null;
}

/**
 * Calls Groq Cloud LPU AI as an ultra-fast failover / alternate intelligence engine
 */
async function callGroqAI(systemInstruction, combinedDocument, formattedDate, subject) {
  const groqKey = getGroqApiKey();
  if (!groqKey) return null;

  console.log('⚡ [Dual-Engine AI] Invoking Groq Cloud LPU AI engine for sub-second inference...');
  for (const model of GROQ_CANDIDATE_MODELS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: combinedDocument }
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' }
        })
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        console.warn(`⚠️ [Groq AI] HTTP ${res.status} on model ${model}: ${await res.text()}`);
        continue;
      }

      const data = await res.json();
      const rawContent = data.choices?.[0]?.message?.content;
      const result = parseJsonFromText(rawContent);
      if (!result) continue;

      return {
        aiPowered: true,
        provider: 'groq',
        modelUsed: `${model} (Groq Cloud LPU)`,
        letterRefNo: result.letterRefNo || 'उल्लेख नहीं',
        letterDate: result.letterDate || formattedDate,
        issuingAuthority: result.issuingAuthority || 'सक्षम प्राधिकारी',
        taskDescription: result.taskDescription || subject,
        summary: result.summary || subject,
        priority: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(result.priority) ? result.priority : 'MEDIUM',
        priorityReason: result.priorityReason || 'Groq AI द्वारा शासकीय प्राथमिकीकरण',
        dueDate: result.dueDate || null,
        suggestedTimeline: result.suggestedTimeline || 'समय-सीमा अनिर्णित',
        deadlineType: result.deadlineType || 'AI_SUGGESTED',
        requiresConfirmation: result.requiresConfirmation ?? 1,
        reportingRequired: result.reportingRequired ?? 0,
        category: result.category || 'GENERAL',
        assignedSection: result.assignedSection || null,
        draftComplianceResponse: result.draftComplianceResponse || ''
      };
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn(`⚠️ [Groq AI] Request error on model ${model}:`, err.message);
    }
  }

  return null;
}

/**
 * Contextually analyzes an official email & attachments using Google Gemini (Primary) with Groq Cloud LPU fallback
 * @param {object} param0 { subject, sender, date, body, pdfText, attachments }
 */
async function analyzeOfficialEmail({ subject = '', sender = '', date = new Date(), body = '', pdfText = '', attachments = [] }) {
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

  const systemInstruction = buildGovernmentOrderPrompt(formattedDate);
  const geminiKey = getApiKey();
  let geminiFailed = false;

  // 1. Try Gemini Primary Models if configured
  if (isGeminiConfigured()) {
    for (const model of CANDIDATE_MODELS) {
      try {
        const url = `${GEMINI_API_URL}/${model}:generateContent?key=${geminiKey}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s safety timeout

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

        if (res.status === 429) {
          console.warn(`⚠️ Gemini API model ${model} HTTP 429 Rate Limit. Trying next / Groq fallback...`);
          geminiFailed = true;
          continue;
        }

        if (!res.ok) {
          console.warn(`⚠️ Gemini API model ${model} HTTP ${res.status}, trying next fallback...`);
          continue;
        }

        const data = await res.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) continue;

        const result = parseJsonFromText(rawText);
        if (!result) continue;

        return {
          aiPowered: true,
          provider: 'gemini',
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
          assignedSection: result.assignedSection || null,
          draftComplianceResponse: result.draftComplianceResponse || ''
        };
      } catch (err) {
        console.warn(`⚠️ Model ${model} analysis error:`, err.message);
      }
    }
    geminiFailed = true;
  } else {
    geminiFailed = true;
  }

  // 2. Ultra-Fast Failover to Groq Cloud LPU AI
  if (geminiFailed && isGroqConfigured()) {
    console.log('🔄 [Failover Triggered] Gemini AI rate-limited or unavailable. Activating Groq Cloud LPU AI engine...');
    const groqResult = await callGroqAI(systemInstruction, combinedDocument, formattedDate, subject);
    if (groqResult) {
      return groqResult;
    }
  }

  console.warn('⚠️ All AI models (Gemini & Groq) failed, exhausted, or timed out. Falling back to deterministic rules engine.');
  return null;
}

module.exports = {
  isConfigured,
  isGeminiConfigured,
  isGroqConfigured,
  getApiKey,
  getGroqApiKey,
  testConnection,
  testGroqConnection,
  analyzeOfficialEmail,
  CANDIDATE_MODELS,
  GROQ_CANDIDATE_MODELS
};
