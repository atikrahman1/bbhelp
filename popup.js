let currentDomain = '';

// Extract domain from URL and remove www
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    let hostname = urlObj.hostname;
    // Remove www. prefix if present
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    return hostname;
  } catch (e) {
    return null;
  }
}

// Get current tab domain
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]) {
    currentDomain = extractDomain(tabs[0].url);

    if (currentDomain) {
      document.getElementById('currentDomain').textContent = currentDomain;
    } else {
      document.getElementById('currentDomain').textContent = 'No valid domain found';
      document.getElementById('currentDomain').classList.add('error');
    }
  }
});

// Old static tool buttons removed - now using dynamic loading

// Extract JS Files button
document.getElementById('extractjs').addEventListener('click', () => {
  const button = document.getElementById('extractjs');
  button.disabled = true;
  button.textContent = 'Extracting...';

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'extractJS' }, (response) => {
      button.disabled = false;
      button.textContent = 'Extract JS Files';

      if (response && response.jsFiles) {
        displayJSFiles(response.jsFiles);
      } else {
        alert('Could not extract JS files. Please refresh the page and try again.');
      }
    });
  });
});

// Port Scanner button
document.getElementById('port-scanner').addEventListener('click', () => {
  chrome.tabs.create({ url: 'port-scanner.html' });
});

// Display JS files in a new tab
function displayJSFiles(jsFiles) {
  // Open the viewer page with URLs as parameter
  const urlsParam = encodeURIComponent(JSON.stringify(jsFiles));
  chrome.tabs.create({ url: `js-viewer.html?urls=${urlsParam}` });
}

// Toggle Google Dorks section
document.getElementById('dorks-toggle').addEventListener('click', () => {
  const toggle = document.getElementById('dorks-toggle');
  const content = document.getElementById('dorks-content');

  toggle.classList.toggle('active');
  content.classList.toggle('active');
});

// Toggle Service Discovery section
document.getElementById('service-discovery-toggle').addEventListener('click', () => {
  const toggle = document.getElementById('service-discovery-toggle');
  const content = document.getElementById('service-discovery-content');

  toggle.classList.toggle('active');
  content.classList.toggle('active');
});

// Load and render custom dorks
function loadCustomDorks() {
  // Load directly from storage to avoid service worker sleep issues
  chrome.storage.local.get(['customDorks'], (result) => {
    if (chrome.runtime.lastError) {
      console.error('Error loading dorks:', chrome.runtime.lastError);
      return;
    }
    
    let dorks = result.customDorks;
    
    // If no dorks in storage, use defaults
    if (!dorks || dorks.length === 0) {
      dorks = [
        { name: 'Login Pages', dork: 'site:{DOMAIN} inurl:login' },
        { name: 'Text Files', dork: 'site:{DOMAIN} filetype:txt' },
        { name: 'PDF Files', dork: 'site:{DOMAIN} filetype:pdf' },
        { name: 'Admin Pages', dork: 'site:{DOMAIN} inurl:admin' },
        { name: 'Config Files', dork: 'site:{DOMAIN} filetype:config' },
        { name: 'SQL Files', dork: 'site:{DOMAIN} filetype:sql' },
        { name: 'ENV Files', dork: 'site:{DOMAIN} filetype:env' },
        { name: 'Backup Files', dork: 'site:{DOMAIN} inurl:backup' }
      ];
    }
    
    renderDorkButtons(dorks);
  });
}

// Render dork buttons dynamically
function renderDorkButtons(dorks) {
  const container = document.querySelector('#dorks-content .buttons');
  container.innerHTML = ''; // Clear existing buttons

  dorks.forEach((dork, index) => {
    const button = document.createElement('button');
    button.className = 'dork-btn';
    button.textContent = dork.name;
    button.setAttribute('data-dork', dork.dork);
    button.setAttribute('data-index', index);

    button.addEventListener('click', () => {
      executeDork(dork.dork);
    });

    container.appendChild(button);
  });
}

