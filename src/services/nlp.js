const nlp = require('compromise');

function extractEntities(text) {
  if (!text || typeof text !== 'string') {
    return { names: [], dates: [], addresses: [], emails: [], phones: [], money: [] };
  }

  const names = extractNames(text);
  const dates = extractDates(text);
  const addresses = extractAddresses(text);
  const emails = extractEmails(text);
  const phones = extractPhones(text);
  const money = extractMoney(text);

  return { names, dates, addresses, emails, phones, money };
}

function extractNames(text) {
  try {
    const people = nlp(text).people().out('array');
    if (!Array.isArray(people)) return [];
    return people.filter(p => p && typeof p === 'string');
  } catch {
    return [];
  }
}

function extractDates(text) {
  const dateRegex = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g;
  const matches = text.match(dateRegex) || [];
  return matches.filter(d => d);
}

function extractAddresses(text) {
  const addressRegex = /\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|way|court|ct)[\s,]+[\w\s]+[\s,]*\d{5}/gi;
  const matches = text.match(addressRegex) || [];
  return matches.map(a => a.trim()).filter(a => a);
}

function extractEmails(text) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex) || [];
  return matches.filter(e => e);
}

function extractPhones(text) {
  const phoneRegex = /(?:\+?91[-.\s]?)?(?:\()?\d{4}[\-\s]?\d{4}|\d{10}/g;
  const matches = text.match(phoneRegex) || [];
  return matches.map(p => p.trim()).filter(p => p);
}

function extractMoney(text) {
  const moneyRegex = /Rs\.?\s*[\d,]+\.?\d*/gi;
  const matches = text.match(moneyRegex) || [];
  return matches.filter(m => m);
}

function classifyDocument(text) {
  if (!text || typeof text !== 'string') {
    return { type: 'unknown', confidence: 0 };
  }

  const classifications = [
    { type: 'aadhar', patterns: [/aadhar/i, /uidai/i, /\d{4}\s\d{4}\s\d{4}/, /unique identification authority/i, /uid number/i], weight: 2.0 },
    { type: 'pan', patterns: [/permanent account number/i, /pan card/i, /income tax department/i, /pancard/i, /[A-Z]{5}[0-9]{4}[A-Z]{1}/], weight: 2.0 },
    { type: 'salary_slip', patterns: [/salary slip/i, /pay slip/i, /payslip/i, /salary\s*sheet/i, /earnings/i, /deductions/i, /net pay/i, /gross/i], weight: 2.0 }
  ];

  let bestMatch = { type: 'unknown', confidence: 0 };

  for (const cls of classifications) {
    let score = 0;
    for (const pattern of cls.patterns) {
      const matches = text.match(pattern);
      if (matches) {
        score += matches.length * cls.weight;
      }
    }
    const wordCount = text.split(/\s+/).length;
    if (wordCount > 0) {
      score = score / Math.sqrt(wordCount / 50);
    }

    const confidence = Math.min(0.99, score / 10);
    if (confidence > bestMatch.confidence) {
      bestMatch = { type: cls.type, confidence: parseFloat(confidence.toFixed(2)) };
    }
  }

  return bestMatch;
}

function detectLanguage(text) {
  return 'en';
}

module.exports = { extractEntities, classifyDocument, detectLanguage };
