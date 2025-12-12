// Secret detection patterns
export const SECRET_REGEXES = {
  'google_api': '\\bAIza[0-9A-Za-z-_]{35}\\b',
  'slack_api_key': 'xox.-[0-9]{12}-[0-9]{12}-[0-9a-zA-Z]{24}',
  'google_cloud_platform_auth': '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}',
  'google_cloud_platform_api': '[A-Za-z0-9_]{21}--[A-Za-z0-9_]{8}',
  'amazon_secret_key': '\\b[0-9a-zA-Z/+]{40}\\b',
  'gmail_auth_token': '[0-9a-zA-Z_]{32}\\.apps\\.googleusercontent\\.com',
  'github_auth_token': '\\b[0-9a-fA-F]{40}\\b',
  'instagram_token': '[0-9a-fA-F]{7}\\.[0-9a-fA-F]{32}',
  'twitter_access_token': '[1-9][0-9]+-[0-9a-zA-Z]{40}',
  'firebase': '\\bAAAA[A-Za-z0-9_-]{7}:[A-Za-z0-9_-]{140}\\b',
  'google_captcha': '6L[0-9A-Za-z-_]{38}|^6[0-9a-zA-Z_-]{39}$',
  'google_oauth': 'ya29\\.[0-9A-Za-z\\-_]+',
  'amazon_aws_access_key_id': '\\bA[SK]IA[0-9A-Z]{16}\\b',
  'amazon_mws_auth_token': 'amzn\\.mws\\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
  'amazon_aws_url': 's3\\.amazonaws\\.com[/]+|[a-zA-Z0-9_-]*\\.s3\\.amazonaws\\.com',
  'facebook_access_token': '\\bEAACEdEose0cBA[0-9A-Za-z]+\\b',
  'authorization_basic': 'basic\\s+[a-zA-Z0-9=:_\\+\\/-]{20,}',
  'authorization_bearer': 'bearer\\s+[a-zA-Z0-9_\\-\\.=:_\\+\\/]{20,}',
  'authorization_api': '\\bapi[_-]?key\\s*[:=]\\s*[a-zA-Z0-9_\\-]{20,}\\b',
  'mailgun_api_key': '\\bkey-[0-9a-zA-Z]{32}\\b',
  'twilio_api_key': '\\bSK[0-9a-fA-F]{32}\\b',
  'twilio_account_sid': '\\bAC[a-zA-Z0-9_\\-]{32}\\b',
  'twilio_app_sid': '\\bAP[a-zA-Z0-9_\\-]{32}\\b',
  'paypal_braintree_access_token': 'access_token\\$production\\$[0-9a-z]{16}\\$[0-9a-f]{32}',
  'square_oauth_secret': 'sq0csp-[0-9A-Za-z\\-_]{43}|sq0[a-z]{3}-[0-9A-Za-z\\-_]{22,43}',
  'square_access_token': 'sqOatp-[0-9A-Za-z\\-_]{22}|EAAA[a-zA-Z0-9]{60}',
  'stripe_standard_api': '\\bsk_live_[0-9a-zA-Z]{24}\\b',
  'stripe_restricted_api': '\\brk_live_[0-9a-zA-Z]{24}\\b',
  'github_access_token': '[a-zA-Z0-9_-]*:[a-zA-Z0-9_\\-]+@github\\.com*',
  'rsa_private_key': '-----BEGIN RSA PRIVATE KEY-----',
  'ssh_dsa_private_key': '-----BEGIN DSA PRIVATE KEY-----',
  'ssh_dc_private_key': '-----BEGIN EC PRIVATE KEY-----',
  'pgp_private_block': '-----BEGIN PGP PRIVATE KEY BLOCK-----',
  'json_web_token': '\\bey[A-Za-z0-9_-]{10,}\\.ey[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\b',
  'bitcoin_address': '\\b[13][a-km-zA-HJ-NP-Z0-9]{26,33}\\b'
};

// Common JavaScript method patterns to exclude
const JS_METHOD_PATTERNS = [
  /^[a-z]+\.[a-z]+\.[a-z]+$/i,
  /prototype\./i,
  /^this\./i,
  /^Object\./i,
  /^Array\./i,
  /^window\./i,
  /^document\./i,
  /addEventListener$/,
  /removeEventListener$/,
  /hasOwnProperty$/,
  /preventDefault$/
];