// Execute Google Dork
function executeDork(dork) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      try {
        const url = new URL(tabs[0].url);
        const domain = url.hostname.replace('www.', '');

        // Replace {DOMAIN} placeholder
        const finalDork = dork.replace(/\{DOMAIN\}/g, domain);
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(finalDork)}`;

        chrome.tabs.create({ url: searchUrl });
      } catch (e) {
        // If URL parsing fails, use placeholder
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(dork)}`;
        chrome.tabs.create({ url: searchUrl });
      }
    }
  });
}

// Load dorks on popup open (after DOM is ready)
document.addEventListener('DOMContentLoaded', () => {
  loadCustomDorks();
  loadCustomTools();
});

// Load and render custom tools
function loadCustomTools() {
  // Load directly from storage to avoid service worker sleep issues
  chrome.storage.local.get(['customTools'], (result) => {
    if (chrome.runtime.lastError) {
      console.error('Error loading tools:', chrome.runtime.lastError);
      return;
    }
    
    let tools = result.customTools;
    
    // If no tools in storage, use defaults
    if (!tools || tools.length === 0) {
      tools = [
        { name: 'Shodan', url: 'https://beta.shodan.io/domain/{DOMAIN}' },
        { name: 'Crt.sh', url: 'https://crt.sh/?q={DOMAIN}' },
        { name: 'Subdomain Center', url: 'https://api.subdomain.center/?domain={DOMAIN}' }
      ];
    }
    
    renderToolButtons(tools);
  });
}

// Render tool buttons dynamically
function renderToolButtons(tools) {
  const container = document.getElementById('tools-buttons');
  const extractJsBtn = document.getElementById('extractjs');

  // Clear existing tool buttons (keep extractjs)
  const toolButtons = container.querySelectorAll('button:not(#extractjs)');
  toolButtons.forEach(btn => btn.remove());

  // Add tool buttons before extractjs
  tools.forEach((tool, index) => {
    const button = document.createElement('button');
    button.id = `tool-${index}`;
    button.textContent = tool.name;
    button.setAttribute('data-url', tool.url);

    // Set color based on tool name
    if (tool.name.toLowerCase().includes('shodan')) {
      button.style.background = '#e74c3c';
    } else if (tool.name.toLowerCase().includes('crt')) {
      button.style.background = '#3498db';
    } else if (tool.name.toLowerCase().includes('subdomain')) {
      button.style.background = '#2ecc71';
    } else {
      button.style.background = '#9b59b6';
    }

    button.addEventListener('click', () => {
      openTool(tool.url);
    });

    container.insertBefore(button, extractJsBtn);
  });
}

// Open tool with variable replacement
function openTool(urlTemplate) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      try {
        const url = new URL(tabs[0].url);
        const domain = url.hostname.replace('www.', '');
        const fullUrl = tabs[0].url;
        const origin = url.origin;
        const target = url.host;

        // Replace placeholders
        let finalUrl = urlTemplate
          .replace(/\{URL\}/g, encodeURIComponent(fullUrl))
          .replace(/\{DOMAIN\}/g, domain)
          .replace(/\{ORIGIN\}/g, origin)
          .replace(/\{TARGET\}/g, target);

        chrome.tabs.create({ url: finalUrl });
      } catch (e) {
        // If URL parsing fails, open with placeholders
        chrome.tabs.create({ url: urlTemplate });
      }
    }
  });
}

// Toggle Sensitive File Scanner section
document.getElementById('sensitive-toggle').addEventListener('click', () => {
  const toggle = document.getElementById('sensitive-toggle');
  const content = document.getElementById('sensitive-content');

  toggle.classList.toggle('active');
  content.classList.toggle('active');
});

// Toggle Copy Commands section
document.getElementById('commands-toggle').addEventListener('click', () => {
  const toggle = document.getElementById('commands-toggle');
  const content = document.getElementById('commands-content');

  toggle.classList.toggle('active');
  content.classList.toggle('active');
});

// Toggle Configuration section
document.getElementById('config-toggle').addEventListener('click', () => {
  const toggle = document.getElementById('config-toggle');
  const content = document.getElementById('config-content');

  toggle.classList.toggle('active');
  content.classList.toggle('active');
});

