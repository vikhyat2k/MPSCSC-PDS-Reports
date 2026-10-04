/**
 * Official Government Order & Email Content Parser
 * Extracts reference numbers, issuing authorities, instructions,
 * sections, and accurate timelines (explicit vs AI-suggested).
 * 
 * MPSCSC Supervision Portal
 */

const fs = require('fs');
const path = require('path');

// Hindi month map for date parsing
const HINDI_MONTHS = {
  'जनवरी': 0, 'जनवरी': 0, 'फ़रवरी': 1, 'फरवरी': 1, 'मार्च': 2,
  'अप्रैल': 3, 'मई': 4, 'जून': 5, 'जुलाई': 6, 'अगस्त': 7,
  'सितंबर': 8, 'सितम्बर': 8, 'अक्टूबर': 9, 'अक्टूवर': 9,
  'नवंबर': 10, 'नवम्बर': 10, 'दिसंबर': 11, 'दिसम्बर': 11
};

const ENGLISH_MONTHS = {
  'jan': 0, 'january': 0, 'feb': 1, 'february': 1, 'mar': 2, 'march': 2,
  'apr': 3, 'april': 3, 'may': 4, 'jun': 5, 'june': 5, 'jul': 6, 'july': 6,
  'aug': 7, 'august': 7, 'sep': 8, 'september': 8, 'oct': 9, 'october': 9,
  'nov': 10, 'november': 10, 'dec': 11, 'december': 11
};

/**
 * Extracts official letter / memo reference number from text
 * @param {string} text 
 */
function extractLetterReference(text) {
  if (!text) return null;
  
  // Patterns like "क्रमांक / 4182 / 2026", "फा.क्र. 12/2026", "पत्र क्र. 842", "Memo No. 102/PDS"
  const patterns = [
    /(?:पत्र\s*क्रमांक|क्रमांक|क्र\.|फा\.\s*क्र\.|फा\.सं\.|Memo\s*(?:No\.?)?|Order\s*(?:No\.?)?|Dispatch\s*No\.?)\s*[:/-]?\s*([A-Za-z0-9\u0900-\u097F_./-]{3,40})/i,
    /(?:जावक\s*(?:क्रमांक|नं\.?))\s*[:/-]?\s*([A-Za-z0-9\u0900-\u097F_./-]{3,40})/i
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      const cleaned = match[1].trim().replace(/^[/:,\s]+|[/:,\s]+$/g, '');
      if (cleaned.length >= 3 && !/^(दिनांक|date|subject|विषय)$/i.test(cleaned)) {
        return cleaned;
      }
    }
  }
  return null;
}

/**
 * Extracts printed letter date from text
 * @param {string} text 
 */
