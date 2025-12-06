let commands = [];

// Load commands on page load
chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
  if (response && response.customCommands) {
    commands = response.customCommands;
    renderCommands();
  }
});

// Render command list
function renderCommands() {
  const container = document.getElementById('command-list');
  container.innerHTML = '';
  
  commands.forEach((cmd, index) => {
    const item = document.createElement('div');
    item.className = 'command-item';
    item.innerHTML = `
      <label>Command Name:</label>
      <input type="text" class="cmd-name" data-index="${index}" value="${escapeHtml(cmd.name)}" placeholder="e.g., SQLMap Scan">
      <label>Command (use {URL}, {DOMAIN}, etc.):</label>
      <input type="text" class="cmd-command" data-index="${index}" value="${escapeHtml(cmd.command)}" placeholder="e.g., python3 sqlmap.py -u {URL} --dbs">
      <button class="delete-btn" data-index="${index}">Delete</button>
    `;
    container.appendChild(item);
  });
  
  // Add event listeners
  document.querySelectorAll('.cmd-name').forEach(input => {
    input.addEventListener('input', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      commands[index].name = e.target.value;
    });
  });
  
  document.querySelectorAll('.cmd-command').forEach(input => {
    input.addEventListener('input', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      commands[index].command = e.target.value;
    });
  });
  
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      if (confirm('Delete this command?')) {
        commands.splice(index, 1);
        renderCommands();
      }
    });
  });
}

// Save button
document.getElementById('save-btn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ 
    action: 'updateCustomCommands', 
    customCommands: commands 
  }, (response) => {
    if (response && response.success) {
      showMessage('Commands saved successfully!', 'success');
    } else {
      showMessage('Failed to save commands', 'error');
    }
  });
});

// Add new command button
document.getElementById('add-btn').addEventListener('click', () => {
  commands.push({ name: 'New Command', command: '' });
  renderCommands();
  // Scroll to bottom
  window.scrollTo(0, document.body.scrollHeight);
});

// Reset to default button
document.getElementById('reset-btn').addEventListener('click', () => {
  if (confirm('Reset to default commands? This will delete all custom commands.')) {
    commands = [
      { name: 'Nmap Quick Scan', command: 'nmap -T4 -F {TARGET}' },
      { name: 'Nmap Full Scan', command: 'nmap -p- -T4 {TARGET}' },
      { name: 'Nmap Fast Top Ports', command: 'nmap --top-ports 1000 -T4 {TARGET}' },
      { name: 'Subfinder', command: 'subfinder -d {DOMAIN} -o {DOMAIN}.txt' },
      { name: 'FFUF', command: 'ffuf -u {URL}/FUZZ -w /path/to/wordlist.txt -ac' },
      { name: 'Nuclei', command: 'nuclei -target {URL}' }
    ];
    renderCommands();
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