// Load scanner settings and check for results
chrome.storage.local.get(['scannerEnabled'], (result) => {
  if (chrome.runtime.lastError) {
    console.error('Error loading settings:', chrome.runtime.lastError);
    return;
  }
  if (result.scannerEnabled !== undefined) {
    document.getElementById('scanner-switch').checked = result.scannerEnabled;
  }
});

// Check if there are found files for current domain
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]) {
    try {
      const url = new URL(tabs[0].url);
      const domain = url.host;

      chrome.storage.local.get([`scanResults_${domain}`], (result) => {
        const scanResults = result[`scanResults_${domain}`];
        const viewButton = document.getElementById('view-found');

        if (scanResults && scanResults.length > 0) {
          viewButton.style.display = 'block';
          viewButton.textContent = `View Found Files (${scanResults.length})`;
        } else {
          viewButton.style.display = 'none';
        }
      });
    } catch (e) {
      document.getElementById('view-found').style.display = 'none';
    }
  }
});

// Scanner toggle switch
document.getElementById('scanner-switch').addEventListener('change', (e) => {
  const enabled = e.target.checked;
  chrome.runtime.sendMessage({
    action: 'toggleScanner',
    enabled: enabled
  });
});

// Configure files button
document.getElementById('config-files').addEventListener('click', () => {
  chrome.tabs.create({ url: 'config.html' });
});

// Manage exclusions button
document.getElementById('manage-exclusions').addEventListener('click', () => {
  chrome.tabs.create({ url: 'exclusions.html' });
});

// Manage commands button
document.getElementById('manage-commands').addEventListener('click', () => {
  chrome.tabs.create({ url: 'commands.html' });
});

// Manage dorks button
document.getElementById('manage-dorks').addEventListener('click', () => {
  chrome.tabs.create({ url: 'dorks.html' });
});

// Manage tools button
document.getElementById('manage-tools').addEventListener('click', () => {
  chrome.tabs.create({ url: 'tools.html' });
});

// View found files button
document.getElementById('view-found').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'getFoundFiles' }, (response) => {
    if (response && response.foundFiles.length > 0) {
      // Get protection setting
      chrome.runtime.sendMessage({ action: 'getSettings' }, (settings) => {
        const protectionEnabled = settings && settings.falsePositiveProtection !== undefined ? settings.falsePositiveProtection : true;
        displayFoundFiles(response.foundFiles, protectionEnabled);
      });
    } else {
      alert('No sensitive files found on this page yet.');
    }
  });
});

// Force rescan button
document.getElementById('rescan-now').addEventListener('click', () => {
  const button = document.getElementById('rescan-now');
  button.disabled = true;
  button.textContent = 'Scanning...';

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      const url = tabs[0].url;

      try {
        const urlObj = new URL(url);
        if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
          button.disabled = false;
          button.textContent = 'Scan';
          showMessage('Cannot scan this page. Only HTTP/HTTPS pages are supported.');
          return;
        }
      } catch (e) {
        button.disabled = false;
        button.textContent = 'Scan';
        showMessage('Invalid URL');
        return;
      }

      // Send message to background to scan (works even if auto-scan is off)
      chrome.runtime.sendMessage({
        action: 'forceRescan',
        tabId: tabs[0].id,
        url: url
      }, (response) => {
        button.disabled = false;
        button.textContent = 'Scan';

        if (chrome.runtime.lastError) {
          showMessage('Error: ' + chrome.runtime.lastError.message, 'error');
        } else if (response && response.success) {
          // Show appropriate message based on results
          if (response.count > 0) {
            showMessage(response.message || `Found ${response.count} sensitive file(s)!`, 'warning');
          } else {
            showMessage(response.message || 'Scan completed! No sensitive files found.', 'success');
          }
        } else {
          showMessage(response?.message || 'Failed to start scan.', 'error');
        }
      });
    }
  });
});

