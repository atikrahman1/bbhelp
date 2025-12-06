let dorks = [];

// Load dorks on page load
chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
  if (response && response.customDorks) {
    dorks = response.customDorks;
    renderDorks();
  }
});

// Render dork list
function renderDorks() {
  const container = document.getElementById('dork-list');
  container.innerHTML = '';
  
  dorks.forEach((dork, index) => {
    const item = document.createElement('div');
    item.className = 'dork-item';
    item.innerHTML = `
      <label>Dork Name:</label>
      <input type="text" class="dork-name" data-index="${index}" value="${escapeHtml(dork.name)}" placeholder="e.g., Database Backups">
      <label>Google Dork Query (use {DOMAIN}):</label>
      <input type="text" class="dork-query" data-index="${index}" value="${escapeHtml(dork.dork)}" placeholder="e.g., site:{DOMAIN} ext:sql">
      <button class="delete-btn" data-index="${index}">Delete</button>
    `;
    container.appendChild(item);
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
  chrome.runtime.sendMessage({ 
    action: 'updateCustomDorks', 
    customDorks: dorks 
  }, (response) => {
    if (response && response.success) {
      showMessage('Google Dorks saved successfully!', 'success');
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
