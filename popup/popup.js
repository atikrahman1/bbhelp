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

// Port Scanner button - removed old handler, using new inline scanner below

// Display JS files in a new tab
function displayJSFiles(jsFiles) {
  // Open the viewer page with URLs as parameter
  const urlsParam = encodeURIComponent(JSON.stringify(jsFiles));
  chrome.tabs.create({ url: `pages/js-viewer.html?urls=${urlsParam}` });
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
    
    // Add icons based on dork type
    let icon = '🔍'; // default search icon
    const name = dork.name.toLowerCase();
    if (name.includes('login')) icon = '🔐';
    else if (name.includes('admin')) icon = '👑';
    else if (name.includes('config')) icon = '⚙️';
    else if (name.includes('sql')) icon = '🗄️';
    else if (name.includes('env')) icon = '🌱';
    else if (name.includes('backup')) icon = '💾';
    else if (name.includes('pdf')) icon = '📄';
    else if (name.includes('text') || name.includes('txt')) icon = '📝';
    
    button.textContent = `${icon} ${dork.name}`;
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

// Open all dorks at once
function openAllDorks() {
  chrome.storage.local.get(['customDorks'], (result) => {
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
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        try {
          const url = new URL(tabs[0].url);
          const domain = url.hostname.replace('www.', '');

          // Open each dork in a new tab
          dorks.forEach((dorkObj, index) => {
            // Add small delay between tabs to avoid browser blocking
            setTimeout(() => {
              const finalDork = dorkObj.dork.replace(/\{DOMAIN\}/g, domain);
              const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(finalDork)}`;
              chrome.tabs.create({ url: searchUrl, active: false }); // Don't activate each tab
            }, index * 100); // 100ms delay between each tab
          });
          
          showMessage(`Opening ${dorks.length} Google Dorks...`, 'success');
        } catch (e) {
          // If URL parsing fails, open with placeholders
          dorks.forEach((dorkObj, index) => {
            setTimeout(() => {
              const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(dorkObj.dork)}`;
              chrome.tabs.create({ url: searchUrl, active: false });
            }, index * 100);
          });
          
          showMessage(`Opening ${dorks.length} Google Dorks...`, 'success');
        }
      }
    });
  });
}

// Load dorks on popup open (after DOM is ready) - consolidated with other DOMContentLoaded below

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
        { name: 'Subdomain Center', url: 'https://api.subdomain.center/?domain={DOMAIN}' },
        { name: 'Wayback Machine', url: 'https://web.archive.org/web/*/{DOMAIN}' }
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
    
    // Add icons based on tool name
    let icon = '🔧'; // default icon
    if (tool.name.toLowerCase().includes('shodan')) {
      icon = '🌐';
      button.style.background = '#e74c3c';
    } else if (tool.name.toLowerCase().includes('crt')) {
      icon = '🔒';
      button.style.background = '#3498db';
    } else if (tool.name.toLowerCase().includes('subdomain')) {
      icon = '🌿';
      button.style.background = '#2ecc71';
    } else {
      button.style.background = '#9b59b6';
    }
    
    button.textContent = `${icon} ${tool.name}`;
    button.setAttribute('data-url', tool.url);

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

// Toggle Service Discovery section - removed duplicate, using DOMContentLoaded version

// Port scanner functionality - moved to DOMContentLoaded

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
  chrome.tabs.create({ url: 'config/config.html' });
});

// Manage exclusions button
document.getElementById('manage-exclusions').addEventListener('click', () => {
  chrome.tabs.create({ url: 'config/exclusions.html' });
});

// Manage commands button
document.getElementById('manage-commands').addEventListener('click', () => {
  chrome.tabs.create({ url: 'management/commands.html' });
});

// Manage dorks button
document.getElementById('manage-dorks').addEventListener('click', () => {
  chrome.tabs.create({ url: 'management/dorks.html' });
});

// Manage tools button
document.getElementById('manage-tools').addEventListener('click', () => {
  chrome.tabs.create({ url: 'management/tools.html' });
});

