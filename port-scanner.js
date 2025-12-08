// Top 100 most common ports with service names
const COMMON_PORTS = [
  { port: 21, service: 'FTP' },
  { port: 22, service: 'SSH' },
  { port: 23, service: 'Telnet' },
  { port: 25, service: 'SMTP' },
  { port: 53, service: 'DNS' },
  { port: 80, service: 'HTTP' },
  { port: 110, service: 'POP3' },
  { port: 111, service: 'RPC' },
  { port: 135, service: 'MS RPC' },
  { port: 139, service: 'NetBIOS' },
  { port: 143, service: 'IMAP' },
  { port: 443, service: 'HTTPS' },
  { port: 445, service: 'SMB' },
  { port: 993, service: 'IMAPS' },
  { port: 995, service: 'POP3S' },
  { port: 1723, service: 'PPTP' },
  { port: 3306, service: 'MySQL' },
  { port: 3389, service: 'RDP' },
  { port: 5900, service: 'VNC' },
  { port: 8080, service: 'HTTP Proxy' },
  { port: 8443, service: 'HTTPS Alt' },
  { port: 8000, service: 'HTTP Alt' },
  { port: 8888, service: 'HTTP Alt' },
  { port: 5000, service: 'UPnP/Flask' },
  { port: 5432, service: 'PostgreSQL' },
  { port: 27017, service: 'MongoDB' },
  { port: 6379, service: 'Redis' },
  { port: 9200, service: 'Elasticsearch' },
  { port: 9300, service: 'Elasticsearch' },
  { port: 11211, service: 'Memcached' },
  { port: 50000, service: 'SAP' },
  { port: 161, service: 'SNMP' },
  { port: 162, service: 'SNMP Trap' },
  { port: 389, service: 'LDAP' },
  { port: 636, service: 'LDAPS' },
  { port: 1433, service: 'MS SQL' },
  { port: 1521, service: 'Oracle DB' },
  { port: 2049, service: 'NFS' },
  { port: 2082, service: 'cPanel' },
  { port: 2083, service: 'cPanel SSL' },
  { port: 2086, service: 'WHM' },
  { port: 2087, service: 'WHM SSL' },
  { port: 2095, service: 'Webmail' },
  { port: 2096, service: 'Webmail SSL' },
  { port: 3000, service: 'Node.js/Rails' },
  { port: 3001, service: 'Node.js Alt' },
  { port: 4200, service: 'Angular Dev' },
  { port: 4443, service: 'HTTPS Alt' },
  { port: 4444, service: 'Metasploit' },
  { port: 5001, service: 'Synology DSM' },
  { port: 5060, service: 'SIP' },
  { port: 5061, service: 'SIP TLS' },
  { port: 5222, service: 'XMPP' },
  { port: 5269, service: 'XMPP Server' },
  { port: 5357, service: 'WSDAPI' },
  { port: 5800, service: 'VNC HTTP' },
  { port: 5985, service: 'WinRM HTTP' },
  { port: 5986, service: 'WinRM HTTPS' },
  { port: 6000, service: 'X11' },
  { port: 6001, service: 'X11' },
  { port: 6379, service: 'Redis' },
  { port: 7001, service: 'WebLogic' },
  { port: 7002, service: 'WebLogic SSL' },
  { port: 8001, service: 'HTTP Alt' },
  { port: 8008, service: 'HTTP Alt' },
  { port: 8009, service: 'AJP13' },
  { port: 8081, service: 'HTTP Alt' },
  { port: 8082, service: 'HTTP Alt' },
  { port: 8083, service: 'HTTP Alt' },
  { port: 8089, service: 'Splunk' },
  { port: 8090, service: 'Confluence' },
  { port: 8091, service: 'CouchBase' },
  { port: 8161, service: 'ActiveMQ' },
  { port: 8180, service: 'HTTP Alt' },
  { port: 8200, service: 'Vault' },
  { port: 8291, service: 'MikroTik' },
  { port: 8333, service: 'Bitcoin' },
  { port: 8500, service: 'Consul' },
  { port: 8834, service: 'Nessus' },
  { port: 9000, service: 'SonarQube/PHP-FPM' },
  { port: 9001, service: 'Supervisor' },
  { port: 9090, service: 'Prometheus' },
  { port: 9091, service: 'Prometheus' },
  { port: 9092, service: 'Kafka' },
  { port: 9093, service: 'Alertmanager' },
  { port: 9100, service: 'Node Exporter' },
  { port: 9200, service: 'Elasticsearch' },
  { port: 9300, service: 'Elasticsearch' },
  { port: 9999, service: 'HTTP Alt' },
  { port: 10000, service: 'Webmin' },
  { port: 10443, service: 'HTTPS Alt' },
  { port: 11211, service: 'Memcached' },
  { port: 15672, service: 'RabbitMQ' },
  { port: 27017, service: 'MongoDB' },
  { port: 27018, service: 'MongoDB' },
  { port: 28017, service: 'MongoDB HTTP' },
  { port: 50070, service: 'Hadoop' },
  { port: 50030, service: 'Hadoop' },
  { port: 50060, service: 'Hadoop' }
];

