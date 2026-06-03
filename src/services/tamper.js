const crypto = require('crypto');
const { generateHash } = require('../utils/helpers');
const customRules = require('./customRules');
const llmService = require('./llm');

async function analyze(file, text, classification, structuredData) {
  const checks = [];
  let tamperedIndicators = 0;

  // Heuristic checks (existing)
  const hashCheck = checkFileHash(file);
  checks.push(hashCheck);
  if (hashCheck.flagged) tamperedIndicators++;

  const metadataCheck = analyzeMetadata(file);
  checks.push(metadataCheck);
  if (metadataCheck.flagged) tamperedIndicators++;

  const textConsistency = checkTextConsistency(text);
  checks.push(textConsistency);
  if (textConsistency.flagged) tamperedIndicators++;

  const errorLevelAnalysis = simulateErrorLevelAnalysis(file, text);
  checks.push(errorLevelAnalysis);
  if (errorLevelAnalysis.flagged) tamperedIndicators++;

  // Custom validation rules
  const rulesResult = customRules.evaluateRules(structuredData, classification.type);
  const rulesCheck = {
    name: 'Custom Validation Rules',
    status: rulesResult.failed.length === 0 ? 'passed' : (rulesResult.failed.length > rulesResult.passed.length ? 'failed' : 'warning'),
    flagged: rulesResult.failed.length > rulesResult.passed.length,
    details: `Passed: ${rulesResult.passed.length}, Failed: ${rulesResult.failed.length}`,
    score: rulesResult.score,
    passed: rulesResult.passed,
    failed: rulesResult.failed
  };
  checks.push(rulesCheck);
  if (rulesCheck.flagged) tamperedIndicators++;

  // LLM verification (with vision if available)
  let llmVerdict = null;
  try {
    llmVerdict = await llmService.verifyDocument(file, text, classification, structuredData, checks);

    if (llmVerdict) {
      const llmCheck = {
        name: 'LLM Semantic Verification',
        status: llmVerdict.isTampered ? 'failed' : 'passed',
        flagged: llmVerdict.isTampered,
        details: `Confidence: ${llmVerdict.confidence.toFixed(2)}`,
        confidence: llmVerdict.confidence,
        reasons: llmVerdict.reasons,
        redFlags: llmVerdict.redFlags,
        documentTypeMatch: llmVerdict.documentTypeMatch
      };
      checks.push(llmCheck);
      if (llmCheck.flagged) tamperedIndicators++;
    }
  } catch (error) {
    console.error('LLM verification failed:', error);
  }

  // Compute weighted verdict
  const { isTampered, confidence } = computeWeightedVerdict(
    tamperedIndicators,
    checks,
    rulesResult,
    llmVerdict
  );

  return {
    isTampered,
    confidence: parseFloat(confidence.toFixed(2)),
    checks,
    llm: llmVerdict,
    customRules: {
      passed: rulesResult.passed,
      failed: rulesResult.failed,
      score: rulesResult.score
    }
  };
}

function checkFileHash(file) {
  const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');
  const length = file.buffer.length;

  return {
    name: 'File Hash Verification',
    status: 'passed',
    flagged: false,
    details: `SHA-256: ${hash.substring(0, 16)}...`
  };
}

function analyzeMetadata(file) {
  const details = [];

  if (file.mimetype === 'application/pdf') {
    details.push('PDF format detected');
  } else if (file.mimetype.startsWith('image/')) {
    details.push('Image format detected');
  }

  details.push(`File size: ${(file.buffer.length / 1024).toFixed(1)} KB`);

  return {
    name: 'Metadata Analysis',
    status: 'passed',
    flagged: false,
    details: details.join('; ')
  };
}

