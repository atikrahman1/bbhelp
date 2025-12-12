// Global variables
let allScanHistory = [];
let filteredScanHistory = [];

// Load and display all scan results
function loadAllResults() {
    chrome.storage.local.get(['scanHistory'], (result) => {
        allScanHistory = result.scanHistory || [];
        filteredScanHistory = [...allScanHistory];
        console.log('Loaded scan history:', allScanHistory); // Debug log
        console.log('Scan history length:', allScanHistory.length); // Debug log
        displayResults(filteredScanHistory);
        updateSearchStats();
    });
}

// Search and filter functionality
function performSearch() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase().trim();
    
    if (searchTerm === '') {
        filteredScanHistory = [...allScanHistory];
    } else {
        filteredScanHistory = allScanHistory.filter(scan => {
            // Search in domain
            if (scan.domain.toLowerCase().includes(searchTerm)) {
                return true;
            }
            
            // Search in file names
            return scan.foundFiles.some(file => 
                file.file.toLowerCase().includes(searchTerm) ||
                file.url.toLowerCase().includes(searchTerm)
            );
        });
    }
    
    displayResults(filteredScanHistory);
    updateSearchStats();
}

function updateSearchStats() {
    const statsEl = document.getElementById('search-stats');
    const searchTerm = document.getElementById('search-input').value.trim();
    
    if (searchTerm === '') {
        statsEl.textContent = `Showing ${allScanHistory.length} scan result${allScanHistory.length !== 1 ? 's' : ''}`;
    } else {
        statsEl.textContent = `Found ${filteredScanHistory.length} of ${allScanHistory.length} results for "${searchTerm}"`;
    }
}

function clearSearch() {
    document.getElementById('search-input').value = '';
    performSearch();
}

