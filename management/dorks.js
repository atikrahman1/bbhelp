let dorks = [];

// Load dorks when DOM is ready
function loadDorks() {
  console.log('Loading dorks...'); // Debug log
  
  chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
    console.log('Dorks response:', response); // Debug log
    
    if (chrome.runtime.lastError) {
      console.error('Error loading dorks:', chrome.runtime.lastError);
      // Retry after a short delay
      setTimeout(loadDorks, 500);
      return;
    }
    
    if (response && response.customDorks) {
      dorks = response.customDorks;
      renderDorks();
      console.log('Loaded', dorks.length, 'dorks');
      
      // Load dorks delay
      if (response.dorksDelay !== undefined) {
        const delayEl = document.getElementById('dorks-delay');
        if (delayEl) {
          delayEl.value = response.dorksDelay / 1000; // Convert ms to seconds
        }
      }
    } else {
      console.warn('No dorks response received, retrying...'); // Debug log
      // Retry after a short delay
      setTimeout(loadDorks, 500);
    }
  });
}

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing dorks page...'); // Debug log
  loadDorks();
});

// Render dork list
function renderDorks() {
  const tbody = document.getElementById('dork-list');
  tbody.innerHTML = '';
  
  dorks.forEach((dork, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>
        <input type="text" class="dork-name" data-index="${index}" value="${escapeHtml(dork.name)}" placeholder="e.g., Database Backups">
      </td>
      <td>
        <input type="text" class="dork-query" data-index="${index}" value="${escapeHtml(dork.dork)}" placeholder="e.g., site:{DOMAIN} ext:sql">
      </td>
      <td style="text-align: center;">
        <button class="delete-btn" data-index="${index}">🗑️</button>
      </td>
    `;
    tbody.appendChild(row);
  });
  
  // Add event listeners
  document.querySelectorAll('.dork-name').forEach(input => {
    input.addEventListener('input', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      dorks[index].name = e.target.value;
    });
  });
  
  document.querySelectorAll('.dork-query').forEach(input => {
    input.addEventListener('input', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      dorks[index].dork = e.target.value;
    });
  });
  
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      if (confirm('Delete this dork?')) {
        dorks.splice(index, 1);
        renderDorks();
      }
    });
  });
}

// Save button
document.getElementById('save-btn').addEventListener('click', () => {
  const delaySeconds = parseFloat(document.getElementById('dorks-delay').value) || 3;
  const delayMs = Math.round(delaySeconds * 1000);
  
  chrome.runtime.sendMessage({ 
    action: 'updateCustomDorks', 
    customDorks: dorks 
  }, (response) => {
    if (response && response.success) {
      // Save delay
      chrome.runtime.sendMessage({
        action: 'updateDorksDelay',
        dorksDelay: delayMs
      }, (response2) => {
        if (response2 && response2.success) {
          showMessage('Google Dorks & delay saved successfully!', 'success');
        } else {
          showMessage('Dorks saved but failed to save delay', 'error');
        }
      });
    } else {
      showMessage('Failed to save dorks', 'error');
    }
  });
});

// Add new dork button
document.getElementById('add-btn').addEventListener('click', () => {
  dorks.push({ name: 'New Dork', dork: 'site:{DOMAIN} ' });
  renderDorks();
  // Scroll to bottom
  window.scrollTo(0, document.body.scrollHeight);
});

// Reset to default button
document.getElementById('reset-btn').addEventListener('click', () => {
  if (confirm('Reset to default dorks? This will delete all custom dorks.')) {
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
    renderDorks();
    showMessage('Reset to defaults. Click Save to apply.', 'success');
  }
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

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
