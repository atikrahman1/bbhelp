let tools = [];

// Load tools on page load
chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
  if (response && response.customTools) {
    tools = response.customTools;
    renderTools();
  }
});

// Render tool list
function renderTools() {
  const container = document.getElementById('tool-list');
  container.innerHTML = '';
  
  tools.forEach((tool, index) => {
    const item = document.createElement('div');
    item.className = 'tool-item';
    item.innerHTML = `
      <label>Tool Name:</label>
      <input type="text" class="tool-name" data-index="${index}" value="${escapeHtml(tool.name)}" placeholder="e.g., SecurityTrails">
      <label>Tool URL (use {DOMAIN}, {URL}, etc.):</label>
      <input type="text" class="tool-url" data-index="${index}" value="${escapeHtml(tool.url)}" placeholder="e.g., https://someapi.com/domain={DOMAIN}">
      <button class="delete-btn" data-index="${index}">Delete</button>
    `;
    container.appendChild(item);
  });
  
  // Add event listeners
  document.querySelectorAll('.tool-name').forEach(input => {
    input.addEventListener('input', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      tools[index].name = e.target.value;
    });
  });
  
  document.querySelectorAll('.tool-url').forEach(input => {
    input.addEventListener('input', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      tools[index].url = e.target.value;
    });
  });
  
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      if (confirm('Delete this tool?')) {
        tools.splice(index, 1);
        renderTools();
      }
    });
  });
}

// Save button
document.getElementById('save-btn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ 
    action: 'updateCustomTools', 
    customTools: tools 
  }, (response) => {
    if (response && response.success) {
      showMessage('Tools saved successfully!', 'success');
    } else {
      showMessage('Failed to save tools', 'error');
    }
  });
});

// Add new tool button
document.getElementById('add-btn').addEventListener('click', () => {
  tools.push({ name: 'New Tool', url: 'https://example.com/{DOMAIN}' });
  renderTools();
  // Scroll to bottom
  window.scrollTo(0, document.body.scrollHeight);
});

// Reset to default button
document.getElementById('reset-btn').addEventListener('click', () => {
  if (confirm('Reset to default tools? This will delete all custom tools.')) {
    tools = [
      { name: 'Shodan', url: 'https://beta.shodan.io/domain/{DOMAIN}' },
      { name: 'Crt.sh', url: 'https://crt.sh/?q={DOMAIN}' },
      { name: 'Subdomain Center', url: 'https://api.subdomain.center/?domain={DOMAIN}' }
    ];
    renderTools();
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
