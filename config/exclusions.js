// Load exclusion list when DOM is ready
function loadExclusionList() {
  console.log('Loading exclusion list...'); // Debug log
  
  chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
    console.log('Exclusion list response:', response); // Debug log
    
    if (chrome.runtime.lastError) {
      console.error('Error loading exclusion list:', chrome.runtime.lastError);
      // Retry after a short delay
      setTimeout(loadExclusionList, 500);
      return;
    }
    
    if (response && response.exclusionList) {
      const exclusionListEl = document.getElementById('exclusion-list');
      if (exclusionListEl) {
        exclusionListEl.value = response.exclusionList.join('\n');
        console.log('Loaded', response.exclusionList.length, 'exclusion patterns'); // Debug log
      }
    } else {
      console.warn('No exclusion list response received, retrying...'); // Debug log
      // Retry after a short delay if no response
      setTimeout(loadExclusionList, 500);
    }
  });
}

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing exclusions page...'); // Debug log
  loadExclusionList();
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
