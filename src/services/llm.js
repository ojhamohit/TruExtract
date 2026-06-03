const { GoogleGenAI } = require('@google/genai');
const trainingService = require('./training');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ENABLE_LLM = process.env.ENABLE_LLM_VERIFICATION !== 'false';
const ENABLE_VISION = process.env.ENABLE_VISION !== 'false';
const ENABLE_FEW_SHOT = process.env.ENABLE_FEW_SHOT_LEARNING !== 'false';

let aiClient = null;
let pdfConverter = null;

/**
 * Initialize Gemini client
 */
function getClient() {
  if (!GEMINI_API_KEY) {
    return null;
  }
  
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }
  
  return aiClient;
}

/**
 * Verify document authenticity using Gemini 2.5 Flash Lite
 * @param {object} file - Uploaded file object
 * @param {string} text - OCR extracted text
 * @param {object} classification - Document classification result
 * @param {object} structuredData - Extracted structured data
 * @param {array} heuristicChecks - Existing heuristic checks
 * @returns {object} - LLM verdict
 */
async function verifyDocument(file, text, classification, structuredData, heuristicChecks) {
  if (!ENABLE_LLM) {
    return null;
  }
  
  const client = getClient();
  
  if (!client) {
    console.warn('Gemini API key not configured. Skipping LLM verification.');
    return null;
  }
  
  try {
    // Only enable vision for images (not PDFs) to avoid pdf-to-png issues
    const useVision = ENABLE_VISION && file.mimetype.startsWith('image/');

    let imageData = null;

    if (useVision) {
      imageData = await prepareImageData(file);
    }

    const prompt = buildPrompt(text, classification, structuredData, heuristicChecks);

    const contents = [];

    if (imageData) {
      contents.push({
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType: imageData.mimeType, data: imageData.base64 } }
        ]
      });
    } else {
      contents.push({ role: 'user', parts: [{ text: prompt }] });
    }

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 2048
      }
    });

    let resultText = response.text || '{}';

    // Strip markdown code blocks if present (```json ... ```)
    resultText = resultText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();

    const verdict = JSON.parse(resultText);

    return {
      isTampered: verdict.isTampered || false,
      confidence: verdict.confidence || 0.5,
      reasons: verdict.reasons || [],
      redFlags: verdict.redFlags || [],
      documentTypeMatch: verdict.documentTypeMatch !== false
    };
  } catch (error) {
    console.error('LLM verification error:', error.message);
    console.error('Stack:', error.stack);
    return null;
  }
}

/**
 * Prepare image data for vision API
 */
async function prepareImageData(file) {
  if (file.mimetype.startsWith('image/')) {
    return {
      mimeType: file.mimetype,
      base64: file.buffer.toString('base64')
    };
  }

  // PDF: render first page to PNG (lazy load to avoid startup errors)
  if (file.mimetype === 'application/pdf') {
    try {
      // Lazy load pdf-to-png-converter only when needed
      if (!pdfConverter) {
        pdfConverter = require('pdf-to-png-converter');
      }

      // Call pdfToPng with proper error handling
      const result = await pdfConverter.pdfToPng(file.buffer, {
        viewportScale: 2.0,
        pagesToProcess: [1], // Only convert first page
        strictPagesToProcess: false,
        verbosityLevel: 0
      });

      // Handle different possible return types
      if (result) {
        // Could be array or single object
        const pages = Array.isArray(result) ? result : [result];

        if (pages.length > 0 && pages[0]) {
          const firstPage = pages[0];
          const buffer = firstPage.content || firstPage;

          if (Buffer.isBuffer(buffer)) {
            return {
              mimeType: 'image/png',
              base64: buffer.toString('base64')
            };
          }
        }
      }
    } catch (error) {
      console.error('PDF to PNG conversion failed:', error.message);
      // Continue without vision for PDFs - text-only mode
    }
  }

  return null;
}

/**
 * Build prompt for LLM with few-shot learning
 */
function buildPrompt(text, classification, structuredData, heuristicChecks) {
  const heuristicSummary = heuristicChecks
    .map(c => `- ${c.name}: ${c.status} ${c.flagged ? '(FLAGGED)' : ''}`)
    .join('\n');

  // Check against known patterns
  const knownPatternMatches = trainingService.checkKnownPatterns(text, structuredData);
  const knownPatternsSummary = knownPatternMatches.length > 0
    ? `\n**Known Pattern Matches:**\n${knownPatternMatches.map(p => `- ${p.description} (${p.severity})`).join('\n')}`
    : '';

  // Load few-shot examples if enabled
  const fewShotExamples = ENABLE_FEW_SHOT && classification.type
    ? trainingService.buildFewShotExamples(classification.type)
    : '';

  return `You are a document authenticity verification expert. Analyze this ${classification.type || 'document'} for tampering or forgery.

${fewShotExamples}

**CURRENT DOCUMENT TO ANALYZE:**

**OCR Extracted Text:**
${text.substring(0, 3000)}

**Detected Document Type:** ${classification.type || 'unknown'} (confidence: ${classification.confidence})

**Structured Data Extracted:**
${JSON.stringify(structuredData, null, 2)}

**Heuristic Checks:**
${heuristicSummary}
${knownPatternsSummary}

**Task:**
1. Compare this document against the GENUINE and TAMPERED examples above
2. Check if extracted data is internally consistent (e.g., Aadhaar checksum, name/DOB coherence, salary math)
3. Look for visual tampering signs (if image provided): font mismatches, splice artifacts, uneven spacing, watermark issues
4. Cross-check document type with content
5. Flag any suspicious patterns similar to the TAMPERED examples
6. Note if any known patterns were matched above

**Return JSON only:**
{
  "isTampered": false,
  "confidence": 0.92,
  "reasons": ["Reason 1", "Reason 2"],
  "redFlags": [],
  "documentTypeMatch": true
}

- isTampered: boolean (true if document is likely tampered/forged)
- confidence: 0-1 (your confidence in this verdict)
- reasons: array of strings explaining why document is authentic OR tampered
- redFlags: array of specific issues found (empty if clean)
- documentTypeMatch: boolean (does content match detected type?)`;
}

module.exports = { verifyDocument };
