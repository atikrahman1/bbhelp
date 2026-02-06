// Background service worker for sensitive file scanning

let scannerEnabled = false;
let sensitiveFilesList = [];
let previewLength = 100;
let exclusionList = [];
let scopeList = [];
let customCommands = [];
let customDorks = [];
let customTools = [];
let rescanInterval = 12; // hours
let falsePositiveProtection = true; // Default: enabled
let showNotifications = true; // Default: enabled
let customPorts = []; // Custom port list for HTTP scanning
let autoPortScan = false; // Auto port scan on page load
let scanEngine = 'sequential'; // 'sequential' or 'parallel'
let requestDelay = 100; // ms delay between requests (rate limiting)
let parallelConcurrency = 5; // Number of concurrent requests for parallel engine
let dorksDelay = 3000; // ms delay between opening Google dork tabs

// Track active scans per tab
let activeScans = {
  // tabId: { type: 'sensitive' | 'port', startTime: timestamp, total: number, completed: number }
};

// Draw circular progress icon on extension badge
function updateProgressIcon(tabId, completed, total) {
  const size = 32;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const center = size / 2;
  const radius = 12;
  const lineWidth = 3;
  const progress = total > 0 ? completed / total : 0;
  
  // Clear
  ctx.clearRect(0, 0, size, size);
  
  // Background circle (dark)
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  
  // Progress arc (green)
  if (progress > 0) {
    ctx.beginPath();
    ctx.arc(center, center, radius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * progress));
    ctx.strokeStyle = '#00ff41';
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  
  // Percentage text in center
  const pct = Math.round(progress * 100);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 9px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${pct}%`, center, center);
  
  const imageData = ctx.getImageData(0, 0, size, size);
  chrome.action.setIcon({ tabId: tabId, imageData: { '32': imageData } });
}

// Restore original extension icon
function restoreIcon(tabId) {
  chrome.action.setIcon({
    tabId: tabId,
    path: {
      '16': 'icons/icon16.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png'
    }
  });
}

// Load settings from storage
chrome.storage.local.get(['scannerEnabled', 'sensitiveFilesList', 'previewLength', 'exclusionList', 'scopeList', 'customCommands', 'customDorks', 'customTools', 'rescanInterval', 'falsePositiveProtection', 'showNotifications', 'customPorts', 'autoPortScan', 'scanEngine', 'requestDelay', 'parallelConcurrency', 'dorksDelay'], (result) => {
  scannerEnabled = result.scannerEnabled || false;
  sensitiveFilesList = result.sensitiveFilesList || getDefaultFilesList();
  previewLength = result.previewLength || 100;
  exclusionList = result.exclusionList || [];
  scopeList = result.scopeList || [];
  customCommands = result.customCommands || getDefaultCommands();
  customDorks = result.customDorks || getDefaultDorks();
  customTools = result.customTools || getDefaultTools();
  rescanInterval = result.rescanInterval || 12;
  falsePositiveProtection = result.falsePositiveProtection !== undefined ? result.falsePositiveProtection : true;
  showNotifications = result.showNotifications !== undefined ? result.showNotifications : true;
  customPorts = result.customPorts || getDefaultPorts();
  autoPortScan = result.autoPortScan || false;
  scanEngine = result.scanEngine || 'sequential';
  requestDelay = result.requestDelay !== undefined ? result.requestDelay : 100;
  parallelConcurrency = result.parallelConcurrency || 5;
  dorksDelay = result.dorksDelay !== undefined ? result.dorksDelay : 3000;
  
  // Migrate existing scan results to new scan history format (one-time migration)
  migrateScanResults();
});

// Migrate existing scan results to new scan history format
function migrateScanResults() {
  chrome.storage.local.get(null, (allItems) => {
    const scanResults = {};
    const scanHistories = {};
    
    // Find all scanResults_* and scanHistory_* entries
    Object.keys(allItems).forEach(key => {
      if (key.startsWith('scanResults_')) {
        const domain = key.replace('scanResults_', '');
        scanResults[domain] = allItems[key];
      } else if (key.startsWith('scanHistory_')) {
        const domain = key.replace('scanHistory_', '');
        scanHistories[domain] = allItems[key];
      }
    });
    
    // Get existing new scan history
    chrome.storage.local.get(['scanHistory'], (result) => {
      let newHistory = result.scanHistory || [];
      
      // Convert old format to new format
      Object.keys(scanResults).forEach(domain => {
        const foundFiles = scanResults[domain] || [];
        const scanInfo = scanHistories[domain];
        
        // Only migrate if files were found
        if (foundFiles.length > 0) {
          // Check if already migrated
          const alreadyExists = newHistory.some(scan => scan.domain === domain);
          
          if (!alreadyExists) {
            const scanResult = {
              domain: domain,
              url: `https://${domain}`,
              timestamp: scanInfo?.lastScan || Date.now(),
              foundFiles: foundFiles,
              totalScanned: scanInfo?.filesList?.length || sensitiveFilesList.length,
              protectionEnabled: falsePositiveProtection
            };
            
            newHistory.push(scanResult);
            console.log('Migrated scan result for:', domain, '- Found', foundFiles.length, 'files');
          }
        }
      });
      
      // Save migrated history
      if (newHistory.length > 0) {
        chrome.storage.local.set({ scanHistory: newHistory });
        console.log('Migration complete. Total scan history entries:', newHistory.length);
      }
    });
  });
}

