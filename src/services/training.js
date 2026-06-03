const fs = require('fs');
const path = require('path');

const TRAINING_DIR = path.join(__dirname, '../../training');

/**
 * Load training samples for few-shot learning
 * @param {string} documentType - Type of document (aadhaar, pan, salary_slip)
 * @param {number} maxSamples - Max examples to load (default: 3 genuine + 3 tampered)
 * @returns {object} - Training examples with annotations
 */
function loadTrainingSamples(documentType, maxSamples = 3) {
  const samples = {
    genuine: [],
    tampered: []
  };

  try {
    // Load genuine samples
    const genuinePath = path.join(TRAINING_DIR, 'samples', documentType, 'genuine');
    const genuineAnnotationsPath = path.join(TRAINING_DIR, 'annotations', documentType);

    if (fs.existsSync(genuinePath)) {
      const files = fs.readdirSync(genuinePath).slice(0, maxSamples);
      
      for (const file of files) {
        const annotationFile = file.replace(/\.(jpg|jpeg|png|pdf)$/i, '.json');
        const annotationPath = path.join(genuineAnnotationsPath, annotationFile);
        
        if (fs.existsSync(annotationPath)) {
          const annotation = JSON.parse(fs.readFileSync(annotationPath, 'utf8'));
          samples.genuine.push(annotation);
        }
      }
    }

    // Load tampered samples
    const tamperedPath = path.join(TRAINING_DIR, 'samples', documentType, 'tampered');
    
    if (fs.existsSync(tamperedPath)) {
      const files = fs.readdirSync(tamperedPath).slice(0, maxSamples);
      
      for (const file of files) {
        const annotationFile = file.replace(/\.(jpg|jpeg|png|pdf)$/i, '.json');
        const annotationPath = path.join(genuineAnnotationsPath, annotationFile);
        
        if (fs.existsSync(annotationPath)) {
          const annotation = JSON.parse(fs.readFileSync(annotationPath, 'utf8'));
          samples.tampered.push(annotation);
        }
      }
    }
  } catch (error) {
    console.warn(`Could not load training samples for ${documentType}:`, error.message);
  }

  return samples;
}

/**
 * Load known tampering patterns
 * @returns {array} - List of known issue patterns
 */
function loadKnownPatterns() {
  try {
    const patternsPath = path.join(TRAINING_DIR, 'patterns', 'known_issues.json');
    
    if (fs.existsSync(patternsPath)) {
      return JSON.parse(fs.readFileSync(patternsPath, 'utf8'));
    }
  } catch (error) {
    console.warn('Could not load known patterns:', error.message);
  }

  return [];
}

/**
 * Build few-shot prompt examples for LLM
 * @param {string} documentType - Type of document
 * @returns {string} - Formatted examples for prompt
 */
function buildFewShotExamples(documentType) {
  const samples = loadTrainingSamples(documentType, 2); // 2 of each type
  let examples = '';

  // Add genuine examples
  if (samples.genuine.length > 0) {
    examples += '\n**GENUINE EXAMPLES (Learn from these):**\n\n';
    
    samples.genuine.forEach((sample, idx) => {
      examples += `Example ${idx + 1}:\n`;
      examples += `Data: ${JSON.stringify(sample.extractedData, null, 2)}\n`;
      examples += `Verdict: GENUINE\n`;
      examples += `Reason: ${sample.genuineReason || 'All fields consistent, checksums valid'}\n\n`;
    });
  }

  // Add tampered examples
  if (samples.tampered.length > 0) {
    examples += '\n**TAMPERED EXAMPLES (Red flags to detect):**\n\n';
    
    samples.tampered.forEach((sample, idx) => {
      examples += `Example ${idx + 1}:\n`;
      examples += `Data: ${JSON.stringify(sample.extractedData, null, 2)}\n`;
      examples += `Verdict: TAMPERED\n`;
      examples += `Issues: ${sample.issues.map(i => i.description).join('; ')}\n`;
      examples += `Reason: ${sample.tamperedReason}\n\n`;
    });
  }

  return examples;
}

/**
 * Check against known patterns
 * @param {string} text - Extracted text
 * @param {object} structuredData - Extracted structured data
 * @returns {array} - Matched patterns
 */
function checkKnownPatterns(text, structuredData) {
  const patterns = loadKnownPatterns();
  const matches = [];

  for (const pattern of patterns) {
    let matched = false;

    // Check text-based indicators
    if (pattern.type === 'visual' || pattern.type === 'text') {
      for (const indicator of pattern.indicators || []) {
        if (new RegExp(indicator, 'i').test(text)) {
          matched = true;
          break;
        }
      }
    }

    // Check field-based indicators
    if (pattern.field && structuredData[pattern.field]) {
      const value = structuredData[pattern.field];
      
      if (pattern.regex && new RegExp(pattern.regex).test(value)) {
        matched = true;
      }
    }

    if (matched) {
      matches.push({
        id: pattern.id,
        description: pattern.description,
        severity: pattern.severity
      });
    }
  }

  return matches;
}

/**
 * Save feedback for continuous improvement
 * @param {object} feedback - User correction data
 */
function saveFeedback(feedback) {
  try {
    const feedbackPath = path.join(TRAINING_DIR, 'feedback', 'corrections.jsonl');
    const feedbackLine = JSON.stringify({
      ...feedback,
      timestamp: new Date().toISOString()
    }) + '\n';

    fs.appendFileSync(feedbackPath, feedbackLine);
  } catch (error) {
    console.error('Could not save feedback:', error.message);
  }
}

module.exports = {
  loadTrainingSamples,
  loadKnownPatterns,
  buildFewShotExamples,
  checkKnownPatterns,
  saveFeedback
};
