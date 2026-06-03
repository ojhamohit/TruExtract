const { GoogleGenAI } = require('@google/genai');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ENABLE_LLM = process.env.ENABLE_LLM_VERIFICATION !== 'false';
const ENABLE_VISION = process.env.ENABLE_VISION !== 'false';

let aiClient = null;

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
 * Verify document authenticity using Gemini 2.5 Flash
 * SIMPLIFIED VERSION: Vision only for images, text-only for PDFs
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
    const useVision = ENABLE_VISION && file.mimetype.startsWith('image/');
    
    const prompt = buildPrompt(text, classification, structuredData, heuristicChecks);
    
    const contents = [];
    
    if (useVision) {
      // Vision support only for images (not PDFs to avoid pdf-to-png issues)
      contents.push({
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType: file.mimetype, data: file.buffer.toString('base64') } }
        ]
      });
    } else {
      // Text-only mode for PDFs
      contents.push({ role: 'user', parts: [{ text: prompt }] });
    }
    
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    });
    
    const resultText = response.text || '{}';
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
    return null;
  }
}

/**
 * Build prompt for LLM
 */
function buildPrompt(text, classification, structuredData, heuristicChecks) {
  const heuristicSummary = heuristicChecks
    .map(c => `- ${c.name}: ${c.status} ${c.flagged ? '(FLAGGED)' : ''}`)
    .join('\n');
  
  return `You are a document authenticity verification expert. Analyze this ${classification.type || 'document'} for tampering or forgery.

**OCR Extracted Text:**
${text.substring(0, 3000)}

**Detected Document Type:** ${classification.type || 'unknown'} (confidence: ${classification.confidence})

**Structured Data Extracted:**
${JSON.stringify(structuredData, null, 2)}

**Heuristic Checks:**
${heuristicSummary}

**Task:**
1. Check if extracted data is internally consistent (e.g., Aadhaar checksum, name/DOB coherence, salary math)
2. Look for visual tampering signs (if image provided): font mismatches, splice artifacts, uneven spacing, watermark issues
3. Cross-check document type with content
4. Flag any suspicious patterns

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