// Perform auto port scan
async function performAutoPortScan(tabId, domain) {
  try {
    // Check if we already have recent port scan results (within 1 hour)
    const storageKey = `portScanResults_${domain}`;
    chrome.storage.local.get([storageKey], async (result) => {
      const existingResults = result[storageKey];
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      
      if (existingResults && existingResults.timestamp > oneHourAgo) {
        console.log(`[Port Scanner] Using cached results for ${domain}`);
        return;
      }
      
      console.log(`[Port Scanner] Starting auto scan for ${domain}`);
      
      // Perform port scan with custom ports
      const results = [];
      for (const portInfo of customPorts) {
        try {
          const isOpen = await checkPortFromBackground(domain, portInfo.port);
          results.push({
            port: portInfo.port,
            service: portInfo.service,
            status: isOpen ? 'open' : 'closed',
            timestamp: Date.now()
          });
        } catch (error) {
          results.push({
            port: portInfo.port,
            service: portInfo.service,
            status: 'timeout',
            timestamp: Date.now()
          });
        }
      }
      
      // Store results
      const scanResults = {
        domain: domain,
        results: results,
        timestamp: Date.now()
      };
      
      chrome.storage.local.set({ [storageKey]: scanResults });
      
      // Count open ports
      const openPorts = results.filter(r => r.status === 'open').length;
      console.log(`[Port Scanner] Auto scan complete for ${domain}: ${openPorts} open ports`);
      
      // Send message to popup if it's open
      chrome.runtime.sendMessage({
        action: 'autoPortScanComplete',
        domain: domain,
        openPorts: openPorts,
        results: results
      }).catch(() => {
        // Popup not open, ignore error
      });
    });
  } catch (error) {
    console.error('[Port Scanner] Auto scan failed:', error);
  }
}

// Check port from background (simplified version)
async function checkPortFromBackground(domain, port) {
  return new Promise((resolve) => {
    const timeout = 3000;
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
    .catch(() => {
      clearTimeout(timeoutId);
      resolve(false);
    });
  });
}

// Default sensitive files list
function getDefaultFilesList() {
  return [
    // Environment & Config
    '.env',
    '.env.local',
    '.env.production',
    '.env.development',
    '.env.staging',
    '.env.backup',
    '.env.bak',
    '.env.old',
    '.env.save',
    '.env.example',
    'config.php',
    'config.yaml',
    'config.yml',
    'config.json',
    'config.xml',
    'config.inc.php',
    'configuration.php',
    'settings.py',
    'settings.json',
    'application.yml',
    'application.properties',
    // Server Config
    '.htaccess',
    '.htpasswd',
    'web.config',
    'web.config.bak',
    'nginx.conf',
    'server-status',
    'server-info',
    // Version Control
    '.git/config',
    '.git/HEAD',
    '.gitignore',
    '.svn/entries',
    '.svn/wc.db',
    '.hg/hgrc',
    // Shell & History
    '.bash_history',
    '.zsh_history',
    '.sh_history',
    // Backups & Archives
    'backup.zip',
    'backup.tar.gz',
    'backup.sql',
    'backup.sql.gz',
    'backup.rar',
    'website.zip',
    '{DOMAIN}.zip',
    '{DOMAIN}.tar.gz',
    '{DOMAIN}.7z',
    '{DOMAIN}.rar',
    '{DOMAIN}-backup.zip',
    'backup-{DOMAIN}.zip',
    'backup-{DOMAIN}.sql',
    '{DOMAIN}-db-backup.tar.gz',
    '{DOMAIN}.sql',
    '{DOMAIN}.sql.gz',
    'site.zip',
    'www.zip',
    'html.zip',
    'public.zip',
    // Database
    'db.sql',
    'database.sql',
    'dump.sql',
    'data.sql',
    'mysql.sql',
    // Logs
    'debug.log',
    'error.log',
    'access.log',
    'laravel.log',
    'npm-debug.log',
    'storage/logs/laravel.log',
    'logs/error.log',
    'logs/access.log',
    // Package & Dependency
    'composer.json',
    'composer.lock',
    'package.json',
    'package-lock.json',
    'yarn.lock',
    'Gemfile',
    'Gemfile.lock',
    'requirements.txt',
    'Pipfile',
    'vendor/composer/installed.json',
    // PHP
    'phpinfo.php',
    'info.php',
    'test.php',
    'adminer.php',
    'wp-config.php',
    'wp-config.php.bak',
    'wp-config.php.old',
    'wp-config.php.save',
    'wp-config.php.swp',
    'wp-config.php.txt',
    'wp-login.php',
    'xmlrpc.php',
    // API & Documentation
    'swagger.json',
    'swagger.yaml',
    'openapi.json',
    'openapi.yaml',
    'api-docs',
    'graphql',
    'api/v1',
    'api/v2',
    // Info Disclosure
    'robots.txt',
    'sitemap.xml',
    'crossdomain.xml',
    'clientaccesspolicy.xml',
    '.well-known/security.txt',
    'security.txt',
    'humans.txt',
    'CHANGELOG.md',
    'CHANGELOG.txt',
    'README.md',
    'README.txt',
    'VERSION',
    'version.txt',
    '.DS_Store',
    'Thumbs.db',
    // Java / Spring Boot
    'actuator/health',
    'actuator/env',
    'actuator/info',
    'actuator/mappings',
    'actuator/configprops',
    'WEB-INF/web.xml',
    // .NET
    'elmah.axd',
    'trace.axd',
    'web.config.old',
    'web.config.txt',
    // Debug & Profiling
    '__debug__/',
    '_profiler/',
    'telescope',
    // Docker & CI
    'Dockerfile',
    'docker-compose.yml',
    '.dockerenv',
    '.travis.yml',
    '.gitlab-ci.yml',
    'Jenkinsfile',
    // Cloud & Keys
    '.aws/credentials',
    '.ssh/id_rsa',
    '.ssh/id_rsa.pub',
    'firebase.json',
    '.firebaserc'
  ];
}