// Export configuration button
document.getElementById('export-config').addEventListener('click', () => {
  exportConfiguration();
});

// Import configuration button
document.getElementById('import-config').addEventListener('click', () => {
  importConfiguration();
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
  const progressDiv = document.getElementById('sensitive-scan-progress');
  const progressFill = document.getElementById('sensitive-progress-fill');
  const progressText = document.getElementById('sensitive-progress-text');
  
  button.disabled = true;
  button.textContent = 'Scanning...';
  progressDiv.style.display = 'block';
  progressFill.style.width = '0%';
  progressText.textContent = 'Starting scan...';

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      const url = tabs[0].url;

      try {
        const urlObj = new URL(url);
        if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
          button.disabled = false;
          button.textContent = 'Scan Main Host';
          progressDiv.style.display = 'none';
          showMessage('Cannot scan this page. Only HTTP/HTTPS pages are supported.');
          return;
        }
      } catch (e) {
        button.disabled = false;
        button.textContent = 'Scan Main Host';
        progressDiv.style.display = 'none';
        showMessage('Invalid URL');
        return;
      }

      // Send message to background to scan with progress tracking
      chrome.runtime.sendMessage({
        action: 'forceRescanWithProgress',
        tabId: tabs[0].id,
        url: url,
        scanMainHost: true
      }, (response) => {
        console.log('Received response from background:', response); // Debug log
        button.disabled = false;
        button.textContent = 'Scan Main Host';
        progressDiv.style.display = 'none';

        if (chrome.runtime.lastError) {
          console.log('Chrome runtime error:', chrome.runtime.lastError); // Debug log
          showMessage('Error: ' + chrome.runtime.lastError.message, 'error');
          // Notify background that scan completed (even on error)
          chrome.runtime.sendMessage({
            action: 'scanCompleted',
            tabId: tabs[0].id
          });
        } else if (response && response.success) {
          console.log('Response success, calling storeScanResult'); // Debug log
          // Store scan result in history
          storeScanResult(url, response.foundFiles || [], response.totalScanned || 0, response.protectionEnabled || true);
          
          // Show appropriate message based on results
          if (response.count > 0) {
            showMessage(response.message || `Found ${response.count} sensitive file(s)!`, 'warning');
          } else {
            showMessage(response.message || 'Scan completed! No sensitive files found.', 'success');
          }
          
          // Notify background that scan completed
          chrome.runtime.sendMessage({
            action: 'scanCompleted',
            tabId: tabs[0].id
          });
        } else {
          console.log('Response failed or invalid:', response); // Debug log
          showMessage(response?.message || 'Failed to start scan.', 'error');
          // Notify background that scan completed (even on failure)
          chrome.runtime.sendMessage({
            action: 'scanCompleted',
            tabId: tabs[0].id
          });
        }
      });
      
      // Notify background that scan started
      chrome.runtime.sendMessage({
        action: 'scanStarted',
        tabId: tabs[0].id,
        scanType: 'sensitive',
        total: 0 // Will be updated by progress messages
      });
    }
  });
});