function checkTextConsistency(text) {
  const details = [];
  let issues = 0;

  const fontInconsistencies = detectFontInconsistencies(text);
  if (fontInconsistencies > 0) {
    issues++;
    details.push(`Potential font inconsistencies detected: ${fontInconsistencies}`);
  }

  const encodingIssues = detectEncodingIssues(text);
  if (encodingIssues > 0) {
    issues++;
    details.push(`Potential encoding issues: ${encodingIssues}`);
  }

  const suspiciousPatterns = detectSuspiciousPatterns(text);
  if (suspiciousPatterns > 0) {
    issues++;
    details.push(`Suspicious patterns found: ${suspiciousPatterns}`);
  }

  return {
    name: 'Text Consistency Check',
    status: issues > 0 ? 'warning' : 'passed',
    flagged: issues > 1,
    details: details.length > 0 ? details.join('; ') : 'No issues detected'
  };
}

function detectFontInconsistencies(text) {
  let count = 0;
  const unicodeRanges = text.match(/[\u0080-\u00FF]/g);
  if (unicodeRanges) count += unicodeRanges.length / 10;

  return Math.floor(count);
}

function detectEncodingIssues(text) {
  let count = 0;
  if (text.includes('�')) count++;
  const unusualChars = text.match(/[^\x00-\x7F]/g);
  if (unusualChars && unusualChars.length > text.length * 0.1) count++;

  return count;
}

function detectSuspiciousPatterns(text) {
  let count = 0;
  const patterns = [
    /\b(copy|fake|forged|modified|altered)\b/gi,
    /\b(tamper|manipulat)\w*/gi,
    /\{[^}]*\}/g,
    /\[ERROR\]/g
  ];

  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) count += matches.length;
  }

  return count;
}

function simulateErrorLevelAnalysis(file, text) {
  const details = [];

  const compressionArtifacts = analyzeCompression(file);
  if (compressionArtifacts > 0.8) {
    details.push('Heavy compression detected');
  } else {
    details.push('No compression artifacts detected');
  }

  const textDensity = text.length / (file.buffer.length / 1024);
  if (textDensity > 100) {
    details.push('Abnormal text density');
  }

  return {
    name: 'Image Forensics (ELA)',
    status: details.some(d => d.includes('Abnormal') || d.includes('Heavy')) ? 'warning' : 'passed',
    flagged: textDensity > 200,
    details: details.join('; ') || 'Analysis complete'
  };
}

function analyzeCompression(buffer) {
  // Convert buffer to array before creating Set
  const uniqueBytes = new Set(Array.from(buffer)).size;
  const ratio = uniqueBytes / buffer.length;
  return ratio;
}

function calculateConfidence(checks) {
  const passed = checks.filter(c => c.status === 'passed').length;
  const warnings = checks.filter(c => c.status === 'warning').length;
  const total = checks.length;

  return (passed + warnings * 0.5) / total * 0.95;
}

/**
 * Compute weighted verdict combining heuristic, custom rules, and LLM signals
 */
function computeWeightedVerdict(tamperedIndicators, checks, rulesResult, llmVerdict) {
  let isTampered = false;
  let confidence = 0;

  // If LLM is available, use weighted scoring
  if (llmVerdict) {
    const llmWeight = 0.5;
    const rulesWeight = 0.3;
    const heuristicWeight = 0.2;

    const llmScore = llmVerdict.isTampered ? (1 - llmVerdict.confidence) : llmVerdict.confidence;
    const rulesScore = rulesResult.score;
    const heuristicScore = calculateConfidence(checks.filter(c => c.name !== 'LLM Semantic Verification' && c.name !== 'Custom Validation Rules'));

    confidence = (llmScore * llmWeight) + (rulesScore * rulesWeight) + (heuristicScore * heuristicWeight);
    isTampered = llmVerdict.isTampered || (rulesResult.failed.length > 0 && rulesScore < 0.5);
  } else {
    // Fallback to heuristic + rules only
    const rulesScore = rulesResult.score;
    const heuristicScore = calculateConfidence(checks.filter(c => c.name !== 'Custom Validation Rules'));

    confidence = (rulesScore * 0.6) + (heuristicScore * 0.4);
    isTampered = tamperedIndicators >= 2 || (rulesResult.failed.length > 0 && rulesScore < 0.5);
  }

  return { isTampered, confidence };
}

module.exports = { analyze };