function extractLetterDate(text) {
  if (!text) return null;

  // Numerical date: 15.10.2026 or 15/10/2026 or 15-10-2026
  const numMatch = text.match(/(?:दिनांक|दि\.|Dated?|Date)\s*[:/-]?\s*(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/i);
  if (numMatch) {
    let day = parseInt(numMatch[1], 10);
    let month = parseInt(numMatch[2], 10);
    let year = parseInt(numMatch[3], 10);
    if (year < 100) year += 2000;
    if (day <= 31 && month <= 12) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Hindi text date: e.g. "15 अक्टूबर 2026"
  const hindiMonthRegex = /(\d{1,2})\s+([A-Za-z\u0900-\u097F]+)\s+(\d{4})/;
  const hindiMatch = text.match(hindiMonthRegex);
  if (hindiMatch) {
    const day = parseInt(hindiMatch[1], 10);
    const mStr = hindiMatch[2].toLowerCase();
    const year = parseInt(hindiMatch[3], 10);

    let month = HINDI_MONTHS[mStr];
    if (month === undefined) {
      month = ENGLISH_MONTHS[mStr];
    }
    if (month !== undefined && day <= 31) {
      return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return null;
}

/**
 * Extracts issuing authority from text/subject
 * @param {string} text 
 * @param {string} sender 
 */
function extractIssuingAuthority(text, sender = '') {
  const combined = `${text} ${sender}`.toLowerCase();

  if (combined.includes('प्रबंध संचालक') || combined.includes('managing director') || combined.includes('मुख्यालय') || combined.includes('ho.mpscsc')) {
    return 'प्रबंध संचालक, म.प्र. स्टेट सिविल सप्लाईज कार्पोरेशन, भोपाल';
  }
  if (combined.includes('कलेक्टर') || combined.includes('collector') || combined.includes('collbetul')) {
    return 'कलेक्टर एवं जिला दण्डाधिकारी, जिला बैतूल';
  }
  if (combined.includes('क्षेत्रीय प्रबंधक') || combined.includes('regional manager') || combined.includes('rm.bhopal')) {
    return 'क्षेत्रीय प्रबंधक, म.प्र. स्टेट सिविल सप्लाईज कार्पोरेशन, भोपाल संभाग';
  }
  if (combined.includes('जिला आपूर्ति अधिकारी') || combined.includes('dso')) {
    return 'जिला आपूर्ति अधिकारी, खाद्य शाखा बैतूल';
  }
  if (combined.includes('mpwlc') || combined.includes('वेयरहाउसिंग')) {
    return 'म.प्र. वेयरहाउसिंग एंड लॉजिस्टिक्स कार्पोरेशन (MPWLC)';
  }

  // Fallback to sender header cleanup
  const senderMatch = sender.match(/^(.*?)(?:<.*?>)?$/);
  if (senderMatch && senderMatch[1].trim()) {
    return senderMatch[1].trim().replace(/^"|"$/g, '');
  }

  return 'सक्षम प्राधिकारी (Competent Authority)';
}

/**
 * Extracts action items and instructions from text
 * @param {string} text 
 * @param {string} subject 
 */
function extractActionInstructions(text, subject = '') {
  if (!text) return subject;

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const actionPoints = [];

  // Look for action-oriented lines or numbering
  for (const line of lines) {
    const isNumbered = /^(?:[0-9]+[.)]|[\u0966-\u096F]+[.)]|[-*•])\s+/.test(line);
    const hasActionWords = /(?:सुनिश्चित करें|निर्देशित किया जाता है|पालन प्रतिवेदन|उपस्थित रहें|समीक्षा|कार्रवाई करें|प्रस्तुत करें|उठाव पूर्ण)/i.test(line);

    if (isNumbered || hasActionWords) {
      if (line.length > 15 && line.length < 300) {
        actionPoints.push(line.replace(/^(?:[0-9]+[.)]|[\u0966-\u096F]+[.)]|[-*•])\s+/, ''));
      }
    }
  }

  if (actionPoints.length > 0) {
    return actionPoints.slice(0, 5).join('; ');
  }

  // Fallback: Use subject + first relevant paragraph
  const cleanBody = text.replace(/[\r\n]+/g, ' ').substring(0, 300).trim();
  return cleanBody || subject;
}

/**
 * Computes deadline and timeline classification
 * Distinguishes between OFFICIAL_EXPLICIT and AI_SUGGESTED
 * @param {string} text Combined body and attachment text
 * @param {Date} receivedDate Email receipt timestamp
 */