// Default commands list
function getDefaultCommands() {
  return [
    { name: 'Nmap Quick Scan', command: 'nmap -T4 -F {TARGET}' },
    { name: 'Nmap Full Scan', command: 'nmap -p- -T4 {TARGET}' },
    { name: 'Nmap Fast Top Ports', command: 'nmap --top-ports 1000 -T4 {TARGET}' },
    { name: 'Subfinder', command: 'subfinder -d {DOMAIN} -o {DOMAIN}.txt' },
    { name: 'FFUF', command: 'ffuf -u {URL}/FUZZ -w /path/to/wordlist.txt -ac' },
    { name: 'Nuclei', command: 'nuclei -target {URL}' }
  ];
}

// Default Google Dorks list
function getDefaultDorks() {
  return [
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

// Default Tools list
function getDefaultTools() {
  return [
    { name: 'Shodan', url: 'https://beta.shodan.io/domain/{DOMAIN}' },
    { name: 'Crt.sh', url: 'https://crt.sh/?q={DOMAIN}' },
    { name: 'Subdomain Center', url: 'https://api.subdomain.center/?domain={DOMAIN}' },
    { name: 'Wayback Machine', url: 'https://web.archive.org/web/*/{DOMAIN}' }
  ];
}

// Default Ports list
function getDefaultPorts() {
  return [
    { port: 80, service: 'HTTP' },
    { port: 443, service: 'HTTPS' },
    { port: 8080, service: 'HTTP Alt' },
    { port: 8443, service: 'HTTPS Alt' },
    { port: 8000, service: 'HTTP Dev' },
    { port: 8888, service: 'HTTP Alt' },
    { port: 3000, service: 'Node.js' },
    { port: 5000, service: 'Flask/Dev' },
    { port: 9000, service: 'HTTP Alt' },
    { port: 8081, service: 'HTTP Alt' },
    { port: 8082, service: 'HTTP Alt' },
    { port: 8090, service: 'HTTP Alt' },
    { port: 9090, service: 'HTTP Alt' },
    { port: 4443, service: 'HTTPS Alt' },
    { port: 9443, service: 'HTTPS Alt' }
  ];
}

// Listen for tab updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (scannerEnabled && changeInfo.status === 'complete' && tab.url) {
    const url = new URL(tab.url);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      const domain = url.host;

      // Check scope/exclusion logic
      if (!isDomainAllowed(domain)) {
        console.log('Domain not allowed for scanning:', domain);
        return;
      }

      // Check if we need to scan (not scanned in last 12h or file list changed)
      const shouldScan = await checkIfShouldScan(domain);
      if (shouldScan) {
        console.log(`[Scanner] Starting fresh scan for ${domain}`);
        scanForSensitiveFiles(tabId, url, domain);
      } else {
        console.log(`[Scanner] Loading cached results for ${domain}`);
        // Load existing results and update badge
        loadExistingResults(tabId, domain);
      }
      
      // Auto port scan if enabled
      if (autoPortScan) {
        console.log(`[Scanner] Starting auto port scan for ${domain}`);
        performAutoPortScan(tabId, domain);
      }
    }
  }
});

// Listen for tab activation (switching between tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tabId = activeInfo.tabId;
  
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError || !tab.url) {
      return;
    }
    
    try {
      const url = new URL(tab.url);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        const domain = url.host;
        
        // Check scope/exclusion logic
        if (!isDomainAllowed(domain)) {
          return;
        }
        
        // Load existing results and update badge
        loadExistingResults(tabId, domain);
      }
    } catch (e) {
      // Invalid URL, ignore
    }
  });
});

// Check if domain matches a pattern list (wildcard support)
function domainMatchesPatterns(domain, patterns) {
  return patterns.some(pattern => {
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*');
    const regex = new RegExp('^' + regexPattern + '$', 'i');
    return regex.test(domain);
  });
}

