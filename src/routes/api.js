const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const ocrService = require('../services/ocr');
const nlpService = require('../services/nlp');
const tamperService = require('../services/tamper');
const validationService = require('../services/validation');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, PNG, JPG, JPEG, and WEBP are allowed.'));
    }
  }
});

// Single document upload (backward compatible)
router.post('/upload', upload.single('document'), async (req, res, next) => {
  const startTime = Date.now();

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No document uploaded' });
    }

    const documentId = uuidv4();
    const result = await processDocument(req.file, documentId);
    const processingTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        documentId,
        filename: req.file.originalname,
        fileType: getFileType(req.file.mimetype),
        fileSize: req.file.size,
        ...result,
        processingTime
      }
    });
  } catch (error) {
    next(error);
  }
});

// Aadhaar front + back upload
router.post('/upload/aadhaar', upload.fields([
  { name: 'front', maxCount: 1 },
  { name: 'back', maxCount: 1 }
]), async (req, res, next) => {
  const startTime = Date.now();

  try {
    if (!req.files || (!req.files.front && !req.files.back)) {
      return res.status(400).json({
        success: false,
        error: 'Please upload at least one side of Aadhaar card (front or back)'
      });
    }

    const documentId = uuidv4();
    const frontFile = req.files.front ? req.files.front[0] : null;
    const backFile = req.files.back ? req.files.back[0] : null;

    const result = await processAadhaarCard(frontFile, backFile, documentId);
    const processingTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        documentId,
        frontFilename: frontFile ? frontFile.originalname : null,
        backFilename: backFile ? backFile.originalname : null,
        ...result,
        processingTime
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Feedback endpoint for user corrections
router.post('/feedback', async (req, res, next) => {
  try {
    const { documentId, userCorrection, originalPrediction, reason } = req.body;

    if (!documentId || !userCorrection) {
      return res.status(400).json({
        success: false,
        error: 'documentId and userCorrection are required'
      });
    }

    const trainingService = require('../services/training');
    trainingService.saveFeedback({
      documentId,
      userCorrection,
      originalPrediction,
      reason
    });

    res.json({
      success: true,
      message: 'Feedback saved. Thank you for helping improve accuracy!'
    });
  } catch (error) {
    next(error);
  }
});

async function processDocument(file, documentId) {
  const text = await ocrService.extractText(file);
  const entities = nlpService.extractEntities(text);
  const classification = nlpService.classifyDocument(text);
  const structuredData = validationService.extractStructuredData(text, classification.type);

  // Pass classification and structuredData to tamper analysis for LLM + rules
  const integrity = await tamperService.analyze(file, text, classification, structuredData);

  return {
    extractedText: text,
    entities,
    classification,
    integrity,
    structuredData
  };
}

async function processAadhaarCard(frontFile, backFile, documentId) {
  let frontText = '';
  let backText = '';
  let frontIntegrity = null;
  let backIntegrity = null;

  // Process front side
  if (frontFile) {
    frontText = await ocrService.extractText(frontFile);
    const frontClassification = { type: 'aadhar', confidence: 0.95 };
    const frontData = validationService.extractStructuredData(frontText, 'aadhar');
    frontIntegrity = await tamperService.analyze(frontFile, frontText, frontClassification, frontData);
  }

  // Process back side
  if (backFile) {
    backText = await ocrService.extractText(backFile);
    const backClassification = { type: 'aadhar', confidence: 0.95 };
    const backData = validationService.extractStructuredData(backText, 'aadhar');
    backIntegrity = await tamperService.analyze(backFile, backText, backClassification, backData);
  }

  // Merge text from both sides
  const combinedText = [frontText, backText].filter(Boolean).join('\n\n');

  // Extract entities and structured data from combined text
  const entities = nlpService.extractEntities(combinedText);
  const structuredData = validationService.extractAadhaarDataFromBothSides(
    frontText,
    backText
  );

  // Combined integrity check
  const combinedIntegrity = {
    front: frontIntegrity,
    back: backIntegrity,
    overall: {
      isTampered: (frontIntegrity?.isTampered || false) || (backIntegrity?.isTampered || false),
      confidence: frontIntegrity && backIntegrity
        ? (frontIntegrity.confidence + backIntegrity.confidence) / 2
        : frontIntegrity?.confidence || backIntegrity?.confidence || 0.5,
      bothSidesProvided: !!(frontFile && backFile)
    }
  };

  return {
    extractedText: {
      front: frontText,
      back: backText,
      combined: combinedText
    },
    entities,
    classification: { type: 'aadhar', confidence: 0.95 },
    integrity: combinedIntegrity,
    structuredData
  };
}

function getFileType(mimetype) {
  const types = {
    'application/pdf': 'pdf',
    'image/png': 'image',
    'image/jpeg': 'image',
    'image/webp': 'image'
  };
  return types[mimetype] || 'unknown';
}

module.exports = router;
