# Training Data for Document Verification

## Overview

This directory contains training samples, annotations, and patterns to improve the LLM's document verification accuracy through **few-shot learning** and **pattern matching**.

## Directory Structure

```
training/
├── samples/          # Sample documents (PDFs, images)
│   ├── aadhaar/
│   │   ├── genuine/
│   │   └── tampered/
│   ├── pan/
│   │   ├── genuine/
│   │   └── tampered/
│   └── salary_slip/
│       ├── genuine/
│       └── tampered/
├── annotations/      # JSON annotations for each sample
│   ├── aadhaar/
│   ├── pan/
│   └── salary_slip/
├── patterns/         # Reusable pattern definitions
│   └── known_issues.json
└── feedback/         # User corrections and feedback
    └── corrections.jsonl
```

## How It Works

### 1. Few-Shot Learning
The LLM is provided with **example documents** before analyzing a new one:
- 2-3 genuine examples
- 2-3 tampered examples
- Each with annotations showing what was wrong/right

### 2. Pattern Library
Common tampering patterns stored for quick detection:
- Font mismatches
- Date inconsistencies
- Checksum failures
- Visual artifacts

### 3. Feedback Loop
User corrections are stored and used to improve future predictions.

## Adding Training Samples

### Step 1: Add the Document

Place in appropriate folder:
```bash
training/samples/aadhaar/genuine/sample_001.jpg
training/samples/aadhaar/tampered/fake_001.jpg
```

### Step 2: Create Annotation

Create matching JSON in `annotations/`:
```json
{
  "filename": "sample_001.jpg",
  "documentType": "aadhaar",
  "isTampered": false,
  "issues": [],
  "extractedData": {
    "aadharNumber": "123456789012",
    "name": "John Doe",
    "address": "Full address here"
  },
  "notes": "Clean genuine document, good example"
}
```

### Step 3: Define Patterns (if new issue found)

Add to `patterns/known_issues.json`:
```json
{
  "id": "aadhaar_font_mismatch",
  "type": "visual",
  "description": "Font inconsistency in name field",
  "indicators": ["mixed fonts", "non-standard typography"],
  "severity": "high"
}
```

## File Formats

### Annotation Schema

```json
{
  "filename": "string",
  "documentType": "aadhaar|pan|salary_slip",
  "isTampered": "boolean",
  "confidence": "0-1",
  "issues": [
    {
      "type": "checksum|visual|logical|metadata",
      "field": "field name",
      "description": "what's wrong",
      "severity": "low|medium|high"
    }
  ],
  "extractedData": {},
  "genuineReason": "why it's genuine (if applicable)",
  "tamperedReason": "why it's tampered (if applicable)",
  "notes": "additional context"
}
```

### Feedback Schema

```jsonl
{"documentId": "uuid", "userCorrection": {"isTampered": true}, "originalPrediction": {"isTampered": false}, "reason": "Missed checksum error", "timestamp": "ISO-8601"}
```

## Usage

The training system is automatically loaded when processing documents. You can:

1. **Add samples** → Improves few-shot learning
2. **Add patterns** → Faster detection of known issues
3. **Review feedback** → Understand model weaknesses

## Quick Start

```bash
# 1. Add a genuine Aadhaar sample
cp your_aadhaar.jpg training/samples/aadhaar/genuine/
nano training/annotations/aadhaar/your_aadhaar.json

# 2. Add a tampered example
cp fake_aadhaar.jpg training/samples/aadhaar/tampered/
nano training/annotations/aadhaar/fake_aadhaar.json

# 3. Restart server to reload training data
npm start
```

## Best Practices

✅ **Do**:
- Include at least 5 genuine + 5 tampered examples per document type
- Add detailed annotations explaining WHY a document is tampered
- Use high-quality images (300+ DPI)
- Include edge cases and subtle tampering

❌ **Don't**:
- Use real personal data (anonymize/use synthetic data)
- Include low-quality scans
- Skip annotations (they're critical for learning)

## Privacy & Security

⚠️ **IMPORTANT**: 
- Never commit real personal documents to git
- Anonymize all training data
- Use synthetic or publicly available samples only
- Add `training/samples/**/*` to `.gitignore`
