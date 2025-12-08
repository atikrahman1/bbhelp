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

// Load settings from storage
chrome.storage.local.get(['scannerEnabled', 'sensitiveFilesList', 'previewLength', 'exclusionList', 'customCommands', 'customDorks', 'customTools', 'rescanInterval', 'falsePositiveProtection', 'showNotifications'], (result) => {
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
});

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
    { name: 'Subdomain Center', url: 'https://api.subdomain.center/?domain={DOMAIN}' }
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
    }
  }
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
        files: ['content.js']
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

    // Update scan history
    chrome.storage.local.set({
      [`scanHistory_${domain}`]: {
        lastScan: Date.now(),
        filesList: [...sensitiveFilesList]
      }
    });

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
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon48.png',
          title: 'Sensitive Files Found!',
          message: `Found ${foundFiles.length} new file(s) on ${domain} (Total: ${existingResults.length})`,
          priority: 2
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
      showNotifications: showNotifications
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
  }

  return true;
});
