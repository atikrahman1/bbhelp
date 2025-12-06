// Endpoint extraction patterns
const ENDPOINT_PATTERNS = {
  apiPath: /["'`](\/api\/[a-zA-Z0-9_\-\/{}:]+)["'`]/g,
  versionedPath: /["'`](\/v\d+\/[a-zA-Z0-9_\-\/{}:]+)["'`]/g,
  fullUrl: /["'`](https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+)["'`]/g,
  relativePath: /["'`](\/[a-zA-Z0-9_\-]+(?:\/[a-zA-Z0-9_\-{}:]+)+)["'`]/g,
  graphqlPath: /["'`](\/graphql|\/gql)["'`]/gi,
  fetchCall: /(?:fetch|axios)\s*\(\s*["'`]([^"'`]+)["'`]/g,
  axiosMethod: /axios\.(get|post|put|patch|delete|head|options)\s*\(\s*["'`]([^"'`]+)["'`]/gi,
  templateUrl: /`([^`]*(?:https?:\/\/|\/api\/|\/v\d+\/)[^`]*)`/g,
  restEndpoint: /["'`](\/(?:users|auth|login|logout|register|profile|settings|posts|comments|products|orders|payments|upload|download|search|items|entities|resources|admin|dashboard|account|data|files|images|videos|docs|reports|analytics|notifications|messages|chat|feed|activity|events|tasks|projects|teams|groups|members|roles|permissions|config|status|health|metrics|logs|debug|test|dev|staging|prod|public|private|internal|external|v1|v2|v3)(?:\/[a-zA-Z0-9_\-{}:]*)?(?:\/[a-zA-Z0-9_\-{}:]+)*)["'`]/g
};

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

function extractMethod(content, matchIndex, endpoint) {
  const contextStart = Math.max(0, matchIndex - 100);
  const contextEnd = Math.min(content.length, matchIndex + endpoint.length + 100);
  const context = content.substring(contextStart, contextEnd);

  const axiosMatch = context.match(/axios\.(get|post|put|patch|delete|head|options)/i);
  if (axiosMatch) return axiosMatch[1].toUpperCase();

  const fetchMethodMatch = context.match(/method\s*:\s*["'`](GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)["'`]/i);
  if (fetchMethodMatch) return fetchMethodMatch[1].toUpperCase();

  for (const method of HTTP_METHODS) {
    const methodRegex = new RegExp(`["'\`]${method}["'\`]`, 'i');
    if (methodRegex.test(context)) return method;
  }

  if (endpoint.includes('{id}') || endpoint.includes(':id') || /\/\d+/.test(endpoint)) return 'GET';
  if (endpoint.includes('/login') || endpoint.includes('/register') || endpoint.includes('/upload') || endpoint.includes('/create')) return 'POST';
  if (endpoint.includes('/update') || endpoint.includes('/edit')) return 'PUT';
  if (endpoint.includes('/delete') || endpoint.includes('/remove')) return 'DELETE';

  return 'GET';
}

function calculateConfidence(endpoint, method, context) {
  let confidence = 50;

  if (endpoint.startsWith('/api/')) confidence += 30;
  if (endpoint.startsWith('/v1/') || endpoint.startsWith('/v2/') || endpoint.startsWith('/v3/')) confidence += 25;
  if (endpoint === '/graphql' || endpoint === '/gql') confidence += 30;
  if (method !== 'GET' || context.includes('method')) confidence += 15;
  if (endpoint.includes('{') || endpoint.includes(':')) confidence += 10;
  if (/\/(users|auth|login|posts|products|orders|api)/.test(endpoint)) confidence += 15;
  if (endpoint.startsWith('http')) confidence += 20;
  if (endpoint.length < 4) confidence -= 20;
  if (!endpoint.includes('/')) confidence -= 15;
  if (/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|ttf|eot|json|xml|txt|html|htm)$/i.test(endpoint)) confidence -= 40;

  return Math.min(100, Math.max(0, confidence));
}

function normalizeEndpoint(endpoint) {
  endpoint = endpoint.replace(/["'`]/g, '');
  const [path] = endpoint.split('?');
  return path.trim();
}

function isValidEndpoint(endpoint) {
  if (endpoint.length < 3) return false;

  const falsePositives = [
    '//', '/\\"', '/\\', '/node_modules/', '/webpack/', '/dist/', '/build/',
    '/__', '/static/', '/public/', '/images/', '/img/', '/fonts/', '/styles/',
    '/css/', '/scripts/', '/js/', '/assets/', '/.', '/favicon'
  ];

  for (const fp of falsePositives) {
    if (endpoint.includes(fp)) return false;
  }

  if (!endpoint.startsWith('/') && !endpoint.startsWith('http')) return false;

  return true;
}

window.extractEndpointsFromJS = function(content, sourceFile) {
  const results = [];
  const seenEndpoints = new Set();

  if (!content) return results;

  let baseUrl = '';
  try {
    const url = new URL(sourceFile);
    baseUrl = `${url.protocol}//${url.host}`;
  } catch (e) {
    baseUrl = '';
  }

  for (const [patternName, pattern] of Object.entries(ENDPOINT_PATTERNS)) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);

    while ((match = regex.exec(content)) !== null) {
      let endpoint = match[1] || match[2];
      if (!endpoint) continue;

      endpoint = normalizeEndpoint(endpoint);
      if (!isValidEndpoint(endpoint)) continue;

      const uniqueKey = `${endpoint}|${sourceFile}`;
      if (seenEndpoints.has(uniqueKey)) continue;
      seenEndpoints.add(uniqueKey);

      const method = extractMethod(content, match.index, endpoint);
      const contextStart = Math.max(0, match.index - 50);
      const contextEnd = Math.min(content.length, match.index + 100);
      const context = content.substring(contextStart, contextEnd);
      const confidence = calculateConfidence(endpoint, method, context);

      if (confidence >= 30) {
        results.push({
          endpoint,
          method,
          file: sourceFile,
          baseUrl,
          confidence,
          patternType: patternName
        });
      }
    }
  }

  results.sort((a, b) => b.confidence - a.confidence);
  return results;
};
