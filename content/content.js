// Listen for messages from popup and background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractJS') {
        const scripts = document.querySelectorAll('script[src]');
        const jsFiles = [];

        // Common third-party domains and patterns to exclude
        const excludePatterns = [
            // Chrome extensions
            /^chrome-extension:\/\//i,
            /^moz-extension:\/\//i,
            
            // Analytics & Tracking
            /google-analytics\.com/i,
            /googletagmanager\.com/i,
            /analytics\.google\.com/i,
            /doubleclick\.net/i,
            /facebook\.net/i,
            /connect\.facebook/i,
            /tiktok\.com/i,
            /byteoversea\.com/i,
            /analytics\.tiktok/i,
            /hotjar\.com/i,
            /mouseflow\.com/i,
            /mixpanel\.com/i,
            /segment\.(com|io)/i,
            /amplitude\.com/i,
            /heap\.io/i,
            
            // Common CDNs with libraries
            /jquery.*\.js/i,
            /bootstrap.*\.js/i,
            /angular.*\.js/i,
            /react.*\.js/i,
            /vue.*\.js/i,
            /lodash.*\.js/i,
            /moment.*\.js/i,
            /axios.*\.js/i,
            /popper.*\.js/i,
            /swiper.*\.js/i,
            
            // CDN domains (but we'll allow if it's custom code)
            /cdn\.jsdelivr\.net.*\/(jquery|bootstrap|angular|react|vue|lodash|moment|axios|popper|swiper)/i,
            /cdnjs\.cloudflare\.com.*\/(jquery|bootstrap|angular|react|vue|lodash|moment|axios|popper|swiper)/i,
            /unpkg\.com.*\/(jquery|bootstrap|angular|react|vue|lodash|moment|axios|popper|swiper)/i,
            /code\.jquery\.com/i,
            /maxcdn\.bootstrapcdn\.com/i,
            /stackpath\.bootstrapcdn\.com/i,
            
            // Social Media Widgets
            /platform\.twitter\.com/i,
            /connect\.facebook\.net/i,
            /apis\.google\.com\/js\/platform/i,
            /linkedin\.com\/embed/i,
            /instagram\.com\/embed/i,
            
            // Ad Networks
            /googlesyndication\.com/i,
            /adservice\.google/i,
            /pagead2\.googlesyndication/i,
            /ads\.yahoo\.com/i,
            /advertising\.com/i,
            
            // Chat/Support Widgets
            /intercom\.io/i,
            /zendesk\.com/i,
            /zopim\.com/i,
            /livechatinc\.com/i,
            /drift\.com/i,
            /crisp\.chat/i,
            
            // Other Common Services
            /recaptcha\.net/i,
            /gstatic\.com/i,
            /cloudflare\.com\/ajax/i,
            /polyfill\.io/i,
            /fontawesome/i,
            /fonts\.googleapis/i
        ];

        scripts.forEach(script => {
            if (script.src) {
                const src = script.src;
                
                // Check if URL matches any exclude pattern
                const shouldExclude = excludePatterns.some(pattern => pattern.test(src));
                
                if (!shouldExclude) {
                    jsFiles.push(src);
                }
            }
        });

        sendResponse({ jsFiles: jsFiles });
    } else if (request.action === 'scanSensitiveFiles') {
        // Perform sensitive file scanning
        const protection = request.falsePositiveProtection !== undefined ? request.falsePositiveProtection : true;
        scanSensitiveFiles(request.filesList, request.previewLength, request.baseUrl, protection)
            .then(foundFiles => {
                sendResponse({ foundFiles: foundFiles, protectionEnabled: protection });
            })
            .catch(error => {
                console.error('Scan error:', error);
                sendResponse({ foundFiles: [], protectionEnabled: protection });
            });
        return true; // Keep channel open for async response
    } else if (request.action === 'scanSensitiveFilesWithProgress') {
        // Perform sensitive file scanning with progress updates
        const protection = request.falsePositiveProtection !== undefined ? request.falsePositiveProtection : true;
        scanSensitiveFilesWithProgress(request.filesList, request.previewLength, request.baseUrl, protection)
            .then(foundFiles => {
                sendResponse({ foundFiles: foundFiles, protectionEnabled: protection });
            })
            .catch(error => {
                console.error('Scan error:', error);
                sendResponse({ foundFiles: [], protectionEnabled: protection });
            });
        return true; // Keep channel open for async response
    }
    return true;
});

