/**
 * functions/api/lib/google-auth.js
 * Service Account JWT Generator & OAuth2 Access Token Resolver for Cloudflare Workers
 * 
 * Context: Cloudflare Workers / Edge Runtime (Web Crypto API)
 */

/**
 * Encodes an ArrayBuffer or Uint8Array into Base64URL string (RFC 4648)
 * @param {ArrayBuffer|Uint8Array} buffer 
 * @returns {string} Base64URL encoded string
 */
function base64UrlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Converts a string into Base64URL encoding
 * @param {string} str 
 * @returns {string}
 */
function stringToBase64Url(str) {
  const encoder = new TextEncoder();
  return base64UrlEncode(encoder.encode(str));
}

/**
 * Parses a PEM formatted PKCS#8 RSA private key into Web Crypto CryptoKey
 * @param {string} pemKey RSA Private Key string (PEM format)
 * @returns {Promise<CryptoKey>}
 */
async function importPrivateKey(pemKey) {
  // Normalize key format (handle escaped newlines from environment variables)
  const cleanKey = pemKey
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');

  // Convert Base64 string to ArrayBuffer
  const binaryDerString = atob(cleanKey);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  // Import key into Web Crypto API using RSASSA-PKCS1-v1_5 SHA-256
  return await crypto.subtle.importKey(
    'pkcs8',
    binaryDer.buffer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: { name: 'SHA-256' }
    },
    false,
    ['sign']
  );
}

/**
 * Generates an RS256 signed JWT for Google Service Account authentication
 * @param {Object} params
 * @param {string} params.clientEmail Service account email
 * @param {string} params.privateKey Service account private key PEM
 * @param {string|Array<string>} params.scopes OAuth2 scopes
 * @returns {Promise<string>} Signed JWT string
 */
export async function createGoogleJwt({ clientEmail, privateKey, scopes }) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600; // 1 Hour Expiry

  const formattedScopes = Array.isArray(scopes) ? scopes.join(' ') : scopes;

  // Header
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };

  // Claim Set
  const payload = {
    iss: clientEmail,
    scope: formattedScopes,
    aud: 'https://oauth2.googleapis.com/token',
    exp: exp,
    iat: now
  };

  const encodedHeader = stringToBase64Url(JSON.stringify(header));
  const encodedPayload = stringToBase64Url(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  // Sign token using imported Web Crypto RSA Private Key
  const cryptoKey = await importPrivateKey(privateKey);
  const encoder = new TextEncoder();
  const signatureArrayBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  const encodedSignature = base64UrlEncode(signatureArrayBuffer);

  return `${unsignedToken}.${encodedSignature}`;
}

/**
 * Exchanges a Service Account JWT for a short-lived Google OAuth2 Access Token
 * @param {Object} params
 * @param {string} params.clientEmail Google Service Account Email
 * @param {string} params.privateKey Google Service Account RSA Private Key
 * @param {string|Array<string>} params.scopes Required Google REST API scopes
 * @returns {Promise<string>} Bearer Access Token
 */
export async function getGoogleAccessToken({ clientEmail, privateKey, scopes }) {
  if (!clientEmail || !privateKey) {
    throw new Error('Google Auth Error: Missing clientEmail or privateKey credentials.');
  }

  const jwt = await createGoogleJwt({ clientEmail, privateKey, scopes });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Access Token exchange failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}