// Force rescan current URL button
document.getElementById('rescan-current-url').addEventListener('click', () => {
  const button = document.getElementById('rescan-current-url');
  const progressDiv = document.getElementById('sensitive-scan-progress');
  const progressFill = document.getElementById('sensitive-progress-fill');
  const progressText = document.getElementById('sensitive-progress-text');
  
  button.disabled = true;
  button.textContent = 'Scanning...';
  progressDiv.style.display = 'block';
  progressFill.style.width = '0%';
  progressText.textContent = 'Starting scan...';

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      const url = tabs[0].url;

      try {
        const urlObj = new URL(url);
        if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
          button.disabled = false;
          button.textContent = 'Scan Current URL';
          progressDiv.style.display = 'none';
          showMessage('Cannot scan this page. Only HTTP/HTTPS pages are supported.');
          return;
        }
      } catch (e) {
        button.disabled = false;
        button.textContent = 'Scan Current URL';
        progressDiv.style.display = 'none';
        showMessage('Invalid URL');
        return;
      }

      // Send message to background to scan with progress tracking
      chrome.runtime.sendMessage({
        action: 'forceRescanWithProgress',
        tabId: tabs[0].id,
        url: url,
        scanMainHost: false
      }, (response) => {
        console.log('Received response from background:', response); // Debug log
        button.disabled = false;
        button.textContent = 'Scan Current URL';
        progressDiv.style.display = 'none';

        if (chrome.runtime.lastError) {
          console.log('Chrome runtime error:', chrome.runtime.lastError); // Debug log
          showMessage('Error: ' + chrome.runtime.lastError.message, 'error');
          // Notify background that scan completed (even on error)
          chrome.runtime.sendMessage({
            action: 'scanCompleted',
            tabId: tabs[0].id
          });
        } else if (response && response.success) {
          console.log('Response success, calling storeScanResult'); // Debug log
          // Store scan result in history
          storeScanResult(url, response.foundFiles || [], response.totalScanned || 0, response.protectionEnabled || true);
          
          // Show appropriate message based on results
          if (response.count > 0) {
            showMessage(response.message || `Found ${response.count} sensitive file(s)!`, 'warning');
          } else {
            showMessage(response.message || 'Scan completed! No sensitive files found.', 'success');
          }
          
          // Notify background that scan completed
          chrome.runtime.sendMessage({
            action: 'scanCompleted',
            tabId: tabs[0].id
          });
        } else {
          console.log('Response failed or invalid:', response); // Debug log
          showMessage(response?.message || 'Failed to start scan.', 'error');
          // Notify background that scan completed (even on failure)
          chrome.runtime.sendMessage({
            action: 'scanCompleted',
            tabId: tabs[0].id
          });
        }
      });
      
      // Notify background that scan started
      chrome.runtime.sendMessage({
        action: 'scanStarted',
        tabId: tabs[0].id,
        scanType: 'sensitive',
        total: 0 // Will be updated by progress messages
      });
    }
  });
});

