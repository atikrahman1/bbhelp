# Bug Bounty Hunter Tools - Chrome Extension

A Chrome extension for bug bounty hunters that provides quick access to reconnaissance tools for the current domain.

## Features

### Recon Tools
- **Shodan Search**: Opens Shodan domain search for the current site
- **Crt.sh Certificates**: Views SSL certificates for the domain
- **Subdomain Center**: Discovers subdomains using Subdomain Center API

### JavaScript File Extraction & Analysis
- **Extract JS Files**: Automatically extracts all JavaScript files from the current page
- **Endpoint Discovery**: Scans extracted JS files for API endpoints with confidence scoring
- **Secret Scanner**: Detects exposed secrets, API keys, and credentials in JavaScript files

#### Secret Detection Patterns
The scanner detects 30+ types of secrets including:
- Google API Keys, Firebase tokens, Google OAuth tokens
- AWS Access Keys, Secret Keys, S3 URLs
- GitHub tokens and access credentials
- Stripe API keys (live and restricted)
- Twilio API keys and SIDs
- JWT tokens with validation
- Private keys (RSA, SSH, PGP)
- OAuth tokens (Facebook, Instagram, Twitter)
- Bitcoin addresses
- And many more...

#### Secret Scanner Features
- **Entropy Analysis**: Uses Shannon entropy to identify high-randomness strings
- **Context Awareness**: Filters out false positives from minified code and base64 images
- **Confidence Scoring**: Each finding includes a confidence score (60-100%)
- **Smart Filtering**: Excludes webpack hashes, source maps, and common JS patterns
- **Export Results**: Export findings as JSON for further analysis

### Google Dorks
- **Login Pages**: `site:domain inurl:login`
- **Text Files**: `site:domain filetype:txt`
- **PDF Files**: `site:domain filetype:pdf`
- **Admin Pages**: `site:domain inurl:admin`
- **Config Files**: `site:domain filetype:config`
- **SQL Files**: `site:domain filetype:sql`
- **ENV Files**: `site:domain filetype:env`
- **Backup Files**: `site:domain inurl:backup`

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the extension folder
5. The extension icon will appear in your toolbar

## Usage

1. Navigate to any website
2. Click the extension icon
3. Choose one of the three tools:
   - **Shodan** - Domain intelligence and exposed services
   - **Crt.sh** - SSL certificate transparency logs
   - **Subdomain** - Subdomain enumeration

Each button opens the respective tool in a new tab with the current domain pre-filled.

## Icons

The extension needs icon files. You can:
- Create your own icons (16x16, 48x48, 128x128 PNG files)
- Use placeholder icons temporarily
- Download free icons from sites like flaticon.com

Name them: `icon16.png`, `icon48.png`, `icon128.png`

## Notes

- Works on any valid domain (http/https)
- Requires active internet connection
- Some tools may require accounts for full functionality