// Check if domain is allowed for scanning (scope + exclusion logic)
function isDomainAllowed(domain) {
  // If scope list has entries → only scan those domains (exclusions ignored)
  if (scopeList.length > 0) {
    return domainMatchesPatterns(domain, scopeList);
  }
  // If scope list is empty → scan everything except exclusions
  return !domainMatchesPatterns(domain, exclusionList);
}

// Check if domain should be scanned
async function checkIfShouldScan(domain) {
  return new Promise((resolve) => {
    chrome.storage.local.get([`scanHistory_${domain}`], (result) => {
      const history = result[`scanHistory_${domain}`];

      if (!history) {
        resolve(true); // Never scanned
        return;
      }

      const now = Date.now();
      const intervalMs = rescanInterval * 60 * 60 * 1000; // Convert hours to milliseconds
      const timeSinceLastScan = now - history.lastScan;

      // Check if file list changed
      const fileListChanged = JSON.stringify(history.filesList) !== JSON.stringify(sensitiveFilesList);

      // Scan if interval passed OR file list changed
      resolve(timeSinceLastScan > intervalMs || fileListChanged);
    });
  });
}

// Load existing scan results
function loadExistingResults(tabId, domain) {
  chrome.storage.local.get([`scanResults_${domain}`], (result) => {
    const scanResults = result[`scanResults_${domain}`];
    if (scanResults && scanResults.length > 0) {
      // Clear badge first to ensure color updates properly
      chrome.action.setBadgeText({ text: '', tabId: tabId }, () => {
        // Set orange badge for cached results
        chrome.action.setBadgeBackgroundColor({ color: '#f39c12', tabId: tabId }, () => {
          chrome.action.setBadgeText({ text: scanResults.length.toString(), tabId: tabId });
        });
      });
      
      // Store found files for this tab
      chrome.storage.local.set({ [`foundFiles_${tabId}`]: scanResults });
      
      console.log(`[Scanner] Loaded cached results for ${domain}: ${scanResults.length} files (ORANGE badge)`);
    } else {
      // No results, clear badge
      chrome.action.setBadgeText({ text: '', tabId: tabId });
      console.log(`[Scanner] No cached results for ${domain}`);
    }
  });
}

// Scan for sensitive files - delegate to content script
function scanForSensitiveFiles(tabId, url, domain) {
  scanForSensitiveFilesWithCallback(tabId, url, domain, null);
}

function scanForSensitiveFilesWithCallback(tabId, url, domain, callback) {
  // Send message to content script to perform the scan
  chrome.tabs.sendMessage(tabId, {
    action: 'scanSensitiveFiles',
    filesList: sensitiveFilesList,
    previewLength: previewLength,
    baseUrl: `${url.protocol}//${url.host}`,
    falsePositiveProtection: falsePositiveProtection
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error scanning:', chrome.runtime.lastError.message);
      // Content script might not be ready, try injecting it
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content/content.js']
      }).then(() => {
        // Retry after injection
        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, {
            action: 'scanSensitiveFiles',
            filesList: sensitiveFilesList,
            previewLength: previewLength,
            baseUrl: `${url.protocol}//${url.host}`,
            falsePositiveProtection: falsePositiveProtection
          }, (retryResponse) => {
            if (retryResponse && retryResponse.foundFiles) {
              processScanResults(tabId, domain, retryResponse.foundFiles, callback);
            } else if (callback) {
              callback(0);
            }
          });
        }, 500);
      }).catch(err => {
        console.error('Failed to inject content script:', err);
        if (callback) callback(0);
      });
      return;
    }

    if (response && response.foundFiles) {
      processScanResults(tabId, domain, response.foundFiles, callback);
    } else if (callback) {
      callback(0);
    }
  });
}