// View all results button
document.getElementById('view-all-results').addEventListener('click', () => {
  chrome.tabs.create({ url: 'pages/all-results.html' });
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
  
  msgDiv.style.cssText = `position:fixed;top:10px;left:50%;transform:translateX(-50%);background:${bgColor};color:${textColor};padding:10px 20px;border-radius:5px;z-index:9999;font-size:12px;box-shadow:0 2px 10px rgba(0,0,0,0.3);max-width:300px;text-align:center;`;
  document.body.appendChild(msgDiv);

  // Longer timeout for important messages
  const timeout = type === 'warning' ? 5000 : 3000;
  setTimeout(() => {
    msgDiv.remove();
  }, timeout);
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
    <p>✓ Size range clustering (±10%)</p>
    <p>✓ HTML structure similarity detection</p>
    <p>✓ 404 page pattern detection</p>
    <p>✓ Content similarity filtering</p>
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


// Store scan result in history (only if files found)
function storeScanResult(url, foundFiles, totalScanned, protectionEnabled) {
  console.log('storeScanResult called with:', { url, foundFilesLength: foundFiles?.length, foundFiles, totalScanned, protectionEnabled }); // Debug log
  
  // Only store if files were found
  if (!foundFiles || foundFiles.length === 0) {
    console.log('No files found, not storing in history'); // Debug log
    return;
  }

  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    
    const scanResult = {
      domain: domain,
      url: url,
      timestamp: Date.now(),
      foundFiles: foundFiles,
      totalScanned: totalScanned,
      protectionEnabled: protectionEnabled
    };
    
    console.log('Storing scan result:', scanResult); // Debug log
    
    // Get existing history
    chrome.storage.local.get(['scanHistory'], (result) => {
      let history = result.scanHistory || [];
      console.log('Current history length:', history.length); // Debug log
      
      // Add new result
      history.push(scanResult);
      console.log('New history length:', history.length); // Debug log
      
      // Keep only last 100 scans to prevent storage bloat
      if (history.length > 100) {
        history = history.slice(-100);
      }
      
      // Save updated history
      chrome.storage.local.set({ scanHistory: history }, () => {
        console.log('Scan result stored successfully'); // Debug log
      });
    });
  } catch (error) {
    console.error('Failed to store scan result:', error);
  }
}

// Listen for scan completion and progress messages
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
  } else if (request.action === 'scanProgress') {
    // Update progress bar for sensitive file scan
    const progressFill = document.getElementById('sensitive-progress-fill');
    const progressText = document.getElementById('sensitive-progress-text');
    
    if (progressFill && progressText) {
      const percentage = (request.completed / request.total) * 100;
      progressFill.style.width = percentage + '%';
      progressText.textContent = `Scanning ${request.currentFile} (${request.completed}/${request.total})`;
    }
  } else if (request.action === 'portScanProgress') {
    // Update progress bar for port scan
    const progressFill = document.getElementById('port-progress-fill');
    const progressText = document.getElementById('port-progress-text');
    const resultsDiv = document.getElementById('port-scan-results');
    
    if (progressFill && progressText) {
      const percentage = (request.completed / request.total) * 100;
      progressFill.style.width = percentage + '%';
      progressText.textContent = `Checking port ${request.currentPort} (${request.currentService})...`;
    }
    
    // Add result to UI
    if (resultsDiv && request.result) {
      addPortResult(request.result.port, request.result.service, request.result.status);
    }
  } else if (request.action === 'portScanComplete') {
    // Port scan completed
    const button = document.getElementById('port-scanner');
    const progressText = document.getElementById('port-progress-text');
    
    if (button) {
      button.disabled = false;
      button.textContent = '🔍 Scan HTTP Ports';
    }
    
    if (progressText) {
      progressText.textContent = `Scan complete! Found ${request.openPorts} open ports.`;
    }
    
    // Show results dropdown
    if (request.results) {
      showPortResultsDropdown(request.results);
    }
    
    showMessage(`Port scan complete! ${request.openPorts} ports open.`, 'success');
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
    
    // Add icons based on command type
    let icon = '💻'; // default terminal icon
    const name = cmd.name.toLowerCase();
    if (name.includes('nmap')) icon = '🗺️';
    else if (name.includes('subfinder')) icon = '🌿';
    else if (name.includes('ffuf')) icon = '🔨';
    else if (name.includes('nuclei')) icon = '☢️';
    else if (name.includes('scan')) icon = '🔍';
    else if (name.includes('enum')) icon = '📋';
    
    button.textContent = `${icon} ${cmd.name}`;
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

// Export configuration
function exportConfiguration() {
  // Get all settings from storage
  chrome.storage.local.get([
    'scannerEnabled',
    'sensitiveFilesList', 
    'previewLength',
    'exclusionList',
    'customCommands',
    'customDorks',
    'customTools',
    'rescanInterval',
    'falsePositiveProtection'
  ], (result) => {
    if (chrome.runtime.lastError) {
      showMessage('Failed to export configuration', 'error');
      return;
    }

    // Create configuration object with metadata
    const config = {
      metadata: {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        extensionName: 'BBHelp'
      },
      settings: {
        scannerEnabled: result.scannerEnabled || false,
        sensitiveFilesList: result.sensitiveFilesList || [],
        previewLength: result.previewLength || 100,
        exclusionList: result.exclusionList || [],
        customCommands: result.customCommands || [],
        customDorks: result.customDorks || [],
        customTools: result.customTools || [],
        rescanInterval: result.rescanInterval || 12,
        falsePositiveProtection: result.falsePositiveProtection !== undefined ? result.falsePositiveProtection : true
      }
    };

    // Create and download JSON file
    const jsonString = JSON.stringify(config, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `bbhelp-config-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showMessage('Configuration exported successfully!', 'success');
  });
}

// Import configuration
function importConfiguration() {
  // Create file input
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const config = JSON.parse(e.target.result);
        
        // Validate configuration structure
        if (!config.settings) {
          showMessage('Invalid configuration file format', 'error');
          return;
        }

        // Confirm import
        if (!confirm(`Import configuration from ${config.metadata?.exportedAt || 'unknown date'}?\n\nThis will overwrite all current settings including:\n- Tools\n- Google Dorks\n- Copy Commands\n- File Fuzzer List\n- Exclusion List\n- Scanner Settings`)) {
          return;
        }

        // Import settings to storage
        const settingsToImport = {};
        
        if (config.settings.scannerEnabled !== undefined) settingsToImport.scannerEnabled = config.settings.scannerEnabled;
        if (config.settings.sensitiveFilesList) settingsToImport.sensitiveFilesList = config.settings.sensitiveFilesList;
        if (config.settings.previewLength) settingsToImport.previewLength = config.settings.previewLength;
        if (config.settings.exclusionList) settingsToImport.exclusionList = config.settings.exclusionList;
        if (config.settings.customCommands) settingsToImport.customCommands = config.settings.customCommands;
        if (config.settings.customDorks) settingsToImport.customDorks = config.settings.customDorks;
        if (config.settings.customTools) settingsToImport.customTools = config.settings.customTools;
        if (config.settings.rescanInterval) settingsToImport.rescanInterval = config.settings.rescanInterval;
        if (config.settings.falsePositiveProtection !== undefined) settingsToImport.falsePositiveProtection = config.settings.falsePositiveProtection;

        chrome.storage.local.set(settingsToImport, () => {
          if (chrome.runtime.lastError) {
            showMessage('Failed to import configuration', 'error');
            return;
          }

          // Update background script settings
          chrome.runtime.sendMessage({ action: 'reloadSettings' }, (response) => {
            if (response && response.success) {
              showMessage('Configuration imported successfully! Please reload the extension.', 'success');
            } else {
              showMessage('Configuration imported but may require extension reload', 'warning');
            }
          });
        });

      } catch (error) {
        showMessage('Invalid JSON file or corrupted configuration', 'error');
        console.error('Import error:', error);
      }
    };
    
    reader.readAsText(file);
  };
  
  input.click();
}

// Global variable for custom ports
let customPortsList = [];

// Start port scanning (now delegates to background)
async function startPortScan() {
  console.log('startPortScan called, currentDomain:', currentDomain);
  
  if (!currentDomain) {
    console.error('No currentDomain available');
    showMessage('No valid domain found', 'error');
    return;
  }

  const button = document.getElementById('port-scanner');
  const progressDiv = document.getElementById('port-scan-progress');
  const progressFill = document.getElementById('port-progress-fill');
  const progressText = document.getElementById('port-progress-text');
  const resultsDiv = document.getElementById('port-scan-results');

  // Reset UI
  button.disabled = true;
  button.textContent = '🔍 Scanning...';
  progressDiv.style.display = 'block';
  progressFill.style.width = '0%';
  resultsDiv.innerHTML = '';
  progressText.textContent = 'Starting port scan...';

  // Get current tab and start scan in background
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    
    chrome.runtime.sendMessage({
      action: 'startPortScan',
      tabId: tabs[0].id,
      domain: currentDomain
    }, (response) => {
      if (response && response.success) {
        console.log('Port scan started in background');
      } else {
        button.disabled = false;
        button.textContent = '🔍 Scan HTTP Ports';
        progressDiv.style.display = 'none';
        showMessage('Failed to start port scan', 'error');
      }
    });
  });
}

// Check if a port is open
async function checkPort(domain, port) {
  return new Promise((resolve) => {
    const timeout = 3000; // 3 second timeout
    const startTime = Date.now();
    
    // Try HTTPS first for common HTTPS ports
    const protocol = [443, 8443, 4443, 9443].includes(port) ? 'https' : 'http';
    const url = `${protocol}://${domain}:${port}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    fetch(url, { 
      method: 'HEAD',
      mode: 'no-cors',
      signal: controller.signal
    })
    .then(() => {
      clearTimeout(timeoutId);
      resolve(true);
    })
    .catch((error) => {
      clearTimeout(timeoutId);
      // For no-cors mode, any response (even errors) usually means the port is open
      // Only network errors or timeouts indicate closed ports
      if (error.name === 'AbortError') {
        resolve(false); // Timeout
      } else {
        resolve(true); // Port responded (even with error)
      }
    });
  });
}