// Show temporary message
function showMessage(msg, type = 'success') {
  // Create a temporary message element
  const msgDiv = document.createElement('div');
  msgDiv.textContent = msg;
  
  let bgColor = '#2ecc71'; // success - green
  let textColor = '#000';
  
  if (type === 'error') {
    bgColor = '#e74c3c'; // error - red
    textColor = '#fff';
  } else if (type === 'warning') {
    bgColor = '#f39c12'; // warning - orange
    textColor = '#000';
  }
  
  msgDiv.style.cssText = `position:fixed;top:10px;left:50%;transform:translateX(-50%);background:${bgColor};color:${textColor};padding:10px 20px;border-radius:5px;z-index:9999;font-size:12px;box-shadow:0 2px 10px rgba(0,0,0,0.3);`;
  document.body.appendChild(msgDiv);

  setTimeout(() => {
    msgDiv.remove();
  }, 3000);
}

// Open configuration page
function openConfigPage(filesList, previewLength) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Configure Sensitive Files</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
      background: #1a1a1a;
      color: #00ff41;
      margin: 0;
    }
    h2 {
      color: #00ff41;
      margin-bottom: 20px;
    }
    .info {
      background: #2a2a2a;
      padding: 15px;
      border-radius: 5px;
      margin-bottom: 20px;
      color: #888;
    }
    textarea {
      width: 100%;
      height: 400px;
      background: #2a2a2a;
      color: #00ff41;
      border: 2px solid #00ff41;
      border-radius: 5px;
      padding: 10px;
      font-family: monospace;
      font-size: 14px;
      resize: vertical;
    }
    .buttons {
      margin-top: 20px;
      display: flex;
      gap: 10px;
    }
    button {
      padding: 12px 24px;
      font-size: 14px;
      font-weight: bold;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      color: #fff;
    }
    .save-btn {
      background: #2ecc71;
    }
    .save-btn:hover {
      background: #27ae60;
    }
    .reset-btn {
      background: #e74c3c;
    }
    .reset-btn:hover {
      background: #c0392b;
    }
    .message {
      margin-top: 10px;
      padding: 10px;
      border-radius: 5px;
      display: none;
    }
    .message.success {
      background: #2ecc71;
      color: #000;
    }
  </style>
</head>
<body>
  <h2>Configure Sensitive Files List</h2>
  <div class="info">
    Enter one file path per line. The scanner will check these files on every page load when enabled.
  </div>
  <textarea id="files-list">${filesList.join('\n')}</textarea>
  
  <div class="info" style="margin-top: 20px;">
    <label for="preview-length" style="display: block; margin-bottom: 5px;">Preview Length (characters):</label>
    <input type="number" id="preview-length" min="5" max="500" value="${previewLength || 10}" 
           style="width: 100px; padding: 8px; background: #1a1a1a; color: #00ff41; border: 2px solid #00ff41; border-radius: 3px; font-size: 14px;">
  </div>
  
  <div class="buttons">
    <button class="save-btn" onclick="saveFiles()">Save</button>
    <button class="reset-btn" onclick="resetToDefault()">Reset to Default</button>
  </div>
  <div class="message" id="message"></div>
  
  <script>
    // Load preview length on page load
    chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
      if (response && response.previewLength) {
        document.getElementById('preview-length').value = response.previewLength;
      }
    });
    
    function saveFiles() {
      const textarea = document.getElementById('files-list');
      const files = textarea.value.split('\n').map(f => f.trim()).filter(f => f.length > 0);
      const previewLen = parseInt(document.getElementById('preview-length').value) || 10;
      
      // Save files list
      chrome.runtime.sendMessage({ 
        action: 'updateFilesList', 
        filesList: files 
      }, (response) => {
        if (response && response.success) {
          // Save preview length
          chrome.runtime.sendMessage({
            action: 'updatePreviewLength',
            previewLength: previewLen
          }, (response2) => {
            if (response2 && response2.success) {
              showMessage('Settings saved successfully!');
            }
          });
        } else {
          showMessage('Failed to save settings');
        }
      });
    }
    
    function resetToDefault() {
      const defaultFiles = [
        '.env',
        '.env.local',
        '.env.production',
        '.env.backup',
        'config.php',
        'config.yaml',
        '.bash_history',
        '.git/config',
        '.git/HEAD',
        '.gitignore',
        'backup.zip',
        'backup.sql',
        'db.sql',
        'database.sql',
        'debug.log',
        'error.log',
        'laravel.log',
        'npm-debug.log',
        'composer.lock',
        'yarn.lock',
        'package-lock.json',
        'storage/logs/laravel.log',
        'vendor/composer/installed.json',
        'phpinfo.php',
        'swagger.json',
        'website.zip',
        'dump.sql'
      ];
      
      document.getElementById('files-list').value = defaultFiles.join('\n');
      showMessage('Reset to default list. Click Save to apply.');
    }
    
    function showMessage(text) {
      const msg = document.getElementById('message');
      msg.textContent = text;
      msg.className = 'message success';
      msg.style.display = 'block';
      setTimeout(() => {
        msg.style.display = 'none';
      }, 3000);
    }
  </script>
