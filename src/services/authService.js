import axios from 'axios';
import api from './api';

const AUTH_KEY = 'docuware_auth';

// Environment Variables
const CLIENT_ID = import.meta.env.VITE_DOCUWARE_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.VITE_DOCUWARE_CLIENT_SECRET;
const REDIRECT_URI = import.meta.env.VITE_DOCUWARE_REDIRECT_URI;

/**
 * Get the base URL for the proxy server.
 * In development: localhost:3001
 * In production: Netlify Functions
 */
const getProxyBaseUrl = () => {
    const isDev = import.meta.env.DEV || window.location.hostname === 'localhost';
    return isDev ? 'http://localhost:3001' : window.location.origin + '/.netlify/functions/api';
};

export const authService = {
    /**
     * Initiates OAuth login by redirecting to DocuWare
     * @param {string} url - DocuWare Platform URL (e.g. https://rcsangola.docuware.cloud)
     */
    login: async (url) => {
        try {
            // Normalize URL
            let baseUrl = url.replace(/\/$/, '').trim();
            if (baseUrl.includes('.docuware.cloud') && baseUrl.startsWith('http://')) {
                baseUrl = baseUrl.replace('http://', 'https://');
            }

            console.log('🔐 Starting OAuth login for:', baseUrl);

            // 1. Get Identity Service Info
            const proxyBase = getProxyBaseUrl();
            const serviceDesc = await axios.get(`${proxyBase}/discovery?target=${encodeURIComponent(baseUrl)}`);
            const identityUrl = serviceDesc.data.IdentityServiceUrl;

            console.log('🔑 Identity Service:', identityUrl);

            // 2. Discover OpenID endpoints
            const proxiedIdentity = `/docuware-proxy${new URL(identityUrl).pathname}`;
            const identityOrigin = new URL(identityUrl).origin;

            const discovery = await axios.get(`${proxiedIdentity}/.well-known/openid-configuration`, {
                headers: { 'x-target-url': identityOrigin }
            });

            const authorizationEndpoint = discovery.data.authorization_endpoint;

            // 3. Build Authorization URL
            const authUrl = new URL(authorizationEndpoint);
            authUrl.searchParams.append('response_type', 'code');
            authUrl.searchParams.append('client_id', CLIENT_ID);
            authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
            authUrl.searchParams.append('scope', 'docuware.platform offline_access');

            // Save Base URL for after callback
            sessionStorage.setItem('docuware_pre_login_url', baseUrl);

            console.log('🚀 Redirecting to DocuWare login...');
            window.location.href = authUrl.toString();

        } catch (error) {
            console.error('❌ Login initialization failed:', error);
            throw error;
        }
    },

    /**
     * Exchanges authorization code for tokens (called after OAuth callback)
     * @param {string} code - Authorization code from callback
     */
    exchangeCodeForToken: async (code) => {
        const baseUrl = sessionStorage.getItem('docuware_pre_login_url');
        if (!baseUrl) throw new Error('Base URL lost during redirect.');

        try {
            console.log('🔄 Exchanging code for token...');

            // 1. Rediscover endpoints
            const proxyBase = getProxyBaseUrl();
            const serviceDescResp = await axios.get(`${proxyBase}/discovery?target=${encodeURIComponent(baseUrl)}`);
            const identityUrl = serviceDescResp.data.IdentityServiceUrl;

            const proxiedIdentity = `/docuware-proxy${new URL(identityUrl).pathname}`;
            const identityOrigin = new URL(identityUrl).origin;

            const discoveryResp = await fetch(`${proxiedIdentity}/.well-known/openid-configuration`, {
                method: 'GET',
                credentials: 'omit',
                headers: {
                    'x-target-url': identityOrigin,
                    'Accept': 'application/json'
                }
            });

            if (!discoveryResp.ok) throw new Error(`OpenID Discovery failed: ${discoveryResp.status}`);
            const discovery = await discoveryResp.json();

            const tokenEndpoint = discovery.token_endpoint;
            const tokenPath = new URL(tokenEndpoint).pathname;
            const tokenOrigin = new URL(tokenEndpoint).origin;
            const proxiedToken = `/docuware-proxy${tokenPath}`;

            // 2. Exchange code for token
            const params = new URLSearchParams();
            params.append('grant_type', 'authorization_code');
            params.append('code', code);
            params.append('client_id', CLIENT_ID);
            params.append('client_secret', CLIENT_SECRET);
            params.append('redirect_uri', REDIRECT_URI);

            const response = await axios.post(proxiedToken, params, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'x-target-url': tokenOrigin
                }
            });

            const { access_token, refresh_token } = response.data;

            // Set Authorization header for API calls
            api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

            // Save auth data
            const authData = {
                token: access_token,
                refreshToken: refresh_token,
                url: baseUrl,
                tokenEndpoint: tokenEndpoint
            };

            sessionStorage.setItem(AUTH_KEY, JSON.stringify(authData));
            sessionStorage.removeItem('docuware_pre_login_url');

            // --- CENTRALIZED AUTH SYNC ---
            // Push valid session to Backend so Scheduler can use it
            try {
                const proxyBase = getProxyBaseUrl();
                await axios.post(`${proxyBase}/api/auth/session`, authData);
                console.log('✅ Session synced with Backend!');
            } catch (err) {
                console.error('⚠️ Failed to sync session with Backend:', err);
            }
            // -----------------------------

            console.log('✅ Authentication successful!');
            return authData;

        } catch (error) {
            console.error('❌ Token exchange failed:', error);
            throw error;
        }
    },

    /**
     * Refreshes the access token using the Backend (Centralized)
     */
    refreshToken: async () => {
        try {
            console.log('🔄 Requesting token refresh from Backend...');
            const proxyBase = getProxyBaseUrl();

            // Ask backend to refresh (force)
            const response = await axios.get(`${proxyBase}/api/auth/token?refresh=true`);
            const newToken = response.data.token;

            // Update local storage with new token (partial update)
            const stored = sessionStorage.getItem(AUTH_KEY);
            if (stored) {
                const authData = JSON.parse(stored);
                authData.token = newToken;
                // Note: We don't get the new Refresh Token here unless we ask for it, 
                // but we don't need it locally anymore if we trust the backend.
                // However, to keep "save schedule" working (which sends authData), 
                // we might want it. But we plan to decouple Scheduler from this authData.
                sessionStorage.setItem(AUTH_KEY, JSON.stringify(authData));
            }

            api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
            console.log('✅ Token refreshed via Backend!');
            return newToken;

        } catch (error) {
            console.error('❌ Token refresh failed:', error);
            authService.logout();
            throw error;
        }
    },

    /**
     * Logs out the user
     */
    logout: () => {
        console.log('👋 Logging out...');
        sessionStorage.removeItem(AUTH_KEY);
        sessionStorage.removeItem('docuware_pre_login_url');
        delete api.defaults.headers.common['Authorization'];
    },

    /**
     * Gets current user auth data from storage
     */
    getCurrentUser: () => {
        const stored = sessionStorage.getItem(AUTH_KEY);
        if (!stored) return null;

        try {
            const authData = JSON.parse(stored);
            // Restore Authorization header
            if (authData.token) {
                api.defaults.headers.common['Authorization'] = `Bearer ${authData.token}`;
            }
            return authData;
        } catch {
            return null;
        }
    },

    /**
     * Setup axios interceptors for automatic token refresh
     */
    setupAxiosInterceptors: () => {
        api.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config;

                // If 401 and not already retrying
                if (error.response?.status === 401 && !originalRequest._retry) {
                    originalRequest._retry = true;

                    try {
                        const newToken = await authService.refreshToken();
                        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
                        return api(originalRequest);
                    } catch (refreshError) {
                        // Refresh failed, redirect to login
                        window.location.href = '/login';
                        return Promise.reject(refreshError);
                    }
                }

                return Promise.reject(error);
            }
        );
    }
};
