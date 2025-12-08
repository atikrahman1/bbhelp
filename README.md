# Bug Bounty Hunter Tools - Chrome Extension

A comprehensive Chrome extension designed for bug bounty hunters and security researchers. Provides automated reconnaissance, JavaScript analysis, secret detection, and sensitive file discovery with advanced false positive filtering.

## 🚀 Features

### 🔧 Customizable Recon Tools
- **Fully Configurable**: Add, edit, or remove reconnaissance tools
- **Variable Support**: Use `{DOMAIN}`, `{URL}`, `{HOST}`, `{PROTOCOL}`, `{ORIGIN}` in tool URLs
- **Default Tools Included**:
  - Shodan - Domain intelligence and exposed services
  - Crt.sh - SSL certificate transparency logs
  - Subdomain Center - Subdomain enumeration

### 🔍 Service Discovery Scanner
- **Port Scanning**: Scans top 100 most common ports on target domain
- **HTTP/HTTPS Detection**: Identifies accessible web services
- **Service Identification**: Recognizes common services (MySQL, MongoDB, Redis, Elasticsearch, etc.)
- **Real-time Progress**: Live scanning progress with found services counter
- **Export Results**: Save scan results as JSON
- **Limitations**:
  - Only detects HTTP/HTTPS services (not raw TCP/UDP)
  - CORS policies may block some requests
  - For comprehensive scanning, use tools like `nmap`

**Common Ports Scanned**: 21 (FTP), 22 (SSH), 80 (HTTP), 443 (HTTPS), 3000 (Node.js), 3306 (MySQL), 5432 (PostgreSQL), 6379 (Redis), 8080 (HTTP Proxy), 8443 (HTTPS Alt), 9200 (Elasticsearch), 27017 (MongoDB), and 87 more...

### 📜 JavaScript File Extraction & Analysis
- **Smart Extraction**: Automatically extracts custom JavaScript files from pages
- **Intelligent Filtering**: Excludes 50+ common third-party libraries and CDN resources
  - Analytics (Google Analytics, Mixpanel, Segment, etc.)
  - Social widgets (Facebook, Twitter, LinkedIn, etc.)
  - Common libraries (jQuery, Bootstrap, React, Vue, etc.)
  - Ad networks and chat widgets
- **Three Analysis Modes**:
  1. **JS Files Viewer**: List and copy all extracted JavaScript URLs
  2. **Endpoint Discovery**: Find API endpoints with confidence scoring
  3. **Secret Scanner**: Detect exposed credentials and API keys

### 🔍 Endpoint Discovery
- **Pattern-Based Detection**: Uses 8+ regex patterns to find endpoints
- **HTTP Method Detection**: Identifies GET, POST, PUT, DELETE, PATCH methods
- **Confidence Scoring**: Rates findings from 30-100% confidence
- **Detects**:
  - `/api/*` paths
  - Versioned endpoints (`/v1/`, `/v2/`)
  - GraphQL endpoints
  - REST API patterns
  - Fetch/Axios calls
  - Template literals with URLs
- **Export**: Save results as JSON

### 🔐 Secret Scanner
Detects 30+ types of secrets with advanced filtering:

**API Keys & Tokens**:
- Google API Keys, Firebase, OAuth tokens
- AWS Access Keys, Secret Keys, S3 URLs
- GitHub tokens and access credentials
- Stripe API keys (live and restricted)
- Twilio API keys and SIDs
- Slack, Mailgun, Square tokens
- PayPal Braintree tokens

**Authentication**:
- JWT tokens with validation
- Authorization headers (Basic, Bearer, API Key)
- OAuth access tokens

**Cryptographic Keys**:
- RSA, SSH, DSA, EC private keys
- PGP private key blocks

**Other**:
- Bitcoin addresses
- Instagram, Twitter, Facebook tokens