</body>
</html>
  `;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  chrome.tabs.create({ url: url });
}

// Display found files
function displayFoundFiles(foundFiles, protectionEnabled = true) {
  const escapeHtml = (text) => {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };
  
  const protectionInfoBox = protectionEnabled ? `
  <div class="info-box">
    <h3>🛡️ False Positive Protection Active</h3>
    <p>✓ Baseline 404 comparison</p>
    <p>✓ 404 page pattern detection</p>
    <p>✓ Size-based duplicate filtering</p>
  </div>
  ` : '';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Found Sensitive Files</title>
  <style>
    body {
      font-family: monospace;
      padding: 20px;
      background: #1a1a1a;
      color: #00ff41;
      margin: 0;
      font-size: 16px;
    }
    h2 {
      color: #00ff41;
      margin-bottom: 20px;
      font-size: 24px;
    }
    .file-item {
      background: #2a2a2a;
      padding: 15px;
      margin: 12px 0;
      border-radius: 5px;
      border-left: 4px solid #e74c3c;
    }
    .file-name {
      color: #e74c3c;
      font-weight: bold;
      margin-bottom: 8px;
      font-size: 18px;
    }
    a {
      color: #3498db;
      text-decoration: none;
      word-break: break-all;
      font-size: 15px;
    }
    a:hover {
      color: #5dade2;
      text-decoration: underline;
    }
    .details {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #444;
    }
    .detail-row {
      margin: 5px 0;
      font-size: 14px;
    }
    .label {
      color: #888;
      display: inline-block;
      width: 120px;
    }
    .value {
      color: #00ff41;
    }
    .preview {
      background: #1a1a1a;
      padding: 8px;
      border-radius: 3px;
      margin-top: 5px;
      color: #f39c12;
      font-family: monospace;
      word-break: break-all;
      max-height: 100px;
      overflow-y: auto;
    }
    .count {
      color: #888;
      font-size: 16px;
    }
    .warning {
      background: #e74c3c;
      color: #fff;
      padding: 15px;
      border-radius: 5px;
      margin-bottom: 20px;
      font-weight: bold;
      font-size: 16px;
    }
    .info-box {
      background: #2a2a2a;
      padding: 12px;
      border-radius: 5px;
      margin-bottom: 20px;
      border-left: 4px solid #3498db;
    }
    .info-box h3 {
      margin: 0 0 10px 0;
      color: #3498db;
      font-size: 16px;
    }
    .info-box p {
      margin: 5px 0;
      color: #888;
      font-size: 13px;
    }
    .validation-badge {
      display: inline-block;
      background: #2ecc71;
      color: #000;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 11px;
      margin-left: 5px;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <h2>Found Sensitive Files <span class="count">(${foundFiles.length})</span></h2>
  <div class="warning">⚠️ WARNING: These files were found accessible on the target website!</div>
  
  ${protectionInfoBox}
  
  ${foundFiles.map(item => `
    <div class="file-item">
      <div class="file-name">
        ${escapeHtml(item.file)}
        <span class="validation-badge">✓ VERIFIED</span>
      </div>
      <a href="${escapeHtml(item.url)}" target="_blank">${escapeHtml(item.url)}</a>
      <div class="details">
        <div class="detail-row">
          <span class="label">Status:</span>
          <span class="value">${item.status}</span>
        </div>
        <div class="detail-row">
          <span class="label">Content-Type:</span>
          <span class="value">${escapeHtml(item.contentType || 'unknown')}</span>
        </div>
        <div class="detail-row">
          <span class="label">Size:</span>
          <span class="value">${formatSize(item.size || 0)}</span>
        </div>
        <div class="detail-row">
          <span class="label">Preview:</span>
          <div class="preview">${escapeHtml(item.preview || 'N/A')}</div>
        </div>
        <div class="detail-row">
          <span class="label">Found At:</span>
          <span class="value">${item.foundAt ? new Date(item.foundAt).toLocaleString() : 'Unknown'}</span>
        </div>
      </div>
    </div>
  `).join('')}
</body>
</html>
  `;

  const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
  const url = URL.createObjectURL(blob);
  chrome.tabs.create({ url: url });
}


