/**
 * Custom validators for document-specific business logic
 */

/**
 * Verhoeff algorithm for Aadhaar number validation
 * @param {string} num - 12-digit Aadhaar number
 * @returns {boolean}
 */
function verhoeffChecksum(num) {
  if (!num || typeof num !== 'string') return false;
  
  const d = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
  ];
  
  const p = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
  ];
  
  const inv = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];
  
  let c = 0;
  const reversed = num.split('').reverse();
  
  for (let i = 0; i < reversed.length; i++) {
    c = d[c][p[(i % 8)][parseInt(reversed[i])]];
  }
  
  return c === 0;
}

/**
 * Luhn algorithm for card number validation
 * @param {string} num - Card number
 * @returns {boolean}
 */
function luhnChecksum(num) {
  if (!num || typeof num !== 'string') return false;
  
  let sum = 0;
  let isEven = false;
  
  for (let i = num.length - 1; i >= 0; i--) {
    let digit = parseInt(num[i]);
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  return sum % 10 === 0;
}

/**
 * Validate PAN card structure (4th char must match person/entity type)
 * @param {string} pan - 10-character PAN
 * @returns {boolean}
 */
function validatePANStructure(pan) {
  if (!pan || pan.length !== 10) return false;
  
  // 4th character should be P for individual, C for company, etc.
  const fourthChar = pan[3];
  const validChars = ['P', 'C', 'H', 'F', 'A', 'T', 'B', 'L', 'J', 'G'];
  
  return validChars.includes(fourthChar);
}

/**
 * Validate net pay calculation for salary slips
 * @param {object} data - Structured salary slip data
 * @returns {boolean}
 */
function validateNetPayCalculation(data) {
  if (!data) return false;
  
  const { earnings, deductions, netPay } = data;
  
  if (!earnings || !deductions || !netPay) return false;
  
  const totalEarnings = earnings.reduce((sum, item) => {
    const amount = parseFloat(item.amount.replace(/[₹,]/g, ''));
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);
  
  const totalDeductions = deductions.reduce((sum, item) => {
    const amount = parseFloat(item.amount.replace(/[₹,]/g, ''));
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);
  
  const expectedNetPay = totalEarnings - totalDeductions;
  const actualNetPay = parseFloat(netPay.replace(/[₹,]/g, ''));
  
  // Allow 1 rupee tolerance for rounding
  return Math.abs(expectedNetPay - actualNetPay) <= 1;
}

module.exports = {
  verhoeffChecksum,
  luhnChecksum,
  validatePANStructure,
  validateNetPayCalculation
};