// Add port result to UI
function addPortResult(port, service, status) {
  const resultsDiv = document.getElementById('port-scan-results');
  const resultDiv = document.createElement('div');
  resultDiv.className = 'port-result';
  
  let statusIcon = '';
  let statusClass = '';
  let statusText = '';
  
  if (status === 'open') {
    statusIcon = '✅';
    statusClass = 'port-open';
    statusText = 'Open';
  } else if (status === 'closed') {
    statusIcon = '❌';
    statusClass = 'port-closed';
    statusText = 'Closed';
  } else {
    statusIcon = '⏱️';
    statusClass = 'port-timeout';
    statusText = 'Timeout';
  }
  
  resultDiv.innerHTML = `
    <span>Port ${port} (${service})</span>
    <span class="${statusClass}">${statusIcon} ${statusText}</span>
  `;
  
  resultsDiv.appendChild(resultDiv);
  
  // Scroll to bottom
  resultsDiv.scrollTop = resultsDiv.scrollHeight;
}

// Load custom ports
async function loadCustomPorts() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
      if (response && response.customPorts) {
        customPortsList = response.customPorts;
        console.log('Loaded', customPortsList.length, 'custom ports'); // Debug log
      }
      resolve();
    });
  });
}

// Show port results dropdown
function showPortResultsDropdown(results) {
  const dropdown = document.getElementById('port-results-dropdown');
  const summary = document.getElementById('port-results-summary');
  const list = document.getElementById('port-results-list');
  
  const openPorts = results.filter(r => r.status === 'open');
  const closedPorts = results.filter(r => r.status === 'closed');
  const timeoutPorts = results.filter(r => r.status === 'timeout');
  
  summary.innerHTML = `
    <span style="color: #2ecc71;">✅ ${openPorts.length} Open</span> | 
    <span style="color: #e74c3c;">❌ ${closedPorts.length} Closed</span> | 
    <span style="color: #f39c12;">⏱️ ${timeoutPorts.length} Timeout</span>
  `;
  
  // Only show open ports in the list
  list.innerHTML = openPorts.map(result => {
    const url = `${[443, 8443, 4443, 9443].includes(result.port) ? 'https' : 'http'}://${currentDomain}:${result.port}`;
    
    return `
      <div class="port-result" style="display: flex; justify-content: space-between; align-items: center; padding: 5px 0; border-bottom: 1px solid #444;">
        <span>Port ${result.port} (${result.service})</span>
        <span class="port-open" style="display: flex; align-items: center; gap: 5px;">
          ✅ Open
          <a href="${url}" target="_blank" style="color: #3498db; text-decoration: none; margin-left: 5px;" title="Open ${url}">🔗</a>
        </span>
      </div>
    `;
  }).join('');
  
  // Show message if no open ports found
  if (openPorts.length === 0) {
    list.innerHTML = '<div style="text-align: center; padding: 20px; color: #888;">No open ports found</div>';
  }
  
  dropdown.style.display = 'block';
}

