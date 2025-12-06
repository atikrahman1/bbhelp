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
        scanSensitiveFiles(request.filesList, request.previewLength, request.baseUrl)
            .then(foundFiles => {
                sendResponse({ foundFiles: foundFiles });
            })
            .catch(error => {
                console.error('Scan error:', error);
                sendResponse({ foundFiles: [] });
            });
        return true; // Keep channel open for async response
    }
    return true;
});

// Scan for sensitive files
async function scanSensitiveFiles(filesList, previewLength, baseUrl) {
    const foundFiles = [];

    for (const file of filesList) {
        const fileUrl = `${baseUrl}/${file}`;
        try {
            const getResponse = await Promise.race([
                fetch(fileUrl, { method: 'GET' }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
            ]);

            if (getResponse.ok) {
                const contentType = getResponse.headers.get('content-type') || 'unknown';
                const contentLength = getResponse.headers.get('content-length');
                const text = await getResponse.text();
                const size = contentLength || text.length;
                const preview = text.substring(0, previewLength).trim() || text.substring(0, previewLength * 5).trim();

                foundFiles.push({
                    file,
                    url: fileUrl,
                    status: getResponse.status,
                    contentType: contentType,
                    size: size,
                    preview: preview || '(binary or empty)',
                    foundAt: Date.now()
                });
            }
        } catch (error) {
            // File not found or error - skip
        }
    }

    return foundFiles;
}
