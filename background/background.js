// Background service worker for sensitive file scanning

let scannerEnabled = false;
let sensitiveFilesList = [];
let previewLength = 100;
let exclusionList = [];
let customCommands = [];
let customDorks = [];
let customTools = [];
let rescanInterval = 12; // hours
let falsePositiveProtection = true; // Default: enabled
let showNotifications = true; // Default: enabled
let customPorts = []; // Custom port list for HTTP scanning
let autoPortScan = false; // Auto port scan on page load

// Track active scans per tab
let activeScans = {
  // tabId: { type: 'sensitive' | 'port', startTime: timestamp, total: number, completed: number }
};

// Load settings from storage
chrome.storage.local.get(['scannerEnabled', 'sensitiveFilesList', 'previewLength', 'exclusionList', 'customCommands', 'customDorks', 'customTools', 'rescanInterval', 'falsePositiveProtection', 'showNotifications', 'customPorts', 'autoPortScan'], (result) => {
  scannerEnabled = result.scannerEnabled || false;
  sensitiveFilesList = result.sensitiveFilesList || getDefaultFilesList();
  previewLength = result.previewLength || 100;
  exclusionList = result.exclusionList || [];
  customCommands = result.customCommands || getDefaultCommands();
  customDorks = result.customDorks || getDefaultDorks();
  customTools = result.customTools || getDefaultTools();
  rescanInterval = result.rescanInterval || 12;
  falsePositiveProtection = result.falsePositiveProtection !== undefined ? result.falsePositiveProtection : true;
  showNotifications = result.showNotifications !== undefined ? result.showNotifications : true;
  customPorts = result.customPorts || getDefaultPorts();
  autoPortScan = result.autoPortScan || false;
  
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
    'dump.sql',
    '{DOMAIN}.zip',
    'backup-{DOMAIN}.sql',
    '{DOMAIN}-db-backup.tar.gz',
    'robots.txt'
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

      // Check if domain is excluded
      if (isDomainExcluded(domain)) {
        console.log('Domain excluded from scanning:', domain);
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
        
        // Check if domain is excluded
        if (isDomainExcluded(domain)) {
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

// Check if domain matches exclusion patterns
function isDomainExcluded(domain) {
  return exclusionList.some(pattern => {
    // Convert wildcard pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')  // Escape dots
      .replace(/\*/g, '.*');   // Convert * to .*
    
    const regex = new RegExp('^' + regexPattern + '$', 'i');
    return regex.test(domain);
  });
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
  } else if (request.action === 'getSettings') {
    sendResponse({
      scannerEnabled: scannerEnabled,
      sensitiveFilesList: sensitiveFilesList,
      previewLength: previewLength,
      exclusionList: exclusionList,
      customCommands: customCommands,
      customDorks: customDorks,
      customTools: customTools,
      rescanInterval: rescanInterval,
      falsePositiveProtection: falsePositiveProtection,
      showNotifications: showNotifications,
      customPorts: customPorts,
      autoPortScan: autoPortScan
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
          falsePositiveProtection: falsePositiveProtection
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
                  falsePositiveProtection: falsePositiveProtection
                }, (retryResponse) => {
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
              sendResponse({ success: false, message: 'Failed to inject content script: ' + err.message });
            });
            return;
          }

          if (response && response.foundFiles) {
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
            sendResponse({ success: false, message: 'Scan failed' });
          }
        });
      });
    } catch (error) {
      sendResponse({ success: false, message: 'Invalid URL: ' + error.message });
    }

    return true; // Keep channel open for async response
  } else if (request.action === 'reloadSettings') {
    // Reload all settings from storage after import
    chrome.storage.local.get(['scannerEnabled', 'sensitiveFilesList', 'previewLength', 'exclusionList', 'customCommands', 'customDorks', 'customTools', 'rescanInterval', 'falsePositiveProtection'], (result) => {
      scannerEnabled = result.scannerEnabled || false;
      sensitiveFilesList = result.sensitiveFilesList || getDefaultFilesList();
      previewLength = result.previewLength || 100;
      exclusionList = result.exclusionList || [];
      customCommands = result.customCommands || getDefaultCommands();
      customDorks = result.customDorks || getDefaultDorks();
      customTools = result.customTools || getDefaultTools();
      rescanInterval = result.rescanInterval || 12;
      falsePositiveProtection = result.falsePositiveProtection !== undefined ? result.falsePositiveProtection : true;
      
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
    // Update scan progress
    if (activeScans[request.tabId]) {
      activeScans[request.tabId].completed = request.completed;
      activeScans[request.tabId].total = request.total;
    }
    // Forward progress to popup if it's listening
    chrome.runtime.sendMessage(request).catch(() => {
      // Popup not open, ignore
    });
  } else if (request.action === 'scanCompleted') {
    // Remove from active scans
    delete activeScans[request.tabId];
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
