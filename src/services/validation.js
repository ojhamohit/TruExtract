function extractStructuredData(text, documentType) {
  const nlp = require('compromise');
  const doc = nlp(text);

  switch (documentType) {
    case 'aadhar':
      return extractAadharData(doc, text);
    case 'pan':
      return extractPanData(doc, text);
    case 'salary_slip':
      return extractSalarySlipData(doc, text);
    default:
      return extractGenericData(doc, text);
  }
}

function extractAadharData(doc, text) {
  const aadharNumber = extractAadharNumber(text);
  const data = {
    documentType: 'Aadhar Card',
    aadharNumber: aadharNumber,
    name: extractName(text),
    fatherName: extractPattern(text, /(?:father'?s?\s*name|father|s\/o)\s*:?\s*([^\n]+)/i),
    dateOfBirth: extractDateOfBirth(text),
    gender: extractGender(text),
    address: extractAddress(text),
    aadharNumberHidden: hideMiddleDigits(aadharNumber),
    vid: extractPattern(text, /vid\s*:?\s*(\d+)/i),
    pincode: extractPattern(text, /(\d{6})/),
    mobileNumber: extractPattern(text, /(?:mobile|phone|mob)\s*:?\s*(\+?91[-\s]?\d{10}|\d{10})/i)
  };
  return cleanObject(data);
}

/**
 * Extract Aadhaar data from both front and back sides
 */
function extractAadhaarDataFromBothSides(frontText, backText) {
  const combinedText = [frontText, backText].filter(Boolean).join('\n\n');

  // Front side typically has: Photo, Name, DOB, Gender, Aadhaar Number
  const frontData = frontText ? extractAadharData(null, frontText) : {};

  // Back side typically has: Address, QR Code
  const backData = backText ? {
    address: extractAddress(backText),
    pincode: extractPattern(backText, /(\d{6})/),
    qrCodeDetected: /qr|barcode/i.test(backText)
  } : {};

  // Merge data (front takes precedence for common fields, back for address)
  const mergedData = {
    documentType: 'Aadhar Card',
    side: frontText && backText ? 'both' : frontText ? 'front' : 'back',
    ...frontData,
    // Override with back side data for address-related fields
    address: backData.address || frontData.address,
    pincode: backData.pincode || frontData.pincode,
    qrCodeDetected: backData.qrCodeDetected
  };

  return cleanObject(mergedData);
}

function extractPanData(doc, text) {
  const panNumber = extractPanNumber(text);
  const data = {
    documentType: 'PAN Card',
    panNumber: panNumber,
    panNumberHidden: hideMiddleDigits(panNumber),
    name: extractPattern(text, /name\s*:?\s*([^\n]+)/i) || extractName(text),
    fathersName: extractPattern(text, /father'?s?\s*name\s*:?\s*([^\n]+)/i),
    dateOfBirth: extractDateOfBirth(text),
    gender: extractGender(text),
    permanentAccountNumber: panNumber
  };
  return cleanObject(data);
}

function extractSalarySlipData(doc, text) {
  const data = {
    documentType: 'Salary Slip',
    employeeName: extractPattern(text, /employee\s*(?:name)?\s*:?\s*([^\n]+)/i) || extractName(text),
    employeeId: extractPattern(text, /employee\s*(?:id|no)\s*:?\s*([A-Z0-9-]+)/i),
    designation: extractPattern(text, /designation\s*:?\s*([^\n]+)/i),
    department: extractPattern(text, /department\s*:?\s*([^\n]+)/i),
    date: extractDate(text),
    payPeriod: extractPattern(text, /pay\s*period\s*:?\s*([^\n]+)/i),
    earnings: extractEarnings(text),
    deductions: extractDeductions(text),
    netPay: extractNetPay(text),
    bankName: extractPattern(text, /bank\s*(?:name)?\s*:?\s*([^\n]+)/i),
    accountNumber: extractPattern(text, /account\s*(?:no|number)\s*:?\s*([A-Z0-9]+)/i),
    pfNumber: extractPattern(text, /pf\s*(?:no|number)\s*:?\s*([A-Z0-9]+)/i),
    esicNumber: extractPattern(text, /esic\s*(?:no|number)\s*:?\s*([A-Z0-9]+)/i),
    uan: extractPattern(text, /uan\s*:?\s*([A-Z0-9]+)/i)
  };
  return cleanObject(data);
}

function extractAadharNumber(text) {
  const match = text.match(/\d{4}\s?\d{4}\s?\d{4}/);
  return match ? match[0].replace(/\s/g, '') : null;
}

function extractPanNumber(text) {
  const match = text.match(/[A-Z]{5}[0-9]{4}[A-Z]{1}/);
  return match ? match[0] : null;
}

function hideMiddleDigits(number) {
  if (!number) return null;
  if (number.length <= 4) return number;
  const visible = number.slice(0, 2) + '*'.repeat(number.length - 4) + number.slice(-2);
  return visible;
}

function extractEarnings(text) {
  const earnings = [];
  const lines = text.split('\n');
  let inEarnings = false;

  for (const line of lines) {
    if (/(?:earnings|allowances|salary\s+components)/i.test(line)) {
      inEarnings = true;
      continue;
    }
    if (inEarnings && /deductions|totals?|net/i.test(line)) {
      break;
    }
    if (inEarnings) {
      const match = line.match(/^\s*(.+?)\s*[:\-]?\s*Rs?\.?\s*([\d,]+\.?\d*)/i) ||
                   line.match(/^\s*(.+?)\s{2,}([\d,]+\.?\d*)/);
      if (match) {
        earnings.push({ type: match[1].trim(), amount: formatCurrency(match[2]) });
      }
    }
  }
  return earnings;
}

function extractDeductions(text) {
  const deductions = [];
  const lines = text.split('\n');
  let inDeductions = false;

  for (const line of lines) {
    if (/deductions/i.test(line)) {
      inDeductions = true;
      continue;
    }
    if (inDeductions && /(?:net\s*pay|totals?)/i.test(line)) {
      break;
    }
    if (inDeductions) {
      const match = line.match(/^\s*(.+?)\s*[:\-]?\s*Rs?\.?\s*([\d,]+\.?\d*)/i) ||
                   line.match(/^\s*(.+?)\s{2,}([\d,]+\.?\d*)/);
      if (match) {
        deductions.push({ type: match[1].trim(), amount: formatCurrency(match[2]) });
      }
    }
  }
  return deductions;
}

function extractNetPay(text) {
  const match = text.match(/(?:net\s*(?:pay|salary)?)\s*:?\s*Rs?\.?\s*([\d,]+\.?\d*)/i);
  return match ? formatCurrency(match[1]) : null;
}

function formatCurrency(amount) {
  const num = parseFloat(amount.replace(/,/g, ''));
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function extractInvoiceData(doc, text) {
  const data = {
    invoiceNumber: extractPattern(text, /invoice\s*#?\s*:?\s*([A-Z0-9-]+)/i) || extractPattern(text, /inv\s*#?\s*:?\s*([A-Z0-9-]+)/i),
    date: extractDate(text),
    dueDate: extractDate(text, /due\s*(?:date)?\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i),
    amount: extractMoneyAmount(text),
    tax: extractTax(text),
    total: extractTotal(text),
    lineItems: extractLineItems(text),
    billTo: extractBillTo(text),
    shipTo: extractShipTo(text)
  };

  return cleanObject(data);
}

function extractReceiptData(doc, text) {
  const data = {
    transactionId: extractPattern(text, /transaction\s*#?\s*:?\s*([A-Z0-9-]+)/i) || extractPattern(text, /receipt\s*#?\s*:?\s*([A-Z0-9-]+)/i),
    date: extractDate(text),
    time: extractPattern(text, /(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i),
    paymentMethod: extractPaymentMethod(text),
    amount: extractMoneyAmount(text),
    subtotal: extractSubtotal(text),
    tax: extractTax(text),
    total: extractTotal(text),
    items: extractLineItems(text)
  };

  return cleanObject(data);
}

function extractIDData(doc, text) {
  const data = {
    fullName: extractName(text),
    dateOfBirth: extractDateOfBirth(text),
    issueDate: extractPattern(text, /(?:issue[ds]|issued)\s*(?:date)?\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i),
    expirationDate: extractDateOfBirth(text, /(?:expir(?:y|ation)?|expires?)\s*(?:date)?\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i),
    documentNumber: extractPattern(text, /(?:document\s*#?|id\s*#?|license\s*#?)\s*:?\s*([A-Z0-9-]+)/i),
    address: extractAddress(text),
    gender: extractGender(text),
    height: extractPattern(text, /height\s*:?\s*(\d+['"]?\s*\d*)/i),
    weight: extractPattern(text, /weight\s*:?\s*(\d+\s*(?:lbs?|kg))/i),
    eyeColor: extractPattern(text, /eye\s*(?:color)?\s*:?\s*([A-Z]+)/i),
    hairColor: extractPattern(text, /hair\s*(?:color)?\s*:?\s*([A-Z]+)/i)
  };

  return cleanObject(data);
}

function extractContractData(doc, text) {
  const data = {
    title: extractPattern(text, /^(.+?)\s*(?:agreement|contract)/im) || extractPattern(text, /(?:this\s+)?([^\n]+(?:\n[^\n]+){0,2})/),
    parties: extractParties(text),
    effectiveDate: extractDate(text),
    term: extractTerm(text),
    terminationDate: extractPattern(text, /terminat(?:e|ion)\s*(?:date)?\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i),
    signatures: extractSignatures(text),
    governingLaw: extractPattern(text, /(?:governing\s+law|jurisdiction)\s*:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i)
  };

  return cleanObject(data);
}

function extractGenericData(doc, text) {
  const data = {
    dates: extractAllDates(text),
    emails: text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [],
    phones: text.match(/(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g) || [],
    urls: text.match(/https?:\/\/[^\s]+/g) || [],
    addresses: extractAllAddresses(text),
    monetaryValues: extractAllMoney(text)
  };

  return cleanObject(data);
}

function extractPattern(text, regex) {
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

function extractDate(text, regex = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/) {
  const match = text.match(regex);
  return match ? match[1] : null;
}

function extractDateOfBirth(text, regex = /(?:dob|date\s*of\s*birth|born)\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i) {
  return extractPattern(text, regex);
}

function extractMoneyAmount(text) {
  const match = text.match(/\$[\d,]+\.?\d*/);
  return match ? match[0] : null;
}

function extractTax(text) {
  const match = text.match(/(?:tax|gst|hst|vat)\s*:?\s*\$?([\d,]+\.?\d*)/i);
  return match ? `$${match[1]}` : null;
}

function extractTotal(text) {
  const match = text.match(/(?:total|amount\s*due|grand\s*total)\s*:?\s*\$?([\d,]+\.?\d*)/i);
  return match ? `$${match[1]}` : null;
}

function extractSubtotal(text) {
  const match = text.match(/(?:subtotal|sub\s*total)\s*:?\s*\$?([\d,]+\.?\d*)/i);
  return match ? `$${match[1]}` : null;
}

function extractBillTo(text) {
  const match = text.match(/bill\s*(?:to|for)\s*:?\s*([^\n]+(?:\n[^\n]+){0,2})/i);
  return match ? match[1].replace(/\n/g, ', ').trim() : null;
}

function extractShipTo(text) {
  const match = text.match(/ship\s*(?:to)?\s*:?\s*([^\n]+(?:\n[^\n]+){0,2})/i);
  return match ? match[1].replace(/\n/g, ', ').trim() : null;
}

function extractPaymentMethod(text) {
  const methods = ['cash', 'credit', 'debit', 'check', 'cheque', 'card', 'visa', 'mastercard', 'amex', 'paypal'];
  for (const method of methods) {
    if (text.toLowerCase().includes(method)) {
      return method.charAt(0).toUpperCase() + method.slice(1);
    }
  }
  return null;
}

function extractLineItems(text) {
  const items = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const match = line.match(/^\s*(.+?)\s+\$?([\d,]+\.?\d*)\s*$/);
    if (match && match[1].length > 2) {
      items.push({ description: match[1].trim(), amount: `$${match[2]}` });
    }
  }

  return items.slice(0, 20);
}

function extractName(text) {
  const doc = require('compromise');
  const doc2 = doc(text);
  const people = doc2.people().out('array');
  return people.length > 0 ? people[0] : null;
}

function extractGender(text) {
  const male = /\b(male|man|m\b)/i;
  const female = /\b(female|woman|f\b)/i;

  if (male.test(text) && !female.test(text)) return 'Male';
  if (female.test(text)) return 'Female';
  return null;
}

function extractAddress(text) {
  // Try multiple address patterns (Indian format)
  const patterns = [
    // Full address with house/building number, street, area, city, state, pincode
    /(?:address\s*:?\s*)?([^,\n]+(?:,\s*[^,\n]+){2,}(?:,\s*)?(?:\d{6}|\d{3}\s?\d{3}))/i,
    // Address with pincode
    /([^,\n]+(?:,\s*[^,\n]+)+(?:,\s*)?\d{6})/i,
    // Multi-line address (up to 3 lines)
    /(?:address\s*:?\s*)?([^\n]+\n[^\n]+(?:\n[^\n]+)?(?:\n)?\d{6})/i,
    // US-style address (fallback)
    /\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr)[\s,]+[\w\s]+[\s,]*\d{5}/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let address = match[1] || match[0];
      // Clean up address
      address = address
        .replace(/\s+/g, ' ')
        .replace(/\n/g, ', ')
        .trim();
      return address;
    }
  }

  // Extract any text block that looks like an address (contains common keywords)
  const addressKeywords = /(?:house|flat|building|apartment|street|road|lane|nagar|colony|sector|phase|block|near|pin|pincode|city|state|district)/i;
  const lines = text.split('\n');
  let addressLines = [];
  let capturing = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (addressKeywords.test(line) || /\d{6}/.test(line)) {
      capturing = true;
    }

    if (capturing && line.length > 5) {
      addressLines.push(line);

      // Stop after finding pincode
      if (/\d{6}/.test(line)) {
        break;
      }

      // Or after 4 lines
      if (addressLines.length >= 4) {
        break;
      }
    }
  }

  if (addressLines.length > 0) {
    return addressLines.join(', ');
  }

  return null;
}

function extractParties(text) {
  const parties = [];
  const match = text.match(/between\s+([^\n]+)\s+and\s+([^\n]+)/i);
  if (match) {
    parties.push(match[1].trim(), match[2].trim());
  }
  return parties;
}

function extractTerm(text) {
  const match = text.match(/(?:term|duration|period)\s*:?\s*(\d+\s*(?:months?|years?|days?))/i);
  return match ? match[1] : null;
}

function extractSignatures(text) {
  const sigs = [];
  const matches = text.match(/(?:signature|signed)\s*:?\s*([^\n]+)/gi);
  if (matches) {
    for (const match of matches) {
      const name = match.replace(/(?:signature|signed)\s*:?\s*/i, '').trim();
      if (name) sigs.push(name);
    }
  }
  return sigs;
}

function extractAllDates(text) {
  const dateRegex = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g;
  return text.match(dateRegex) || [];
}

function extractAllAddresses(text) {
  const regex = /\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr)[\s,]+[\w\s]+[\s,]*\d{5}/gi;
  return text.match(regex) || [];
}

function extractAllMoney(text) {
  const matches = text.match(/\$[\d,]+\.?\d*/g);
  return matches ? [...new Set(matches)] : [];
}

function cleanObject(obj) {
  for (const key in obj) {
    if (obj[key] === null || obj[key] === undefined || obj[key] === '' || obj[key] === []) {
      delete obj[key];
    } else if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      cleanObject(obj[key]);
      if (Object.keys(obj[key]).length === 0) {
        delete obj[key];
      }
    }
  }
  return obj;
}

module.exports = {
  extractStructuredData,
  extractAadhaarDataFromBothSides
};