# BBHelp - Chrome Extension

A comprehensive Chrome extension for bug bounty hunters and security researchers. Automates reconnaissance, JavaScript analysis, secret detection, and sensitive file discovery with smart filtering.

## 🚀 Key Features

### 🔧 Recon Tools
- **Customizable Tools**: Add/edit reconnaissance tools with variable support
- **Quick Access**: One-click access to Shodan, Crt.sh, Subdomain Center
- **Variable Support**: `{DOMAIN}`, `{URL}`, `{HOST}`, `{PROTOCOL}`, `{ORIGIN}`

### 🌐 HTTP Ports Checker
- **Customizable Port Lists**: Configure your own ports or use presets (Common, Web, Dev, Alt)
- **Auto-Scan**: Automatically scan ports when visiting new domains
- **Smart Timeouts**: Dynamic timeouts based on file size (3s to 30s)
- **Results Dropdown**: View scan results with clickable links to open services
- **Background Scanning**: Non-blocking scans with progress tracking

### 📜 JavaScript Analysis
- **Smart Extraction**: Filters out 50+ common libraries (jQuery, React, Analytics, etc.)
- **Three Analysis Modes**:
  - **JS Files Viewer**: Extract and copy JavaScript URLs
  - **Endpoint Discovery**: Find API endpoints with confidence scoring
  - **Secret Scanner**: Detect 30+ types of exposed credentials

### 🔐 Secret Detection
- **API Keys**: Google, AWS, GitHub, Stripe, Twilio, Slack, etc.
- **Tokens**: JWT, OAuth, Authorization headers
- **Crypto Keys**: RSA, SSH, DSA, EC private keys
- **Advanced Filtering**: Shannon entropy analysis, context-aware filtering
- **Smart Scoring**: 60-100% confidence ratings

### 🎯 Sensitive File Scanner
- **30+ Default Files**: `.env`, `config.php`, `.git/config`, `backup.sql`, `phpinfo.php`, etc.
- **Variable Support**: `{DOMAIN}.zip`, `backup-{DOMAIN}.sql`
- **Smart Timeouts**: 3s-30s based on file size, partial download for large files
- **Auto-Scan**: Configurable scanning on page load
- **Progress Tracking**: Real-time scanning progress with file-by-file updates

⚠️ **Warning**: Auto-scanning with large file lists can be very noisy and may get you blocked by target websites. The sensitive file fuzzer is designed to scan only small, targeted lists of files.

#### 🛡️ Advanced False Positive Protection
- **Baseline 404 Comparison**: Detects catch-all responses
- **Size Range Clustering**: Groups similar-sized responses (±10%)
- **HTML Structure Detection**: Identifies identical page structures
- **Content Similarity**: Filters duplicate content patterns

### 🔍 Google Dorks & 📋 Copy Commands
- **8 Default Dorks**: Login pages, admin panels, config files, backups
- **6 Default Commands**: Nmap, Subfinder, FFUF, Nuclei
- **Fully Customizable**: Add/edit/remove via management pages
- **Variable Support**: `{DOMAIN}`, `{URL}`, `{TARGET}`, `{HOST}`, `{PROTOCOL}`

### 📊 Scan History & Results
- **All Results Page**: Centralized view of all scan results across domains
- **Search & Filter**: Find specific domains or file types
- **Table View**: Quick overview with file counts and timestamps
- **Detailed View**: Click domains to see full file details with metadata
- **Export/Import**: Backup and restore all configurations
- **Smart Storage**: Only stores scans that found files

## 📦 Installation

1. **Clone Repository**:
   ```bash
   git clone https://github.com/atikrahman1/bbhelp.git
   ```

2. **Load in Chrome**:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `bbhelp` folder

## 🎮 Quick Start

1. **Visit any website** → Extension auto-scans (if enabled)
2. **Click extension icon** → Access all tools
3. **Configure settings** → Customize scanning behavior
4. **View results** → Check "All Results" for scan history

### Key Actions
- **🔍 Scan HTTP Ports** → Check for open services
- **📜 Extract JS Files** → Analyze JavaScript for secrets/endpoints  
- **🎯 Scan Sensitive Files** → Find exposed configuration files
- **📊 All Results** → View scan history across all domains
- **⚙️ Configuration** → Customize tools, ports, file lists

## ⚙️ Configuration

### Port Scanner
- **Configure Ports**: Add custom ports or use presets
- **Auto-Scan**: Toggle automatic scanning on page load
- **Results**: View open ports with clickable links

### File Scanner  
- **File List**: Customize sensitive files to check
- **Auto-Scan**: Enable/disable automatic scanning
- **False Positive Protection**: Smart filtering (recommended: ON)
- **Exclusions**: Skip specific domains

### Variables
Use in tools, commands, and file paths:
- `{DOMAIN}` → `example.com`
- `{URL}` → `https://example.com/path`
- `{HOST}` → `www.example.com`

### Import/Export Configuration
Backup and restore all extension settings in JSON format.

**How it works**:
- **Export**: Downloads complete configuration as JSON file
- **Import**: Upload JSON file to restore all settings
- **Includes**: Tools, dorks, commands, file lists, exclusions, scanner settings

**Example Configuration**:
```json
{
  "metadata": {
    "exportedAt": "2024-12-12T10:30:00.000Z",
    "version": "1.0",
    "extensionName": "BBHelp"
  },
  "settings": {
    "scannerEnabled": true,
    "sensitiveFilesList": [
      ".env",
      "config.php",
      "backup.sql",
      "{DOMAIN}.zip"
    ],
    "customTools": [
      {
        "name": "Shodan",
        "url": "https://beta.shodan.io/domain/{DOMAIN}"
      },
      {
        "name": "Custom Tool",
        "url": "https://example.com/search?q={DOMAIN}"
      }
    ],
    "customDorks": [
      {
        "name": "Login Pages",
        "dork": "site:{DOMAIN} inurl:login"
      }
    ],
    "exclusionList": ["*.google.com", "localhost"],
    "falsePositiveProtection": true,
    "rescanInterval": 12
  }
}
```



## ⚠️ Disclaimer

For authorized security testing only. Always obtain permission before testing any system.

## 🤝 Contributing

Pull requests welcome! Please create a pull request for any improvements or bug fixes.

## ⭐ Support

If you like this project, please give it a star! ⭐

## 📞 Contact

For suggestions and improvements, contact me via:
- **X (Twitter)**: [@X7Rahman](https://x.com/X7Rahman)
- **LinkedIn**: [Atikqur Rahman](https://www.linkedin.com/in/atikqur-rahman/)

## 🙏 Credits

- **Endpoint & Secret Detection**: Inspired by [rep](https://github.com/repplus/rep) - Thanks for the innovative approach to JavaScript analysis!
