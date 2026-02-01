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
        if (!cachedTokens) throw new Error('No authentication session found. Please login via the App.');

        // Check if we assume it's valid or check expiration if we tracked it. 
        // DocuWare doesn't always strictly send expires_in in all flows, but usually does.
        // For robustness, we will try to use it. If it fails (401), the caller might retry?
        // Better: logic to refresh.

        // Since we don't strictly track expiry in the simplified frontend, let's implement a "Force Refresh" option 
        // OR just try to refresh if it's been > X minutes?
        // Let's implement a safe 'getOrRefresh' logic.

        // Actually, easiest strategy: Just return current. If caller gets 401, they call `refreshToken()`.
        // BUT, we want to PREVENT race conditions.
        // So `refreshToken()` must be synchronized.

        return cachedTokens.access_token || cachedTokens.token;
    },

    /**
     * Refresh the token using the stored Refresh Token.
     * Synchronized to prevent parallel refreshes.
     */
    refreshAccessToken: async () => {
        if (!cachedTokens || !cachedTokens.refreshToken) throw new Error('No refresh token available.');

        console.log('[TokenManager] Refreshing token...');

        const params = new URLSearchParams();
        params.append('grant_type', 'refresh_token');
        params.append('refresh_token', cachedTokens.refreshToken);
        params.append('client_id', process.env.VITE_DOCUWARE_CLIENT_ID || 'docuware.platform');
        params.append('client_secret', process.env.VITE_DOCUWARE_CLIENT_SECRET || '');

        try {
            // We need the token endpoint. Saved in tokens?
            const tokenEndpoint = cachedTokens.tokenEndpoint || 'https://login-emea.docuware.cloud/oauth/token'; // Fallback dangerous

            // If tokenEndpoint is missing, we might be in trouble unless we look it up.
            // But authService usually saves it.

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
            throw new Error('Session expired or invalid. Please login again.');
        }
    }
};
