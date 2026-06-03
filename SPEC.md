# TruExtract - AI-Powered Document Intelligence Platform

## 1. Project Overview

**Project Name:** TruExtract
**Type:** Node.js Web Application
**Core Functionality:** AI-powered document extraction, validation, and tamper detection platform
**Target Users:** Organizations requiring secure document processing, compliance verification, and data extraction

## 2. Technology Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **OCR Processing:** Tesseract.js (client-side) + pdf-parse (server-side)
- **NLP:** Compromise.js for NLP extraction
- **File Handling:** Multer for uploads
- **PDF Processing:** PDF.js for rendering
- **Image Processing:** Sharp for image optimization
- **Frontend:** Vanilla HTML/CSS/JS with modern UI

## 3. Architecture

```
TruExtract/
├── server.js              # Express server entry point
├── package.json
├── src/
│   ├── routes/
│   │   └── api.js          # API endpoints
│   ├── services/
│   │   ├── ocr.js          # OCR processing service
│   │   ├── nlp.js          # NLP extraction service
│   │   ├── tamper.js       # Tamper detection service
│   │   └── validation.js   # Data validation service
│   ├── middleware/
│   │   ├── upload.js       # File upload handling
│   │   └── errorHandler.js # Error handling
│   └── utils/
│       └── helpers.js      # Utility functions
├── public/
│   ├── index.html          # Main UI
│   ├── css/
│   │   └── styles.css      # Styles
│   └── js/
│       └── app.js          # Frontend logic
└── uploads/                # Temporary file storage
```

## 4. Features

### 4.1 Document Upload
- Accept PDF, PNG, JPG, JPEG, WEBP files
- Max file size: 10MB
- Client-side preview generation
- Secure file validation

### 4.2 OCR Processing
- Extract text from images using Tesseract.js
- Extract text from PDFs using pdf-parse
- Support for multiple languages
- Confidence scoring

### 4.3 NLP Content Extraction
- Named entity recognition (names, dates, addresses)
- Document classification: **Aadhar**, **PAN**, **Salary Slip**
- Key-value pair extraction
- Language detection (English, Hindi)

### 4.4 Target Documents
- **Aadhar Card**: Name, Aadhar number (12 digits), Father name, DOB, Gender, Address, VID
- **PAN Card**: Name, PAN number (10 chars), Father's name, DOB, Gender
- **Salary Slip**: Employee name/ID, Designation, Department, Pay period, Earnings, Deductions, Net pay, Bank details, UAN, PF/ESIC numbers

### 4.4 Tamper Detection
- Metadata analysis
- Image forensics (error level analysis simulation)
- Text consistency checking
- Hash verification for integrity

### 4.5 Data Validation
- Schema validation for structured output
- Cross-field validation
- Confidence threshold filtering
- Output formatting

## 5. API Endpoints

### POST /api/upload
Upload and process a document.

**Request:** multipart/form-data with `document` field
**Response:**
```json
{
  "success": true,
  "data": {
    "documentId": "uuid",
    "filename": "original.pdf",
    "fileType": "pdf",
    "fileSize": 102400,
    "extractedText": "...",
    "entities": {
      "names": [],
      "dates": [],
      "addresses": [],
      "emails": [],
      "phones": []
    },
    "classification": {
      "type": "invoice",
      "confidence": 0.92
    },
    "integrity": {
      "isTampered": false,
      "confidence": 0.95,
      "checks": []
    },
    "structuredData": {},
    "processingTime": 2340
  }
}
```

### GET /api/health
Health check endpoint.

## 6. UI Components

- Drag-and-drop upload zone
- File type indicators
- Processing progress indicator
- Results display with tabbed sections:
  - Extracted Text
  - Detected Entities
  - Document Classification
  - Integrity Report
  - Structured Data
- Copy/export functionality

## 7. Security Considerations

- File type validation (magic bytes, not just extension)
- File size limits
- No directory traversal in filenames
- Sanitized file storage
- CSRF protection
- Rate limiting ready structure

## 8. Acceptance Criteria

1. User can upload PDF, PNG, JPG, JPEG, WEBP files via drag-drop or file picker
2. OCR extracts text from documents with >80% accuracy on clear documents
3. NLP identifies entities: names, dates, addresses, emails, phone numbers
4. Classification identifies document type with confidence score
5. Tamper detection reports potential manipulation indicators
6. Results display in organized, tabbed interface
7. Processing completes within 10 seconds for standard documents
8. Error messages are clear and actionable
