import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';

const ENC_KEY_STORAGE = 'api_key_enc_key_permanent';

async function getCryptoKey(): Promise<CryptoKey> {
  const stored = localStorage.getItem(ENC_KEY_STORAGE);
  if (stored) {
    try {
      const raw = Uint8Array.from(atob(stored), c => c.charCodeAt(0));
      const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
      logger.info('[API_KEY_SERVICE] Successfully imported existing crypto key from permanent storage');
      return key;
    } catch (error) {
      logger.error('[API_KEY_SERVICE] Failed to import stored crypto key, generating new one:', error);
      localStorage.removeItem(ENC_KEY_STORAGE);
    }
  }
  
  logger.info('[API_KEY_SERVICE] Generating new crypto key for permanent storage...');
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const raw = await crypto.subtle.exportKey('raw', key);
  const encoded = btoa(String.fromCharCode(...new Uint8Array(raw)));
  localStorage.setItem(ENC_KEY_STORAGE, encoded);
  logger.info('[API_KEY_SERVICE] New crypto key generated and stored permanently');
  return key;
}

async function encryptValue(value: string): Promise<{ iv: string; data: string }> {
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(value);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return {
    iv: btoa(String.fromCharCode(...iv)),
    data: btoa(String.fromCharCode(...new Uint8Array(encrypted)))
  };
}

async function decryptValue(iv: string, data: string): Promise<string> {
  const key = await getCryptoKey();
  const ivArr = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
  const encrypted = Uint8Array.from(atob(data), c => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivArr }, key, encrypted);
  return new TextDecoder().decode(decrypted);
}

interface StoredApiKey {
  id: string;
  token: string;
  apiKey: string;
  created: number;
  lastUsed: number;
}

// Secure localStorage prefix
const STORAGE_PREFIX = 'secure_api_key_';

/**
 * Securely store an API key and return a token for retrieving it
 */
export async function storeApiKey(apiKey: string): Promise<string> {
  try {
    logger.info('[API_KEY_SERVICE] Storing new API key...');
    const id = uuidv4();
    const token = uuidv4();

    const encrypted = await encryptValue(apiKey);

    const entry: StoredApiKey = {
      id,
      token,
      apiKey: JSON.stringify(encrypted),
      created: Date.now(),
      lastUsed: Date.now()
    };

    localStorage.setItem(`${STORAGE_PREFIX}${id}`, JSON.stringify(entry));

    const tokenMap = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}token_map`) || '{}');
    tokenMap[token] = id;
    localStorage.setItem(`${STORAGE_PREFIX}token_map`, JSON.stringify(tokenMap));

    logger.info('[API_KEY_SERVICE] API key stored successfully with token:', token.slice(-8));
    return token;
  } catch (error) {
    logger.error('[API_KEY_SERVICE] Failed to store API key:', error);
    throw new Error('Failed to securely store API key');
  }
}

/**
 * Retrieve an API key using a token
 */
export async function getApiKey(token: string): Promise<string | null> {
  try {
    logger.info('[API_KEY_SERVICE] Retrieving API key for token:', token.slice(-8));
    
    // Check if we have an encryption key first
    const hasEncryptionKey = !!localStorage.getItem(ENC_KEY_STORAGE);
    if (!hasEncryptionKey) {
      logger.warn('[API_KEY_SERVICE] No encryption key found in permanent storage');
      // Try to regenerate the encryption key - this will fail for existing encrypted data
      // but we'll handle that gracefully
    }
    
    // Look up the ID from the token map
    const tokenMap = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}token_map`) || '{}');
    const id = tokenMap[token];
    
    if (!id) {
      logger.warn('[API_KEY_SERVICE] Token not found in token map');
      return null;
    }
    
    // Get the stored key entry
    const storedEntry = localStorage.getItem(`${STORAGE_PREFIX}${id}`);
    if (!storedEntry) {
      logger.warn('[API_KEY_SERVICE] Stored API key entry not found for ID:', id);
      return null;
    }
    
    const entry: StoredApiKey = JSON.parse(storedEntry);
    
    // Verify the token matches
    if (entry.token !== token) {
      logger.warn('[API_KEY_SERVICE] Token mismatch in stored entry');
      return null;
    }
    
    // Update last used time
    entry.lastUsed = Date.now();
    localStorage.setItem(`${STORAGE_PREFIX}${id}`, JSON.stringify(entry));

    try {
      const { iv, data } = JSON.parse(entry.apiKey);
      const decryptedKey = await decryptValue(iv, data);
      logger.info('[API_KEY_SERVICE] API key retrieved and decrypted successfully');
      return decryptedKey;
    } catch (decryptError) {
      logger.error('[API_KEY_SERVICE] Failed to decrypt API key - encryption key may be missing:', decryptError);
      // If decryption fails due to missing encryption key, delete the invalid entry
      deleteApiKey(token);
      return null;
    }
  } catch (error) {
    logger.error('[API_KEY_SERVICE] Failed to retrieve API key:', error);
    return null;
  }
}

