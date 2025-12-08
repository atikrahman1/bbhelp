# Service Discovery Scanner

## Overview
The Service Discovery Scanner is a browser-based port scanning tool that attempts to detect open HTTP/HTTPS services on a target host by scanning the top 100 most common ports.

## How It Works

### Detection Method
1. **HTTP/HTTPS Probing**: Makes fetch requests to each port using both HTTP and HTTPS protocols
2. **Timing Analysis**: Uses response timing to differentiate between open and closed ports
3. **No-CORS Mode**: Bypasses CORS restrictions for detection purposes
4. **Timeout Handling**: 3-second timeout per port to avoid hanging

### Top 100 Ports Scanned
The scanner checks these common service ports:

**Web Services:**
- 80 (HTTP), 443 (HTTPS), 8080 (HTTP Proxy), 8443 (HTTPS Alt)
- 8000, 8001, 8008, 8081-8083, 8180, 8888, 9999 (HTTP Alternatives)
- 3000 (Node.js/Rails), 4200 (Angular Dev), 5000 (Flask/UPnP)

**Databases:**
- 3306 (MySQL), 5432 (PostgreSQL), 27017-27018 (MongoDB)
- 6379 (Redis), 9200/9300 (Elasticsearch), 11211 (Memcached)
- 1433 (MS SQL), 1521 (Oracle), 8091 (CouchBase)

**Admin Panels:**
- 2082-2083 (cPanel), 2086-2087 (WHM), 2095-2096 (Webmail)
- 10000 (Webmin), 8090 (Confluence), 8834 (Nessus)

**Development Tools:**
- 9000 (SonarQube/PHP-FPM), 9090-9093 (Prometheus/Alertmanager)
- 8089 (Splunk), 8161 (ActiveMQ), 15672 (RabbitMQ)

**Other Services:**
- 21 (FTP), 22 (SSH), 23 (Telnet), 25 (SMTP)
- 3389 (RDP), 5900 (VNC), 161-162 (SNMP)
- And 70+ more common service ports...

## Features

### Real-time Scanning
- Live progress bar showing scan completion percentage
- Counter displaying scanned ports and found services
- Ability to stop scan at any time

### Results Display
- Port number and service name
- Protocol used (HTTP/HTTPS)
- Direct link to access the service
- Response time in milliseconds
- Summary statistics

### Export Functionality
- Export results as JSON file
- Includes scan metadata (target, date, statistics)
- Detailed service information for each finding

## Limitations

### Browser Restrictions
1. **HTTP/HTTPS Only**: Can only detect web services, not raw TCP/UDP ports
2. **CORS Policies**: Some requests may be blocked by CORS
3. **No Raw Sockets**: Cannot perform traditional SYN/ACK scanning
4. **Timeout Constraints**: Limited by browser timeout policies

### Detection Accuracy
- **False Negatives**: Services that don't respond to HTTP/HTTPS won't be detected
- **False Positives**: Some services may appear open but be filtered
- **Limited Protocols**: Cannot detect non-HTTP services (SSH, FTP, etc.)

### Performance
- Scans 100 ports sequentially (not parallel)
- Takes approximately 5-10 minutes for full scan
- Network speed affects scan duration

## Use Cases

### ✅ Good For:
- Quick web service discovery on target domains
- Finding exposed admin panels and dashboards
- Detecting misconfigured development servers
- Identifying common database web interfaces
- Bug bounty reconnaissance

### ❌ Not Suitable For:
- Comprehensive port scanning (use `nmap` instead)
- Detecting non-HTTP services
- Stealth scanning
- Large-scale network scanning
- Production security audits

## Comparison with Traditional Tools

| Feature | Service Discovery | nmap | masscan |
|---------|------------------|------|---------|
| HTTP/HTTPS Detection | ✅ Excellent | ✅ Good | ✅ Good |
| Raw TCP/UDP Scanning | ❌ No | ✅ Yes | ✅ Yes |
| Speed | 🐌 Slow | ⚡ Fast | 🚀 Very Fast |
| Stealth | ❌ No | ✅ Yes | ⚡ Partial |
| Browser-based | ✅ Yes | ❌ No | ❌ No |
| CORS Bypass | ⚡ Partial | ✅ N/A | ✅ N/A |
| Service Detection | ✅ Good | ✅ Excellent | ⚡ Basic |

## Ethical Considerations

### ⚠️ Important Warnings

1. **Authorization Required**: Only scan systems you have explicit permission to test
2. **Legal Implications**: Unauthorized port scanning may be illegal in your jurisdiction
3. **Terms of Service**: May violate website/service terms of service
4. **Responsible Disclosure**: Report findings through proper channels

### Best Practices

- Always obtain written permission before scanning
- Use for authorized bug bounty programs only
- Respect rate limits and avoid aggressive scanning
- Document your testing authorization
- Follow responsible disclosure guidelines

## Recommendations

### When to Use This Tool
- Quick reconnaissance on authorized targets
- Bug bounty initial discovery phase
- Finding exposed web services
- Complementing other scanning tools

### When to Use Traditional Tools
- Comprehensive security assessments
- Detecting non-HTTP services
- Production environment audits
- Stealth scanning requirements
- Large-scale network mapping

### Recommended Workflow
1. **Start**: Use Service Discovery for quick web service detection
2. **Validate**: Manually verify found services
3. **Deep Scan**: Use `nmap` for comprehensive port scanning
4. **Enumerate**: Use specialized tools for each service found
5. **Test**: Perform security testing on authorized services

## Example Output

```json
{
  "target": "example.com",
  "scanDate": "2024-12-08T10:30:00.000Z",
  "totalScanned": 100,
  "openServices": 3,
  "services": [
    {
      "port": 80,
      "service": "HTTP",
      "protocol": "http",
      "open": true,
      "status": "open",
      "responseTime": 145,
      "url": "http://example.com:80"
    },
    {
      "port": 443,
      "service": "HTTPS",
      "protocol": "https",
      "open": true,
      "status": "open",
      "responseTime": 178,
      "url": "https://example.com:443"
    },
    {
      "port": 8080,
      "service": "HTTP Proxy",
      "protocol": "http",
      "open": true,
      "status": "open",
      "responseTime": 234,
      "url": "http://example.com:8080"
    }
  ]
}
```

## Troubleshooting

### No Services Found
- Target may have firewall blocking requests
- CORS policies may be blocking detection
- Services may not respond to HTTP/HTTPS
- Try using `nmap` for verification

### Scan Taking Too Long
- Normal for 100 ports (5-10 minutes)
- Can stop scan early if needed
- Results are saved for found services

### False Positives
- Verify manually by visiting the URL
- Some services may redirect or show errors
- Use `nmap` for accurate verification

## Future Improvements

Potential enhancements for future versions:
- Parallel scanning for faster results
- Custom port list configuration
- Service fingerprinting
- Banner grabbing
- Integration with Shodan/Censys APIs
- Localhost scanning mode
- Scan history and comparison