// Known false positive patterns
const KNOWN_FALSE_POSITIVE_PATTERNS = [
  /^[a-f0-9]{40}$/i, // Git commit hashes
  /^[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)+$/, // PascalCase
  /^[a-z][a-zA-Z0-9]+(?:[A-Z][a-z0-9]+)+$/, // camelCase
  /^(?:map|filter|reduce|forEach|slice|splice|concat)/i,
  /^_react|_emotion|_styled|_next/i,
  /sourceMappingURL/i,
  /^__webpack/i
];

// False positive context patterns
const FALSE_POSITIVE_CONTEXT_PATTERNS = [
  /base64,/i,
  /data:image/i,
  /;base64/i,
  /"(?:publicKey|privateKey|data|content|image|icon|font)":/i,
  /sourceMappingURL=/i,
  /webpack:\/\//i,
  /__webpack/i
];

// Calculate Shannon Entropy
function getEntropy(str) {
  const len = str.length;
  const frequencies = {};
  for (let i = 0; i < len; i++) {
    const char = str[i];
    frequencies[char] = (frequencies[char] || 0) + 1;
  }
  let entropy = 0;
  for (const char in frequencies) {
    const p = frequencies[char] / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

// Check if string looks like base64-encoded binary data
function looksLikeBinaryBase64(str) {
  const entropy = getEntropy(str);
  const plusSlashCount = (str.match(/[+/]/g) || []).length;
  const plusSlashRatio = plusSlashCount / str.length;
  
  if (entropy > 4.5 && plusSlashRatio > 0.1) return true;
  if (/(\d)\1{3,}/.test(str)) return true;
  if (plusSlashCount > 0) return true;
  return false;
}

// Check if it's likely base64 data
function isLikelyBase64Data(str, context) {
  if (/data:[\w/-]+;base64,/.test(context)) return true;
  if (/={1,2}$/.test(str) && str.length > 100) return true;
  if (str.length > 200 && /^[A-Za-z0-9+/=]+$/.test(str)) return true;
  
  const beforeContext = context.substring(0, 100);
  if (/"(?:data|content|image|icon|font|media|src|href)":\s*"[^"]*$/i.test(beforeContext)) {
    return true;
  }
  return false;
}

// Check if string is a SHA-1 hash
function isSHA1Hash(str) {
  return /^[a-f0-9]{40}$/i.test(str);
}

// Check if string is valid Base58
function isValidBase58(str) {
  return !/[0OIl]/.test(str);
}

// Check if it's camelCase or PascalCase
function isCamelOrPascalCase(str) {
  return /^[a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*$/.test(str) ||
         /^[A-Z][a-z]+[A-Z][a-zA-Z0-9]*$/.test(str);
}

// Check if file is minified
function isMinifiedFile(content) {
  if (content.length < 1000) return false;
  const lines = content.split('\n');
  const avgLineLength = content.length / lines.length;
  if (avgLineLength > 500) return true;
  if (/webpackJsonp|__webpack_require__|\/\*\*\*\*\*\*\//.test(content.substring(0, 1000))) {
    return true;
  }
  return false;
}

// Check if line is in a comment
function isInComment(line) {
  const trimmed = line.trim();
  return /^\s*\/\//.test(trimmed) || /^\s*\*/.test(trimmed) || /^\s*\/\*/.test(trimmed);
}

// Calculate confidence score
function calculateConfidence(type, match, entropy, context) {
  let score = 50;
  
  if (entropy > 4.5) score += 20;
  else if (entropy > 3.5) score += 10;
  else score -= 15;
  
  if (type === 'google_api' && match.startsWith('AIza')) score += 30;
  if (type === 'json_web_token' && match.startsWith('ey')) score += 20;
  if (type.includes('authorization')) score += 15;
  if (type.includes('stripe') || type.includes('twilio')) score += 15;
  
  if (match.length > 30) score += 10;
  else if (match.length < 20) score -= 10;
  
  if (/test|example|sample|demo|placeholder|dummy/i.test(context)) {
    score -= 20;
  }
  
  if (/["'](?:key|secret|token|password|auth)["']\s*:\s*["'][^"']*$/i.test(context.substring(0, 50))) {
    score += 15;
  }
  
  return Math.min(100, Math.max(0, score));
}

// Deduplicate results
function deduplicateResults(results) {
  const seen = new Set();
  return results.filter(result => {
    const key = `${result.type}:${result.match}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Main scan function
export function scanContent(content, url) {
  const results = [];
  if (!content) return results;
  
  if (isMinifiedFile(content)) {
    console.log(`Skipping minified file: ${url}`);
    return results;
  }
  
  for (const [name, pattern] of Object.entries(SECRET_REGEXES)) {
    try {
      const regex = new RegExp(pattern, 'gi');
      let match;
      
      while ((match = regex.exec(content)) !== null) {
        const matchedStr = match[0];
        
        // Check false positives
        let isFalsePositive = false;
        for (const fpPattern of KNOWN_FALSE_POSITIVE_PATTERNS) {
          if (fpPattern.test(matchedStr)) {
            isFalsePositive = true;
            break;
          }
        }
        if (isFalsePositive) continue;
        
        // Get context
        const contextStart = Math.max(0, match.index - 100);
        const contextEnd = Math.min(content.length, match.index + matchedStr.length + 100);
        const context = content.substring(contextStart, contextEnd);
        
        // Check context patterns
        let skipDueToContext = false;
        for (const contextPattern of FALSE_POSITIVE_CONTEXT_PATTERNS) {
          if (contextPattern.test(context)) {
            skipDueToContext = true;
            break;
          }
        }
        if (skipDueToContext) continue;
        
        if (isLikelyBase64Data(matchedStr, context)) continue;
        
        // Get line
        const lineStart = content.lastIndexOf('\n', match.index) + 1;
        const lineEnd = content.indexOf('\n', match.index);
        const line = content.substring(lineStart, lineEnd === -1 ? content.length : lineEnd);
        
        if (isInComment(line)) continue;
        if (/https?:\/\//.test(line) || /sourceMappingURL/.test(line)) continue;
        
        // Enhanced filtering for specific types
        if (name === 'json_web_token') {
          if (!matchedStr.startsWith('ey')) continue;
          const parts = matchedStr.split('.');
          if (parts.length !== 3) continue;
          if (parts.some(p => p.length < 10)) continue;
        }
        
        if (name === 'bitcoin_address') {
          if (!isValidBase58(matchedStr)) continue;
          if (getEntropy(matchedStr) < 3.8) continue;
        }
        
        if (name === 'amazon_secret_key') {
          if (isSHA1Hash(matchedStr)) continue;
          if (isCamelOrPascalCase(matchedStr)) continue;
          if (looksLikeBinaryBase64(matchedStr)) continue;
          const entropy = getEntropy(matchedStr);
          if (entropy < 3.5 || entropy > 5.0) continue;
        }
        
        if (name === 'github_auth_token' && isSHA1Hash(matchedStr)) continue;
        
        const entropy = getEntropy(matchedStr);
        const confidence = calculateConfidence(name, matchedStr, entropy, context);
        
        if (confidence < 60) continue;
        
        results.push({
          file: url,
          type: name,
          match: matchedStr,
          index: match.index,
          confidence: confidence,
          entropy: entropy.toFixed(2),
          context: line.trim().substring(0, 100)
        });
      }
    } catch (e) {
      console.warn(`Invalid regex for ${name}:`, e);
    }
  }
  
  return deduplicateResults(results);
}

// Scan multiple JS files
export async function scanJSFiles(jsFiles, onProgress) {
  const results = [];
  let processed = 0;
  const total = jsFiles.length;
  
  for (const url of jsFiles) {
    try {
      const response = await fetch(url);
      const content = await response.text();
      
      if (content) {
        const fileSecrets = scanContent(content, url);
        results.push(...fileSecrets);
      }
    } catch (err) {
      console.error('Error scanning file:', url, err);
    }
    
    processed++;
    if (onProgress) onProgress(processed, total);
  }
  
  return deduplicateResults(results);
}