// Calculate simple hash for content comparison
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
}

// Check if content looks like a 404/error page
function looksLike404Page(text, contentType) {
    const lower = text.toLowerCase();
    const indicators = [
        'not found', '404', 'page not found', 'file not found',
        'does not exist', 'cannot be found', 'no such file',
        'error 404', 'http 404', 'page doesn\'t exist',
        'requested url was not found', 'page you are looking for',
        'page you requested', 'couldn\'t find', 'can\'t find'
    ];
    
    // Check for 404 indicators in first 1000 chars
    const snippet = lower.substring(0, 1000);
    let indicatorCount = 0;
    for (const indicator of indicators) {
        if (snippet.includes(indicator)) {
            indicatorCount++;
        }
    }
    
    // If multiple indicators found, likely a 404 page
    if (indicatorCount >= 2) return true;
    
    // Check if it's HTML with 404 in title or h1
    if (contentType.includes('text/html')) {
        if (/<title>[^<]*404[^<]*<\/title>/i.test(text)) return true;
        if (/<h1[^>]*>[^<]*404[^<]*<\/h1>/i.test(text)) return true;
        if (/<h1[^>]*>[^<]*not found[^<]*<\/h1>/i.test(text)) return true;
    }
    
    return false;
}

// Check if content type matches expected file type
function isValidContentType(file, contentType) {
    const ct = contentType.toLowerCase();
    
    // Files that should NEVER return HTML (strict mode)
    const neverHtmlExtensions = [
        '.env', '.sql', '.zip', '.log', '.json', '.xml', 
        '.yaml', '.yml', '.lock', '.config', '.backup',
        '.bak', '.old', '.swp', '.history'
    ];
    
    // Get file extension or check filename patterns
    const fileName = file.toLowerCase();
    const ext = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '';
    
    // Strict check: These files should NEVER be HTML
    for (const neverExt of neverHtmlExtensions) {
        if (fileName.endsWith(neverExt) && ct.includes('text/html')) {
            return false; // HTML response for these files = definitely false positive
        }
    }
    
    // Expected content types for common sensitive files
    const expectations = {
        '.env': ['text/plain', 'application/octet-stream', 'text/x-env'],
        '.sql': ['text/plain', 'application/sql', 'application/x-sql'],
        '.zip': ['application/zip', 'application/x-zip', 'application/x-compressed'],
        '.log': ['text/plain', 'text/x-log'],
        '.json': ['application/json', 'text/plain'],
        '.xml': ['application/xml', 'text/xml'],
        '.yaml': ['text/yaml', 'text/x-yaml', 'text/plain'],
        '.yml': ['text/yaml', 'text/x-yaml', 'text/plain'],
        '.php': ['text/html', 'text/plain', 'application/x-httpd-php'],
        '.config': ['text/plain', 'application/xml'],
        '.lock': ['text/plain', 'application/json']
    };
    
    // If we have expectations for this file type
    if (expectations[ext]) {
        // Check if content type matches any expected type
        return expectations[ext].some(expected => ct.includes(expected));
    }
    
    // For unknown extensions, reject HTML (likely 404)
    if (ct.includes('text/html') && !fileName.endsWith('.html') && !fileName.endsWith('.php')) {
        return false;
    }
    
    return true;
}