// Process scan results
function processScanResults(tabId, domain, foundFiles, callback) {
  // Merge with existing results for this domain
  chrome.storage.local.get([`scanResults_${domain}`], (result) => {
    let existingResults = result[`scanResults_${domain}`] || [];

    // Merge: update existing files or add new ones
    foundFiles.forEach(newFile => {
      const existingIndex = existingResults.findIndex(f => f.file === newFile.file);
      if (existingIndex >= 0) {
        existingResults[existingIndex] = newFile; // Update
      } else {
        existingResults.push(newFile); // Add new
      }
    });

    // Store merged results
    chrome.storage.local.set({ [`scanResults_${domain}`]: existingResults });

    // Update scan history (old format)
    chrome.storage.local.set({
      [`scanHistory_${domain}`]: {
        lastScan: Date.now(),
        filesList: [...sensitiveFilesList]
      }
    });

    // Store in new scan history format for "All Results" page (only if files found)
    if (existingResults.length > 0) {
      const scanResult = {
        domain: domain,
        url: `https://${domain}`, // Reconstruct URL
        timestamp: Date.now(),
        foundFiles: existingResults,
        totalScanned: sensitiveFilesList.length,
        protectionEnabled: falsePositiveProtection
      };

      // Get existing scan history and add new result
      chrome.storage.local.get(['scanHistory'], (historyResult) => {
        let history = historyResult.scanHistory || [];
        
        // Check if we already have a recent scan for this domain (within last 5 minutes)
        const recentScanIndex = history.findIndex(scan => 
          scan.domain === domain && 
          (Date.now() - scan.timestamp) < 300000 // 5 minutes
        );
        
        if (recentScanIndex >= 0) {
          // Update existing recent scan
          history[recentScanIndex] = scanResult;
        } else {
          // Add new scan result
          history.push(scanResult);
        }
        
        // Keep only last 100 scans
        if (history.length > 100) {
          history = history.slice(-100);
        }
        
        // Save updated history
        chrome.storage.local.set({ scanHistory: history });
        console.log('Auto-scan result stored in history for:', domain, '- Found', existingResults.length, 'files'); // Debug log
      });
    }

    // Update badge and notification
    if (existingResults.length > 0) {
      // Clear badge first to ensure color updates properly
      chrome.action.setBadgeText({ text: '', tabId: tabId }, () => {
        // Set red badge for fresh scan results
        chrome.action.setBadgeBackgroundColor({ color: '#e74c3c', tabId: tabId }, () => {
          chrome.action.setBadgeText({ text: existingResults.length.toString(), tabId: tabId });
        });
      });

      // Store found files for this tab
      chrome.storage.local.set({ [`foundFiles_${tabId}`]: existingResults });

      console.log(`[Scanner] Fresh scan completed for ${domain}: ${existingResults.length} files (RED badge)`);

      // Notify popup to update button visibility
      chrome.runtime.sendMessage({
        action: 'scanComplete',
        domain: domain,
        count: existingResults.length
      }).catch(() => {
        // Popup might not be open, ignore error
      });

      // Show notification only for newly found files (if enabled)
      if (foundFiles.length > 0 && showNotifications) {
        chrome.notifications.create('bbhelp-scan-notification', {
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Sensitive Files Found!',
          message: `Found ${foundFiles.length} new file(s) on ${domain} (Total: ${existingResults.length})`,
          priority: 2
        }, (notificationId) => {
          if (chrome.runtime.lastError) {
            console.log('Notification failed:', chrome.runtime.lastError.message);
          }
        });
      }
    } else {
      chrome.action.setBadgeText({ text: '', tabId: tabId });
      console.log(`[Scanner] Fresh scan completed for ${domain}: No files found`);
    }
    
    // Call callback with result count
    if (callback) {
      callback(existingResults.length);
    }
  });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleScanner') {
    scannerEnabled = request.enabled;
    chrome.storage.local.set({ scannerEnabled: scannerEnabled });

    // Clear all badges if disabled
    if (!scannerEnabled) {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          chrome.action.setBadgeText({ text: '', tabId: tab.id });
        });
      });
    }

    sendResponse({ success: true });
  } else if (request.action === 'updateFilesList') {
    sensitiveFilesList = request.filesList;
    chrome.storage.local.set({ sensitiveFilesList: sensitiveFilesList });
    sendResponse({ success: true });
  } else if (request.action === 'updatePreviewLength') {
    previewLength = request.previewLength;
    chrome.storage.local.set({ previewLength: previewLength });
    sendResponse({ success: true });
  } else if (request.action === 'updateExclusionList') {
    exclusionList = request.exclusionList;
    chrome.storage.local.set({ exclusionList: exclusionList });
    sendResponse({ success: true });
  } else if (request.action === 'updateScopeList') {
    scopeList = request.scopeList;
    chrome.storage.local.set({ scopeList: scopeList });
    sendResponse({ success: true });
  } else if (request.action === 'updateCustomCommands') {
    customCommands = request.customCommands;
    chrome.storage.local.set({ customCommands: customCommands });
    sendResponse({ success: true });
  } else if (request.action === 'updateRescanInterval') {
    rescanInterval = request.rescanInterval;
    chrome.storage.local.set({ rescanInterval: rescanInterval });
    sendResponse({ success: true });
  } else if (request.action === 'updateFalsePositiveProtection') {
    falsePositiveProtection = request.falsePositiveProtection;
    chrome.storage.local.set({ falsePositiveProtection: falsePositiveProtection });
    sendResponse({ success: true });
  } else if (request.action === 'updateShowNotifications') {
    showNotifications = request.showNotifications;
    chrome.storage.local.set({ showNotifications: showNotifications });
    sendResponse({ success: true });
  } else if (request.action === 'updateCustomDorks') {
    customDorks = request.customDorks;
    chrome.storage.local.set({ customDorks: customDorks });
    sendResponse({ success: true });
  } else if (request.action === 'updateDorksDelay') {
    dorksDelay = request.dorksDelay;
    chrome.storage.local.set({ dorksDelay: dorksDelay });
    sendResponse({ success: true });
  } else if (request.action === 'updateCustomTools') {
    customTools = request.customTools;
    chrome.storage.local.set({ customTools: customTools });
    sendResponse({ success: true });
  } else if (request.action === 'updateCustomPorts') {
    customPorts = request.customPorts;
    chrome.storage.local.set({ customPorts: customPorts });
    sendResponse({ success: true });
  } else if (request.action === 'updateAutoPortScan') {
    autoPortScan = request.autoPortScan;
    chrome.storage.local.set({ autoPortScan: autoPortScan });
    sendResponse({ success: true });
  } else if (request.action === 'updateScanEngine') {
    scanEngine = request.scanEngine;
    chrome.storage.local.set({ scanEngine: scanEngine });
    sendResponse({ success: true });
  } else if (request.action === 'updateRequestDelay') {
    requestDelay = request.requestDelay;
    chrome.storage.local.set({ requestDelay: requestDelay });
    sendResponse({ success: true });
  } else if (request.action === 'updateParallelConcurrency') {
    parallelConcurrency = request.parallelConcurrency;
    chrome.storage.local.set({ parallelConcurrency: parallelConcurrency });
    sendResponse({ success: true });
  } else if (request.action === 'openAllDorks') {
    // Open all Google dorks with staggered delay (runs in background so popup can close)
    const dorks = customDorks.length > 0 ? customDorks : getDefaultDorks();
    let domain = '';
    try {
      const url = new URL(request.url);
      domain = url.hostname.replace('www.', '');
    } catch (e) { /* use empty domain */ }
    
    const delay = dorksDelay || 3000;
    dorks.forEach((dorkObj, index) => {
      setTimeout(() => {
        const finalDork = dorkObj.dork.replace(/\{DOMAIN\}/g, domain);
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(finalDork)}`;
        chrome.tabs.create({ url: searchUrl, active: false });
      }, index * delay);
    });
    
    sendResponse({ success: true });
  } else if (request.action === 'getSettings') {
    sendResponse({
      scannerEnabled: scannerEnabled,
      sensitiveFilesList: sensitiveFilesList,
      previewLength: previewLength,
      exclusionList: exclusionList,
      scopeList: scopeList,
      customCommands: customCommands,
      customDorks: customDorks,
      customTools: customTools,
      rescanInterval: rescanInterval,
      falsePositiveProtection: falsePositiveProtection,
      showNotifications: showNotifications,
      customPorts: customPorts,
      autoPortScan: autoPortScan,
      scanEngine: scanEngine,
      requestDelay: requestDelay,
      parallelConcurrency: parallelConcurrency,
      dorksDelay: dorksDelay
    });
  } else if (request.action === 'getFoundFiles') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        const url = new URL(tabs[0].url);
        const domain = url.host;

        // Get results from domain storage (persistent)
        chrome.storage.local.get([`scanResults_${domain}`], (result) => {
          sendResponse({ foundFiles: result[`scanResults_${domain}`] || [] });
        });
      }
    });
    return true; // Keep channel open for async response
  } else if (request.action === 'getAllResults') {
    // Get all scan results across all domains
    chrome.storage.local.get(null, (items) => {
      const allResults = {};
      Object.keys(items).forEach(key => {
        if (key.startsWith('scanResults_')) {
          const domain = key.replace('scanResults_', '');
          allResults[domain] = items[key];
        }
      });
      sendResponse({ allResults: allResults });
    });
    return true;
  } else if (request.action === 'forceRescan') {
    // Manual scan - works regardless of auto-scan setting
    try {
      const url = new URL(request.url);
      const domain = url.host;

      // Clear scan history to force rescan
      chrome.storage.local.remove([`scanHistory_${domain}`], () => {
        // Trigger scan and wait for results
        scanForSensitiveFilesWithCallback(request.tabId, url, domain, (foundCount) => {
          if (foundCount > 0) {
            sendResponse({ 
              success: true, 
              message: `Scan completed! Found ${foundCount} sensitive file(s).`,
              count: foundCount
            });
          } else {
            sendResponse({ 
              success: true, 
              message: 'Scan completed! No sensitive files found.',
              count: 0
            });
          }
        });
      });
    } catch (error) {
      sendResponse({ success: false, message: 'Invalid URL: ' + error.message });
    }

    return true; // Keep channel open for async response
  } else if (request.action === 'forceRescanWithProgress') {
    // Manual scan with progress tracking
    console.log('forceRescanWithProgress called for:', request.url); // Debug log
    try {
      const url = new URL(request.url);
      const domain = url.host;
      
      // Determine base URL based on scanMainHost parameter
      let baseUrl;
      if (request.scanMainHost === false) {
        // Scan current URL path: example.com/somepath/FUZZ
        const pathWithoutFile = url.pathname.substring(0, url.pathname.lastIndexOf('/') + 1);
        baseUrl = `${url.protocol}//${url.host}${pathWithoutFile}`;
        // Remove double slash if path already ends with /
        baseUrl = baseUrl.replace(/([^:]\/)\/+/g, '$1');
      } else {
        // Scan main host: example.com/FUZZ (default behavior)
        baseUrl = `${url.protocol}//${url.host}/`;
      }
      
      console.log('Base URL for scan:', baseUrl); // Debug log

      // Clear scan history to force rescan
      chrome.storage.local.remove([`scanHistory_${domain}`], () => {
        // Send scan request to content script with progress tracking
        chrome.tabs.sendMessage(request.tabId, {
          action: 'scanSensitiveFilesWithProgress',
          filesList: sensitiveFilesList,
          previewLength: previewLength,
          baseUrl: baseUrl,
          falsePositiveProtection: falsePositiveProtection,
          scanEngine: scanEngine,
          requestDelay: requestDelay,
          parallelConcurrency: parallelConcurrency
        }, (response) => {
          if (chrome.runtime.lastError) {
            // Content script might not be ready, try injecting it
            chrome.scripting.executeScript({
              target: { tabId: request.tabId },
              files: ['content/content.js']
            }).then(() => {
              // Retry after injection
              setTimeout(() => {
                chrome.tabs.sendMessage(request.tabId, {
                  action: 'scanSensitiveFilesWithProgress',
                  filesList: sensitiveFilesList,
                  previewLength: previewLength,
                  baseUrl: baseUrl,
                  falsePositiveProtection: falsePositiveProtection,
                  scanEngine: scanEngine,
                  requestDelay: requestDelay,
                  parallelConcurrency: parallelConcurrency
                }, (retryResponse) => {
                  // Clean up active scan tracking
                  delete activeScans[request.tabId];
                  restoreIcon(request.tabId);
                  
                  if (retryResponse && retryResponse.foundFiles) {
                    // Store results in the old format for compatibility
                    processScanResults(request.tabId, domain, retryResponse.foundFiles, null);
                    
                    // Send response with all needed data for history storage
                    sendResponse({ 
                      success: true, 
                      message: retryResponse.foundFiles.length > 0 ? 
                        `Found ${retryResponse.foundFiles.length} sensitive file(s)!` : 
                        'No sensitive files found.',
                      count: retryResponse.foundFiles.length,
                      foundFiles: retryResponse.foundFiles,
                      totalScanned: sensitiveFilesList.length,
                      protectionEnabled: falsePositiveProtection
                    });
                  } else {
                    sendResponse({ success: false, message: 'Scan failed' });
                  }
                });
              }, 500);
            }).catch(err => {
              delete activeScans[request.tabId];
              restoreIcon(request.tabId);
              sendResponse({ success: false, message: 'Failed to inject content script: ' + err.message });
            });
            return;
          }

          if (response && response.foundFiles) {
            // Clean up active scan tracking
            delete activeScans[request.tabId];
            restoreIcon(request.tabId);
            
            // Store results in the old format for compatibility
            processScanResults(request.tabId, domain, response.foundFiles, null);
            
            // Send response with all needed data for history storage
            sendResponse({ 
              success: true, 
              message: response.foundFiles.length > 0 ? 
                `Found ${response.foundFiles.length} sensitive file(s)!` : 
                'No sensitive files found.',
              count: response.foundFiles.length,
              foundFiles: response.foundFiles,
              totalScanned: sensitiveFilesList.length,
              protectionEnabled: falsePositiveProtection
            });
          } else {
            delete activeScans[request.tabId];
            restoreIcon(request.tabId);
            sendResponse({ success: false, message: 'Scan failed' });
          }
        });
      });
    } catch (error) {
      delete activeScans[request.tabId];
      restoreIcon(request.tabId);
      sendResponse({ success: false, message: 'Invalid URL: ' + error.message });
    }

    return true; // Keep channel open for async response
  } else if (request.action === 'reloadSettings') {
    // Reload all settings from storage after import
    chrome.storage.local.get(['scannerEnabled', 'sensitiveFilesList', 'previewLength', 'exclusionList', 'scopeList', 'customCommands', 'customDorks', 'customTools', 'rescanInterval', 'falsePositiveProtection', 'scanEngine', 'requestDelay', 'parallelConcurrency'], (result) => {
      scannerEnabled = result.scannerEnabled || false;
      sensitiveFilesList = result.sensitiveFilesList || getDefaultFilesList();
      previewLength = result.previewLength || 100;
      exclusionList = result.exclusionList || [];
      scopeList = result.scopeList || [];
      customCommands = result.customCommands || getDefaultCommands();
      customDorks = result.customDorks || getDefaultDorks();
      customTools = result.customTools || getDefaultTools();
      rescanInterval = result.rescanInterval || 12;
      falsePositiveProtection = result.falsePositiveProtection !== undefined ? result.falsePositiveProtection : true;
      scanEngine = result.scanEngine || 'sequential';
      requestDelay = result.requestDelay !== undefined ? result.requestDelay : 100;
      parallelConcurrency = result.parallelConcurrency || 5;
      
      sendResponse({ success: true });
    });
    return true;
  } else if (request.action === 'scanStarted') {
    // Track that a scan has started
    activeScans[request.tabId] = {
      type: request.scanType,
      startTime: Date.now(),
      total: request.total || 0,
      completed: 0
    };
    sendResponse({ success: true });
  } else if (request.action === 'scanProgress') {
    // Update scan progress (use sender.tab.id for content script messages)
    const tabId = request.tabId || (sender && sender.tab ? sender.tab.id : null);
    if (tabId && activeScans[tabId]) {
      activeScans[tabId].completed = request.completed;
      activeScans[tabId].total = request.total;
    }
    // Update extension icon with circular progress
    if (tabId && request.total > 0) {
      updateProgressIcon(tabId, request.completed, request.total);
      // Show progress on badge too
      const pct = Math.round((request.completed / request.total) * 100);
      chrome.action.setBadgeBackgroundColor({ color: '#00ff41', tabId: tabId });
      chrome.action.setBadgeText({ text: `${pct}%`, tabId: tabId });
    }
    // Forward progress to popup if it's listening
    chrome.runtime.sendMessage(request).catch(() => {
      // Popup not open, ignore
    });
  } else if (request.action === 'scanCompleted') {
    // Remove from active scans and restore icon
    delete activeScans[request.tabId];
    restoreIcon(request.tabId);
    sendResponse({ success: true });
  } else if (request.action === 'getActiveScan') {
    // Check if tab has active scan
    const scan = activeScans[request.tabId];
    if (scan) {
      sendResponse({
        isScanning: true,
        scanType: scan.type,
        total: scan.total,
        completed: scan.completed,
        startTime: scan.startTime
      });
    } else {
      sendResponse({ isScanning: false });
    }
    return true;
  } else if (request.action === 'startPortScan') {
    // Start port scan in background
    const tabId = request.tabId;
    const domain = request.domain;
    
    // Mark scan as started
    activeScans[tabId] = {
      type: 'port',
      startTime: Date.now(),
      total: customPorts.length,
      completed: 0
    };
    
    // Start scanning in background
    performPortScan(tabId, domain);
    sendResponse({ success: true, message: 'Port scan started' });
    return true;
  }

  return true;
});