**Advanced Features**:
- **Shannon Entropy Analysis**: Identifies high-randomness strings
- **Context-Aware Filtering**: Excludes minified code, webpack hashes, base64 images
- **Confidence Scoring**: 60-100% confidence ratings
- **Smart Pattern Matching**: Reduces false positives from source maps and build artifacts
- **Export**: Save findings as JSON

### 🎯 Sensitive File Fuzzer
Automatically discovers exposed sensitive files with intelligent false positive reduction.

**Default File List** (30+ files):
- Environment files (`.env`, `.env.local`, `.env.production`, `.env.backup`)
- Configuration files (`config.php`, `config.yaml`)
- Git files (`.git/config`, `.git/HEAD`, `.gitignore`)
- Backup files (`backup.zip`, `backup.sql`, `website.zip`)
- Database dumps (`db.sql`, `database.sql`, `dump.sql`)
- Log files (`debug.log`, `error.log`, `laravel.log`, `npm-debug.log`)
- Lock files (`composer.lock`, `yarn.lock`, `package-lock.json`)
- Other sensitive files (`phpinfo.php`, `swagger.json`, `robots.txt`)

**Variable Support**:
- `{DOMAIN}.zip` → `example.com.zip`
- `backup-{DOMAIN}.sql` → `backup-example.com.sql`
- `{DOMAIN}-db-backup.tar.gz` → `example.com-db-backup.tar.gz`

**Smart Features**:
- **Auto-scan**: Scans on page load (configurable)
- **Rescan Interval**: Configurable (1-168 hours, default: 12h)
- **Domain Exclusion**: Skip scanning for specific domains
- **Badge Notifications**: 
  - 🔴 Red badge = Fresh scan results
  - 🟠 Orange badge = Cached results
- **Persistent Storage**: Results saved per domain
- **Preview**: Shows first 100 characters of file content

#### 🛡️ False Positive Protection (Toggleable)

Advanced multi-layer filtering to reduce false positives:

1. **Baseline 404 Comparison**: Requests a random non-existent file first to identify catch-all responses
2. **404 Pattern Detection**: Identifies common "not found" indicators in HTML content
3. **Size-Based Filtering**: Flags when 5+ files return identical sizes
4. **Minimum Size Check**: Filters responses < 10 bytes

**Toggle Protection**: Enable/disable in Fuzzer Configuration based on your needs
- **ON**: Aggressive filtering, fewer false positives (recommended)
- **OFF**: Shows all HTTP 200 responses (useful for debugging)

### 🔎 Google Dorks
Pre-configured and customizable Google dork queries:

**Default Dorks**:
- Login Pages: `site:{DOMAIN} inurl:login`
- Admin Pages: `site:{DOMAIN} inurl:admin`
- Config Files: `site:{DOMAIN} filetype:config`
- SQL Files: `site:{DOMAIN} filetype:sql`
- ENV Files: `site:{DOMAIN} filetype:env`
- Backup Files: `site:{DOMAIN} inurl:backup`
- Text Files: `site:{DOMAIN} filetype:txt`
- PDF Files: `site:{DOMAIN} filetype:pdf`

**Fully Customizable**: Add, edit, or remove dorks via configuration

### 📋 Copy Commands
Quick-copy security testing commands with variable replacement:

**Default Commands**:
- Nmap Quick Scan: `nmap -T4 -F {TARGET}`
- Nmap Full Scan: `nmap -p- -T4 {TARGET}`
- Subfinder: `subfinder -d {DOMAIN} -o {DOMAIN}.txt`
- FFUF: `ffuf -u {URL}/FUZZ -w /path/to/wordlist.txt -ac`
- Nuclei: `nuclei -target {URL}`

**Variable Support**: `{URL}`, `{DOMAIN}`, `{TARGET}`, `{HOST}`, `{PROTOCOL}`, `{PATH}`

## 📦 Installation