/**
 * Check if a saved API key token exists
 */
export function hasSavedApiKey(): boolean {
  try {
    const tokenMap = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}token_map`) || '{}');
    const hasKeys = Object.keys(tokenMap).length > 0;
    logger.info('[API_KEY_SERVICE] Has saved API keys:', hasKeys);
    return hasKeys;
  } catch (error) {
    logger.error('[API_KEY_SERVICE] Error checking for saved API keys:', error);
    return false;
  }
}

/**
 * Delete a stored API key
 */
export function deleteApiKey(token: string): boolean {
  try {
    logger.info('[API_KEY_SERVICE] Deleting API key for token:', token.slice(-8));
    const tokenMap = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}token_map`) || '{}');
    const id = tokenMap[token];
    
    if (!id) {
      logger.warn('[API_KEY_SERVICE] Token not found for deletion');
      return false;
    }
    
    // Remove the stored key
    localStorage.removeItem(`${STORAGE_PREFIX}${id}`);
    
    // Remove from token map
    delete tokenMap[token];
    localStorage.setItem(`${STORAGE_PREFIX}token_map`, JSON.stringify(tokenMap));
    
    logger.info('[API_KEY_SERVICE] API key deleted successfully');
    return true;
  } catch (error) {
    logger.error('[API_KEY_SERVICE] Failed to delete API key:', error);
    return false;
  }
}

/**
 * Clear all stored API keys - diagnostic function
 */
export function clearAllApiKeys(): void {
  try {
    logger.info('[API_KEY_SERVICE] Clearing all stored API keys...');
    const tokenMap = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}token_map`) || '{}');
    
    // Remove all stored key entries
    Object.values(tokenMap).forEach((id: any) => {
      localStorage.removeItem(`${STORAGE_PREFIX}${id}`);
    });
    
    // Clear token map
    localStorage.removeItem(`${STORAGE_PREFIX}token_map`);
    
    // Clear permanent encryption key
    localStorage.removeItem(ENC_KEY_STORAGE);
    
    logger.info('[API_KEY_SERVICE] All API keys cleared');
  } catch (error) {
    logger.error('[API_KEY_SERVICE] Failed to clear API keys:', error);
  }
}

/**
 * Get diagnostic information about stored keys
 */
export function getApiKeyDiagnostics(): {
  hasTokenMap: boolean;
  tokenCount: number;
  tokens: string[];
  hasEncryptionKey: boolean;
  encryptionKeyStatus: string;
} {
  try {
    const tokenMap = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}token_map`) || '{}');
    const tokens = Object.keys(tokenMap);
    const hasEncryptionKey = !!localStorage.getItem(ENC_KEY_STORAGE);
    
    let encryptionKeyStatus = 'Missing';
    if (hasEncryptionKey) {
      encryptionKeyStatus = 'Present (Permanent)';
    } else if (tokens.length > 0) {
      encryptionKeyStatus = 'Missing (Stored keys cannot be decrypted)';
    }
    
    return {
      hasTokenMap: !!localStorage.getItem(`${STORAGE_PREFIX}token_map`),
      tokenCount: tokens.length,
      tokens: tokens.map(t => t.slice(-8)), // Only show last 8 chars for security
      hasEncryptionKey,
      encryptionKeyStatus
    };
  } catch (error) {
    logger.error('[API_KEY_SERVICE] Error getting diagnostics:', error);
    return {
      hasTokenMap: false,
      tokenCount: 0,
      tokens: [],
      hasEncryptionKey: false,
      encryptionKeyStatus: 'Error'
    };
  }
}

/**
 * Get all stored API key metadata (without exposing the keys themselves)
 */
export function getStoredApiKeyMetadata(): Array<{id: string, created: number, lastUsed: number}> {
  try {
    const tokenMap = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}token_map`) || '{}');
    
    return Object.values(tokenMap).map(id => {
      const entry: StoredApiKey = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}${id}`) || '{}');
      return {
        id: entry.id,
        created: entry.created,
        lastUsed: entry.lastUsed
      };
    });
  } catch (error) {
    logger.error('Failed to get API key metadata:', error);
    return [];
  }
}
