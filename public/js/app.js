document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const fileInfo = document.getElementById('fileInfo');
  const fileName = document.getElementById('fileName');
  const fileSize = document.getElementById('fileSize');
  const btnRemove = document.getElementById('btnRemove');
  const btnProcess = document.getElementById('btnProcess');
  const loadingSection = document.getElementById('loadingSection');
  const resultsSection = document.getElementById('resultsSection');
  const errorSection = document.getElementById('errorSection');
  const errorMessage = document.getElementById('errorMessage');
  const btnRetry = document.getElementById('btnRetry');
  const btnNewDocument = document.getElementById('btnNewDocument');
  const processingTime = document.getElementById('processingTime');
  const progressText = document.getElementById('progressText');

  let selectedFile = null;

  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  });

  btnRemove.addEventListener('click', (e) => {
    e.stopPropagation();
    clearFile();
  });

  btnProcess.addEventListener('click', processDocument);
  btnRetry.addEventListener('click', () => {
    errorSection.hidden = true;
    resetToUpload();
  });
  btnNewDocument.addEventListener('click', () => {
    resultsSection.hidden = true;
    resetToUpload();
  });

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    });
  });

  document.querySelectorAll('.btn-copy').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.copy;
      const text = document.getElementById(targetId).textContent;
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy', 2000);
      });
    });
  });

  function handleFileSelect(file) {
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      showError('Invalid file type. Please upload a PDF, PNG, JPG, JPEG, or WEBP file.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showError('File too large. Maximum size is 10MB.');
      return;
    }

    selectedFile = file;
    dropzone.hidden = true;
    fileInfo.hidden = false;
    fileName.textContent = file.name;
    fileSize.textContent = formatBytes(file.size);
    btnProcess.disabled = false;
  }

  function clearFile() {
    selectedFile = null;
    fileInput.value = '';
    dropzone.hidden = false;
    fileInfo.hidden = true;
    btnProcess.disabled = true;
  }

  function resetToUpload() {
    clearFile();
    errorSection.hidden = true;
  }

  async function processDocument() {
    if (!selectedFile) return;

    document.getElementById('uploadSection').hidden = true;
    loadingSection.hidden = false;
    updateProgress('Uploading document...');

    const formData = new FormData();
    formData.append('document', selectedFile);

    try {
      updateProgress('Extracting text with OCR...');
      await simulateDelay(800);

      updateProgress('Analyzing content with NLP...');
      await simulateDelay(600);

      updateProgress('Detecting tampering...');
      await simulateDelay(500);

      updateProgress('Validating data...');
      await simulateDelay(400);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Processing failed');
      }

      displayResults(result.data);
    } catch (error) {
      showError(error.message);
    }
  }

  function displayResults(data) {
    loadingSection.hidden = true;
    resultsSection.hidden = false;

    processingTime.textContent = `Processed in ${data.processingTime}ms`;

    document.getElementById('extractedText').textContent = data.extractedText || 'No text extracted';

      //renderEntities(data.entities);

    renderClassification(data.classification);

    renderIntegrity(data.integrity);

    document.getElementById('structuredData').textContent = JSON.stringify(data.structuredData, null, 2);
  }

  function renderEntities(entities) {
    const grid = document.getElementById('entitiesGrid');
    const entityTypes = [
      { key: 'names', label: 'Names' },
      { key: 'dates', label: 'Dates' },
      { key: 'emails', label: 'Emails' },
      { key: 'phones', label: 'Phones' },
      { key: 'addresses', label: 'Addresses' },
      { key: 'money', label: 'Monetary Values' }
    ];

    grid.innerHTML = '';

    entityTypes.forEach(({ key, label }) => {
      const values = entities[key];
      if (values && values.length > 0) {
        const card = document.createElement('div');
        card.className = 'entity-card';
        card.innerHTML = `
          <div class="entity-label">${label}</div>
          <div class="entity-values">
            ${values.slice(0, 10).map(v => `<span class="entity-tag">${escapeHtml(v)}</span>`).join('')}
          </div>
        `;
        grid.appendChild(card);
      }
    });

    if (grid.children.length === 0) {
      grid.innerHTML = '<p style="color: var(--gray-400);">No entities detected</p>';
    }
  }

  function renderClassification(classification) {
    const container = document.getElementById('classificationResult');
    container.innerHTML = `
      <div class="classification-type">${classification.type}</div>
      <div class="classification-confidence">${Math.round(classification.confidence * 100)}% <span>confidence</span></div>
    `;
  }

  function renderIntegrity(integrity) {
    const container = document.getElementById('integrityResult');
    const statusClass = integrity.isTampered ? 'failed' : 'passed';
    const statusText = integrity.isTampered ? 'Tampering Detected' : 'Document Appears Authentic';

    container.innerHTML = `
      <div class="integrity-status ${statusClass}">${statusText}</div>
      <p style="color: var(--gray-400); margin-bottom: 1rem;">Confidence: ${Math.round(integrity.confidence * 100)}%</p>
      <div class="checks-list">
        ${integrity.checks.map(check => `
          <div class="check-item">
            <svg class="check-icon ${check.status}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              ${check.status === 'passed'
                ? '<polyline points="20 6 9 17 4 12"></polyline>'
                : check.status === 'warning'
                  ? '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>'
                  : '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>'
              }
            </svg>
            <div class="check-details">
              <h4>${escapeHtml(check.name)}</h4>
              <p>${escapeHtml(check.details)}</p>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function showError(message) {
    loadingSection.hidden = true;
    resultsSection.hidden = true;
    document.getElementById('uploadSection').hidden = true;
    errorSection.hidden = false;
    errorMessage.textContent = message;
  }

  function updateProgress(text) {
    if (progressText) {
      progressText.textContent = text;
    }
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function simulateDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
});