let scanRunning = false;
let scanAborted = false;
let foundServices = [];
let scannedCount = 0;
let totalPorts = COMMON_PORTS.length;

// Get current tab's domain on load
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]) {
    try {
      const url = new URL(tabs[0].url);
      const hostname = url.hostname;
      document.getElementById('target-host').value = hostname;
    } catch (e) {
      // Invalid URL, leave empty
    }
  }
});

// Start scan button
document.getElementById('start-scan').addEventListener('click', async () => {
  const targetHost = document.getElementById('target-host').value.trim();
  
  if (!targetHost) {
    alert('Please enter a target host');
    return;
  }
  
  // Validate hostname/IP
  if (!isValidHost(targetHost)) {
    alert('Please enter a valid hostname or IP address');
    return;
  }
  
  startScan(targetHost);
});

// Stop scan button
document.getElementById('stop-scan').addEventListener('click', () => {
  stopScan();
});

// Export results button
document.getElementById('export-results').addEventListener('click', () => {
  exportResults();
});

// Validate host
function isValidHost(host) {
  // Check if it's a valid hostname or IP
  const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  
  return hostnameRegex.test(host) || ipRegex.test(host);
}

// Start scanning
async function startScan(targetHost) {
  scanRunning = true;
  scanAborted = false;
  foundServices = [];
  scannedCount = 0;
  
  // Update UI
  document.getElementById('start-scan').disabled = true;
  document.getElementById('start-scan').textContent = 'Scanning...';
  document.getElementById('stop-scan').style.display = 'block';
  document.getElementById('export-results').style.display = 'none';
  document.getElementById('progress').style.display = 'block';
  document.getElementById('results').style.display = 'none';
  
  console.log(`[Scanner] Starting scan on ${targetHost}`);
  
  // Scan ports
  for (const portInfo of COMMON_PORTS) {
    if (!scanRunning || scanAborted) {
      console.log('[Scanner] Scan aborted');
      break;
    }
    
    const result = await scanPort(targetHost, portInfo.port, portInfo.service);
    
    if (result.open) {
      foundServices.push(result);
      console.log(`[Scanner] Found open port: ${portInfo.port} (${portInfo.service})`);
    }
    
    scannedCount++;
    updateProgress();
  }
  
  // Scan complete
  scanRunning = false;
  displayResults(targetHost);
}

// Stop scanning
function stopScan() {
  scanAborted = true;
  scanRunning = false;
  
  document.getElementById('start-scan').disabled = false;
  document.getElementById('start-scan').textContent = 'Start Scan';
  document.getElementById('stop-scan').style.display = 'none';
  
  if (foundServices.length > 0) {
    displayResults(document.getElementById('target-host').value);
  } else {
    document.getElementById('progress').style.display = 'none';
    alert('Scan stopped. No services found yet.');
  }
}

