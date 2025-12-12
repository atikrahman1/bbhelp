let tools = [];

// Load tools when DOM is ready
function loadTools() {
  console.log('Loading tools...'); // Debug log
  
  chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
    console.log('Tools response:', response); // Debug log
    
    if (chrome.runtime.lastError) {
      console.error('Error loading tools:', chrome.runtime.lastError);
      // Retry after a short delay
      setTimeout(loadTools, 500);
      return;
    }
    
    if (response && response.customTools) {
      tools = response.customTools;
      renderTools();
      console.log('Loaded', tools.length, 'tools'); // Debug log
    } else {
      console.warn('No tools response received, retrying...'); // Debug log
      // Retry after a short delay
      setTimeout(loadTools, 500);
    }
  });
}

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing tools page...'); // Debug log
  loadTools();
});

// Render tool list
function renderTools() {
  const tbody = document.getElementById('tool-list');
  tbody.innerHTML = '';
  
  tools.forEach((tool, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>
        <input type="text" class="tool-name" data-index="${index}" value="${escapeHtml(tool.name)}" placeholder="e.g., SecurityTrails">
      </td>
      <td>
        <input type="text" class="tool-url" data-index="${index}" value="${escapeHtml(tool.url)}" placeholder="e.g., https://someapi.com/domain={DOMAIN}">
      </td>
      <td style="text-align: center;">
        <button class="delete-btn" data-index="${index}">🗑️</button>
      </td>
    `;
    tbody.appendChild(row);
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
