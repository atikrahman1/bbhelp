// Load settings when DOM is ready
function loadSettings() {
  console.log('Loading settings...'); // Debug log
  
  chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
    console.log('Settings response:', response); // Debug log
    
    if (chrome.runtime.lastError) {
      console.error('Error loading settings:', chrome.runtime.lastError);
      // Retry after a short delay
      setTimeout(loadSettings, 500);
      return;
    }
    
    if (response) {
      if (response.sensitiveFilesList) {
        const filesListEl = document.getElementById('files-list');
        if (filesListEl) {
          filesListEl.value = response.sensitiveFilesList.join('\n');
          console.log('Loaded', response.sensitiveFilesList.length, 'files'); // Debug log
        }
      }
      if (response.previewLength) {
        const previewLengthEl = document.getElementById('preview-length');
        if (previewLengthEl) {
          previewLengthEl.value = response.previewLength;
        }
      }
      if (response.rescanInterval) {
        const rescanIntervalEl = document.getElementById('rescan-interval');
        if (rescanIntervalEl) {
          rescanIntervalEl.value = response.rescanInterval;
        }
      }
      if (response.falsePositiveProtection !== undefined) {
        const fpProtectionEl = document.getElementById('false-positive-protection');
        if (fpProtectionEl) {
          fpProtectionEl.checked = response.falsePositiveProtection;
        }
      }
      if (response.showNotifications !== undefined) {
        const showNotifsEl = document.getElementById('show-notifications');
        if (showNotifsEl) {
          showNotifsEl.checked = response.showNotifications;
        }
      }
      
      console.log('Settings loaded successfully'); // Debug log
    } else {
      console.warn('No settings response received, retrying...'); // Debug log
      // Retry after a short delay
      setTimeout(loadSettings, 500);
    }
  });
}

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing config page...'); // Debug log
  loadSettings();
});

// Save button
document.getElementById('save-btn').addEventListener('click', () => {
  const textarea = document.getElementById('files-list');
  const files = textarea.value.split('\n').map(f => f.trim()).filter(f => f.length > 0);
  const previewLen = parseInt(document.getElementById('preview-length').value) || 100;
  const rescanInt = parseInt(document.getElementById('rescan-interval').value) || 12;
  const fpProtection = document.getElementById('false-positive-protection').checked;
  const showNotifs = document.getElementById('show-notifications').checked;
  
  // Validate rescan interval
  if (rescanInt < 1 || rescanInt > 168) {
    showMessage('Rescan interval must be between 1 and 168 hours', 'error');
    return;
  }
  
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
          // Save rescan interval
          chrome.runtime.sendMessage({
            action: 'updateRescanInterval',
            rescanInterval: rescanInt
          }, (response3) => {
            if (response3 && response3.success) {
              // Save false positive protection
              chrome.runtime.sendMessage({
                action: 'updateFalsePositiveProtection',
                falsePositiveProtection: fpProtection
              }, (response4) => {
                if (response4 && response4.success) {
                  // Save show notifications
                  chrome.runtime.sendMessage({
                    action: 'updateShowNotifications',
                    showNotifications: showNotifs
                  }, (response5) => {
                    if (response5 && response5.success) {
                      showMessage('Settings saved successfully!', 'success');
                    } else {
                      showMessage('Failed to save notification settings', 'error');
                    }
                  });
                } else {
                  showMessage('Failed to save false positive protection', 'error');
                }
              });
            } else {
              showMessage('Failed to save rescan interval', 'error');
            }
          });
        } else {
          showMessage('Failed to save preview length', 'error');
        }
      });
    } else {
      showMessage('Failed to save file list', 'error');
    }
  });
});

// Reset button
document.getElementById('reset-btn').addEventListener('click', () => {
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
    'dump.sql',
    '{DOMAIN}.zip',
    'backup-{DOMAIN}.sql',
    '{DOMAIN}-db-backup.tar.gz',
    'robots.txt'
  ];
  
  document.getElementById('files-list').value = defaultFiles.join('\n');
  showMessage('Reset to default list. Click Save to apply.', 'success');
});

// Show message
function showMessage(text, type) {
  const msg = document.getElementById('message');
  msg.textContent = text;
  msg.className = 'message ' + type;
  msg.style.display = 'block';
  setTimeout(() => {
    msg.style.display = 'none';
  }, 3000);
}