function determineTimeline(text, receivedDate = new Date()) {
  const baseDate = receivedDate instanceof Date && !isNaN(receivedDate) ? receivedDate : new Date();

  // 1. Search for Explicit Deadlines:
  // e.g. "दिनांक 15/10/2026 तक", "15.10.2026 पूर्व", "by 15 October 2026", "तक 20/10/2026"
  const explicitPatterns = [
    // Preposition: e.g. "by 15/10/2026", "तक 15/10/2026", "अंतिम तिथि 15/10/2026"
    /(?:तक|पूर्व|अंतिम\s*(?:तिथि|दिनांक)|by|before|due\s*(?:on|by)|deadline\s*(?:is|on)?)\s*[:/-]?\s*(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/i,
    // Postposition (standard Hindi): e.g. "दिनांक 15/10/2026 तक", "15.10.2026 पूर्व"
    /(?:दिनांक|दि\.)?\s*(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\s*(?:तक|पूर्व|के\s*पूर्व|से\s*पहले)/i,
    // Hindi month with postposition: e.g. "15 अक्टूबर 2026 तक"
    /(\d{1,2})\s+([A-Za-z\u0900-\u097F]+)\s+(\d{4})\s*(?:तक|पूर्व|के\s*पूर्व)/i,
    // Hindi month with preposition: e.g. "तक 15 अक्टूबर 2026", "before 15 October 2026"
    /(?:तक|पूर्व|by|before)\s*[:/-]?\s*(\d{1,2})\s+([A-Za-z\u0900-\u097F]+)\s+(\d{4})/i
  ];


  for (const pat of explicitPatterns) {
    const match = text.match(pat);
    if (match) {
      let day = parseInt(match[1], 10);
      let month, year;

      if (/^\d+$/.test(match[2])) {
        month = parseInt(match[2], 10) - 1;
        year = parseInt(match[3], 10);
        if (year < 100) year += 2000;
      } else {
        const mStr = match[2].toLowerCase();
        month = HINDI_MONTHS[mStr] !== undefined ? HINDI_MONTHS[mStr] : ENGLISH_MONTHS[mStr];
        year = parseInt(match[3], 10);
      }

      if (month !== undefined && day <= 31) {
        const dueDate = new Date(year, month, day, 18, 0, 0); // Official end of workday 18:00
        return {
          dueDate: dueDate.toISOString(),
          suggestedTimeline: `राजकीय समय-सीमा: ${day}/${month + 1}/${year}`,
          deadlineType: 'OFFICIAL_EXPLICIT',
          requiresConfirmation: 0,
          confidence: 0.98
        };
      }
    }
  }

  // 2. Relative Duration: "3 दिवस के भीतर", "7 days", "1 सप्ताह"
  const relativeMatch = text.match(/(?:(\d+)\s*(?:दिवस|दिन|days?)\s*(?:के\s*भीतर|में|के\s*अंदर|within))/i);
  if (relativeMatch) {
    const days = parseInt(relativeMatch[1], 10);
    const dueDate = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
    dueDate.setHours(18, 0, 0, 0);
    return {
      dueDate: dueDate.toISOString(),
      suggestedTimeline: `${days} दिवस के भीतर (पत्र प्राप्ति से)`,
      deadlineType: 'AI_SUGGESTED',
      requiresConfirmation: 1,
      confidence: 0.85
    };
  }

  // Weekly relative
  if (/सप्ताह\s*(?:में|के\s*भीतर)|within\s*a\s*week/i.test(text)) {
    const dueDate = new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    dueDate.setHours(18, 0, 0, 0);
    return {
      dueDate: dueDate.toISOString(),
      suggestedTimeline: `1 सप्ताह के भीतर (पत्र प्राप्ति से)`,
      deadlineType: 'AI_SUGGESTED',
      requiresConfirmation: 1,
      confidence: 0.80
    };
  }

  // 3. Urgency Indicators (TL / तत्काल / सर्वोच्च प्राथमिकता) -> Protocol defaults
  if (/(?:टी\.?एल\.?|समय\s*सीमा|time\s*limit|तत्काल|अति\s*शीघ्र|सर्वोच्च\s*प्राथमिकता|urgent)/i.test(text)) {
    // Standard default for urgent orders is 48 hours
    const dueDate = new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000);
    dueDate.setHours(18, 0, 0, 0);
    return {
      dueDate: dueDate.toISOString(),
      suggestedTimeline: `अति-महत्वपूर्ण / टी.एल. (अनुमानित 48 घंटे)`,
      deadlineType: 'AI_SUGGESTED',
      requiresConfirmation: 1,
      confidence: 0.75
    };
  }

  // 4. Undetermined -> Do NOT invent a deadline
  return {
    dueDate: null,
    suggestedTimeline: 'समय-सीमा अनिर्णित (पुष्टि अपेक्षित)',
    deadlineType: 'UNDETERMINED',
    requiresConfirmation: 1,
    confidence: 0.50
  };
}

/**
 * Determines task priority based on keywords
 * @param {string} text 
 * @param {string} defaultPriority 
 */
function determinePriority(text, defaultPriority = 'MEDIUM') {
  if (/(?:सर्वोच्च\s*प्राथमिकता|अति\s*महत्वपूर्ण|टी\.?एल\.?|time\s*limit|critical|emergency)/i.test(text)) {
    return 'CRITICAL';
  }
  if (/(?:तत्काल|आदेश|समीक्षा|निर्देश|urgent|high\s*priority|महत्वपूर्ण)/i.test(text)) {
    return 'HIGH';
  }
  if (/(?:अवलोकन|सादर|सूचनार्थ|routine|information)/i.test(text)) {
    return 'LOW';
  }
  return defaultPriority;
}

/**
 * Extracts PDF text using pdf-parse
 * @param {Buffer} buffer 
 */
async function extractPdfText(buffer) {
  try {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return (data && data.text) ? data.text : '';
  } catch (err) {
    console.warn('⚠️ pdf-parse error:', err.message);
    return '';
  }
}

/**
 * Master parser: Converts raw email + attachments into a structured task object
 * @param {object} param0 Email raw data
 */
async function parseOfficialEmail({ messageId, threadId, subject, sender, date, body, attachments = [] }) {
  let combinedText = `${subject || ''}\n${body || ''}`;
  let attachmentSummaries = [];

  let combinedPdfText = '';
  // Parse attached documents
  for (const att of attachments) {
    if (att.mimeType === 'application/pdf' && att.buffer) {
      const pdfText = await extractPdfText(att.buffer);
      if (pdfText) {
        combinedPdfText += `\n--- [Attachment: ${att.filename}] ---\n${pdfText}`;
        combinedText += `\n--- [Attachment: ${att.filename}] ---\n${pdfText}`;
        attachmentSummaries.push({
          filename: att.filename,
          size: att.size,
          textSample: pdfText.substring(0, 200)
        });
      }
    }
  }

  const receivedDate = date ? new Date(date) : new Date();

  // Try Gemini AI Contextual Administrative Analysis first
  const geminiAnalyzer = require('./geminiAnalyzer');
  let aiAnalysis = null;
  if (geminiAnalyzer.isConfigured()) {
    try {
      aiAnalysis = await geminiAnalyzer.analyzeOfficialEmail({
        subject,
        sender,
        date: receivedDate,
        body,
        pdfText: combinedPdfText,
        attachments
      });
      if (aiAnalysis) {
        console.log(`🤖 [Gemini AI Engine] Successfully analyzed official order: "${subject.substring(0, 45)}..." (Priority: ${aiAnalysis.priority}, Model: ${aiAnalysis.modelUsed})`);
      }
    } catch (aiErr) {
      console.warn('⚠️ [Gemini AI Engine] Falling back to rule-based parser:', aiErr.message);
    }
  }

  // Fallback to Rule-Based & Regex Parser if AI is unavailable or unconfigured
  const letterRef = aiAnalysis?.letterRefNo || extractLetterReference(combinedText);
  const letterDate = aiAnalysis?.letterDate || extractLetterDate(combinedText);
  const issuingAuthority = aiAnalysis?.issuingAuthority || extractIssuingAuthority(combinedText, sender);
  const timeline = determineTimeline(combinedText, receivedDate);
  const priority = aiAnalysis?.priority || determinePriority(combinedText);
  
  let taskDescription;
  if (aiAnalysis?.taskDescription) {
    taskDescription = Array.isArray(aiAnalysis.taskDescription)
      ? aiAnalysis.taskDescription.join('\n')
      : aiAnalysis.taskDescription;
  } else {
    taskDescription = extractActionInstructions(combinedText, subject);
  }

  const reportingRequired = aiAnalysis?.reportingRequired ?? (/(?:प्रतिवेदन|पालन\s*प्रतिवेदन|compliance\s*report|रिपोर्ट\s*भेजें)/i.test(combinedText) ? 1 : 0);

  // Direct permanent web link to open in Gmail
  const sourceEmailUrl = `https://mail.google.com/mail/u/0/#inbox/${messageId}`;

  return {
    gmailMessageId: messageId,
    gmailThreadId: threadId,
    letterRefNo: letterRef || 'उल्लेख नहीं',
    letterDate: letterDate || receivedDate.toISOString().split('T')[0],
    issuingAuthority,
    subject: subject || 'शासकीय निर्देश / पत्राचार',
    taskDescription,
    priority,
    dueDate: aiAnalysis?.dueDate || timeline.dueDate,
    suggestedTimeline: aiAnalysis?.suggestedTimeline || timeline.suggestedTimeline,
    deadlineType: aiAnalysis?.deadlineType || timeline.deadlineType,
    requiresConfirmation: aiAnalysis?.requiresConfirmation ?? timeline.requiresConfirmation,
    reportingRequired,
    sourceEmailUrl,
    extractedAttachments: attachmentSummaries,
    aiPowered: aiAnalysis ? 1 : 0,
    aiPriorityReason: aiAnalysis?.priorityReason || 'शासकीय नियम आधारित ट्राइएज',
    draftComplianceResponse: aiAnalysis?.draftComplianceResponse || '',
    category: aiAnalysis?.category || 'GENERAL'
  };
}

module.exports = {
  extractLetterReference,
  extractLetterDate,
  extractIssuingAuthority,
  extractActionInstructions,
  determineTimeline,
  determinePriority,
  parseOfficialEmail
};
