// Load settings on page load
chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
  if (response) {
    if (response.sensitiveFilesList) {
      document.getElementById('files-list').value = response.sensitiveFilesList.join('\n');
    }
    if (response.previewLength) {
      document.getElementById('preview-length').value = response.previewLength;
    }
    if (response.rescanInterval) {
      document.getElementById('rescan-interval').value = response.rescanInterval;
    }
  }
});

// Save button
document.getElementById('save-btn').addEventListener('click', () => {
  const textarea = document.getElementById('files-list');
  const files = textarea.value.split('\n').map(f => f.trim()).filter(f => f.length > 0);
  const previewLen = parseInt(document.getElementById('preview-length').value) || 10;
  const rescanInt = parseInt(document.getElementById('rescan-interval').value) || 12;
  
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
              showMessage('Settings saved successfully!', 'success');
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
    'dump.sql'
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