// Replace variables in file path
function replaceVariables(filePath, baseUrl) {
    try {
        const urlObj = new URL(baseUrl);
        const protocol = urlObj.protocol.replace(':', '');
        const host = urlObj.host;
        const hostname = urlObj.hostname;
        const domain = hostname.replace(/^www\./, '');
        const origin = urlObj.origin;
        
        return filePath
            .replace(/\{DOMAIN\}/g, domain)
            .replace(/\{URL\}/g, baseUrl)
            .replace(/\{HOST\}/g, host)
            .replace(/\{HOSTNAME\}/g, hostname)
            .replace(/\{PROTOCOL\}/g, protocol)
            .replace(/\{ORIGIN\}/g, origin);
    } catch (e) {
        // If URL parsing fails, return original path
        return filePath;
    }
}

// Scan for sensitive files with false positive detection
async function scanSensitiveFiles(filesList, previewLength, baseUrl, falsePositiveProtection = true) {
    const foundFiles = [];
    const responses = [];
    
    // Step 1: Get baseline 404 response (only if protection is enabled)
    let baseline404 = null;
    
    if (falsePositiveProtection) {
        const randomFile = `nonexistent-${Math.random().toString(36).substring(7)}-${Date.now()}.txt`;
        
        try {
            const baselineResponse = await Promise.race([
                fetch(`${baseUrl}/${randomFile}`, { method: 'GET' }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
            ]);
            
            const baselineText = await baselineResponse.text();
            baseline404 = {
                status: baselineResponse.status,
                size: baselineText.length,
                hash: simpleHash(baselineText),
                contentType: baselineResponse.headers.get('content-type') || 'unknown'
            };
        } catch (error) {
            // Baseline request failed, continue without it
        }
    }

    // Step 2: Scan all files with smart timeout strategy
    for (const file of filesList) {
        // Replace variables in file path
        const processedFile = replaceVariables(file, baseUrl);
        const fileUrl = `${baseUrl}/${processedFile}`;
        
        try {
            // 1. HEAD Request First - Quick check if file exists and get size
            let headResponse;
            let contentLength = 0;
            
            try {
                headResponse = await Promise.race([
                    fetch(fileUrl, { method: 'HEAD' }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('head_timeout')), 2000))
                ]);
                
                if (headResponse && headResponse.ok) {
                    contentLength = parseInt(headResponse.headers.get('content-length')) || 0;
                }
            } catch (headError) {
                // HEAD failed, continue with GET request
                headResponse = null;
            }
            
            // 2. Dynamic Timeout Based on File Size
            let timeout = 3000; // Default 3 seconds
            
            if (contentLength > 100 * 1024 * 1024) { // > 100MB
                timeout = 30000; // 30 seconds
            } else if (contentLength > 10 * 1024 * 1024) { // > 10MB
                timeout = 15000; // 15 seconds
            } else if (contentLength > 1024 * 1024) { // > 1MB
                timeout = 8000; // 8 seconds
            }
            
            if (contentLength > 0) {
                console.log(`[Scanner] ${processedFile}: Size ${Math.round(contentLength/1024)}KB, timeout ${timeout}ms`);
            }
            
            // GET request with dynamic timeout
            const getResponse = await Promise.race([
                fetch(fileUrl, { method: 'GET' }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeout))
            ]);

            if (getResponse.ok) {
                const contentType = getResponse.headers.get('content-type') || 'unknown';
                const responseContentLength = getResponse.headers.get('content-length');
                let actualSize = parseInt(responseContentLength) || contentLength;
                
                // 3. Partial Download for Very Large Files
                let text;
                
                if (actualSize > 50 * 1024 * 1024) { // > 50MB
                    // Read only first 1MB for hash and preview
                    const reader = getResponse.body.getReader();
                    const chunks = [];
                    let totalRead = 0;
                    const maxRead = 1024 * 1024; // 1MB
                    
                    try {
                        while (totalRead < maxRead) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            chunks.push(value);
                            totalRead += value.length;
                        }
                        reader.releaseLock();
                        
                        // Convert chunks to text
                        const decoder = new TextDecoder();
                        text = decoder.decode(new Uint8Array(chunks.reduce((acc, chunk) => [...acc, ...chunk], [])));
                        
                        console.log(`[Scanner] Large file ${processedFile}: Read ${Math.round(totalRead/1024)}KB of ${Math.round(actualSize/1024)}KB total`);
                    } catch (readError) {
                        // Fallback to full read if streaming fails
                        text = await getResponse.text();
                        actualSize = text.length;
                    }
                } else {
                    // Normal read for smaller files
                    text = await getResponse.text();
                    actualSize = text.length;
                }
                
                const hash = simpleHash(text);
                
                responses.push({
                    file: processedFile, // Store the processed filename
                    url: fileUrl,
                    status: getResponse.status,
                    contentType: contentType,
                    size: actualSize,
                    text: text,
                    hash: hash
                });
                
                console.log(`[Scanner] Successfully scanned ${processedFile}: ${Math.round(actualSize/1024)}KB`);
            }
        } catch (error) {
            console.log(`[Scanner] Failed to scan ${processedFile}: ${error.message}`);
            // File not found or error - skip
        }
    }
    
    // Step 3: Filter false positives (only if protection is enabled)
    let filtered = responses;
    
    if (falsePositiveProtection) {
        console.log('[Scanner] Starting filters with', responses.length, 'responses');
        
        // 3a. Remove responses matching baseline 404
        if (baseline404 && baseline404.status === 200) {
            const beforeCount = filtered.length;
            filtered = responses.filter(r => {
                // If hash matches baseline, it's a false positive
                if (r.hash === baseline404.hash) return false;
                // If size matches baseline exactly, likely same page
                if (r.size === baseline404.size) return false;
                return true;
            });
            console.log('[Scanner] After baseline filter:', filtered.length, '(removed', beforeCount - filtered.length, ')');
        }
        
        // 3b. Enhanced duplicate detection - size ranges + content similarity
        const beforeSizeFilter = filtered.length;
        
        // Group responses by similar sizes (within 10% range)
        const sizeGroups = {};
        filtered.forEach(r => {
            let foundGroup = false;
            for (const groupSize in sizeGroups) {
                const groupSizeNum = parseInt(groupSize);
                const sizeDiff = Math.abs(r.size - groupSizeNum) / Math.max(r.size, groupSizeNum);
                if (sizeDiff <= 0.1) { // Within 10% size difference
                    sizeGroups[groupSize].push(r);
                    foundGroup = true;
                    break;
                }
            }
            if (!foundGroup) {
                sizeGroups[r.size] = [r];
            }
        });
        
        // Check for suspicious groups (5+ files with similar sizes)
        const suspiciousFiles = new Set();
        for (const groupSize in sizeGroups) {
            const group = sizeGroups[groupSize];
            if (group.length >= 5) {
                // Additional check: compare content similarity within the group
                const contentHashes = group.map(r => {
                    // Use first 1KB for content comparison
                    const sample = r.text.substring(0, 1024);
                    return sample.replace(/\s+/g, ' ').trim(); // Normalize whitespace
                });
                
                // If most files in the group have very similar content, mark as suspicious
                const uniqueContent = new Set(contentHashes);
                if (uniqueContent.size <= 2) { // 2 or fewer unique content patterns
                    console.log('[Scanner] Found suspicious size group:', group.length, 'files with similar sizes and content');
                    group.forEach(r => suspiciousFiles.add(r.url));
                }
            }
        }
        
        // Filter out suspicious files
        filtered = filtered.filter(r => !suspiciousFiles.has(r.url));
        console.log('[Scanner] After enhanced size+content filter:', filtered.length, '(removed', beforeSizeFilter - filtered.length, ')');
        
        // 3c. Check for identical HTML structure (catch-all pages)
        const beforeHtmlFilter = filtered.length;
        const htmlStructures = {};
        
        filtered.forEach(r => {
            if (r.contentType && r.contentType.includes('text/html')) {
                // Extract HTML structure signature (first 500 chars, remove dynamic content)
                let structure = r.text.substring(0, 500)
                    .replace(/\d+/g, 'NUM') // Replace numbers
                    .replace(/[a-f0-9]{8,}/gi, 'HASH') // Replace long hex strings
                    .replace(/\s+/g, ' ') // Normalize whitespace
                    .trim();
                
                if (!htmlStructures[structure]) {
                    htmlStructures[structure] = [];
                }
                htmlStructures[structure].push(r);
            }
        });
        
        // If 4+ files have identical HTML structure, likely catch-all
        const htmlSuspiciousFiles = new Set();
        for (const structure in htmlStructures) {
            const group = htmlStructures[structure];
            if (group.length >= 4) {
                console.log('[Scanner] Found identical HTML structure in', group.length, 'files');
                group.forEach(r => htmlSuspiciousFiles.add(r.url));
            }
        }
        
        filtered = filtered.filter(r => !htmlSuspiciousFiles.has(r.url));
        console.log('[Scanner] After HTML structure filter:', filtered.length, '(removed', beforeHtmlFilter - filtered.length, ')');
        
        // 3d. Check for 404 indicators in content
        const before404Filter = filtered.length;
        filtered = filtered.filter(r => {
            const is404 = looksLike404Page(r.text, r.contentType);
            if (is404) console.log('[Scanner] Filtered as 404:', r.file);
            return !is404;
        });
        console.log('[Scanner] After 404 pattern filter:', filtered.length, '(removed', before404Filter - filtered.length, ')');
        
        // 3e. Remove suspiciously small responses (< 10 bytes, likely empty or minimal)
        const beforeSizeMinFilter = filtered.length;
        filtered = filtered.filter(r => r.size >= 10);
        console.log('[Scanner] After min-size filter:', filtered.length, '(removed', beforeSizeMinFilter - filtered.length, ')');
    }
    
    // Step 4: Build final results
    for (const r of filtered) {
        const preview = r.text.substring(0, previewLength).trim() || 
                       r.text.substring(0, previewLength * 5).trim();
        
        foundFiles.push({
            file: r.file,
            url: r.url,
            status: r.status,
            contentType: r.contentType,
            size: r.size,
            preview: preview || '(binary or empty)',
            foundAt: Date.now()
        });
    }

    return foundFiles;
}

