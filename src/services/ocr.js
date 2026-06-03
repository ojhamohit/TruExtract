const pdfParse = require('pdf-parse');

async function extractText(file) {
  const mimetype = file.mimetype;

  if (mimetype === 'application/pdf') {
    return await extractFromPDF(file.buffer);
  } else if (mimetype.startsWith('image/')) {
    return await extractFromImage(file.buffer);
  }

  return '';
}

async function extractFromPDF(buffer) {
  try {
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (error) {
    console.error('PDF parsing error:', error);
    return '';
  }
}

async function extractFromImage(buffer) {
  try {
    const { default: Tesseract } = await import('tesseract.js');
    const result = await Tesseract.recognize(buffer, 'eng', {
      logger: () => {}
    });
    return result.data.text || '';
  } catch (error) {
    console.error('OCR error:', error);
    return '';
  }
}

async function getConfidence(file) {
  const mimetype = file.mimetype;

  if (mimetype === 'application/pdf') {
    try {
      const data = await pdfParse(file.buffer);
      const pageCount = data.numpages;
      return pageCount > 0 ? Math.min(0.95, 0.7 + (pageCount * 0.02)) : 0.5;
    } catch {
      return 0.5;
    }
  } else if (mimetype.startsWith('image/')) {
    try {
      const { default: Tesseract } = await import('tesseract.js');
      const result = await Tesseract.recognize(file.buffer, 'eng', { logger: () => {} });
      return result.data.confidence / 100;
    } catch {
      return 0.5;
    }
  }
  return 0;
}

module.exports = { extractText, getConfidence };