// Load existing port scan results
function loadExistingPortResults() {
  if (!currentDomain) return;
  
  chrome.storage.local.get([`portScanResults_${currentDomain}`], (result) => {
    const scanResults = result[`portScanResults_${currentDomain}`];
    if (scanResults && scanResults.results) {
      // Check if results are recent (within 1 hour)
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      if (scanResults.timestamp > oneHourAgo) {
        showPortResultsDropdown(scanResults.results);
      }
    }
  });
}

// Load all components on popup open (after DOM is ready)
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing popup...'); // Debug log
  
  // Load all dynamic content
  loadCustomDorks();
  loadCustomTools();
  loadCustomCommands();
  loadCustomPorts();
  
  // Check for active scans and restore UI
  checkForActiveScans();
  
  // Open all dorks button
  const openAllDorksBtn = document.getElementById('open-all-dorks');
  if (openAllDorksBtn) {
    openAllDorksBtn.addEventListener('click', () => {
      openAllDorks();
    });
  }
  
  // Load auto port scan setting
  chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
    if (response && response.autoPortScan !== undefined) {
      const autoPortScanSwitch = document.getElementById('auto-port-scan-switch');
      if (autoPortScanSwitch) {
        autoPortScanSwitch.checked = response.autoPortScan;
      }
    }
  });
  
  // Auto port scan toggle
  const autoPortScanSwitch = document.getElementById('auto-port-scan-switch');
  if (autoPortScanSwitch) {
    autoPortScanSwitch.addEventListener('change', () => {
      chrome.runtime.sendMessage({
        action: 'updateAutoPortScan',
        autoPortScan: autoPortScanSwitch.checked
      });
    });
  }
  
  // Configure ports button
  const configPortsBtn = document.getElementById('config-ports');
  if (configPortsBtn) {
    configPortsBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'config/port-config.html' });
    });
  }
  
  // Port scanner functionality
  const portScannerBtn = document.getElementById('port-scanner');
  if (portScannerBtn) {
    console.log('Port scanner button found, adding event listener'); // Debug log
    portScannerBtn.addEventListener('click', () => {
      console.log('Port scanner button clicked!'); // Debug log
      startPortScan();
    });
  } else {
    console.error('Port scanner button not found!');
  }
  
  // Load existing port results if available
  setTimeout(loadExistingPortResults, 500);
});