// Scan for sensitive files with progress updates
async function scanSensitiveFilesWithProgress(filesList, previewLength, baseUrl, falsePositiveProtection = true) {
    const foundFiles = [];
    const responses = [];
    
    // Step 1: Get baseline 404 response (only if protection is enabled)
    let baseline404 = null;
    
    if (falsePositiveProtection) {
        const randomFile = `nonexistent-${Math.random().toString(36).substring(7)}-${Date.now()}.txt`;
        
        try {
            const baselineResponse = await Promise.race([
                fetch(`${baseUrl}/${randomFile}`, { method: 'GET' }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
            ]);
            
            const baselineText = await baselineResponse.text();
            baseline404 = {
                status: baselineResponse.status,
                size: baselineText.length,
                hash: simpleHash(baselineText),
                contentType: baselineResponse.headers.get('content-type') || 'unknown'
            };
        } catch (error) {
            // Baseline request failed, continue without it
        }
    }

    // Step 2: Scan all files with smart timeout strategy and progress updates
    for (let i = 0; i < filesList.length; i++) {
        const file = filesList[i];
        
        // Send progress update
        chrome.runtime.sendMessage({
            action: 'scanProgress',
            completed: i,
            total: filesList.length,
            currentFile: file
        });
        
        // Replace variables in file path
        const processedFile = replaceVariables(file, baseUrl);
        const fileUrl = `${baseUrl}/${processedFile}`;
        
        try {
            // 1. HEAD Request First - Quick check if file exists and get size
            let headResponse;
            let contentLength = 0;
            
            try {
                headResponse = await Promise.race([
                    fetch(fileUrl, { method: 'HEAD' }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('head_timeout')), 2000))
                ]);
                
                if (headResponse && headResponse.ok) {
                    contentLength = parseInt(headResponse.headers.get('content-length')) || 0;
                }
            } catch (headError) {
                // HEAD failed, continue with GET request
                headResponse = null;
            }
            
            // 2. Dynamic Timeout Based on File Size
            let timeout = 3000; // Default 3 seconds
            
            if (contentLength > 100 * 1024 * 1024) { // > 100MB
                timeout = 30000; // 30 seconds
            } else if (contentLength > 10 * 1024 * 1024) { // > 10MB
                timeout = 15000; // 15 seconds
            } else if (contentLength > 1024 * 1024) { // > 1MB
                timeout = 8000; // 8 seconds
            }
            
            if (contentLength > 0) {
                console.log(`[Scanner] ${processedFile}: Size ${Math.round(contentLength/1024)}KB, timeout ${timeout}ms`);
            }
            
            // GET request with dynamic timeout
            const getResponse = await Promise.race([
                fetch(fileUrl, { method: 'GET' }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeout))
            ]);

            if (getResponse.ok) {
                const contentType = getResponse.headers.get('content-type') || 'unknown';
                const responseContentLength = getResponse.headers.get('content-length');
                let actualSize = parseInt(responseContentLength) || contentLength;
                
                // 3. Partial Download for Very Large Files
                let text;
                
                if (actualSize > 50 * 1024 * 1024) { // > 50MB
                    // Read only first 1MB for hash and preview
                    const reader = getResponse.body.getReader();
                    const chunks = [];
                    let totalRead = 0;
                    const maxRead = 1024 * 1024; // 1MB
                    
                    try {
                        while (totalRead < maxRead) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            chunks.push(value);
                            totalRead += value.length;
                        }
                        reader.releaseLock();
                        
                        // Convert chunks to text
                        const decoder = new TextDecoder();
                        text = decoder.decode(new Uint8Array(chunks.reduce((acc, chunk) => [...acc, ...chunk], [])));
                        
                        console.log(`[Scanner] Large file ${processedFile}: Read ${Math.round(totalRead/1024)}KB of ${Math.round(actualSize/1024)}KB total`);
                    } catch (readError) {
                        // Fallback to full read if streaming fails
                        text = await getResponse.text();
                        actualSize = text.length;
                    }
                } else {
                    // Normal read for smaller files
                    text = await getResponse.text();
                    actualSize = text.length;
                }
                
                const hash = simpleHash(text);
                
                responses.push({
                    file: processedFile, // Store the processed filename
                    url: fileUrl,
                    status: getResponse.status,
                    contentType: contentType,
                    size: actualSize,
                    text: text,
                    hash: hash
                });
                
                console.log(`[Scanner] Successfully scanned ${processedFile}: ${Math.round(actualSize/1024)}KB`);
            }
        } catch (error) {
            console.log(`[Scanner] Failed to scan ${processedFile}: ${error.message}`);
            // Request failed (timeout, network error, etc.)
            // Don't add to responses - only successful requests are considered
        }
    }
    
    // Send final progress update
    chrome.runtime.sendMessage({
        action: 'scanProgress',
        completed: filesList.length,
        total: filesList.length,
        currentFile: 'Processing results...'
    });
    
    // Step 3: Filter false positives (same logic as original function)
    let filtered = responses;
    
    if (falsePositiveProtection) {
        console.log('[Scanner] Starting filters with', responses.length, 'responses');
        
        // 3a. Remove responses matching baseline 404
        if (baseline404 && baseline404.status === 200) {
            const beforeCount = filtered.length;
            filtered = responses.filter(r => {
                // If hash matches baseline, it's a false positive
                if (r.hash === baseline404.hash) return false;
                // If size matches baseline exactly, likely same page
                if (r.size === baseline404.size) return false;
                return true;
            });
            console.log('[Scanner] After baseline filter:', filtered.length, '(removed', beforeCount - filtered.length, ')');
        }
        
        // 3b. Enhanced duplicate detection - size ranges + content similarity
        const beforeSizeFilter = filtered.length;
        
        // Group responses by similar sizes (within 10% range)
        const sizeGroups = {};
        filtered.forEach(r => {
            let foundGroup = false;
            for (const groupSize in sizeGroups) {
                const groupSizeNum = parseInt(groupSize);
                const sizeDiff = Math.abs(r.size - groupSizeNum) / Math.max(r.size, groupSizeNum);
                if (sizeDiff <= 0.1) { // Within 10% size difference
                    sizeGroups[groupSize].push(r);
                    foundGroup = true;
                    break;
                }
            }
            if (!foundGroup) {
                sizeGroups[r.size] = [r];
            }
        });
        
        // Check for suspicious groups (5+ files with similar sizes)
        const suspiciousFiles = new Set();
        for (const groupSize in sizeGroups) {
            const group = sizeGroups[groupSize];
            if (group.length >= 5) {
                // Additional check: compare content similarity within the group
                const contentHashes = group.map(r => {
                    // Use first 1KB for content comparison
                    const sample = r.text.substring(0, 1024);
                    return sample.replace(/\s+/g, ' ').trim(); // Normalize whitespace
                });
                
                // If most files in the group have very similar content, mark as suspicious
                const uniqueContent = new Set(contentHashes);
                if (uniqueContent.size <= 2) { // 2 or fewer unique content patterns
                    console.log('[Scanner] Found suspicious size group:', group.length, 'files with similar sizes and content');
                    group.forEach(r => suspiciousFiles.add(r.url));
                }
            }
        }
        
        // Filter out suspicious files
        filtered = filtered.filter(r => !suspiciousFiles.has(r.url));
        console.log('[Scanner] After enhanced size+content filter:', filtered.length, '(removed', beforeSizeFilter - filtered.length, ')');
        
        // 3c. Check for identical HTML structure (catch-all pages)
        const beforeHtmlFilter = filtered.length;
        const htmlStructures = {};
        
        filtered.forEach(r => {
            if (r.contentType && r.contentType.includes('text/html')) {
                // Extract HTML structure signature (first 500 chars, remove dynamic content)
                let structure = r.text.substring(0, 500)
                    .replace(/\d+/g, 'NUM') // Replace numbers
                    .replace(/[a-f0-9]{8,}/gi, 'HASH') // Replace long hex strings
                    .replace(/\s+/g, ' ') // Normalize whitespace
                    .trim();
                
                if (!htmlStructures[structure]) {
                    htmlStructures[structure] = [];
                }
                htmlStructures[structure].push(r);
            }
        });
        
        // If 4+ files have identical HTML structure, likely catch-all
        const htmlSuspiciousFiles = new Set();
        for (const structure in htmlStructures) {
            const group = htmlStructures[structure];
            if (group.length >= 4) {
                console.log('[Scanner] Found identical HTML structure in', group.length, 'files');
                group.forEach(r => htmlSuspiciousFiles.add(r.url));
            }
        }
        
        filtered = filtered.filter(r => !htmlSuspiciousFiles.has(r.url));
        console.log('[Scanner] After HTML structure filter:', filtered.length, '(removed', beforeHtmlFilter - filtered.length, ')');
        
        // 3d. Check for 404 indicators in content
        const before404Filter = filtered.length;
        filtered = filtered.filter(r => {
            const is404 = looksLike404Page(r.text, r.contentType);
            if (is404) console.log('[Scanner] Filtered as 404:', r.file);
            return !is404;
        });
        console.log('[Scanner] After 404 pattern filter:', filtered.length, '(removed', before404Filter - filtered.length, ')');
        
        // 3e. Remove suspiciously small responses (< 10 bytes, likely empty or minimal)
        const beforeSizeMinFilter = filtered.length;
        filtered = filtered.filter(r => r.size >= 10);
        console.log('[Scanner] After min-size filter:', filtered.length, '(removed', beforeSizeMinFilter - filtered.length, ')');
    }
    
    // Step 4: Build final results
    for (const r of filtered) {
        const preview = r.text.substring(0, previewLength).trim() || 
                       r.text.substring(0, previewLength * 5).trim();
        
        foundFiles.push({
            file: r.file,
            url: r.url,
            status: r.status,
            contentType: r.contentType,
            size: r.size,
            preview: preview || '(binary or empty)',
            foundAt: Date.now()
        });
    }

    return foundFiles;
}