// Perform port scan in background
async function performPortScan(tabId, domain) {
  const results = [];
  
  for (let i = 0; i < customPorts.length; i++) {
    const portInfo = customPorts[i];
    
    try {
      const isOpen = await checkPortFromBackground(domain, portInfo.port);
      const status = isOpen ? 'open' : 'closed';
      
      results.push({
        port: portInfo.port,
        service: portInfo.service,
        status: status,
        timestamp: Date.now()
      });
      
      // Save partial results immediately
      chrome.storage.local.set({ 
        [`portScanResults_${domain}`]: {
          domain: domain,
          results: results,
          timestamp: Date.now(),
          inProgress: true
        }
      });
      
      // Update progress
      if (activeScans[tabId]) {
        activeScans[tabId].completed = i + 1;
      }
      
      // Update extension icon with progress
      updateProgressIcon(tabId, i + 1, customPorts.length);
      chrome.action.setBadgeBackgroundColor({ color: '#00ff41', tabId: tabId });
      chrome.action.setBadgeText({ text: `${Math.round(((i + 1) / customPorts.length) * 100)}%`, tabId: tabId });
      
      // Send progress update to popup
      chrome.runtime.sendMessage({
        action: 'portScanProgress',
        tabId: tabId,
        completed: i + 1,
        total: customPorts.length,
        currentPort: portInfo.port,
        currentService: portInfo.service,
        result: { port: portInfo.port, service: portInfo.service, status: status }
      }).catch(() => {
        // Popup not open, ignore
      });
      
    } catch (error) {
      results.push({
        port: portInfo.port,
        service: portInfo.service,
        status: 'timeout',
        timestamp: Date.now()
      });
      
      // Save partial results immediately
      chrome.storage.local.set({ 
        [`portScanResults_${domain}`]: {
          domain: domain,
          results: results,
          timestamp: Date.now(),
          inProgress: true
        }
      });
      
      // Update progress
      if (activeScans[tabId]) {
        activeScans[tabId].completed = i + 1;
      }
      
      // Update extension icon with progress
      updateProgressIcon(tabId, i + 1, customPorts.length);
      chrome.action.setBadgeBackgroundColor({ color: '#00ff41', tabId: tabId });
      chrome.action.setBadgeText({ text: `${Math.round(((i + 1) / customPorts.length) * 100)}%`, tabId: tabId });
      
      // Send progress update
      chrome.runtime.sendMessage({
        action: 'portScanProgress',
        tabId: tabId,
        completed: i + 1,
        total: customPorts.length,
        currentPort: portInfo.port,
        currentService: portInfo.service,
        result: { port: portInfo.port, service: portInfo.service, status: 'timeout' }
      }).catch(() => {
        // Popup not open, ignore
      });
    }
  }
  
  // Store final results
  const scanResults = {
    domain: domain,
    results: results,
    timestamp: Date.now(),
    inProgress: false
  };
  
  chrome.storage.local.set({ [`portScanResults_${domain}`]: scanResults });
  
  // Remove from active scans
  delete activeScans[tabId];
  restoreIcon(tabId);
  
  // Notify completion
  const openPorts = results.filter(r => r.status === 'open').length;
  chrome.runtime.sendMessage({
    action: 'portScanComplete',
    tabId: tabId,
    results: results,
    openPorts: openPorts
  }).catch(() => {
    // Popup not open, ignore
  });
  
  console.log(`[Port Scanner] Scan complete for ${domain}: ${openPorts} open ports`);
}
