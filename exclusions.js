// Load exclusion list on page load
chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
  if (response && response.exclusionList) {
    document.getElementById('exclusion-list').value = response.exclusionList.join('\n');
  }
});

// Save button
document.getElementById('save-btn').addEventListener('click', () => {
  const textarea = document.getElementById('exclusion-list');
  const patterns = textarea.value.split('\n').map(p => p.trim()).filter(p => p.length > 0);
  
  chrome.runtime.sendMessage({ 
    action: 'updateExclusionList', 
    exclusionList: patterns 
  }, (response) => {
    if (response && response.success) {
      showMessage('Exclusion list saved successfully!', 'success');
    } else {
      showMessage('Failed to save exclusion list', 'error');
    }
  });
});

// Clear button
document.getElementById('clear-btn').addEventListener('click', () => {
  if (confirm('Are you sure you want to clear all exclusions?')) {
    document.getElementById('exclusion-list').value = '';
    showMessage('Cleared. Click Save to apply.', 'success');
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
