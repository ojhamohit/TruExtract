const fs = require('fs');
const path = require('path');
const validators = require('./customValidators');

let rulesCache = null;

/**
 * Load validation rules from config
 */
function loadRules() {
  if (rulesCache) return rulesCache;
  
  try {
    const rulesPath = path.join(__dirname, '../config/validationRules.json');
    const rulesData = fs.readFileSync(rulesPath, 'utf8');
    rulesCache = JSON.parse(rulesData);
    return rulesCache;
  } catch (error) {
    console.error('Failed to load validation rules:', error);
    return {};
  }
}

/**
 * Evaluate all rules for a document type against structured data
 * @param {object} structuredData - Extracted structured data
 * @param {string} documentType - Type of document (aadhar, pan, salary_slip)
 * @returns {object} - { passed: [], failed: [], score: 0-1 }
 */
function evaluateRules(structuredData, documentType) {
  const rules = loadRules();
  const documentRules = rules[documentType];
  
  if (!documentRules || !documentRules.rules) {
    return { passed: [], failed: [], score: 1.0 };
  }
  
  const passed = [];
  const failed = [];
  
  for (const rule of documentRules.rules) {
    const result = evaluateRule(rule, structuredData);
    
    if (result.passed) {
      passed.push({ id: rule.id, message: rule.message });
    } else {
      failed.push({ id: rule.id, message: rule.message, reason: result.reason });
    }
  }
  
  const total = passed.length + failed.length;
  const score = total > 0 ? passed.length / total : 1.0;
  
  return { passed, failed, score: parseFloat(score.toFixed(2)) };
}

/**
 * Evaluate a single rule
 */
function evaluateRule(rule, data) {
  const fieldValue = data[rule.field];
  
  switch (rule.type) {
    case 'required':
      return evaluateRequired(fieldValue, rule);
    
    case 'regex':
      return evaluateRegex(fieldValue, rule);
    
    case 'checksum':
      return evaluateChecksum(fieldValue, rule);
    
    case 'enum':
      return evaluateEnum(fieldValue, rule);
    
    case 'custom':
      return evaluateCustom(data, rule);
    
    case 'length':
      return evaluateLength(fieldValue, rule);
    
    case 'range':
      return evaluateRange(fieldValue, rule);
    
    default:
      return { passed: true };
  }
}

function evaluateRequired(value, rule) {
  const isPresent = value !== null && value !== undefined && value !== '';
  return {
    passed: isPresent,
    reason: isPresent ? null : `${rule.field} is missing`
  };
}

function evaluateRegex(value, rule) {
  if (!value) return { passed: false, reason: 'Field is empty' };
  
  const regex = new RegExp(rule.pattern);
  const matches = regex.test(value);
  
  return {
    passed: matches,
    reason: matches ? null : `${rule.field} does not match pattern ${rule.pattern}`
  };
}

function evaluateChecksum(value, rule) {
  if (!value) return { passed: false, reason: 'Field is empty' };
  
  let result = false;
  
  if (rule.algorithm === 'verhoeff') {
    result = validators.verhoeffChecksum(value);
  } else if (rule.algorithm === 'luhn') {
    result = validators.luhnChecksum(value);
  }
  
  return {
    passed: result,
    reason: result ? null : `${rule.algorithm} checksum validation failed`
  };
}

function evaluateEnum(value, rule) {
  if (!value) return { passed: false, reason: 'Field is empty' };
  
  const isValid = rule.values.includes(value);
  
  return {
    passed: isValid,
    reason: isValid ? null : `${value} not in allowed values: ${rule.values.join(', ')}`
  };
}

function evaluateCustom(data, rule) {
  const validatorFn = validators[rule.validator];
  
  if (!validatorFn) {
    return { passed: false, reason: `Validator ${rule.validator} not found` };
  }
  
  const result = validatorFn(data);
  
  return {
    passed: result,
    reason: result ? null : `Custom validation ${rule.validator} failed`
  };
}

function evaluateLength(value, rule) {
  if (!value) return { passed: false, reason: 'Field is empty' };
  
  const len = value.length;
  
  if (rule.min !== undefined && len < rule.min) {
    return { passed: false, reason: `Length ${len} < minimum ${rule.min}` };
  }
  
  if (rule.max !== undefined && len > rule.max) {
    return { passed: false, reason: `Length ${len} > maximum ${rule.max}` };
  }
  
  return { passed: true };
}

function evaluateRange(value, rule) {
  if (value === null || value === undefined) {
    return { passed: false, reason: 'Field is empty' };
  }
  
  const num = parseFloat(value);
  
  if (isNaN(num)) {
    return { passed: false, reason: 'Field is not a number' };
  }
  
  if (rule.min !== undefined && num < rule.min) {
    return { passed: false, reason: `Value ${num} < minimum ${rule.min}` };
  }
  
  if (rule.max !== undefined && num > rule.max) {
    return { passed: false, reason: `Value ${num} > maximum ${rule.max}` };
  }
  
  return { passed: true };
}

module.exports = { evaluateRules };