// Check for active scans when popup opens
function checkForActiveScans() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    
    chrome.runtime.sendMessage({
      action: 'getActiveScan',
      tabId: tabs[0].id
    }, (response) => {
      if (response && response.isScanning) {
        console.log('Active scan detected:', response.scanType, 'Progress:', response.completed, '/', response.total);
        
        if (response.scanType === 'sensitive') {
          // Restore sensitive file scan UI
          const progressDiv = document.getElementById('sensitive-scan-progress');
          const progressFill = document.getElementById('sensitive-progress-fill');
          const progressText = document.getElementById('sensitive-progress-text');
          const button = document.getElementById('rescan-now');
          const buttonCurrentUrl = document.getElementById('rescan-current-url');
          
          if (progressDiv && progressFill && progressText) {
            progressDiv.style.display = 'block';
            const percentage = response.total > 0 ? (response.completed / response.total) * 100 : 0;
            progressFill.style.width = percentage + '%';
            progressText.textContent = response.total > 0 ? 
              `Scanning... (${response.completed}/${response.total})` : 
              'Starting scan...';
          }
          
          if (button) {
            button.disabled = true;
            button.textContent = 'Scanning...';
          }
          if (buttonCurrentUrl) {
            buttonCurrentUrl.disabled = true;
            buttonCurrentUrl.textContent = 'Scanning...';
          }
        } else if (response.scanType === 'port') {
          // Restore port scan UI
          const progressDiv = document.getElementById('port-scan-progress');
          const progressFill = document.getElementById('port-progress-fill');
          const progressText = document.getElementById('port-progress-text');
          const resultsDiv = document.getElementById('port-scan-results');
          const button = document.getElementById('port-scanner');
          
          if (progressDiv && progressFill && progressText) {
            progressDiv.style.display = 'block';
            const percentage = response.total > 0 ? (response.completed / response.total) * 100 : 0;
            progressFill.style.width = percentage + '%';
            progressText.textContent = response.total > 0 ? 
              `Scanning ports... (${response.completed}/${response.total})` : 
              'Starting port scan...';
          }
          
          if (button) {
            button.disabled = true;
            button.textContent = '🔍 Scanning...';
          }
          
          // Restore partial results from storage
          if (resultsDiv && currentDomain) {
            chrome.storage.local.get([`portScanResults_${currentDomain}`], (result) => {
              const scanResults = result[`portScanResults_${currentDomain}`];
              if (scanResults && scanResults.results) {
                // Clear and repopulate results
                resultsDiv.innerHTML = '';
                scanResults.results.forEach(portResult => {
                  addPortResult(portResult.port, portResult.service, portResult.status);
                });
              }
            });
          }
        }
      } else {
        console.log('No active scan found for this tab');
      }
    });
  });
}