### From Source
1. Clone this repository:
   ```bash
   git clone https://github.com/atikrahman1/bbhelp.git
   cd bbhelp
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" (toggle in top right)

4. Click "Load unpacked"

5. Select the `bbhelp` folder

6. The extension icon will appear in your toolbar

## 🎮 Usage

### Basic Usage
1. Navigate to any website
2. Click the extension icon
3. Use any of the available tools:
   - Click recon tools (Shodan, Crt.sh, etc.)
   - Run Service Discovery to scan for open ports
   - Extract and analyze JavaScript files
   - View Google Dorks
   - Copy security testing commands
   - Check sensitive file scan results

### Service Discovery Scanner
1. Click extension icon → **Service Discovery**
2. Target host is auto-filled from current tab (or enter manually)
3. Click **Start Scan** to begin scanning top 100 ports
4. View real-time progress and found services
5. Click **Export Results** to save as JSON
6. **Note**: Only detects HTTP/HTTPS services due to browser limitations

### Sensitive File Scanner
1. **Enable Auto-scan**: Click extension icon → Sensitive File Scanner → Toggle "Auto-scan on page load"
2. **Manual Scan**: Click "Scan" button to force immediate scan
3. **View Results**: Click "View Found Files" to see detailed results
4. **Configure**: Click "Fuzzer Configuration" to customize file list and settings

### Configuration
Access configuration pages from the extension popup:

- **Fuzzer Configuration**: Customize sensitive file list, preview length, rescan interval, false positive protection
- **Manage Exclusion List**: Add domains to skip scanning (supports wildcards)
- **Manage Copy Commands**: Add/edit quick-copy commands
- **Manage Google Dorks**: Add/edit Google dork queries
- **Manage Tools**: Add/edit reconnaissance tools

## ⚙️ Configuration Options

### Fuzzer Configuration
- **File List**: One file path per line, supports `{DOMAIN}` variables
- **Preview Length**: Characters to show in preview (5-500, default: 100)
- **Rescan Interval**: Hours between rescans (1-168, default: 12)
- **False Positive Protection**: Toggle advanced filtering on/off
- **Show Notification Popup**: Toggle popup notifications when files are found (badge still updates)

### Exclusion List
Add domains to skip scanning:
- `example.com` - Exact match
- `*.example.com` - Wildcard subdomain match
- `test-*.com` - Wildcard pattern match

### Variable Support
Use these variables in file paths, tools, commands, and dorks:
- `{DOMAIN}` - Domain without www (e.g., `example.com`)
- `{HOST}` - Full hostname (e.g., `www.example.com`)
- `{URL}` - Full URL (e.g., `https://example.com`)
- `{PROTOCOL}` - http or https
- `{ORIGIN}` - Protocol + host (e.g., `https://example.com`)
- `{TARGET}` - Same as HOST
- `{PATH}` - URL path

## 🔧 Technical Details

### Architecture
- **Manifest V3**: Modern Chrome extension architecture
- **Service Worker**: Background processing for file scanning
- **Content Script**: Injected into pages for JS extraction and file scanning
- **Storage API**: Persistent storage for settings and results
- **Badge API**: Visual notifications for scan results

### File Structure
```
bbhelp/
├── manifest.json           # Extension configuration
├── popup.html/js          # Main popup interface
├── background.js          # Service worker for scanning
├── content.js             # Content script for page interaction
├── js-viewer.html/js      # JavaScript file viewer
├── endpoint-extractor.js  # Endpoint discovery logic
├── secret-scanner.js      # Secret detection logic
├── config.html/js         # Fuzzer configuration
├── exclusions.html/js     # Domain exclusion management
├── commands.html/js       # Command management
├── dorks.html/js          # Google Dorks management
├── tools.html/js          # Tools management
└── icons/                 # Extension icons
```

## 🐛 Known Issues

See `issues.txt` for current known issues and planned improvements.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is open source and available for educational and research purposes.

## ⚠️ Disclaimer

This tool is designed for security research and bug bounty hunting on systems you have permission to test. Always obtain proper authorization before testing any system. The authors are not responsible for misuse or damage caused by this tool.

## 🙏 Credits

Created for the bug bounty and security research community.