// Update progress bar
function updateProgress() {
  const percentage = Math.round((scannedCount / totalPorts) * 100);
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  
  progressFill.style.width = percentage + '%';
  progressFill.textContent = percentage + '%';
  progressText.textContent = `Scanned ${scannedCount} of ${totalPorts} ports | Found ${foundServices.length} open service(s)`;
}

// Scan a single port
async function scanPort(host, port, serviceName) {
  const protocols = ['https', 'http'];
  
  for (const protocol of protocols) {
    try {
      const url = `${protocol}://${host}:${port}`;
      const startTime = performance.now();
      
      // Use fetch with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
      
      const response = await fetch(url, {
        method: 'GET',
        mode: 'no-cors', // Bypass CORS for detection
        signal: controller.signal,
        cache: 'no-store'
      });
      
      clearTimeout(timeoutId);
      const responseTime = Math.round(performance.now() - startTime);
      
      // If we get here, the port responded
      return {
        port: port,
        service: serviceName,
        protocol: protocol,
        open: true,
        status: 'open',
        responseTime: responseTime,
        url: url
      };
      
    } catch (error) {
      // Check error type
      if (error.name === 'AbortError') {
        // Timeout - port might be open but slow
        continue;
      }
      
      // Network error - port likely closed or filtered
      continue;
    }
  }
  
  // Port not accessible
  return {
    port: port,
    service: serviceName,
    open: false,
    status: 'closed'
  };
}

// Display results
function displayResults(targetHost) {
  document.getElementById('start-scan').disabled = false;
  document.getElementById('start-scan').textContent = 'Start Scan';
  document.getElementById('stop-scan').style.display = 'none';
  document.getElementById('progress').style.display = 'none';
  document.getElementById('results').style.display = 'block';
  
  const summary = document.getElementById('summary');
  const resultsList = document.getElementById('results-list');
  
  if (foundServices.length === 0) {
    summary.innerHTML = `
      <h3>Scan Complete</h3>
      <p>Target: <strong>${escapeHtml(targetHost)}</strong></p>
      <p>Scanned: <strong>${scannedCount}</strong> ports</p>
      <p>Found: <strong>0</strong> open services</p>
    `;
    resultsList.innerHTML = '<div class="no-results">No open services detected.<br><br>This could mean:<br>• Ports are closed or filtered<br>• CORS policies blocked detection<br>• Services don\'t respond to HTTP/HTTPS<br><br>Try using <code>nmap</code> for comprehensive scanning.</div>';
    return;
  }
  
  // Sort by port number
  foundServices.sort((a, b) => a.port - b.port);
  
  // Display summary
  summary.innerHTML = `
    <h3>✅ Scan Complete</h3>
    <p>Target: <strong>${escapeHtml(targetHost)}</strong></p>
    <p>Scanned: <strong>${scannedCount}</strong> ports</p>
    <p>Found: <strong style="color: #2ecc71;">${foundServices.length}</strong> open service(s)</p>
  `;
  
  // Display results
  resultsList.innerHTML = foundServices.map(service => `
    <div class="result-item">
      <div>
        <span class="port-number">Port ${service.port}</span>
        <span class="status open">OPEN</span>
      </div>
      <div class="service-name">Service: ${escapeHtml(service.service)} (${service.protocol.toUpperCase()})</div>
      <div style="color: #888; font-size: 12px; margin-top: 5px;">
        URL: <a href="${escapeHtml(service.url)}" target="_blank" style="color: #3498db;">${escapeHtml(service.url)}</a>
      </div>
      ${service.responseTime ? `<div style="color: #888; font-size: 12px;">Response Time: ${service.responseTime}ms</div>` : ''}
    </div>
  `).join('');
  
  // Show export button
  document.getElementById('export-results').style.display = 'block';
}

// Export results as JSON
function exportResults() {
  const targetHost = document.getElementById('target-host').value;
  const exportData = {
    target: targetHost,
    scanDate: new Date().toISOString(),
    totalScanned: scannedCount,
    openServices: foundServices.length,
    services: foundServices
  };
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `port-scan-${targetHost}-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
