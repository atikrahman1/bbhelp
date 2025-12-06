// Get data from URL parameters
const urlParams = new URLSearchParams(window.location.search);
const urls = JSON.parse(decodeURIComponent(urlParams.get('urls') || '[]'));
let endpoints = [];

document.getElementById('files-count').textContent = urls.length;

// Display JS files
const filesList = document.getElementById('files-list');
if (urls.length === 0) {
  filesList.innerHTML = '<div class="no-files">No custom JavaScript files found.</div>';
} else {
  filesList.innerHTML = urls.map((file, index) =>
    '<div class="js-file"><a href="' + escapeHtml(file) + '" target="_blank">' + escapeHtml(file) + '</a><button class="copy-btn" data-index="' + index + '">Copy</button></div>'
  ).join('');

  // Add copy button listeners
  filesList.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const index = parseInt(this.getAttribute('data-index'));
      navigator.clipboard.writeText(urls[index]).then(() => {
        const originalText = this.textContent;
        this.textContent = 'Copied!';
        this.style.background = '#2ecc71';
        setTimeout(() => {
          this.textContent = originalText;
          this.style.background = '#3498db';
        }, 1500);
      });
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', function () {
    const tabName = this.getAttribute('data-tab');
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    this.classList.add('active');
    document.getElementById(tabName + '-tab').classList.add('active');
  });
});

// Copy all URLs
document.getElementById('copy-all-btn').addEventListener('click', function () {
  navigator.clipboard.writeText(urls.join('\n')).then(() => {
    const originalText = this.textContent;
    this.textContent = 'Copied All!';
    setTimeout(() => { this.textContent = originalText; }, 1500);
  });
});

// Extract endpoints
document.getElementById('extract-btn').addEventListener('click', async function () {
  const progress = document.getElementById('progress');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  const extractBtn = this;

  extractBtn.disabled = true;
  extractBtn.textContent = 'Extracting...';
  progress.style.display = 'block';
  endpoints = [];

  for (let i = 0; i < urls.length; i++) {
    try {
      progressText.textContent = "Extracting from file " + (i + 1) + " of " + urls.length + "...";
      progressFill.style.width = (((i + 1) / urls.length) * 100) + "%";

      const response = await fetch(urls[i]);
      const content = await response.text();
      const extracted = extractEndpointsFromJS(content, urls[i]);
      endpoints.push(...extracted);
    } catch (err) {
      console.error('Error fetching', urls[i], err);
    }
  }

  progress.style.display = 'none';
  extractBtn.disabled = false;
  extractBtn.textContent = 'Extract Endpoints';

  // Remove duplicates and sort by confidence
  endpoints = Array.from(new Map(endpoints.map(e => [e.endpoint + e.method, e])).values());
  endpoints.sort((a, b) => b.confidence - a.confidence);

  document.getElementById('endpoint-count').textContent = endpoints.length;
  displayEndpoints();

  // Switch to endpoints tab
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.tab')[1].classList.add('active');
  document.getElementById('endpoints-tab').classList.add('active');
});