// Listen for scan completion messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scanComplete') {
    // Update view button visibility
    const viewButton = document.getElementById('view-found');
    if (request.count > 0) {
      viewButton.style.display = 'block';
      viewButton.textContent = `View Found Files (${request.count})`;
    } else {
      viewButton.style.display = 'none';
    }
  }
});

// Load and render custom commands
function loadCustomCommands() {
  // Load directly from storage to avoid service worker sleep issues
  chrome.storage.local.get(['customCommands'], (result) => {
    if (chrome.runtime.lastError) {
      console.error('Error loading commands:', chrome.runtime.lastError);
      return;
    }
    
    let commands = result.customCommands;
    
    // If no commands in storage, use defaults
    if (!commands || commands.length === 0) {
      commands = [
        { name: 'Nmap Quick Scan', command: 'nmap -T4 -F {TARGET}' },
        { name: 'Nmap Full Scan', command: 'nmap -p- -T4 {TARGET}' },
        { name: 'Nmap Fast Top Ports', command: 'nmap --top-ports 1000 -T4 {TARGET}' },
        { name: 'Subfinder', command: 'subfinder -d {DOMAIN} -o {DOMAIN}.txt' },
        { name: 'FFUF', command: 'ffuf -u {URL}/FUZZ -w /path/to/wordlist.txt -ac' },
        { name: 'Nuclei', command: 'nuclei -target {URL}' }
      ];
    }
    
    renderCommandButtons(commands);
  });
}

// Render command buttons dynamically
function renderCommandButtons(commands) {
  const container = document.querySelector('#commands-content .buttons');
  container.innerHTML = ''; // Clear existing buttons

  commands.forEach((cmd, index) => {
    const button = document.createElement('button');
    button.className = 'cmd-btn';
    button.textContent = cmd.name;
    button.setAttribute('data-cmd', cmd.command);
    button.setAttribute('data-index', index);

    button.addEventListener('click', () => {
      copyCommand(cmd.command, button);
    });

    container.appendChild(button);
  });
}

// Copy command with variable replacement
function copyCommand(command, button) {
  let finalCommand = command;

  // Get current domain and URL
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      try {
        const url = new URL(tabs[0].url);
        const domain = url.hostname.replace('www.', '');
        const fullUrl = tabs[0].url;
        const origin = url.origin;
        const target = url.host;

        // Replace placeholders with curly braces
        finalCommand = finalCommand
          .replace(/\{URL\}/g, fullUrl)
          .replace(/\{DOMAIN\}/g, domain)
          .replace(/\{ORIGIN\}/g, origin)
          .replace(/\{TARGET\}/g, target)
          .replace(/\{HOST\}/g, url.host)
          .replace(/\{PROTOCOL\}/g, url.protocol.replace(':', ''))
          .replace(/\{PATH\}/g, url.pathname);
      } catch (e) {
        // If URL parsing fails, keep placeholders
      }
    }

    // Copy to clipboard
    navigator.clipboard.writeText(finalCommand).then(() => {
      // Visual feedback
      const originalText = button.textContent;
      button.textContent = 'Copied!';
      button.classList.add('copied');

      setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove('copied');
      }, 1500);

      showMessage('Command copied to clipboard!');
    }).catch(err => {
      showMessage('Failed to copy command');
      console.error('Copy failed:', err);
    });
  });
}

// Load commands on popup open (after DOM is ready)
document.addEventListener('DOMContentLoaded', () => {
  loadCustomCommands();
});
