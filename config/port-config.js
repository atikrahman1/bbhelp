let customPorts = [];

// Default port presets
const PORT_PRESETS = {
    common: [
        { port: 80, service: 'HTTP' },
        { port: 443, service: 'HTTPS' },
        { port: 8080, service: 'HTTP Alt' },
        { port: 8443, service: 'HTTPS Alt' }
    ],
    web: [
        { port: 80, service: 'HTTP' },
        { port: 443, service: 'HTTPS' },
        { port: 8080, service: 'HTTP Alt' },
        { port: 8443, service: 'HTTPS Alt' },
        { port: 8000, service: 'HTTP Dev' },
        { port: 8888, service: 'HTTP Alt' }
    ],
    dev: [
        { port: 3000, service: 'Node.js' },
        { port: 5000, service: 'Flask/Dev' },
        { port: 8000, service: 'Django/Dev' },
        { port: 4200, service: 'Angular' },
        { port: 3001, service: 'React Dev' },
        { port: 8080, service: 'Tomcat' },
        { port: 9000, service: 'Dev Server' }
    ],
    alt: [
        { port: 8081, service: 'HTTP Alt' },
        { port: 8082, service: 'HTTP Alt' },
        { port: 8090, service: 'HTTP Alt' },
        { port: 9090, service: 'HTTP Alt' },
        { port: 4443, service: 'HTTPS Alt' },
        { port: 9443, service: 'HTTPS Alt' },
        { port: 10443, service: 'HTTPS Alt' }
    ]
};

// Load ports when DOM is ready
function loadPorts() {
    console.log('Loading custom ports...'); // Debug log
    
    chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
        console.log('Ports response:', response); // Debug log
        
        if (chrome.runtime.lastError) {
            console.error('Error loading ports:', chrome.runtime.lastError);
            setTimeout(loadPorts, 500);
            return;
        }
        
        if (response && response.customPorts) {
            customPorts = response.customPorts;
            renderPorts();
            console.log('Loaded', customPorts.length, 'custom ports'); // Debug log
        } else {
            // Load default ports if none exist
            customPorts = getDefaultPorts();
            renderPorts();
            console.log('Loaded default ports'); // Debug log
        }
    });
}

// Get default ports
function getDefaultPorts() {
    return [
        { port: 80, service: 'HTTP' },
        { port: 443, service: 'HTTPS' },
        { port: 8080, service: 'HTTP Alt' },
        { port: 8443, service: 'HTTPS Alt' },
        { port: 8000, service: 'HTTP Dev' },
        { port: 8888, service: 'HTTP Alt' },
        { port: 3000, service: 'Node.js' },
        { port: 5000, service: 'Flask/Dev' },
        { port: 9000, service: 'HTTP Alt' },
        { port: 8081, service: 'HTTP Alt' },
        { port: 8082, service: 'HTTP Alt' },
        { port: 8090, service: 'HTTP Alt' },
        { port: 9090, service: 'HTTP Alt' },
        { port: 4443, service: 'HTTPS Alt' },
        { port: 9443, service: 'HTTPS Alt' }
    ];
}

// Render port list
function renderPorts() {
    const container = document.getElementById('port-list');
    container.innerHTML = '';
    
    // Sort ports by number
    const sortedPorts = [...customPorts].sort((a, b) => a.port - b.port);
    
    sortedPorts.forEach((portInfo, index) => {
        const portDiv = document.createElement('div');
        portDiv.className = 'port-item';
        portDiv.innerHTML = `
            <div class="port-info">
                <div class="port-number">${portInfo.port}</div>
                <div class="port-service">${portInfo.service}</div>
            </div>
            <button class="remove-btn" onclick="removePort(${index})">✕</button>
        `;
        container.appendChild(portDiv);
    });
}

// Add new port
function addPort() {
    const portNumber = parseInt(document.getElementById('port-number').value);
    const serviceName = document.getElementById('port-service').value.trim();
    
    if (!portNumber || portNumber < 1 || portNumber > 65535) {
        showMessage('Please enter a valid port number (1-65535)', 'error');
        return;
    }
    
    if (!serviceName) {
        showMessage('Please enter a service name', 'error');
        return;
    }
    
    // Check if port already exists
    if (customPorts.some(p => p.port === portNumber)) {
        showMessage('Port already exists in the list', 'error');
        return;
    }
    
    // Add port
    customPorts.push({ port: portNumber, service: serviceName });
    
    // Clear form
    document.getElementById('port-number').value = '';
    document.getElementById('port-service').value = '';
    
    renderPorts();
    showMessage('Port added successfully', 'success');
}

// Remove port
function removePort(index) {
    // Find the actual index in the original array
    const sortedPorts = [...customPorts].sort((a, b) => a.port - b.port);
    const portToRemove = sortedPorts[index];
    const actualIndex = customPorts.findIndex(p => p.port === portToRemove.port);
    
    if (actualIndex >= 0) {
        customPorts.splice(actualIndex, 1);
        renderPorts();
        showMessage('Port removed successfully', 'success');
    }
}

// Add preset ports
function addPresetPorts(presetName) {
    const preset = PORT_PRESETS[presetName];
    if (!preset) return;
    
    let addedCount = 0;
    preset.forEach(portInfo => {
        // Only add if port doesn't already exist
        if (!customPorts.some(p => p.port === portInfo.port)) {
            customPorts.push({ ...portInfo });
            addedCount++;
        }
    });
    
    renderPorts();
    showMessage(`Added ${addedCount} new ports from ${presetName} preset`, 'success');
}

// Reset to defaults
function resetToDefaults() {
    if (confirm('Reset to default port list? This will remove all custom ports.')) {
        customPorts = getDefaultPorts();
        renderPorts();
        showMessage('Reset to default ports', 'success');
    }
}

// Clear all ports
function clearAllPorts() {
    if (confirm('Remove all ports? You will need to add ports manually.')) {
        customPorts = [];
        renderPorts();
        showMessage('All ports cleared', 'success');
    }
}

// Save ports
function savePorts() {
    if (customPorts.length === 0) {
        showMessage('Please add at least one port before saving', 'error');
        return;
    }
    
    chrome.runtime.sendMessage({
        action: 'updateCustomPorts',
        customPorts: customPorts
    }, (response) => {
        if (response && response.success) {
            showMessage('Port configuration saved successfully!', 'success');
        } else {
            showMessage('Failed to save port configuration', 'error');
        }
    });
}

// Show message
function showMessage(text, type = 'success') {
    const msg = document.getElementById('message');
    msg.textContent = text;
    msg.className = `message ${type}`;
    msg.style.display = 'block';
    
    setTimeout(() => {
        msg.style.display = 'none';
    }, 3000);
}

// Handle Enter key in form inputs
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing port config page...'); // Debug log
    loadPorts();
    
    // Add Enter key handlers
    document.getElementById('port-number').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('port-service').focus();
        }
    });
    
    document.getElementById('port-service').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addPort();
        }
    });
});