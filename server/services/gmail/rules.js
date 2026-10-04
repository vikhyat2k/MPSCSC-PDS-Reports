/**
 * Email Triage & Rules Engine
 * Filters incoming emails against government department patterns,
 * whitelists, priority indicators, and routine/spam filters.
 * 
 * MPSCSC Supervision Portal
 */

// Default government department profiles & sender rules
const DEFAULT_DEPARTMENT_RULES = [
  {
    id: 'RULE_HO',
    name: 'Head Office (मुख्यालय - MPSCSC भोपाल)',
    domainPatterns: ['@mpscsc.mp.gov.in', 'ho.mpscsc@gmail.com', 'mpscscho@gmail.com', 'gmpds.mpscsc@mp.gov.in'],
    keywords: ['मुख्यालय', 'प्रबंध संचालक', 'महाप्रबंधक', 'परिपत्र', 'आदेश', 'निर्देश', 'समीक्षा', 'उठाव', 'आवंटन'],
    departmentCategory: 'HO',
    defaultPriority: 'HIGH',
    assignedSection: 'PDS'
  },
  {
    id: 'RULE_COLLECTORATE',
    name: 'Collectorate & District Admin (कलेक्टर कार्यालय / खाद्य शाखा बैतूल)',
    domainPatterns: ['collbetul@mp.gov.in', 'foodbetul@gmail.com', 'dso.betul@mp.gov.in', '@mp.gov.in'],
    keywords: ['टी.एल.', 'टीएल', 'TL', 'समय सीमा', 'कलेक्टर', 'अपर कलेक्टर', 'जिला आपूर्ति अधिकारी', 'बैठक', 'जांच', 'प्रतिवेदन'],
    departmentCategory: 'DISTRICT_ADMIN',
    defaultPriority: 'CRITICAL',
    assignedSection: 'PDS'
  },
  {
    id: 'RULE_RO',
    name: 'Regional Office (क्षेत्रीय कार्यालय - भोपाल संभाग)',
    domainPatterns: ['rm.bhopal@mpscsc.mp.gov.in', 'rmbhopal@gmail.com', 'rmbhopal.mpscsc@gmail.com'],
    keywords: ['क्षेत्रीय प्रबंधक', 'संभाग', 'निरीक्षण', 'भौतिक सत्यापन', 'स्टॉक', 'परिशिष्ट', 'अनुपालन'],
    departmentCategory: 'RO',
    defaultPriority: 'HIGH',
    assignedSection: 'Storage'
  },
  {
    id: 'RULE_CORP_COORD',
    name: 'Coordination (MPWLC / FCI / Warehousing)',
    domainPatterns: ['@mpwlc.co.in', '@fci.gov.in', 'mpwlcbetul@gmail.com'],
    keywords: ['भंडारण', 'वेयरहाउस', 'एफसीआई', 'रैक', 'अनलोडिंग', 'स्टैक', 'गुणवत्ता', 'सीडब्ल्यूसी'],
    departmentCategory: 'OTHER_GOVT',
    defaultPriority: 'MEDIUM',
    assignedSection: 'Storage'
  }
];

// Noise and non-actionable email patterns (ignore from task creation)
const BLACKLIST_PATTERNS = [
  /mailer-daemon@/i,
  /no-?reply@/i,
  /notifications?@/i,
  /automated@/i,
  /newsletter@/i,
  /updates?@/i,
  /alert@google\.com/i,
  /security@/i,
  /bounce/i
];

const BLACKLIST_SUBJECTS = [
  /delivery status notification/i,
  /undeliverable/i,
  /failure notice/i,
  /out of office/i,
  /automatic reply/i,
  /security alert/i,
  /sign-in attempt/i,
  /verify your account/i
];

/**
 * Checks if an email is routine spam / automated notification that should be skipped
 * @param {string} sender From header
 * @param {string} subject Subject header
 */
function isNoiseEmail(sender = '', subject = '') {
  for (const pattern of BLACKLIST_PATTERNS) {
    if (pattern.test(sender)) return true;
  }
  for (const pattern of BLACKLIST_SUBJECTS) {
    if (pattern.test(subject)) return true;
  }
  return false;
}

/**
 * Evaluates an email against department rules and keywords
 * @param {object} param0 Email metadata { sender, subject, body }
 * @param {Array} customRules Optional rules retrieved from database
 */
function evaluateTriageRules({ sender = '', subject = '', body = '' }, customRules = []) {
  const combinedText = `${subject} ${body}`.toLowerCase();
  const senderLower = sender.toLowerCase();

  const rulesToEvaluate = (customRules && customRules.length > 0)
    ? customRules
    : DEFAULT_DEPARTMENT_RULES;

  for (const rule of rulesToEvaluate) {
    // Check sender domains
    const domainMatch = rule.domainPatterns.some(pattern => {
      if (pattern.startsWith('@')) {
        return senderLower.includes(pattern.toLowerCase());
      }
      return senderLower.includes(pattern.toLowerCase());
    });

    // Check keyword presence in subject or body
    const keywordMatch = rule.keywords.some(kw => combinedText.includes(kw.toLowerCase()));

    if (domainMatch || keywordMatch) {
      return {
        matched: true,
        ruleId: rule.id,
        ruleName: rule.name,
        departmentCategory: rule.departmentCategory,
        suggestedPriority: rule.defaultPriority,
        suggestedSection: rule.assignedSection,
        reason: domainMatch ? `Sender matched ${rule.name}` : `Keyword match in ${rule.name}`
      };
    }
  }

  // Fallback check: General government order indicators
  const generalGovKeywords = ['आदेश', 'निर्देश', 'परिपत्र', 'ज्ञापन', 'memo', 'order', 'circular', 'compliance', 'meeting'];
  const hasGovKeyword = generalGovKeywords.some(kw => combinedText.includes(kw.toLowerCase()));

  if (hasGovKeyword) {
    return {
      matched: true,
      ruleId: 'RULE_GEN_GOV',
      ruleName: 'General Official Correspondence',
      departmentCategory: 'OTHER_GOVT',
      suggestedPriority: 'MEDIUM',
      suggestedSection: 'PDS',
      reason: 'General official order keywords detected'
    };
  }

  return {
    matched: false,
    reason: 'No matching department rule or official order keyword found'
  };
}

module.exports = {
  DEFAULT_DEPARTMENT_RULES,
  isNoiseEmail,
  evaluateTriageRules
};
