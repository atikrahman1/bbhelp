// Load scope and exclusion lists when DOM is ready
function loadLists() {
  console.log('Loading scope & exclusion lists...');
  
  chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
    console.log('Settings response:', response);
    
    if (chrome.runtime.lastError) {
      console.error('Error loading lists:', chrome.runtime.lastError);
      setTimeout(loadLists, 500);
      return;
    }
    
    if (response) {
      const scopeEl = document.getElementById('scope-list');
      const exclusionEl = document.getElementById('exclusion-list');
      
      if (scopeEl && response.scopeList) {
        scopeEl.value = response.scopeList.join('\n');
        console.log('Loaded', response.scopeList.length, 'scope patterns');
      }
      
      if (exclusionEl && response.exclusionList) {
        exclusionEl.value = response.exclusionList.join('\n');
        console.log('Loaded', response.exclusionList.length, 'exclusion patterns');
      }
    } else {
      console.warn('No response received, retrying...');
      setTimeout(loadLists, 500);
    }
  });
}

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing scope & exclusions page...');
  loadLists();
});

// Save button - saves both lists
document.getElementById('save-btn').addEventListener('click', () => {
  const scopePatterns = document.getElementById('scope-list').value
    .split('\n').map(p => p.trim()).filter(p => p.length > 0);
  const exclusionPatterns = document.getElementById('exclusion-list').value
    .split('\n').map(p => p.trim()).filter(p => p.length > 0);
  
  let saved = 0;
  const total = 2;
  
  chrome.runtime.sendMessage({ 
    action: 'updateScopeList', 
    scopeList: scopePatterns 
  }, (response) => {
    if (response && response.success) {
      saved++;
      if (saved === total) showMessage('Configuration saved successfully!', 'success');
    } else {
      showMessage('Failed to save scope list', 'error');
    }
  });
  
  chrome.runtime.sendMessage({ 
    action: 'updateExclusionList', 
    exclusionList: exclusionPatterns 
  }, (response) => {
    if (response && response.success) {
      saved++;
      if (saved === total) showMessage('Configuration saved successfully!', 'success');
    } else {
      showMessage('Failed to save exclusion list', 'error');
    }
  });
});

// Clear scope button
document.getElementById('clear-scope-btn').addEventListener('click', () => {
  if (confirm('Are you sure you want to clear the scope list?')) {
    document.getElementById('scope-list').value = '';
    showMessage('Scope cleared. Click Save to apply.', 'success');
  }
});

// Clear exclusion button
document.getElementById('clear-exclusion-btn').addEventListener('click', () => {
  if (confirm('Are you sure you want to clear the exclusion list?')) {
    document.getElementById('exclusion-list').value = '';
    showMessage('Exclusions cleared. Click Save to apply.', 'success');
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