// Endpoint extraction logic
function extractEndpointsFromJS(content, sourceFile) {
  const results = [];
  const seenEndpoints = new Set();
  if (!content) return results;

  let baseUrl = '';
  try {
    const url = new URL(sourceFile);
    baseUrl = url.protocol + '//' + url.host;
  } catch (e) { }

  const patterns = {
    apiPath: /["'`](\/api\/[a-zA-Z0-9_\-\/{}:]+)["'`]/g,
    versionedPath: /["'`](\/v\d+\/[a-zA-Z0-9_\-\/{}:]+)["'`]/g,
    fullUrl: /["'`](https?:\/\/[a-zA-Z0-9\-._~:\/?#[\]@!$&'()*+,;=%]+)["'`]/g,
    relativePath: /["'`](\/[a-zA-Z0-9_\-]+(?:\/[a-zA-Z0-9_\-{}:]+)+)["'`]/g,
    graphqlPath: /["'`](\/graphql|\/gql)["'`]/gi,
    fetchCall: /(?:fetch|axios)\s*\(\s*["'`]([^"'`]+)["'`]/g,
    restEndpoint: /["'`](\/(?:users|auth|login|logout|register|profile|settings|posts|comments|products|orders|payments|upload|download|search|items|api|admin|dashboard|account|data)(?:\/[a-zA-Z0-9_\-{}:]*)?(?:\/[a-zA-Z0-9_\-{}:]+)*)["'`]/g
  };

  for (const [patternName, pattern] of Object.entries(patterns)) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      let endpoint = match[1] || match[2];
      if (!endpoint) continue;
      endpoint = endpoint.replace(/["'`]/g, '').split('?')[0].trim();
      if (endpoint.length < 3 || (!endpoint.startsWith('/') && !endpoint.startsWith('http'))) continue;

      const uniqueKey = endpoint + '|' + sourceFile;
      if (seenEndpoints.has(uniqueKey)) continue;
      seenEndpoints.add(uniqueKey);

      let method = 'GET';
      const contextStart = Math.max(0, match.index - 100);
      const contextEnd = Math.min(content.length, match.index + 100);
      const context = content.substring(contextStart, contextEnd);
      if (/axios\.(post|put|patch|delete)/i.test(context)) method = RegExp.$1.toUpperCase();
      else if (/method\s*:\s*["'`](POST|PUT|PATCH|DELETE)["'`]/i.test(context)) method = RegExp.$1;
      else if (endpoint.includes('/login') || endpoint.includes('/register')) method = 'POST';

      let confidence = 50;
      if (endpoint.startsWith('/api/')) confidence += 30;
      if (endpoint.startsWith('/v')) confidence += 25;
      if (/\/(users|auth|login|posts|products|orders|api)/.test(endpoint)) confidence += 15;

      if (confidence >= 30) {
        results.push({ endpoint, method, file: sourceFile, baseUrl, confidence, patternType: patternName });
      }
    }
  }
  results.sort((a, b) => b.confidence - a.confidence);
  return results;
}

function displayEndpoints() {
  const container = document.getElementById('endpoints-list');
  if (endpoints.length === 0) {
    container.innerHTML = '<div class="no-files">No endpoints found.</div>';
    return;
  }

  container.innerHTML = endpoints.map((ep, index) =>
    '<div class="endpoint-item">' +
    '<div class="endpoint-header">' +
    '<div>' +
    '<span class="method ' + ep.method + '">' + ep.method + '</span>' +
    '<span class="endpoint-path">' + escapeHtml(ep.endpoint) + '</span>' +
    '</div>' +
    '<div>' +
    '<span class="confidence ' + (ep.confidence >= 70 ? 'high' : ep.confidence >= 40 ? 'medium' : '') + '">' + ep.confidence + '%</span>' +
    '<button class="copy-btn" data-endpoint-index="' + index + '">Copy</button>' +
    '</div>' +
    '</div>' +
    '<div class="endpoint-meta">' +
    'Source: ' + escapeHtml(ep.file.split('/').pop()) + ' | Pattern: ' + ep.patternType +
    '</div>' +
    '</div>'
  ).join('');

  // Add event listeners
  container.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const index = parseInt(this.getAttribute('data-endpoint-index'));
      const ep = endpoints[index];
      const text = ep.method + ' ' + ep.baseUrl + ep.endpoint;
      navigator.clipboard.writeText(text).then(() => {
        const originalText = this.textContent;
        this.textContent = 'Copied!';
        this.style.background = '#2ecc71';
        setTimeout(() => { this.textContent = originalText; this.style.background = '#3498db'; }, 1500);
      });
    });
  });
}

// Copy all endpoints
document.getElementById('copy-all-endpoints-btn').addEventListener('click', function () {
  const text = endpoints.map(ep => ep.method + ' ' + ep.baseUrl + ep.endpoint).join('\n');
  navigator.clipboard.writeText(text).then(() => {
    const originalText = this.textContent;
    this.textContent = 'Copied All!';
    setTimeout(() => { this.textContent = originalText; }, 1500);
  });
});

// Export endpoints
document.getElementById('export-endpoints-btn').addEventListener('click', function () {
  const json = JSON.stringify(endpoints, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'endpoints.json';
  a.click();
});

// Import secret scanner
import { scanJSFiles } from './secret-scanner.js';

let secrets = [];

// Scan for Secrets button
document.getElementById('scan-secrets-btn').addEventListener('click', async function () {
  const progress = document.getElementById('secrets-progress');
  const progressFill = document.getElementById('secrets-progress-fill');
  const progressText = document.getElementById('secrets-progress-text');
  const scanBtn = this;

  scanBtn.disabled = true;
  scanBtn.textContent = 'Scanning...';
  progress.style.display = 'block';
  secrets = [];

  try {
    secrets = await scanJSFiles(urls, (processed, total) => {
      const percent = (processed / total) * 100;
      progressFill.style.width = percent + '%';
      progressText.textContent = `Scanning file ${processed} of ${total}...`;
    });

    document.getElementById('secrets-count').textContent = secrets.length;
    displaySecrets();

    // Switch to secrets tab
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab')[2].classList.add('active');
    document.getElementById('secrets-tab').classList.add('active');

    // Show completion message
    if (secrets.length === 0) {
      showMessage('✓ Scan completed! No secrets found.');
    } else {
      showMessage(`⚠️ Scan completed! Found ${secrets.length} potential secret(s).`);
    }
  } catch (err) {
    console.error('Scan error:', err);
    document.getElementById('secrets-list').innerHTML =
      '<div class="no-files">Error scanning files. Check console for details.</div>';
  } finally {
    progress.style.display = 'none';
    scanBtn.disabled = false;
    scanBtn.textContent = 'Scan for Secrets';
  }
});

function displaySecrets() {
  const container = document.getElementById('secrets-list');

  if (secrets.length === 0) {
    container.innerHTML = '<div class="no-secrets">✓ No secrets found! All clear.</div>';
    return;
  }

  // Sort by confidence
  secrets.sort((a, b) => b.confidence - a.confidence);

  // Add warning
  let html = '<div class="warning">⚠️ WARNING: Potential secrets detected! Review carefully and rotate any exposed credentials immediately.</div>';

  // Display secrets
  html += secrets.map((secret, index) => {
    const confidenceClass = secret.confidence >= 80 ? 'high' :
      secret.confidence >= 60 ? 'medium' : 'low';
    const fileName = secret.file.split('/').pop();

    return `
      <div class="secret-item">
        <div class="secret-header">
          <span class="secret-type">${escapeHtml(secret.type.replace(/_/g, ' '))}</span>
          <div>
            <span class="confidence ${confidenceClass}">${secret.confidence}% confidence</span>
            <button class="copy-btn" data-secret-index="${index}">Copy</button>
          </div>
        </div>
        <div class="secret-value">${escapeHtml(secret.match)}</div>
        <div class="secret-meta">
          <div class="meta-row">
            <span class="meta-label">File:</span>
            <a href="${escapeHtml(secret.file)}" target="_blank" class="file-link">${escapeHtml(fileName)}</a>
          </div>
          <div class="meta-row">
            <span class="meta-label">Entropy:</span>
            <span>${secret.entropy}</span>
          </div>
          ${secret.context ? `<div class="context">Context: ${escapeHtml(secret.context)}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = html;

  // Add copy button listeners
  container.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const index = parseInt(this.getAttribute('data-secret-index'));
      const secret = secrets[index];
      navigator.clipboard.writeText(secret.match).then(() => {
        const originalText = this.textContent;
        this.textContent = 'Copied!';
        this.style.background = '#2ecc71';
        setTimeout(() => {
          this.textContent = originalText;
          this.style.background = '#3498db';
        }, 1500);
      });
    });
  });
}

// Copy all secrets
document.getElementById('copy-all-secrets-btn').addEventListener('click', function () {
  const text = secrets.map(s => `${s.type}: ${s.match}`).join('\n');
  navigator.clipboard.writeText(text).then(() => {
    const originalText = this.textContent;
    this.textContent = 'Copied All!';
    setTimeout(() => { this.textContent = originalText; }, 1500);
  });
});

// Export secrets
document.getElementById('export-secrets-btn').addEventListener('click', function () {
  const json = JSON.stringify(secrets, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'secrets-found.json';
  a.click();
});


// Show temporary message
function showMessage(msg) {
  const msgDiv = document.createElement('div');
  msgDiv.textContent = msg;
  msgDiv.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);background:#2ecc71;color:#000;padding:10px 20px;border-radius:5px;z-index:9999;font-size:14px;box-shadow:0 2px 10px rgba(0,0,0,0.3);';

  // Change color if it's a warning
  if (msg.includes('⚠️')) {
    msgDiv.style.background = '#e74c3c';
    msgDiv.style.color = '#fff';
  }

  document.body.appendChild(msgDiv);

  setTimeout(() => {
    msgDiv.remove();
  }, 3000);
}
