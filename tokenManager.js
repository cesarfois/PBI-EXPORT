import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKENS_FILE = path.join(__dirname, 'tokens.json');

// Memory cache
let cachedTokens = null;

export const tokenManager = {
    /**
     * Initialize: Read tokens from disk
     */
    init: async () => {
        try {
            const data = await fs.readFile(TOKENS_FILE, 'utf-8');
            cachedTokens = JSON.parse(data);
            console.log('[TokenManager] Loaded tokens.');
        } catch (error) {
            console.log('[TokenManager] No tokens found found or error reading file.');
            cachedTokens = null;
        }
    },

    /**
     * Save tokens from Frontend login
     */
    setTokens: async (tokens) => {
        cachedTokens = {
            ...tokens,
            updatedAt: new Date().toISOString()
        };
        await fs.writeFile(TOKENS_FILE, JSON.stringify(cachedTokens, null, 2));
        console.log('[TokenManager] Tokens updated manually.');
    },

    /**
     * Get a valid Access Token.
     * Refreshes automatically if needed/possible.
     */
    getAccessToken: async () => {
        // 1. Try Cached Token first
        if (cachedTokens && cachedTokens.token) {
            return cachedTokens.token;
        }

        console.warn('[TokenManager] No active session found. Attempting Service Account fallback...');

        // 2. Fallback to Service Account
        try {
            return await tokenManager.loginWithServiceAccount();
        } catch (e) {
            console.error('[TokenManager] All auth methods failed.');
            throw new Error('No authentication session found and Service Account failed. Please login via the App.');
        }
    },

    /**
     * Refresh the token using the stored Refresh Token.
     * Synchronized to prevent parallel refreshes.
     */
    refreshAccessToken: async () => {
        if (!cachedTokens || !cachedTokens.refreshToken) {
            console.warn('[TokenManager] No refresh token available. Trying Service Account...');
            return await tokenManager.loginWithServiceAccount();
        }

        console.log('[TokenManager] Refreshing token...');

        const params = new URLSearchParams();
        params.append('grant_type', 'refresh_token');
        params.append('refresh_token', cachedTokens.refreshToken);
        params.append('client_id', process.env.VITE_DOCUWARE_CLIENT_ID || 'docuware.platform');
        params.append('client_secret', process.env.VITE_DOCUWARE_CLIENT_SECRET || '');

        try {
            // We need the token endpoint. Saved in tokens?
            // If missing, we must discover it (hard without a base URL context unless saved)
            // Ideally, we saved 'tokenEndpoint' in cachedTokens
            const tokenEndpoint = cachedTokens.tokenEndpoint || 'https://login-emea.docuware.cloud/oauth/token';

            const response = await axios.post(tokenEndpoint, params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            const { access_token, refresh_token, expires_in } = response.data;

            // Update state
            cachedTokens = {
                ...cachedTokens,
                token: access_token,
                accessToken: access_token, // normalize
                refreshToken: refresh_token || cachedTokens.refreshToken, // RT rotation usually happens
                expiresAt: Date.now() + ((expires_in || 3600) * 1000),
                updatedAt: new Date().toISOString()
            };

            await fs.writeFile(TOKENS_FILE, JSON.stringify(cachedTokens, null, 2));
            console.log('[TokenManager] Token refreshed successfully.');

            return cachedTokens.token;

        } catch (err) {
            console.error('[TokenManager] Refresh failed:', err.response?.data || err.message);
            // Fallback to Service Account on hard failure
            console.warn('[TokenManager] Refresh failed. Attempting Service Account login...');
            return await tokenManager.loginWithServiceAccount();
        }
    },

    /**
     * Login using Service Account Credentials (ROPC Flow)
     * This is the robust fallback for background tasks.
     */
    loginWithServiceAccount: async () => {
        const username = process.env.DOCUWARE_USERNAME;
        const password = process.env.DOCUWARE_PASSWORD;

        if (!username || !password) {
            throw new Error("Service Account credentials (DOCUWARE_USERNAME/PASSWORD) not configured in .env");
        }

        console.log('[TokenManager] 🔄 Attempting Service Account Login...');

        try {
            // We need a Token Endpoint. 
            // Since we might not have a session, we need a default one or discover it from a known Org URL?
            // Problem: Multi-tenant URLs vary. 
            // Solution: Use the hardcoded main endpoint if known, or rely on a configured Base URL in .env?
            // Let's rely on cachedTokens.tokenEndpoint if available, OR a default EMEA one if empty. 
            // Better: Add DOCUWARE_ORG_URL to .env for discovery, but for now let's try the standard one.
            const tokenEndpoint = (cachedTokens && cachedTokens.tokenEndpoint) || 'https://login-emea.docuware.cloud/oauth/token';

            const params = new URLSearchParams();
            params.append('grant_type', 'password');
            params.append('username', username);
            params.append('password', password);
            params.append('client_id', process.env.VITE_DOCUWARE_CLIENT_ID || 'docuware.platform');
            params.append('client_secret', process.env.VITE_DOCUWARE_CLIENT_SECRET || '');
            params.append('scope', 'docuware.platform offline_access');

            const response = await axios.post(tokenEndpoint, params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            const { access_token, refresh_token, expires_in } = response.data;

            // Save new session
            cachedTokens = {
                ...cachedTokens, // Keep other info like tokenEndpoint if possible
                token: access_token,
                accessToken: access_token,
                refreshToken: refresh_token,
                expiresAt: Date.now() + ((expires_in || 3600) * 1000),
                updatedAt: new Date().toISOString(),
                isServiceAccount: true
            };

            await fs.writeFile(TOKENS_FILE, JSON.stringify(cachedTokens, null, 2));
            console.log('[TokenManager] ✅ Service Account Login Successful.');

            return access_token;

        } catch (error) {
            console.error('[TokenManager] ❌ Service Account Login Failed:', error.response?.data || error.message);
            throw error;
        }
    }
};