function displayResults(scanHistory) {
    const container = document.getElementById('results-container');
    
    if (allScanHistory.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <h3>No scan results yet</h3>
                <p>Start scanning websites to see results here</p>
            </div>
        `;
        return;
    }
    
    if (scanHistory.length === 0) {
        container.innerHTML = `
            <div class="no-search-results">
                <h3>No results found</h3>
                <p>Try a different search term or clear the search to see all results</p>
            </div>
        `;
        return;
    }

    // Sort by timestamp (newest first)
    scanHistory.sort((a, b) => b.timestamp - a.timestamp);

    let html = `
        <table class="results-table">
            <thead>
                <tr>
                    <th>🌐 Domain</th>
                    <th>📁 Count</th>
                    <th>📄 Files Found (Top 4)</th>
                    <th>🕒 Scan Time</th>
                    <th>🛡️ Protection</th>
                </tr>
            </thead>
            <tbody>
    `;

    scanHistory.forEach((scan, index) => {
        const date = new Date(scan.timestamp);
        const timeAgo = getTimeAgo(scan.timestamp);
        
        // Get top 4 files for preview
        const topFiles = scan.foundFiles.slice(0, 4);
        const remainingCount = scan.foundFiles.length - 4;
        
        const filesPreview = topFiles.map(file => `
            <span class="file-preview-item" title="${file.url}">${file.file}</span>
        `).join('');
        
        const moreIndicator = remainingCount > 0 ? 
            `<span class="more-files">+${remainingCount} more</span>` : '';
        
        html += `
            <tr class="scan-row" data-scan-index="${index}" style="cursor: pointer;">
                <td class="domain-cell">${scan.domain}</td>
                <td><span class="files-count">${scan.foundFiles.length}</span></td>
                <td class="files-preview-cell">
                    <div class="files-preview">
                        ${filesPreview}
                        ${moreIndicator}
                    </div>
                </td>
                <td class="timestamp-cell">${date.toLocaleDateString()} ${date.toLocaleTimeString()}<br><small>${timeAgo}</small></td>
                <td><span class="protection-badge ${scan.protectionEnabled ? '' : 'off'}">${scan.protectionEnabled ? 'ON' : 'OFF'}</span></td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    `;

    container.innerHTML = html;
    
    // Store current filtered scan history globally for details view
    window.currentScanHistory = scanHistory;
    
    // Add click event listeners to table rows
    document.querySelectorAll('.scan-row').forEach(row => {
        row.addEventListener('click', () => {
            const scanIndex = parseInt(row.getAttribute('data-scan-index'));
            console.log('Row clicked:', scanIndex); // Debug log
            showDetails(scanIndex);
        });
    });
}

function getTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function clearAllResults() {
    if (confirm('Are you sure you want to clear all scan results? This cannot be undone.')) {
        chrome.storage.local.set({ scanHistory: [] }, () => {
            loadAllResults();
        });
    }
}

function exportResults() {
    chrome.storage.local.get(['scanHistory'], (result) => {
        const scanHistory = result.scanHistory || [];
        
        if (scanHistory.length === 0) {
            alert('No results to export');
            return;
        }

        const exportData = {
            exportDate: new Date().toISOString(),
            totalScans: scanHistory.length,
            scanHistory: scanHistory
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scan-results-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
}

// Show details for a specific scan
function showDetails(scanIndex) {
    console.log('showDetails called with index:', scanIndex); // Debug log
    console.log('currentScanHistory:', window.currentScanHistory); // Debug log
    
    const scan = window.currentScanHistory[scanIndex];
    console.log('Selected scan:', scan); // Debug log
    
    if (!scan) {
        console.error('No scan found at index:', scanIndex); // Debug log
        return;
    }

    const detailsView = document.getElementById('details-view');
    const domainEl = document.getElementById('details-domain');
    const statsEl = document.getElementById('details-stats');
    const filesGrid = document.getElementById('files-grid');

    // Set domain
    domainEl.textContent = scan.domain;

    // Set stats
    const date = new Date(scan.timestamp);
    statsEl.innerHTML = `
        <div class="detail-stat">
            <div class="stat-label">Scan Date</div>
            <div class="stat-value">${date.toLocaleDateString()}</div>
        </div>
        <div class="detail-stat">
            <div class="stat-label">Scan Time</div>
            <div class="stat-value">${date.toLocaleTimeString()}</div>
        </div>
        <div class="detail-stat">
            <div class="stat-label">Files Found</div>
            <div class="stat-value">${scan.foundFiles.length}</div>
        </div>
        <div class="detail-stat">
            <div class="stat-label">Total Scanned</div>
            <div class="stat-value">${scan.totalScanned}</div>
        </div>
        <div class="detail-stat">
            <div class="stat-label">Protection</div>
            <div class="stat-value">${scan.protectionEnabled ? 'Enabled' : 'Disabled'}</div>
        </div>
    `;

    // Set files
    filesGrid.innerHTML = scan.foundFiles.map(file => `
        <div class="file-card">
            <div class="file-name">${file.file}</div>
            <a href="${file.url}" target="_blank" class="file-url">${file.url}</a>
            <div class="file-meta">
                <div class="meta-item">Status: <span class="meta-value">${file.status}</span></div>
                <div class="meta-item">Type: <span class="meta-value">${file.contentType || 'unknown'}</span></div>
                <div class="meta-item">Size: <span class="meta-value">${formatFileSize(file.size || 0)}</span></div>
                <div class="meta-item">Found: <span class="meta-value">${new Date(file.foundAt).toLocaleString()}</span></div>
            </div>
            ${file.preview ? `<div class="file-preview">${escapeHtml(file.preview)}</div>` : ''}
        </div>
    `).join('');

    // Show details view
    detailsView.style.display = 'block';
}

// Hide details view
function hideDetails() {
    document.getElementById('details-view').style.display = 'none';
}

// Escape HTML for security
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    loadAllResults();

    // Main controls
    document.getElementById('refresh-btn').addEventListener('click', loadAllResults);
    document.getElementById('clear-all-btn').addEventListener('click', clearAllResults);
    document.getElementById('export-results-btn').addEventListener('click', exportResults);
    document.getElementById('back-btn').addEventListener('click', hideDetails);
    
    // Search functionality
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', performSearch);
    searchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Escape') {
            clearSearch();
        }
    });
    
    document.getElementById('clear-search-btn').addEventListener('click', clearSearch);
});