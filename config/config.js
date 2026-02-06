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
      if (response.scanEngine) {
        const scanEngineEl = document.getElementById('scan-engine');
        if (scanEngineEl) {
          scanEngineEl.value = response.scanEngine;
          toggleConcurrencyVisibility(response.scanEngine);
        }
      }
      if (response.requestDelay !== undefined) {
        const requestDelayEl = document.getElementById('request-delay');
        if (requestDelayEl) {
          requestDelayEl.value = response.requestDelay;
        }
      }
      if (response.parallelConcurrency) {
        const concurrencyEl = document.getElementById('parallel-concurrency');
        if (concurrencyEl) {
          concurrencyEl.value = response.parallelConcurrency;
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

// Show/hide concurrency section based on scan engine
function toggleConcurrencyVisibility(engine) {
  const section = document.getElementById('concurrency-section');
  if (section) {
    section.style.display = engine === 'parallel' ? 'block' : 'none';
  }
}

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing config page...'); // Debug log
  loadSettings();
  
  // Toggle concurrency visibility when engine changes
  const scanEngineEl = document.getElementById('scan-engine');
  if (scanEngineEl) {
    scanEngineEl.addEventListener('change', (e) => {
      toggleConcurrencyVisibility(e.target.value);
    });
  }
});

// Save button
document.getElementById('save-btn').addEventListener('click', () => {
  const textarea = document.getElementById('files-list');
  const files = textarea.value.split('\n').map(f => f.trim()).filter(f => f.length > 0);
  const previewLen = parseInt(document.getElementById('preview-length').value) || 100;
  const rescanInt = parseInt(document.getElementById('rescan-interval').value) || 12;
  const fpProtection = document.getElementById('false-positive-protection').checked;
  const showNotifs = document.getElementById('show-notifications').checked;
  const scanEng = document.getElementById('scan-engine').value;
  const reqDelay = parseInt(document.getElementById('request-delay').value) || 100;
  const parConcurrency = parseInt(document.getElementById('parallel-concurrency').value) || 5;
  
  // Validate rescan interval
  if (rescanInt < 1 || rescanInt > 168) {
    showMessage('Rescan interval must be between 1 and 168 hours', 'error');
    return;
  }
  
  // Validate request delay
  if (reqDelay < 0 || reqDelay > 5000) {
    showMessage('Request delay must be between 0 and 5000 ms', 'error');
    return;
  }
  
  // Validate concurrency
  if (parConcurrency < 2 || parConcurrency > 20) {
    showMessage('Parallel concurrency must be between 2 and 20', 'error');
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
                      // Save scan engine
                      chrome.runtime.sendMessage({
                        action: 'updateScanEngine',
                        scanEngine: scanEng
                      }, (response6) => {
                        if (response6 && response6.success) {
                          // Save request delay
                          chrome.runtime.sendMessage({
                            action: 'updateRequestDelay',
                            requestDelay: reqDelay
                          }, (response7) => {
                            if (response7 && response7.success) {
                              // Save parallel concurrency
                              chrome.runtime.sendMessage({
                                action: 'updateParallelConcurrency',
                                parallelConcurrency: parConcurrency
                              }, (response8) => {
                                if (response8 && response8.success) {
                                  showMessage('Settings saved successfully!', 'success');
                                } else {
                                  showMessage('Failed to save concurrency setting', 'error');
                                }
                              });
                            } else {
                              showMessage('Failed to save request delay', 'error');
                            }
                          });
                        } else {
                          showMessage('Failed to save scan engine', 'error');
                        }
                      });
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
    '.htaccess',
    '.htpasswd',
    'web.config',
    'web.config.bak',
    'nginx.conf',
    'server-status',
    'server-info',
    '.git/config',
    '.git/HEAD',
    '.gitignore',
    '.svn/entries',
    '.svn/wc.db',
    '.hg/hgrc',
    '.bash_history',
    '.zsh_history',
    '.sh_history',
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
    'db.sql',
    'database.sql',
    'dump.sql',
    'data.sql',
    'mysql.sql',
    'debug.log',
    'error.log',
    'access.log',
    'laravel.log',
    'npm-debug.log',
    'storage/logs/laravel.log',
    'logs/error.log',
    'logs/access.log',
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
    'swagger.json',
    'swagger.yaml',
    'openapi.json',
    'openapi.yaml',
    'api-docs',
    'graphql',
    'api/v1',
    'api/v2',
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
    'actuator/health',
    'actuator/env',
    'actuator/info',
    'actuator/mappings',
    'actuator/configprops',
    'WEB-INF/web.xml',
    'elmah.axd',
    'trace.axd',
    'web.config.old',
    'web.config.txt',
    '__debug__/',
    '_profiler/',
    'telescope',
    'Dockerfile',
    'docker-compose.yml',
    '.dockerenv',
    '.travis.yml',
    '.gitlab-ci.yml',
    'Jenkinsfile',
    '.aws/credentials',
    '.ssh/id_rsa',
    '.ssh/id_rsa.pub',
    'firebase.json',
    '.firebaserc'
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
